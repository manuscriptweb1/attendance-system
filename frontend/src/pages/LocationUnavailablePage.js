import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiHome, FiMapPin, FiNavigation } from 'react-icons/fi';

const LocationUnavailablePage = ({ onRetry }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleEnableLocation = () => {
    setChecking(true);
    setStatusMessage('');
    setIsSuccess(false);

    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported by your browser.');
      setChecking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsSuccess(true);
        setStatusMessage('Location acquired successfully! Redirecting...');
        setChecking(false);
        if (onRetry) {
          onRetry(position);
        } else {
          setTimeout(() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/employee/dashboard');
            }
          }, 1200);
        }
      },
      (error) => {
        setChecking(false);
        if (error.code === error.PERMISSION_DENIED) {
          setStatusMessage('Location permission denied. Please allow location access in your browser settings.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setStatusMessage('GPS position is currently unavailable. Ensure device GPS is switched ON.');
        } else if (error.code === error.TIMEOUT) {
          setStatusMessage('Location request timed out. Please check your GPS signal and try again.');
        } else {
          setStatusMessage('Unable to retrieve location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
              <FiNavigation className="text-xs" /> Geolocation Required
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-2.5 sm:mb-3">
              GPS / Location Unavailable
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#64748B] font-normal leading-relaxed mb-6 sm:mb-8 max-w-md">
              We couldn't detect your current location. Accurate GPS location is required to verify attendance check-in.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={handleEnableLocation}
                disabled={checking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-blue-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
              >
                <FiRefreshCw className={`text-base ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Detecting Location...' : 'Enable Location / Try Again'}</span>
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
              <p className={`mt-3.5 text-xs font-medium ${isSuccess ? 'text-emerald-600' : 'text-red-500'} animate-fadeIn`}>
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

              {/* Custom SVG Illustration: Map Radar with Location Pin & Slash */}
              <svg className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 z-10 filter drop-shadow-xl" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Radar Grid Circles */}
                <circle cx="100" cy="110" r="68" stroke="#DBEAFE" strokeWidth="2.5" strokeDasharray="5 5" />
                <circle cx="100" cy="110" r="46" stroke="#BFDBFE" strokeWidth="2.5" />
                <circle cx="100" cy="110" r="24" stroke="#93C5FD" strokeWidth="2" opacity="0.6" />
                
                {/* Radar Crosshair lines */}
                <line x1="100" y1="42" x2="100" y2="178" stroke="#DBEAFE" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="32" y1="110" x2="168" y2="110" stroke="#DBEAFE" strokeWidth="2" strokeDasharray="4 4" />

                {/* Map Pin Shadow */}
                <ellipse cx="100" cy="148" rx="16" ry="6" fill="#93C5FD" opacity="0.4" />

                {/* Map Pin Body */}
                <path
                  d="M100 48C83.4315 48 70 61.4315 70 78C70 99 100 138 100 138C100 138 130 99 130 78C130 61.4315 116.569 48 100 48Z"
                  fill="#2563EB"
                />
                
                {/* Inner Pin Dot */}
                <circle cx="100" cy="78" r="11" fill="white" />
                <circle cx="100" cy="78" r="6" fill="#2563EB" />

                {/* Location Search Wave Pulse Arc */}
                <path d="M124 54C136 62 144 76 144 92" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                <path d="M136 42C152 54 162 72 162 92" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

                {/* Slash Alert Badge (Bottom Right) */}
                <g filter="drop-shadow(0px 4px 10px rgba(239, 68, 68, 0.35))">
                  <circle cx="146" cy="144" r="20" fill="#EF4444" stroke="white" strokeWidth="3.5" />
                  <path d="M139 137L153 151M153 137L139 151" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
                </g>
              </svg>
            </div>
          </div>

        </div>

        {/* Bottom Callout Card */}
        <div className="w-full max-w-2xl bg-[#F0F7FF] border border-[#D0E3FF] rounded-2xl p-3.5 sm:p-5 flex flex-col xs:flex-row items-center gap-3 sm:gap-3.5 shadow-sm text-xs sm:text-sm text-[#475569] text-center xs:text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[#2563EB]">
            <FiMapPin className="text-base sm:text-lg" />
          </div>
          <p className="leading-relaxed">
            Ensure your device GPS is switched ON and location permission is set to <strong>"Allow"</strong> in your browser address bar.
          </p>
        </div>

      </div>
    </div>
  );
};

export default LocationUnavailablePage;
