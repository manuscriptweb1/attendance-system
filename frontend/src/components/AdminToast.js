import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiX } from 'react-icons/fi';

/**
 * Reusable Admin Toast Component
 * Renders a fixed toast at the bottom-right of the screen.
 * Respects light and dark themes via CSS variables/classes.
 */
const AdminToast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for fade out animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div
      className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 admin-toast ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      } ${
        type === 'success' ? 'border-emerald-500/30' : 'border-red-500/30'
      }`}
    >
      <div className={`flex-shrink-0 ${type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
        {type === 'success' ? <FiCheckCircle size={20} /> : <FiXCircle size={20} />}
      </div>
      <p className="text-sm font-medium admin-toast-text flex-1 pr-4">{message}</p>
      <button 
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="text-admin-muted hover:text-admin-text transition-colors"
      >
        <FiX size={16} />
      </button>
    </div>
  );
};

export default AdminToast;
