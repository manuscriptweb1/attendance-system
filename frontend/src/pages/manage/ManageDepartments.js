import React, { useState, useEffect, useMemo } from 'react';

import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import AlertDialog from '../../components/AlertDialog';
import AdminToast from '../../components/AdminToast';
import StatusBadge from '../../components/ui/StatusBadge';
import { Spinner } from '../../components/Loader';
import { getAllDepartments, addDepartment, updateDepartment, deleteDepartment } from '../../services/api';
import { formatDate } from '../../utils/formatTime';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiX, FiLayers, FiCheckCircle, FiActivity, FiXCircle } from 'react-icons/fi';

const ManageDepartments = () => {
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [formData, setFormData] = useState({ id: '', name: '', description: '', status: 'Active' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getAllDepartments();
      if (res.data.success) {
        setDepartments(res.data.departments || []);
      }
    } catch (e) {
      console.error(e);
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to fetch departments.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = e => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const response = editMode ? await updateDepartment(formData.id, formData) : await addDepartment(formData);
      if (response.data.success) {
        setToastConfig({ message: editMode ? 'Department updated successfully!' : 'Department added successfully!', type: 'success' });
        fetchData();
        closeModal();
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Operation failed.', type: 'error' });
    }
  };

  const handleEdit = dept => {
    setFormData({ id: dept.id, name: dept.name, description: dept.description || '', status: dept.status || 'Active' });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = dept => setConfirmDialog({
    isOpen: true, title: 'Delete Department', type: 'danger',
    message: `Are you sure you want to delete "${dept.name}"? This cannot be undone.`,
    onConfirm: async () => {
      try {
        const r = await deleteDepartment(dept.id);
        if (r.data.success) {
          setToastConfig({ message: 'Department deleted successfully!', type: 'success' });
          fetchData();
        }
      } catch (error) {
        setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Delete failed.', type: 'error' });
      }
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditMode(false);
    setFormData({ id: '', name: '', description: '', status: 'Active' });
  };

  const filteredDepartments = useMemo(() => departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [departments, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = departments.length;
    const active = departments.filter(d => d.status === 'Active').length;
    const assigned = departments.filter(d => parseInt(d.employee_count || 0) > 0).length;
    const unused = departments.filter(d => parseInt(d.employee_count || 0) === 0).length;
    return { total, active, assigned, unused };
  }, [departments]);

  if (loading) return (
    <div className="flex items-center justify-center p-12"><Spinner size={36} /></div>
  );

  return (
    <>
      <div className="animate-fadeIn">
      {/* Top Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Departments', value: stats.total, icon: FiLayers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Active', value: stats.active, icon: FiCheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Assigned', value: stats.assigned, icon: FiActivity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { label: 'Unused', value: stats.unused, icon: FiXCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' }
            ].map(stat => (
              <div key={stat.label} className="bg-admin-surface border border-admin-border p-5 rounded-2xl shadow-clay-admin">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-1">{stat.label}</p>
                    <h3 className="text-2xl font-bold text-admin-heading">{stat.value}</h3>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-5 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
              <input type="text" placeholder="Search departments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-2.5 pl-12 pr-4 text-sm placeholder:text-admin-secondary focus:outline-none focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/15 transition-all" />
            </div>
            {hasPermission('manage', 'can_create') && (
              <button onClick={() => { setEditMode(false); setFormData({ id: '', name: '', description: '', status: 'Active' }); setShowModal(true); }}
                className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-glow-blue-sm hover:shadow-glow-blue hover:-translate-y-0.5">
                <FiPlus size={16} /> Add Department
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin">
            <div className="table-responsive dark-scroll">
              <table className="min-w-full divide-y divide-white/[0.04]">
                <thead className="bg-admin-bg">
                  <tr>
                    {['Department Name', 'Description', 'Employee Count', 'Status', 'Created Date', 'Updated Date', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredDepartments.length > 0 ? filteredDepartments.map(dept => (
                    <tr key={dept.id} className="admin-table-row">
                      <td className="px-4 py-3.5 text-sm font-semibold text-admin-text whitespace-nowrap">{dept.name}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap truncate max-w-[200px]">{dept.description || '—'}</td>
                      <td className="px-4 py-3.5 text-sm font-mono text-blue-400 whitespace-nowrap">{dept.employee_count || 0}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge status={dept.status || 'Active'} dark /></td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{formatDate(dept.created_at)}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{dept.updated_at ? formatDate(dept.updated_at) : '—'}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {hasPermission('manage', 'can_edit') && (
                            <button onClick={() => handleEdit(dept)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#60A5FA] hover:bg-blue-500/10 transition-colors" title="Edit"><FiEdit size={14} /></button>
                          )}
                          {hasPermission('manage', 'can_delete') && (
                            <button onClick={() => handleDelete(dept)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors" title="Delete"><FiTrash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3"><FiLayers size={28} className="text-[#475569]" /><p className="text-sm font-medium text-admin-secondary">{searchTerm ? 'No departments match your search' : 'No departments found'}</p></div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen: false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.type === 'danger' ? 'Delete' : 'Confirm'} />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-lg flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border">
              <div>
                <h2 className="text-base font-bold text-admin-text">{editMode ? 'Edit Department' : 'Add New Department'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editMode ? 'Update department information' : 'Create a new department'}</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors"><FiX size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <form onSubmit={handleSubmit} id="department-form" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Department Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required maxLength={100}
                    className="admin-input" placeholder="e.g. Human Resources" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Description (Optional)</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} maxLength={250}
                    className="admin-input resize-none py-3" placeholder="Brief description of the department..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required className="admin-select">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-bg rounded-b-2xl">
              <button type="button" onClick={closeModal} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="submit" form="department-form" className="px-5 py-2 text-sm font-semibold bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl shadow-glow-blue-sm transition-all duration-200">
                {editMode ? 'Save Changes' : 'Add Department'}
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
    </>
  );
};

export default ManageDepartments;
