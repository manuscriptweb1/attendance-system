import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiDollarSign, FiCheckCircle, FiLayers, FiSearch } from 'react-icons/fi';
import { Spinner } from '../Loader';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AddLoanModal({ isOpen, onClose, onSave, employees = [] }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const employeeSearchRef = useRef(null);

  const [calculationMode, setCalculationMode] = useState('by_months'); // 'by_months' or 'by_emi'
  const [totalAmount, setTotalAmount] = useState('');
  const [repaymentMonths, setRepaymentMonths] = useState('3');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [firstDeductionMonth, setFirstDeductionMonth] = useState(currentMonth);
  const [firstDeductionYear, setFirstDeductionYear] = useState(currentYear);
  const [loanIssueDate, setLoanIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const [previewData, setPreviewData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        employeeSearchRef.current &&
        !employeeSearchRef.current.contains(event.target)
      ) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper integer paise conversion to avoid floating point inaccuracies
  const toPaise = (rupees) => Math.round(parseFloat(rupees || 0) * 100);
  const toRupees = (paise) => (paise / 100);

  // Live Repayment Schedule Preview & Field Synchronization
  useEffect(() => {
    const amountNum = parseFloat(totalAmount);
    if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
      setPreviewData(null);
      return;
    }

    const totalPaise = toPaise(amountNum);
    let calculatedMonths = 1;
    let targetEmiPaise = 0;

    if (calculationMode === 'by_emi') {
      const emiNum = parseFloat(monthlyDeduction);
      if (!emiNum || emiNum <= 0 || isNaN(emiNum) || emiNum > amountNum) {
        setPreviewData(null);
        return;
      }
      targetEmiPaise = toPaise(emiNum);
      let rawMonths = Math.ceil(totalPaise / targetEmiPaise);
      if (rawMonths > 1) {
        let remainderPaise = totalPaise - (targetEmiPaise * (rawMonths - 1));
        if (remainderPaise > 0 && remainderPaise <= 50) {
          calculatedMonths = rawMonths - 1;
        } else {
          calculatedMonths = rawMonths;
        }
      } else {
        calculatedMonths = 1;
      }
      setRepaymentMonths(String(calculatedMonths));
    } else {
      // Mode 1: By Repayment Months
      const monthsNum = parseInt(repaymentMonths);
      if (!monthsNum || monthsNum <= 0 || !Number.isInteger(monthsNum)) {
        setPreviewData(null);
        return;
      }
      calculatedMonths = Math.min(120, monthsNum);
      targetEmiPaise = Math.floor(totalPaise / calculatedMonths);
      setMonthlyDeduction((targetEmiPaise / 100).toFixed(2));
    }

    // Build Live Schedule
    const schedule = [];
    let m = parseInt(firstDeductionMonth);
    let y = parseInt(firstDeductionYear);
    let cumulativePaise = 0;
    let remainingPaise = totalPaise;

    for (let i = 1; i <= calculatedMonths; i++) {
      let instPaise;
      if (calculationMode === 'by_emi') {
        if (i === calculatedMonths) {
          instPaise = remainingPaise;
        } else {
          instPaise = Math.min(targetEmiPaise, remainingPaise);
        }
      } else {
        const baseMonthlyPaise = Math.floor(totalPaise / calculatedMonths);
        const remainderPaise = totalPaise - (baseMonthlyPaise * calculatedMonths);
        instPaise = baseMonthlyPaise;
        if (i === calculatedMonths) {
          instPaise += remainderPaise;
        }
      }

      remainingPaise -= instPaise;
      cumulativePaise += instPaise;

      schedule.push({
        instalmentNumber: i,
        payrollMonthName: monthNames[m - 1],
        payrollYear: y,
        scheduledAmountRupees: toRupees(instPaise),
        remainingBalanceRupees: toRupees(totalPaise - cumulativePaise)
      });

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    const lastInst = schedule[schedule.length - 1];
    setPreviewData({
      monthlyDeductionRupees: schedule[0] ? schedule[0].scheduledAmountRupees : 0,
      lastInstalmentRupees: lastInst ? lastInst.scheduledAmountRupees : 0,
      expectedCompletionMonthName: lastInst ? lastInst.payrollMonthName : monthNames[firstDeductionMonth - 1],
      expectedCompletionYear: lastInst ? lastInst.payrollYear : firstDeductionYear,
      schedule
    });

  }, [totalAmount, calculationMode, repaymentMonths, monthlyDeduction, firstDeductionMonth, firstDeductionYear]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedEmployeeId) {
      setErrorMsg('Please select an employee');
      return;
    }
    const amountNum = parseFloat(totalAmount);
    if (!amountNum || amountNum <= 0 || isNaN(amountNum)) {
      setErrorMsg('Total loan amount must be greater than 0');
      return;
    }

    if (calculationMode === 'by_emi') {
      const emiNum = parseFloat(monthlyDeduction);
      if (!emiNum || emiNum <= 0 || isNaN(emiNum)) {
        setErrorMsg('Monthly deduction must be greater than 0');
        return;
      }
      if (emiNum > amountNum) {
        setErrorMsg('Monthly deduction cannot exceed total loan amount');
        return;
      }
    } else {
      const monthsNum = parseInt(repaymentMonths);
      if (!monthsNum || monthsNum <= 0 || !Number.isInteger(monthsNum)) {
        setErrorMsg('Repayment months must be a positive whole number');
        return;
      }
      if (monthsNum > 120) {
        setErrorMsg('Repayment months cannot exceed 120');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSave({
        employeeId: selectedEmployeeId,
        totalAmount: amountNum,
        calculationMode,
        repaymentMonths: parseInt(repaymentMonths),
        monthlyDeduction: parseFloat(monthlyDeduction),
        firstDeductionMonth: parseInt(firstDeductionMonth),
        firstDeductionYear: parseInt(firstDeductionYear),
        loanIssueDate,
        remarks
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create loan');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEmp = employees.find(e => String(e.id) === String(selectedEmployeeId) || String(e.employee_id) === String(selectedEmployeeId));

  return (
    <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-3xl animate-scale-in flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border">
          <div>
            <h2 className="text-lg font-bold text-admin-heading flex items-center gap-2">
              <FiDollarSign className="text-emerald-400" /> Create Interest-Free Employee Loan
            </h2>
            <p className="text-xs text-admin-muted">Add a new loan using Flexible Calculation Mode. Monthly deductions integrate into daily payroll.</p>
          </div>
          <button onClick={onClose} className="text-admin-secondary hover:text-admin-text">
            <FiX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto dark-scroll space-y-5 flex-1">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Searchable Employee Selection */}
            <div className="sm:col-span-2 relative" ref={employeeSearchRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider">
                  Select Employee <span className="text-red-400">*</span>
                </label>
                {selectedEmployeeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeId('');
                      setEmployeeSearchQuery('');
                      setIsEmployeeDropdownOpen(true);
                    }}
                    className="text-[11px] text-admin-muted hover:text-rose-400 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <FiX size={12} /> Clear Selection
                  </button>
                )}
              </div>

              {/* Selected Employee Display Card */}
              {selectedEmp && !isEmployeeDropdownOpen ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-admin-bg border border-emerald-500/30 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {(selectedEmp.name || 'EM')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-admin-text truncate">
                          {selectedEmp.name}
                        </p>
                        <span className="font-mono text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                          {selectedEmp.employee_id || selectedEmp.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-admin-secondary mt-0.5 truncate">
                        {selectedEmp.department_name || selectedEmp.department || 'General'}
                        {(selectedEmp.job_role || selectedEmp.designation) ? ` • ${selectedEmp.job_role || selectedEmp.designation}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmployeeDropdownOpen(true);
                      setEmployeeSearchQuery('');
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ml-2"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Search Input Box */
                <div className="relative">
                  <FiSearch
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-admin-muted pointer-events-none"
                  />
                  <input
                    type="text"
                    autoFocus={isEmployeeDropdownOpen}
                    placeholder="Search by employee name, department, or employee ID..."
                    value={employeeSearchQuery}
                    onFocus={() => setIsEmployeeDropdownOpen(true)}
                    onChange={(e) => {
                      setEmployeeSearchQuery(e.target.value);
                      setIsEmployeeDropdownOpen(true);
                    }}
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text placeholder:text-admin-muted font-medium focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  {employeeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setEmployeeSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-text p-1 cursor-pointer"
                      title="Clear search"
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Search Results Dropdown List */}
              {isEmployeeDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-40 max-h-60 overflow-y-auto rounded-xl bg-admin-surface border border-admin-border shadow-2xl dark-scroll p-1.5 space-y-1">
                  {(() => {
                    const filteredEmployees = employees.filter((emp) => {
                      if (!employeeSearchQuery.trim()) return true;
                      const q = employeeSearchQuery.toLowerCase().trim();
                      const nameMatch = (emp.name || '').toLowerCase().includes(q);
                      const idMatch = (emp.employee_id || String(emp.id) || '').toLowerCase().includes(q);
                      const deptMatch = (emp.department_name || emp.department || '').toLowerCase().includes(q);
                      const roleMatch = (emp.job_role || emp.designation || '').toLowerCase().includes(q);
                      return nameMatch || idMatch || deptMatch || roleMatch;
                    });

                    if (filteredEmployees.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-admin-muted">
                          No employees found matching &quot;{employeeSearchQuery}&quot;
                        </div>
                      );
                    }

                    return filteredEmployees.map((emp) => {
                      const isSelected = String(emp.id) === String(selectedEmployeeId) || String(emp.employee_id) === String(selectedEmployeeId);
                      return (
                        <button
                          key={emp.id || emp.employee_id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId(emp.id || emp.employee_id);
                            setIsEmployeeDropdownOpen(false);
                            setEmployeeSearchQuery('');
                            setErrorMsg('');
                          }}
                          className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between group cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 border border-emerald-500/30'
                              : 'hover:bg-admin-elevated border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-admin-bg border border-admin-border text-admin-text font-bold text-[11px] flex items-center justify-center flex-shrink-0 group-hover:border-emerald-500/50">
                              {(emp.name || 'EM')
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-admin-text truncate group-hover:text-emerald-400 transition-colors">
                                  {emp.name}
                                </p>
                                <span className="font-mono text-[10px] text-admin-muted font-semibold px-1.5 py-0.5 rounded bg-admin-bg border border-admin-border">
                                  {emp.employee_id || emp.id}
                                </span>
                              </div>
                              <p className="text-[11px] text-admin-secondary mt-0.5 truncate">
                                {emp.department_name || emp.department || 'General'}
                                {(emp.job_role || emp.designation) ? ` • ${emp.job_role || emp.designation}` : ''}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 pl-2">
                              <FiCheckCircle size={14} /> Selected
                            </span>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Calculation Mode Radio Buttons */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Calculation Mode <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-6 bg-admin-bg/60 p-3 rounded-xl border border-admin-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-admin-text">
                  <input
                    type="radio"
                    name="calculationMode"
                    value="by_months"
                    checked={calculationMode === 'by_months'}
                    onChange={(e) => setCalculationMode(e.target.value)}
                    className="accent-purple-500"
                  />
                  By Repayment Months (Default)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-admin-text">
                  <input
                    type="radio"
                    name="calculationMode"
                    value="by_emi"
                    checked={calculationMode === 'by_emi'}
                    onChange={(e) => setCalculationMode(e.target.value)}
                    className="accent-purple-500"
                  />
                  By Monthly Deduction (NEW)
                </label>
              </div>
            </div>

            {/* Total Loan Amount */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Total Loan Amount (₹) <span className="text-red-400">*</span>
              </label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 10000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="admin-input admin-input-has-prefix w-full py-2.5 pr-3 text-xs font-bold tracking-wide"
                  required
                />
              </div>
            </div>

            {/* Repayment Months */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Repayment Period (Months) {calculationMode === 'by_months' ? <span className="text-red-400">*</span> : <span className="text-purple-400">(Auto Calculated)</span>}
              </label>
              <input
                type="number"
                min="1"
                max="120"
                placeholder="e.g. 3"
                value={repaymentMonths}
                readOnly={calculationMode === 'by_emi'}
                onChange={(e) => setRepaymentMonths(e.target.value)}
                className={`admin-input w-full py-2 px-3 text-xs font-semibold ${
                  calculationMode === 'by_emi' ? 'bg-admin-bg/60 text-purple-300 cursor-not-allowed border-purple-500/30' : ''
                }`}
                required={calculationMode === 'by_months'}
              />
            </div>

            {/* Monthly Deduction (EMI) */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Monthly Deduction (EMI ₹) {calculationMode === 'by_emi' ? <span className="text-red-400">*</span> : <span className="text-purple-400">(Auto Calculated)</span>}
              </label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2500"
                  value={monthlyDeduction}
                  readOnly={calculationMode === 'by_months'}
                  onChange={(e) => setMonthlyDeduction(e.target.value)}
                  className={`admin-input admin-input-has-prefix w-full py-2.5 pr-3 text-xs font-bold tracking-wide ${
                    calculationMode === 'by_months' ? 'bg-admin-bg/60 text-purple-300 cursor-not-allowed border-purple-500/30' : ''
                  }`}
                  required={calculationMode === 'by_emi'}
                />
              </div>
            </div>

            {/* First Deduction Month */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                First Deduction Month <span className="text-red-400">*</span>
              </label>
              <select
                value={firstDeductionMonth}
                onChange={(e) => setFirstDeductionMonth(e.target.value)}
                className="admin-select w-full py-2 px-3 text-xs"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* First Deduction Year */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                First Deduction Year <span className="text-red-400">*</span>
              </label>
              <select
                value={firstDeductionYear}
                onChange={(e) => setFirstDeductionYear(e.target.value)}
                className="admin-select w-full py-2 px-3 text-xs"
              >
                {[...Array(5).keys()].map(y => {
                  const yearVal = currentYear - 1 + y;
                  return <option key={yearVal} value={yearVal}>{yearVal}</option>;
                })}
              </select>
            </div>

            {/* Loan Issue Date */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Loan Issue Date
              </label>
              <input
                type="date"
                value={loanIssueDate}
                onChange={(e) => setLoanIssueDate(e.target.value)}
                className="admin-input w-full py-2 px-3 text-xs"
              />
            </div>

            {/* Remarks */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Remarks / Purpose (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Medical emergency loan"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="admin-input w-full py-2 px-3 text-xs"
              />
            </div>
          </div>

          {/* New Live Summary Panel */}
          {previewData && (
            <div className="bg-admin-bg/80 border border-purple-500/30 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <FiLayers /> Live Loan Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-admin-secondary font-sans block">Loan Amount</span>
                  <span className="font-bold text-admin-heading">₹{parseFloat(totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-admin-secondary font-sans block">Calculation Mode</span>
                  <span className="font-bold text-purple-400 font-sans">{calculationMode === 'by_emi' ? 'By Monthly Deduction' : 'By Repayment Months'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-admin-secondary font-sans block">Monthly EMI</span>
                  <span className="font-bold text-emerald-400">₹{previewData.monthlyDeductionRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-admin-secondary font-sans block">Total Instalments</span>
                  <span className="font-bold text-admin-heading">{previewData.schedule.length} Months</span>
                </div>
                <div>
                  <span className="text-[10px] text-admin-secondary font-sans block">Last Instalment</span>
                  <span className="font-bold text-amber-400">₹{previewData.lastInstalmentRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-admin-secondary font-sans block">First Deduction</span>
                  <span className="font-bold text-admin-text font-sans">{monthNames[firstDeductionMonth - 1]} {firstDeductionYear}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-admin-secondary font-sans block">Completion Month</span>
                  <span className="font-bold text-emerald-300 font-sans">{previewData.expectedCompletionMonthName} {previewData.expectedCompletionYear}</span>
                </div>
              </div>
            </div>
          )}

          {/* Repayment Schedule Preview Box */}
          {previewData && (
            <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-emerald-500/20 pb-2">
                <span className="flex items-center gap-1.5">
                  <FiCheckCircle /> Repayment Schedule Preview (100% Interest-Free)
                </span>
                <span>Instalments: {previewData.schedule.length} | Monthly: ₹{previewData.monthlyDeductionRupees.toLocaleString('en-IN')}</span>
              </div>

              <div className="max-h-44 overflow-y-auto dark-scroll">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-emerald-500/20 text-[10px] text-admin-secondary uppercase font-bold">
                      <th className="py-1.5 px-2">Instalment</th>
                      <th className="py-1.5 px-2">Payroll Month</th>
                      <th className="py-1.5 px-2 text-right">Deduction Amount (₹)</th>
                      <th className="py-1.5 px-2 text-right">Remaining Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10">
                    {previewData.schedule.map(s => (
                      <tr key={s.instalmentNumber} className="hover:bg-emerald-500/10 text-admin-text">
                        <td className="py-1.5 px-2 font-mono font-semibold">Instalment {s.instalmentNumber}</td>
                        <td className="py-1.5 px-2 font-semibold">{s.payrollMonthName} {s.payrollYear}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-400">
                          ₹{s.scheduledAmountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-admin-muted">
                          ₹{s.remainingBalanceRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-admin-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? <Spinner size={16} color="white" /> : <FiCheckCircle />} Save Employee Loan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
