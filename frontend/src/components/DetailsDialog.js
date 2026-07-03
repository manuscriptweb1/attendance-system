import React from 'react';
import { FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const DetailsDialog = ({ isOpen, onClose, title, details }) => {
  const { isAdmin } = useAuth();
  if (!isOpen) return null;

  let parsed = details;
  if (typeof details === 'string') { try { parsed = JSON.parse(details); } catch { parsed = { message: details }; } }

  const fmt = v => { if (v == null) return 'N/A'; if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'object') return JSON.stringify(v, null, 2); return String(v); };

  const renderDetails = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object') return (
      <div className={`p-3 rounded-xl text-xs font-mono whitespace-pre-wrap break-words ${isAdmin ? ' text-gray-300' : 'bg-[#F8FAFC] text-[#475569]'}`}>{fmt(obj)}</div>
    );
    return (
      <div className={`space-y-2 ${depth > 0 ? 'ml-4' : ''}`}>
        {Object.entries(obj).map(([key, value]) => (
          <div key={key} className={`border-l-2 pl-3 ${isAdmin ? 'border-white/20' : 'border-blue-200'}`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
              <span className={`font-semibold text-xs min-w-[120px] ${isAdmin ? 'text-gray-400' : 'text-[#475569]'}`}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
              </span>
              {typeof value === 'object' && value !== null
                ? <div className="flex-1">{renderDetails(value, depth + 1)}</div>
                : <span className={`text-xs flex-1 break-all ${isAdmin ? 'text-gray-300' : 'text-[#0F172A]'}`}>{fmt(value)}</span>
              }
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isAdmin) {
    return (
      <div className="fixed inset-0 admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="admin-modal rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in">
          <div className="admin-modal-header flex justify-between items-center px-6 py-5 border-b">
            <h2 className="text-base font-bold text-white">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-muted hover:bg-admin-elevated hover:text-admin-text transition-colors">
              <FiX size={18} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 dark-scroll">
            {parsed && Object.keys(parsed).length > 0 ? renderDetails(parsed) : <p className="text-center text-gray-400 py-8 text-sm">No details available</p>}
          </div>
          <div className="admin-modal-footer flex justify-end px-6 py-4 border-t">
            <button onClick={onClose} className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-clay-modal w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in">
        <div className="admin-modal-header flex justify-between items-center px-6 py-5 border-b">
          <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
            <FiX size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {parsed && Object.keys(parsed).length > 0 ? renderDetails(parsed) : <p className="text-center text-[#64748B] py-8 text-sm">No details available</p>}
        </div>
        <div className="admin-modal-footer flex justify-end px-6 py-4 border-t">
          <button onClick={onClose} className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};
export default DetailsDialog;
