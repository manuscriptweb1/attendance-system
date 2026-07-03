import React, { useState } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

const ClearDataDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText, type = 'attendance' }) => {
  const [typedText, setTypedText] = useState('');
  const [checkbox, setCheckbox] = useState(false);
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === 'attendance') {
      if (checkbox && typedText === confirmText && month && year) {
        onConfirm(year, month);
        handleClose();
      }
    } else {
      if (checkbox && typedText === confirmText) {
        onConfirm();
        handleClose();
      }
    }
  };

  const handleClose = () => {
    setTypedText('');
    setCheckbox(false);
    setMonth('');
    setYear(new Date().getFullYear().toString());
    onClose();
  };

  const isValid = type === 'attendance' 
    ? (checkbox && typedText === confirmText && month && year)
    : (checkbox && typedText === confirmText);

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="fixed inset-0 admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="admin-modal rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="admin-modal-header flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <FiAlertTriangle className="text-red-400" size={20} />
            </div>
            <h2 className="text-lg font-bold text-admin-heading">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-muted hover:bg-admin-elevated hover:text-admin-text transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="admin-modal-body px-6 py-5 space-y-4">
          {/* Warning Message */}
          <div className="admin-modal-warning rounded-xl p-4">
            <p className="text-sm leading-relaxed">{message}</p>
          </div>

          {/* Month and Year Selection for Attendance */}
          {type === 'attendance' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                  Select Month
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="admin-select focus:border-red-500/50"
                >
                  <option value="">-- Select Month --</option>
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                  Select Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="admin-select focus:border-red-500/50"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checkbox}
              onChange={(e) => setCheckbox(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-red-500/30 bg-red-500/5 checked:bg-red-500 checked:border-red-500 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
            />
            <div className="flex-1">
              <span className="text-sm text-admin-text font-medium block">
                I understand this action cannot be undone
              </span>
              <span className="text-xs text-admin-muted mt-1 block">
                This will permanently delete all selected records from the database
              </span>
            </div>
          </label>

          {/* Type Confirmation Text */}
          <div>
            <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
              Type <span className="text-red-400 font-bold">"{confirmText}"</span> to confirm
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={confirmText}
              className="admin-input font-mono focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
              disabled={!checkbox}
            />
            {typedText && typedText !== confirmText && (
              <p className="text-xs text-red-400 mt-2">Text does not match. Please type exactly: {confirmText}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="admin-modal-footer flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={handleClose}
            className="admin-btn-neutral px-5 py-2.5 text-sm font-semibold hover:text-red-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-5 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearDataDialog;
