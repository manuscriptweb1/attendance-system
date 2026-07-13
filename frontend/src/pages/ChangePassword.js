import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import { requestPasswordChange, completePasswordChange, resendOTP } from '../services/api';
import { FiLock, FiEye, FiEyeOff, FiKey, FiClock, FiMail, FiShield, FiCheck, FiChevronRight } from 'react-icons/fi';
import { Spinner } from '../components/Loader';

const ChangePassword = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ currentPassword:'', otp:'', newPassword:'', confirmNewPassword:'' });
  const [showPasswords, setShowPasswords] = useState({ current:false, new:false, confirm:false });
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(5);
  const [countdown, setCountdown] = useState(0);
  const [alertDialog, setAlertDialog] = useState({ isOpen:false, title:'', message:'', type:'success' });

  React.useEffect(() => {
    let timer;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const toggleShow = (field) => setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] });

  /* ─── Handlers (UNCHANGED) ─── */
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!formData.currentPassword) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Please enter your current password', type:'error' }); return; }
    setLoading(true);
    try {
      const response = await requestPasswordChange(formData.currentPassword);
      if (response.data.success) {
        setMaskedEmail(response.data.maskedEmail); setExpiryMinutes(response.data.expiresInMinutes); setCountdown(60); setStep(2);
        setAlertDialog({ isOpen:true, title:'OTP Sent', message:`OTP has been sent to ${response.data.maskedEmail}`, type:'success' });
      }
    } catch (error) {
      setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Failed to send OTP. Please try again.', type:'error' });
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!formData.otp || !formData.newPassword || !formData.confirmNewPassword) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'All fields are required', type:'error' }); return; }
    if (formData.newPassword !== formData.confirmNewPassword) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'New password and confirm password do not match', type:'error' }); return; }
    setLoading(true);
    try {
      const response = await completePasswordChange(formData.otp, formData.newPassword, formData.confirmNewPassword);
      if (response.data.success) {
        setAlertDialog({ isOpen:true, title:'Success', message:'Password changed successfully!', type:'success' });
        setTimeout(() => { setStep(1); setFormData({ currentPassword:'', otp:'', newPassword:'', confirmNewPassword:'' }); }, 2000);
      }
    } catch (error) {
      const errors = error.response?.data?.errors;
      setAlertDialog({ isOpen:true, title:'Error', message: errors ? errors.join(', ') : error.response?.data?.message || 'Failed to change password', type:'error' });
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const userData = JSON.parse(sessionStorage.getItem('user'));
      const response = await resendOTP(userData.email, 'password_change');
      if (response.data.success) { setCountdown(60); setAlertDialog({ isOpen:true, title:'OTP Resent', message:'A new OTP has been sent to your email', type:'success' }); }
    } catch (error) {
      setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Failed to resend OTP', type:'error' });
    } finally { setLoading(false); }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength:0, label:'', color:'', textColor:'' };
    let s = 0;
    if (password.length >= 8) s++;
    if (/[a-z]/.test(password)) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    const labels = ['','Weak','Fair','Good','Strong','Very Strong'];
    const colors = ['','bg-red-500','bg-orange-500','bg-yellow-500','bg-emerald-500','bg-emerald-600'];
    const textColors = ['','text-red-600','text-orange-600','text-yellow-600','text-emerald-600','text-emerald-700'];
    return { strength:(s/5)*100, label:labels[s], color:colors[s], textColor:textColors[s] };
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  /* ─── Steps config ─── */
  const steps = [
    { num: 1, label: 'Verify Password', icon: FiLock },
    { num: 2, label: 'OTP Verification', icon: FiMail },
    { num: 3, label: 'New Password', icon: FiKey },
  ];

  // Map internal steps: step 1 = verify, step 2 = OTP + new password (combined)
  const activeVisualStep = step === 1 ? 1 : 3; // step 2 in code = steps 2+3 visually

  return (
    <div className="flex h-screen" style={{ background: '#F5F7FB' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-4 py-5 lg:px-8 lg:py-7 max-w-[680px] mx-auto pt-16 lg:pt-7">

          {/* ═══ HEADER ═══ */}
          <div className="mb-6 animate-fadeInUp stagger-1">
            <h1 className="text-2xl font-bold text-[#1E293B]">Account Security</h1>
            <p className="text-sm text-[#64748B] mt-1">Protect your account with a secure password.</p>
          </div>

          {/* ═══ SECURITY STATUS ═══ */}
          <div className="clay-card-soft p-5 mb-6 animate-fadeInUp stagger-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <FiShield size={16} className="text-emerald-500" />
              </div>
              <h3 className="text-sm font-bold text-[#1E293B]">Security Status</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E7EBF2]/80" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <FiLock size={14} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Password</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">Protected</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E7EBF2]/80" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FiMail size={14} className="text-[#4F6CE1]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">OTP Verification</p>
                  <p className="text-xs font-semibold text-[#4F6CE1] mt-0.5">Enabled</p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ STEP INDICATOR ═══ */}
          <div className="clay-card-soft p-5 mb-6 animate-fadeInUp stagger-3">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      activeVisualStep >= s.num
                        ? 'bg-gradient-to-br from-[#4F6CE1] to-[#7B93F5] text-[#0F172A] shadow-[0_4px_14px_rgba(79,108,225,0.3)]'
                        : 'bg-[#F1F5F9] text-[#64748B]'
                    }`}>
                      {activeVisualStep > s.num
                        ? <FiCheck size={18} />
                        : <s.icon size={18} />
                      }
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${activeVisualStep >= s.num ? 'text-[#4F6CE1]' : 'text-[#64748B]'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all duration-500 ${activeVisualStep > s.num ? 'bg-gradient-to-r from-[#4F6CE1] to-[#7B93F5]' : 'bg-[#E7EBF2]'}`}>
                      <FiChevronRight size={0} className="hidden" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ═══ MAIN FORM CARD ═══ */}
          <div className="clay-card-soft overflow-hidden animate-fadeInUp stagger-4">
            {/* Card Header */}
            <div className="bg-gradient-to-br from-[#4F6CE1] via-[#6366f1] to-[#7B93F5] px-6 py-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.05] rounded-full -translate-y-10 translate-x-10" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <FiShield size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Secure Password Change</h2>
                  <p className="text-sm text-blue-200 mt-0.5">
                    {step === 1 ? 'Verify your current password to continue' : `OTP sent to ${maskedEmail}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* ─── STEP 1: Verify Password ─── */}
              {step === 1 && (
                <form onSubmit={handleRequestOTP} className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Current Password</label>
                    <div className="relative">
                      <FiLock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleChange}
                        className="w-full bg-white border border-[#E7EBF2] text-[#1E293B] rounded-2xl py-3.5 pl-12 pr-12 text-sm placeholder:text-[#64748B] focus:outline-none focus:border-[#4F6CE1] focus:ring-4 focus:ring-[#4F6CE1]/10 transition-all"
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(149,163,187,0.06)' }}
                        placeholder="Enter your current password"
                        required
                      />
                      <button type="button" onClick={() => toggleShow('current')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#4F6CE1] transition-colors">
                        {showPasswords.current ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#4F6CE1] to-[#7B93F5] hover:from-[#4361d0] hover:to-[#6b84e8] text-white font-semibold rounded-2xl text-sm shadow-[0_4px_16px_rgba(79,108,225,0.3)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200"
                  >
                    {loading
                      ? <><Spinner size="sm" color="white" /> Verifying…</>
                      : <><FiKey size={16} /> Verify & Send OTP</>
                    }
                  </button>
                </form>
              )}

              {/* ─── STEP 2: OTP + New Password ─── */}
              {step === 2 && (
                <form onSubmit={handleChangePassword} className="space-y-5">
                  {/* OTP info banner */}
                  <div className="flex items-start gap-3 bg-[#4F6CE1]/6 border border-[#4F6CE1]/15 rounded-2xl p-4">
                    <div className="w-8 h-8 rounded-xl bg-[#4F6CE1]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiMail size={14} className="text-[#4F6CE1]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#1E293B]">OTP sent to:</p>
                      <p className="text-sm font-bold text-[#4F6CE1]">{maskedEmail}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">Valid for {expiryMinutes} minutes</p>
                    </div>
                  </div>

                  {/* OTP input */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Enter OTP</label>
                    <input
                      type="text"
                      name="otp"
                      value={formData.otp}
                      onChange={handleChange}
                      className="w-full bg-white border border-[#E7EBF2] text-[#1E293B] rounded-2xl py-3.5 px-4 text-center text-2xl font-mono tracking-[0.3em] placeholder:text-[#475569] focus:outline-none focus:border-[#4F6CE1] focus:ring-4 focus:ring-[#4F6CE1]/10 transition-all"
                      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(149,163,187,0.06)' }}
                      placeholder="000000"
                      maxLength="6"
                      required
                      autoFocus
                    />
                    <div className="mt-2 text-right">
                      <button type="button" onClick={handleResendOTP} disabled={countdown > 0 || loading}
                        className="text-xs font-semibold text-[#4F6CE1] hover:text-[#4361d0] disabled:text-[#475569] disabled:cursor-not-allowed transition-colors">
                        {countdown > 0
                          ? <span className="flex items-center gap-1 justify-end"><FiClock size={12} /> Resend in {countdown}s</span>
                          : 'Resend OTP'
                        }
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">New Password</label>
                    <div className="relative">
                      <FiLock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleChange}
                        className="w-full bg-white border border-[#E7EBF2] text-[#1E293B] rounded-2xl py-3.5 pl-12 pr-12 text-sm placeholder:text-[#64748B] focus:outline-none focus:border-[#4F6CE1] focus:ring-4 focus:ring-[#4F6CE1]/10 transition-all"
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(149,163,187,0.06)' }}
                        placeholder="Enter new password"
                        required
                      />
                      <button type="button" onClick={() => toggleShow('new')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#4F6CE1] transition-colors">
                        {showPasswords.new ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                    {formData.newPassword && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[#64748B] font-medium">Password Strength</span>
                          <span className={`font-bold ${passwordStrength.textColor}`}>{passwordStrength.label}</span>
                        </div>
                        <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden" style={{ boxShadow: 'inset 0 1px 2px rgba(149,163,187,0.1)' }}>
                          <div className={`${passwordStrength.color} h-2 rounded-full transition-all duration-500 ease-out`} style={{ width:`${passwordStrength.strength}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Confirm New Password</label>
                    <div className="relative">
                      <FiLock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        name="confirmNewPassword"
                        value={formData.confirmNewPassword}
                        onChange={handleChange}
                        className="w-full bg-white border border-[#E7EBF2] text-[#1E293B] rounded-2xl py-3.5 pl-12 pr-12 text-sm placeholder:text-[#64748B] focus:outline-none focus:border-[#4F6CE1] focus:ring-4 focus:ring-[#4F6CE1]/10 transition-all"
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(149,163,187,0.06)' }}
                        placeholder="Confirm new password"
                        required
                      />
                      <button type="button" onClick={() => toggleShow('confirm')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#4F6CE1] transition-colors">
                        {showPasswords.confirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                    {formData.confirmNewPassword && formData.newPassword !== formData.confirmNewPassword && (
                      <p className="text-xs text-red-500 mt-2 font-medium">Passwords do not match</p>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E7EBF2]/80 space-y-2.5" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Password Requirements</p>
                    {[
                      { met: formData.newPassword.length >= 8,          label: 'At least 8 characters' },
                      { met: /[A-Z]/.test(formData.newPassword),        label: 'One uppercase letter' },
                      { met: /[a-z]/.test(formData.newPassword),        label: 'One lowercase letter' },
                      { met: /[0-9]/.test(formData.newPassword),        label: 'One number' },
                      { met: /[^a-zA-Z0-9]/.test(formData.newPassword), label: 'One special character' },
                    ].map(req => (
                      <div key={req.label} className="flex items-center gap-2.5 text-xs">
                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${req.met ? 'bg-emerald-100 text-emerald-600' : 'bg-[#F1F5F9] text-[#475569]'}`}>
                          <FiCheck size={11} />
                        </span>
                        <span className={`transition-colors ${req.met ? 'text-emerald-700 font-medium' : 'text-[#64748B]'}`}>{req.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setStep(1); setFormData({ ...formData, otp:'', newPassword:'', confirmNewPassword:'' }); }}
                      className="flex-1 px-5 py-3.5 text-sm font-semibold text-[#64748B] bg-[#F8FAFC] border border-[#E7EBF2] rounded-2xl hover:bg-[#F1F5F9] hover:border-[#CBD5E1] transition-all"
                      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#4F6CE1] to-[#7B93F5] hover:from-[#4361d0] hover:to-[#6b84e8] text-white font-semibold rounded-2xl text-sm shadow-[0_4px_16px_rgba(79,108,225,0.3)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200"
                    >
                      {loading
                        ? <><Spinner size="sm" color="white" /> Changing…</>
                        : <><FiKey size={15} /> Change Password</>
                      }
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog({ ...alertDialog, isOpen:false })} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
    </div>
  );
};

export default ChangePassword;
