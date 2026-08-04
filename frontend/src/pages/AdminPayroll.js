import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import PayrollPaySlip from '../components/PayrollPaySlip';
import ClearRangeDialog from '../components/ClearRangeDialog';
import { Spinner } from '../components/Loader';
import api, {
  clearPayrollRange,
  sendPayslipEmail,
  sendSelectedPayslipEmails,
  sendAllPayslipEmails,
  getPayrollEmailLogs,
  downloadAllPayslips,
  downloadSinglePayslip
} from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';
import { validateMonthYear } from '../utils/dateValidation';
import {
  FiDownload, FiRefreshCw, FiDollarSign, FiEdit2, FiFileText, FiX, FiTrash2,
  FiMail, FiClock, FiCheckCircle, FiAlertCircle, FiUsers
} from 'react-icons/fi';
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

  // Selection & Email state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogsMap, setEmailLogsMap] = useState({});
  const [showEmailLogsModal, setShowEmailLogsModal] = useState(false);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logMonth, setLogMonth] = useState(month);
  const [logYear, setLogYear] = useState(year);
  
  // Modals & Dialogs
  const [confirmEmailDialog, setConfirmEmailDialog] = useState(null); // { type: 'single'|'selected'|'all', row?: object }
  const [emailSummaryModal, setEmailSummaryModal] = useState(null); // { summary: {}, details: [] }
  const [rowEmailLoading, setRowEmailLoading] = useState(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [calculatingRowId, setCalculatingRowId] = useState(null);
  const [sortBy, setSortBy] = useState('name_asc');

  // Pay Slip & Download State
  const [paySlipData, setPaySlipData] = useState(null);
  const [loadingPaySlipId, setLoadingPaySlipId] = useState(null);
  const [bulkDownloadModal, setBulkDownloadModal] = useState(false);
  const [singleDownloadModal, setSingleDownloadModal] = useState({ isOpen: false, row: null });
  const [payslipDownloadLoading, setPayslipDownloadLoading] = useState(null);

  const fetchEmailLogsData = async (m = month, y = year) => {
    try {
      setLoadingEmailLogs(true);
      const res = await getPayrollEmailLogs(m, y);
      if (res.data.success) {
        const logs = res.data.logs || [];
        setEmailLogs(logs);

        // Map latest log for each employee
        const map = {};
        logs.forEach(log => {
          if (log.employee_id && !map[log.employee_id]) {
            map[log.employee_id] = log;
          }
        });
        setEmailLogsMap(map);
      }
    } catch (e) {
      console.error('Fetch email logs error:', e);
    } finally {
      setLoadingEmailLogs(false);
    }
  };

  const fetchPayroll = async (isSilent = false) => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      if (!isSilent) setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      if (!isSilent) setLoading(false);
      return;
    }

    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/payroll', { params: { month, year } });
      if (res.data.success) {
        const fetchedRecords = res.data.records || [];
        setRecords(fetchedRecords);
        setIsCalculated(res.data.isCalculated);

        // Filter out selected IDs that no longer exist in loaded records
        setSelectedEmployeeIds(prev => {
          const validIds = fetchedRecords.map(r => r.employeeId || r.employeeCode);
          return prev.filter(id => validIds.includes(id));
        });
      }
    } catch (e) {
      if (!isSilent) setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    // Clear selection when month/year changes
    setSelectedEmployeeIds([]);
    fetchPayroll();
    fetchEmailLogsData(month, year);

    const interval = setInterval(() => {
      fetchPayroll(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [month, year]); // eslint-disable-line

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[month - 1] || month;

  // Selection handlers
  const sortedRecords = sortEmployeeRows(records, sortBy);
  const allVisibleIds = sortedRecords.map(r => r.employeeId || r.employeeCode);
  const isAllSelected = allVisibleIds.length > 0 && selectedEmployeeIds.length === allVisibleIds.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds([...allVisibleIds]);
    }
  };

  const toggleSelectRow = (empId) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(empId)) {
        return prev.filter(id => id !== empId);
      } else {
        return [...prev, empId];
      }
    });
  };

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
        fetchEmailLogsData(month, year);
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

  const handleExecuteBulkDownload = async (includeSignature) => {
    const loadingKey = `bulk-${includeSignature ? 'with-signature' : 'without-signature'}`;
    try {
      setPayslipDownloadLoading(loadingKey);
      const res = await downloadAllPayslips(month, year, includeSignature);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslips_${String(month).padStart(2, '0')}_${year}${includeSignature ? '_signed' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setToastConfig({ message: `Bulk payslips downloaded (${includeSignature ? 'With Signature' : 'Without Signature'})`, type: 'success' });
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    } finally {
      setPayslipDownloadLoading(null);
      setBulkDownloadModal(false);
    }
  };

  const handleExecuteSingleDownload = async (row, includeSignature) => {
    if (!row) return;
    const empCode = row.employeeCode || row.employeeId || row.id;
    const payrollId = row.id || empCode;
    const loadingKey = `${payrollId}-${includeSignature ? 'with-signature' : 'without-signature'}`;
    try {
      setPayslipDownloadLoading(loadingKey);
      const res = await downloadSinglePayslip(empCode, month, year, includeSignature);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip_${empCode}_${month}_${year}${includeSignature ? '_signed' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setToastConfig({ message: `Payslip downloaded (${includeSignature ? 'With Signature' : 'Without Signature'})`, type: 'success' });
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    } finally {
      setPayslipDownloadLoading(null);
      setSingleDownloadModal({ isOpen: false, row: null });
    }
  };

  // --- Email Handlers ---

  const handleInitiateSingleEmail = (row) => {
    const emailStr = row.emp_email || row.email || row.employeeEmail;
    setConfirmEmailDialog({
      type: 'single',
      row,
      message: (emailStr && String(emailStr).trim())
        ? `Send payslip email to ${row.employeeName || row.name} at ${emailStr} for ${currentMonthName} ${year}?`
        : `Send payslip email to ${row.employeeName || row.name} (${row.employeeCode || row.employeeId}) for ${currentMonthName} ${year}?`
    });
  };

  const handleInitiateSelectedEmails = () => {
    if (selectedEmployeeIds.length === 0) return;
    setConfirmEmailDialog({
      type: 'selected',
      message: `You are about to send payslip emails to ${selectedEmployeeIds.length} selected employee(s) for ${currentMonthName} ${year}.\n\nDo you want to continue?`
    });
  };

  const handleInitiateAllEmails = () => {
    if (records.length === 0) return;
    setConfirmEmailDialog({
      type: 'all',
      message: `You are about to send payslip emails to ALL ${records.length} employee(s) for ${currentMonthName} ${year}.\n\nDo you want to continue?`
    });
  };

  const executeConfirmEmail = async () => {
    if (!confirmEmailDialog) return;
    const { type, row } = confirmEmailDialog;
    setConfirmEmailDialog(null);

    if (type === 'single' && row) {
      const rowId = row.id || row.employeeId || row.employeeCode;
      try {
        setRowEmailLoading(rowId);
        const res = await sendPayslipEmail({
          payrollId: row.id,
          employeeId: row.employeeId,
          employeeCode: row.employeeCode,
          month,
          year
        });
        if (res.data && res.data.success) {
          setToastConfig({ message: res.data.message || 'Payslip email sent successfully!', type: 'success' });
          fetchEmailLogsData(month, year);
        } else {
          const msg = res.data?.message || 'Failed to send payslip email.';
          setAlertDialog({
            isOpen: true,
            title: msg.toLowerCase().includes('email') ? 'Email Not Available' : 'Email Dispatch Failed',
            message: msg,
            type: 'error'
          });
        }
      } catch (err) {
        const errorMsg = getErrorMessage(err);
        setAlertDialog({
          isOpen: true,
          title: errorMsg.toLowerCase().includes('email') ? 'Email Not Available' : 'Error',
          message: errorMsg,
          type: 'error'
        });
      } finally {
        setRowEmailLoading(null);
      }
    } else if (type === 'selected') {
      try {
        setSendingEmail(true);
        const res = await sendSelectedPayslipEmails(selectedEmployeeIds, month, year);
        if (res.data.success) {
          setEmailSummaryModal(res.data);
          setSelectedEmployeeIds([]);
          fetchEmailLogsData(month, year);
        } else {
          setAlertDialog({ isOpen: true, title: 'Batch Email Failed', message: res.data.message || 'Failed to send selected payslips.', type: 'error' });
        }
      } catch (err) {
        setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(err), type: 'error' });
      } finally {
        setSendingEmail(false);
      }
    } else if (type === 'all') {
      try {
        setSendingEmail(true);
        const res = await sendAllPayslipEmails(month, year);
        if (res.data.success) {
          setEmailSummaryModal(res.data);
          setSelectedEmployeeIds([]);
          fetchEmailLogsData(month, year);
        } else {
          setAlertDialog({ isOpen: true, title: 'Bulk Email Failed', message: res.data.message || 'Failed to send all payslips.', type: 'error' });
        }
      } catch (err) {
        setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(err), type: 'error' });
      } finally {
        setSendingEmail(false);
      }
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
                    <option key={m + 1} value={m + 1}>{monthNames[m]}</option>
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
                {hasPermission('payroll', 'can_view') && (
                  <button
                    onClick={() => { fetchEmailLogsData(month, year); setShowEmailLogsModal(true); }}
                    className="flex items-center gap-2 bg-admin-surface border border-admin-border hover:bg-admin-border/30 text-admin-text px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                    title="View Email Logs"
                  >
                    <FiClock size={16} className="text-purple-400" />
                    <span>Email Logs</span>
                  </button>
                )}

                {hasPermission('payroll', 'can_export') && (
                  <button
                    onClick={handleInitiateSelectedEmails}
                    disabled={selectedEmployeeIds.length === 0 || sendingEmail}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send Payslips to Selected Employees"
                  >
                    {sendingEmail ? <FiRefreshCw size={16} className="animate-spin" /> : <FiMail size={16} />}
                    <span>Send Selected Emails ({selectedEmployeeIds.length})</span>
                  </button>
                )}

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
                    onClick={() => setBulkDownloadModal(true)}
                    disabled={!isCalculated || records.length === 0}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    title="Bulk Download Payslip PDFs"
                  >
                    <FiFileText size={16} /> Bulk Payslips PDF
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
                <p className="text-sm text-admin-secondary max-w-md text-center">Click "Calculate All" to generate salary records for {currentMonthName} {year}.</p>
              </div>
            ) : (
              <div className="table-responsive dark-scroll w-full">
                <table className="w-full min-w-[1450px] table-auto divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg">
                    <tr>
                      <th className="px-2 py-2 w-[3%] text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-admin-border bg-admin-bg text-blue-600 focus:ring-blue-500 cursor-pointer align-middle"
                          title="Select All Employees"
                        />
                      </th>
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
                      return sortedRecords.map(r => {
                        const empIdKey = r.employeeId || r.employeeCode;
                        const isChecked = selectedEmployeeIds.includes(empIdKey);
                        const latestLog = emailLogsMap[empIdKey] || emailLogsMap[r.employeeCode] || emailLogsMap[r.employeeId];

                        return (
                          <tr key={r.id} className={`admin-table-row transition-colors ${isChecked ? 'bg-purple-500/[0.06] hover:bg-purple-500/[0.1]' : 'hover:bg-admin-elevated/[0.02]'}`}>
                            <td className="px-2 py-2 text-center align-middle">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectRow(empIdKey)}
                                className="w-4 h-4 rounded border-admin-border bg-admin-bg text-blue-600 focus:ring-blue-500 cursor-pointer align-middle"
                              />
                            </td>
                            <td className="px-2 py-2 align-middle">
                              <div className="flex items-center gap-1.5">
                                <div>
                                  <div className="text-[11px] font-bold text-admin-text truncate max-w-[130px] leading-tight" title={r.employeeName}>{r.employeeName}</div>
                                  <div className="text-[10px] text-admin-muted font-mono leading-tight">{r.employeeCode}</div>
                                </div>
                                {latestLog && (
                                  <span 
                                    className={`inline-flex items-center justify-center w-2 h-2 rounded-full ${
                                      latestLog.status === 'sent' ? 'bg-emerald-400' :
                                      latestLog.status === 'failed' ? 'bg-red-400' :
                                      latestLog.status === 'pending' ? 'bg-amber-400 animate-ping' : 'bg-slate-400'
                                    }`}
                                    title={`Payslip Email Status: ${latestLog.status.toUpperCase()} (${latestLog.sent_at ? new Date(latestLog.sent_at).toLocaleTimeString() : 'Sending...'})`}
                                  />
                                )}
                              </div>
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
                              <div className="payroll-action-buttons">
                                {hasPermission('payroll', 'can_edit') && (
                                  <button onClick={() => openEditModal(r)} className="payroll-action-btn bg-orange-500/10 text-orange-500 hover:bg-orange-500/20" title="Edit Payroll">
                                    <FiEdit2 />
                                  </button>
                                )}
                                {hasPermission('payroll', 'can_calculate') && (
                                  <button onClick={() => handleCalculateSingle(r)} disabled={calculatingRowId === r.employeeId} className="payroll-action-btn bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 disabled:opacity-50" title="Recalculate Payroll">
                                    <FiRefreshCw className={calculatingRowId === r.employeeId ? 'animate-spin' : ''} />
                                  </button>
                                )}
                                {hasPermission('payroll', 'can_export') && (
                                  <button onClick={() => setSingleDownloadModal({ isOpen: true, row: r })} disabled={loadingPaySlipId === r.employeeId} className="payroll-action-btn bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50" title="View/Download Pay Slip">
                                    {loadingPaySlipId === r.employeeId ? <FiRefreshCw className="animate-spin" /> : <FiFileText />}
                                  </button>
                                )}
                                {hasPermission('payroll', 'can_export') && (
                                  <button onClick={() => handleInitiateSingleEmail(r)} disabled={rowEmailLoading === (r.id || r.employeeId || r.employeeCode)} className="payroll-action-btn bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 disabled:opacity-50" title="Send Payslip Email">
                                    {rowEmailLoading === (r.id || r.employeeId || r.employeeCode) ? <FiRefreshCw className="animate-spin" /> : <FiMail />}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Email Sending */}
      {confirmEmailDialog && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl p-6 shadow-clay-admin-modal w-full max-w-md animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                <FiMail size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-admin-heading">Confirm Email Dispatch</h3>
                <p className="text-xs text-admin-muted">Google SMTP Nodemailer</p>
              </div>
            </div>
            <p className="text-sm text-admin-secondary mb-6 whitespace-pre-line leading-relaxed">
              {confirmEmailDialog.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmEmailDialog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-admin-border text-admin-secondary hover:bg-admin-border/30 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmEmail}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-500/20"
              >
                Send {confirmEmailDialog.type === 'single' ? 'Email' : 'Emails'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Summary Modal */}
      {emailSummaryModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl p-6 shadow-clay-admin-modal w-full max-w-lg animate-scale-in flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-admin-border mb-4">
              <h3 className="text-lg font-bold text-admin-heading flex items-center gap-2">
                <FiCheckCircle className="text-emerald-400" size={20} />
                Payslip Email Summary
              </h3>
              <button onClick={() => setEmailSummaryModal(null)} className="text-admin-secondary hover:text-admin-text">
                <FiX size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-3 mb-5 text-center">
              <div className="p-3 rounded-xl bg-admin-bg border border-admin-border">
                <div className="text-xs text-admin-muted font-bold">Total</div>
                <div className="text-lg font-black text-admin-text">{emailSummaryModal.summary?.total || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs text-emerald-400 font-bold">Sent</div>
                <div className="text-lg font-black text-emerald-400">{emailSummaryModal.summary?.sent || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="text-xs text-red-400 font-bold">Failed</div>
                <div className="text-lg font-black text-red-400">{emailSummaryModal.summary?.failed || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20">
                <div className="text-xs text-slate-400 font-bold">Skipped</div>
                <div className="text-lg font-black text-slate-400">{emailSummaryModal.summary?.skipped || 0}</div>
              </div>
            </div>

            {Array.isArray(emailSummaryModal.details) && emailSummaryModal.details.length > 0 && (
              <div className="flex-1 overflow-y-auto dark-scroll space-y-2 mb-4 pr-1">
                {emailSummaryModal.details.map((d, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-admin-bg border border-admin-border flex items-center justify-between text-xs">
                    <span className="font-semibold text-admin-text">{d.employee_id}</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      d.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' :
                      d.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setEmailSummaryModal(null)}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Logs Modal */}
      {showEmailLogsModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[105] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-6xl animate-scale-in flex flex-col max-h-[88vh]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-admin-border gap-3">
              <div>
                <h2 className="text-lg font-bold text-admin-heading flex items-center gap-2">
                  <FiClock className="text-purple-400" /> Payroll Email Logs ({monthNames[logMonth - 1]} {logYear})
                </h2>
                <p className="text-xs text-admin-muted">History of payslip email dispatches and delivery statuses.</p>
              </div>
              <button onClick={() => setShowEmailLogsModal(false)} className="text-admin-secondary hover:text-admin-text">
                <FiX size={20} />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="px-6 py-3 bg-admin-bg/60 border-b border-admin-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search Employee ID, Name, Email..."
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  className="admin-input py-1.5 px-3 text-xs w-60"
                />

                {/* Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-admin-secondary">Status:</span>
                  <select
                    value={logStatusFilter}
                    onChange={(e) => setLogStatusFilter(e.target.value)}
                    className="admin-select py-1.5 text-xs"
                  >
                    <option value="all">All</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>
              </div>

              {/* Month / Year Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={logMonth}
                  onChange={(e) => {
                    const m = parseInt(e.target.value);
                    setLogMonth(m);
                    fetchEmailLogsData(m, logYear);
                  }}
                  className="admin-select py-1.5 text-xs"
                >
                  {monthNames.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={logYear}
                  onChange={(e) => {
                    const y = parseInt(e.target.value);
                    setLogYear(y);
                    fetchEmailLogsData(logMonth, y);
                  }}
                  className="admin-select py-1.5 text-xs"
                >
                  {[...Array(5).keys()].map(y => {
                    const yearVal = new Date().getFullYear() - 2 + y;
                    return <option key={yearVal} value={yearVal}>{yearVal}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="p-6 overflow-y-auto dark-scroll flex-1">
              {loadingEmailLogs ? (
                <div className="flex justify-center py-12">
                  <Spinner size={32} color="blue" />
                </div>
              ) : (() => {
                const filtered = emailLogs.filter(log => {
                  if (logStatusFilter !== 'all' && log.status !== logStatusFilter) return false;
                  if (logSearchTerm.trim()) {
                    const term = logSearchTerm.toLowerCase().trim();
                    const empId = String(log.employee_id || '').toLowerCase();
                    const name = String(log.employee_name || '').toLowerCase();
                    const email = String(log.employee_email || '').toLowerCase();
                    if (!empId.includes(term) && !name.includes(term) && !email.includes(term)) return false;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-admin-muted">
                      <FiMail size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-semibold">No matching email log records found.</p>
                    </div>
                  );
                }

                return (
                  <div className="table-responsive dark-scroll w-full">
                    <table className="w-full text-left table-auto divide-y divide-white/[0.04] min-w-[1200px]">
                      <thead className="bg-admin-bg">
                        <tr>
                          {[
                            'Employee ID', 'Employee Name', 'Email', 'Month', 'Year',
                            'Type', 'Status', 'Provider', 'Message ID', 'SMTP Response',
                            'Sent At', 'Sent By', 'Error Message'
                          ].map(h => (
                            <th key={h} className="px-3 py-2 text-[10px] font-bold text-admin-secondary uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {filtered.map((log) => (
                          <tr key={log.id} className="hover:bg-admin-bg/50 text-xs">
                            <td className="px-3 py-2.5 font-bold font-mono text-admin-text">{log.employee_id || '-'}</td>
                            <td className="px-3 py-2.5 font-semibold text-admin-text">{log.employee_name || '-'}</td>
                            <td className="px-3 py-2.5 text-admin-muted font-mono text-[11px]">{log.employee_email || '-'}</td>
                            <td className="px-3 py-2.5 font-semibold text-admin-secondary">{monthNames[(log.month || 1) - 1] || log.month}</td>
                            <td className="px-3 py-2.5 font-semibold text-admin-secondary">{log.year}</td>
                            <td className="px-3 py-2.5 uppercase font-semibold text-[10px] text-admin-secondary">{log.email_type}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                log.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                log.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                log.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}>
                                {log.status === 'pending' ? 'Sending...' : log.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-purple-400">{log.provider || 'gmail_smtp'}</td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-emerald-400 max-w-[150px] truncate" title={log.provider_message_id || '-'}>
                              {log.provider_message_id || '-'}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-admin-muted max-w-[160px] truncate" title={log.smtp_response || '-'}>
                              {log.smtp_response || '-'}
                            </td>
                            <td className="px-3 py-2.5 text-admin-muted text-[11px]">
                              {log.sent_at ? new Date(log.sent_at).toLocaleString() : (log.created_at ? new Date(log.created_at).toLocaleString() : '-')}
                            </td>
                            <td className="px-3 py-2.5 text-admin-secondary">{log.sent_by_name || 'Admin'}</td>
                            <td className="px-3 py-2.5 text-[11px] font-mono text-red-400 max-w-[200px] truncate" title={log.error_message || '-'}>
                              {log.error_message || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end p-4 border-t border-admin-border">
              <button
                onClick={() => setShowEmailLogsModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-border/30 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <input type="text" value={`${currentMonthName} ${year}`} disabled className="admin-input bg-admin-bg/50 cursor-not-allowed text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Total Days</label>
                      <input type="text" value={editingRow.totalDays} disabled className="admin-input bg-admin-bg/50 cursor-not-allowed text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Per Day Salary</label>
                      <input type="text" value={formatCurrency(editingRow.perDaySalary)} disabled className="admin-input bg-admin-bg/50 cursor-not-allowed text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Net Earning</label>
                      <input type="text" value={formatCurrency(editingRow.netEarning)} disabled className="admin-input bg-admin-bg/50 cursor-not-allowed text-xs font-mono text-emerald-400 font-bold" />
                    </div>
                  </div>
                </div>

                {/* Editable Attendance Days */}
                <div>
                  <h3 className="text-xs font-bold text-admin-heading uppercase tracking-wider mb-4 border-b border-admin-border pb-2">Attendance Days Override</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Working Days</label>
                      <input type="number" step="0.5" name="workingDays" value={editingRow.workingDays} onChange={handleEditChange} className="admin-input text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Paid Days</label>
                      <input type="number" step="0.5" name="paidDays" value={editingRow.paidDays} onChange={handleEditChange} className="admin-input text-xs font-mono text-emerald-400 font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">LOP Days</label>
                      <input type="number" step="0.5" name="lopDays" value={editingRow.lopDays} onChange={handleEditChange} className="admin-input text-xs font-mono text-red-400 font-bold" />
                    </div>
                  </div>
                </div>

                {/* Salary Breakdown Components */}
                <div>
                  <h3 className="text-xs font-bold text-admin-heading uppercase tracking-wider mb-4 border-b border-admin-border pb-2">Salary & Deductions Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Monthly Earning (Base)</label>
                      <input type="number" name="monthlyEarning" value={editingRow.monthlyEarning} onChange={handleEditChange} className="admin-input text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Basic Salary</label>
                      <input type="number" name="basicSalary" value={editingRow.basicSalary} onChange={handleEditChange} className="admin-input text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">HRA</label>
                      <input type="number" name="hra" value={editingRow.hra} onChange={handleEditChange} className="admin-input text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Special Allowance</label>
                      <input type="number" name="specialAllowance" value={editingRow.specialAllowance} onChange={handleEditChange} className="admin-input text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Staff Advance</label>
                      <input type="number" name="staffAdvance" value={editingRow.staffAdvance} onChange={handleEditChange} className="admin-input text-xs font-mono text-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Professional Tax (PT)</label>
                      <input type="number" name="professionalTax" value={editingRow.professionalTax} onChange={handleEditChange} className="admin-input text-xs font-mono text-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">TDS</label>
                      <input type="number" name="tds" value={editingRow.tds} onChange={handleEditChange} className="admin-input text-xs font-mono text-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary mb-1">Payment Status</label>
                      <select name="status" value={editingRow.status || 'pending'} onChange={handleEditChange} className="admin-select text-xs font-bold">
                        <option value="pending">Pending</option>
                        <option value="hold">Hold</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                  </div>
                </div>

              </form>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-admin-border shrink-0">
              <button type="button" onClick={closeEditModal} className="px-4 py-2 text-xs font-semibold rounded-xl border border-admin-border text-admin-secondary hover:bg-admin-border/30 transition-all">Cancel</button>
              <button type="submit" form="edit-payroll-form" disabled={savingEdit} className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-500/20 disabled:opacity-50">
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Payslip Download Modal */}
      {bulkDownloadModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl p-6 shadow-clay-admin-modal w-full max-w-md animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <FiFileText size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-admin-heading">Bulk Payslip PDF Download</h3>
                <p className="text-xs text-admin-muted">{monthNames[month - 1]} {year} ({records.length} Employees)</p>
              </div>
            </div>
            <p className="text-sm text-admin-secondary mb-6 leading-relaxed">
              Do you want signature in bulk payslip PDF?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setBulkDownloadModal(false)}
                disabled={!!payslipDownloadLoading}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl border border-admin-border text-admin-secondary hover:bg-admin-border/30 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteBulkDownload(false)}
                disabled={!!payslipDownloadLoading}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {payslipDownloadLoading === 'bulk-without-signature' ? <FiRefreshCw className="animate-spin" /> : null} Without Signature
              </button>
              <button
                onClick={() => handleExecuteBulkDownload(true)}
                disabled={!!payslipDownloadLoading}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {payslipDownloadLoading === 'bulk-with-signature' ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />} With Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Payslip Download Choice Modal */}
      {singleDownloadModal.isOpen && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl p-6 shadow-clay-admin-modal w-full max-w-md animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <FiFileText size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-admin-heading">Download Pay Slip</h3>
                <p className="text-xs text-admin-muted">{singleDownloadModal.row?.employeeName} ({singleDownloadModal.row?.employeeCode})</p>
              </div>
            </div>
            <p className="text-sm text-admin-secondary mb-4 leading-relaxed">
              Choose download option:
            </p>
            <div className="flex flex-col gap-2.5 mb-2">
              <button
                onClick={() => handleExecuteSingleDownload(singleDownloadModal.row, true)}
                disabled={!!payslipDownloadLoading}
                className="w-full px-4 py-3 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md flex items-center justify-between disabled:opacity-50"
              >
                <span>Download With Signature</span>
                {payslipDownloadLoading === `${singleDownloadModal.row?.id || singleDownloadModal.row?.employeeCode || singleDownloadModal.row?.employeeId}-with-signature` ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
              </button>
              <button
                onClick={() => handleExecuteSingleDownload(singleDownloadModal.row, false)}
                disabled={!!payslipDownloadLoading}
                className="w-full px-4 py-3 text-xs font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-all flex items-center justify-between disabled:opacity-50"
              >
                <span>Download Without Signature</span>
                {payslipDownloadLoading === `${singleDownloadModal.row?.id || singleDownloadModal.row?.employeeCode || singleDownloadModal.row?.employeeId}-without-signature` ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
              </button>
              <button
                onClick={() => {
                  const row = singleDownloadModal.row;
                  setSingleDownloadModal({ isOpen: false, row: null });
                  handleDownloadPaySlip(row);
                }}
                disabled={!!payslipDownloadLoading}
                className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-admin-border text-admin-secondary hover:bg-admin-border/30 transition-all text-center mt-1"
              >
                View Online Pay Slip Preview
              </button>
            </div>
            <div className="flex justify-end mt-4 pt-3 border-t border-admin-border/40">
              <button
                onClick={() => setSingleDownloadModal({ isOpen: false, row: null })}
                disabled={!!payslipDownloadLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-admin-border text-admin-secondary hover:bg-admin-border/30 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Slip Modal */}
      {paySlipData && (
        <PayrollPaySlip
          data={paySlipData}
          onClose={() => setPaySlipData(null)}
        />
      )}

      {/* Clear Range Modal */}
      {clearDialog.isOpen && (
        <ClearRangeDialog
          isOpen={clearDialog.isOpen}
          isLoading={clearDialog.isLoading}
          onClose={() => setClearDialog({ isOpen: false, isLoading: false })}
          onConfirm={handleClearRange}
          title="Clear Payroll Range"
        />
      )}

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Notification */}
      {toastConfig.message && (
        <AdminToast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig({ message: '', type: 'success' })}
        />
      )}
    </div>
  );
};

export default AdminPayroll;
