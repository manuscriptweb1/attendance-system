import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import ClearDataModal from '../components/ClearDataModal';
import AdminToast from '../components/AdminToast';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getAllDepartments, getEmployeesForManualAttendance, createManualAttendance, updateManualAttendance, deleteManualAttendance, checkInRowManualAttendance, checkOutRowManualAttendance, clearDataByDate } from '../services/api';
import { formatTime, format24To12Hour } from '../utils/formatTime';
import { getErrorMessage } from '../utils/errorHandler';
import { validateDateString } from '../utils/dateValidation';
import { FiCheckSquare, FiSquare, FiEdit, FiSearch, FiCalendar, FiFilter, FiSave, FiX, FiLayers, FiTrash2 } from 'react-icons/fi';
import { sortEmployeeRows } from '../utils/sorting';

const AdminManualAttendance = () => {
  const { hasPermission } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [departmentId, setDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [departments, setDepartments] = useState([]);
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowLoadingId, setRowLoadingId] = useState(null);
  
  const [selectedIds, setSelectedIds] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [targetAttendanceId, setTargetAttendanceId] = useState(null);
  
  const [formData, setFormData] = useState({
    login_time: '',
    logout_time: '',
    attendance_status: 'Present',
    is_wfh: false,
    remarks: '',
    reason: ''
  });
  
  const [originalData, setOriginalData] = useState(null);
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', type: 'warning', confirmText: 'Confirm', onConfirm: null });
  const [clearDialog, setClearDialog] = useState({ isOpen: false, isLoading: false });

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, departmentId, statusFilter]);

  const fetchDepartments = async () => {
    try {
      const res = await getAllDepartments();
      if (res.data.success) setDepartments(res.data.departments.filter(d => d.status === 'Active'));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await getEmployeesForManualAttendance({ date, department_id: departmentId, status: statusFilter });
      if (res.data.success) {
        setEmployees(res.data.employees);
        if (!silent) setSelectedIds([]);
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleSelection = (empId) => {
    setSelectedIds(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredEmployees.length) setSelectedIds([]);
    else setSelectedIds(filteredEmployees.map(e => e.employee_id));
  };

  const isFutureDate = () => {
    return validateDateString(date, { allowFuture: false }) !== null;
  };

  const isSunday = new Date(date).getDay() === 0;

  const isFinalStatus = (status) => {
    return ['Present', 'Late', 'Half Day', 'Absent', 'P', 'HD', 'A'].includes(status);
  };

  const handleDelete = (emp) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Manual Attendance',
      message: `Delete manual attendance for ${emp.name} on ${date}? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
        try {
          const res = await deleteManualAttendance(emp.attendance_id);
          if (res.data.success) {
            setToastConfig({ message: res.data.message, type: 'success' });
            fetchData({ silent: true });
          }
        } catch (error) {
          setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
        }
      }
    });
  };

  const openBulkModal = () => {
    if (isFutureDate()) {
      setAlertDialog({ isOpen: true, title: 'Invalid Date', message: 'Cannot create manual attendance for future dates.', type: 'error' });
      return;
    }

    if (selectedIds.length === 0) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Please select at least one employee', type: 'error' });
      return;
    }
    
    // Check if any selected employee already has a final attendance status
    const hasExisting = employees.find(e => selectedIds.includes(e.employee_id) && e.attendance_status && !['Not Mention', 'No Record', ''].includes(e.attendance_status));
    if (hasExisting) {
      setAlertDialog({ isOpen: true, title: 'Error', message: `This employee with employee ID ${hasExisting.employee_id} already has attendance for this date.`, type: 'error' });
      return;
    }

    setFormData({ login_time: '09:30', logout_time: '17:30', attendance_status: 'Present', is_wfh: false, remarks: '', reason: '' });
    setOriginalData(null);
    setEditMode(false);
    setTargetAttendanceId(null);
    setShowModal(true);
  };

  const openEditModal = (emp = null) => {
    if (isFutureDate()) {
      setAlertDialog({ isOpen: true, title: 'Invalid Date', message: 'Future date attendance is not allowed. Please select today or a past date.', type: 'error' });
      return;
    }

    if (emp && emp.validation_method !== 'Manual') {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Only manually created attendance records can be edited from this module.', type: 'error' });
      return;
    }
    
    const login = emp.login_time ? new Date(emp.login_time).toTimeString().substring(0,5) : '';
    const logout = emp.logout_time ? new Date(emp.logout_time).toTimeString().substring(0,5) : '';
    
    setFormData({ login_time: login, logout_time: logout, attendance_status: emp.attendance_status || 'Present', is_wfh: !!emp.is_wfh, remarks: '', reason: '' });
    setOriginalData({ login_time: login, logout_time: logout, attendance_status: emp.attendance_status || 'Present', is_wfh: !!emp.is_wfh });
    setEditMode(true);
    setTargetAttendanceId(emp.attendance_id);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const name = e.target.name;
    
    if (name === 'attendance_status') {
      if (value === 'Absent') {
        setFormData(f => ({ ...f, [name]: value, login_time: '', logout_time: '' }));
      } else {
        setFormData(f => ({ ...f, [name]: value }));
      }
    } else {
      setFormData(f => ({ ...f, [name]: value }));
    }
  };

  const generateManualAttendanceReason = (orig, curr) => {
    const changes = [];
    
    if (orig.login_time !== curr.login_time) {
      const oldVal = orig.login_time ? format24To12Hour(orig.login_time) : '-';
      const newVal = curr.login_time ? format24To12Hour(curr.login_time) : '-';
      if (!orig.login_time && curr.login_time) {
        changes.push(`Added check-in time as ${newVal}`);
      } else if (orig.login_time && !curr.login_time) {
        changes.push(`Removed check-in time. Previous check-in time was ${oldVal}`);
      } else {
        changes.push(`Updated check-in time from ${oldVal} to ${newVal}`);
      }
    }
    
    if (orig.logout_time !== curr.logout_time) {
      const oldVal = orig.logout_time ? format24To12Hour(orig.logout_time) : '-';
      const newVal = curr.logout_time ? format24To12Hour(curr.logout_time) : '-';
      if (!orig.logout_time && curr.logout_time) {
        changes.push(`Added check-out time as ${newVal}`);
      } else if (orig.logout_time && !curr.logout_time) {
        changes.push(`Removed check-out time. Previous check-out time was ${oldVal}`);
      } else {
        changes.push(`Updated check-out time from ${oldVal} to ${newVal}`);
      }
    }
    
    if (orig.attendance_status !== curr.attendance_status) {
      changes.push(`Updated status from ${orig.attendance_status} to ${curr.attendance_status}`);
    }
    
    if (orig.is_wfh !== curr.is_wfh) {
      const oldVal = orig.is_wfh ? 'WFH' : 'Office';
      const newVal = curr.is_wfh ? 'WFH' : 'Office';
      changes.push(`Updated work type from ${oldVal} to ${newVal}`);
    }
    
    if (changes.length === 0) return 'No changes detected';
    return changes.join('; ');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFutureDate()) {
      setAlertDialog({ isOpen: true, title: 'Invalid Date', message: 'Future date attendance is not allowed. Please select today or a past date.', type: 'error' });
      return;
    }
    
    let finalReason = formData.reason.trim();
    if (!finalReason) {
      if (editMode && originalData) {
        finalReason = generateManualAttendanceReason(originalData, formData);
        if (finalReason === 'No changes detected') {
          setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'No changes detected.', type: 'error' });
          return;
        }
      } else {
        finalReason = 'Manual attendance entry created';
      }
    }

    const dateError = validateDateString(date, { allowFuture: false });
    if (dateError) {
      setAlertDialog({
        isOpen: true,
        title: 'Invalid Date',
        message: dateError,
        type: 'error'
      });
      return;
    }

    if (['Present', 'Late', 'Half Day'].includes(formData.attendance_status)) {
      if (!formData.login_time) {
        setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'Check-in time is required for Present, Late, or Half Day.', type: 'error' });
        return;
      }
      if (formData.login_time && formData.logout_time && formData.logout_time < formData.login_time) {
        setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'Check-out time cannot be earlier than check-in time.', type: 'error' });
        return;
      }
    }

    executeSubmit(finalReason);
  };

  const executeSubmit = async (finalReason) => {
    try {
      if (editMode) {
        const payload = {
          login_time: formData.login_time ? `${date}T${formData.login_time}:00` : null,
          logout_time: formData.logout_time ? `${date}T${formData.logout_time}:00` : null,
          attendance_status: formData.attendance_status,
          is_wfh: formData.is_wfh,
          remarks: formData.remarks,
          reason: finalReason
        };
        const res = await updateManualAttendance(targetAttendanceId, payload);
        if (res.data.success) {
          setToastConfig({ message: res.data.message, type: 'success' });
          setShowModal(false);
          fetchData({ silent: true });
        }
      } else {
        const records = selectedIds.map(empId => ({
          employee_id: empId,
          attendance_date: date,
          login_time: formData.login_time ? `${date}T${formData.login_time}:00` : null,
          logout_time: formData.logout_time ? `${date}T${formData.logout_time}:00` : null,
          attendance_status: formData.attendance_status,
          is_wfh: formData.is_wfh,
          remarks: formData.remarks
        }));
        const payload = { records, reason: finalReason };
        const res = await createManualAttendance(payload);
        if (res.data.success) {
          setToastConfig({ message: res.data.message, type: 'success' });
          setShowModal(false);
          fetchData({ silent: true });
        }
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  const handleClearRange = async ({ fromDate, toDate }) => {
    try {
      setClearDialog(prev => ({ ...prev, isLoading: true }));
      const response = await clearDataByDate('manual_attendance', { fromDate, toDate, confirmation: 'DELETE' });
      if (response.data.success) {
        setClearDialog({ isOpen: false, isLoading: false });
        setToastConfig({ message: response.data.message || 'Records cleared successfully.', type: 'success' });
        fetchData();
      } else {
        setClearDialog(prev => ({ ...prev, isLoading: false }));
        setAlertDialog({ isOpen: true, title: 'Error', message: response.data.message || 'Failed to clear records', type: 'error' });
      }
    } catch (error) {
      setClearDialog(prev => ({ ...prev, isLoading: false }));
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  const filteredEmployeesRaw = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredEmployees = sortEmployeeRows(filteredEmployeesRaw, sortBy);

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-14 lg:pt-0">
            <div>
              <h1 className="text-xl font-bold text-admin-heading">Manual Attendance</h1>
              <p className="text-sm text-slate-400 mt-0.5">Emergency Attendance Management</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {hasPermission('manual_attendance', 'can_clear') && (
                <button onClick={() => setClearDialog({ isOpen: true })} className="flex items-center gap-2 bg-admin-surface border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                  <FiTrash2 size={16} /> Clear Month
                </button>
              )}
              {hasPermission('manual_attendance', 'can_create') && (
                <button onClick={openBulkModal} disabled={selectedIds.length === 0 || isSunday}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${selectedIds.length > 0 && !isSunday ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}>
                  <FiEdit size={16} /> Add for Selected ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Date</label>
              <div className="relative">
                <FiCalendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6]" />
              </div>
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Department</label>
              <div className="relative">
                <FiFilter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                  className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6] appearance-none">
                  <option value="" className="bg-admin-elevated">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id} className="bg-admin-elevated">{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#3B82F6] appearance-none">
                <option value="All" className="bg-admin-elevated">All</option>
                <option value="Present" className="bg-admin-elevated">Present</option>
                <option value="Late" className="bg-admin-elevated">Late</option>
                <option value="Half Day" className="bg-admin-elevated">Half Day</option>
                <option value="Absent" className="bg-admin-elevated">Absent</option>
                <option value="Not Mention" className="bg-admin-elevated">Not Mention</option>
                <option value="No Record" className="bg-admin-elevated">No Record</option>
              </select>
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Search</label>
              <div className="relative">
                <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                <input type="text" placeholder="Name or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6]" />
              </div>
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#3B82F6] cursor-pointer appearance-none">
                <option value="name_asc" className="bg-admin-elevated text-slate-900">Name A-Z</option>
                <option value="name_desc" className="bg-admin-elevated text-slate-900">Name Z-A</option>
                <option value="employee_id_asc" className="bg-admin-elevated text-slate-900">Employee ID A-Z</option>
                <option value="employee_id_desc" className="bg-admin-elevated text-slate-900">Employee ID Z-A</option>

              </select>
            </div>
          </div>

          {isSunday && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <FiX size={16} />
              </div>
              <p className="text-sm font-medium">Manual attendance is not allowed on holidays or Sundays.</p>
            </div>
          )}

          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin">
            <div className="table-responsive dark-scroll">
              <table className="min-w-full divide-y divide-white/[0.04]">
                <thead className="bg-admin-bg">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <button onClick={toggleAll} className="text-slate-500 dark:text-slate-400 hover:text-admin-text">
                        {selectedIds.length > 0 && selectedIds.length === filteredEmployees.length ? <FiCheckSquare size={18} className="text-blue-500 dark:text-blue-400" /> : <FiSquare size={18} />}
                      </button>
                    </th>
                    {['Emp ID', 'Name', 'Department', 'In Status', 'Out Status', 'Total Hours', 'Status', 'Reason', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-16 text-center"><Spinner size={32} /></td></tr>
                  ) : filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                    <tr key={emp.employee_id} className={`admin-table-row ${selectedIds.includes(emp.employee_id) ? 'bg-blue-500/5' : ''}`}>
                      <td className="px-4 py-3.5">
                        <button onClick={() => toggleSelection(emp.employee_id)} disabled={isFinalStatus(emp.attendance_status) || isSunday} className={`transition-colors ${isFinalStatus(emp.attendance_status) || isSunday ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-500 dark:text-slate-400 hover:text-admin-text'}`}>
                          {selectedIds.includes(emp.employee_id) ? <FiCheckSquare size={18} className="text-blue-500 dark:text-blue-400" /> : <FiSquare size={18} />}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 font-mono whitespace-nowrap">{emp.employee_id}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-admin-text whitespace-nowrap">{emp.name}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.department_name || '-'}</td>
                      
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                        {emp.login_time ? (
                          <div>
                            <span className="block font-medium text-admin-text">{formatTime(emp.login_time)}</span>
                            {emp.checkin_status && (
                              <span className={`block text-[10px] font-bold mt-0.5 ${emp.checkin_status === 'late' ? 'text-amber-500' : emp.checkin_status === 'early' ? 'text-emerald-400' : 'text-emerald-400'}`}>
                                {emp.checkin_status === 'late' ? `Late ${Number(emp.late_minutes || 0)}m` : emp.checkin_status === 'early' ? 'On Time' : 'On Time'}
                              </span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                        {emp.logout_time ? (
                          <div>
                            <span className="block font-medium text-admin-text">{formatTime(emp.logout_time)}</span>
                            {emp.checkout_status && (
                              <span className={`block text-[10px] font-bold mt-0.5 ${emp.checkout_status === 'late' ? 'text-amber-500' : emp.checkout_status === 'early' ? 'text-purple-400' : 'text-emerald-400'}`}>
                                {emp.checkout_status === 'late' ? `Late Check-Out` : emp.checkout_status === 'early' ? `Early Check-Out ${Number(emp.early_minutes || 0)}m` : 'On Time'}
                              </span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 font-medium whitespace-nowrap">
                        {emp.total_hours && emp.total_hours > 0 ? `${emp.total_hours} hrs` : '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {emp.attendance_status ? <StatusBadge status={emp.attendance_status} dark /> : <span className="text-xs text-slate-500 font-medium px-2.5 py-1 bg-white/5 rounded-full border border-admin-border">No Record</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                        {emp.absent_reason || '-'}
                      </td>
                      
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {(() => {
                          const hasCheckIn = !!emp.login_time;
                          const hasCheckOut = !!emp.logout_time;
                          const status = emp.attendance_status || 'Not Mention';
                          
                          const editButton = hasPermission('manual_attendance', 'can_edit') ? (
                            <button type="button" onClick={(e) => { e.preventDefault(); openEditModal(emp); }} disabled={isSunday} className={`text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium flex items-center gap-1.5 ${isSunday ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <FiEdit size={14} /> {emp.attendance_id ? 'Edit' : 'Add (Edit)'}
                            </button>
                          ) : null;

                          const deleteButton = hasPermission('manual_attendance', 'can_delete') && emp.attendance_id && emp.validation_method === 'Manual' ? (
                            <button type="button" onClick={(e) => { e.preventDefault(); handleDelete(emp); }} disabled={isSunday} className={`text-red-400 hover:text-red-300 transition-colors text-sm font-medium flex items-center gap-1.5 ${isSunday ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <FiTrash2 size={14} />
                            </button>
                          ) : null;

                          const handleRowAction = async (emp, action) => {
                            if (isFutureDate()) {
                              setAlertDialog({ isOpen: true, title: 'Invalid Date', message: 'Future date attendance is not allowed. Please select today or a past date.', type: 'error' });
                              return;
                            }
                            try {
                              setRowLoadingId(emp.employee_id);
                              let res;
                              if (action === 'checkin') {
                                res = await checkInRowManualAttendance({ employee_id: emp.employee_id, attendance_date: date });
                              } else {
                                res = await checkOutRowManualAttendance({ employee_id: emp.employee_id, attendance_date: date });
                              }
                              if (res.data.success) {
                                setToastConfig({ message: res.data.message, type: 'success' });
                                await fetchData({ silent: true });
                              }
                            } catch (error) {
                              setToastConfig({ message: error.response?.data?.message || 'Operation failed', type: 'error' });
                            } finally {
                              setRowLoadingId(null);
                            }
                          };

                          const isLoading = rowLoadingId === emp.employee_id;

                          const checkInBtn = hasPermission('manual_attendance', 'can_edit') ? (
                            <button type="button" onClick={(e) => { e.preventDefault(); handleRowAction(emp, 'checkin'); }} disabled={isSunday || isLoading} className={`transition-colors text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isSunday || isLoading ? 'bg-white/5 text-slate-500 border-admin-border cursor-not-allowed' : 'bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 border-emerald-500/20'}`}>
                              {isLoading ? <Spinner size={14} /> : 'Check-In'}
                            </button>
                          ) : null;

                          const checkOutBtn = hasPermission('manual_attendance', 'can_edit') ? (
                            <button type="button" onClick={(e) => { e.preventDefault(); handleRowAction(emp, 'checkout'); }} disabled={isSunday || isLoading} className={`transition-colors text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isSunday || isLoading ? 'bg-white/5 text-slate-500 border-admin-border cursor-not-allowed' : 'bg-blue-500/10 text-blue-400 hover:text-blue-300 border-blue-500/20'}`}>
                              {isLoading ? <Spinner size={14} /> : 'Check-Out'}
                            </button>
                          ) : null;

                          const completedBadge = <span className="text-xs text-slate-500 font-medium px-2 py-1 bg-white/5 rounded-md border border-admin-border">Already Marked</span>;

                          let actions = [];

                          if (status === 'Absent') {
                            if (editButton) actions.push(editButton);
                          } else if (!hasCheckIn) {
                            if (checkInBtn) actions.push(checkInBtn);
                            if (editButton) actions.push(editButton);
                          } else if (hasCheckIn && !hasCheckOut) {
                            if (checkOutBtn) actions.push(checkOutBtn);
                            if (editButton) actions.push(editButton);
                          } else {
                            actions.push(completedBadge);
                            if (editButton) actions.push(editButton);
                          }

                          if (deleteButton) actions.push(deleteButton);

                          return (
                            <div className="flex items-center gap-3">
                              {actions.map((action, idx) => <React.Fragment key={idx}>{action}</React.Fragment>)}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3"><FiLayers size={28} className="text-[#475569]" /><p className="text-sm font-medium text-admin-secondary">No employees found</p></div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen} 
        onClose={() => setConfirmDialog(d => ({ ...d, isOpen: false }))} 
        onConfirm={() => {
          confirmDialog.onConfirm && confirmDialog.onConfirm();
          setConfirmDialog(d => ({ ...d, isOpen: false }));
        }} 
        title={confirmDialog.title || 'Confirm'}
        message={confirmDialog.message || ''}
        type={confirmDialog.type || 'warning'}
        confirmText={confirmDialog.confirmText || 'Confirm'}
      />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <ClearDataModal
        isOpen={clearDialog.isOpen}
        onClose={() => setClearDialog({ isOpen: false, isLoading: false })}
        onConfirm={handleClearRange}
        loading={clearDialog.isLoading}
        title="Clear Manual Attendance Logs"
        description="This will permanently delete manual attendance logs between the selected dates. This action cannot be undone."
      />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-xl flex flex-col animate-scale-in max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-admin-text">{editMode ? 'Edit Manual Attendance' : 'Add Manual Attendance'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editMode ? 'Modify emergency entry' : `Creating entry for ${selectedIds.length} employee(s) on ${date}`}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors"><FiX size={18} /></button>
            </div>
            
            <div className="px-6 py-5 overflow-y-auto dark-scroll space-y-4">
              <form id="manual-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Check-In Time</label>
                    <input type="time" name="login_time" value={formData.login_time} onChange={handleInputChange} disabled={formData.attendance_status === 'Absent'} className="w-full admin-input border border-admin-border text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#3B82F6] disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Check-Out Time</label>
                    <input type="time" name="logout_time" value={formData.logout_time} onChange={handleInputChange} disabled={formData.attendance_status === 'Absent'} className="w-full admin-input border border-admin-border text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#3B82F6] disabled:opacity-50" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Status *</label>
                    <select name="attendance_status" value={formData.attendance_status} onChange={handleInputChange} required className="w-full admin-select border border-admin-border text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#3B82F6] appearance-none">
                      <option value="Present" className="bg-admin-elevated">Present</option>
                      <option value="Absent" className="bg-admin-elevated">Absent</option>
                      <option value="Late" className="bg-admin-elevated">Late</option>
                      <option value="Half Day" className="bg-admin-elevated">Half Day</option>
                    </select>
                  </div>
                  <div className="flex items-center mt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="is_wfh" checked={formData.is_wfh} onChange={handleInputChange} className="hidden" />
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.is_wfh ? 'bg-blue-500 border-blue-500' : 'border-slate-500 bg-transparent'}`}>
                        {formData.is_wfh && <FiCheckSquare size={12} className="text-admin-text" />}
                      </div>
                      <span className="text-sm font-medium text-slate-300">Work From Home</span>
                    </label>
                  </div>
                </div>

                {formData.attendance_status === 'Absent' && (
                  <div>
                    <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Absent Reason *</label>
                    <input type="text" name="remarks" value={formData.remarks} onChange={handleInputChange} required placeholder="Reason for absence" className="w-full bg-red-500/10 border border-red-500/30 text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder:text-red-500/50" />
                  </div>
                )}

                {!editMode && formData.attendance_status !== 'Absent' && (
                  <div>
                    <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Remarks (Optional)</label>
                    <input type="text" name="remarks" value={formData.remarks} onChange={handleInputChange} placeholder="e.g. Field work" className="w-full admin-input border border-admin-border text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#3B82F6]" />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Admin Reason (Optional)</label>
                  <p className="text-xs text-slate-400 mb-2">If left empty, the system will automatically generate a reason from your changes.</p>
                  <input type="text" name="reason" value={formData.reason} onChange={handleInputChange} placeholder="Optional — reason will be generated automatically if left empty" className="w-full bg-amber-500/10 border border-amber-500/30 text-admin-text rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-amber-500/50" />
                </div>
              </form>
            </div>
            
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-bg shrink-0 rounded-b-2xl">
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="submit" form="manual-form" className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white rounded-xl shadow-glow-amber-sm transition-all duration-200 flex items-center gap-2">
                <FiSave size={16} /> {editMode ? 'Save Changes' : 'Create Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminToast 
        message={toastConfig.message} 
        type={toastConfig.type} 
        onClose={() => setToastConfig({ message: '', type: 'success' })} 
      />
    </div>
  );
};

export default AdminManualAttendance;
