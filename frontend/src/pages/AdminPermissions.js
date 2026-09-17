import React, { useState, useEffect, useRef } from 'react';
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
import { FiPlus, FiEdit, FiTrash2, FiClock, FiUsers, FiFileText, FiX, FiSearch, FiCheckCircle } from 'react-icons/fi';

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

  // Searchable Employee Selector state (Modal)
  const [modalEmpSearchQuery, setModalEmpSearchQuery] = useState('');
  const [isModalEmpDropdownOpen, setIsModalEmpDropdownOpen] = useState(false);
  const modalEmpSearchRef = useRef(null);

  // Searchable Employee Selector state (Filter bar)
  const [filterEmpSearchQuery, setFilterEmpSearchQuery] = useState('');
  const [isFilterEmpDropdownOpen, setIsFilterEmpDropdownOpen] = useState(false);
  const filterEmpSearchRef = useRef(null);

  // Close search dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalEmpSearchRef.current && !modalEmpSearchRef.current.contains(event.target)) {
        setIsModalEmpDropdownOpen(false);
      }
      if (filterEmpSearchRef.current && !filterEmpSearchRef.current.contains(event.target)) {
        setIsFilterEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    setModalEmpSearchQuery('');
    setIsModalEmpDropdownOpen(false);
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
    setModalEmpSearchQuery('');
    setIsModalEmpDropdownOpen(false);
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
                <button 
                  onClick={() => {
                    setEditMode(false);
                    setFormData({ id: '', employee_id: '', permission_date: '', from_time: '', to_time: '', reason: '' });
                    setModalEmpSearchQuery('');
                    setIsModalEmpDropdownOpen(false);
                    setShowModal(true);
                  }} 
                  className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow-blue-sm cursor-pointer"
                >
                  <FiPlus size={16} /> Create Permission
                </button>
              )}
            </div>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-2 relative z-30">
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
              <div className="relative min-w-[240px] sm:min-w-[280px]" ref={filterEmpSearchRef}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider">
                    Employee
                  </label>
                  {selectedEmployeeFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeFilter('');
                        setFilterEmpSearchQuery('');
                      }}
                      className="text-[10px] text-admin-muted hover:text-admin-accent transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <FiX size={11} /> Reset to All
                    </button>
                  )}
                </div>

                {/* Filter Search Input */}
                <div className="relative">
                  <FiSearch
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder={
                      (() => {
                        const sel = employees.find(emp => String(emp.employee_id) === String(selectedEmployeeFilter));
                        return sel ? `${sel.name} (${sel.employee_id})` : "All Employees (Type to search...)";
                      })()
                    }
                    value={filterEmpSearchQuery}
                    onFocus={() => setIsFilterEmpDropdownOpen(true)}
                    onChange={(e) => {
                      setFilterEmpSearchQuery(e.target.value);
                      setIsFilterEmpDropdownOpen(true);
                    }}
                    className={`w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-admin-bg border transition-colors ${
                      selectedEmployeeFilter
                        ? 'border-admin-accent/50 text-admin-accent font-bold'
                        : 'border-admin-border text-admin-text placeholder:text-admin-muted font-medium'
                    } focus:outline-none focus:border-admin-accent`}
                  />
                  {(filterEmpSearchQuery || selectedEmployeeFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterEmpSearchQuery('');
                        setSelectedEmployeeFilter('');
                        setIsFilterEmpDropdownOpen(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-text p-1 cursor-pointer"
                      title="Clear employee filter"
                    >
                      <FiX size={13} />
                    </button>
                  )}
                </div>

                {/* Filter Dropdown Results */}
                {isFilterEmpDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 max-h-60 overflow-y-auto rounded-xl bg-admin-elevated border border-admin-border shadow-clay-admin-modal dark-scroll p-1.5 space-y-1">
                    {/* Option: All Employees */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeFilter('');
                        setFilterEmpSearchQuery('');
                        setIsFilterEmpDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                        !selectedEmployeeFilter
                          ? 'bg-admin-accent/20 border border-admin-accent/30 text-admin-accent font-bold'
                          : 'hover:bg-white/5 border border-transparent text-admin-text font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-admin-bg border border-admin-border flex items-center justify-center text-[10px] font-bold text-admin-muted">
                          ALL
                        </div>
                        <span className="text-xs">All Employees</span>
                      </div>
                      {!selectedEmployeeFilter && (
                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <FiCheckCircle size={13} />
                        </span>
                      )}
                    </button>

                    <div className="border-t border-admin-border/50 my-1" />

                    {(() => {
                      const filtered = employees.filter((emp) => {
                        if (!filterEmpSearchQuery.trim()) return true;
                        const q = filterEmpSearchQuery.toLowerCase().trim();
                        const nameMatch = (emp.name || '').toLowerCase().includes(q);
                        const idMatch = (emp.employee_id || '').toLowerCase().includes(q);
                        const roleMatch = (emp.job_role || emp.designation || '').toLowerCase().includes(q);
                        const deptMatch = (emp.department_name || emp.department || '').toLowerCase().includes(q);
                        return nameMatch || idMatch || roleMatch || deptMatch;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-3 text-center text-xs text-admin-muted">
                            No employees matching &quot;{filterEmpSearchQuery}&quot;
                          </div>
                        );
                      }

                      return filtered.map((emp) => {
                        const isSelected = emp.employee_id === selectedEmployeeFilter;
                        return (
                          <button
                            key={emp.id || emp.employee_id}
                            type="button"
                            onClick={() => {
                              setSelectedEmployeeFilter(emp.employee_id);
                              setFilterEmpSearchQuery('');
                              setIsFilterEmpDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-all flex items-center justify-between group cursor-pointer ${
                              isSelected
                                ? 'bg-admin-accent/20 border border-admin-accent/30'
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-admin-bg border border-admin-border text-admin-text font-bold text-[10px] flex items-center justify-center flex-shrink-0 group-hover:border-admin-accent/50">
                                {(emp.name || 'EM')
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-admin-text group-hover:text-admin-accent transition-colors truncate">
                                    {emp.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-blue-400 font-semibold px-1 py-0.2 rounded bg-blue-500/10 border border-blue-500/20">
                                    {emp.employee_id}
                                  </span>
                                </div>
                                <span className="text-[10px] text-admin-secondary block truncate">
                                  {emp.department_name || emp.department || 'General'}
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 flex-shrink-0 ml-1.5">
                                <FiCheckCircle size={13} />
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
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
              {/* Searchable Employee Selection */}
              <div className="sm:col-span-2 space-y-2 relative z-20" ref={modalEmpSearchRef}>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider">
                    Employee <span className="text-rose-500">*</span>
                  </label>
                  {formData.employee_id && !editMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, employee_id: '' }));
                        setModalEmpSearchQuery('');
                        setIsModalEmpDropdownOpen(true);
                      }}
                      className="text-[11px] text-admin-muted hover:text-rose-400 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <FiX size={12} /> Clear Selection
                    </button>
                  )}
                </div>

                {/* Selected Employee Card (when chosen and dropdown is closed) */}
                {(() => {
                  const selectedModalEmp = employees.find(e => String(e.employee_id) === String(formData.employee_id)) || (
                    formData.employee_id ? {
                      employee_id: formData.employee_id,
                      name: permissions.find(p => p.id === formData.id)?.employee_name || formData.employee_id,
                      department_name: permissions.find(p => p.id === formData.id)?.department_name || ''
                    } : null
                  );

                  if (selectedModalEmp && !isModalEmpDropdownOpen) {
                    return (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-admin-bg border border-admin-accent/30 shadow-sm animate-fade-in">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-500 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {(selectedModalEmp.name || 'EM')
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-admin-text truncate">
                                {selectedModalEmp.name}
                              </p>
                              <span className="font-mono text-[10px] text-blue-400 font-bold px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                                {selectedModalEmp.employee_id || selectedModalEmp.id}
                              </span>
                            </div>
                            <p className="text-[11px] text-admin-secondary mt-0.5 truncate">
                              {selectedModalEmp.job_role || selectedModalEmp.designation || 'Staff'} • {selectedModalEmp.department_name || selectedModalEmp.department || 'General'}
                            </p>
                          </div>
                        </div>

                        {!editMode ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsModalEmpDropdownOpen(true);
                              setModalEmpSearchQuery('');
                            }}
                            className="text-xs text-admin-accent hover:text-blue-400 font-bold px-3 py-1.5 rounded-lg bg-admin-accent/10 border border-admin-accent/20 hover:bg-admin-accent/20 transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ml-2"
                          >
                            Change
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-admin-muted bg-white/5 border border-admin-border px-2 py-1 rounded-md">
                            Locked
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    /* Search Input Box */
                    <div className="relative">
                      <FiSearch
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-admin-muted pointer-events-none"
                      />
                      <input
                        type="text"
                        autoFocus={isModalEmpDropdownOpen}
                        disabled={editMode}
                        placeholder="Search employee by name, ID (e.g. MTM-01), role, or department..."
                        value={modalEmpSearchQuery}
                        onFocus={() => { if (!editMode) setIsModalEmpDropdownOpen(true); }}
                        onChange={(e) => {
                          setModalEmpSearchQuery(e.target.value);
                          setIsModalEmpDropdownOpen(true);
                        }}
                        className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text placeholder:text-admin-muted font-medium focus:outline-none focus:border-admin-accent transition-colors"
                      />
                      {modalEmpSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setModalEmpSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-text p-1 cursor-pointer"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Dropdown Results List */}
                {isModalEmpDropdownOpen && !editMode && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-50 max-h-60 overflow-y-auto rounded-xl bg-admin-elevated border border-admin-border shadow-clay-admin-modal dark-scroll p-1.5 space-y-1">
                    {(() => {
                      const filtered = employees.filter((emp) => {
                        if (!modalEmpSearchQuery.trim()) return true;
                        const q = modalEmpSearchQuery.toLowerCase().trim();
                        const nameMatch = (emp.name || '').toLowerCase().includes(q);
                        const idMatch = (emp.employee_id || '').toLowerCase().includes(q);
                        const roleMatch = (emp.job_role || emp.designation || '').toLowerCase().includes(q);
                        const deptMatch = (emp.department_name || emp.department || '').toLowerCase().includes(q);
                        return nameMatch || idMatch || roleMatch || deptMatch;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-admin-muted">
                            No employees found matching &quot;{modalEmpSearchQuery}&quot;
                          </div>
                        );
                      }

                      return filtered.map((emp) => {
                        const isSelected = emp.employee_id === formData.employee_id;
                        return (
                          <button
                            key={emp.id || emp.employee_id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, employee_id: emp.employee_id }));
                              setIsModalEmpDropdownOpen(false);
                              setModalEmpSearchQuery('');
                            }}
                            className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between group cursor-pointer ${
                              isSelected
                                ? 'bg-admin-accent/20 border border-admin-accent/30'
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-admin-bg border border-admin-border text-admin-text font-bold text-[11px] flex items-center justify-center flex-shrink-0 group-hover:border-admin-accent/50">
                                {(emp.name || 'EM')
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-admin-text group-hover:text-admin-accent transition-colors truncate">
                                    {emp.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-blue-400 font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                                    {emp.employee_id}
                                  </span>
                                </div>
                                <span className="text-[10px] text-admin-secondary block mt-0.5 truncate">
                                  {emp.job_role || emp.designation || 'Staff'} • {emp.department_name || emp.department || 'General'}
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 flex-shrink-0 ml-2">
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
