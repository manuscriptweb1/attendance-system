import React from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const TYPE_CONFIG = {
  success: { iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-500', Icon: FiCheckCircle,
             lightIconBg: 'bg-emerald-100', lightIconColor: 'text-emerald-600', lightBtn: 'bg-emerald-600 hover:bg-emerald-700' },
  error:   { iconBg: 'bg-red-500/20',     iconColor: 'text-red-400',     btn: 'bg-red-600 hover:bg-red-500',     Icon: FiAlertCircle,
             lightIconBg: 'bg-red-100',     lightIconColor: 'text-red-600',     lightBtn: 'bg-red-600 hover:bg-red-700'     },
  warning: { iconBg: 'bg-amber-500/20',   iconColor: 'text-amber-400',   btn: 'bg-amber-500 hover:bg-amber-400', Icon: FiAlertCircle,
             lightIconBg: 'bg-amber-100',   lightIconColor: 'text-amber-600',   lightBtn: 'bg-amber-500 hover:bg-amber-600' },
  info:    { iconBg: 'bg-blue-500/20',    iconColor: 'text-blue-400',    btn: 'bg-blue-600 hover:bg-blue-500',   Icon: FiInfo,
             lightIconBg: 'bg-blue-100',    lightIconColor: 'text-blue-600',    lightBtn: 'bg-blue-600 hover:bg-blue-700'   },
};

const AlertDialog = ({ isOpen, onClose, title, message, type = 'success' }) => {
  const { isAdmin } = useAuth();
  if (!isOpen) return null;
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const { Icon } = cfg;

  if (isAdmin) {
    return (
      <div className="fixed inset-0 admin-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
        <div className="admin-modal rounded-2xl w-full max-w-md animate-scale-in">
          <div className="admin-modal-header flex items-start justify-between px-6 py-5 border-b">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                <Icon size={20} className={cfg.iconColor} />
              </div>
              <h3 className="text-base font-bold text-admin-heading leading-tight">{title}</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-muted hover:bg-admin-elevated hover:text-admin-text transition-colors ml-2 flex-shrink-0">
              <FiX size={17} />
            </button>
          </div>
          <div className="admin-modal-body px-6 py-5">
            <p className="text-sm text-admin-modal-text leading-relaxed whitespace-pre-line">{message}</p>
          </div>
          <div className="admin-modal-footer flex justify-end px-6 py-4 border-t">
            <button onClick={onClose} className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-all duration-200 hover:shadow-glow-blue-sm ${cfg.btn}`}>
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 admin-overlay backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-clay-modal w-full max-w-md animate-scale-in border border-[#E2E8F0]">
        <div className="admin-modal-header flex items-start justify-between px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.lightIconBg}`}>
              <Icon size={20} className={cfg.lightIconColor} />
            </div>
            <h3 className="text-base font-bold text-[#0F172A] leading-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors ml-2 flex-shrink-0">
            <FiX size={17} />
          </button>
        </div>
        <div className="admin-modal-body px-6 py-5">
          <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-line">{message}</p>
        </div>
        <div className="admin-modal-footer flex justify-end px-6 py-4 border-t">
          <button onClick={onClose} className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-colors ${cfg.lightBtn}`}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
