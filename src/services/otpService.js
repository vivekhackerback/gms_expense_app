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

/**
 * Evaluates whether an OTP dispatch response represents a genuine delivery success.
 * Enforces strict delivery validation per required spec:
 * - Success Case: only when delivery is confirmed by API -> 'OTP sent successfully', starts 60s cooldown
 * - Failed Case: -> 'Failed to send OTP', resendCooldown = 0 (retry immediately)
 * - Timeout Case: -> 'Unable to send OTP. Try again.', resendCooldown = 0 (retry immediately)
 * - Invalid Response: -> 'Unable to verify OTP delivery status', resendCooldown = 0 (retry immediately)
 */
export const evaluateOtpResponse = (data, httpStatus = 200) => {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      deliveryStatus: 'invalid_response',
      delivery_status: 'invalid_response',
      status: 'invalid_response',
      message: 'Unable to verify OTP delivery status',
      resendCooldown: 0,
      resend_cooldown: 0,
      canRetryImmediately: true,
      challengeId: '',
      challenge_id: '',
      isNetworkError: true,
    };
  }

  // Already Registered / Duplicate Phone Conflict
  if (data.already_registered || data.alreadyRegistered) {
    return {
      success: false,
      alreadyRegistered: true,
      already_registered: true,
      deliveryStatus: 'conflict',
      delivery_status: 'conflict',
      message: data.message || 'An account with this mobile number already exists. Please sign in instead.',
      resendCooldown: 0,
      resend_cooldown: 0,
      canRetryImmediately: true,
      challengeId: '',
      challenge_id: '',
      isNetworkError: false,
    };
  }

  const cid = String(data.challenge_id || data.verification_id || data.id || '').trim();
  const rawStatus = String(data.status || data.delivery_status || '').toLowerCase().trim();
  const waStatus = String(data.whatsapp?.status || '').toLowerCase().trim();

  const failedStatuses = ['failed', 'failure', 'undelivered', 'rejected', 'error'];
  const isStatusFailed = failedStatuses.includes(rawStatus) || failedStatuses.includes(waStatus);

  const isTimeout = rawStatus === 'timeout' || data.delivery_status === 'timeout' || httpStatus === 408 || httpStatus === 504;
  const isInvalid = rawStatus === 'invalid_response' || data.delivery_status === 'invalid_response' || httpStatus === 502;

  if (isTimeout) {
    return {
      success: false,
      deliveryStatus: 'timeout',
      delivery_status: 'timeout',
      status: 'timeout',
      message: 'Unable to send OTP. Try again.',
      resendCooldown: 0,
      resend_cooldown: 0,
      canRetryImmediately: true,
      challengeId: '',
      challenge_id: '',
      isNetworkError: true,
    };
  }

  if (isInvalid) {
    return {
      success: false,
      deliveryStatus: 'invalid_response',
      delivery_status: 'invalid_response',
      status: 'invalid_response',
      message: 'Unable to verify OTP delivery status',
      resendCooldown: 0,
      resend_cooldown: 0,
      canRetryImmediately: true,
      challengeId: '',
      challenge_id: '',
      isNetworkError: true,
    };
  }

  const isSuccessFlag = (data.success === true || data.success === 1 || data.success === '1') && data.success !== 'Failed' && data.success !== 'failed';

  // Confirmed Delivery Success:
  // Requires boolean success === true, HTTP 200/201, valid challenge_id, and NO failed status
  if (isSuccessFlag && !isStatusFailed && cid && (httpStatus === 200 || httpStatus === 201)) {
    const cooldown = Number(data.resend_cooldown) > 0 ? Number(data.resend_cooldown) : 60;
    return {
      success: true,
      deliveryStatus: 'success',
      delivery_status: 'success',
      status: 'sent',
      message: 'OTP sent successfully',
      resendCooldown: cooldown,
      resend_cooldown: cooldown,
      canRetryImmediately: false,
      challengeId: cid,
      challenge_id: cid,
      verification_id: cid,
      otp: data.otp || null,
      simulated: !!data.simulated,
      isNetworkError: false,
    };
  }

  // Delivery Failure:
  let failMsg = data.message ? String(data.message).trim() : 'Failed to send OTP';
  if (
    failMsg.toLowerCase().includes('success') ||
    failMsg.toLowerCase().includes('dispatched') ||
    failMsg.toLowerCase().includes('accepted') ||
    failMsg.toLowerCase().includes('internal server error') ||
    data.error_code === 'INTERNAL_SERVER_ERROR'
  ) {
    failMsg = 'Failed to send OTP. Please try again.';
  }

  return {
    success: false,
    deliveryStatus: 'failed',
    delivery_status: 'failed',
    status: 'failed',
    message: failMsg,
    resendCooldown: 0,
    resend_cooldown: 0,
    canRetryImmediately: true,
    challengeId: '',
    challenge_id: '',
    isNetworkError: false,
  };
};

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

      const evaluated = evaluateOtpResponse(data, response.status);

      // If proxy returned definitive result (success, duplicate number conflict, or non-500 handled failure)
      if (evaluated.success || evaluated.alreadyRegistered || response.status === 409 || (data && response.status < 500)) {
        return evaluated;
      }
    } catch (proxyError) {
      console.warn('[OtpService] Proxy sendOtp failed, attempting direct gateway fallback:', proxyError?.message);
    }

    // 2. Direct fallback using dynamic database-stored base URL
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      return evaluateOtpResponse(
        { status: 'failed', message: 'No OTP service URL configured in database. Please check connection.' },
        500
      );
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${baseUrl}/otp/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          country_code: cleanCountryCode,
          mobile_number: cleanPhone,
          phone: `+${dialDigits}${cleanPhone}`,
          purpose: safePurpose,
          expiry_seconds: expirySeconds || config?.expirySeconds || 300,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const rawText = await response.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[OtpService] Direct gateway response was not JSON:', rawText.slice(0, 150));
      }

      return evaluateOtpResponse(data, response.status);
    } catch (error) {
      console.error('[OtpService] direct sendOtp error:', error);
      const isTimeout = error?.name === 'AbortError' || error?.message?.toLowerCase().includes('timeout');
      return evaluateOtpResponse(
        {
          status: isTimeout ? 'timeout' : 'failed',
          message: isTimeout ? 'Unable to send OTP. Try again.' : 'Failed to send OTP. Please try again.',
        },
        isTimeout ? 504 : 500
      );
    }
  }

  /**
   * Endpoint 2: Resend OTP
   * POST /otp/resend
   * 
   * Triggers OTP resend for an active challenge or country_code + mobile_number.
   * Enforces strict delivery status handling via evaluateOtpResponse:
   * cooldown only set on confirmed success.
   * 
   * @param {string} challengeId - Challenge ID from sendOtp
   * @param {string} countryCode - Dialing code (e.g. "+91")
   * @param {string} mobileNumber - National mobile number
   */
  async resendOtp(challengeId, countryCode = '+91', mobileNumber = '') {
    const cleanChallengeId = String(challengeId || '').trim();
    const cleanCountryCode = String(countryCode || '+91').trim();
    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '');

    // 1. Try Backend Proxy endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(API_CONFIG.OTP_RESEND_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          challenge_id: cleanChallengeId,
          country_code: cleanCountryCode,
          mobile_number: cleanMobile,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const rawText = await response.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[OtpService] Proxy resendOtp response was not JSON:', rawText.slice(0, 150));
      }

      const evaluated = evaluateOtpResponse(data, response.status);
      if (evaluated.success || (data && response.status < 500)) {
        return evaluated;
      }
    } catch (proxyError) {
      console.warn('[OtpService] Proxy resendOtp failed, attempting direct gateway fallback:', proxyError?.message);
    }

    // 2. Direct fallback using dynamic database-stored base URL
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) {
      return evaluateOtpResponse(
        { status: 'failed', message: 'No OTP service URL configured in database. Please check connection.' },
        500
      );
    }

    const config = getLocalOtpDomainRecord();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config?.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    const payload = {};
    if (cleanChallengeId) payload.challenge_id = cleanChallengeId;
    if (cleanCountryCode) payload.country_code = cleanCountryCode;
    if (cleanMobile) payload.mobile_number = cleanMobile;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${baseUrl}/otp/resend`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const rawText = await response.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[OtpService] Direct gateway resendOtp was not JSON:', rawText.slice(0, 150));
      }

      return evaluateOtpResponse(data, response.status);
    } catch (error) {
      console.error('[OtpService] direct resendOtp error:', error);
      const isTimeout = error?.name === 'AbortError' || error?.message?.toLowerCase().includes('timeout');
      return evaluateOtpResponse(
        {
          status: isTimeout ? 'timeout' : 'failed',
          message: isTimeout ? 'Unable to send OTP. Try again.' : 'Failed to resend OTP. Please try again.',
        },
        isTimeout ? 504 : 500
      );
    }
  }

  /**
   * Endpoint 3: Supported Countries Catalog
   * GET /countries
   * 
   * Returns list of supported countries with code, name, dial_code, flag, example.
   */
  async getCountries(query = '') {
    // 1. Try Backend Proxy
    try {
      const q = query ? `?q=${encodeURIComponent(query)}` : '';
      const response = await fetch(`${API_CONFIG.OTP_COUNTRIES_URL}${q}`, {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.success && Array.isArray(data.countries)) {
          return data.countries;
        }
      }
    } catch (e) {
      console.warn('[OtpService] Proxy getCountries error:', e?.message);
    }

    // 2. Direct fallback
    const baseUrl = this.getApiBaseUrl();
    if (baseUrl) {
      try {
        const config = getLocalOtpDomainRecord();
        const headers = { Accept: 'application/json' };
        if (config?.apiKey) headers['X-API-Key'] = config.apiKey;

        const q = query ? `?q=${encodeURIComponent(query)}` : '';
        const response = await fetch(`${baseUrl}/countries${q}`, {
          method: 'GET',
          headers,
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.success && Array.isArray(data.countries)) {
            return data.countries;
          }
        }
      } catch (e) {
        console.warn('[OtpService] Direct getCountries error:', e?.message);
      }
    }

    return null;
  }

  /**
   * Endpoint 4: Verify OTP
   * Validates OTP code against active challenge using dynamic database URL.
   * Supports both challenge_id and (country_code + mobile_number).
   * 
   * @param {string} challengeId - Challenge ID returned from sendOtp (e.g. "CHL_...")
   * @param {string} otp - 6-digit OTP code entered by user
   * @param {string} [countryCode] - Optional country dialing code (e.g. "+91")
   * @param {string} [mobileNumber] - Optional mobile number
   */
  async verifyOtp(challengeId, otp, countryCode = '+91', mobileNumber = '') {
    const cleanChallengeId = String(challengeId || '').trim();
    const cleanOtp = String(otp || '').trim();
    const cleanCountryCode = String(countryCode || '+91').trim();
    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '');

    const requestPayload = {
      otp: cleanOtp,
    };
    if (cleanChallengeId) requestPayload.challenge_id = cleanChallengeId;
    if (cleanCountryCode) requestPayload.country_code = cleanCountryCode;
    if (cleanMobile) requestPayload.mobile_number = cleanMobile;

    // 1. Try Backend Proxy endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(API_CONFIG.OTP_VERIFY_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify(requestPayload),
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
        body: JSON.stringify(requestPayload),
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
