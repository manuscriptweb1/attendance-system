/**
 * Minimal Google Gemini (Generative Language API) client.
 * Uses the REST endpoint so no extra npm package is needed.
 */
const fetchFn = typeof global.fetch === 'function' ? global.fetch.bind(global) : require('node-fetch');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 45000;

class GeminiError extends Error {
  constructor(message, { status, code, userMessage } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
    this.userMessage = userMessage || message;
  }
}

// Turns Google API errors into short messages an admin can act on (never includes the key)
const toFriendlyError = (status, body) => {
  const apiMsg = body?.error?.message || '';
  const reason = (body?.error?.details || []).map((d) => d.reason).filter(Boolean).join(',');
  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(`${apiMsg} ${reason}`)) {
    return 'The Gemini API key is not valid. Please copy the key again from Google AI Studio.';
  }
  if (status === 401 || status === 403) {
    return 'Google rejected this Gemini key (permission denied). Check that the Generative Language API is enabled for the key.';
  }
  if (status === 404) {
    return 'This Gemini model is not available for your key. Please choose another model and test again.';
  }
  if (status === 429) {
    return 'The Gemini usage limit (quota) has been reached. Please wait a little or check your Google AI Studio plan.';
  }
  if (status >= 500) {
    return 'Gemini is temporarily unavailable. Please try again in a moment.';
  }
  return apiMsg ? `Gemini error: ${apiMsg.slice(0, 200)}` : `Gemini request failed (HTTP ${status}).`;
};

const generateContent = async ({ apiKey, model, body }) => {
  if (!apiKey) throw new GeminiError('Missing Gemini API key', { code: 'NO_KEY', userMessage: 'No Gemini API key is saved.' });

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  let response;
  try {
    response = await fetchFn(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    });
  } catch (err) {
    const timedOut = err && (err.name === 'AbortError' || err.type === 'aborted');
    throw new GeminiError(`Gemini network error: ${err.message}`, {
      code: timedOut ? 'TIMEOUT' : 'NETWORK',
      userMessage: timedOut
        ? 'Gemini took too long to answer. Please try again.'
        : 'Could not reach Gemini. Please check the server internet connection.'
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    throw new GeminiError(`Gemini HTTP ${response.status}`, {
      status: response.status,
      code: 'HTTP',
      userMessage: toFriendlyError(response.status, data)
    });
  }
  return data || {};
};

/** Sends a tiny request to confirm the key and model work. */
const testGeminiKey = async ({ apiKey, model }) => {
  const data = await generateContent({
    apiKey,
    model,
    body: {
      contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 256 }
    }
  });
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  return { ok: true, sample: text.slice(0, 40) };
};

module.exports = { generateContent, testGeminiKey, GeminiError };
