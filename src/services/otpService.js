/**
 * WhatsApp OTP Gateway Service
 * Documentation Reference: https://otp.losttag.in/docs
 * 
 * Manages OTP sending, verification, status tracking, and dynamic domain configuration.
 */

import API_CONFIG from '../constants/api_config';
import {
  getLocalOtpDomainRecord,
  saveLocalOtpDomainRecord,
  DEFAULT_OTP_DOMAIN,
  DEFAULT_OTP_API_BASE_URL,
} from '../database/queries';

class OtpService {
  /**
   * Fetches latest OTP gateway domain configuration from backend server and updates local SQLite cache if newer.
   */
  async syncOtpDomainConfig() {
    try {
      const local = getLocalOtpDomainRecord();
      const clientUpdate = local?.otpUpdate ?? 1;

      const url = `${API_CONFIG.GET_OTP_DOMAIN_URL}?client_otp_update=${clientUpdate}&t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
      });

      if (!response.ok) {
        return local;
      }

      const data = await response.json();
      if (data && data.success && data.domain) {
        if (data.changed) {
          saveLocalOtpDomainRecord({
            domain: data.domain,
            api_base_url: data.api_base_url,
            template_name: data.template_name,
            purpose: data.purpose,
            expiry_seconds: data.expiry_seconds,
            resend_cooldown: data.resend_cooldown,
            max_attempts: data.max_attempts,
            status: data.status,
            otp_update: data.otp_update,
            updated_at: data.updated_at,
          });
        }
        return getLocalOtpDomainRecord();
      }
    } catch (e) {
      console.warn('[OtpService] syncOtpDomainConfig error (falling back to local cache):', e?.message);
    }

    return getLocalOtpDomainRecord();
  }

  /**
   * Resolves the active base URL for OTP Gateway endpoints
   */
  getApiBaseUrl() {
    const local = getLocalOtpDomainRecord();
    return local?.apiBaseUrl || DEFAULT_OTP_API_BASE_URL;
  }

  /**
   * Check if a phone number is already registered before requesting OTP
   */
  async checkPhoneRegistered(phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return { registered: false, message: 'Invalid phone number' };
    }

    try {
      const res = await fetch(API_CONFIG.AUTH_REGISTER_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({ check_phone: true, phone: cleanPhone }),
      });
      const data = await res.json();
      if (data.already_registered) {
        return { registered: true, message: data.message };
      }
      return { registered: false };
    } catch (e) {
      return { registered: false };
    }
  }

  /**
   * Endpoint 1: Request & Send OTP
   * Attempts application backend proxy first (which holds database API keys),
   * with seamless fallback to direct OTP Gateway URL.
   * 
   * @param {string} phone - 10-digit mobile number
   * @param {string} purpose - Purpose of OTP (e.g. "Account Registration")
   * @param {number} expirySeconds - Validity window in seconds (default: 300)
   */
  async sendOtp(phone, purpose = 'Account Registration', expirySeconds = 300) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const config = getLocalOtpDomainRecord();

    // 1. Try Backend Proxy endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(API_CONFIG.OTP_SEND_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          phone: cleanPhone,
          purpose: purpose || config?.purpose || 'Account Registration',
          expiry_seconds: expirySeconds || config?.expirySeconds || 300,
          check_registered: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      // If endpoint returned response (whether success or business validation like already_registered)
      if (response.status === 200 || response.status === 400 || response.status === 409 || data.already_registered) {
        return data;
      }
    } catch (proxyError) {
      console.warn('[OtpService] Proxy sendOtp failed, attempting direct gateway fallback:', proxyError?.message);
    }

    // 2. Fallback to direct OTP Gateway
    const baseUrl = config?.apiBaseUrl || DEFAULT_OTP_API_BASE_URL;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config?.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    try {
      const response = await fetch(`${baseUrl}/otp/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: cleanPhone,
          purpose: purpose || config?.purpose || 'Account Registration',
          expiry_seconds: expirySeconds || config?.expirySeconds || 300,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OtpService] direct sendOtp error:', error);
      return {
        success: false,
        message: error?.message || 'Unable to connect to WhatsApp OTP service. Please check your internet connection.',
      };
    }
  }

  /**
   * Endpoint 2: Verify OTP
   * Validates OTP code against active challenge.
   * 
   * @param {string} challengeId - Challenge ID returned from sendOtp (e.g. "CHL_...")
   * @param {string} otp - 6-digit OTP code entered by user
   */
  async verifyOtp(challengeId, otp) {
    const cleanChallengeId = String(challengeId || '').trim();
    const cleanOtp = String(otp || '').trim();

    // 1. Try Backend Proxy endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(API_CONFIG.OTP_VERIFY_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          challenge_id: cleanChallengeId,
          otp: cleanOtp,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (response.status === 200 || response.status === 400 || response.status === 410 || response.status === 429) {
        return data;
      }
    } catch (proxyError) {
      console.warn('[OtpService] Proxy verifyOtp failed, attempting direct gateway fallback:', proxyError?.message);
    }

    // 2. Direct fallback
    const config = getLocalOtpDomainRecord();
    const baseUrl = config?.apiBaseUrl || DEFAULT_OTP_API_BASE_URL;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config?.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    try {
      const response = await fetch(`${baseUrl}/otp/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          challenge_id: cleanChallengeId,
          otp: cleanOtp,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OtpService] direct verifyOtp error:', error);
      return {
        success: false,
        verified: false,
        message: error?.message || 'Network error while verifying OTP.',
      };
    }
  }

  /**
   * Endpoint 3: Check OTP & WhatsApp Delivery Status
   * GET /otp/status/{challenge_id}
   */
  async checkOtpStatus(challengeId) {
    const config = getLocalOtpDomainRecord();
    const baseUrl = config?.apiBaseUrl || DEFAULT_OTP_API_BASE_URL;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config?.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    try {
      const response = await fetch(`${baseUrl}/otp/status/${encodeURIComponent(challengeId)}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OtpService] checkOtpStatus error:', error);
      return {
        success: false,
        message: error?.message || 'Network error while checking OTP status.',
      };
    }
  }

  /**
   * Endpoint 4: Account Usage & Gateway Health
   * GET /account/usage
   */
  async getAccountUsage() {
    const config = getLocalOtpDomainRecord();
    const baseUrl = config?.apiBaseUrl || DEFAULT_OTP_API_BASE_URL;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config?.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    try {
      const response = await fetch(`${baseUrl}/account/usage`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OtpService] getAccountUsage error:', error);
      return {
        success: false,
        message: error?.message || 'Network error while checking account usage.',
      };
    }
  }
}

export const otpService = new OtpService();
export default otpService;
