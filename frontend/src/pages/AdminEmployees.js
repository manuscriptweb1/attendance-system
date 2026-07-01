import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getAllEmployees, getAllDepartments, addEmployee, updateEmployee, deleteEmployee, enableWFH, disableWFH, toggleEarlyCheckout } from '../services/api';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiHome, FiClock, FiEye, FiEyeOff, FiX, FiUsers } from 'react-icons/fi';

const getMonthlySalaryValue = (employee) => {
  const value =
    employee.monthly_salary ??
    employee.monthlySalary ??
    employee.base_salary ??
    employee.baseSalary ??
    employee.salary ??
    null;

  if (value === null || value === undefined || value === '') {
    return null;
  }

  const num = Number(value);

  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }

  return num;
};

const formatCurrency = (value) => {
  const num = Number(value);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

const AdminEmployees = () => {
  const [employees,    setEmployees]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editMode,     setEditMode]     = useState(false);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'danger' });
  const [alertDialog,   setAlertDialog]   = useState({ isOpen:false, title:'', message:'', type:'success' });
  const [formData, setFormData] = useState({ 
    id:'', employee_id:'', name:'', department_id:'', job_role:'', mobile:'', email:'', password:'', status:'Active', date_of_birth:'',
    monthly_salary:'', basic_salary:'', hra:'', special_allowance:'', staff_advance:'', professional_tax:'', tds:''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [empRes, deptRes] = await Promise.all([getAllEmployees(), getAllDepartments()]);
      if (empRes.data.success)  setEmployees(empRes.data.employees);
      if (deptRes.data.success) setDepartments(deptRes.data.departments);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleInputChange = e => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const cleanNumber = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return 0;
    }
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      payload.monthly_salary = cleanNumber(formData.monthly_salary);
      payload.basic_salary = cleanNumber(formData.basic_salary || formData.base_salary);
      payload.hra = cleanNumber(formData.hra);
      payload.special_allowance = cleanNumber(formData.special_allowance);
      payload.staff_advance = cleanNumber(formData.staff_advance);
      payload.professional_tax = cleanNumber(formData.professional_tax);
      payload.tds = cleanNumber(formData.tds);

      const response = editMode ? await updateEmployee(payload.id, payload) : await addEmployee(payload);
      if (response.data.success) {
        setAlertDialog({ isOpen:true, title:'Success', message: editMode ? 'Employee updated successfully!' : 'Employee added successfully!', type:'success' });
        fetchData(); closeModal();
      }
    } catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Operation failed.', type:'error' }); }
  };

  const handleEdit = emp => {
    // Format date_of_birth to YYYY-MM-DD for the date input if it exists
    const dob = emp.date_of_birth ? new Date(emp.date_of_birth).toISOString().split('T')[0] : '';
    setFormData({ ...emp, password:'', date_of_birth: dob });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = emp => setConfirmDialog({
    isOpen:true, title:'Delete Employee', type:'danger',
    message:`Are you sure you want to delete "${emp.name}"? This cannot be undone.`,
    onConfirm: async () => {
      try { const r = await deleteEmployee(emp.id); if (r.data.success) { setAlertDialog({ isOpen:true, title:'Success', message:'Employee deleted successfully!', type:'success' }); fetchData(); } }
      catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Delete failed.', type:'error' }); }
    },
  });

  const handleWFHToggle = emp => {
    const action = emp.wfh_enabled ? 'disable' : 'enable';
    setConfirmDialog({
      isOpen:true, title:`${action === 'disable' ? 'Disable' : 'Enable'} Work From Home`, type: emp.wfh_enabled ? 'warning' : 'info',
      message:`Are you sure you want to ${action} WFH access for "${emp.name}"?`,
      onConfirm: async () => {
        try { emp.wfh_enabled ? await disableWFH(emp.employee_id) : await enableWFH(emp.employee_id); setAlertDialog({ isOpen:true, title:'Success', message:`WFH access ${action}d successfully!`, type:'success' }); fetchData(); }
        catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Operation failed.', type:'error' }); }
      },
    });
  };

  const handleEarlyCheckoutToggle = emp => {
    const action = emp.early_checkout_enabled ? 'disable' : 'enable';
    setConfirmDialog({
      isOpen:true, title:`${action === 'disable' ? 'Disable' : 'Enable'} Early Checkout`, type: emp.early_checkout_enabled ? 'warning' : 'info',
      message:`Are you sure you want to ${action} early checkout for "${emp.name}"?`,
      onConfirm: async () => {
        try { const r = await toggleEarlyCheckout(emp.employee_id, !emp.early_checkout_enabled); if (r.data.success) { setAlertDialog({ isOpen:true, title:'Success', message:r.data.message, type:'success' }); fetchData(); } else throw new Error(r.data.message); }
        catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Operation failed.', type:'error' }); }
      },
    });
  };

  const closeModal = () => { 
    setShowModal(false); setEditMode(false); setShowPassword(false); 
    setFormData({ 
      id:'', employee_id:'', name:'', department_id:'', job_role:'', mobile:'', email:'', password:'', status:'Active', date_of_birth:'',
      monthly_salary:'', basic_salary:'', hra:'', special_allowance:'', staff_advance:'', professional_tax:'', tds:''
    }); 
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.employee_id.localeCompare(b.employee_id));

  if (loading) return (
    <div className="flex h-screen bg-[#0E1320]"><Sidebar /><div className="flex-1 flex items-center justify-center"><Spinner size={36} /></div></div>
  );

  return (
    <div className="flex h-screen bg-[#0E1320] dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-14 lg:pt-0">
            <div>
              <h1 className="text-xl font-bold text-white">Employee Management</h1>
              <p className="text-sm text-slate-400 mt-0.5">{employees.length} total employees</p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-glow-blue-sm hover:shadow-glow-blue hover:-translate-y-0.5">
              <FiPlus size={16} /> Add Employee
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
            <input type="text" placeholder="Search by name, ID, or email…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/[0.06] text-white rounded-xl py-3 pl-12 pr-4 text-sm placeholder:text-[#64748B] focus:outline-none focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/15 transition-all" />
          </div>

          {/* Table */}
          <div className="bg-[#161D2E] border border-white/[0.07] rounded-2xl overflow-hidden shadow-clay-admin">
            <div className="overflow-x-auto dark-scroll">
              <table className="min-w-full divide-y divide-white/[0.04]">
                <thead className="bg-[#0E1320]/50">
                  <tr>
                    {['Emp ID','Name','Department','Job Role','Monthly Salary','Mobile','Email','Status','WFH','Early CO','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                    <tr key={emp.id} className="admin-table-row">
                      <td className="px-4 py-3.5 text-sm text-slate-400 font-mono whitespace-nowrap">{emp.employee_id}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-white whitespace-nowrap">{emp.name}</td>
                      <td className="hidden md:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.department_name}</td>
                      <td className="hidden lg:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.job_role}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                        {(() => {
                          const monthlySalary = getMonthlySalaryValue(emp);
                          return monthlySalary ? formatCurrency(monthlySalary) : '-';
                        })()}
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.mobile}</td>
                      <td className="hidden xl:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.email}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge status={emp.status} dark /></td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button onClick={() => handleWFHToggle(emp)} title={emp.wfh_enabled ? 'WFH Enabled' : 'WFH Disabled'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${emp.wfh_enabled ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-white/5 text-[#64748B] hover:bg-white/10'}`}>
                          <FiHome size={14} />
                        </button>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button onClick={() => handleEarlyCheckoutToggle(emp)} title={emp.early_checkout_enabled ? 'Early CO Enabled' : 'Early CO Disabled'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${emp.early_checkout_enabled ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/5 text-[#64748B] hover:bg-white/10'}`}>
                          <FiClock size={14} />
                        </button>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#60A5FA] hover:bg-blue-500/10 transition-colors" title="Edit"><FiEdit size={14} /></button>
                          <button onClick={() => handleDelete(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors" title="Delete"><FiTrash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={10} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3"><FiUsers size={28} className="text-[#475569]" /><p className="text-sm font-medium text-[#64748B]">{searchTerm ? 'No employees match your search' : 'No employees yet'}</p></div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.type === 'danger' ? 'Delete' : 'Confirm'} />
      <AlertDialog   isOpen={alertDialog.isOpen}   onClose={() => setAlertDialog(d => ({ ...d, isOpen:false }))}   title={alertDialog.title}   message={alertDialog.message}   type={alertDialog.type} />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1C2540] border border-white/10 rounded-2xl shadow-clay-admin-modal w-full max-w-2xl max-h-[92vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div>
                <h2 className="text-base font-bold text-white">{editMode ? 'Edit Employee' : 'Add New Employee'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editMode ? 'Update employee information' : 'Fill in the details to create a new employee'}</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-white/5 hover:text-[#64748B] transition-colors"><FiX size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 dark-scroll">
              <form onSubmit={handleSubmit} id="employee-form" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label:'Employee ID', name:'employee_id', type:'text', disabled:editMode },
                  { label:'Full Name',   name:'name',        type:'text' },
                  { label:'Date of Birth', name:'date_of_birth', type:'date', max: new Date().toISOString().split('T')[0] },
                  { label:'Job Role',    name:'job_role',    type:'text' },
                  { label:'Mobile',      name:'mobile',      type:'tel'  },
                  { label:'Email',       name:'email',       type:'email'},
                ].map(({ label, name, type, disabled, ...rest }) => (
                  <div key={name}>
                    <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">{label}</label>
                    <input type={type} name={name} value={formData[name] || ''} onChange={handleInputChange} required disabled={disabled} max={rest.max}
                      className="admin-input" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Department</label>
                  <select name="department_id" value={formData.department_id} onChange={handleInputChange} required className="admin-select">
                    <option value="">Select Department</option>
                    {departments.filter(d => d.status === 'Active').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                    Password {editMode && <span className="text-[#475569] font-normal normal-case">(leave blank to keep current)</span>}
                  </label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} required={!editMode}
                      className="admin-input pr-10" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#64748B]">
                      {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required className="admin-select">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="sm:col-span-2 mt-4 pt-4 border-t border-white/10">
                  <h3 className="text-sm font-bold text-white mb-4">Salary & Payroll Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label:'Monthly Salary (Gross)', name:'monthly_salary' },
                      { label:'Basic Salary', name:'basic_salary' },
                      { label:'HRA', name:'hra' },
                      { label:'Special Allowance', name:'special_allowance' },
                      { label:'Staff Advance / Deductions', name:'staff_advance' },
                      { label:'Professional Tax (PT)', name:'professional_tax' },
                      { label:'TDS', name:'tds' }
                    ].map(({ label, name }) => (
                      <div key={name}>
                        <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">{label}</label>
                        <input type="number" step="0.01" name={name} value={formData[name] || ''} onChange={handleInputChange}
                          className="admin-input" placeholder="0.00" />
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#0E1320]/60 rounded-b-2xl">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-semibold text-slate-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Cancel</button>
              <button type="submit" form="employee-form" className="px-5 py-2 text-sm font-semibold bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl shadow-glow-blue-sm transition-all duration-200">
                {editMode ? 'Save Changes' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminEmployees;
