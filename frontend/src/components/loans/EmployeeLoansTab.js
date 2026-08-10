import React, { useState, useEffect } from 'react';
import {
  FiDollarSign, FiPlus, FiDownload, FiSearch, FiRefreshCw,
  FiXCircle, FiTrash2, FiClock, FiAlertTriangle, FiEdit2
} from 'react-icons/fi';
import AddLoanModal from './AddLoanModal';
import EditLoanModal from './EditLoanModal';
import RepaymentHistoryModal from './RepaymentHistoryModal';
import { Spinner } from '../Loader';
import {
  getAllLoans,
  getLoanSummary as fetchSummaryApi,
  createLoan as createLoanApi,
  updateLoan as updateLoanApi,
  cancelLoan as cancelLoanApi,
  deleteLoan as deleteLoanApi,
  reverseTransaction as reverseTransactionApi,
  triggerMonthEndProcessing as triggerMonthEndApi
} from '../../services/api';

export default function EmployeeLoansTab({ employees = [], showToast }) {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLoanForEdit, setSelectedLoanForEdit] = useState(null);
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState(null);

  // Cancel Dialog
  const [selectedLoanForCancel, setSelectedLoanForCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Delete Dialog
  const [selectedLoanForDelete, setSelectedLoanForDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Manual Month End Trigger
  const [triggeringMonthEnd, setTriggeringMonthEnd] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchLoansData();
    fetchLoanSummary();
  }, [searchTerm, statusFilter, page]);

  const fetchLoansData = async () => {
    setLoading(true);
    try {
      const res = await getAllLoans({
        search: searchTerm,
        status: statusFilter,
        page,
        limit: 15
      });
      if (res.data.success) {
        setLoans(res.data.loans || []);
        setPagination(res.data.pagination || { total: 0, totalPages: 1 });
      } else {
        showToast && showToast(res.data.message || 'Failed to fetch loans', 'error');
      }
    } catch (err) {
      showToast && showToast('Server error fetching employee loans', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanSummary = async () => {
    try {
      const res = await fetchSummaryApi();
      if (res.data.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to load loan summary:', err);
    }
  };

  const handleCreateLoan = async (loanData) => {
    try {
      const res = await createLoanApi(loanData);
      if (res.data.success) {
        showToast && showToast('Interest-free loan created successfully!', 'success');
        fetchLoansData();
        fetchLoanSummary();
      } else {
        throw new Error(res.data.message || 'Failed to create loan');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create loan';
      throw new Error(msg);
    }
  };

  const handleUpdateLoan = async (updateData) => {
    try {
      const res = await updateLoanApi(updateData.id, updateData);
      if (res.data.success) {
        showToast && showToast('Employee loan updated successfully!', 'success');
        fetchLoansData();
        fetchLoanSummary();
      } else {
        throw new Error(res.data.message || 'Failed to update loan');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update loan';
      throw new Error(msg);
    }
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!selectedLoanForCancel || !cancellationReason.trim()) return;

    setCancelling(true);
    try {
      const res = await cancelLoanApi(selectedLoanForCancel.id, { cancellationReason: cancellationReason.trim() });
      if (res.data.success) {
        showToast && showToast('Loan cancelled successfully', 'success');
        setSelectedLoanForCancel(null);
        setCancellationReason('');
        fetchLoansData();
        fetchLoanSummary();
      } else {
        showToast && showToast(res.data.message || 'Failed to cancel loan', 'error');
      }
    } catch (err) {
      showToast && showToast(err.response?.data?.message || 'Server error cancelling loan', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedLoanForDelete) return;

    setDeleting(true);
    try {
      const res = await deleteLoanApi(selectedLoanForDelete.id);
      if (res.data.success) {
        showToast && showToast('Unused loan deleted successfully', 'success');
        setSelectedLoanForDelete(null);
        fetchLoansData();
        fetchLoanSummary();
      } else {
        showToast && showToast(res.data.message || 'Failed to delete loan', 'error');
      }
    } catch (err) {
      showToast && showToast(err.response?.data?.message || 'Server error deleting loan', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleReverseTransaction = async (transactionId, reversalReason) => {
    try {
      const res = await reverseTransactionApi({ transactionId, reversalReason });
      if (res.data.success) {
        showToast && showToast('Repayment transaction reversed successfully', 'success');
        fetchLoansData();
        fetchLoanSummary();
      } else {
        throw new Error(res.data.message || 'Failed to reverse transaction');
      }
    } catch (err) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to reverse transaction');
    }
  };

  const handleExportExcel = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    window.open(`${baseURL}/loans/export?status=${statusFilter}&token=${token}`, '_blank');
  };

  const handleManualTriggerMonthEnd = async () => {
    const now = new Date();
    let m = now.getMonth();
    let y = now.getFullYear();
    if (m === 0) {
      m = 12;
      y -= 1;
    }

    setTriggeringMonthEnd(true);
    try {
      const res = await triggerMonthEndApi({ month: m, year: y });
      if (res.data.success) {
        showToast && showToast(`Month-end loan processing triggered for ${m}/${y}`, 'success');
        fetchLoansData();
        fetchLoanSummary();
      } else {
        showToast && showToast(res.data.message || 'Trigger failed', 'error');
      }
    } catch (err) {
      showToast && showToast('Server error running month-end job', 'error');
    } finally {
      setTriggeringMonthEnd(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Failure Notification Banner */}
      {summary && summary.lastBatchErrors && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <FiAlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-200">Month-End Auto-Scheduler Alert</p>
              <p className="text-[11px] opacity-90">The most recent month-end loan processing run encountered errors for one or more records. You can trigger a retry below.</p>
            </div>
          </div>
          <button
            onClick={handleManualTriggerMonthEnd}
            disabled={triggeringMonthEnd}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl font-bold text-amber-200 flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            {triggeringMonthEnd ? <Spinner size={12} color="amber" /> : <FiRefreshCw size={12} />} Retry Auto-Processing
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total Loans */}
          <div className="bg-admin-elevated border border-admin-border p-4 rounded-2xl shadow-clay-admin-card">
            <div className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider">Total Loans</div>
            <div className="text-xl font-extrabold text-admin-text mt-1">{summary.totalLoans}</div>
            <div className="text-[10px] text-admin-muted mt-1">₹{summary.totalLoanAmount.toLocaleString('en-IN')} issued</div>
          </div>

          {/* Active Loans */}
          <div className="bg-admin-elevated border border-admin-border p-4 rounded-2xl shadow-clay-admin-card">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active Loans</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">{summary.activeLoans}</div>
            <div className="text-[10px] text-admin-muted mt-1">{summary.scheduledLoans} Scheduled</div>
          </div>

          {/* Completed Loans */}
          <div className="bg-admin-elevated border border-admin-border p-4 rounded-2xl shadow-clay-admin-card">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Completed Loans</div>
            <div className="text-xl font-extrabold text-blue-400 mt-1">{summary.completedLoans}</div>
            <div className="text-[10px] text-admin-muted mt-1">{summary.cancelledLoans} Cancelled</div>
          </div>

          {/* Total Deducted */}
          <div className="bg-admin-elevated border border-admin-border p-4 rounded-2xl shadow-clay-admin-card">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Total Repaid</div>
            <div className="text-xl font-extrabold text-purple-400 mt-1">₹{summary.totalDeductedAmount.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-admin-muted mt-1">Prev Month: ₹{summary.previousMonthPostedDeduction.toLocaleString('en-IN')}</div>
          </div>

          {/* Outstanding Balance */}
          <div className="bg-admin-elevated border border-admin-border p-4 rounded-2xl shadow-clay-admin-card">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Outstanding Balance</div>
            <div className="text-xl font-extrabold text-amber-400 mt-1">₹{summary.totalOutstandingBalance.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-admin-muted mt-1">Current Month Pending: ₹{summary.currentMonthPendingDeduction.toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}

      {/* Filter & Action Toolbar */}
      <div className="bg-admin-elevated border border-admin-border p-4 rounded-2xl shadow-clay-admin-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-2.5 text-admin-muted text-xs" />
            <input
              type="text"
              placeholder="Search Employee ID, Name, Loan Code..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="admin-input py-1.5 pl-8 pr-3 text-xs w-64"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-admin-secondary">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="admin-select py-1.5 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all flex items-center gap-1.5"
          >
            <FiDownload /> Export Excel
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
          >
            <FiPlus /> Add Employee Loan
          </button>
        </div>
      </div>

      {/* Horizontally Scrollable Loan Table */}
      <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={36} color="blue" />
          </div>
        ) : loans.length === 0 ? (
          <div className="text-center py-16 text-admin-muted">
            <FiDollarSign size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-bold">No employee loans found.</p>
            <p className="text-xs mt-1">Click "+ Add Employee Loan" above to create an interest-free loan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto dark-scroll">
            <table className="w-full text-left table-auto border-collapse">
              <thead className="bg-admin-bg border-b border-admin-border sticky top-0 z-10">
                <tr className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider">
                  <th className="px-4 py-3">S.No</th>
                  <th className="px-4 py-3">Loan Code</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3 text-right">Total Loan (₹)</th>
                  <th className="px-4 py-3 text-center">Duration</th>
                  <th className="px-4 py-3 text-right">Monthly Deduction (₹)</th>
                  <th className="px-4 py-3 text-right">Total Repaid (₹)</th>
                  <th className="px-4 py-3 text-right">Remaining Balance (₹)</th>
                  <th className="px-4 py-3 text-center">Instalments</th>
                  <th className="px-4 py-3">First Month</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border/30 text-xs">
                {loans.map((loan, idx) => {
                  const sNo = (page - 1) * 15 + idx + 1;
                  const firstMonthName = monthNames[(loan.firstDeductionMonth || 1) - 1]?.slice(0, 3) || loan.firstDeductionMonth;

                  return (
                    <tr key={loan.id} className="hover:bg-admin-bg/50 text-admin-text transition-all">
                      {/* S.No */}
                      <td className="px-4 py-3 font-mono font-semibold text-admin-muted text-[11px]">{sNo}</td>

                      {/* Loan Code */}
                      <td className="px-4 py-3 font-mono font-bold text-purple-400 whitespace-nowrap">{loan.loanCode}</td>

                      {/* Employee Code & Name */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-admin-text bg-admin-bg px-1.5 py-0.5 rounded border border-admin-border/50 text-[11px] shrink-0">
                            {loan.employeeCode}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-admin-text truncate max-w-[150px]">{loan.employeeName}</div>
                            <div className="text-admin-muted text-[10px] truncate max-w-[150px]">{loan.department}</div>
                          </div>
                        </div>
                      </td>

                      {/* Total Loan Amount */}
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        ₹{loan.totalLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                        {loan.repaymentMonths} months
                      </td>

                      {/* Monthly Scheduled Deduction */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        ₹{loan.monthlyScheduledDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Total Repaid */}
                      <td className="px-4 py-3 text-right font-mono font-semibold text-purple-400 whitespace-nowrap">
                        ₹{loan.totalPostedDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Remaining Balance */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">
                        ₹{loan.remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Instalments */}
                      <td className="px-4 py-3 text-center whitespace-nowrap font-mono text-[11px]">
                        <span className="font-bold text-emerald-400">{loan.completedInstalments}</span> / {loan.repaymentMonths}
                      </td>

                      {/* First Month */}
                      <td className="px-4 py-3 font-semibold text-admin-secondary whitespace-nowrap">
                        {firstMonthName} {loan.firstDeductionYear}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-block ${
                          loan.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          loan.status === 'Scheduled' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          loan.status === 'Completed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {loan.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Loan */}
                          {!['Completed', 'Cancelled'].includes(loan.status) && (
                            <button
                              onClick={() => setSelectedLoanForEdit(loan)}
                              className="p-1.5 text-xs font-semibold rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                              title="Edit Loan"
                            >
                              <FiEdit2 size={14} />
                            </button>
                          )}

                          {/* View Repayment History */}
                          <button
                            onClick={() => setSelectedLoanForHistory(loan)}
                            className="p-1.5 text-xs font-semibold rounded-lg bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all"
                            title="View Repayment History"
                          >
                            <FiClock size={14} />
                          </button>

                          {/* Cancel Loan */}
                          {['Active', 'Scheduled'].includes(loan.status) && (
                            <button
                              onClick={() => setSelectedLoanForCancel(loan)}
                              className="p-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                              title="Cancel Loan"
                            >
                              <FiXCircle size={14} />
                            </button>
                          )}

                          {/* Delete Unused Loan */}
                          {loan.totalPostedDeduction === 0 && (
                            <button
                              onClick={() => setSelectedLoanForDelete(loan)}
                              className="p-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                              title="Delete Unused Loan"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-admin-border bg-admin-bg/40 text-xs">
            <span className="text-admin-muted">
              Showing {loans.length} of {pagination.total} loans
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg bg-admin-surface border border-admin-border text-admin-text disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-semibold text-admin-text">Page {page} of {pagination.totalPages}</span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-admin-surface border border-admin-border text-admin-text disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Loan Modal */}
      {showAddModal && (
        <AddLoanModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleCreateLoan}
          employees={employees}
        />
      )}

      {/* Edit Loan Modal */}
      {selectedLoanForEdit && (
        <EditLoanModal
          isOpen={!!selectedLoanForEdit}
          onClose={() => setSelectedLoanForEdit(null)}
          onSave={handleUpdateLoan}
          loan={selectedLoanForEdit}
        />
      )}

      {/* Repayment History Modal */}
      {selectedLoanForHistory && (
        <RepaymentHistoryModal
          isOpen={!!selectedLoanForHistory}
          onClose={() => setSelectedLoanForHistory(null)}
          loan={selectedLoanForHistory}
          onReverseTransaction={handleReverseTransaction}
        />
      )}

      {/* Cancel Loan Confirmation Dialog */}
      {selectedLoanForCancel && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-md flex items-center justify-center z-[120] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-md p-6 space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-admin-heading flex items-center gap-2">
              <FiXCircle className="text-amber-400" /> Cancel Interest-Free Loan
            </h3>
            <p className="text-xs text-admin-muted leading-relaxed">
              Cancel loan <strong>{selectedLoanForCancel.loanCode}</strong> for <strong>{selectedLoanForCancel.employeeName}</strong>. Future payroll deductions will stop. Previously posted repayments remain saved.
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1">
                  Reason for Cancellation <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Employee settled remaining balance manually"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="admin-input w-full p-2.5 text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedLoanForCancel(null); setCancellationReason(''); }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {cancelling ? <Spinner size={14} color="white" /> : <FiXCircle />} Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Unused Loan Confirmation Dialog */}
      {selectedLoanForDelete && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-md flex items-center justify-center z-[120] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-md p-6 space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-admin-heading flex items-center gap-2">
              <FiTrash2 className="text-red-400" /> Delete Unused Loan
            </h3>
            <p className="text-xs text-admin-muted leading-relaxed">
              Are you sure you want to delete loan <strong>{selectedLoanForDelete.loanCode}</strong> for <strong>{selectedLoanForDelete.employeeName}</strong>? No repayments have been posted for this loan yet.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedLoanForDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? <Spinner size={14} color="white" /> : <FiTrash2 />} Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
