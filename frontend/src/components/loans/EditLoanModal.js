import React, { useState, useEffect } from 'react';
import { FiX, FiEdit2, FiCheckCircle, FiLock, FiLayers } from 'react-icons/fi';
import { Spinner } from '../Loader';

export default function EditLoanModal({ isOpen, onClose, onSave, loan }) {
  const currentYear = new Date().getFullYear();

  const [calculationMode, setCalculationMode] = useState('by_months');
  const [totalAmount, setTotalAmount] = useState('');
  const [repaymentMonths, setRepaymentMonths] = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [firstDeductionMonth, setFirstDeductionMonth] = useState('');
  const [firstDeductionYear, setFirstDeductionYear] = useState('');
  const [loanIssueDate, setLoanIssueDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const [previewData, setPreviewData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const hasPostedDeductions = loan ? (loan.totalPostedDeduction > 0 || loan.completedInstalments > 0) : false;

  const toPaise = (rupees) => Math.round(parseFloat(rupees || 0) * 100);
  const toRupees = (paise) => (paise / 100);

  useEffect(() => {
    if (loan) {
      setCalculationMode(loan.calculationMode || 'by_months');
      setTotalAmount(loan.totalLoanAmount ? String(loan.totalLoanAmount) : '');
      setRepaymentMonths(loan.repaymentMonths ? String(loan.repaymentMonths) : '3');
      setMonthlyDeduction(loan.monthlyDeduction ? String(loan.monthlyDeduction) : '');
      setFirstDeductionMonth(loan.firstDeductionMonth || 1);
      setFirstDeductionYear(loan.firstDeductionYear || currentYear);
      setLoanIssueDate(loan.loanIssueDate ? new Date(loan.loanIssueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setRemarks(loan.remarks || '');
    }
  }, [loan]);

  // Live Repayment Schedule Preview & Field Synchronization
  useEffect(() => {
    if (hasPostedDeductions) return;

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

  }, [totalAmount, calculationMode, repaymentMonths, monthlyDeduction, firstDeductionMonth, firstDeductionYear, hasPostedDeductions]);

  if (!isOpen || !loan) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const payload = { id: loan.id, remarks };

    if (!hasPostedDeductions) {
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

      payload.totalAmount = amountNum;
      payload.calculationMode = calculationMode;
      payload.repaymentMonths = parseInt(repaymentMonths);
      payload.monthlyDeduction = parseFloat(monthlyDeduction);
      payload.firstDeductionMonth = parseInt(firstDeductionMonth);
      payload.firstDeductionYear = parseInt(firstDeductionYear);
      payload.loanIssueDate = loanIssueDate;
    }

    setSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update loan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-3xl animate-scale-in flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border">
          <div>
            <h2 className="text-lg font-bold text-admin-heading flex items-center gap-2">
              <FiEdit2 className="text-purple-400" /> Edit Employee Loan ({loan.loanCode})
            </h2>
            <p className="text-xs text-admin-muted">
              {hasPostedDeductions
                ? 'Deductions have already started. Financial parameters are locked to preserve audit history.'
                : 'Modify loan financial terms or calculation mode before deductions begin.'}
            </p>
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

          {hasPostedDeductions && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <FiLock /> Loan repayment is active ({loan.completedInstalments} / {loan.repaymentMonths} instalments posted, ₹{loan.totalPostedDeduction.toLocaleString('en-IN')} repaid). Only remarks can be edited.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Calculation Mode Radio Buttons */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Calculation Mode {hasPostedDeductions && <span className="text-amber-400">(Locked)</span>}
              </label>
              <div className={`flex items-center gap-6 bg-admin-bg/60 p-3 rounded-xl border border-admin-border ${
                hasPostedDeductions ? 'opacity-60 cursor-not-allowed' : ''
              }`}>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-admin-text">
                  <input
                    type="radio"
                    name="editCalculationMode"
                    value="by_months"
                    disabled={hasPostedDeductions}
                    checked={calculationMode === 'by_months'}
                    onChange={(e) => setCalculationMode(e.target.value)}
                    className="accent-purple-500"
                  />
                  By Repayment Months
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-admin-text">
                  <input
                    type="radio"
                    name="editCalculationMode"
                    value="by_emi"
                    disabled={hasPostedDeductions}
                    checked={calculationMode === 'by_emi'}
                    onChange={(e) => setCalculationMode(e.target.value)}
                    className="accent-purple-500"
                  />
                  By Monthly Deduction
                </label>
              </div>
            </div>

            {/* Total Loan Amount */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Total Loan Amount (₹)
              </label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  step="0.01"
                  disabled={hasPostedDeductions}
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className={`admin-input admin-input-has-prefix w-full py-2.5 pr-3 text-xs font-bold tracking-wide ${
                    hasPostedDeductions ? 'bg-admin-bg/60 text-admin-muted cursor-not-allowed' : ''
                  }`}
                  required
                />
              </div>
            </div>

            {/* Repayment Months */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Repayment Period (Months) {calculationMode === 'by_months' ? null : <span className="text-purple-400">(Auto Calculated)</span>}
              </label>
              <input
                type="number"
                min="1"
                max="120"
                disabled={hasPostedDeductions || calculationMode === 'by_emi'}
                value={repaymentMonths}
                onChange={(e) => setRepaymentMonths(e.target.value)}
                className={`admin-input w-full py-2 px-3 text-xs font-semibold ${
                  hasPostedDeductions || calculationMode === 'by_emi' ? 'bg-admin-bg/60 text-purple-300 cursor-not-allowed border-purple-500/30' : ''
                }`}
                required={calculationMode === 'by_months'}
              />
            </div>

            {/* Monthly Deduction (EMI) */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Monthly Deduction (EMI ₹) {calculationMode === 'by_emi' ? null : <span className="text-purple-400">(Auto Calculated)</span>}
              </label>
              <div className="currency-input-wrapper">
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  step="0.01"
                  disabled={hasPostedDeductions || calculationMode === 'by_months'}
                  value={monthlyDeduction}
                  onChange={(e) => setMonthlyDeduction(e.target.value)}
                  className={`admin-input admin-input-has-prefix w-full py-2.5 pr-3 text-xs font-bold tracking-wide ${
                    hasPostedDeductions || calculationMode === 'by_months' ? 'bg-admin-bg/60 text-purple-300 cursor-not-allowed border-purple-500/30' : ''
                  }`}
                  required={calculationMode === 'by_emi'}
                />
              </div>
            </div>

            {/* First Deduction Month */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                First Deduction Month
              </label>
              <select
                disabled={hasPostedDeductions}
                value={firstDeductionMonth}
                onChange={(e) => setFirstDeductionMonth(e.target.value)}
                className={`admin-select w-full py-2 px-3 text-xs ${hasPostedDeductions ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* First Deduction Year */}
            <div>
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                First Deduction Year
              </label>
              <select
                disabled={hasPostedDeductions}
                value={firstDeductionYear}
                onChange={(e) => setFirstDeductionYear(e.target.value)}
                className={`admin-select w-full py-2 px-3 text-xs ${hasPostedDeductions ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                disabled={hasPostedDeductions}
                value={loanIssueDate}
                onChange={(e) => setLoanIssueDate(e.target.value)}
                className={`admin-input w-full py-2 px-3 text-xs ${hasPostedDeductions ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* Remarks */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-admin-secondary uppercase tracking-wider mb-1.5">
                Remarks / Purpose
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

          {/* Live Summary Panel */}
          {previewData && !hasPostedDeductions && (
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
          {previewData && !hasPostedDeductions && (
            <div className="border border-purple-500/30 bg-purple-500/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-purple-400 border-b border-purple-500/20 pb-2">
                <span className="flex items-center gap-1.5">
                  <FiCheckCircle /> Updated Repayment Schedule Preview
                </span>
                <span>Instalments: {previewData.schedule.length} | Monthly: ₹{previewData.monthlyDeductionRupees.toLocaleString('en-IN')}</span>
              </div>

              <div className="max-h-44 overflow-y-auto dark-scroll">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-purple-500/20 text-[10px] text-admin-secondary uppercase font-bold">
                      <th className="py-1.5 px-2">Instalment</th>
                      <th className="py-1.5 px-2">Payroll Month</th>
                      <th className="py-1.5 px-2 text-right">Deduction Amount (₹)</th>
                      <th className="py-1.5 px-2 text-right">Remaining Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/10">
                    {previewData.schedule.map(s => (
                      <tr key={s.instalmentNumber} className="hover:bg-purple-500/10 text-admin-text">
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
              className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? <Spinner size={16} color="white" /> : <FiCheckCircle />} Save Loan Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
