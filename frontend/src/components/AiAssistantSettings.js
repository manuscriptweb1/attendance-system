import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiKey, FiZap, FiTrash2, FiRefreshCw, FiEye, FiEyeOff, FiLock } from 'react-icons/fi';
import { getAiSettings, saveAiSettings, testAiSettings, removeAiKey } from '../services/api';

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-40 ${checked ? 'bg-emerald-500' : 'bg-admin-elevated border border-admin-border'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-admin-elevated transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

/**
 * Super Admin card for the Gemini key used by the Admin Assistant.
 * Flow: paste key -> Test -> Save. After saving, the key is never shown again (only its last 4 characters).
 */
const AiAssistantSettings = ({ onToast, onError }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODELS[0]);
  const [customModel, setCustomModel] = useState('');
  const [testResult, setTestResult] = useState(null); // { ok, message, key }

  const modelOptions = settings?.modelOptions?.length ? settings.modelOptions : DEFAULT_MODELS;
  const selectedModel = model === '__custom' ? customModel.trim() : model;

  const applySettings = (s) => {
    setSettings(s);
    if (!s) return;
    const options = s.modelOptions?.length ? s.modelOptions : DEFAULT_MODELS;
    if (options.includes(s.model)) {
      setModel(s.model);
    } else {
      setModel('__custom');
      setCustomModel(s.model || '');
    }
  };

  useEffect(() => {
    let active = true;
    getAiSettings()
      .then((res) => { if (active && res.data?.success) applySettings(res.data.settings); })
      .catch((err) => onError?.('AI Settings', err.response?.data?.message || 'Could not load AI settings.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearKeyInput = () => {
    setKeyInput('');
    setShowKey(false);
    setTestResult(null);
  };

  const errorText = (err, fallback) => err.response?.data?.message || fallback;

  const handleTestNewKey = async () => {
    const apiKey = keyInput.trim();
    if (!apiKey) return;
    setBusy('test');
    setTestResult(null);
    try {
      const res = await testAiSettings({ apiKey, model: selectedModel });
      setTestResult({ ok: !!res.data?.success, message: res.data?.message, key: apiKey });
    } catch (err) {
      setTestResult({ ok: false, message: errorText(err, 'Gemini test failed.'), key: apiKey });
    } finally {
      setBusy('');
    }
  };

  const handleSaveKey = async () => {
    const apiKey = keyInput.trim();
    if (!apiKey) return;
    setBusy('save');
    try {
      const res = await saveAiSettings({ apiKey, model: selectedModel, enabled: true });
      if (res.data?.success) {
        applySettings(res.data.settings);
        clearKeyInput();
        setEditingKey(false);
        onToast?.(res.data.message || 'Gemini key saved.');
      }
    } catch (err) {
      setTestResult({ ok: false, message: errorText(err, 'The key could not be saved.'), key: apiKey });
    } finally {
      setBusy('');
    }
  };

  const handleTestSavedKey = async () => {
    setBusy('test-saved');
    try {
      const res = await testAiSettings({ model: selectedModel });
      if (res.data?.settings) applySettings(res.data.settings);
      if (res.data?.success) onToast?.(res.data.message || 'Gemini key works.');
      else onError?.('Gemini Test Failed', res.data?.message || 'The saved key did not work.');
    } catch (err) {
      onError?.('Gemini Test Failed', errorText(err, 'The saved key could not be tested.'));
    } finally {
      setBusy('');
    }
  };

  const handleToggleEnabled = async () => {
    if (!settings?.hasKey) return;
    setBusy('toggle');
    try {
      const res = await saveAiSettings({ enabled: !settings.enabled });
      if (res.data?.success) {
        applySettings(res.data.settings);
        onToast?.(res.data.settings.enabled ? 'AI answers turned on.' : 'AI answers turned off.');
      }
    } catch (err) {
      onError?.('AI Settings', errorText(err, 'Could not change AI answers.'));
    } finally {
      setBusy('');
    }
  };

  const handleSaveModel = async () => {
    if (!selectedModel) return;
    setBusy('model');
    try {
      const res = await saveAiSettings({ model: selectedModel });
      if (res.data?.success) {
        applySettings(res.data.settings);
        onToast?.('AI model saved. Use "Test Saved Key" to check it.');
      }
    } catch (err) {
      onError?.('AI Settings', errorText(err, 'Could not save the model.'));
    } finally {
      setBusy('');
    }
  };

  const handleRemoveKey = async () => {
    if (!window.confirm('Remove the saved Gemini key? The assistant will stop giving AI answers until a new key is added.')) return;
    setBusy('remove');
    try {
      const res = await removeAiKey();
      if (res.data?.success) {
        applySettings(res.data.settings);
        clearKeyInput();
        setEditingKey(false);
        onToast?.(res.data.message || 'Gemini key removed.');
      }
    } catch (err) {
      onError?.('AI Settings', errorText(err, 'Could not remove the key.'));
    } finally {
      setBusy('');
    }
  };

  // Enter inside these inputs must not submit the main settings form
  const blockEnter = (e) => { if (e.key === 'Enter') e.preventDefault(); };

  if (loading) {
    return <p className="text-xs text-admin-muted">Loading AI settings...</p>;
  }

  const hasKey = !!settings?.hasKey;
  const showKeyForm = !hasKey || editingKey;
  const testedThisKey = testResult && testResult.key === keyInput.trim();
  const canSave = testedThisKey && testResult.ok && !busy;
  const modelChanged = hasKey && selectedModel && selectedModel !== settings?.model;

  return (
    <div className="space-y-4">
      <p className="text-xs text-admin-muted font-medium">
        With a Gemini key, the assistant can answer free questions such as "who was late most in September and why".
        It only answers from this system's data (attendance, employees, holidays, leaves, permissions, payroll)
        and politely declines anything outside the project. Visible to Super Admin only.
      </p>

      {/* Saved key status */}
      {hasKey && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-admin-elevated border border-admin-border rounded-xl">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-admin-text flex items-center gap-2">
              <FiLock className="text-emerald-400" /> Gemini key saved (hidden)
            </h3>
            <p className="text-sm font-mono text-admin-secondary mt-1 break-all">{settings.keyHint}</p>
            <p className="text-xs text-admin-muted mt-1">
              {settings.lastTestOk === true && <span className="text-emerald-400 font-bold">Last test: working</span>}
              {settings.lastTestOk === false && <span className="text-red-400 font-bold">Last test: failed</span>}
              {settings.lastTestedAt && <span> · {formatDateTime(settings.lastTestedAt)}</span>}
              {settings.updatedByName && <span> · saved by {settings.updatedByName}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestSavedKey}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              <FiZap size={14} className={busy === 'test-saved' ? 'animate-spin' : ''} />
              {busy === 'test-saved' ? 'Testing...' : 'Test Saved Key'}
            </button>
            <button
              type="button"
              onClick={() => { setEditingKey((v) => !v); clearKeyInput(); }}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              <FiRefreshCw size={14} /> {editingKey ? 'Keep Current Key' : 'Replace Key'}
            </button>
            <button
              type="button"
              onClick={handleRemoveKey}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            >
              <FiTrash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}

      {/* AI answers on/off */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-admin-elevated border border-admin-border rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-admin-text">Use AI for free questions</h3>
          <p className="text-xs text-admin-muted mt-1 font-medium">
            {hasKey ? 'When off, the assistant uses only its built-in commands.' : 'Add and test a Gemini key first.'}
          </p>
        </div>
        <ToggleSwitch checked={!!settings?.enabled} onChange={handleToggleEnabled} disabled={!hasKey || !!busy} />
      </div>

      {/* Model */}
      <div className="p-4 bg-admin-elevated border border-admin-border rounded-xl">
        <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Gemini Model</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="admin-input py-2.5 text-sm flex-1"
          >
            {modelOptions.map((m) => <option key={m} value={m}>{m}{m === DEFAULT_MODELS[0] ? ' (recommended)' : ''}</option>)}
            <option value="__custom">Other model name...</option>
          </select>
          {model === '__custom' && (
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              onKeyDown={blockEnter}
              placeholder="e.g. gemini-2.5-flash"
              className="admin-input py-2.5 text-sm font-mono flex-1"
            />
          )}
          {modelChanged && (
            <button
              type="button"
              onClick={handleSaveModel}
              disabled={!!busy}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {busy === 'model' ? 'Saving...' : 'Save Model'}
            </button>
          )}
        </div>
        <p className="text-xs text-admin-muted mt-2">Flash is fast and low cost. If a model is not available for your key, the test will say so.</p>
      </div>

      {/* New key: paste -> Test -> Save */}
      {showKeyForm && (
        <div className="p-4 bg-admin-elevated border border-admin-border rounded-xl">
          <h3 className="text-sm font-bold text-admin-text mb-1 flex items-center gap-2">
            <FiKey className="text-amber-400" /> {hasKey ? 'Replace Gemini API Key' : 'Add Gemini API Key'}
          </h3>
          <p className="text-xs text-admin-muted mb-4">
            Create a key in Google AI Studio (aistudio.google.com → Get API key), paste it here, press Test, then Save.
            After saving, the key is encrypted and hidden. It is never shown again.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setTestResult(null); }}
                onKeyDown={blockEnter}
                placeholder="Paste Gemini API key"
                autoComplete="off"
                spellCheck={false}
                className="admin-input w-full py-2.5 pr-10 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-text"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleTestNewKey}
              disabled={!keyInput.trim() || !selectedModel || !!busy}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            >
              <FiZap size={14} className={busy === 'test' ? 'animate-spin' : ''} />
              {busy === 'test' ? 'Testing...' : 'Test Key'}
            </button>
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={!canSave}
              title={canSave ? '' : 'Test the key first'}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiLock size={14} /> {busy === 'save' ? 'Saving...' : 'Save Key'}
            </button>
          </div>
          {testedThisKey && (
            <div className={`mt-3 text-xs font-bold flex items-center gap-2 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.ok ? <FiCheckCircle /> : <FiXCircle />}
              {testResult.ok ? `${testResult.message} You can save it now.` : testResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiAssistantSettings;
