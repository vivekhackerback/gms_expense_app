import { Linking } from 'react-native';
import { checkAndFetchUpiInfo, insertUpiInfo } from '../database/queries';
import { API_CONFIG } from '../constants/api_config';

export const SUPPORT_UPI_CONFIG = {
  get upiId() {
    return checkAndFetchUpiInfo().upiId;
  },
  get updatedAt() {
    return checkAndFetchUpiInfo().updatedAt;
  },
  payeeName: 'Expense App Developer',
  defaultNote: 'Support Expense App',
  suggestedAmounts: [10, 20, 50, 100],
  defaultAmount: 50,
};

/**
 * Checks server for updated UPI info.
 * If server's updated_at is different from local SQLite, inserts into SQLite and returns new upi_id.
 */
export const syncUpiInfoWithServer = async () => {
  const local = checkAndFetchUpiInfo();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(API_CONFIG.GET_UPI_URL, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data && json.data.upi_id) {
        const remoteUpiId = String(json.data.upi_id).trim();
        const remoteUpdatedAt = json.data.updated_at ? String(json.data.updated_at).trim() : null;

        // If updated_at is changed, update local SQLite
        if (remoteUpdatedAt && remoteUpdatedAt !== local.updatedAt) {
          console.log(`[UPI] Server updated_at changed from '${local.updatedAt}' to '${remoteUpdatedAt}'. Updating local SQLite upi_id to '${remoteUpiId}'`);
          const updated = insertUpiInfo(remoteUpiId, remoteUpdatedAt);
          return {
            upiId: updated ? updated.upiId : remoteUpiId,
            updatedAt: remoteUpdatedAt,
            isUpdated: true,
          };
        }
      }
    }
  } catch (e) {
    // Graceful offline fallback - rely on local SQLite
  }

  return {
    upiId: local.upiId,
    updatedAt: local.updatedAt,
    isUpdated: false,
  };
};

/**
 * Builds a standard UPI URI string formatted for Indian banking / UPI apps
 * Format: upi://pay?pa=<UPI_ID>&pn=<NAME>&tn=<NOTE>&am=<AMOUNT>&cu=INR
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

  const activeUpiId = (upiId || checkAndFetchUpiInfo().upiId || '8651615629-2@ybl').trim();

  // Format to standard 2 decimal places e.g. 50.00
  const formattedAmount = numAmount.toFixed(2);
  const encodedUpiId = encodeURIComponent(activeUpiId);
  const encodedName = encodeURIComponent(payeeName.trim());
  const encodedNote = encodeURIComponent(note.trim());

  return `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&tn=${encodedNote}&am=${formattedAmount}&cu=INR`;
};

/**
 * Attempts to launch the native UPI intent.
 * On Android, the OS displays the app chooser with installed apps (Google Pay, PhonePe, Paytm, BHIM, etc.).
 * Returns { success: true } if launched, or { success: false, error, message } if failed.
 */
export const launchUpiPayment = async ({ amount, note, upiId }) => {
  try {
    const activeUpiId = (upiId || checkAndFetchUpiInfo().upiId || '8651615629-2@ybl').trim();
    const upiUrl = buildUpiUrl({ amount, note, upiId: activeUpiId });

    // Check if URL can be opened
    let canOpen = false;
    try {
      canOpen = await Linking.canOpenURL(upiUrl);
    } catch (e) {
      canOpen = false;
    }

    // Try opening URL directly (standard Android intent chooser)
    await Linking.openURL(upiUrl);
    return { success: true, upiId: activeUpiId };
  } catch (err) {
    console.warn('[UPI] Could not launch UPI URL:', err?.message);
    return {
      success: false,
      error: 'NO_UPI_APP',
      message:
        'No compatible UPI payment app (such as Google Pay, PhonePe, Paytm, or BHIM) was detected on this device.',
    };
  }
};
