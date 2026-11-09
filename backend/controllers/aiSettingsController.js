const { logAdminActivity, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const {
  getPublicAiSettings,
  getSavedApiKey,
  saveAiSettings,
  recordTestResult,
  removeAiKey,
  normalizeModel
} = require('../services/aiSettingsService');
const { testGeminiKey, GeminiError } = require('../services/geminiClient');

// Gemini keys from Google AI Studio are ~39 characters of letters, digits, "-" and "_"
const KEY_RE = /^[A-Za-z0-9_\-]{20,200}$/;

const logAi = (req, actionType, description) =>
  logAdminActivity({
    adminId: req.user.id,
    adminName: req.user.username || req.user.name || 'Admin',
    adminEmail: req.user.email || '',
    actionType,
    moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
    description,
    ipAddress: getClientIP(req),
    browserInfo: req.headers['user-agent'],
    source: 'MANUAL_PAGE'
  }).catch(() => {});

const runTest = async (apiKey, model) => {
  try {
    await testGeminiKey({ apiKey, model });
    return { ok: true, message: `Gemini key works with model ${model}.` };
  } catch (err) {
    const message = err instanceof GeminiError ? err.userMessage : 'Gemini test failed. Please try again.';
    return { ok: false, message };
  }
};

/** GET /api/ai-settings  (Super Admin) */
const getAiSettings = async (req, res) => {
  try {
    return res.json({ success: true, settings: await getPublicAiSettings() });
  } catch (error) {
    console.error('Get AI settings error:', error);
    return res.status(500).json({ success: false, message: 'Could not load AI settings.' });
  }
};

/**
 * POST /api/ai-settings/test  (Super Admin)
 * Tests a newly typed key (not saved) or, when no key is sent, the saved key.
 */
const testAiSettings = async (req, res) => {
  try {
    const typedKey = String(req.body?.apiKey || '').trim();
    const current = await getPublicAiSettings();
    const model = normalizeModel(req.body?.model || current.model);

    if (typedKey && !KEY_RE.test(typedKey)) {
      return res.status(400).json({ success: false, message: 'This does not look like a Gemini API key. Please paste the full key.' });
    }
    const apiKey = typedKey || (await getSavedApiKey());
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Please enter a Gemini API key first.' });
    }

    const result = await runTest(apiKey, model);
    if (!typedKey) await recordTestResult(result.ok);
    logAi(req, 'AI KEY TEST', `${typedKey ? 'Tested a new' : 'Tested the saved'} Gemini key (model ${model}): ${result.ok ? 'working' : 'failed'}.`);
    return res.json({ success: result.ok, message: result.message, settings: await getPublicAiSettings() });
  } catch (error) {
    console.error('Test AI settings error:', error);
    return res.status(500).json({ success: false, message: 'Could not test the Gemini key right now.' });
  }
};

/**
 * PUT /api/ai-settings  (Super Admin)
 * Body: { apiKey?, model?, enabled? }. A new key is always tested before it is saved.
 */
const updateAiSettings = async (req, res) => {
  try {
    const typedKey = String(req.body?.apiKey || '').trim();
    const current = await getPublicAiSettings();
    const model = req.body?.model !== undefined ? normalizeModel(req.body.model) : current.model;
    const enabled = req.body?.enabled !== undefined ? !!req.body.enabled : undefined;

    if (typedKey) {
      if (!KEY_RE.test(typedKey)) {
        return res.status(400).json({ success: false, message: 'This does not look like a Gemini API key. Please paste the full key.' });
      }
      const result = await runTest(typedKey, model);
      if (!result.ok) {
        logAi(req, 'AI KEY SAVE FAILED', `New Gemini key was not saved because the test failed (model ${model}).`);
        return res.status(400).json({ success: false, message: `Key not saved. ${result.message}` });
      }
      const settings = await saveAiSettings({
        apiKey: typedKey,
        model,
        enabled: enabled === undefined ? true : enabled,
        testOk: true,
        admin: req.user
      });
      logAi(req, 'AI KEY SAVED', `Saved a new Gemini key ending ${typedKey.slice(-4)} (model ${model}). AI answers ${settings.enabled ? 'enabled' : 'disabled'}.`);
      return res.json({ success: true, message: 'Gemini key tested and saved. The key is now hidden.', settings });
    }

    if (enabled === true && !current.hasKey) {
      return res.status(400).json({ success: false, message: 'Add and test a Gemini key before turning AI answers on.' });
    }

    const settings = await saveAiSettings({ model, enabled, admin: req.user });
    logAi(req, 'AI SETTINGS UPDATED', `AI answers ${settings.enabled ? 'enabled' : 'disabled'}, model ${settings.model}.`);
    return res.json({ success: true, message: 'AI settings saved.', settings });
  } catch (error) {
    console.error('Update AI settings error:', error);
    return res.status(500).json({ success: false, message: 'Could not save AI settings.' });
  }
};

/** DELETE /api/ai-settings/key  (Super Admin) */
const deleteAiKey = async (req, res) => {
  try {
    const settings = await removeAiKey(req.user);
    logAi(req, 'AI KEY REMOVED', 'Removed the saved Gemini key. AI answers turned off.');
    return res.json({ success: true, message: 'Gemini key removed. AI answers are off.', settings });
  } catch (error) {
    console.error('Remove AI key error:', error);
    return res.status(500).json({ success: false, message: 'Could not remove the Gemini key.' });
  }
};

module.exports = { getAiSettings, testAiSettings, updateAiSettings, deleteAiKey };
