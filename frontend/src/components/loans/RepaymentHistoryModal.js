import React, { useState, useEffect } from 'react';
import { FiX, FiClock, FiRotateCcw, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { Spinner } from '../Loader';
import { getRepaymentHistory } from '../../services/api';

export default function RepaymentHistoryModal({ isOpen, onClose, loan, onReverseTransaction }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reversal Dialog State
  const [selectedTxForReversal, setSelectedTxForReversal] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reversalError, setReversalError] = useState('');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    if (isOpen && loan) {
      fetchRepaymentHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loan]);

  const fetchRepaymentHistory = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getRepaymentHistory(loan.id);
      if (res.data.success) {
        setHistory(res.data.history || []);
      } else {
        setErrorMsg(res.data.message || 'Failed to load repayment history');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Server error loading repayment history');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReversal = async (e) => {
    e.preventDefault();
    if (!selectedTxForReversal) return;
    if (!reversalReason.trim()) {
      setReversalError('Reversal reason is required');
      return;
    }

    setReversing(true);
    setReversalError('');
    try {
      await onReverseTransaction(selectedTxForReversal.id, reversalReason.trim());
      setSelectedTxForReversal(null);
      setReversalReason('');
      fetchRepaymentHistory();
    } catch (err) {
      setReversalError(err.message || 'Reversal failed');
    } finally {
      setReversing(false);
    }
  };

  if (!isOpen || !loan) return null;

  return (
    <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-4xl animate-scale-in flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border">
          <div>
            <h2 className="text-lg font-bold text-admin-heading flex items-center gap-2">
              <FiClock className="text-purple-400" /> Repayment History - {loan.loanCode}
            </h2>
            <p className="text-xs text-admin-muted">
              Employee: <strong>{loan.employeeName}</strong> ({loan.employeeCode}) | Total Loan: ₹{loan.totalLoanAmount.toLocaleString('en-IN')} | Remaining Balance: ₹{loan.remainingBalance.toLocaleString('en-IN')}
            </p>
          </div>
          <button onClick={onClose} className="text-admin-secondary hover:text-admin-text">
            <FiX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto dark-scroll flex-1 space-y-4">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size={32} color="blue" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-admin-muted">
              <FiInfo size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No repayment transactions recorded yet.</p>
              <p className="text-xs mt-1 text-admin-muted">Monthly deductions will automatically post here after each payroll month ends.</p>
            </div>
          ) : (
            <div className="overflow-x-auto dark-scroll border border-admin-border rounded-2xl">
              <table className="w-full text-left table-auto border-collapse">
                <thead className="bg-admin-bg border-b border-admin-border">
                  <tr className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider">
                    <th className="px-4 py-3">Payroll Period</th>
                    <th className="px-4 py-3 text-right">Scheduled (₹)</th>
                    <th className="px-4 py-3 text-right">Actual Deducted (₹)</th>
                    <th className="px-4 py-3 text-right">Shortfall (₹)</th>
                    <th className="px-4 py-3 text-right">Balance After (₹)</th>
                    <th className="px-4 py-3">Posting Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border/30 text-xs">
                  {history.map(tx => {
                    const monthName = monthNames[(tx.payrollMonth || 1) - 1] || tx.payrollMonth;
                    return (
                      <tr key={tx.id} className="hover:bg-admin-bg/50 text-admin-text">
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">
                          {monthName} {tx.payrollYear}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          ₹{tx.scheduledDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          ₹{tx.actualDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${tx.shortfall > 0 ? 'text-amber-400' : 'text-admin-muted'}`}>
                          {tx.shortfall > 0 ? `₹${tx.shortfall.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-admin-muted">
                          ₹{tx.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-admin-muted whitespace-nowrap text-[11px]">
                          {tx.postingDate ? new Date(tx.postingDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-block ${
                            tx.status === 'Posted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            tx.status === 'Partially Posted' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            tx.status === 'Skipped' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {tx.status}
                          </span>
                          {tx.status === 'Reversed' && tx.reversalReason && (
                            <div className="text-[10px] text-red-400/80 italic mt-0.5" title={tx.reversalReason}>
                              Reason: {tx.reversalReason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {tx.status !== 'Reversed' ? (
                            <button
                              onClick={() => setSelectedTxForReversal(tx)}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1 mx-auto"
                              title="Authorised correction to reverse this posted deduction"
                            >
                              <FiRotateCcw size={12} /> Reverse
                            </button>
                          ) : (
                            <span className="text-[10px] text-admin-muted italic">Reversed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-admin-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for Reversal */}
      {selectedTxForReversal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-md flex items-center justify-center z-[120] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-md p-6 space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-admin-heading flex items-center gap-2">
              <FiRotateCcw className="text-amber-400" /> Reverse Posted Deduction
            </h3>
            <p className="text-xs text-admin-muted leading-relaxed">
              You are about to reverse the posted loan deduction of <strong>₹{selectedTxForReversal.actualDeducted.toLocaleString('en-IN')}</strong> for <strong>{monthNames[(selectedTxForReversal.payrollMonth || 1) - 1]} {selectedTxForReversal.payrollYear}</strong>.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl text-xs space-y-1">
              <p className="font-bold flex items-center gap-1"><FiAlertCircle /> Reversal Audit Impact:</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-200/90">
                <li>Restores ₹{selectedTxForReversal.actualDeducted.toLocaleString('en-IN')} back to the loan's remaining balance.</li>
                <li>Reduces Total Deducted on the Loan page.</li>
                <li>Preserves transaction in audit history marked as <strong>Reversed</strong>.</li>
              </ul>
            </div>

            {reversalError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-xs font-semibold">
                ⚠️ {reversalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1">
                Reason for Reversal <span className="text-red-400">*</span>
              </label>
              <textarea
                rows="2"
                placeholder="e.g. HR corrected July attendance/salary recalculation"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="admin-input w-full p-2.5 text-xs"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setSelectedTxForReversal(null); setReversalReason(''); }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                disabled={reversing}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {reversing ? <Spinner size={14} color="white" /> : <FiRotateCcw />} Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
