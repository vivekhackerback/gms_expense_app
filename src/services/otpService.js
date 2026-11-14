/**
 * WhatsApp OTP Gateway Service
 * 
 * Fully configurable & database-driven OTP Gateway Service.
 * Retrieves base URL and gateway credentials dynamically from the database (MySQL & local SQLite),
 * ensuring zero hardcoding and seamless migration to any domain or provider without app updates.
 */

import API_CONFIG from '../constants/api_config';
import {
  getLocalOtpDomainRecord,
  saveLocalOtpDomainRecord,
} from '../database/queries';

class OtpService {
  /**
   * Fetches latest OTP gateway domain & base URL configuration dynamically from the database.
   * If the domain or base URL is updated in the database, local SQLite is updated immediately.
   */
  async syncOtpDomainConfig() {
    try {
      const local = getLocalOtpDomainRecord();
      const clientUpdate = local?.otpUpdate ?? 1;
      const clientBaseUrl = encodeURIComponent(local?.apiBaseUrl || '');

      const url = `${API_CONFIG.GET_OTP_DOMAIN_URL}?client_otp_update=${clientUpdate}&client_base_url=${clientBaseUrl}&t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
      });

      if (!response.ok) {
        return local;
      }

      const data = await response.json();
      if (data && data.success && (data.domain || data.api_base_url)) {
        const serverBaseUrl = data.api_base_url || (data.domain ? `${data.domain.replace(/\/+$/, '')}/api/v1` : '');
        if (data.changed || serverBaseUrl !== local?.apiBaseUrl) {
          saveLocalOtpDomainRecord({
            domain: data.domain,
            api_base_url: serverBaseUrl,
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
      console.warn('[OtpService] syncOtpDomainConfig error (falling back to database cache):', e?.message);
    }

    return getLocalOtpDomainRecord();
  }

  /**
   * Resolves the active base URL dynamically from the database.
   */
  getApiBaseUrl() {
    const local = getLocalOtpDomainRecord();
    if (local?.apiBaseUrl) {
      return local.apiBaseUrl.replace(/\/+$/, '');
    }
    if (local?.domain) {
      return `${local.domain.replace(/\/+$/, '')}/api/v1`;
    }
    return '';
  }

  /**
   * Check if an international phone number is already registered before requesting OTP
   */
  async checkPhoneRegistered(phone, countryCode = '+91') {
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 5) {
      return { registered: false, message: 'Invalid phone number' };
    }

    try {
      const res = await fetch(API_CONFIG.AUTH_REGISTER_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({ check_phone: true, phone: cleanPhone, country_code: countryCode }),
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
   * 
   * Dynamically loads active OTP base URL from database before dispatch.
   * First tries backend proxy (which reads live MySQL `otp_domain` row),
   * with fallback to direct database-configured `api_base_url`.
   * 
   * @param {string} phone - Mobile number
   * @param {string} purpose - Purpose of OTP (max 15 characters per Meta limit)
   * @param {number} expirySeconds - Validity window in seconds (default: 300)
   * @param {string} countryCode - International dialing code (e.g. "+91", "+1", "+44")
   */
  async sendOtp(phone, purpose = 'Registration', expirySeconds = 300, countryCode = '+91') {
    // 0. Proactively sync latest database configuration
    try {
      await this.syncOtpDomainConfig();
    } catch (syncErr) {}

    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanCountryCode = String(countryCode || '+91').trim();
    const config = getLocalOtpDomainRecord();

    // Sanitize purpose to never exceed Meta's 15-char limit (#132018)
    let safePurpose = String(purpose || config?.purpose || 'Registration').trim();
    if (safePurpose === 'Account Registration') safePurpose = 'Registration';
    if (safePurpose === 'Login Verification') safePurpose = 'Verification';
    if (safePurpose.length > 15) safePurpose = safePurpose.slice(0, 15);
    if (!safePurpose) safePurpose = 'Registration';

    // 1. Try Backend Proxy endpoint (holds live MySQL `otp_domain` credentials)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(API_CONFIG.OTP_SEND_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          phone: cleanPhone,
          country_code: cleanCountryCode,
          purpose: safePurpose,
          expiry_seconds: expirySeconds || config?.expirySeconds || 300,
          check_registered: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const rawText = await response.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[OtpService] Proxy response was not JSON:', rawText.slice(0, 150));
      }

      if (data && (response.status === 200 || response.status === 400 || response.status === 409 || data.already_registered)) {
        const cid = data.challenge_id || data.verification_id || data.id || '';
        data.challenge_id = cid;
        data.verification_id = cid;
        return data;
      }
    } catch (proxyError) {
      console.warn('[OtpService] Proxy sendOtp failed, attempting direct gateway fallback:', proxyError?.message);
    }

    // 2. Direct fallback using dynamic database-stored base URL
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      return {
        success: false,
        message: 'No OTP service URL configured in database. Please check connection.',
      };
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config?.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    const dialDigits = cleanCountryCode.replace(/\D/g, '');
    const targetPhone = (dialDigits === '91' || !dialDigits) ? cleanPhone : `${dialDigits}${cleanPhone}`;

    try {
      const response = await fetch(`${baseUrl}/otp/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: targetPhone,
          purpose: safePurpose,
          expiry_seconds: expirySeconds || config?.expirySeconds || 300,
        }),
      });

      const rawText = await response.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[OtpService] Direct gateway response was not JSON:', rawText.slice(0, 150));
      }

      if (data) {
        const cid = data.challenge_id || data.verification_id || data.id || '';
        data.challenge_id = cid;
        data.verification_id = cid;
        return data;
      }

      return {
        success: false,
        message: 'Invalid response from WhatsApp OTP service.',
      };
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
   * Validates OTP code against active challenge using dynamic database URL.
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

      const rawText = await response.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[OtpService] Proxy verifyOtp response was not JSON:', rawText.slice(0, 150));
      }

      if (data && (response.status === 200 || response.status === 400 || response.status === 410 || response.status === 429)) {
        return data;
      }
    } catch (proxyError) {
      console.warn('[OtpService] Proxy verifyOtp failed, attempting direct gateway fallback:', proxyError?.message);
    }

    // 2. Direct fallback using dynamic database-stored base URL
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      return {
        success: false,
        verified: false,
        message: 'No OTP service URL configured in database.',
      };
    }

    const config = getLocalOtpDomainRecord();
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
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      return { success: false, message: 'No OTP service URL configured in database.' };
    }

    const config = getLocalOtpDomainRecord();
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
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      return { success: false, message: 'No OTP service URL configured in database.' };
    }

    const config = getLocalOtpDomainRecord();
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
