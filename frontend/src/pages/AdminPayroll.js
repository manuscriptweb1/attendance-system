import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import PayrollPaySlip from '../components/PayrollPaySlip';
import ClearRangeDialog from '../components/ClearRangeDialog';
import { Spinner } from '../components/Loader';
import api, { clearPayrollRange } from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';
import { validateMonthYear } from '../utils/dateValidation';
import { FiDownload, FiRefreshCw, FiDollarSign, FiEdit2, FiFileText, FiX, FiTrash2 } from 'react-icons/fi';
import { sortEmployeeRows } from '../utils/sorting';
import { formatIndianCurrency as formatCurrency } from '../utils/formatCurrency';

const AdminPayroll = () => {
  const { hasPermission } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isCalculated, setIsCalculated] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [clearDialog, setClearDialog] = useState({ isOpen: false, isLoading: false });

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [calculatingRowId, setCalculatingRowId] = useState(null);
  const [sortBy, setSortBy] = useState('name_asc');

  // Pay Slip State
  const [paySlipData, setPaySlipData] = useState(null);
  const [loadingPaySlipId, setLoadingPaySlipId] = useState(null);

  const fetchPayroll = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/payroll', { params: { month, year } });
      if (res.data.success) {
        setRecords(res.data.records);
        setIsCalculated(res.data.isCalculated);
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [month, year]); // eslint-disable-line

  const handleCalculate = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      return;
    }

    try {
      setCalculating(true);
      const res = await api.post('/payroll/calculate', { month, year });
      if (res.data.success) {
        setToastConfig({ message: 'Payroll calculated successfully!', type: 'success' });
        fetchPayroll();
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    } finally {
      setCalculating(false);
    }
  };

  const handleExport = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      return;
    }

    try {
      const res = await api.get('/payroll/export', { params: { month, year }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `Payroll_${month}_${year}.xlsx`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updatedRecords = records.map(r => r.id === id ? { ...r, status: newStatus } : r);
      setRecords(updatedRecords);

      const res = await api.patch(`/payroll/${id}/status`, { status: newStatus });
      if (!res.data.success) {
        fetchPayroll();
        setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to update status', type: 'error' });
      }
    } catch (e) {
      fetchPayroll();
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    }
  };

  const handleCalculateSingle = async (row) => {
    try {
      setCalculatingRowId(row.employeeId);
      const res = await api.post(`/payroll/calculate/${row.employeeId}`, { month, year });
      if (res.data.success) {
        setToastConfig({ message: 'Payroll recalculated successfully', type: 'success' });
        setRecords(prev => prev.map(r => r.employeeId === row.employeeId ? res.data.record : r));
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    } finally {
      setCalculatingRowId(null);
    }
  };

  const handleDownloadPaySlip = async (r) => {
    if (!isCalculated) {
      setToastConfig({ message: 'Please calculate payroll before generating pay slip.', type: 'error' });
      return;
    }
    try {
      setLoadingPaySlipId(r.employeeId);
      const res = await api.get('/payroll/payslip', { params: { employee_id: r.employeeId, month, year } });
      if (res.data.success) {
        setPaySlipData(res.data);
      }
    } catch (e) {
      setToastConfig({ message: getErrorMessage(e), type: 'error' });
    } finally {
      setLoadingPaySlipId(null);
    }
  };

  const openEditModal = (row) => {
    setEditingRow({ ...row });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingRow(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingRow(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const wd = parseFloat(editingRow.workingDays) || 0;
    const pd = parseFloat(editingRow.paidDays) || 0;
    const ld = parseFloat(editingRow.lopDays) || 0;
    const td = parseFloat(editingRow.totalDays) || 0;
    if (wd > td || pd > td || ld > td) {
      setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'Attendance days cannot exceed total days in the month.', type: 'error' });
      return;
    }
    try {
      setSavingEdit(true);
      const payload = {
        work_days: editingRow.workingDays,
        paid_days: editingRow.paidDays,
        lop_days: editingRow.lopDays,
        monthly_earning: editingRow.monthlyEarning,
        basic_salary: editingRow.basicSalary,
        hra: editingRow.hra,
        special_allowance: editingRow.specialAllowance,
        staff_advance: editingRow.staffAdvance,
        professional_tax: editingRow.professionalTax,
        tds: editingRow.tds,
        status: editingRow.status
      };
      
      const res = await api.put(`/payroll/${editingRow.id}`, payload);
      if (res.data.success) {
        setToastConfig({ message: 'Payroll updated successfully', type: 'success' });
        setRecords(prev => prev.map(r => r.id === editingRow.id ? res.data.record : r));
        closeEditModal();
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleClearRange = async (data) => {
    try {
      setClearDialog(prev => ({ ...prev, isLoading: true }));
      const response = await clearPayrollRange(data);
      if (response.data.success) {
        setClearDialog({ isOpen: false, isLoading: false });
        setToastConfig({ message: response.data.message || 'Records cleared successfully.', type: 'success' });
        fetchPayroll();
      } else {
        setClearDialog(prev => ({ ...prev, isLoading: false }));
        setAlertDialog({ isOpen: true, title: 'Error', message: response.data.message || 'Failed to clear payroll', type: 'error' });
      }
    } catch (error) {
      setClearDialog(prev => ({ ...prev, isLoading: false }));
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  const totalNetPayable = records.reduce((sum, r) => sum + (parseFloat(r.netPayable) || 0), 0);

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-2 py-4 lg:px-4 lg:py-6 w-full max-w-none pt-16 lg:pt-8">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight">Payroll Management</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Calculate and process monthly employee salaries.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="admin-select py-2 text-sm text-admin-muted">
                  {[...Array(12).keys()].map(m => (
                    <option key={m + 1} value={m + 1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="admin-select py-2 text-sm text-admin-muted">
                  {[...Array(5).keys()].map(y => {
                    const yearVal = new Date().getFullYear() - 2 + y;
                    return <option key={yearVal} value={yearVal}>{yearVal}</option>
                  })}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="admin-select py-2 text-sm text-admin-muted cursor-pointer max-w-[160px]">
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {hasPermission('payroll', 'can_clear') && (
                  <button
                    onClick={() => setClearDialog({ isOpen: true })}
                    className="flex items-center gap-2 bg-admin-surface border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                    <FiTrash2 size={16} /> Clear Month
                  </button>
                )}
                {hasPermission('payroll', 'can_calculate') && (
                  <button
                    onClick={handleCalculate}
                    disabled={calculating}
                    className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow-blue-sm disabled:opacity-50">
                    <FiRefreshCw size={16} className={calculating ? 'animate-spin' : ''} />
                    {calculating ? 'Calculating...' : 'Calculate All'}
                  </button>
                )}
                {hasPermission('payroll', 'can_export') && (
                  <button
                    onClick={handleExport}
                    disabled={!isCalculated || records.length === 0}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)] disabled:opacity-50">
                    <FiDownload size={16} /> Export Excel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <FiDollarSign size={20} className="text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-admin-secondary uppercase tracking-wider">Total Net Payable</span>
            </div>
            <span className="text-2xl font-extrabold text-admin-heading">{formatCurrency(totalNetPayable)}</span>
          </div>

          {/* Table */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-3 flex flex-col">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Spinner size={36} color="blue" />
              </div>
            ) : !isCalculated ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <FiDollarSign size={28} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-admin-heading mb-1">Payroll Not Calculated</h3>
                <p className="text-sm text-admin-secondary max-w-md text-center">Click "Calculate All" to generate salary records for {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}.</p>
              </div>
            ) : (
              <div className="table-responsive dark-scroll w-full">
                <table className="w-full min-w-[1400px] table-auto divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg">
                    <tr>
                      {[
                        { label: 'Employee', w: 'w-[12%]' },
                        { label: 'Total', w: 'w-[4%]', center: true },
                        { label: 'Work', w: 'w-[4%]', center: true },
                        { label: 'Paid', w: 'w-[4%]', center: true },
                        { label: 'Half', w: 'w-[5%]', center: true },
                        { label: 'Monthly', w: 'w-[7%]' },
                        { label: 'Per Day', w: 'w-[6%]' },
                        { label: 'LOP', w: 'w-[5%]', center: true },
                        { label: 'Net Earn', w: 'w-[7%]' },
                        { label: 'Basic', w: 'w-[6%]' },
                        { label: 'HRA', w: 'w-[6%]' },
                        { label: 'Special', w: 'w-[6%]' },
                        { label: 'Advance', w: 'w-[5%]' },
                        { label: 'PT', w: 'w-[4%]' },
                        { label: 'TDS', w: 'w-[4%]' },
                        { label: 'Payable', w: 'w-[7%]' },
                        { label: 'Status', w: 'w-[5%]' },
                        { label: 'Actions', w: 'actions-column', center: true }
                      ].map(c => (
                        <th key={c.label} className={`px-2 py-2 text-[10px] font-bold text-admin-secondary uppercase tracking-tighter leading-tight ${c.w} ${c.center ? 'text-center' : 'text-left'} align-middle`}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(() => {
                      const sortedRecords = sortEmployeeRows(records, sortBy);
                      return sortedRecords.map(r => (
                        <tr key={r.id} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors">
                        <td className="px-2 py-2 align-middle">
                          <div className="text-[11px] font-bold text-admin-text truncate max-w-[130px] leading-tight" title={r.employeeName}>{r.employeeName}</div>
                          <div className="text-[10px] text-admin-muted font-mono leading-tight">{r.employeeCode}</div>
                        </td>
                        <td className="px-2 py-2 text-[11px] font-bold text-admin-text text-center align-middle">{r.totalDays}</td>
                        <td className="px-2 py-2 text-[11px] text-admin-secondary text-center align-middle">{r.workingDays}</td>
                        <td className="px-2 py-2 text-[11px] font-bold text-emerald-400 text-center align-middle">{parseFloat(r.paidDays).toFixed(1)}</td>
                        <td className="px-2 py-2 align-middle text-center">
                          {parseFloat(r.halfDays) > 0 ? (
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-[11px] font-bold text-yellow-500 leading-tight">{parseFloat(r.halfDays).toFixed(1)}</span>
                              <span className="text-[9px] text-red-400/80 leading-tight">{formatCurrency(r.halfDayLossAmount ?? r.half_day_loss_amount ?? 0)}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-admin-secondary">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[11px] text-admin-text align-middle">{formatCurrency(r.monthlyEarning)}</td>
                        <td className="px-2 py-2 text-[11px] text-admin-muted align-middle">{formatCurrency(r.perDaySalary)}</td>
                        <td className="px-2 py-2 align-middle text-center">
                          {parseFloat(r.lopDays) > 0 ? (
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-[11px] font-bold text-red-400 leading-tight">{parseFloat(r.lopDays).toFixed(1)}</span>
                              <span className="text-[9px] text-red-400/80 leading-tight">{formatCurrency(r.lopAmount)}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-admin-secondary">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[11px] text-admin-text font-bold align-middle">{formatCurrency(r.netEarning)}</td>
                        <td className="px-2 py-2 text-[11px] text-admin-muted align-middle">{formatCurrency(r.basicSalary)}</td>
                        <td className="px-2 py-2 text-[11px] text-admin-muted align-middle">{formatCurrency(r.hra)}</td>
                        <td className="px-2 py-2 text-[11px] text-admin-muted align-middle">{formatCurrency(r.specialAllowance)}</td>
                        <td className="px-2 py-2 text-[11px] text-red-400 align-middle">{formatCurrency(r.staffAdvance)}</td>
                        <td className="px-2 py-2 text-[11px] text-red-400 align-middle">{formatCurrency(r.professionalTax)}</td>
                        <td className="px-2 py-2 text-[11px] text-red-400 align-middle">{formatCurrency(r.tds)}</td>
                        <td className="px-2 py-2 text-[11px] font-bold text-emerald-400 align-middle">{formatCurrency(r.netPayable)}</td>
                        <td className="px-2 py-2 align-middle">
                          <select
                            value={r.status || 'pending'}
                            onChange={(e) => handleStatusChange(r.id, e.target.value)}
                            disabled={!hasPermission('payroll', 'can_edit')}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg outline-none cursor-pointer border ${r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              r.status === 'hold' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              } ${!hasPermission('payroll', 'can_edit') ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <option value="pending" className="bg-admin-bg text-admin-text">Pending</option>
                            <option value="hold" className="bg-admin-bg text-admin-text">Hold</option>
                            <option value="paid" className="bg-admin-bg text-admin-text">Paid</option>
                          </select>
                        </td>
                        <td className="actions-column px-2 py-2 align-middle">
                          <div className="action-buttons">
                            {hasPermission('payroll', 'can_edit') && (
                              <button onClick={() => openEditModal(r)} className="action-icon-btn bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors" title="Edit Payroll">
                                <FiEdit2 size={16} />
                              </button>
                            )}
                            {hasPermission('payroll', 'can_calculate') && (
                              <button onClick={() => handleCalculateSingle(r)} disabled={calculatingRowId === r.employeeId} className="action-icon-btn bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-50" title="Recalculate Payroll">
                                <FiRefreshCw size={16} className={calculatingRowId === r.employeeId ? 'animate-spin' : ''} />
                              </button>
                            )}
                            {hasPermission('payroll', 'can_export') && (
                              <button onClick={() => handleDownloadPaySlip(r)} disabled={loadingPaySlipId === r.employeeId} className="action-icon-btn bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-50" title="Download Pay Slip">
                                {loadingPaySlipId === r.employeeId ? <FiRefreshCw size={16} className="animate-spin" /> : <FiFileText size={16} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Payroll Modal */}
      {showEditModal && editingRow && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-3xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border shrink-0">
              <h2 className="text-lg font-bold text-admin-text">Edit Payroll - {editingRow.employeeName} ({editingRow.employeeCode})</h2>
              <button onClick={closeEditModal} className="text-admin-secondary hover:text-admin-text"><FiX size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto dark-scroll flex-1">
              <form id="edit-payroll-form" onSubmit={handleSaveEdit} className="space-y-6">
                
                {/* Read-Only Fields */}
                <div>
                  <h3 className="text-xs font-bold text-admin-heading uppercase tracking-wider mb-4 border-b border-admin-border pb-2">Calculated Fields (Read-Only)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Month/Year</label>
                      <input type="text" value={`${new Date(0, month - 1).toLocaleString('default', { month: 'short' })} ${year}`} disabled className="admin-input opacity-60 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Total Days</label>
                      <input type="text" value={editingRow.totalDays} disabled className="admin-input opacity-60 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Half Days</label>
                      <input type="text" value={editingRow.halfDays} disabled className="admin-input opacity-60 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Per Day Salary (₹)</label>
                      <input type="text" value={editingRow.perDaySalary} disabled className="admin-input opacity-60 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Net Earning (₹)</label>
                      <input type="text" value={editingRow.netEarning} disabled className="admin-input opacity-60 cursor-not-allowed font-bold text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* Editable Attendance Values */}
                <div>
                  <h3 className="text-xs font-bold text-admin-heading uppercase tracking-wider mb-4 border-b border-admin-border pb-2">Editable Attendance Values</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Work Days</label>
                      <input type="number" step="0.5" min="0" name="workingDays" value={editingRow.workingDays} onChange={handleEditChange} required className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Paid Days</label>
                      <input type="number" step="0.5" min="0" name="paidDays" value={editingRow.paidDays} onChange={handleEditChange} required className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">LOP Days</label>
                      <input type="number" step="0.5" min="0" name="lopDays" value={editingRow.lopDays} onChange={handleEditChange} required className="admin-input" />
                    </div>
                  </div>
                </div>

                {/* Editable Fields */}
                <div>
                  <h3 className="text-xs font-bold text-admin-heading uppercase tracking-wider mb-4 border-b border-admin-border pb-2">Editable Salary & Deductions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Monthly Salary (₹)</label>
                      <input type="number" step="0.01" min="0" name="monthlyEarning" value={editingRow.monthlyEarning} onChange={handleEditChange} required className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Basic (₹)</label>
                      <input type="number" step="0.01" min="0" name="basicSalary" value={editingRow.basicSalary} onChange={handleEditChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">HRA (₹)</label>
                      <input type="number" step="0.01" min="0" name="hra" value={editingRow.hra} onChange={handleEditChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Special Allowance (₹)</label>
                      <input type="number" step="0.01" min="0" name="specialAllowance" value={editingRow.specialAllowance} onChange={handleEditChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1 text-orange-400">Staff Advance (₹)</label>
                      <input type="number" step="0.01" min="0" name="staffAdvance" value={editingRow.staffAdvance} onChange={handleEditChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1 text-orange-400">PT (₹)</label>
                      <input type="number" step="0.01" min="0" name="professionalTax" value={editingRow.professionalTax} onChange={handleEditChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1 text-orange-400">TDS (₹)</label>
                      <input type="number" step="0.01" min="0" name="tds" value={editingRow.tds} onChange={handleEditChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Status</label>
                      <select name="status" value={editingRow.status} onChange={handleEditChange} className="admin-select text-admin-muted">
                        <option value="pending" className="bg-admin-bg text-admin-text">Pending</option>
                        <option value="hold" className="bg-admin-bg text-admin-text">Hold</option>
                        <option value="paid" className="bg-admin-bg text-admin-text">Paid</option>
                      </select>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-surface rounded-b-2xl shrink-0">
              <button type="button" onClick={closeEditModal} className="px-4 py-2 text-sm font-semibold text-admin-secondary hover:text-admin-text transition-colors">Cancel</button>
              <button type="submit" form="edit-payroll-form" disabled={savingEdit} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all shadow-glow-blue-sm disabled:opacity-50 flex items-center gap-2">
                {savingEdit ? <Spinner size={14} color="white" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paySlipData && (
        <PayrollPaySlip 
          data={paySlipData} 
          onClose={() => setPaySlipData(null)} 
          logoPath="/favicon/web-app-manifest-192x192.png" 
        />
      )}

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      
      <ClearRangeDialog 
        isOpen={clearDialog.isOpen} 
        onClose={() => setClearDialog({ isOpen: false })} 
        onConfirm={handleClearRange} 
        title="Clear Payroll Range" 
        message="⚠️ WARNING: This will permanently delete ALL payroll records for the selected date range. This action cannot be undone." 
        isLoading={clearDialog.isLoading}
      />

      <AdminToast
        message={toastConfig.message}
        type={toastConfig.type}
        onClose={() => setToastConfig({ message: '', type: 'success' })}
      />
    </div>
  );
};

export default AdminPayroll;
