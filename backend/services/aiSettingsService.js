const crypto = require('crypto');
const pool = require('../config/database');

/**
 * Stores the Gemini API key for the Admin Assistant.
 * The key is encrypted at rest (AES-256-GCM) and is never sent back to the browser;
 * the UI only ever sees the last 4 characters.
 */

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_OPTIONS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
const MODEL_NAME_RE = /^[a-z0-9][a-z0-9.\-]{2,60}$/i;

let tableReady = false;

const ensureAiSettingsTable = async () => {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      provider VARCHAR(30) NOT NULL DEFAULT 'gemini',
      api_key_encrypted TEXT,
      key_last4 VARCHAR(8),
      model VARCHAR(80) NOT NULL DEFAULT '${DEFAULT_GEMINI_MODEL}',
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      last_tested_at TIMESTAMP,
      last_test_ok BOOLEAN,
      updated_by INTEGER,
      updated_by_name VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  tableReady = true;
};

const getEncryptionKey = () => {
  const secret = process.env.AI_SETTINGS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('AI_SETTINGS_SECRET or JWT_SECRET must be set to store the AI key securely.');
  }
  return crypto.createHash('sha256').update(`ai-settings:${secret}`).digest();
};

const encryptSecret = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptSecret = (stored) => {
  if (!stored) return null;
  const [version, ivB64, tagB64, dataB64] = String(stored).split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (err) {
    // Happens when the server secret changed after the key was saved
    console.error('AI key could not be decrypted. Please save the Gemini key again.');
    return null;
  }
};

const normalizeModel = (model) => {
  const m = String(model || '').trim().replace(/^models\//, '');
  return MODEL_NAME_RE.test(m) ? m : DEFAULT_GEMINI_MODEL;
};

const getRow = async () => {
  await ensureAiSettingsTable();
  const res = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
  return res.rows[0];
};

/** Safe view for the settings page: never includes the key itself. */
const getPublicAiSettings = async () => {
  const row = await getRow();
  const hasKey = !!row?.api_key_encrypted;
  return {
    provider: 'gemini',
    hasKey,
    keyHint: hasKey && row.key_last4 ? `••••••••••••${row.key_last4}` : null,
    model: row?.model || DEFAULT_GEMINI_MODEL,
    enabled: !!row?.enabled,
    lastTestedAt: row?.last_tested_at || null,
    lastTestOk: row?.last_test_ok === null || row?.last_test_ok === undefined ? null : !!row.last_test_ok,
    updatedByName: row?.updated_by_name || null,
    updatedAt: row?.updated_at || null,
    modelOptions: GEMINI_MODEL_OPTIONS
  };
};

/** Server-side only: returns the decrypted key when the AI is switched on. */
const getActiveAiConfig = async () => {
  const row = await getRow();
  if (!row || !row.enabled || !row.api_key_encrypted) return null;
  const apiKey = decryptSecret(row.api_key_encrypted);
  if (!apiKey) return null;
  return { provider: 'gemini', apiKey, model: normalizeModel(row.model) };
};

/** Decrypted saved key regardless of the on/off switch (used by the Test button). */
const getSavedApiKey = async () => {
  const row = await getRow();
  return row?.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : null;
};

const saveAiSettings = async ({ apiKey, model, enabled, testOk, admin }) => {
  await ensureAiSettingsTable();
  const sets = ['updated_at = CURRENT_TIMESTAMP', 'updated_by = $1', 'updated_by_name = $2'];
  const params = [admin?.id || null, admin?.username || admin?.name || 'Admin'];

  if (apiKey) {
    params.push(encryptSecret(apiKey));
    sets.push(`api_key_encrypted = $${params.length}`);
    params.push(String(apiKey).slice(-4));
    sets.push(`key_last4 = $${params.length}`);
  }
  if (model !== undefined) {
    params.push(normalizeModel(model));
    sets.push(`model = $${params.length}`);
  }
  if (enabled !== undefined) {
    params.push(!!enabled);
    sets.push(`enabled = $${params.length}`);
  }
  if (testOk !== undefined) {
    params.push(!!testOk);
    sets.push(`last_test_ok = $${params.length}`);
    sets.push('last_tested_at = CURRENT_TIMESTAMP');
  }

  await pool.query(`UPDATE ai_settings SET ${sets.join(', ')} WHERE id = 1`, params);
  return getPublicAiSettings();
};

const recordTestResult = async (ok) => {
  await ensureAiSettingsTable();
  await pool.query('UPDATE ai_settings SET last_test_ok = $1, last_tested_at = CURRENT_TIMESTAMP WHERE id = 1', [!!ok]);
};

const removeAiKey = async (admin) => {
  await ensureAiSettingsTable();
  await pool.query(
    `UPDATE ai_settings
     SET api_key_encrypted = NULL, key_last4 = NULL, enabled = FALSE, last_test_ok = NULL, last_tested_at = NULL,
         updated_by = $1, updated_by_name = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [admin?.id || null, admin?.username || admin?.name || 'Admin']
  );
  return getPublicAiSettings();
};

module.exports = {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_OPTIONS,
  normalizeModel,
  getPublicAiSettings,
  getActiveAiConfig,
  getSavedApiKey,
  saveAiSettings,
  recordTestResult,
  removeAiKey
};
