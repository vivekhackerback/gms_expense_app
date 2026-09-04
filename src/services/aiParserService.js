import API_CONFIG from '../constants/api_config';
import { checkNetworkConnectivity } from './syncService';

/**
 * Supported AI Models for Natural Language Transaction Parsing (Airouter)
 * Ranked by speed, efficiency, and intelligence
 */
export const AI_MODELS = [
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    rank: '🥇',
    badge: '🥇 Fastest & Cheapest',
    inputCost: '$0.10 / 1M',
    outputCost: '$0.40 / 1M',
    bestUse: 'Cheapest text generation, extraction, classification',
    provider: 'Airouter',
    isDefault: true,
  },
  {
    id: 'google/gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    rank: '🥈',
    badge: '🥈 Newer & Balanced',
    inputCost: '$0.25 / 1M',
    outputCost: '$1.50 / 1M',
    bestUse: 'Cheap newer model',
    provider: 'Airouter',
  },
  {
    id: 'google/gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    rank: '🥉',
    badge: '🥉 Stronger Lightweight',
    inputCost: '$0.30 / 1M',
    outputCost: '$2.50 / 1M',
    bestUse: 'Newer + stronger lightweight model',
    provider: 'Airouter',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    rank: '4',
    badge: 'OpenAI Fast',
    inputCost: '$0.15 / 1M',
    outputCost: '$0.60 / 1M',
    bestUse: 'OpenAI standard fast reasoning',
    provider: 'Airouter',
  },
];

export const DEFAULT_AI_MODEL = 'google/gemini-2.5-flash-lite';

/**
 * Checks connectivity and online status of the backend AI Parser Engine
 * GET /api/v1/ai_parse.php
 * 
 * @param {string} [model] Optional model override
 * @returns {Promise<Object>} Status object
 */
export const checkAiServerStatus = async (model = '') => {
  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      return {
        isOnline: false,
        statusCode: 0,
        provider: 'None',
        model: model || DEFAULT_AI_MODEL,
        availableModels: AI_MODELS,
        message: 'Device has no internet connection.',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const queryUrl = model
      ? `${API_CONFIG.AI_PARSE_URL}?model=${encodeURIComponent(model)}`
      : API_CONFIG.AI_PARSE_URL;

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const targetUrl = API_CONFIG.AI_PARSE_URL;
    let urlDomain = 'expense.tplpro.in';
    try {
      urlDomain = new URL(targetUrl).hostname;
    } catch (e) {}

    if (response.ok) {
      const json = await response.json();
      const dbKeyFound = Boolean(json.db_key_found);
      const isDummyKey = Boolean(json.is_dummy_key);
      const keyFetched = Boolean(json.key_fetched || json.has_key || (dbKeyFound && !isDummyKey));
      const dbConnected = Boolean(json.db_connected);

      return {
        isOnline: json.success === true,
        statusCode: response.status,
        domain: json.domain || urlDomain,
        endpoint: json.endpoint || targetUrl,
        provider: json.provider || 'Airouter',
        model: json.model || model || DEFAULT_AI_MODEL,
        availableModels: json.available_models || AI_MODELS,
        keyFetched,
        dbConnected,
        dbKeyFound,
        isDummyKey,
        maskedKey: json.masked_key || (json.has_key ? 'sk-air-***' : null),
        keySource: json.key_source || (dbKeyFound ? 'MySQL Database (ai_api_key)' : (keyFetched ? 'Server Backend' : 'None')),
        dbError: json.db_error || null,
        message: json.message || (dbKeyFound ? (isDummyKey ? 'Dummy Key in DB table.' : 'API Key fetched from Database.') : (keyFetched ? 'API Key fetched from server.' : 'No API key in database.')),
      };
    } else {
      return {
        isOnline: false,
        statusCode: response.status,
        domain: urlDomain,
        endpoint: targetUrl,
        provider: 'Airouter',
        model: model || DEFAULT_AI_MODEL,
        availableModels: AI_MODELS,
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
    let urlDomain = 'expense.tplpro.in';
    try {
      urlDomain = new URL(API_CONFIG.AI_PARSE_URL).hostname;
    } catch (e) {}

    return {
      isOnline: false,
      statusCode: 0,
      domain: urlDomain,
      endpoint: API_CONFIG.AI_PARSE_URL,
      provider: 'Airouter',
      model: model || DEFAULT_AI_MODEL,
      availableModels: AI_MODELS,
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
 * Tests live validity of the AI API Key on the server by sending a lightweight ping to the AI provider.
 * GET /api/v1/ai_parse.php?test_key=1
 * 
 * @param {string} [model] Model to test with
 * @returns {Promise<Object>} { success: boolean, keyValid: boolean, latencyMs: number, message: string }
 */
export const testAiApiKey = async (model = '') => {
  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      return {
        success: false,
        keyValid: false,
        latencyMs: 0,
        message: 'Device has no internet connection.',
      };
    }

    const testUrl = model 
      ? `${API_CONFIG.AI_PARSE_URL}?test_key=1&model=${encodeURIComponent(model)}`
      : `${API_CONFIG.AI_PARSE_URL}?test_key=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await response.json();

    return {
      success: response.ok && json.success === true,
      keyValid: Boolean(json.key_valid),
      latencyMs: json.latency_ms || 0,
      provider: json.provider || 'Airouter',
      model: json.model || model || DEFAULT_AI_MODEL,
      maskedKey: json.masked_key || null,
      keySource: json.key_source || 'Server',
      reply: json.reply || null,
      message: json.message || (json.key_valid ? 'API Key is working perfectly!' : 'API Key test failed.'),
    };
  } catch (err) {
    return {
      success: false,
      keyValid: false,
      latencyMs: 0,
      message: err.name === 'AbortError' ? 'AI Key test timed out (12s).' : (err.message || 'Failed to connect to server.'),
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
 * @param {string} model - Selected AI Model (e.g. google/gemini-2.5-flash-lite)
 * @returns {Promise<Object>} Result from Server AI
 */
export const parseNaturalLanguageTransaction = async (
  text,
  categories = [],
  parties = [],
  authSession = null,
  model = DEFAULT_AI_MODEL
) => {
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
        model: model || DEFAULT_AI_MODEL,
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
        model: json.data.ai_model || model || DEFAULT_AI_MODEL,
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
