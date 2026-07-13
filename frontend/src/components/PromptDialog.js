import React, { useState } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

const PromptDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Submit', type = 'danger' }) => {
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="admin-modal rounded-2xl w-full max-w-md animate-scale-in">
        <div className="admin-modal-header flex justify-between items-center px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === 'danger' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
              <FiAlertTriangle className={type === 'danger' ? 'text-red-400' : 'text-blue-400'} size={20} />
            </div>
            <h3 className="text-base font-bold text-admin-heading leading-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-muted hover:bg-admin-elevated hover:text-admin-text transition-colors ml-2 flex-shrink-0">
            <FiX size={17} />
          </button>
        </div>
        <div className="admin-modal-body px-6 py-5">
          <p className="text-sm text-admin-text mb-4">{message}</p>
          <input 
            type="text" 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            placeholder="Optional: Enter reason" 
            className="admin-input focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border  rounded-b-2xl">
          <button onClick={onClose} className="admin-btn-neutral px-5 py-2 text-sm font-semibold hover:text-red-500 transition-colors">
            Cancel
          </button>
          <button onClick={() => { onConfirm(inputText); setInputText(''); onClose(); }} className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptDialog;
