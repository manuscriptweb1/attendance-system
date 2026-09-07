import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiLogIn, FiHome, FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const SessionExpiredPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout } = useAuth();

  const handleSignInAgain = () => {
    // Clear existing session tokens & states
    if (logout) {
      logout();
    } else {
      sessionStorage.clear();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    const redirectPath = searchParams.get('redirect') || '';
    const userType = searchParams.get('type') || '';

    if (redirectPath.startsWith('/admin') || userType === 'admin') {
      navigate('/admin/login');
    } else if (redirectPath.startsWith('/employee') || userType === 'employee') {
      navigate('/employee/login');
    } else {
      // Default to landing page or admin login based on current path
      navigate('/admin/login');
    }
  };

  const handleGoHome = () => {
    if (logout) logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FAFCFF] via-[#F8FAFC] to-[#F1F5F9] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative overflow-hidden font-sans select-none">
      
      {/* Ambient background decoration blobs */}
      <div className="absolute -top-24 -left-24 sm:-top-32 sm:-left-32 w-72 h-72 sm:w-96 sm:h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 sm:-bottom-32 sm:-right-32 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-48 h-48 sm:w-64 sm:h-64 bg-sky-100/30 rounded-full blur-2xl pointer-events-none" />

      {/* Decorative scattered dots & sparkles */}
      <span className="absolute top-12 left-[10%] sm:top-24 sm:left-[15%] text-blue-300/40 text-lg sm:text-xl font-light pointer-events-none">✦</span>
      <span className="absolute top-20 right-[12%] sm:top-36 sm:right-[20%] text-blue-300/50 text-xl sm:text-2xl font-light pointer-events-none">✦</span>
      <span className="absolute bottom-16 left-[15%] sm:bottom-28 sm:left-[22%] text-blue-200/50 text-base sm:text-lg pointer-events-none">●</span>
      <span className="absolute bottom-20 right-[10%] sm:bottom-36 sm:right-[16%] text-blue-300/40 text-lg sm:text-xl pointer-events-none">✦</span>

      <div className="w-full max-w-4xl mx-auto flex flex-col items-center z-10">
        
        {/* Main 2-Column Content Card (Stacks on mobile/tablet, side-by-side on desktop) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center mb-8 sm:mb-10">
          
          {/* Left Column: Text & Actions */}
          <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-[#2563EB] mb-3 sm:mb-4">
              <FiLock className="text-xs" /> Security Timeout
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-2.5 sm:mb-3">
              Session Expired
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#64748B] font-normal leading-relaxed mb-6 sm:mb-8 max-w-md">
              Your login session has timed out due to inactivity or expired credentials. Please sign in again to continue.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={handleSignInAgain}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px]"
              >
                <FiLogIn className="text-base" />
                <span>Sign In Again</span>
              </button>

              <button
                onClick={handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-[#334155] font-semibold text-sm border border-slate-200 shadow-sm hover:shadow transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px]"
              >
                <FiHome className="text-base" />
                <span>Go Home</span>
              </button>
            </div>
          </div>

          {/* Right Column: Illustration */}
          <div className="md:col-span-6 flex justify-center items-center order-1 md:order-2">
            <div className="relative w-48 h-48 xs:w-56 xs:h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center">
              
              {/* Soft circular glowing bubble */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/80 via-sky-50 to-indigo-50/60 rounded-full shadow-inner blur-sm" />

              {/* Decorative mini sparkles */}
              <span className="absolute top-4 left-6 text-blue-300 text-xs sm:text-sm">✦</span>
              <span className="absolute top-8 right-6 text-blue-200 text-xs">●</span>
              <span className="absolute bottom-6 left-8 text-blue-300 text-xs">✦</span>

              {/* Custom SVG Illustration: Lock with Orbital Clock Timer */}
              <svg className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 z-10 filter drop-shadow-xl" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Orbital Timer Ring Outer */}
                <circle cx="100" cy="100" r="76" stroke="#DBEAFE" strokeWidth="3" strokeDasharray="6 6" />
                
                {/* Orbital Progress Arc */}
                <path d="M100 24C141.974 24 176 58.0264 176 100" stroke="#3B82F6" strokeWidth="4.5" strokeLinecap="round" />

                {/* Clock Hour Markers */}
                <circle cx="100" cy="24" r="3.5" fill="#2563EB" />
                <circle cx="176" cy="100" r="3.5" fill="#2563EB" />
                <circle cx="100" cy="176" r="3" fill="#93C5FD" />
                <circle cx="24" cy="100" r="3" fill="#93C5FD" />

                {/* Main Padlock Shackle */}
                <path d="M72 86V64C72 48.536 84.536 36 100 36C115.464 36 128 48.536 128 64V86" stroke="#93C5FD" strokeWidth="10" strokeLinecap="round" />
                
                {/* Main Padlock Body */}
                <rect x="56" y="82" width="88" height="74" rx="18" fill="white" stroke="#BFDBFE" strokeWidth="3" />
                <rect x="64" y="90" width="72" height="58" rx="12" fill="#EFF6FF" />

                {/* Keyhole */}
                <circle cx="100" cy="112" r="7" fill="#2563EB" />
                <path d="M96 114L94 130H106L104 114" fill="#2563EB" />

                {/* Clock Time Badge (Bottom Right) */}
                <g filter="drop-shadow(0px 4px 10px rgba(37, 99, 235, 0.3))">
                  <circle cx="146" cy="144" r="22" fill="#2563EB" stroke="white" strokeWidth="3.5" />
                  {/* Clock Hands */}
                  <line x1="146" y1="144" x2="146" y2="134" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  <line x1="146" y1="144" x2="154" y2="144" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="146" cy="144" r="2.5" fill="white" />
                </g>
              </svg>
            </div>
          </div>

        </div>

        {/* Bottom Callout Card */}
        <div className="w-full max-w-2xl bg-[#F0F7FF] border border-[#D0E3FF] rounded-2xl p-3.5 sm:p-5 flex flex-col xs:flex-row items-center gap-3 sm:gap-3.5 shadow-sm text-xs sm:text-sm text-[#475569] text-center xs:text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[#2563EB]">
            <FiLock className="text-base sm:text-lg" />
          </div>
          <p className="leading-relaxed">
            For security and privacy, active sessions automatically expire after a period of inactivity. Please sign in with your credentials to resume.
          </p>
        </div>

      </div>
    </div>
  );
};

export default SessionExpiredPage;
