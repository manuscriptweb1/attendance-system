import React, { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

const MotivationPopup = ({ isOpen, message, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen && message) {
      setShouldRender(true);
      // Small delay to allow render before adding the visible class for transition
      setTimeout(() => setIsVisible(true), 10);
      
      const timer = setTimeout(() => {
        handleClose();
      }, 5000); // 5 seconds auto close
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, message]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setShouldRender(false);
      if (onClose) onClose();
    }, 300); // Wait for fade-out animation
  };

  if (!shouldRender || !message) return null;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md pointer-events-none">
      <div 
        className={`bg-white border border-[#E7EBF2]/60 shadow-[0_8px_30px_rgba(149,163,187,0.15)] rounded-2xl p-4 flex items-start gap-4 transform transition-all duration-300 pointer-events-auto ${isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-8 opacity-0 scale-95'}`}
      >
        <div className="flex-shrink-0 w-12 h-12 bg-blue-50/80 rounded-xl flex items-center justify-center text-3xl shadow-sm">
          {message.icon}
        </div>
        
        <div className="flex-1 min-w-0 pt-1">
          <h4 className="text-sm font-bold text-[#1E293B] mb-1 tracking-tight">
            Motivation
          </h4>
          <p className="text-sm text-[#475569] leading-relaxed">
            {message.text}
          </p>
        </div>
        
        <button 
          onClick={handleClose}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors"
        >
          <FiX size={16} />
        </button>
      </div>
    </div>
  );
};

export default MotivationPopup;
