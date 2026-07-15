import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import AlertDialog from '../../components/AlertDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import { Spinner } from '../../components/Loader';
import { getAllEmployees, getAllDepartments, addEmployee, updateEmployee, deleteEmployee, enableWFH, disableWFH, toggleEarlyCheckout } from '../../services/api';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiHome, FiClock, FiEye, FiEyeOff, FiX, FiUsers, FiDownload } from 'react-icons/fi';
import { sortEmployeeRows } from '../../utils/sorting';
import { toDateInputValue } from '../../utils/dateUtils';

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

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ManageEmployees = () => {
  const { hasPermission } = useAuth();
  const [employees,    setEmployees]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editMode,     setEditMode]     = useState(false);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'danger' });
  const [alertDialog,   setAlertDialog]   = useState({ isOpen:false, title:'', message:'', type:'success' });
  const [sortBy,        setSortBy]        = useState('name_asc');

  const [formData, setFormData] = useState({ 
    id:'', employee_id:'', name:'', department_id:'', job_role:'', mobile:'', email:'', password:'', status:'Active', date_of_birth:'', joining_date:'',
    monthly_salary:'', basic_salary:'', hra:'', special_allowance:'', staff_advance:'', professional_tax:'', tds:'',
    bank_name:'', bank_address:'', account_holder_name:'', account_number:'', ifsc_code:'', pan_card_number:'', aadhar_card_number:'', permanent_address:'', alternate_phone_number:''
  });
  const [formErrors, setFormErrors] = useState({});

  const validateAadhaar = (value) => {
    if (!value) return "";
    const digitsOnly = value.replace(/\s/g, "");
    if (!/^\d+$/.test(digitsOnly)) {
      return "Aadhaar number can contain only digits.";
    }
    if (digitsOnly.length !== 12) {
      return "Aadhaar number must be exactly 12 digits.";
    }
    return "";
  };

  const validatePan = (value) => {
    if (!value) return "";
    const pan = value.toUpperCase();
    if (pan.length !== 10) {
      return "PAN card number must be exactly 10 characters.";
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
      return "PAN format must be 5 letters, 4 digits, and 1 letter. Example: ABCDE1234F.";
    }
    return "";
  };

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
    
    const aadharError = validateAadhaar(formData.aadhar_card_number);
    const panError = validatePan(formData.pan_card_number);
    if (aadharError || panError) {
      setFormErrors({ aadhar_card_number: aadharError, pan_card_number: panError });
      return;
    }
    setFormErrors({});

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
        fetchData(); closeModal();
      }
    } catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Operation failed.', type:'error' }); }
  };

  const handleEdit = emp => {
    // Format date_of_birth to YYYY-MM-DD for the date input if it exists
    const dob = emp.date_of_birth ? toDateInputValue(emp.date_of_birth) : '';
    const joinDate = emp.joining_date ? toDateInputValue(emp.joining_date) : '';
    setFormData({ ...emp, password:'', date_of_birth: dob, joining_date: joinDate });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = emp => setConfirmDialog({
    isOpen:true, title:'Delete Employee', type:'danger',
    message:`Are you sure you want to delete "${emp.name}"? This cannot be undone.`,
    onConfirm: async () => {
      try { const r = await deleteEmployee(emp.id); if (r.data.success) { fetchData(); } }
      catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Delete failed.', type:'error' }); }
    },
  });

  const handleWFHToggle = emp => {
    const action = emp.wfh_enabled ? 'disable' : 'enable';
    setConfirmDialog({
      isOpen:true, title:`${action === 'disable' ? 'Disable' : 'Enable'} Work From Home`, type: emp.wfh_enabled ? 'warning' : 'info',
      message:`Are you sure you want to ${action} WFH access for "${emp.name}"?`,
      onConfirm: async () => {
        try { emp.wfh_enabled ? await disableWFH(emp.employee_id) : await enableWFH(emp.employee_id); fetchData(); }
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
        try { const r = await toggleEarlyCheckout(emp.employee_id, !emp.early_checkout_enabled); if (r.data.success) { fetchData(); } else throw new Error(r.data.message); }
        catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Operation failed.', type:'error' }); }
      },
    });
  };

  const handleExportEmployeesExcel = () => {
    const getEmployeeName = (emp) => {
      return (emp.employee_name || emp.name || emp.full_name || "").trim();
    };

    const sortedEmployees = [...employees].sort((a, b) => {
      const nameA = getEmployeeName(a).toLowerCase();
      const nameB = getEmployeeName(b).toLowerCase();

      if (!nameA && !nameB) return 0;
      if (!nameA) return 1;
      if (!nameB) return -1;

      return nameA.localeCompare(nameB, "en", {
        sensitivity: "base",
        numeric: true
      });
    });

    const exportData = sortedEmployees.map((emp, index) => ({
      "S.No": index + 1,
      "Employee ID": emp.employee_id || emp.employee_code || "-",
      "Employee Name": emp.employee_name || emp.name || "-",
      "Department": emp.department_name || emp.department || "-",
      "Job Role / Designation": emp.designation || emp.job_role || "-",
      "Monthly Salary": emp.monthly_salary || emp.salary || 0,
      "Mobile Number": emp.mobile || emp.phone || "-",
      "Email": emp.email || "-",
      "Status": emp.status || (emp.is_active ? "Active" : "Inactive"),
      "Joining Date": emp.joining_date ? formatDate(emp.joining_date) : "-",
      "WFH Permission": emp.wfh_enabled || emp.is_wfh ? "Yes" : "No",
      "Early Checkout Permission": emp.early_checkout_enabled ? "Yes" : "No",

      "Bank Name": emp.bank_name || "-",
      "Bank Address": emp.bank_address || "-",
      "Account Holder Name": emp.account_holder_name || "-",
      "Account Number": emp.account_number || "-",
      "IFSC Code": emp.ifsc_code || "-",

      "PAN Card Number": emp.pan_card_number || "-",
      "Aadhaar Card Number": emp.aadhar_card_number || "-",

      "Permanent Address": emp.permanent_address || "-",
      "Alternate Phone Number": emp.alternate_phone_number || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 35 },
      { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

    const today = toDateInputValue(new Date());
    XLSX.writeFile(workbook, `employees_export_${today}.xlsx`);
  };

  const closeModal = () => { 
    setShowModal(false); setEditMode(false); setShowPassword(false); 
    setFormData({ 
      id:'', employee_id:'', name:'', department_id:'', job_role:'', mobile:'', email:'', password:'', status:'Active', date_of_birth:'', joining_date:'',
      monthly_salary:'', basic_salary:'', hra:'', special_allowance:'', staff_advance:'', professional_tax:'', tds:'',
      bank_name:'', bank_address:'', account_holder_name:'', account_number:'', ifsc_code:'', pan_card_number:'', aadhar_card_number:'', permanent_address:'', alternate_phone_number:''
    }); 
  };

  const filteredEmployeesRaw = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredEmployees = sortEmployeeRows(filteredEmployeesRaw, sortBy);

  if (loading) return (
    <div className="flex items-center justify-center p-12"><Spinner size={36} /></div>
  );

  return (
    <>
      <div className="animate-fadeIn">
      {/* Search & Sort */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-admin-heading">Employee Management</h1>
          <p className="text-sm text-admin-muted mt-0.5">{employees.length} total employees</p>
        </div>

            <div className="flex items-center gap-3">
              {hasPermission('manage', 'can_export') && (
                <button onClick={handleExportEmployeesExcel}
                  className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-glow-emerald-sm hover:shadow-glow-emerald hover:-translate-y-0.5">
                  <FiDownload size={16} /> Export Excel
                </button>
              )}
              {hasPermission('manage', 'can_create') && (
                <button onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-glow-blue-sm hover:shadow-glow-blue hover:-translate-y-0.5">
                  <FiPlus size={16} /> Add Employee
                </button>
              )}
            </div>
          </div>

          {/* Search & Sort */}
          <div className="flex flex-col sm:flex-row gap-4 mb-5">
            <div className="relative flex-1">
              <FiSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-secondary pointer-events-none" />
              <input type="text" placeholder="Search by name, ID, or email…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-3 pl-12 pr-4 text-sm placeholder:text-admin-secondary focus:outline-none focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/15 transition-all" />
            </div>
            <div className="sm:w-64 shrink-0 relative">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="w-full bg-white/5 border border-admin-border text-admin-text rounded-xl py-3 px-4 pr-10 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/15 transition-all cursor-pointer appearance-none">
                <option value="name_asc" className="text-slate-900">Name A-Z</option>
                <option value="name_desc" className="text-slate-900">Name Z-A</option>
                <option value="employee_id_asc" className="text-slate-900">Employee ID A-Z</option>
                <option value="employee_id_desc" className="text-slate-900">Employee ID Z-A</option>
                <option value="salary_asc" className="text-slate-900">Salary Low to High</option>
                <option value="salary_desc" className="text-slate-900">Salary High to Low</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-admin-secondary">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin">
            <div className="table-responsive dark-scroll">
              <table className="min-w-full divide-y divide-white/[0.04]">
                <thead className="bg-admin-bg">
                  <tr>
                    {['Emp ID','Name','Department','Job Role','Monthly Salary','Mobile','Email','Status','Joining Date','WFH','Early CO','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                    <tr key={emp.id} className="admin-table-row">
                      <td className="px-4 py-3.5 text-sm text-slate-400 font-mono whitespace-nowrap">{emp.employee_id}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap">
                        <button onClick={() => { setSelectedEmployee(emp); setShowDetailModal(true); }} className="employee-name-clickable text-left">
                          {emp.name}
                        </button>
                      </td>
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
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{formatDate(emp.joining_date)}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button onClick={() => handleWFHToggle(emp)} title={emp.wfh_enabled ? 'WFH Enabled' : 'WFH Disabled'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${emp.wfh_enabled ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-white/5 text-admin-secondary hover:bg-white/10'}`}>
                          <FiHome size={14} />
                        </button>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button onClick={() => handleEarlyCheckoutToggle(emp)} title={emp.early_checkout_enabled ? 'Early CO Enabled' : 'Early CO Disabled'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${emp.early_checkout_enabled ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/5 text-admin-secondary hover:bg-white/10'}`}>
                          <FiClock size={14} />
                        </button>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {hasPermission('manage', 'can_edit') && (
                            <button onClick={() => handleEdit(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#60A5FA] hover:bg-blue-500/10 transition-colors" title="Edit"><FiEdit size={14} /></button>
                          )}
                          {hasPermission('manage', 'can_delete') && (
                            <button onClick={() => handleDelete(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors" title="Delete"><FiTrash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={10} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3"><FiUsers size={28} className="text-[#475569]" /><p className="text-sm font-medium text-admin-secondary">{searchTerm ? 'No employees match your search' : 'No employees yet'}</p></div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </div>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.type === 'danger' ? 'Delete' : 'Confirm'} />
      <AlertDialog   isOpen={alertDialog.isOpen}   onClose={() => setAlertDialog(d => ({ ...d, isOpen:false }))}   title={alertDialog.title}   message={alertDialog.message}   type={alertDialog.type} />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-2xl max-h-[92vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border">
              <div>
                <h2 className="text-base font-bold text-admin-text">{editMode ? 'Edit Employee' : 'Add New Employee'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editMode ? 'Update employee information' : 'Fill in the details to create a new employee'}</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors"><FiX size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 dark-scroll">
              <form onSubmit={handleSubmit} id="employee-form" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label:'Employee ID', name:'employee_id', type:'text', disabled:editMode },
                  { label:'Full Name',   name:'name',        type:'text' },
                  { label:'Date of Birth', name:'date_of_birth', type:'date', max: toDateInputValue(new Date()) },
                  { label:'Job Role',    name:'job_role',    type:'text' },
                  { label:'Mobile',      name:'mobile',      type:'tel'  },
                  { label:'Email',       name:'email',       type:'email'},
                  { label:'Joining Date', name:'joining_date', type:'date', max: toDateInputValue(new Date()), required: false },
                ].map(({ label, name, type, disabled, required = true, ...rest }) => (
                  <div key={name}>
                    <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">{label}</label>
                    <input type={type} name={name} value={formData[name] || ''} onChange={handleInputChange} required={required && !disabled} disabled={disabled} max={rest.max}
                      className="admin-input" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Department</label>
                  <select name="department_id" value={formData.department_id} onChange={handleInputChange} required className="admin-select">
                    <option value="">Select Department</option>
                    {departments.filter(d => d.status === 'Active').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                    Password {editMode && <span className="text-[#475569] font-normal normal-case">(leave blank to keep current)</span>}
                  </label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} required={!editMode}
                      className="admin-input pr-10" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-secondary hover:text-admin-secondary">
                      {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required className="admin-select">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="sm:col-span-2 mt-4 pt-4 border-t border-admin-border">
                  <h3 className="text-sm font-bold text-admin-text mb-4">Salary & Payroll Details</h3>
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
                        <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">{label}</label>
                        <input type="number" step="0.01" name={name} value={formData[name] || ''} onChange={handleInputChange}
                          className="admin-input" placeholder="0.00" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account & Personal Details */}
                <div className="sm:col-span-2 mt-4 pt-4 border-t border-admin-border">
                  <h3 className="text-sm font-bold text-admin-text mb-4">Account & Personal Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Bank Name</label>
                      <input type="text" name="bank_name" value={formData.bank_name || ''} onChange={handleInputChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Account Holder Name</label>
                      <input type="text" name="account_holder_name" value={formData.account_holder_name || ''} onChange={handleInputChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Account Number</label>
                      <input type="text" name="account_number" value={formData.account_number || ''} onChange={handleInputChange} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">IFSC Code</label>
                      <input type="text" name="ifsc_code" value={formData.ifsc_code || ''} onChange={(e) => setFormData(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))} className="admin-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">PAN Card Number</label>
                      <input type="text" name="pan_card_number" value={formData.pan_card_number || ''} onChange={(e) => {
                        setFormData(f => ({ ...f, pan_card_number: e.target.value.toUpperCase() }));
                        if (formErrors.pan_card_number) setFormErrors(err => ({ ...err, pan_card_number: '' }));
                      }} className={`admin-input ${formErrors.pan_card_number ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : ''}`} maxLength={10} />
                      {formErrors.pan_card_number && <p className="text-xs text-red-500 mt-1.5">{formErrors.pan_card_number}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Aadhar Card Number</label>
                      <input type="text" name="aadhar_card_number" value={formData.aadhar_card_number || ''} onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9\s]/g, '');
                        if (val.replace(/\s/g, '').length <= 12) {
                          setFormData(f => ({ ...f, aadhar_card_number: val }));
                        }
                        if (formErrors.aadhar_card_number) setFormErrors(err => ({ ...err, aadhar_card_number: '' }));
                      }} className={`admin-input ${formErrors.aadhar_card_number ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : ''}`} />
                      {formErrors.aadhar_card_number && <p className="text-xs text-red-500 mt-1.5">{formErrors.aadhar_card_number}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Alternate Phone Number</label>
                      <input type="tel" name="alternate_phone_number" value={formData.alternate_phone_number || ''} onChange={handleInputChange} className="admin-input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Bank Address</label>
                      <textarea name="bank_address" value={formData.bank_address || ''} onChange={handleInputChange} className="admin-input min-h-[60px]" rows="2" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Permanent Address</label>
                      <textarea name="permanent_address" value={formData.permanent_address || ''} onChange={handleInputChange} className="admin-input min-h-[60px]" rows="2" />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-bg rounded-b-2xl">
              <button type="button" onClick={closeModal} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="submit" form="employee-form" className="px-5 py-2 text-sm font-semibold bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl shadow-glow-blue-sm transition-all duration-200">
                {editMode ? 'Save Changes' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Detail Drawer / Modal */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-lg max-h-[92vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border bg-admin-surface rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-admin-text">Employee Details</h2>
                <p className="text-sm font-mono text-[#3B82F6] mt-0.5 font-semibold">{selectedEmployee.employee_id} - {selectedEmployee.name}</p>
              </div>
              <button onClick={() => { setShowDetailModal(false); setSelectedEmployee(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors"><FiX size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 dark-scroll space-y-6">
              {/* Basic Details */}
              <div>
                <h3 className="text-[11px] font-bold text-admin-secondary uppercase tracking-widest mb-3 pb-1 border-b border-admin-border/50">Basic Details</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Department</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.department_name || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Designation</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.job_role || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Phone</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.mobile || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Email</p><p className="text-sm font-medium text-admin-text truncate">{selectedEmployee.email || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Status</p><div className="mt-0.5"><StatusBadge status={selectedEmployee.status} dark /></div></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Joining Date</p><p className="text-sm font-medium text-admin-text">{formatDate(selectedEmployee.joining_date) || '—'}</p></div>
                </div>
              </div>

              {/* Bank Account Details */}
              <div>
                <h3 className="text-[11px] font-bold text-admin-secondary uppercase tracking-widest mb-3 pb-1 border-b border-admin-border/50">Bank Account Details</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div className="col-span-2 sm:col-span-1"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Bank Name</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.bank_name || '—'}</p></div>
                  <div className="col-span-2 sm:col-span-1"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Account Holder</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.account_holder_name || '—'}</p></div>
                  <div className="col-span-2 sm:col-span-1"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Account Number</p><p className="text-sm font-medium font-mono text-admin-text">{selectedEmployee.account_number || '—'}</p></div>
                  <div className="col-span-2 sm:col-span-1"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">IFSC Code</p><p className="text-sm font-medium font-mono text-admin-text">{selectedEmployee.ifsc_code || '—'}</p></div>
                  <div className="col-span-2"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Bank Address</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.bank_address || '—'}</p></div>
                </div>
              </div>

              {/* Identity Details */}
              <div>
                <h3 className="text-[11px] font-bold text-admin-secondary uppercase tracking-widest mb-3 pb-1 border-b border-admin-border/50">Identity Details</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">PAN</p><p className="text-sm font-medium font-mono text-admin-text">{selectedEmployee.pan_card_number || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Aadhar</p><p className="text-sm font-medium font-mono text-admin-text">{selectedEmployee.aadhar_card_number || '—'}</p></div>
                </div>
              </div>

              {/* Address & Contact */}
              <div>
                <h3 className="text-[11px] font-bold text-admin-secondary uppercase tracking-widest mb-3 pb-1 border-b border-admin-border/50">Address & Contact</h3>
                <div className="grid grid-cols-1 gap-y-3">
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Alternate Phone</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.alternate_phone_number || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Permanent Address</p><p className="text-sm font-medium text-admin-text whitespace-pre-wrap">{selectedEmployee.permanent_address || '—'}</p></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-admin-border bg-admin-bg rounded-b-2xl flex justify-end">
              <button onClick={() => { setShowDetailModal(false); setSelectedEmployee(null); }} className="admin-btn-neutral rounded-xl px-5 py-2 text-sm font-semibold shadow-sm hover:shadow transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default ManageEmployees;
