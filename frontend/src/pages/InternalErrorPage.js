import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiRefreshCw, FiHome, FiAlertTriangle } from 'react-icons/fi';
import axios from 'axios';

const InternalErrorPage = ({ onRetry, errorDetails }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRetry = async () => {
    setChecking(true);
    setErrorMessage('');

    if (onRetry) {
      await onRetry();
      setChecking(false);
      return;
    }

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const res = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      if (res.status === 200) {
        window.location.reload();
      } else {
        setErrorMessage('Server is still reporting an issue. Please try again shortly.');
        setChecking(false);
      }
    } catch (err) {
      setTimeout(() => {
        setErrorMessage('Server is still recovering. Please try again in a few moments.');
        setChecking(false);
      }, 600);
    }
  };

  const handleGoHome = () => {
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
          
          {/* Left Column: 500 Number, Heading, Subtext & Actions */}
          <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
            <span className="text-6xl xs:text-7xl sm:text-8xl md:text-8xl lg:text-9xl font-black text-[#2563EB] tracking-tight leading-none mb-2 sm:mb-3 drop-shadow-sm">
              500
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-2.5 sm:mb-3">
              Internal Server Error
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#64748B] font-normal leading-relaxed mb-6 sm:mb-8 max-w-md">
              Oops! Something went wrong on our servers. We're working on fixing the issue right away.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={handleRetry}
                disabled={checking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-blue-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
              >
                <FiRefreshCw className={`text-base ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Checking Server...' : 'Try Again'}</span>
              </button>

              <button
                onClick={handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-[#334155] font-semibold text-sm border border-slate-200 shadow-sm hover:shadow transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px]"
              >
                <FiHome className="text-base" />
                <span>Go Home</span>
              </button>
            </div>

            {errorMessage && (
              <p className="mt-3 text-xs text-red-500 animate-fadeIn">
                {errorMessage}
              </p>
            )}
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

              {/* Custom SVG Illustration: Server Stack with Broken Circuit / Gears */}
              <svg className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 z-10 filter drop-shadow-xl" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Server Cloud Platform */}
                <ellipse cx="100" cy="155" rx="60" ry="14" fill="#DBEAFE" opacity="0.7" />
                
                {/* Main Server Tower / Frame */}
                <rect x="52" y="45" width="96" height="100" rx="16" fill="white" stroke="#BFDBFE" strokeWidth="3" />
                
                {/* Top Section */}
                <rect x="62" y="58" width="76" height="22" rx="6" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1.5" />
                <circle cx="74" cy="69" r="3.5" fill="#2563EB" />
                <circle cx="86" cy="69" r="3.5" fill="#38BDF8" />
                <line x1="102" y1="69" x2="128" y2="69" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" />

                {/* Middle Server Section with Alert Indicator */}
                <rect x="62" y="88" width="76" height="22" rx="6" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1.5" />
                <circle cx="74" cy="99" r="3.5" fill="#2563EB" />
                <circle cx="86" cy="99" r="3.5" fill="#EF4444" />
                <line x1="102" y1="99" x2="128" y2="99" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3" />

                {/* Bottom Section */}
                <rect x="62" y="118" width="76" height="18" rx="5" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1.5" />
                <circle cx="74" cy="127" r="3" fill="#94A3B8" />
                <circle cx="86" cy="127" r="3" fill="#94A3B8" />

                {/* Floating Warning Badge with Exclamation */}
                <g filter="drop-shadow(0px 4px 10px rgba(239, 68, 68, 0.35))">
                  <circle cx="146" cy="62" r="22" fill="#EF4444" stroke="white" strokeWidth="3.5" />
                  <path d="M146 51V64" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="146" cy="72" r="2" fill="white" />
                </g>

                {/* Glitch lightning spark */}
                <path d="M46 95L54 84H48L55 72" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

        </div>

        {/* Bottom Callout Card */}
        <div className="w-full max-w-2xl bg-[#F0F7FF] border border-[#D0E3FF] rounded-2xl p-3.5 sm:p-5 flex flex-col xs:flex-row items-center gap-3 sm:gap-3.5 shadow-sm text-xs sm:text-sm text-[#475569] text-center xs:text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[#2563EB]">
            <FiAlertTriangle className="text-base sm:text-lg" />
          </div>
          <p className="leading-relaxed">
            Our engineering team has been notified. If this issue continues, try returning to the{' '}
            <Link to="/" className="text-[#2563EB] font-semibold hover:underline">
              homepage
            </Link>
            {' '}or contact support.
          </p>
        </div>

      </div>
    </div>
  );
};

export default InternalErrorPage;
