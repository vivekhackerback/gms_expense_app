import API_CONFIG from '../constants/api_config';
import { checkNetworkConnectivity } from './syncService';

/**
 * Checks connectivity and online status of the backend AI Parser Engine
 * GET /api/v1/ai_parse.php
 * 
 * @returns {Promise<Object>} { isOnline: boolean, status: string, model: string, provider: string, message: string }
 */
export const checkAiServerStatus = async () => {
  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      return {
        isOnline: false,
        statusCode: 0,
        provider: 'None',
        model: 'Offline',
        message: 'Device has no internet connection.',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(API_CONFIG.AI_PARSE_URL, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      const dbKeyFound = Boolean(json.db_key_found);
      const keyFetched = Boolean(json.key_fetched || json.has_key || dbKeyFound);
      const dbConnected = Boolean(json.db_connected);

      return {
        isOnline: json.success === true,
        statusCode: response.status,
        provider: json.provider || 'Airouter',
        model: json.model || 'openai/gpt-4o-mini',
        keyFetched,
        dbConnected,
        dbKeyFound,
        maskedKey: json.masked_key || (json.has_key ? 'sk-air-***' : null),
        keySource: json.key_source || (dbKeyFound ? 'MySQL Database (ai_api_key)' : (keyFetched ? 'Server Backend' : 'None')),
        dbError: json.db_error || null,
        message: json.message || (dbKeyFound ? 'API Key fetched from Database.' : (keyFetched ? 'API Key fetched from server.' : 'No API key in database.')),
      };
    } else {
      return {
        isOnline: false,
        statusCode: response.status,
        provider: 'Airouter',
        model: 'openai/gpt-4o-mini',
        keyFetched: false,
        dbConnected: false,
        dbKeyFound: false,
        maskedKey: null,
        keySource: 'None',
        dbError: null,
        message: response.status === 404
          ? 'AI endpoint not uploaded to server yet (HTTP 404).'
          : `Server returned HTTP ${response.status}`,
      };
    }
  } catch (err) {
    return {
      isOnline: false,
      statusCode: 0,
      provider: 'Airouter',
      model: 'openai/gpt-4o-mini',
      keyFetched: false,
      dbConnected: false,
      dbKeyFound: false,
      maskedKey: null,
      keySource: 'None',
      dbError: err.message,
      message: err.name === 'AbortError' ? 'AI server connection timed out.' : (err.message || 'AI server unreachable.'),
    };
  }
};

/**
 * Parses natural-language transaction text exclusively through the AI Engine.
 * Zero local fallback or guessing.
 * 
 * @param {string} text - User transaction sentence
 * @param {Array} categories - App categories from SQLite
 * @param {Array} parties - App parties from SQLite
 * @param {Object} authSession - Current authenticated user session (optional)
 * @returns {Promise<Object>} Result from Server AI
 */
export const parseNaturalLanguageTransaction = async (text, categories = [], parties = [], authSession = null) => {
  if (!text || !text.trim()) {
    return {
      success: false,
      message: 'Please enter a transaction sentence.',
    };
  }

  const cleanText = text.trim();

  // 1. Verify Internet Connectivity First
  const net = await checkNetworkConnectivity();
  if (!net.isConnected) {
    return {
      success: false,
      isOffline: true,
      message: 'Cannot process transaction: Device is offline. Internet connection required for AI processing.',
    };
  }

  // 2. Call Server AI Endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const headers = {
      ...API_CONFIG.HEADERS,
    };

    if (authSession?.token) {
      headers['Authorization'] = `Bearer ${authSession.token}`;
    }

    const response = await fetch(API_CONFIG.AI_PARSE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: cleanText,
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        parties: parties.map((p) => ({ id: p.id, name: p.name })),
        user_id: authSession?.user?.id || null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await response.json();

    if (response.ok && json.success === true && json.data) {
      return {
        success: true,
        source: 'server_ai',
        model: json.data.ai_model || 'Airouter (openai/gpt-4o-mini)',
        provider: json.data.ai_provider || 'Airouter',
        data: json.data,
      };
    } else {
      const errMsg = json.message || (response.status === 404
        ? 'AI server endpoint not found (HTTP 404). Please ensure ai_parse.php is uploaded to the server.'
        : `AI Server error (HTTP ${response.status})`);
      return {
        success: false,
        message: errMsg,
      };
    }
  } catch (err) {
    const errorMsg = err.name === 'AbortError'
      ? 'AI request timed out. Please check your network or server status.'
      : (err.message || 'Failed to connect to AI server.');

    return {
      success: false,
      message: errorMsg,
    };
  }
};
