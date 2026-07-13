import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { requestPasswordReset, verifyResetOTP, resetPassword, resendOTP } from '../services/api';
import { FiMail, FiKey, FiLock, FiEye, FiEyeOff, FiClock, FiArrowLeft, FiCheckCircle, FiShield, FiSend } from 'react-icons/fi';
import { Spinner } from '../components/Loader';
import AuthLayout from '../components/AuthLayout';

/* ─── Password requirement indicator ────────────────────────────────── */
const PwReq = ({ met, label }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${met ? 'bg-emerald-100 text-emerald-600' : 'bg-[#E2E8F0] text-[#94A3B8]'}`}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </span>
    <span className={met ? 'text-emerald-700 font-medium' : 'text-[#64748B]'}>{label}</span>
  </div>
);

/* ─── Left illustration panel ───────────────────────────────────────── */
const IllustrationPanel = () => (
  <div className="flex flex-col justify-center items-center w-full">
    <div
      className="relative animate-float"
      style={{ width: 'clamp(190px, 21vw, 290px)', height: 'clamp(190px, 21vw, 290px)', animationDuration: '6s' }}
    >
      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl scale-125" />

      {/* Envelope SVG */}
      <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-2xl relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="40" width="160" height="100" rx="12" fill="#DBEAFE" />
        <path d="M20 40 L100 100 L180 40 Z" fill="#BFDBFE" />
        <g className="animate-pulse" style={{ animationDuration: '4s' }}>
          <rect x="40" y="10" width="120" height="80" rx="6" fill="#FFFFFF" />
          <rect x="60" y="25" width="80" height="6" rx="3" fill="#E2E8F0" />
          <rect x="60" y="40" width="60" height="6" rx="3" fill="#E2E8F0" />
          <rect x="60" y="55" width="50" height="6" rx="3" fill="#2563EB" opacity="0.8" />
        </g>
        <path d="M20 140 L100 80 L180 140 Z" fill="#3B82F6" />
        <path d="M20 40 L100 80 L20 140 Z" fill="#60A5FA" />
        <path d="M180 40 L100 80 L180 140 Z" fill="#60A5FA" />
      </svg>

      {/* Padlock */}
      <div className="absolute -bottom-5 -right-5 animate-float" style={{ width: 'clamp(50px,5vw,80px)', height: 'clamp(50px,5vw,80px)', animationDelay: '1s' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="45" width="50" height="40" rx="10" fill="#7C3AED" />
          <path d="M35 45 V30 C35 20 45 15 50 15 C55 15 65 20 65 30 V45" stroke="#E2E8F0" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="60" r="6" fill="#FFFFFF" />
          <path d="M50 60 V75" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Paper Airplane */}
      <div className="absolute -top-8 -right-8 animate-float" style={{ width: 'clamp(38px,4vw,60px)', height: 'clamp(38px,4vw,60px)', animationDuration: '4s', animationDelay: '0.5s' }}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-blue-500 drop-shadow-md">
          <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="#3B82F6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Sparkle */}
      <div className="absolute top-8 -left-10 w-5 h-5 text-yellow-400 animate-ping" style={{ animationDuration: '3s' }}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" /></svg>
      </div>
    </div>

    <div className="mt-6 text-center" style={{ maxWidth: 'clamp(240px, 26vw, 380px)' }}>
      <h2 className="font-bold text-[#0F172A] mb-2" style={{ fontSize: 'clamp(14px, 1.5vw, 20px)' }}>
        Secure Recovery
      </h2>
      <p className="text-[#64748B]" style={{ fontSize: 'clamp(10px, 1vw, 13px)' }}>
        Enterprise-grade encryption keeps your account safe during the password reset process.
      </p>
    </div>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────── */
const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', otp: '', newPassword: '', confirmNewPassword: '' });
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false });
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(5);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    let timer;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); setError(''); setSuccess(''); };
  const toggleShow = (field) => setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] });

  const handleRequestOTP = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!formData.email) { setError('Please enter your email address'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) { setError('Please enter a valid email address'); return; }
    setLoading(true);
    try {
      const response = await requestPasswordReset(formData.email);
      if (response.data.success) {
        setMaskedEmail(response.data.maskedEmail || formData.email);
        setExpiryMinutes(response.data.expiresInMinutes || 5);
        setCountdown(60); setStep(2);
        setSuccess('OTP has been sent to your email address');
      }
    } catch (error) { setError(error.response?.data?.message || 'Failed to send OTP. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!formData.otp) { setError('Please enter the OTP'); return; }
    if (formData.otp.length !== 6) { setError('OTP must be 6 digits'); return; }
    setLoading(true);
    try {
      const response = await verifyResetOTP(formData.email, formData.otp);
      if (response.data.success) { setStep(3); setSuccess('OTP verified successfully'); }
    } catch (error) { setError(error.response?.data?.message || 'Invalid OTP. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!formData.newPassword || !formData.confirmNewPassword) { setError('All fields are required'); return; }
    if (formData.newPassword !== formData.confirmNewPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const response = await resetPassword(formData.email, formData.otp, formData.newPassword, formData.confirmNewPassword);
      if (response.data.success) { setStep(4); setSuccess('Password reset successfully!'); }
    } catch (error) {
      const errors = error.response?.data?.errors;
      setError(errors ? errors.join(', ') : error.response?.data?.message || 'Failed to reset password');
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const response = await resendOTP(formData.email, 'password_reset');
      if (response.data.success) { setCountdown(60); setSuccess('A new OTP has been sent to your email'); }
    } catch (error) { setError(error.response?.data?.message || 'Failed to resend OTP'); }
    finally { setLoading(false); }
  };

  const getPwStrength = (password) => {
    if (!password) return { pct: 0, label: '', color: '', textColor: '' };
    let s = 0;
    if (password.length >= 8) s++; if (/[a-z]/.test(password)) s++; if (/[A-Z]/.test(password)) s++; if (/[0-9]/.test(password)) s++; if (/[^a-zA-Z0-9]/.test(password)) s++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];
    const textColors = ['', 'text-red-600', 'text-orange-600', 'text-yellow-600', 'text-emerald-600', 'text-emerald-700'];
    return { pct: (s / 5) * 100, label: labels[s], color: colors[s], textColor: textColors[s] };
  };
  const pwStrength = getPwStrength(formData.newPassword);
  const stepLabels = ['', 'Email', 'Verify OTP', 'New Password'];

  return (
    <AuthLayout background="light" leftColumn={<IllustrationPanel />}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="w-full text-center mb-4" style={{ maxWidth: 420 }}>
        <div
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] mb-3"
          style={{
            width: 'clamp(44px, 4.5vw, 56px)',
            height: 'clamp(44px, 4.5vw, 56px)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.3)',
            animation: 'float 5s ease-in-out infinite',
          }}
        >
          <FiKey size={22} className="text-white" />
        </div>
        <h1 className="font-extrabold text-[#0F172A] mb-1" style={{ fontSize: 'clamp(20px, 2.3vw, 28px)' }}>
          {step === 4 ? 'Password Reset!' : 'Reset Password'}
        </h1>
        <p className="text-[#64748B] font-medium text-sm">
          {step === 1 && 'Enter your email to receive an OTP'}
          {step === 2 && 'Enter the OTP sent to your email'}
          {step === 3 && 'Create your new password'}
          {step === 4 && 'Your password has been reset successfully'}
        </p>
      </div>

      {/* ── Step Indicator ──────────────────────────────────────────── */}
      {step < 4 && (
        <div className="w-full flex items-center justify-between mb-4 px-2" style={{ maxWidth: 420 }}>
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex flex-col items-center gap-1.5 ${step >= s ? 'text-[#2563EB]' : 'text-[#94A3B8]'} w-[70px]`}>
                <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 transition-all duration-300 ${step > s ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]' : step === s ? 'border-[#2563EB] bg-white text-[#2563EB]' : 'border-[#E2E8F0] bg-white text-[#94A3B8]'}`}>
                  {step > s ? <FiCheckCircle size={13} /> : s}
                </div>
                <span className={`text-[10px] font-bold text-center uppercase tracking-wide ${step === s ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>{stepLabels[s]}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 mb-4 ${step > s ? 'bg-[#2563EB]' : 'bg-[#E2E8F0]'}`} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── Form Card ───────────────────────────────────────────────── */}
      <div
        className="w-full bg-white/90 backdrop-blur-xl border border-[#E2E8F0] rounded-[22px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] transition-shadow duration-300 overflow-hidden"
        style={{ maxWidth: 420 }}
      >
        {/* Card Header Banner */}
        <div className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
            <FiShield size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Secure Password Reset</p>
            <p className="text-xs text-blue-100 font-medium mt-0.5">
              {step === 1 && 'Verify your email address'}
              {step === 2 && `OTP sent to ${maskedEmail}`}
              {step === 3 && 'Create your new password'}
              {step === 4 && 'All done!'}
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6">
          {error   && <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium"><span className="text-red-500 font-bold">⚠</span>{error}</div>}
          {success && <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium"><FiCheckCircle size={15} className="text-emerald-500" />{success}</div>}

          {/* Step 1 — Email */}
          {step === 1 && (
            <form onSubmit={handleRequestOTP} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative group">
                  <FiMail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#2563EB] transition-colors" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl py-3 pl-10 pr-4 text-sm font-medium placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all shadow-sm"
                    placeholder="Enter your registered email" required autoFocus />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white font-bold rounded-xl shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none transition-all">
                {loading ? <><Spinner size="sm" color="white" /> Sending…</> : <><FiSend size={15} /> Send OTP</>}
              </button>
              <div className="text-center">
                <Link to="/employee/login" className="inline-flex items-center gap-1.5 text-sm text-[#2563EB] hover:text-[#1D4ED8] font-bold hover:underline underline-offset-4 transition-all">
                  <FiArrowLeft size={13} /> Back to Login
                </Link>
              </div>
            </form>
          )}

          {/* Step 2 — OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div className="flex items-start gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center flex-shrink-0"><FiMail size={13} /></div>
                <div>
                  <p className="text-xs font-bold text-[#64748B]">OTP sent to:</p>
                  <p className="text-sm font-extrabold text-[#0F172A]">{maskedEmail}</p>
                  <p className="text-xs font-semibold text-[#2563EB] mt-0.5 flex items-center gap-1"><FiClock size={11}/> Valid for {expiryMinutes} minutes</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5 text-center">Enter 6-Digit OTP</label>
                <input type="text" name="otp" value={formData.otp} onChange={handleChange}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl py-4 text-center text-3xl font-mono font-bold tracking-[0.5em] placeholder:text-[#CBD5E1] placeholder:tracking-normal focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all shadow-inner"
                  placeholder="000000" maxLength="6" required autoFocus />
                <div className="mt-2 text-center">
                  <button type="button" onClick={handleResendOTP} disabled={countdown > 0 || loading}
                    className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] disabled:text-[#94A3B8] hover:underline underline-offset-2 transition-all">
                    {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 text-sm font-bold text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] shadow-sm transition-colors">Back</button>
                <button type="submit" disabled={loading} className="flex-[2] flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white font-bold rounded-xl shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 disabled:opacity-50 transition-all">
                  {loading ? <><Spinner size="sm" color="white" /> Verifying…</> : <><FiCheckCircle size={15} /> Verify OTP</>}
                </button>
              </div>
            </form>
          )}

          {/* Step 3 — New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {[['new', 'New Password'], ['confirm', 'Confirm New Password']].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">{label}</label>
                  <div className="relative group">
                    <FiLock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#2563EB] transition-colors" />
                    <input
                      type={showPasswords[field] ? 'text' : 'password'}
                      name={field === 'new' ? 'newPassword' : 'confirmNewPassword'}
                      value={field === 'new' ? formData.newPassword : formData.confirmNewPassword}
                      onChange={handleChange}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl py-3 pl-10 pr-11 text-sm font-medium placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all shadow-sm"
                      placeholder={field === 'new' ? 'Enter new password' : 'Confirm new password'} required autoFocus={field === 'new'} />
                    <button type="button" onClick={() => toggleShow(field)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1 rounded-md hover:bg-[#E2E8F0]">
                      {showPasswords[field] ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                    </button>
                  </div>
                  {field === 'new' && formData.newPassword && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1"><span className="text-[#64748B] font-semibold">Strength:</span><span className={`font-bold ${pwStrength.textColor}`}>{pwStrength.label}</span></div>
                      <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden shadow-inner"><div className={`${pwStrength.color} h-full rounded-full transition-all duration-500 ease-out`} style={{ width: `${pwStrength.pct}%` }} /></div>
                    </div>
                  )}
                </div>
              ))}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-[#0F172A] mb-2 uppercase tracking-wider">Requirements</p>
                <PwReq met={formData.newPassword.length >= 8}          label="At least 8 characters" />
                <PwReq met={/[A-Z]/.test(formData.newPassword)}        label="One uppercase letter" />
                <PwReq met={/[a-z]/.test(formData.newPassword)}        label="One lowercase letter" />
                <PwReq met={/[0-9]/.test(formData.newPassword)}        label="One number" />
                <PwReq met={/[^a-zA-Z0-9]/.test(formData.newPassword)} label="One special character" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white font-bold rounded-xl shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 disabled:opacity-50 transition-all">
                {loading ? <><Spinner size="sm" color="white" /> Resetting…</> : <><FiCheckCircle size={15} /> Reset Password</>}
              </button>
            </form>
          )}

          {/* Step 4 — Success */}
          {step === 4 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(16,185,129,0.3)] animate-float">
                <FiCheckCircle size={34} />
              </div>
              <h3 className="text-xl font-extrabold text-[#0F172A] mb-2">Success!</h3>
              <p className="text-sm text-[#64748B] font-medium mb-6">Your password has been reset. You can now log in to your account.</p>
              <button onClick={() => navigate('/employee/login')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white font-bold rounded-xl shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 transition-all">
                <FiArrowLeft size={15} /> Return to Login
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs font-semibold text-[#94A3B8] mt-5">
        © {new Date().getFullYear()} AttendNest. All rights reserved.
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
