import { Linking } from 'react-native';
import { getLocalUpiRecord, saveLocalUpiRecord } from '../database/queries';
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
 * Server-Side Configuration Version Check
 * 
 * 1. Reads last successfully saved UPI ID and updated_at from local storage.
 * 2. Makes a lightweight API request passing client_updated_at.
 * 3. If server timestamp matches local timestamp, reuses local cache.
 * 4. If timestamp changed or missing, fetches new UPI ID, validates, and updates local SQLite.
 * 5. Handles timeouts, malformed responses, and offline fallback safely.
 */
export const syncAndGetLatestUpiConfig = async () => {
  if (inFlightConfigPromise) {
    return inFlightConfigPromise;
  }

  inFlightConfigPromise = (async () => {
    const local = getLocalUpiRecord();

    try {
      const url = new URL(API_CONFIG.GET_UPI_URL);
      if (local.updatedAt) {
        url.searchParams.append('client_updated_at', local.updatedAt);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();

        if (json && json.success) {
          // Case A: Server confirms configuration has not changed
          if (json.changed === false && local.upiId && isValidUpiId(local.upiId)) {
            return {
              success: true,
              upiId: local.upiId,
              updatedAt: local.updatedAt,
              fromCache: true,
            };
          }

          // Case B: Server returned updated UPI ID
          const serverUpiId = json.upi_id ? String(json.upi_id).trim() : null;
          const serverUpdatedAt = json.updated_at ? String(json.updated_at).trim() : null;

          if (serverUpiId && isValidUpiId(serverUpiId)) {
            // Update local storage only after successful validation
            saveLocalUpiRecord(serverUpiId, serverUpdatedAt);

            return {
              success: true,
              upiId: serverUpiId,
              updatedAt: serverUpdatedAt,
              fromCache: false,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[UPI] Server config version check error:', err?.message);
    } finally {
      inFlightConfigPromise = null;
    }

    // Edge Case: If API request fails or is offline, do NOT overwrite valid cached data
    if (local.upiId && isValidUpiId(local.upiId)) {
      return {
        success: true,
        upiId: local.upiId,
        updatedAt: local.updatedAt,
        fromCache: true,
        fallback: true,
      };
    }

    // If no valid cache exists either, refuse to proceed with invalid value
    return {
      success: false,
      upiId: null,
      updatedAt: null,
      error: 'NO_VALID_UPI',
      message:
        'Unable to retrieve payment information from server. Please check your internet connection and try again.',
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
