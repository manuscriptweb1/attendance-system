import React, { useState } from 'react';
import { FiAlertTriangle, FiX, FiTrash2 } from 'react-icons/fi';
import AlertDialog from './AlertDialog';
import { Spinner } from './Loader';

const ClearDataModal = ({ isOpen, onClose, onConfirm, title, description, loading }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'error' });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!fromDate || !toDate) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select both From Date and To Date.',
        type: 'error'
      });
      return;
    }

    if (new Date(toDate) < new Date(fromDate)) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'To Date cannot be before From Date.',
        type: 'error'
      });
      return;
    }

    if (confirmation !== 'DELETE') {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'You must type EXACTLY "DELETE" to confirm this action.',
        type: 'error'
      });
      return;
    }

    onConfirm({ fromDate, toDate });
  };

  const isButtonDisabled = !fromDate || !toDate || confirmation !== 'DELETE' || loading;

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-lg flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center border border-red-500/20 dark:border-red-500/30">
              <FiAlertTriangle className="text-red-600 dark:text-red-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">{title || 'Clear Data'}</h2>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white transition-colors">
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-6">
            {description || 'This will permanently delete records between the selected dates. This action cannot be undone.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">From Date</label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">To Date</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Type <span className="text-red-500 font-black">DELETE</span> to confirm
              </label>
              <input 
                type="text" 
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white text-sm rounded-xl px-4 py-3 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all placeholder-slate-300 dark:placeholder-slate-600"
                required
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80 gap-3">
          <button 
            type="button" 
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isButtonDisabled}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all disabled:opacity-50 disabled:hover:translate-y-0 hover:-translate-y-0.5"
          >
            {loading ? <Spinner size={16} color="white" /> : <FiTrash2 size={16} />}
            {loading ? 'Clearing...' : 'Clear Data'}
          </button>
        </div>
      </div>

      <AlertDialog 
        isOpen={alertDialog.isOpen} 
        onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} 
        title={alertDialog.title} 
        message={alertDialog.message} 
        type={alertDialog.type} 
      />
    </div>
  );
};

export default ClearDataModal;
