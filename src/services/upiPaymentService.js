import { Linking } from 'react-native';
import {
  getLocalUpiRecord,
  saveLocalUpiRecord,
  DEFAULT_UPI_ID,
  DEFAULT_UPI_UPDATE,
  DEFAULT_UPI_UPDATED_AT,
} from '../database/queries';
import { API_CONFIG } from '../constants/api_config';

export const SUPPORT_UPI_CONFIG = {
  payeeName: 'Expense App Developer',
  defaultNote: 'Support Expense App',
  suggestedAmounts: [10, 20, 50, 100],
  defaultAmount: 50,
};

/**
 * Validates whether a given string matches standard UPI ID format
 */
export const isValidUpiId = (upiId) => {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$/;
  return upiRegex.test(trimmed);
};

/**
 * Mutex lock to prevent simultaneous duplicate requests from repeated clicks
 */
let inFlightConfigPromise = null;

/**
 * Always fetches, saves, and returns the latest UPI ID from the server.
 * 
 * 1. Makes an API request to fetch the latest server-configured upi_id.
 * 2. If fetched successfully and valid, immediately saves it to local SQLite storage.
 * 3. Returns the latest fetched upi_id for immediate display.
 * 4. If offline, network fails, or timeout occurs, gracefully returns the last successfully
 *    saved UPI record from local storage without failing or showing an outdated value.
 */
export const syncAndGetLatestUpiConfig = async () => {
  if (inFlightConfigPromise) {
    return inFlightConfigPromise;
  }

  inFlightConfigPromise = (async () => {
    const local = getLocalUpiRecord();
    const currentLocalUpdate = typeof local.upiUpdate === 'number' ? local.upiUpdate : DEFAULT_UPI_UPDATE;

    try {
      const url = new URL(API_CONFIG.GET_UPI_URL);
      // Cache-busting timestamp to prevent stale proxy or HTTP caching
      url.searchParams.append('_t', String(Date.now()));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();

        if (json && json.success) {
          const serverUpiId = json.upi_id ? String(json.upi_id).trim() : null;
          const serverUpiUpdate = parseInt(json.upi_update, 10);
          const safeServerUpdate = !isNaN(serverUpiUpdate) ? serverUpiUpdate : currentLocalUpdate;
          const serverUpdatedAt = json.updated_at ? String(json.updated_at).trim() : null;

          // Always validate and save the latest fetched UPI ID to local storage
          if (serverUpiId && isValidUpiId(serverUpiId)) {
            saveLocalUpiRecord(serverUpiId, safeServerUpdate, serverUpdatedAt);

            return {
              success: true,
              upiId: serverUpiId,
              upiUpdate: safeServerUpdate,
              updatedAt: serverUpdatedAt,
              fromCache: false,
            };
          } else {
            console.warn('[UPI] Server returned invalid or empty upi_id. Preserving cached value:', serverUpiId);
          }
        }
      }
    } catch (err) {
      console.warn('[UPI] Server UPI fetch error:', err?.message);
    } finally {
      inFlightConfigPromise = null;
    }

    // Offline / Network Failure Fallback:
    // Safely retrieve and return the last successfully saved UPI record from local SQLite.
    const fallbackRecord = getLocalUpiRecord();
    const fallbackUpiId = (fallbackRecord.upiId && isValidUpiId(fallbackRecord.upiId))
      ? fallbackRecord.upiId
      : DEFAULT_UPI_ID;
    const fallbackUpiUpdate = fallbackRecord.upiUpdate || DEFAULT_UPI_UPDATE;
    const fallbackUpdatedAt = fallbackRecord.updatedAt || DEFAULT_UPI_UPDATED_AT;

    return {
      success: true,
      upiId: fallbackUpiId,
      upiUpdate: fallbackUpiUpdate,
      updatedAt: fallbackUpdatedAt,
      fromCache: true,
      fallback: true,
    };
  })();

  return inFlightConfigPromise;
};

/**
 * Builds a validated standard UPI URI string:
 * upi://pay?pa=<UPI_ID>&pn=<NAME>&tn=<NOTE>&am=<AMOUNT>&cu=INR
 */
export const buildUpiUrl = ({
  amount,
  note = SUPPORT_UPI_CONFIG.defaultNote,
  upiId,
  payeeName = SUPPORT_UPI_CONFIG.payeeName,
}) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Please enter a valid amount greater than 0');
  }

  if (!upiId || !isValidUpiId(upiId)) {
    throw new Error('Invalid or missing recipient UPI ID');
  }

  const formattedAmount = numAmount.toFixed(2);
  const encodedUpiId = encodeURIComponent(upiId.trim());
  const encodedName = encodeURIComponent(payeeName.trim());
  const encodedNote = encodeURIComponent(note.trim());

  return `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&tn=${encodedNote}&am=${formattedAmount}&cu=INR`;
};

/**
 * Launches native UPI intent using verified latest server-side UPI configuration.
 */
export const launchUpiPayment = async ({
  amount,
  note = SUPPORT_UPI_CONFIG.defaultNote,
  upiId,
}) => {
  let activeUpiId = upiId;

  // If no validated UPI ID was passed in, run version check immediately
  if (!activeUpiId || !isValidUpiId(activeUpiId)) {
    const configRes = await syncAndGetLatestUpiConfig();
    if (!configRes.success || !configRes.upiId || !isValidUpiId(configRes.upiId)) {
      return {
        success: false,
        error: 'NO_UPI_ID',
        message:
          configRes.message ||
          'Payment details could not be retrieved from the server. Please check your internet connection.',
      };
    }
    activeUpiId = configRes.upiId;
  }

  try {
    const upiUrl = buildUpiUrl({
      amount,
      note,
      upiId: activeUpiId,
    });

    let canOpen = false;
    try {
      canOpen = await Linking.canOpenURL(upiUrl);
    } catch (e) {
      canOpen = false;
    }

    await Linking.openURL(upiUrl);
    return { success: true, upiId: activeUpiId };
  } catch (err) {
    console.warn('[UPI] Error launching UPI URL:', err?.message);
    return {
      success: false,
      error: 'NO_UPI_APP',
      message:
        'No compatible UPI payment app (such as Google Pay, PhonePe, Paytm, or BHIM) was detected on this device.',
    };
  }
};
