import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminLogin } from '../services/api';
import { FiShield, FiLock, FiEye, FiEyeOff, FiLogIn, FiUser, FiActivity, FiCpu, FiTerminal } from 'react-icons/fi';
import { Spinner } from '../components/Loader';
import AuthLayout from '../components/AuthLayout';

/* ─── Cyber illustration panel ───────────────────────────────────────── */
const IllustrationPanel = () => (
  <div className="flex flex-col justify-center items-center w-full">
    {/* Main floating illustration */}
    <div
      className="relative animate-float"
      style={{
        width: 'clamp(200px, 22vw, 300px)',
        height: 'clamp(200px, 22vw, 300px)',
        animationDuration: '7s',
      }}
    >
      {/* Core Glow */}
      <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-3xl scale-110" />

      {/* Server Rack SVG */}
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="50" y="30" width="100" height="140" rx="8" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="4" />
        <g className="animate-pulse" style={{ animationDuration: '3s' }}>
          <rect x="60" y="50" width="80" height="20" rx="4" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2" />
          <circle cx="75" cy="60" r="4" fill="#3B82F6" />
          <rect x="90" y="58" width="40" height="4" rx="2" fill="#3B82F6" opacity="0.5" />
        </g>
        <g className="animate-pulse" style={{ animationDuration: '4s' }}>
          <rect x="60" y="80" width="80" height="20" rx="4" fill="#FFFFFF" stroke="#10B981" strokeWidth="2" />
          <circle cx="75" cy="90" r="4" fill="#10B981" />
          <rect x="90" y="88" width="40" height="4" rx="2" fill="#10B981" opacity="0.5" />
        </g>
        <g className="animate-pulse" style={{ animationDuration: '2.5s' }}>
          <rect x="60" y="110" width="80" height="20" rx="4" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="2" />
          <circle cx="75" cy="120" r="4" fill="#8B5CF6" />
          <rect x="90" y="118" width="40" height="4" rx="2" fill="#8B5CF6" opacity="0.5" />
        </g>
        <path d="M150 60 L180 60 M150 90 L170 90 M150 120 L190 120" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
      </svg>

      {/* Rotating Shield */}
      <div className="absolute -top-5 -right-5 animate-float" style={{ width: 'clamp(52px,5.5vw,84px)', height: 'clamp(52px,5.5vw,84px)', animationDelay: '1.5s' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10 L85 25 V50 C85 75 50 95 50 95 C50 95 15 75 15 50 V25 L50 10 Z" fill="#F8FAFC" stroke="#3B82F6" strokeWidth="4" />
          <path d="M35 45 L45 55 L65 35" stroke="#10B981" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Data Chart */}
      <div className="absolute -bottom-6 -left-6 animate-float" style={{ width: 'clamp(52px,5.5vw,84px)', height: 'clamp(52px,5.5vw,84px)', animationDuration: '5s', animationDelay: '0.2s' }}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
          <rect x="10" y="20" width="80" height="60" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
          <path d="M20 60 L40 40 L55 50 L80 25" stroke="#8B5CF6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="40" cy="40" r="3" fill="#8B5CF6" />
          <circle cx="55" cy="50" r="3" fill="#8B5CF6" />
          <circle cx="80" cy="25" r="3" fill="#8B5CF6" />
        </svg>
      </div>

      {/* Cyber nodes */}
      <div className="absolute top-14 -left-10 w-5 h-5 text-cyan-400 animate-ping" style={{ animationDuration: '3s' }}>
        <div className="w-full h-full bg-cyan-400 rounded-full blur-[2px]" />
      </div>
      <div className="absolute bottom-14 -right-5 w-3 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDuration: '2s' }}>
        <div className="absolute inset-0 bg-purple-400 rounded-full blur-md" />
      </div>
    </div>

    {/* Text + Feature Cards */}
    <div className="mt-6 text-center w-full" style={{ maxWidth: 'clamp(260px, 28vw, 400px)' }}>
      <h2 className="font-bold text-slate-900 leading-tight mb-2" style={{ fontSize: 'clamp(15px, 1.6vw, 22px)' }}>
        System Control{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Center</span>
      </h2>
      <p className="text-slate-500" style={{ fontSize: 'clamp(10px, 1vw, 13px)' }}>
        Manage employees, monitor attendance, review trusted devices and configure security.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { icon: <FiCpu size={13} className="text-blue-600 mb-1" />, title: 'Device Mgmt', desc: 'Approve/Reject.', accent: 'bg-blue-50', hover: 'group-hover:bg-blue-100' },
          { icon: <FiActivity size={13} className="text-indigo-600 mb-1" />, title: 'Audit Logs', desc: 'Monitor systems.', accent: 'bg-indigo-50', hover: 'group-hover:bg-indigo-100' },
          { icon: <FiTerminal size={13} className="text-cyan-600 mb-1" />, title: 'Access Guard', desc: 'Security layers.', accent: 'bg-cyan-50', hover: 'group-hover:bg-cyan-100' },
        ].map(card => (
          <div key={card.title} className="bg-white border border-slate-200 shadow-sm rounded-xl p-2 text-left group hover:-translate-y-0.5 transition-all relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-9 h-9 ${card.accent} rounded-bl-full ${card.hover} transition-colors`} />
            {card.icon}
            <h4 className="text-[9px] font-bold text-slate-800 leading-tight">{card.title}</h4>
            <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────── */
const AdminLogin = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => {
    setFormData(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await adminLogin({ username: formData.username, password: formData.password });
      if (response.data.success) {
        login(response.data.user, response.data.token);
        
        const user = response.data.user;
        let fallbackPage = '/admin/dashboard';
        
        if (!user.is_super_admin && user.role !== 'super_admin' && user.permissions) {
          if (!user.permissions['dashboard']?.can_view) {
            const pages = Object.keys(user.permissions);
            const firstAllowed = pages.find(p => user.permissions[p]?.can_view);
            if (firstAllowed) {
              if (firstAllowed === 'manual_attendance') fallbackPage = '/admin/manual-attendance';
              else if (firstAllowed === 'admin_management') fallbackPage = '/admin/manage-admins';
              else if (firstAllowed === 'absent_reasons') fallbackPage = '/admin/settings/absent-reasons';
              else if (firstAllowed === 'trusted_devices') fallbackPage = '/admin/settings/trusted-devices';
              else if (firstAllowed === 'database_monitor') fallbackPage = '/admin/database-monitor';
              else if (firstAllowed === 'activity_logs') fallbackPage = '/admin/logs';
              else if (firstAllowed === 'security_logs') fallbackPage = '/admin/security-logs';
              else if (firstAllowed === 'otp_settings') fallbackPage = '/admin/settings/otp';
              else fallbackPage = `/admin/${firstAllowed}`;
            }
          }
        }
        navigate(fallbackPage);
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
          className="inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 mb-3 relative group shadow-sm"
          style={{
            width: 'clamp(44px, 4.5vw, 56px)',
            height: 'clamp(44px, 4.5vw, 56px)',
            animation: 'float 5s ease-in-out infinite',
          }}
        >
          <div className="absolute inset-0 bg-blue-50 rounded-2xl blur-lg transition-colors group-hover:bg-blue-100" />
          <FiShield size={22} className="text-blue-600 relative z-10" />
        </div>
        <h1 className="font-extrabold text-slate-800 mb-1" style={{ fontSize: 'clamp(20px, 2.4vw, 28px)' }}>
          Admin Authorization
        </h1>
        <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">Identify Yourself</p>
      </div>

      {/* ── Form Card ───────────────────────────────────────────────── */}
      <div
        className="w-full bg-white border border-slate-200 rounded-[22px] shadow-lg transition-shadow duration-300 overflow-hidden"
        style={{ maxWidth: 420 }}
      >
        {/* Top gradient stripe */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />

        <div className="p-6 pt-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm font-medium">
              <FiShield size={15} className="text-red-400 flex-shrink-0" />
              <span className="text-red-300 font-bold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
              <div className="relative group">
                <FiUser size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text" name="username" value={formData.username} onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 pl-10 pr-4 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                  placeholder="Enter admin ID" required autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Secure Password</label>
              <div className="relative group">
                <FiLock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3 pl-10 pr-11 text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm tracking-wide"
                  placeholder="••••••••••••" required
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-md hover:bg-slate-100">
                  {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-[0_8px_20px_-6px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(59,130,246,0.6)] disabled:opacity-50 disabled:transform-none transition-all">
              {loading ? <><Spinner size={15} color="white" /> Authenticating…</> : <><FiLogIn size={15} /> Secure Sign In</>}
            </button>
          </form>

          {/* Secure Footer */}
          <div className="mt-6 flex items-center justify-center gap-2 pt-5 border-t border-slate-200">
            <FiShield size={13} className="text-emerald-500" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">End-to-end encrypted connection</p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default AdminLogin;
