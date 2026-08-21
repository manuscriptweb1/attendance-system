import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getAbsentEmployees, updateAbsentReason, clearAbsentReason, getAllDepartments, clearAbsentReasonRange } from '../services/api';
import ClearRangeDialog from '../components/ClearRangeDialog';
import { getErrorMessage } from '../utils/errorHandler';
import { validateDateString } from '../utils/dateValidation';
import { FiEdit, FiSearch, FiCalendar, FiFilter, FiSave, FiX, FiLayers, FiTrash2, FiCheckCircle, FiUserX } from 'react-icons/fi';
import { sortEmployeeRows } from '../utils/sorting';

import { toDateInputValue } from '../utils/dateUtils';

const getLocalYMD = () => {
  return toDateInputValue(new Date());
};

const AdminAbsentReasons = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [date, setDate] = useState(getLocalYMD());
  const [departmentId, setDepartmentId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [departments, setDepartments] = useState([]);
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [targetAttendanceId, setTargetAttendanceId] = useState(null);
  const [targetEmployeeId, setTargetEmployeeId] = useState(null);
  const [targetDate, setTargetDate] = useState('');
  const [targetName, setTargetName] = useState('');
  
  const [reason, setReason] = useState('');
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [clearingId, setClearingId] = useState(null);
  const [clearDialog, setClearDialog] = useState({ isOpen: false, isLoading: false });

  const predefinedReasons = [
    'Medical Leave', 'Family Emergency', 'Personal Work', 
    'Transport Issue', 'Weather', 'Network Failure', 
    'Power Failure', 'Permission', 'Uninformed'
  ];

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, departmentId]);

  const fetchDepartments = async () => {
    try {
      const res = await getAllDepartments();
      if (res.data.success) setDepartments(res.data.departments.filter(d => d.status === 'Active'));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getAbsentEmployees({ date, department_id: departmentId, search: searchTerm });
      if (res.data.success) {
        setEmployees(res.data.absentEmployees);
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (emp) => {
    const dateError = validateDateString(date, { allowFuture: false, isAbsentReason: true });
    if (dateError) {
      setAlertDialog({ isOpen: true, title: 'Error', message: dateError, type: 'error' });
      return;
    }

    setTargetAttendanceId(emp.attendance_id);
    setTargetEmployeeId(emp.employee_id);
    setTargetDate(date);
    setTargetName(emp.name);
    setReason(emp.absent_reason || '');
    setShowModal(true);
  };

  const handleClearRange = async (data) => {
    try {
      setClearDialog(prev => ({ ...prev, isLoading: true }));
      const response = await clearAbsentReasonRange(data);
      if (response.data.success) {
        setClearDialog({ isOpen: false, isLoading: false });
        setToastConfig({ message: response.data.message || 'Records cleared successfully.', type: 'success' });
        fetchData();
      } else {
        setClearDialog(prev => ({ ...prev, isLoading: false }));
        setAlertDialog({ isOpen: true, title: 'Error', message: response.data.message || 'Failed to clear absent reasons', type: 'error' });
      }
    } catch (error) {
      setClearDialog(prev => ({ ...prev, isLoading: false }));
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dateError = validateDateString(targetDate, { allowFuture: false, isAbsentReason: true });
    if (dateError) {
      setAlertDialog({ isOpen: true, title: 'Error', message: dateError, type: 'error' });
      return;
    }

    if (!reason.trim()) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Absent reason cannot be empty.', type: 'error' });
      return;
    }
    if (reason.length > 500) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Reason must be less than 500 characters.', type: 'error' });
      return;
    }

    try {
      // Send employee_id and date in body in case there is no existing attendance record
      const payload = { reason, employee_id: targetEmployeeId, date: targetDate };
      const res = await updateAbsentReason(targetAttendanceId || 'new', payload);
      if (res.data.success) {
        setToastConfig({ message: 'Absent reason saved.', type: 'success' });
        setShowModal(false);
        fetchData();
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  const handleClearReason = async (emp) => {
    if (!emp.attendance_id || !emp.absent_reason) return;
    setClearingId(emp.attendance_id);
    try {
      const res = await clearAbsentReason(emp.attendance_id);
      if (res.data.success) {
        setToastConfig({ message: 'Absent reason has been cleared.', type: 'success' });
        fetchData();
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    } finally {
      setClearingId(null);
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
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pt-14 lg:pt-0">
            <div>
              <h1 className="text-xl font-bold text-admin-heading flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                Leave & Attendance Exceptions
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">Record and track reasons for employee absences</p>
            </div>
            <div className="flex items-center">
              {hasPermission('absent_reasons', 'can_clear') && (
                <button onClick={() => setClearDialog({ isOpen: true })} className="flex items-center gap-2 bg-admin-surface border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                  <FiTrash2 size={16} /> Clear Month
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs between Absent Reasons & Paid Leave */}
          <div className="flex items-center gap-2 p-1.5 bg-admin-surface border border-admin-border rounded-2xl w-fit mb-6 shadow-sm">
            <button
              onClick={() => navigate('/admin/absent-reasons')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-admin-accent text-white shadow-md shadow-blue-500/20"
            >
              <FiUserX size={16} /> Absent Reasons
            </button>
            <button
              onClick={() => navigate('/admin/paid-leaves')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all text-admin-secondary hover:text-admin-text hover:bg-admin-elevated"
            >
              <FiCheckCircle size={16} /> Paid Leave
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Date</label>
              <div className="relative">
                <FiCalendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} max={toDateInputValue(new Date())}
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
              <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Search</label>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
                  <input type="text" placeholder="Name or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6]" />
                </div>
                <button onClick={fetchData} className="bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200">
                  Search
                </button>
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

          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin">
            <div className="table-responsive overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px] dark-scroll relative">
              <table className="min-w-full divide-y divide-white/[0.04]">
                <thead className="bg-admin-bg sticky top-0 z-10 shadow-sm">
                  <tr>
                    {['Emp ID', 'Name', 'Department', 'Date', 'Status', 'Absent Reason', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 z-10">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-16 text-center"><Spinner size={32} /></td></tr>
                  ) : filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                    <tr key={emp.employee_id} className="admin-table-row">
                      <td className="px-4 py-3.5 text-sm text-slate-400 font-mono whitespace-nowrap">{emp.employee_id}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-admin-text whitespace-nowrap">{emp.name}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.department_name || '-'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{new Date(emp.attendance_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge status={emp.attendance_status} dark /></td>
                      <td className="px-4 py-3.5 text-sm text-slate-300 max-w-[200px] truncate">{emp.absent_reason || <span className="text-slate-500 italic">None</span>}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {hasPermission('absent_reasons', 'can_edit') && (
                            <button onClick={() => openModal(emp)} className="text-amber-400 hover:text-amber-300 transition-colors text-sm font-medium flex items-center gap-1.5"><FiEdit size={14} /> {emp.absent_reason ? 'Edit' : 'Add'} Reason</button>
                          )}
                          {hasPermission('absent_reasons', 'can_delete') && emp.absent_reason && emp.attendance_id && (
                            <button onClick={() => handleClearReason(emp)} disabled={clearingId === emp.attendance_id} className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
                              <FiTrash2 size={14} /> Clear
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3"><FiLayers size={28} className="text-[#475569]" /><p className="text-sm font-medium text-admin-secondary">No absent employees found</p></div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <ClearRangeDialog 
        isOpen={clearDialog.isOpen} 
        onClose={() => setClearDialog({ isOpen: false })} 
        onConfirm={handleClearRange} 
        title="Clear Absent Reasons Range" 
        message="⚠️ WARNING: This will permanently clear absent reasons for the selected date range. This action cannot be undone." 
        isLoading={clearDialog.isLoading}
      />

      {toastConfig.message && (
        <AdminToast 
          message={toastConfig.message} 
          type={toastConfig.type} 
          onClose={() => setToastConfig({ message: '', type: 'success' })} 
        />
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="absent-reason-modal admin-modal bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-lg flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-admin-text">Absent Reason</h2>
                <p className="text-xs text-slate-400 mt-0.5">For {targetName}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors"><FiX size={18} /></button>
            </div>
            
            <div className="px-6 py-5 overflow-y-auto dark-scroll space-y-4">
              <form id="reason-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Quick Select</label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {predefinedReasons.map(pr => (
                      <button type="button" key={pr} onClick={() => setReason(pr)}
                        className={`quick-select-btn px-3 py-1.5 rounded-lg text-xs transition-colors ${reason === pr ? 'active' : ''}`}>
                        {pr}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Reason (Custom or Selected)</label>
                  <textarea name="reason" value={reason} onChange={e => setReason(e.target.value)} required rows={4} maxLength={500} placeholder="Type reason here..." className="absent-reason-input w-full admin-input resize-none" />
                  <div className="flex justify-end mt-1">
                    <span className={`text-[10px] ${reason.length > 450 ? 'text-amber-500' : 'text-slate-500'}`}>{reason.length}/500</span>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-bg shrink-0 rounded-b-2xl">
              <button type="button" onClick={() => setShowModal(false)} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="submit" form="reason-form" className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white rounded-xl shadow-glow-amber-sm transition-all duration-200 flex items-center gap-2">
                <FiSave size={16} /> Save Reason
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAbsentReasons;
