import React from 'react';
import { FiMapPin, FiAlertCircle, FiX } from 'react-icons/fi';

const TYPE_CONFIG = {
  permission: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', btn: 'bg-[#2563EB] hover:bg-blue-700', Icon: FiMapPin },
  error:      { iconBg: 'bg-red-100',  iconColor: 'text-red-600',  btn: 'bg-red-600 hover:bg-red-700',    Icon: FiAlertCircle },
  warning:    { iconBg: 'bg-amber-100',iconColor: 'text-amber-600',btn: 'bg-amber-500 hover:bg-amber-600', Icon: FiAlertCircle },
};

const LocationDialog = ({ isOpen, onClose, onAllow, title, message, type = 'permission' }) => {
  if (!isOpen) return null;
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.permission;
  const { Icon } = cfg;
  return (
    <div className="fixed inset-0 admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-clay-modal w-full max-w-md animate-scale-in border border-[#E2E8F0]">
        <div className="admin-modal-header flex items-start justify-between px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
              <Icon size={20} className={cfg.iconColor} />
            </div>
            <h3 className="text-base font-bold text-[#0F172A] leading-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors ml-2 flex-shrink-0">
            <FiX size={17} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#475569] leading-relaxed">{message}</p>
          {type === 'permission' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>Privacy note:</strong> Your location is only used to verify attendance and is never shared with third parties.
              </p>
            </div>
          )}
          {type === 'error' && (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-[#0F172A] mb-2">How to enable location:</p>
              <ol className="text-xs text-[#475569] space-y-1 list-decimal list-inside">
                <li>Click the lock icon in the address bar</li>
                <li>Find "Location" permission</li>
                <li>Change it to "Allow"</li>
                <li>Refresh the page</li>
              </ol>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] rounded-b-2xl">
          {type === 'permission' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-[#475569] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-colors">Cancel</button>
              <button onClick={() => { onAllow(); onClose(); }} className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-colors ${cfg.btn}`}>
                Allow Location
              </button>
            </>
          ) : (
            <button onClick={onClose} className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-colors ${cfg.btn}`}>OK</button>
          )}
        </div>
      </div>
    </div>
  );
};
export default LocationDialog;
