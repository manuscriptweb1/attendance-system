import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiHome, FiTool, FiActivity } from 'react-icons/fi';
import axios from 'axios';

const MaintenanceModePage = ({ onRetry }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusMessage('');

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
        setStatusMessage('Maintenance is still in progress. Please check back in a few moments.');
        setChecking(false);
      }
    } catch (err) {
      setTimeout(() => {
        setStatusMessage('Maintenance is still active. We will be back online very soon.');
        setChecking(false);
      }, 700);
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
          
          {/* Left Column: Heading, Subtext & Actions */}
          <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-[#2563EB] mb-3 sm:mb-4">
              <FiActivity className="text-xs" /> Scheduled Upgrade
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-2.5 sm:mb-3">
              System Maintenance
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#64748B] font-normal leading-relaxed mb-6 sm:mb-8 max-w-md">
              We're currently performing scheduled platform maintenance to improve speed and reliability. We'll be back online shortly.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-blue-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
              >
                <FiRefreshCw className={`text-base ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Checking Status...' : 'Check Status / Refresh'}</span>
              </button>

              <button
                onClick={handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-[#334155] font-semibold text-sm border border-slate-200 shadow-sm hover:shadow transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px]"
              >
                <FiHome className="text-base" />
                <span>Go Home</span>
              </button>
            </div>

            {statusMessage && (
              <p className="mt-3.5 text-xs text-blue-600 font-medium animate-fadeIn">
                {statusMessage}
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

              {/* Custom SVG Illustration: Mechanical Cog Gears & Wrench Tool */}
              <svg className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 z-10 filter drop-shadow-xl" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Large Background Gear */}
                <g opacity="0.85">
                  <path
                    d="M100 62C102.2 62 104 63.8 104 66V71.2C108.6 72.4 112.8 74.5 116.6 77.2L120.4 73.4C122 71.8 124.6 71.8 126.2 73.4L131.8 79C133.4 80.6 133.4 83.2 131.8 84.8L128 88.6C130.7 92.4 132.8 96.6 134 101.2H139.2C141.4 101.2 143.2 103 143.2 105.2V113.2C143.2 115.4 141.4 117.2 139.2 117.2H134C132.8 121.8 130.7 126 128 129.8L131.8 133.6C133.4 135.2 133.4 137.8 131.8 139.4L126.2 145C124.6 146.6 122 146.6 120.4 145L116.6 141.2C112.8 143.9 108.6 146 104 147.2V152.4C104 154.6 102.2 156.4 100 156.4H92C89.8 156.4 88 154.6 88 152.4V147.2C83.4 146 79.2 143.9 75.4 141.2L71.6 145C70 146.6 67.4 146.6 65.8 145L60.2 139.4C58.6 137.8 58.6 135.2 60.2 133.6L64 129.8C61.3 126 59.2 121.8 58 117.2H52.8C50.6 117.2 48.8 115.4 48.8 113.2V105.2C48.8 103 50.6 101.2 52.8 101.2H58C59.2 96.6 61.3 92.4 64 88.6L60.2 84.8C58.6 83.2 58.6 80.6 60.2 79L65.8 73.4C67.4 71.8 70 71.8 71.6 73.4L75.4 77.2C79.2 74.5 83.4 72.4 88 71.2V66C88 63.8 89.8 62 92 62H100Z"
                    fill="#DBEAFE"
                    stroke="#93C5FD"
                    strokeWidth="3"
                  />
                  <circle cx="96" cy="109" r="18" fill="white" stroke="#3B82F6" strokeWidth="4" />
                </g>

                {/* Primary Wrench Tool */}
                <g transform="rotate(-30 115 95)" filter="drop-shadow(0px 4px 10px rgba(37, 99, 235, 0.25))">
                  {/* Wrench Shaft */}
                  <rect x="110" y="45" width="14" height="75" rx="7" fill="#2563EB" />
                  {/* Wrench Open Jaw Head */}
                  <path d="M103 48C103 36 113 28 123 28C133 28 143 36 143 48C143 56 137 62 131 65V54H115V65C109 62 103 56 103 48Z" fill="#3B82F6" />
                  {/* Wrench Ring Head Bottom */}
                  <circle cx="117" cy="120" r="12" fill="#3B82F6" />
                  <circle cx="117" cy="120" r="6" fill="white" />
                </g>

                {/* Floating Amber Maintenance Cone / Badge (Bottom Right) */}
                <g filter="drop-shadow(0px 4px 10px rgba(245, 158, 11, 0.35))">
                  <circle cx="146" cy="144" r="20" fill="#F59E0B" stroke="white" strokeWidth="3.5" />
                  <path d="M146 133L153 147H139L146 133Z" fill="white" />
                  <line x1="146" y1="151" x2="146" y2="153" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </svg>
            </div>
          </div>

        </div>

        {/* Bottom Callout Card */}
        <div className="w-full max-w-2xl bg-[#F0F7FF] border border-[#D0E3FF] rounded-2xl p-3.5 sm:p-5 flex flex-col xs:flex-row items-center gap-3 sm:gap-3.5 shadow-sm text-xs sm:text-sm text-[#475569] text-center xs:text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[#2563EB]">
            <FiTool className="text-base sm:text-lg" />
          </div>
          <p className="leading-relaxed">
            All user data and attendance records are securely stored. Thank you for your patience while we complete this upgrade.
          </p>
        </div>

      </div>
    </div>
  );
};

export default MaintenanceModePage;
