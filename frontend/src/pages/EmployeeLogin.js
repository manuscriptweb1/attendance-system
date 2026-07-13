import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { employeeLogin } from '../services/api';
import { FiUser, FiLock, FiEye, FiEyeOff, FiLogIn, FiCalendar, FiClock, FiCheckCircle } from 'react-icons/fi';
import { Spinner } from '../components/Loader';
import AuthLayout from '../components/AuthLayout';

/* ─── Compact illustration sizes for laptops ─────────────────────────── */
const IllustrationPanel = () => (
  <div className="flex flex-col justify-center items-center w-full">
    {/* Main floating illustration */}
    <div
      className="relative animate-float"
      style={{
        width: 'clamp(200px, 22vw, 300px)',
        height: 'clamp(200px, 22vw, 300px)',
        animationDuration: '6s',
      }}
    >
      {/* Background Glow */}
      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl scale-125" />

      {/* Dashboard UI SVG */}
      <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-2xl relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="20" width="180" height="120" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
        <rect x="10" y="20" width="180" height="24" rx="12" fill="#F1F5F9" />
        <circle cx="25" cy="32" r="3" fill="#EF4444" />
        <circle cx="35" cy="32" r="3" fill="#F59E0B" />
        <circle cx="45" cy="32" r="3" fill="#10B981" />
        <rect x="25" y="60" width="60" height="6" rx="3" fill="#E2E8F0" />
        <rect x="25" y="75" width="40" height="6" rx="3" fill="#E2E8F0" />
        <g className="animate-pulse" style={{ animationDuration: '4s' }}>
          <rect x="100" y="90" width="12" height="30" rx="2" fill="#3B82F6" />
          <rect x="120" y="70" width="12" height="50" rx="2" fill="#7C3AED" />
          <rect x="140" y="100" width="12" height="20" rx="2" fill="#10B981" />
        </g>
        <circle cx="160" cy="32" r="6" fill="#94A3B8" />
        <rect x="25" y="100" width="50" height="20" rx="4" fill="#DBEAFE" />
      </svg>

      {/* Floating Clock */}
      <div className="absolute -bottom-5 -right-5 animate-float" style={{ width: 'clamp(52px,5.5vw,84px)', height: 'clamp(52px,5.5vw,84px)', animationDelay: '1s' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" fill="#2563EB" />
          <circle cx="50" cy="50" r="30" fill="#FFFFFF" />
          <path d="M50 35 V50 L60 60" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="50" cy="50" r="4" fill="#0F172A" />
        </svg>
      </div>

      {/* Floating Calendar */}
      <div className="absolute -top-8 -left-8 animate-float" style={{ width: 'clamp(44px,4.5vw,68px)', height: 'clamp(44px,4.5vw,68px)', animationDuration: '4s', animationDelay: '0.5s' }}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
          <rect x="20" y="30" width="60" height="50" rx="8" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="4" />
          <rect x="20" y="30" width="60" height="20" rx="8" fill="#EF4444" />
          <rect x="35" y="20" width="8" height="20" rx="4" fill="#64748B" />
          <rect x="55" y="20" width="8" height="20" rx="4" fill="#64748B" />
          <circle cx="50" cy="65" r="8" fill="#10B981" />
        </svg>
      </div>

      {/* Sparkle */}
      <div className="absolute top-8 -right-10 w-5 h-5 text-yellow-400 animate-ping" style={{ animationDuration: '3s' }}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" /></svg>
      </div>
    </div>

    {/* Text + Feature Cards */}
    <div className="mt-6 text-center w-full" style={{ maxWidth: 'clamp(260px, 28vw, 400px)' }}>
      <h2 className="font-bold text-[#0F172A] leading-tight mb-2" style={{ fontSize: 'clamp(15px, 1.6vw, 22px)' }}>
        Welcome to{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
          Manuscript Attendance
        </span>
      </h2>
      <p className="text-[#64748B]" style={{ fontSize: 'clamp(10px, 1vw, 13px)' }}>
        Your portal to track attendance, monitor hours, and manage daily activities seamlessly.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { icon: <FiCheckCircle size={13} className="text-blue-500 mb-1" />, title: 'Daily Check-In', desc: 'One-click secure sign-in.', accent: 'bg-blue-50', hover: 'group-hover:bg-blue-100' },
          { icon: <FiLock size={13} className="text-purple-500 mb-1" />, title: 'Trusted Devices', desc: 'Approved devices only.', accent: 'bg-purple-50', hover: 'group-hover:bg-purple-100' },
          { icon: <FiClock size={13} className="text-emerald-500 mb-1" />, title: 'Flexibility', desc: 'WFH & early checkout.', accent: 'bg-emerald-50', hover: 'group-hover:bg-emerald-100' },
        ].map(card => (
          <div key={card.title} className="bg-white/80 border border-[#E2E8F0] rounded-xl shadow-sm text-left p-2 group hover:-translate-y-0.5 transition-transform relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-9 h-9 ${card.accent} rounded-bl-full ${card.hover} transition-colors`} />
            {card.icon}
            <h4 className="text-[9px] font-bold text-[#0F172A] leading-tight">{card.title}</h4>
            <p className="text-[8px] text-[#64748B] mt-0.5 leading-tight">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────── */
const EmployeeLogin = () => {
  const [formData, setFormData] = useState({ employee_id: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await employeeLogin({ employee_id: formData.employee_id, password: formData.password });
      if (response.data.success) {
        login(response.data.user, response.data.token);
        navigate('/employee/dashboard');
      } else {
        setError(response.data.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout background="light" leftColumn={<IllustrationPanel />}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="w-full text-center mb-5" style={{ maxWidth: 420 }}>
        <div
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] mb-3"
          style={{
            width: 'clamp(44px, 4.5vw, 56px)',
            height: 'clamp(44px, 4.5vw, 56px)',
            boxShadow: '0 8px 24px rgba(37,99,235,0.3)',
            animation: 'float 5s ease-in-out infinite',
          }}
        >
          <FiCalendar size={22} className="text-white" />
        </div>
        <h1 className="font-extrabold text-[#0F172A] mb-1" style={{ fontSize: 'clamp(22px, 2.5vw, 30px)' }}>
          Employee Login
        </h1>
        <p className="text-[#64748B] font-medium text-sm">Access Your Account</p>
      </div>

      {/* ── Form Card ───────────────────────────────────────────────── */}
      <div
        className="w-full bg-white/90 backdrop-blur-xl border border-[#E2E8F0] rounded-[22px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] transition-shadow duration-300 overflow-hidden"
        style={{ maxWidth: 420 }}
      >
        {/* Top gradient stripe */}
        <div className="h-1 bg-gradient-to-r from-[#2563EB] to-[#7C3AED]" />

        <div className="p-6 pt-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
              <span className="text-red-500 font-bold">⚠</span>{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Employee ID</label>
              <div className="relative group">
                <FiUser size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#2563EB] transition-colors" />
                <input
                  type="text" name="employee_id" value={formData.employee_id} onChange={handleChange}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl py-3 pl-10 pr-4 text-sm font-medium placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all shadow-sm"
                  placeholder="e.g. EMP001" required autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative group">
                <FiLock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#2563EB] transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl py-3 pl-10 pr-11 text-sm font-medium placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all shadow-sm tracking-wide"
                  placeholder="••••••••••••" required
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1 rounded-md hover:bg-[#E2E8F0]">
                  {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline underline-offset-4 transition-all">
                Forgot Password?
              </Link>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] text-white font-bold rounded-xl shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.6)] disabled:opacity-50 disabled:transform-none transition-all">
              {loading ? <><Spinner size="sm" color="white" /> Authenticating…</> : <><FiLogIn size={15} /> Secure Sign In</>}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs font-semibold text-[#94A3B8] mt-5">
        © {new Date().getFullYear()} Manuscript Attendance. All rights reserved.
      </p>
    </AuthLayout>
  );
};

export default EmployeeLogin;
