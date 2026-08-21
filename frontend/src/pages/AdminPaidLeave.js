import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import AdminToast from '../components/AdminToast';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import {
  getPaidLeaveEmployees,
  markPaidLeave,
  clearPaidLeave,
  getAllDepartments,
  getSettings
} from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';
import { validateDateString } from '../utils/dateValidation';
import {
  FiEdit,
  FiSearch,
  FiCalendar,
  FiFilter,
  FiSave,
  FiX,
  FiLayers,
  FiTrash2,
  FiCheckCircle,
  FiUserX,
  FiUsers,
  FiClock,
  FiAlertCircle,
  FiPlus
} from 'react-icons/fi';
import { sortEmployeeRows } from '../utils/sorting';
import { toDateInputValue } from '../utils/dateUtils';

const getLocalYMD = () => {
  return toDateInputValue(new Date());
};

const formatTime12 = (timeStr) => {
  if (!timeStr) return '--:--';
  const clean = String(timeStr).substring(0, 5);
  const [h, m] = clean.split(':').map(Number);
  if (isNaN(h)) return clean;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = String(m || 0).padStart(2, '0');
  return `${hour12}:${minStr} ${ampm}`;
};

const AdminPaidLeave = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [date, setDate] = useState(getLocalYMD());
  const [departmentId, setDepartmentId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [departments, setDepartments] = useState([]);

  // Stats & Employees
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    paidLeavesCount: 0,
    presentCount: 0,
    pendingCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Settings for Office Timings (dynamically loaded)
  const [officeTimes, setOfficeTimes] = useState({
    startTime: '09:00',
    endTime: '18:00'
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState(null);
  const [reasonCategory, setReasonCategory] = useState('Office Work');
  const [reasonNotes, setReasonNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Dialogs & Toast
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    confirmText: 'Confirm',
    onConfirm: null
  });
  const [clearingId, setClearingId] = useState(null);

  const predefinedCategories = [
    'Office Work',
    'Office Meeting',
    'Festival',
    'Client Visit',
    'On Duty / Official Travel',
    'Compensatory Off',
    'Special Permission'
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, departmentId]);

  const fetchInitialData = async () => {
    try {
      const [deptRes, settingsRes] = await Promise.all([
        getAllDepartments(),
        getSettings()
      ]);

      if (deptRes.data.success) {
        setDepartments(deptRes.data.departments.filter((d) => d.status === 'Active'));
      }

      if (settingsRes.data && settingsRes.data.workingHours) {
        const wh = settingsRes.data.workingHours;
        setOfficeTimes({
          startTime: (wh.officeStartTime || '09:00').substring(0, 5),
          endTime: (wh.officeEndTime || '18:00').substring(0, 5)
        });
      }
    } catch (error) {
      console.error('Error fetching initial settings/departments:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getPaidLeaveEmployees({
        date,
        department_id: departmentId,
        search: searchTerm
      });

      if (res.data.success) {
        setEmployees(res.data.employees || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (error) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: getErrorMessage(error),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (emp) => {
    const dateError = validateDateString(date, { allowFuture: false });
    if (dateError) {
      setAlertDialog({ isOpen: true, title: 'Invalid Date', message: dateError, type: 'error' });
      return;
    }

    setTargetEmployee(emp);
    setReasonCategory(emp.reason_category || 'Office Work');
    setReasonNotes(emp.reason_notes || '');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!targetEmployee) return;

    if (!reasonCategory.trim()) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select a reason category.',
        type: 'error'
      });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        employee_id: targetEmployee.employee_id,
        leave_date: date,
        reason_category: reasonCategory.trim(),
        reason_notes: reasonNotes.trim()
      };

      const res = await markPaidLeave(payload);
      if (res.data.success) {
        setToastConfig({
          message: res.data.message || `Paid leave marked for ${targetEmployee.name}.`,
          type: 'success'
        });
        setShowModal(false);
        fetchData();
      }
    } catch (error) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: getErrorMessage(error),
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = (emp) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Paid Leave',
      message: `Are you sure you want to remove the Paid Leave record for ${emp.name} (${emp.employee_id}) on ${date}? This will reset their attendance to unrecorded.`,
      type: 'danger',
      confirmText: 'Yes, Remove Paid Leave',
      onConfirm: async () => {
        try {
          setClearingId(emp.employee_id);
          const res = await clearPaidLeave(emp.paid_leave_id || 'emp', {
            employee_id: emp.employee_id,
            date
          });
          if (res.data.success) {
            setToastConfig({ message: 'Paid leave cleared successfully.', type: 'success' });
            fetchData();
          }
        } catch (error) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: getErrorMessage(error),
            type: 'error'
          });
        } finally {
          setClearingId(null);
        }
      }
    });
  };

  const filteredEmployeesRaw = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = sortEmployeeRows(filteredEmployeesRaw, sortBy);

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pt-14 lg:pt-0">
            <div>
              <h1 className="text-xl font-bold text-admin-heading flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Leave & Attendance Exceptions
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Manage absent reasons and grant authorized paid leaves for employees
              </p>
            </div>
          </div>

          {/* Navigation Tabs between Absent Reasons & Paid Leave */}
          <div className="flex items-center gap-2 p-1.5 bg-admin-surface border border-admin-border rounded-2xl w-fit mb-6 shadow-sm">
            <button
              onClick={() => navigate('/admin/absent-reasons')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all text-admin-secondary hover:text-admin-text hover:bg-admin-elevated"
            >
              <FiUserX size={16} /> Absent Reasons
            </button>
            <button
              onClick={() => navigate('/admin/paid-leaves')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
            >
              <FiCheckCircle size={16} /> Paid Leave
            </button>
          </div>

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-admin-surface border border-admin-border p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                <FiUsers size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">Total Active</p>
                <p className="text-lg font-bold text-admin-heading mt-0.5">{stats.totalEmployees}</p>
              </div>
            </div>

            <div className="bg-admin-surface border border-admin-border p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <FiCheckCircle size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">Paid Leaves Marked</p>
                <p className="text-lg font-bold text-admin-heading mt-0.5">{stats.paidLeavesCount}</p>
              </div>
            </div>

            <div className="bg-admin-surface border border-admin-border p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <FiClock size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">Regular Present</p>
                <p className="text-lg font-bold text-admin-heading mt-0.5">{stats.presentCount}</p>
              </div>
            </div>

            <div className="bg-admin-surface border border-admin-border p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <FiAlertCircle size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-admin-secondary uppercase tracking-wider">Pending / Unrecorded</p>
                <p className="text-lg font-bold text-admin-heading mt-0.5">{stats.pendingCount}</p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                Date
              </label>
              <div className="relative">
                <FiCalendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={toDateInputValue(new Date())}
                  className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                Department
              </label>
              <div className="relative">
                <FiFilter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-admin-elevated">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id} className="bg-admin-elevated">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                Search
              </label>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={fetchData}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none"
              >
                <option value="name_asc" className="bg-admin-elevated">Name A-Z</option>
                <option value="name_desc" className="bg-admin-elevated">Name Z-A</option>
                <option value="employee_id_asc" className="bg-admin-elevated">Employee ID A-Z</option>
                <option value="employee_id_desc" className="bg-admin-elevated">Employee ID Z-A</option>
              </select>
            </div>
          </div>

          {/* Employees Table */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin">
            <div className="table-responsive overflow-y-auto max-h-[calc(100vh-340px)] min-h-[350px] dark-scroll relative">
              <table className="min-w-full divide-y divide-white/[0.04]">
                <thead className="bg-admin-bg sticky top-0 z-10 shadow-sm">
                  <tr>
                    {['Emp ID', 'Name', 'Department', 'Date', 'Status', 'Office Timing', 'Paid Leave Details', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3.5 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 z-10"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <Spinner size={32} />
                      </td>
                    </tr>
                  ) : filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => {
                      const isPaid = emp.is_paid_leave;
                      return (
                        <tr key={emp.employee_id} className={`admin-table-row ${isPaid ? 'bg-emerald-500/[0.03]' : ''}`}>
                          <td className="px-4 py-3.5 text-sm text-slate-400 font-mono whitespace-nowrap">
                            {emp.employee_id}
                          </td>
                          <td className="px-4 py-3.5 text-sm font-semibold text-admin-text whitespace-nowrap">
                            {emp.name}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                            {emp.department_name || '-'}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                            {new Date(emp.attendance_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Paid Leave (Present)
                              </span>
                            ) : (
                              <StatusBadge status={emp.attendance_status} dark />
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-medium text-slate-400 whitespace-nowrap">
                            {isPaid
                              ? `${formatTime12(emp.office_start_time || officeTimes.startTime)} – ${formatTime12(emp.office_end_time || officeTimes.endTime)}`
                              : `${formatTime12(officeTimes.startTime)} – ${formatTime12(officeTimes.endTime)} (Standard)`}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-300 max-w-[240px] truncate">
                            {isPaid ? (
                              <div className="flex flex-col">
                                <span className="font-semibold text-emerald-400">{emp.reason_category}</span>
                                {emp.reason_notes && (
                                  <span className="text-xs text-slate-400 truncate">{emp.reason_notes}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Pending Action</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isPaid ? (
                                <>
                                  {hasPermission('absent_reasons', 'can_edit') && (
                                    <button
                                      onClick={() => openModal(emp)}
                                      className="text-amber-400 hover:text-amber-300 transition-colors text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
                                    >
                                      <FiEdit size={13} /> Edit
                                    </button>
                                  )}
                                  {hasPermission('absent_reasons', 'can_delete') && (
                                    <button
                                      onClick={() => handleClear(emp)}
                                      disabled={clearingId === emp.employee_id}
                                      className="text-red-400 hover:text-red-300 transition-colors text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 disabled:opacity-50"
                                    >
                                      <FiTrash2 size={13} /> Remove
                                    </button>
                                  )}
                                </>
                              ) : (
                                hasPermission('absent_reasons', 'can_edit') && (
                                  <button
                                    onClick={() => openModal(emp)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-sm"
                                  >
                                    <FiPlus size={14} /> Mark Paid Leave
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <FiLayers size={28} className="text-[#475569]" />
                          <p className="text-sm font-medium text-admin-secondary">
                            No employees without attendance found for this date.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Confirmation & Alert Dialogs */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog((d) => ({ ...d, isOpen: false }))}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((d) => ({ ...d, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={confirmDialog.confirmText}
      />

      {toastConfig.message && (
        <AdminToast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig({ message: '', type: 'success' })}
        />
      )}

      {/* Paid Leave Form Modal */}
      {showModal && targetEmployee && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="admin-modal bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-lg flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <FiCheckCircle size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-admin-text">Mark Paid Leave</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    For {targetEmployee.name} ({targetEmployee.employee_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto dark-scroll space-y-4">
              <form id="paid-leave-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* Dynamic Office Timings Banner */}
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FiClock size={14} /> Working Timings (From Settings)
                    </span>
                    <span className="text-xs font-bold text-emerald-300">Full Present Day</span>
                  </div>
                  <p className="text-sm font-semibold text-admin-text mt-1">
                    {formatTime12(officeTimes.startTime)} – {formatTime12(officeTimes.endTime)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    This will mark the employee as Present for the day with standard working hours and 0 penalty deductions.
                  </p>
                </div>

                {/* Quick Select Reason Category */}
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                    Select Reason Category <span className="text-emerald-400">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {predefinedCategories.map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setReasonCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                          reasonCategory === cat
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                            : 'bg-white/5 border border-admin-border text-admin-secondary hover:text-admin-text hover:bg-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                    Additional Notes / Justification (Optional)
                  </label>
                  <textarea
                    name="reason_notes"
                    value={reasonNotes}
                    onChange={(e) => setReasonNotes(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Enter any additional details or remarks..."
                    className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                  />
                  <div className="flex justify-end mt-1">
                    <span className={`text-[10px] ${reasonNotes.length > 450 ? 'text-amber-500' : 'text-slate-500'}`}>
                      {reasonNotes.length}/500
                    </span>
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-bg shrink-0 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="paid-leave-form"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-600/20 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Spinner size={16} /> : <FiSave size={16} />}
                Submit Paid Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaidLeave;
