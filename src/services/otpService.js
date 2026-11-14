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
   * Endpoint 1: Request & Send OTP
   * POST /otp/send
   * 
   * @param {string} phone - 10-digit mobile number
   * @param {string} purpose - Purpose of OTP (e.g. "Login Verification")
   * @param {number} expirySeconds - Validity window in seconds (default: 300)
   */
  async sendOtp(phone, purpose = 'Login Verification', expirySeconds = 300) {
    const config = getLocalOtpDomainRecord();
    const cleanPhone = String(phone).replace(/\D/g, '');
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
          purpose: purpose || config?.purpose || 'Login Verification',
          expiry_seconds: expirySeconds || config?.expirySeconds || 300,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OtpService] sendOtp error:', error);
      return {
        success: false,
        message: error?.message || 'Network error while requesting OTP',
      };
    }
  }

  /**
   * Endpoint 2: Verify OTP
   * POST /otp/verify
   * 
   * @param {string} challengeId - Challenge ID returned from sendOtp (e.g. "CHL_...")
   * @param {string} otp - 6-digit OTP code entered by user
   */
  async verifyOtp(challengeId, otp) {
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
          challenge_id: String(challengeId).trim(),
          otp: String(otp).trim(),
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[OtpService] verifyOtp error:', error);
      return {
        success: false,
        verified: false,
        message: error?.message || 'Network error while verifying OTP',
      };
    }
  }

  /**
   * Endpoint 3: Check OTP & WhatsApp Delivery Status
   * GET /otp/status/{challenge_id}
   * 
   * @param {string} challengeId - Challenge ID
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
        message: error?.message || 'Network error while checking OTP status',
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
        message: error?.message || 'Network error while checking account usage',
      };
    }
  }
}

export const otpService = new OtpService();
export default otpService;
