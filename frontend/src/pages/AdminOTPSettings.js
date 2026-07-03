import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import { Spinner } from '../components/Loader';
import { getOTPSettings, updateOTPSettings } from '../services/api';
import { FiSave, FiRefreshCw, FiClock, FiShield, FiAlertCircle, FiInfo, FiActivity, FiKey } from 'react-icons/fi';

const Field = ({ label, hint, error, icon: Icon, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">{label}</label>
    <div className="relative group">
      {Icon && <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400"><Icon size={16} className="text-admin-secondary group-focus-within:text-blue-400 transition-colors" /></div>}
      <div className={Icon ? 'pl-11' : ''}>{children}</div>
    </div>
    {error && <p className="mt-2 text-[10px] font-bold text-red-400 uppercase tracking-widest">{error}</p>}
    {hint && !error && <p className="mt-2 text-[10px] font-bold text-[#475569] uppercase tracking-widest">{hint}</p>}
  </div>
);

const AdminOTPSettings = () => {
  const [loading, setSaving_] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ otp_expiry_minutes:5, otp_resend_seconds:60, otp_max_attempts:3, otp_requests_per_hour:5 });
  const [originalSettings, setOriginalSettings] = useState(null);
  const [errors, setErrors] = useState({});
  const [alertDialog, setAlertDialog] = useState({ isOpen:false, title:'', message:'', type:'success' });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      setSaving_(true);
      const response = await getOTPSettings();
      if (response.data.success) { setSettings(response.data.settings); setOriginalSettings(response.data.settings); }
    } catch (error) {
      setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Failed to load OTP settings', type:'error' });
    } finally { setSaving_(false); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: parseInt(value) || 0 });
    if (errors[name]) setErrors({ ...errors, [name]:'' });
  };

  const validateSettings = () => {
    const newErrors = {};
    if (settings.otp_expiry_minutes < 1 || settings.otp_expiry_minutes > 60) newErrors.otp_expiry_minutes = 'Must be 1–60 minutes';
    if (settings.otp_resend_seconds < 30 || settings.otp_resend_seconds > 300) newErrors.otp_resend_seconds = 'Must be 30–300 seconds';
    if (settings.otp_max_attempts < 1 || settings.otp_max_attempts > 10) newErrors.otp_max_attempts = 'Must be 1–10 attempts';
    if (settings.otp_requests_per_hour < 1 || settings.otp_requests_per_hour > 20) newErrors.otp_requests_per_hour = 'Must be 1–20 requests';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateSettings()) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Please fix the errors before saving', type:'error' }); return; }
    setSaving(true);
    try {
      const response = await updateOTPSettings(settings);
      if (response.data.success) { setOriginalSettings(settings); setAlertDialog({ isOpen:true, title:'Success', message:'OTP settings updated successfully! Changes apply immediately.', type:'success' }); }
    } catch (error) {
      setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Failed to update OTP settings', type:'error' });
    } finally { setSaving(false); }
  };

  const handleReset = () => { setSettings(originalSettings); setErrors({}); };
  const hasChanges = () => originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const FIELDS = [
    { name:'otp_expiry_minutes',    icon:FiClock,       label:'OTP Expiry Time (Minutes)',      hint:'How long an OTP remains valid (1–60 min)',             min:1,  max:60  },
    { name:'otp_resend_seconds',    icon:FiRefreshCw,   label:'Resend Cooldown (Seconds)',       hint:'Minimum wait before OTP can be resent (30–300 sec)',   min:30, max:300 },
    { name:'otp_max_attempts',      icon:FiShield,      label:'Maximum Verification Attempts',   hint:'Failed attempts before OTP is invalidated (1–10)',     min:1,  max:10  },
    { name:'otp_requests_per_hour', icon:FiAlertCircle, label:'Requests Per Hour (Rate Limit)',  hint:'Max OTP requests per employee per hour (1–20)',        min:1,  max:20  },
  ];

  const RECOMMENDED = [
    { label:'Expiry', value:'5 min' }, { label:'Resend', value:'60 sec' },
    { label:'Attempts', value:'3 max' }, { label:'Rate', value:'5 / hr' },
  ];

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 overflow-y-auto dark-scroll relative pb-24">
        
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3" />

        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8 animate-fadeIn relative z-10">
          <div className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight drop-shadow-md">OTP Security Configuration</h1>
            <p className="text-sm text-admin-muted mt-1.5 font-medium">Fine-tune OTP security parameters and monitor live verification metrics.</p>
          </div>

          {/* ─── Top Statistics Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'OTP Expiry', value: `${settings.otp_expiry_minutes}m`, color: 'text-blue-400', border: 'border-blue-500/20', bg: 'from-blue-500/10', icon: FiClock },
              { label: 'Resend Cooldown', value: `${settings.otp_resend_seconds}s`, color: 'text-purple-400', border: 'border-purple-500/20', bg: 'from-purple-500/10', icon: FiRefreshCw },
              { label: 'Max Attempts', value: settings.otp_max_attempts, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'from-amber-500/10', icon: FiShield },
              { label: 'Req / Hour', value: settings.otp_requests_per_hour, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'from-rose-500/10', icon: FiAlertCircle },
            ].map((s, i) => (
              <div key={i} className={`bg-admin-elevated border ${s.border} rounded-2xl p-4 shadow-clay-admin overflow-hidden relative group hover:-translate-y-1 transition-transform duration-300`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} to-transparent opacity-50 group-hover:opacity-100 transition-opacity`} />
                <div className="relative z-10 flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold text-admin-secondary uppercase tracking-widest">{s.label}</p>
                  <s.icon size={12} className={`${s.color} opacity-70`} />
                </div>
                <div className="relative z-10">
                  <p className={`text-2xl font-black ${s.color} drop-shadow-sm`}>{loading ? '-' : s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Spinner size={40} color="blue" />
                <p className="text-xs font-bold text-blue-400 animate-pulse">Loading Security Config...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Info banner */}
              <div className="flex items-center gap-4 p-4 bg-admin-elevated border border-amber-500/30 rounded-2xl shadow-[0_4px_16px_rgba(245,158,11,0.1)] relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <FiInfo size={18} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-admin-text mb-0.5">Live Configuration</h3>
                  <p className="text-xs text-admin-muted">Changes apply immediately. Active OTPs continue using old settings until they expire.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* ─── Editor ─── */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-admin-elevated border border-admin-border rounded-3xl overflow-hidden shadow-clay-admin">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-admin-border bg-admin-surface backdrop-blur-md">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner"><FiShield size={18} /></div>
                      <div>
                        <h2 className="text-sm font-bold text-admin-text">Security Configuration</h2>
                        <p className="text-[10px] text-admin-secondary uppercase tracking-widest font-bold mt-0.5">Modify System Guardrails</p>
                      </div>
                    </div>
                    
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                      {FIELDS.map(({ name, icon, label, hint, min, max }) => (
                        <Field key={name} label={label} hint={hint} error={errors[name]} icon={icon}>
                          <input
                            type="number" name={name} value={settings[name]} onChange={handleChange}
                            min={min} max={max} required
                            className={`w-full bg-admin-bg border border-admin-border text-admin-text text-sm rounded-xl py-3.5 pr-4 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner ${errors[name] ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50' : ''}`}
                            style={{ paddingLeft: '2.75rem' }}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ─── Guidelines Sidebar ─── */}
                <div className="space-y-6">
                  <div className="bg-admin-elevated border border-admin-border rounded-3xl overflow-hidden shadow-clay-admin">
                    <div className="px-6 py-5 border-b border-admin-border bg-admin-surface backdrop-blur-md">
                      <h2 className="text-sm font-bold text-admin-text">Security Guidelines</h2>
                    </div>
                    <div className="p-6 space-y-4">
                      {[
                        ['Shorter expiry', 'Better security, more user friction.'],
                        ['Higher cooldown', 'Prevents spam, limits brute-force.'],
                        ['Lower attempts', 'Stronger lockouts, more lockouts.'],
                        ['Stricter rate', 'Prevents abuse, controls API load.'],
                      ].map(([bold, rest]) => (
                        <div key={bold} className="flex items-start gap-3 bg-admin-elevated/[0.02] border border-admin-border p-3 rounded-xl">
                          <span className="text-emerald-400 font-bold mt-0.5 text-xs">✓</span>
                          <div>
                            <p className="font-bold text-admin-secondary text-xs">{bold}</p>
                            <p className="text-[10px] text-admin-muted uppercase tracking-widest mt-1">{rest}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="px-6 pb-6">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl relative overflow-hidden group hover:bg-blue-500/20 transition-colors cursor-default">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/10 rounded-full blur-xl" />
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                          <FiShield size={16} className="text-blue-400" />
                          <p className="text-xs font-bold text-admin-text uppercase tracking-widest">Recommended Defaults</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 relative z-10">
                          {RECOMMENDED.map(({ label, value }) => (
                            <div key={label} className="bg-admin-bg border border-admin-border rounded-xl p-2 text-center">
                              <p className="text-[9px] font-bold text-admin-secondary uppercase tracking-widest">{label}</p>
                              <p className="text-xs font-black text-blue-400 mt-0.5">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-admin-elevated border border-admin-border rounded-2xl p-4 shadow-clay-admin flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                  {hasChanges() ? (
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> Unsaved changes detected
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-admin-secondary uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#64748B]" /> Configuration synced
                    </p>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button type="button" onClick={handleReset} disabled={!hasChanges() || saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-admin-muted border border-admin-border rounded-xl hover:bg-admin-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <FiRefreshCw size={14} /> Revert
                  </button>
                  <button type="submit" disabled={!hasChanges() || saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all">
                    {saving ? <><Spinner size={14} color="white" /> Saving…</> : <><FiSave size={14} /> Update Security</>}
                  </button>
                </div>
              </div>

            </form>
          )}
        </div>
      </div>
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog({ ...alertDialog, isOpen:false })} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
    </div>
  );
};

export default AdminOTPSettings;
