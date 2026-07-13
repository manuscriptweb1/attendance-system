import React from 'react';
import { FiAlertTriangle, FiLogOut, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const LogoutWarningDialog = ({ isOpen, onClose, onLogout }) => {
  const { isAdmin } = useAuth();
  if (!isOpen) return null;

  if (isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 admin-overlay backdrop-blur-sm" onClick={onClose} />
        <div className="relative admin-modal rounded-2xl w-full max-w-sm animate-scale-in">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-admin-muted hover:bg-admin-elevated hover:text-admin-text transition-colors">
            <FiX size={17} />
          </button>
          <div className="flex justify-center pt-8 pb-4">
            <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center">
              <FiAlertTriangle size={28} className="text-orange-400" />
            </div>
          </div>
          <div className="px-6 pb-6 text-center">
            <h2 className="text-lg font-bold text-white mb-2">You're still logged in!</h2>
            <p className="text-sm text-gray-300 mb-6">Please sign out properly before closing to end your session securely.</p>
            <div className="space-y-2">
              <button onClick={onLogout} className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 px-5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm">
                <FiLogOut size={16} /> Sign Out Now
              </button>
              <button onClick={onClose} className="w-full  hover:bg-white/10 border border-white/20 text-white py-2.5 px-5 rounded-xl text-sm font-semibold transition-colors">
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 admin-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-[#E2E8F0] rounded-2xl shadow-clay-modal w-full max-w-sm animate-scale-in">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
          <FiX size={17} />
        </button>
        <div className="flex justify-center pt-8 pb-4">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center">
            <FiAlertTriangle size={28} className="text-orange-600" />
          </div>
        </div>
        <div className="px-6 pb-6 text-center">
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">You're still logged in!</h2>
          <p className="text-sm text-[#475569] mb-6">Please sign out properly before closing to end your session securely.</p>
          <div className="space-y-2">
            <button onClick={onLogout} className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm">
              <FiLogOut size={16} /> Sign Out Now
            </button>
            <button onClick={onClose} className="w-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] py-2.5 px-5 rounded-xl text-sm font-semibold transition-colors">
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LogoutWarningDialog;
