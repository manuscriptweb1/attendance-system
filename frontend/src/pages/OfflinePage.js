import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiHome, FiWifi } from 'react-icons/fi';

const OfflinePage = ({ onRetry }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    if (onRetry) {
      await onRetry();
    } else {
      // Test connectivity
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setTimeout(() => {
          setChecking(false);
        }, 800);
      }
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
          
          {/* Left Column: Illustration */}
          <div className="md:col-span-6 flex justify-center items-center">
            <div className="relative w-48 h-48 xs:w-56 xs:h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center">
              
              {/* Soft circular glowing bubble */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/80 via-sky-50 to-indigo-50/60 rounded-full shadow-inner blur-sm" />

              {/* Decorative mini sparkles */}
              <span className="absolute top-4 left-6 text-blue-300 text-xs sm:text-sm">✦</span>
              <span className="absolute top-8 right-6 text-blue-200 text-xs">●</span>
              <span className="absolute bottom-6 left-8 text-blue-300 text-xs">✦</span>

              {/* Custom SVG Illustration: WiFi with Slash & Cross Badge */}
              <svg className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 z-10 filter drop-shadow-xl" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background soft glow for WiFi */}
                <circle cx="100" cy="100" r="70" fill="#EFF6FF" opacity="0.5" />

                {/* WiFi Wave 3 (Outer) */}
                <path d="M48 68C76.7188 43.5 123.281 43.5 152 68" stroke="#93C5FD" strokeWidth="10" strokeLinecap="round" opacity="0.6" />

                {/* WiFi Wave 2 (Middle) */}
                <path d="M68 90C85.6761 74.5 114.324 74.5 132 90" stroke="#60A5FA" strokeWidth="10" strokeLinecap="round" />

                {/* WiFi Wave 1 (Inner) */}
                <path d="M86 114C93.8561 106.5 106.144 106.5 114 114" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />

                {/* Center WiFi Dot */}
                <circle cx="100" cy="138" r="7" fill="#2563EB" />

                {/* Bold Diagonal Slash Line */}
                <line x1="56" y1="52" x2="144" y2="148" stroke="#3B82F6" strokeWidth="8" strokeLinecap="round" />

                {/* Blue Circle Badge with Cross (Bottom Right) */}
                <circle cx="148" cy="142" r="18" fill="#2563EB" stroke="white" strokeWidth="3" className="drop-shadow-md" />
                <path d="M141 135L155 149M155 135L141 149" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Right Column: Text & Actions */}
          <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-2.5 sm:mb-3">
              No Internet Connection
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#64748B] font-normal leading-relaxed mb-6 sm:mb-8 max-w-md">
              Looks like you're not connected to the internet. Please check your connection and try again.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={handleRetry}
                disabled={checking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-blue-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
              >
                <FiRefreshCw className={`text-base ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Checking...' : 'Try Again'}</span>
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

        </div>

        {/* Bottom Callout Card */}
        <div className="w-full max-w-2xl bg-[#F0F7FF] border border-[#D0E3FF] rounded-2xl p-3.5 sm:p-5 flex flex-col xs:flex-row items-center gap-3 sm:gap-3.5 shadow-sm text-xs sm:text-sm text-[#475569] text-center xs:text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[#2563EB]">
            <FiWifi className="text-base sm:text-lg" />
          </div>
          <p className="leading-relaxed">
            Check your internet connection and try again. If the problem persists, contact your network administrator.
          </p>
        </div>

      </div>
    </div>
  );
};

export default OfflinePage;
