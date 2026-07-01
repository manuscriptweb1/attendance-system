import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import { Spinner } from '../components/Loader';
import api from '../services/api';
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

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payroll', { params: { month, year } });
      if (res.data.success) {
        setRecords(res.data.records);
        setIsCalculated(res.data.isCalculated);
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to fetch payroll data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [month, year]); // eslint-disable-line

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      const res = await api.post('/payroll/calculate', { month, year });
      if (res.data.success) {
        setAlertDialog({ isOpen: true, title: 'Success', message: 'Payroll calculated successfully!', type: 'success' });
        fetchPayroll();
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to calculate payroll', type: 'error' });
    } finally {
      setCalculating(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/payroll/export', { params: { month, year }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; 
      link.download = `Payroll_${month}_${year}.xlsx`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to export payroll', type: 'error' });
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
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to update status', type: 'error' });
    }
  };

  const totalNetPayable = records.reduce((sum, r) => sum + (parseFloat(r.netPayable) || 0), 0);

  return (
    <div className="flex h-screen bg-[#0E1320] dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Payroll Management</h1>
              <p className="text-sm text-[#94A3B8] mt-1.5 font-medium">Calculate and process monthly employee salaries.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="admin-select py-2 text-sm text-[#94A3B8]">
                  {[...Array(12).keys()].map(m => (
                    <option key={m+1} value={m+1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="admin-select py-2 text-sm text-[#94A3B8]">
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
          <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-2 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                 <FiDollarSign size={20} className="text-emerald-400" />
               </div>
               <span className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Total Net Payable</span>
             </div>
             <span className="text-2xl font-extrabold text-white">{formatCurrency(totalNetPayable)}</span>
          </div>

          {/* Table */}
          <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Spinner size={36} color="blue" />
              </div>
            ) : !isCalculated ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <FiDollarSign size={28} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Payroll Not Calculated</h3>
                <p className="text-sm text-[#64748B] max-w-md text-center">Click "Calculate All" to generate salary records for {new Date(0, month-1).toLocaleString('default', { month: 'long' })} {year}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-[#0E1320]/80">
                    <tr>
                      {[
                        'Employee', 'Total Days', 'Working Days', 'Paid Days', 'Half Days', 
                        'Monthly Earning', 'Per Day Salary', 'LOP Days', 'Net Earning', 
                        'Basic', 'HRA', 'Special Allowance', 'Staff Advance', 'PT', 'TDS', 'Net Payable', 'Status'
                      ].map(h => (
                        <th key={h} className="px-5 py-4 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {records.map(r => (
                      <tr key={r.id} className="admin-table-row hover:bg-[#0B1120]/[0.02] transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-white">{r.employeeName}</div>
                          <div className="text-xs text-[#94A3B8] font-mono">{r.employeeCode}</div>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-white whitespace-nowrap">{r.totalDays}</td>
                        <td className="px-5 py-4 text-xs text-[#CBD5E1] whitespace-nowrap">{r.workingDays}</td>
                        <td className="px-5 py-4 text-xs font-bold text-emerald-400 whitespace-nowrap">{parseFloat(r.paidDays).toFixed(1)}</td>
                        <td className="px-5 py-4 text-xs text-yellow-500 whitespace-nowrap">{r.halfDays > 0 ? r.halfDays : '-'}</td>
                        <td className="px-5 py-4 text-xs text-white whitespace-nowrap">{formatCurrency(r.monthlyEarning)}</td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8] whitespace-nowrap">₹{parseFloat(r.perDaySalary).toFixed(0)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {parseFloat(r.lopDays) > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-red-400">{parseFloat(r.lopDays).toFixed(1)} days</span>
                              <span className="text-[10px] text-red-400/80">{formatCurrency(r.lopAmount)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#64748B]">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-white whitespace-nowrap">{formatCurrency(r.netEarning)}</td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8] whitespace-nowrap">{formatCurrency(r.basicSalary)}</td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8] whitespace-nowrap">{formatCurrency(r.hra)}</td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8] whitespace-nowrap">{formatCurrency(r.specialAllowance)}</td>
                        <td className="px-5 py-4 text-xs text-red-400 whitespace-nowrap">{formatCurrency(r.staffAdvance)}</td>
                        <td className="px-5 py-4 text-xs text-red-400 whitespace-nowrap">{formatCurrency(r.professionalTax)}</td>
                        <td className="px-5 py-4 text-xs text-red-400 whitespace-nowrap">{formatCurrency(r.tds)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-emerald-400 whitespace-nowrap">{formatCurrency(r.netPayable)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <select 
                            value={r.status || 'pending'}
                            onChange={(e) => handleStatusChange(r.id, e.target.value)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer border ${
                              r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              r.status === 'hold' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                              'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            }`}
                          >
                            <option value="pending" className="bg-[#1C2540] text-white">Pending</option>
                            <option value="hold" className="bg-[#1C2540] text-white">Hold</option>
                            <option value="paid" className="bg-[#1C2540] text-white">Paid</option>
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
    </div>
  );
};

export default AdminPayroll;
