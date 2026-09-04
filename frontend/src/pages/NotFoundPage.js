import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiHome, FiArrowLeft, FiHelpCircle } from 'react-icons/fi';

const NotFoundPage = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FAFCFF] via-[#F8FAFC] to-[#F1F5F9] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative overflow-hidden font-sans select-none">
      
      {/* Ambient background decoration blobs */}
      <div className="absolute -top-24 -left-24 sm:-top-32 sm:-left-32 w-72 h-72 sm:w-96 sm:h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 sm:-bottom-32 sm:-right-32 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-48 h-48 sm:w-64 sm:h-64 bg-sky-100/30 rounded-full blur-2xl pointer-events-none" />

      {/* Decorative scattered dots & pluses */}
      <span className="absolute top-12 left-[10%] sm:top-24 sm:left-[15%] text-blue-300/40 text-lg sm:text-xl font-light pointer-events-none">✦</span>
      <span className="absolute top-20 right-[12%] sm:top-40 sm:right-[18%] text-blue-300/50 text-xl sm:text-2xl font-light pointer-events-none">✦</span>
      <span className="absolute bottom-16 left-[15%] sm:bottom-28 sm:left-[20%] text-blue-200/50 text-base sm:text-lg pointer-events-none">●</span>
      <span className="absolute bottom-20 right-[10%] sm:bottom-40 sm:right-[15%] text-blue-300/40 text-lg sm:text-xl pointer-events-none">✦</span>

      <div className="w-full max-w-4xl mx-auto flex flex-col items-center z-10">
        
        {/* Main 2-Column Content Card (Stacks on mobile/tablet, side-by-side on desktop) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center mb-8 sm:mb-10">
          
          {/* Left Column: 404 text & actions */}
          <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
            <span className="text-6xl xs:text-7xl sm:text-8xl md:text-8xl lg:text-9xl font-black text-[#2563EB] tracking-tight leading-none mb-2 sm:mb-3 drop-shadow-sm">
              404
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-2.5 sm:mb-3">
              Page Not Found
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#64748B] font-normal leading-relaxed mb-6 sm:mb-8 max-w-md">
              Oops! The page you're looking for doesn't exist or has been moved.
            </p>

            {/* Action Buttons (Flex full width on mobile, inline on tablet+) */}
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px]"
              >
                <FiHome className="text-base" />
                <span>Go Home</span>
              </button>

              <button
                onClick={handleGoBack}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-[#334155] font-semibold text-sm border border-slate-200 shadow-sm hover:shadow transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px]"
              >
                <FiArrowLeft className="text-base" />
                <span>Go Back</span>
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

              {/* Custom SVG Illustration: Sad Document with Question Magnifier */}
              <svg className="w-36 h-36 xs:w-44 xs:h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 z-10 filter drop-shadow-xl" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Document Sheet Shadow */}
                <rect x="52" y="32" width="90" height="116" rx="14" fill="#DBEAFE" opacity="0.6" />
                
                {/* Document Body */}
                <path d="M50 38C50 30.268 56.268 24 64 24H110L144 58V134C144 141.732 137.732 148 130 148H64C56.268 148 50 141.732 50 134V38Z" fill="white" />
                
                {/* Folded Corner */}
                <path d="M110 24V46C110 52.6274 115.373 58 122 58H144L110 24Z" fill="#E2E8F0" opacity="0.8" />
                
                {/* Sad Face Eyes */}
                <circle cx="82" cy="80" r="3.5" fill="#94A3B8" />
                <circle cx="112" cy="80" r="3.5" fill="#94A3B8" />
                
                {/* Sad Mouth */}
                <path d="M85 102C89 96 105 96 109 102" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />

                {/* Magnifying Glass Lens */}
                <circle cx="132" cy="132" r="26" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="7" />
                <circle cx="132" cy="132" r="22" fill="white" fillOpacity="0.4" />
                
                {/* Question Mark in Magnifier */}
                <text x="132" y="140" textAnchor="middle" fill="#2563EB" fontSize="22" fontWeight="bold" fontFamily="sans-serif">?</text>
                
                {/* Magnifier Handle */}
                <path d="M151 151L170 170" stroke="#3B82F6" strokeWidth="8" strokeLinecap="round" />
              </svg>
            </div>
          </div>

        </div>

        {/* Bottom Callout Card */}
        <div className="w-full max-w-2xl bg-[#F0F7FF] border border-[#D0E3FF] rounded-2xl p-3.5 sm:p-5 flex flex-col xs:flex-row items-center gap-3 sm:gap-3.5 shadow-sm text-xs sm:text-sm text-[#475569] text-center xs:text-left">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[#2563EB]">
            <FiHelpCircle className="text-base sm:text-lg" />
          </div>
          <p className="leading-relaxed">
            Need help? Try going back to the previous page or visit our{' '}
            <Link to="/" className="text-[#2563EB] font-semibold hover:underline">
              homepage
            </Link>
            .
          </p>
        </div>

      </div>
    </div>
  );
};

export default NotFoundPage;
