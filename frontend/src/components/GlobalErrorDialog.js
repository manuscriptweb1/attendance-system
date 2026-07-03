import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiAlertTriangle, FiShield, FiMapPin, FiWifi, FiServer, FiCheckCircle, FiClock } from 'react-icons/fi';
import { ERROR_ACTIONS } from '../utils/errorMapper';

const GlobalErrorDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState(null);
  
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleGlobalError = (event) => {
      const newConfig = event.detail;
      
      setConfig((currentConfig) => {
        if (!currentConfig) return newConfig;
        
        // Priority check: lower number means higher priority.
        const currentPriority = currentConfig.priority || 99;
        const newPriority = newConfig.priority || 99;
        
        if (newPriority < currentPriority) {
          return newConfig;
        }
        return currentConfig;
      });
      
      setIsOpen(true);
    };

    window.addEventListener('showGlobalError', handleGlobalError);
    return () => window.removeEventListener('showGlobalError', handleGlobalError);
  }, []);

  if (!isOpen || !config) return null;

  const closeDialog = () => {
    setIsOpen(false);
    setConfig(null);
  };

  const handleAction = (action) => {
    if (action === ERROR_ACTIONS.SIGN_IN_AGAIN) {
      closeDialog();
      logout();
      navigate('/');
    } else {
      // For OK, CANCEL, RETRY - we just close the dialog and let the user trigger the action manually from the UI
      closeDialog();
    }
  };

  // Determine icon based on config
  let IconComponent = FiAlertTriangle;
  let iconColor = 'text-red-600';
  let iconBg = 'bg-red-100';

  if (config.icon === 'auth' || config.icon === 'session' || config.icon === 'device') {
    IconComponent = FiShield;
    iconColor = 'text-orange-600';
    iconBg = 'bg-orange-100';
  } else if (config.icon === 'location') {
    IconComponent = FiMapPin;
    iconColor = 'text-blue-600';
    iconBg = 'bg-blue-100';
  } else if (config.icon === 'network') {
    IconComponent = FiWifi;
    iconColor = 'text-indigo-600';
    iconBg = 'bg-indigo-100';
  } else if (config.icon === 'time') {
    IconComponent = FiClock;
    iconColor = 'text-purple-600';
    iconBg = 'bg-purple-100';
  } else if (config.icon === 'server') {
    IconComponent = FiServer;
    iconColor = 'text-purple-600';
    iconBg = 'bg-purple-100';
  } else if (config.icon === 'check') {
    IconComponent = FiCheckCircle;
    iconColor = 'text-emerald-600';
    iconBg = 'bg-emerald-100';
  }

  // Determine button styles
  const getButtonStyle = (action) => {
    switch (action) {
      case ERROR_ACTIONS.SIGN_IN_AGAIN:
      case ERROR_ACTIONS.RETRY:
      case ERROR_ACTIONS.OK:
        return 'px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm';
      case ERROR_ACTIONS.CANCEL:
      default:
        return 'admin-btn-neutral rounded-xl px-4 py-2 text-sm font-medium';
    }
  };

  const getButtonLabel = (action) => {
    switch (action) {
      case ERROR_ACTIONS.SIGN_IN_AGAIN: return 'Sign In Again';
      case ERROR_ACTIONS.RETRY: return 'Retry';
      case ERROR_ACTIONS.OK: return 'OK';
      case ERROR_ACTIONS.CANCEL: return 'Cancel';
      default: return 'OK';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 admin-overlay backdrop-blur-sm animate-fadeIn">
      <div className="admin-modal rounded-2xl w-full max-w-md overflow-hidden animate-scaleIn">
        <div className="admin-modal-body p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
              <IconComponent className={`${iconColor} text-xl`} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-admin-heading">{config.title}</h3>
            </div>
          </div>
          
          <div className="text-admin-text mb-6 text-sm leading-relaxed whitespace-pre-line">
            {config.message}
          </div>
          
          <div className="admin-modal-footer flex gap-3 justify-end mt-6">
            {config.buttons && config.buttons.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(action)}
                className={getButtonStyle(action)}
              >
                {getButtonLabel(action)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalErrorDialog;
