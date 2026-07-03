import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import { Spinner } from '../components/Loader';
import api from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';
import { validateMonthYear } from '../utils/dateValidation';
import { FiDownload, FiRefreshCw, FiDollarSign } from 'react-icons/fi';

const formatCurrency = (value) => {
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return '₹0';
  if (num < 0) return `-₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const AdminPayroll = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isCalculated, setIsCalculated] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });

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
      // Optimistic update
      const updatedRecords = records.map(r => r.id === id ? { ...r, status: newStatus } : r);
      setRecords(updatedRecords);

      const res = await api.patch(`/payroll/${id}/status`, { status: newStatus });
      if (!res.data.success) {
        // Revert on failure
        fetchPayroll();
        setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to update status', type: 'error' });
      }
    } catch (e) {
      fetchPayroll();
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
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
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleCalculate}
                  disabled={calculating}
                  className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow-blue-sm disabled:opacity-50">
                  <FiRefreshCw size={16} className={calculating ? 'animate-spin' : ''} />
                  {calculating ? 'Calculating...' : 'Calculate All'}
                </button>
                <button
                  onClick={handleExport}
                  disabled={!isCalculated || records.length === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)] disabled:opacity-50">
                  <FiDownload size={16} /> Export Excel
                </button>
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
          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-3">
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
              <div className="overflow-x-auto dark-scroll">
                <table className="w-full table-fixed divide-y divide-white/[0.04]">
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
                        { label: 'Status', w: 'w-[5%]' }
                        // Future Action column can be added here
                      ].map(c => (
                        <th key={c.label} className={`px-2 py-2 text-[10px] font-bold text-admin-secondary uppercase tracking-tighter leading-tight ${c.w} ${c.center ? 'text-center' : 'text-left'} align-middle`}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {records.map(r => (
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
                        <td className="px-2 py-2 text-[11px] text-admin-muted align-middle">₹{parseFloat(r.perDaySalary).toFixed(0)}</td>
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
                        <td className="px-2 py-2 align-middle sticky right-0 z-10 bg-admin-surface border-l border-white/[0.04] shadow-[-4px_0_15px_rgba(0,0,0,0.2)]">
                          <select
                            value={r.status || 'pending'}
                            onChange={(e) => handleStatusChange(r.id, e.target.value)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer border ${r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              r.status === 'hold' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              }`}
                          >
                            <option value="pending" className="admin-dropdown-option bg-admin-dropdown text-admin-dropdown-text">Pending</option>
                            <option value="hold" className="admin-dropdown-option bg-admin-dropdown text-admin-dropdown-text">Hold</option>
                            <option value="paid" className="admin-dropdown-option bg-admin-dropdown text-admin-dropdown-text">Paid</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <AdminToast
        message={toastConfig.message}
        type={toastConfig.type}
        onClose={() => setToastConfig({ message: '', type: 'success' })}
      />
    </div>
  );
};

export default AdminPayroll;
