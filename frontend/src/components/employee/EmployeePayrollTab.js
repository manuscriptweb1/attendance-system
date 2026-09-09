import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiDollarSign,
  FiDownload,
  FiEye,
  FiCalendar,
  FiCreditCard,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
  FiRefreshCw,
  FiFileText,
  FiLayers
} from 'react-icons/fi';
import { getEmployeePayrollHistory, downloadSinglePayslip } from '../../services/api';
import { formatIndianCurrency } from '../../utils/formatCurrency';
import PayrollPaySlip from '../PayrollPaySlip';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatDayValue = (value) => {
  const num = Number(value || 0);
  if (Number.isInteger(num)) {
    return String(num);
  }
  return String(parseFloat(num.toFixed(2)));
};

const EmployeePayrollTab = ({ employeeId, employee }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [downloadingRecordId, setDownloadingRecordId] = useState(null);
  const [error, setError] = useState(null);

  const fetchPayroll = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getEmployeePayrollHistory(employeeId);
      if (res.data?.success) {
        setData(res.data);
      } else {
        setError(res.data?.message || 'Failed to load payroll history');
      }
    } catch (err) {
      console.error('Payroll fetch error:', err);
      setError('Error loading payroll records. Please check network connection.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  // Handle direct 1-click PDF download
  const handleDirectDownload = async (record, withSignature = true) => {
    const recId = record.id;
    try {
      setDownloadingRecordId(recId);
      const empCode = employee?.employee_id || record.employee_code || record.employee_id;
      const res = await downloadSinglePayslip(empCode, record.payroll_month, record.payroll_year, withSignature);
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const mName = MONTH_NAMES[record.payroll_month - 1] || record.payroll_month;
      link.download = `Payslip_${empCode}_${mName}_${record.payroll_year}${withSignature ? '_signed' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download payslip:', err);
      alert('Failed to download payslip. Please try again.');
    } finally {
      setDownloadingRecordId(null);
    }
  };

  // Open Payslip modal
  const handleOpenPayslipModal = (record) => {
    const modalPayload = {
      employee: {
        employee_code: employee?.employee_id || record.employee_code || record.employee_id,
        name: employee?.name || record.employee_name || 'Employee',
        job_role: employee?.job_role || 'Staff',
        department: employee?.department_name || record.department_name || 'General',
        joining_date: employee?.joining_date,
        bank_name: employee?.bank_name || data?.salaryStructure?.bankDetails?.bankName,
        account_number: employee?.account_number || data?.salaryStructure?.bankDetails?.accountNumber,
        ifsc_code: employee?.ifsc_code || data?.salaryStructure?.bankDetails?.ifscCode,
        pan_card_number: employee?.pan_card_number || data?.salaryStructure?.bankDetails?.panNumber,
        aadhar_card_number: employee?.aadhar_card_number || data?.salaryStructure?.bankDetails?.aadharNumber
      },
      payroll: {
        ...record,
        month: record.payroll_month,
        year: record.payroll_year
      }
    };
    setSelectedPayslip(modalPayload);
  };

  const records = useMemo(() => data?.records || [], [data?.records]);
  const loans = useMemo(() => data?.loans || [], [data?.loans]);
  const salary = data?.salaryStructure;
  const summary = data?.summary;

  // Available years from records
  const availableYears = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      if (r.payroll_year) set.add(r.payroll_year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (selectedYear === 'ALL') return records;
    return records.filter(r => String(r.payroll_year) === String(selectedYear));
  }, [records, selectedYear]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-admin-surface/40 rounded-2xl border border-admin-border animate-pulse">
        <FiRefreshCw className="w-8 h-8 text-admin-accent animate-spin mb-3" />
        <p className="text-sm font-semibold text-admin-text-muted">Loading compensation & payroll history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl">
        <FiAlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-rose-300 mb-4">{error}</p>
        <button
          onClick={fetchPayroll}
          className="px-4 py-2 bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold rounded-xl transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Paid */}
        <div className="p-4 rounded-2xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20 flex items-center justify-center text-emerald-800 dark:text-emerald-400 flex-shrink-0">
            <FiTrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              Total Disbursed
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {formatIndianCurrency(summary?.totalNetPaid || 0)}
            </p>
            <div className="mt-1.5">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-100 font-black text-xs border border-emerald-300 dark:border-emerald-600 shadow-sm">
                Across {summary?.paidSlipsCount || 0} paid cycles
              </span>
            </div>
          </div>
        </div>

        {/* Current Monthly CTC */}
        <div className="p-4 rounded-2xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center text-blue-800 dark:text-blue-400 flex-shrink-0">
            <FiDollarSign className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              Monthly CTC
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {formatIndianCurrency(salary?.monthlySalary || 0)}
            </p>
            <div className="mt-1.5">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-950 dark:bg-blue-950/80 dark:text-blue-100 font-black text-xs border border-blue-300 dark:border-blue-600 shadow-sm">
                Annual: {formatIndianCurrency(salary?.annualCtc || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Estimated Monthly In-Hand */}
        <div className="p-4 rounded-2xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-300 dark:bg-indigo-500/10 dark:border-indigo-500/20 flex items-center justify-center text-indigo-800 dark:text-indigo-400 flex-shrink-0">
            <FiCreditCard className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              Est. Take-Home
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {formatIndianCurrency(salary?.estimatedNet || 0)}
            </p>
            <div className="mt-1.5">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-950 dark:bg-indigo-950/80 dark:text-indigo-100 font-black text-xs border border-indigo-300 dark:border-indigo-600 shadow-sm">
                After standard deductions
              </span>
            </div>
          </div>
        </div>

        {/* Total Payslips Issued */}
        <div className="p-4 rounded-2xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20 flex items-center justify-center text-amber-800 dark:text-amber-400 flex-shrink-0">
            <FiLayers className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              Total Payslips
            </span>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
              {summary?.totalSlips || 0} Records
            </p>
            <div className="mt-1.5">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100 font-black text-xs border border-amber-300 dark:border-amber-600 shadow-sm">
                {summary?.activeLoansCount ? `${summary.activeLoansCount} active loan(s)` : 'No active loans'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Salary Structure breakdown & Loans Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Compensation Structure (2 cols span) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-admin-surface border border-admin-border shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-admin-border">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiDollarSign className="text-blue-600 dark:text-blue-400" />
                Compensation & Salary Structure
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                Current active wage components, allowances, and mandatory deductions
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30">
              Active Tier
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Earnings Breakdown */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-admin-bg/50 border border-slate-200 dark:border-admin-border space-y-3">
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Gross Earnings
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Basic Salary (50%)</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatIndianCurrency(salary?.basicSalary || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">House Rent Allowance (HRA 20%)</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatIndianCurrency(salary?.hra || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Special Allowance</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatIndianCurrency(salary?.specialAllowance || 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-black text-sm text-emerald-900 dark:text-emerald-300">
                  <span>Total Monthly CTC</span>
                  <span>{formatIndianCurrency(salary?.monthlySalary || 0)}</span>
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-admin-bg/50 border border-slate-200 dark:border-admin-border space-y-3">
              <span className="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                Standard Deductions
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Professional Tax (PT)</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatIndianCurrency(salary?.professionalTax || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Tax Deducted at Source (TDS)</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatIndianCurrency(salary?.tds || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Staff Advance / Deductions</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatIndianCurrency(salary?.staffAdvance || 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-black text-sm text-indigo-900 dark:text-indigo-300">
                  <span>Net Estimated Monthly</span>
                  <span>{formatIndianCurrency(salary?.estimatedNet || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bank & Tax Information Mini Strip */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-admin-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-700 dark:text-slate-300 block text-[11px] font-bold">Bank Name</span>
              <span className="font-extrabold text-slate-900 dark:text-white truncate block">
                {salary?.bankDetails?.bankName || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-700 dark:text-slate-300 block text-[11px] font-bold">Account Number</span>
              <span className="font-extrabold text-slate-900 dark:text-white font-mono truncate block">
                {salary?.bankDetails?.accountNumber || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-700 dark:text-slate-300 block text-[11px] font-bold">IFSC Code</span>
              <span className="font-extrabold text-slate-900 dark:text-white font-mono truncate block">
                {salary?.bankDetails?.ifscCode || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-700 dark:text-slate-300 block text-[11px] font-bold">PAN / Aadhar</span>
              <span className="font-extrabold text-slate-900 dark:text-white font-mono truncate block">
                {salary?.bankDetails?.panNumber || salary?.bankDetails?.aadharNumber || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Column 3: Active Loans & Advance Deductions Tracker */}
        <div className="p-6 rounded-2xl bg-admin-surface border border-admin-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-admin-border">
              <h3 className="text-base font-bold text-admin-text flex items-center gap-2">
                <FiCreditCard className="text-amber-400" />
                Loans & Advances
              </h3>
              {loans.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {loans.length} Record(s)
                </span>
              )}
            </div>

            {loans.length === 0 ? (
              <div className="py-10 text-center text-admin-text-muted">
                <FiCreditCard className="w-8 h-8 mx-auto mb-2 text-admin-text-muted/40" />
                <p className="text-xs font-semibold">No active employee loans</p>
                <p className="text-[11px] text-admin-text-muted/60 mt-1">
                  Any company loans or advances scheduled will appear here with progress tracking.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {loans.slice(0, 2).map((loan) => {
                  const total = Number(loan.total_loan_amount || 0);
                  const remaining = Number(loan.remaining_balance || 0);
                  const repaid = Math.max(0, total - remaining);
                  const pct = total > 0 ? Math.min(100, Math.round((repaid / total) * 100)) : 0;

                  return (
                    <div key={loan.id} className="p-3.5 rounded-xl bg-admin-bg/50 border border-admin-border space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-admin-text">{loan.loan_code}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          loan.status === 'Completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {loan.status}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-admin-text-muted font-medium">
                          <span>Progress ({pct}%)</span>
                          <span>{loan.completed_instalments || 0} of {loan.repayment_months || 0} mo</span>
                        </div>
                        <div className="w-full h-2 bg-admin-border/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-admin-border/50">
                        <div>
                          <span className="text-admin-text-muted block">Remaining</span>
                          <span className="font-bold text-rose-400">{formatIndianCurrency(remaining)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-admin-text-muted block">Monthly Emi</span>
                          <span className="font-bold text-admin-text">{formatIndianCurrency(loan.monthly_deduction || 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-admin-border mt-4">
            <span className="text-[11px] text-admin-text-muted/80 block">
              Auto-deducted directly during monthly payroll calculation.
            </span>
          </div>
        </div>
      </div>

      {/* Historical Payslips Table Section */}
      <div className="p-6 rounded-2xl bg-admin-surface border border-admin-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-admin-border">
          <div>
            <h3 className="text-base font-bold text-admin-text flex items-center gap-2">
              <FiFileText className="text-admin-accent" />
              Historical Payslips & Payroll Ledger
            </h3>
            <p className="text-xs text-admin-text-muted mt-0.5">
              Archived monthly payroll records, deductions, and verified payslip PDFs
            </p>
          </div>

          {/* Year Filter Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-admin-text-muted">
              <FiCalendar />
              <span>Year:</span>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-admin-bg border border-admin-border rounded-xl text-admin-text focus:outline-none focus:border-admin-accent"
            >
              <option value="ALL">All Years ({records.length})</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-admin-text-muted">
            <FiAlertCircle className="w-10 h-10 mx-auto mb-2 text-admin-text-muted/40" />
            <p className="text-sm font-semibold text-admin-text">No payroll records found</p>
            <p className="text-xs text-admin-text-muted/70 mt-1 max-w-md mx-auto">
              Monthly payroll has not yet been calculated for this employee in the selected period.
              Once generated via the Payroll Management section, payslips will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-admin-border text-admin-text-muted uppercase tracking-wider text-[11px] font-semibold bg-admin-bg/40">
                  <th className="py-3 px-4">Pay Period</th>
                  <th className="py-3 px-4">Working Days</th>
                  <th className="py-3 px-4">Monthly CTC</th>
                  <th className="py-3 px-4">Total Deductions</th>
                  <th className="py-3 px-4">Net Payable</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border/50">
                {filteredRecords.map((r) => {
                  const mName = MONTH_NAMES[r.payroll_month - 1] || `Month ${r.payroll_month}`;
                  const adv = Number(r.staff_advance || 0);
                  const pt = Number(r.professional_tax || 0);
                  const tds = Number(r.tds || 0);
                  const lop = Number(r.lop_amount || 0);
                  const halfLoss = Number(r.half_day_loss_amount || 0);
                  const totalDed = adv + pt + tds + lop + halfLoss;
                  const isDownloading = downloadingRecordId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-admin-surface-hover/50 transition">
                      {/* Period */}
                      <td className="py-3.5 px-4 font-bold text-admin-text">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-admin-accent/10 text-admin-accent flex items-center justify-center font-black text-xs">
                            {r.payroll_month}
                          </span>
                          <div>
                            <span className="block text-xs font-bold">{mName} {r.payroll_year}</span>
                            <span className="block text-[10px] text-admin-text-muted">
                              Cycle #{r.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Working Days */}
                      <td className="py-3.5 px-4 text-admin-text font-medium">
                        <div>
                          <span className="font-bold text-admin-text">{formatDayValue(r.paid_days)}</span>
                          <span className="text-admin-text-muted text-[11px]"> / {formatDayValue(r.total_days)} Days</span>
                        </div>
                        {Number(r.lop_days || 0) > 0 && (
                          <span className="text-[10px] font-bold text-rose-400">
                            {formatDayValue(r.lop_days)} LOP
                          </span>
                        )}
                      </td>

                      {/* Monthly CTC */}
                      <td className="py-3.5 px-4 text-admin-text font-bold">
                        {formatIndianCurrency(r.monthly_earning || 0)}
                      </td>

                      {/* Deductions */}
                      <td className="py-3.5 px-4 text-admin-text">
                        <span className="font-semibold text-rose-400 block">
                          -{formatIndianCurrency(totalDed)}
                        </span>
                        <span className="text-[10px] text-admin-text-muted">
                          {[
                            adv > 0 && `Adv: ₹${adv}`,
                            lop > 0 && `LOP: ₹${lop}`,
                            pt > 0 && `PT: ₹${pt}`,
                            tds > 0 && `TDS: ₹${tds}`
                          ].filter(Boolean).join(', ') || 'No deductions'}
                        </span>
                      </td>

                      {/* Net Payable */}
                      <td className="py-3.5 px-4">
                        <span className="font-black text-emerald-400 text-sm block">
                          {formatIndianCurrency(r.net_payable || 0)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : r.status === 'hold'
                            ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {r.status === 'paid' && <FiCheckCircle className="w-3 h-3" />}
                          {r.status === 'pending' && <FiClock className="w-3 h-3" />}
                          {r.status || 'pending'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenPayslipModal(r)}
                            className="p-2 rounded-xl bg-admin-bg hover:bg-admin-accent hover:text-white text-admin-text-muted transition border border-admin-border"
                            title="Preview Payslip Document"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDirectDownload(r, true)}
                            disabled={isDownloading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                            title="Download Official Signed PDF"
                          >
                            {isDownloading ? (
                              <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FiDownload className="w-3.5 h-3.5" />
                            )}
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payslip View Modal */}
      {selectedPayslip && (
        <PayrollPaySlip
          data={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
        />
      )}
    </div>
  );
};

export default EmployeePayrollTab;
