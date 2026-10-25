import { Platform, Linking } from 'react-native';
import { BrandConfig } from '../constants/assets.js';

/**
 * Official Developer WhatsApp Support Contact
 * Target Phone Number: +91 8651615629
 */
export const WHATSAPP_FEEDBACK_PHONE = '918651615629';
export const DISPLAY_WHATSAPP_PHONE = '+91 8651615629';

/**
 * Returns formatted human-readable device and OS information
 */
export const getDeviceInfoString = () => {
  const osName = Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : Platform.OS;

  if (Platform.OS === 'android' && Platform.constants) {
    const brand = Platform.constants.Brand || Platform.constants.Manufacturer || '';
    const model = Platform.constants.Model || '';
    const release = Platform.constants.Release ? `Android ${Platform.constants.Release}` : `API ${Platform.Version}`;
    const deviceName = [brand, model].filter(Boolean).join(' ');

    if (deviceName) {
      return `${release} (${deviceName})`;
    }
    return release;
  }

  if (Platform.OS === 'ios') {
    return `iOS ${Platform.Version || ''}`;
  }

  return `${osName} (${Platform.Version || 'Unknown'})`;
};

/**
 * Returns current application version
 */
export const getAppVersionString = () => {
  return BrandConfig.version || '1.0.0';
};

/**
 * Builds the pre-filled WhatsApp message matching the requested format:
 *
 * Hello, I would like to share feedback about your expense management app.
 *
 * Feedback: [User's written feedback]
 *
 * App Version: [App version, if available]
 *
 * Device: [Device information, if available]
 *
 * Thank you.
 */
export const buildFeedbackMessage = (feedbackText, category = null) => {
  const appName = BrandConfig.appName || 'expense management';
  const appVersion = getAppVersionString();
  const deviceInfo = getDeviceInfoString();

  const trimmedFeedback = (feedbackText || '').trim();
  const fullFeedbackContent = category && category !== 'General'
    ? `[${category}] ${trimmedFeedback}`
    : trimmedFeedback;

  return (
    `Hello, I would like to share feedback about your ${appName} app.\n\n` +
    `Feedback: ${fullFeedbackContent}\n\n` +
    `App Version: v${appVersion}\n\n` +
    `Device: ${deviceInfo}\n\n` +
    `Thank you.`
  );
};

/**
 * Launches WhatsApp with the user's pre-filled feedback.
 * Tries direct native app intent first; smoothly falls back to https://wa.me/
 * web URL if the native app is not installed.
 */
export const sendFeedbackViaWhatsApp = async (feedbackText, category = null) => {
  const trimmed = (feedbackText || '').trim();
  if (!trimmed) {
    throw new Error('Please write your feedback before sending.');
  }

  const message = buildFeedbackMessage(trimmed, category);
  const encodedMessage = encodeURIComponent(message);

  // Native WhatsApp scheme for direct intent opening
  const appUrl = `whatsapp://send?phone=${WHATSAPP_FEEDBACK_PHONE}&text=${encodedMessage}`;
  // Official wa.me click-to-chat URL fallback
  const webUrl = `https://wa.me/${WHATSAPP_FEEDBACK_PHONE}?text=${encodedMessage}`;

  try {
    const canOpen = await Linking.canOpenURL(appUrl);
    if (canOpen) {
      await Linking.openURL(appUrl);
      return { success: true, target: 'app' };
    }
  } catch (e) {
    console.log('[Feedback] Native WhatsApp intent check failed, trying web fallback:', e?.message);
  }

  // Fallback to web link (opens WhatsApp Web or redirects via browser)
  try {
    await Linking.openURL(webUrl);
    return { success: true, target: 'web' };
  } catch (err) {
    console.error('[Feedback] Error opening WhatsApp URL:', err);
    throw new Error(
      'Could not open WhatsApp. Please check if WhatsApp or a web browser is installed on your device.'
    );
  }
};
