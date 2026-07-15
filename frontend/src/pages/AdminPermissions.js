import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import ConfirmDialog from '../components/ConfirmDialog';
import { Spinner } from '../components/Loader';
import ClearDataModal from '../components/ClearDataModal';
import { toDateInputValue, formatDisplayDate } from '../utils/dateUtils';
import { getPermissions, getPermissionSummary, createPermission, updatePermission, deletePermission, clearPermissionRange, getAllEmployees } from '../services/api';
import { formatDate } from '../utils/formatTime';
import { getErrorMessage } from '../utils/errorHandler';
import { validateMonthYear } from '../utils/dateValidation';
import { FiPlus, FiEdit, FiTrash2, FiClock, FiUsers, FiFileText, FiX } from 'react-icons/fi';

const formatDuration = (minutes) => {
  const total = Number(minutes || 0);
  if (!total || total <= 0) return "0 min";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
};

const AdminPermissions = () => {
  const { hasPermission } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [formData, setFormData] = useState({ 
    id: '', employee_id: '', permission_date: '', from_time: '', to_time: '', reason: ''
  });
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });

  const fetchData = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [permRes, sumRes, empRes] = await Promise.all([
        getPermissions(month, year, selectedEmployeeFilter || undefined),
        getPermissionSummary(month, year),
        getAllEmployees()
      ]);
      
      if (permRes.data.success) setPermissions(permRes.data.permissions);
      if (sumRes.data.success) setSummary(sumRes.data.summary);
      if (empRes.data.success) {
        // active employees only
        setEmployees(empRes.data.employees.filter(e => e.status?.toLowerCase() === 'active'));
      }
    } catch (e) {
      console.error('Permissions fetch failed:', e);
      if (e.response?.status === 401) {
        setAlertDialog({ isOpen: true, title: 'Session Expired', message: 'Session expired. Please login again.', type: 'error' });
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [month, year, selectedEmployeeFilter]); // eslint-disable-line

  const handleInputChange = e => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    
    if (!formData.employee_id) {
      setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'Employee is required.', type: 'error' });
      return;
    }

    // Client side duration calculation to check > 0
    const [fromH, fromM] = formData.from_time.split(':').map(Number);
    const [toH, toM] = formData.to_time.split(':').map(Number);
    const fromTotal = fromH * 60 + fromM;
    const toTotal = toH * 60 + toM;
    
    if (toTotal <= fromTotal) {
      setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'To Time must be after From Time.', type: 'error' });
      return;
    }

    try {
      let payload = { ...formData };
      if (!editMode) {
        const selectedEmp = employees.find(e => String(e.employee_id) === String(formData.employee_id));
        if (selectedEmp) {
          payload.employee_name = selectedEmp.name;
          payload.department_name = selectedEmp.department_name || selectedEmp.department || 'N/A';
        }
      }

      const response = editMode ? await updatePermission(formData.id, payload) : await createPermission(payload);
      if (response.data.success) {
        setToastConfig({ message: editMode ? 'Permission updated!' : 'Permission created!', type: 'success' });
        fetchData(); 
        closeModal();
      }
    } catch (error) { 
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error) || error.response?.data?.message, type: 'error' }); 
    }
  };

  const handleEdit = perm => {
    setFormData({ 
      id: perm.id,
      employee_id: perm.employee_id,
      permission_date: toDateInputValue(perm.permission_date),
      from_time: perm.from_time,
      to_time: perm.to_time,
      reason: perm.reason || ''
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = perm => setConfirmDialog({
    isOpen: true, title: 'Delete Permission', type: 'danger',
    message: `Are you sure you want to delete permission for "${perm.employee_name}" on ${formatDate(perm.permission_date)}?`,
    onConfirm: async () => {
      try { 
        await deletePermission(perm.id);
        setToastConfig({ message: 'Deleted successfully!', type: 'success' }); 
        fetchData(); 
      }
      catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' }); }
    },
  });

  const closeModal = () => { 
    setShowModal(false); 
    setEditMode(false); 
    setFormData({ id: '', employee_id: '', permission_date: '', from_time: '', to_time: '', reason: '' }); 
  };

  const handleClearPermissions = async ({ fromDate, toDate }) => {
    setClearLoading(true);
    try {
      const response = await clearPermissionRange({
        from_date: fromDate,
        to_date: toDate,
        confirmation: 'DELETE'
      });
      
      setToastConfig({ message: response.data?.message || 'Permission records cleared successfully', type: 'success' });
      setShowClearModal(false);
      fetchData();
    } catch (error) {
      setAlertDialog({ 
        isOpen: true, 
        title: 'Error', 
        message: error.response?.data?.message || getErrorMessage(error) || 'Failed to clear permission records', 
        type: 'error' 
      });
    } finally {
      setClearLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight">Permissions</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Manage employee permission requests and time tracking.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {hasPermission('permissions', 'can_clear') && (
                <button onClick={() => setShowClearModal(true)} className="flex items-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                  <FiTrash2 size={16} /> Clear
                </button>
              )}
              {hasPermission('permissions', 'can_create') && (
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow-blue-sm">
                  <FiPlus size={16} /> Create Permission
                </button>
              )}
            </div>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-2">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Month</label>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="admin-select py-2 text-sm text-admin-muted">
                  {[...Array(12).keys()].map(m => (
                    <option key={m+1} value={m+1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Year</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="admin-select py-2 text-sm text-admin-muted">
                  {[...Array(5).keys()].map(y => {
                    const yearVal = new Date().getFullYear() - 2 + y;
                    return <option key={yearVal} value={yearVal}>{yearVal}</option>
                  })}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Employee</label>
                <select value={selectedEmployeeFilter} onChange={e => setSelectedEmployeeFilter(e.target.value)} className="admin-select py-2 text-sm text-admin-muted">
                  <option value="">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>{emp.name} ({emp.employee_id})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fadeInUp stagger-3">
              {[
                { label: 'Total Records', value: summary.totalRecords, icon: FiFileText, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
                { label: 'Employees', value: summary.employeesWithPermission, icon: FiUsers, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'Total Time', value: formatDuration(summary.totalPermissionMinutes), icon: FiClock, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', isString: true },
                { label: "Today's Permissions", value: summary.todayCount, icon: FiClock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
              ].map((stat, i) => (
                <div key={i} className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-clay-admin flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3 ${stat.bg} ${stat.color}`}>
                    <stat.icon size={18} />
                  </div>
                  <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Spinner size={36} color="blue" />
              </div>
            ) : (
              <div className="table-responsive dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg select-none">
                    <tr>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Employee</th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Date</th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Time Range</th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Duration</th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Reason</th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {permissions.length > 0 ? permissions.map(p => (
                      <tr key={p.id} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-admin-text">{p.employee_name}</span>
                            <span className="text-xs text-admin-muted">{p.employee_id} | {p.department_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-admin-secondary whitespace-nowrap">{formatDisplayDate(p.permission_date)}</td>
                        <td className="px-5 py-4 text-xs text-admin-secondary whitespace-nowrap">
                          {p.from_time} - {p.to_time}
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-indigo-400 whitespace-nowrap">
                          {formatDuration(p.duration_minutes)}
                        </td>
                        <td className="px-5 py-4 text-xs text-admin-muted truncate max-w-xs">{p.reason || '—'}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {hasPermission('permissions', 'can_edit') && (
                              <button onClick={() => handleEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#60A5FA] hover:bg-blue-500/10 transition-colors"><FiEdit size={14} /></button>
                            )}
                            {hasPermission('permissions', 'can_delete') && (
                              <button onClick={() => handleDelete(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors"><FiTrash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-5 py-16 text-center text-admin-secondary text-sm">No permissions found for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen: false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />

      <ClearDataModal
        isOpen={showClearModal}
        title="Clear Permission Records"
        description="This will permanently clear permission records between the selected dates. This action cannot be undone."
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearPermissions}
        loading={clearLoading}
      />

      {showModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border">
              <h2 className="text-base font-bold text-admin-text">{editMode ? 'Edit Permission' : 'Create Permission'}</h2>
              <button onClick={closeModal} className="text-admin-secondary hover:text-admin-text"><FiX size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Employee *</label>
                <select name="employee_id" value={formData.employee_id} onChange={handleInputChange} required disabled={editMode} className="admin-select text-admin-muted">
                  <option value="">-- Select Employee --</option>
                  {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Date *</label>
                <input type="date" name="permission_date" value={formData.permission_date} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div></div>
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">From Time *</label>
                <input type="time" name="from_time" value={formData.from_time} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">To Time *</label>
                <input type="time" name="to_time" value={formData.to_time} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Reason *</label>
                <textarea name="reason" value={formData.reason} onChange={handleInputChange} required rows="2" className="admin-input" placeholder="Explain the reason for permission..." />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={closeModal} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-semibold bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl shadow-glow-blue-sm transition-all duration-200">
                  {editMode ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
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

export default AdminPermissions;
