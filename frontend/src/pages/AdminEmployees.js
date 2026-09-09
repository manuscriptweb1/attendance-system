import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getAllEmployees, getResignedEmployees, updateResignedEmployee, deleteResignedEmployee, restoreResignedEmployee, getAllDepartments, addEmployee, updateEmployee, deleteEmployee, enableWFH, disableWFH, toggleEarlyCheckout, clearDataByDate } from '../services/api';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiHome, FiClock, FiEye, FiEyeOff, FiX, FiUsers, FiUserX, FiRotateCcw, FiCalendar, FiDownload, FiFileText } from 'react-icons/fi';
import { sortEmployeeRows } from '../utils/sorting';
import { toDateInputValue, formatDate } from '../utils/dateUtils';
import ClearDataModal from '../components/ClearDataModal';
import EmployeeDetailsFormModal from '../components/EmployeeDetailsFormModal';

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
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [activeTab,    setActiveTab]    = useState('active'); // 'active' | 'resigned'
  const [employees,    setEmployees]    = useState([]);
  const [resignedEmployees, setResignedEmployees] = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formModalEmployee, setFormModalEmployee] = useState(null);

  const [showEditResignedDateModal, setShowEditResignedDateModal] = useState(false);
  const [editingResignedEmp, setEditingResignedEmp] = useState(null);
  const [resignedDateInput, setResignedDateInput] = useState('');

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [editMode,     setEditMode]     = useState(false);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'danger' });
  const [alertDialog,   setAlertDialog]   = useState({ isOpen:false, title:'', message:'', type:'success' });
  const [sortBy,        setSortBy]        = useState('name_asc');

  const [formData, setFormData] = useState({ 
    id:'', employee_id:'', name:'', department_id:'', job_role:'', mobile:'', email:'', personal_email:'', password:'', status:'Active', date_of_birth:'', joining_date:'',
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
      const [empRes, resignedRes, deptRes] = await Promise.all([
        getAllEmployees(),
        getResignedEmployees(),
        getAllDepartments()
      ]);
      if (empRes.data.success)  setEmployees(empRes.data.employees);
      if (resignedRes.data.success) setResignedEmployees(resignedRes.data.employees);
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

    if (formData.email && formData.personal_email && formData.email.trim().toLowerCase() === formData.personal_email.trim().toLowerCase()) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Office email and Personal email cannot be the same. Please provide a different personal email.',
        type: 'error'
      });
      return;
    }

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

  const handleClearData = async ({ fromDate, toDate }) => {
    try {
      setClearing(true);
      const res = await clearDataByDate('employees', { fromDate, toDate, confirmation: 'DELETE' });
      if (res.data.success) {
        setAlertDialog({ isOpen: true, title: 'Success', message: res.data.message || 'Data cleared successfully', type: 'success' });
        setShowClearModal(false);
        fetchData();
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: res.data.message || 'Failed to clear data', type: 'error' });
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Failed to clear data', type: 'error' });
    } finally {
      setClearing(false);
    }
  };

  const handleEdit = emp => {
    const dob = emp.date_of_birth ? toDateInputValue(emp.date_of_birth) : '';
    const joinDate = emp.joining_date ? toDateInputValue(emp.joining_date) : '';
    setFormData({ ...emp, personal_email: emp.personal_email || '', password:'', date_of_birth: dob, joining_date: joinDate });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = emp => setConfirmDialog({
    isOpen:true, title:'Delete Employee', type:'danger',
    message:`Are you sure you want to delete "${emp.name}"? This employee will be moved to the "Resigned / Quit Employees" tab with today's date as default quit date.`,
    onConfirm: async () => {
      try { 
        const r = await deleteEmployee(emp.id); 
        if (r.data.success) { 
          setAlertDialog({ isOpen:true, title:'Moved to Resigned', message: `Employee "${emp.name}" moved to Resigned / Quit Employees list successfully.`, type:'success' });
          fetchData(); 
        } 
      }
      catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Delete failed.', type:'error' }); }
    },
  });

  const handleOpenEditResignedDate = emp => {
    setEditingResignedEmp(emp);
    setResignedDateInput(emp.resigned_date ? toDateInputValue(emp.resigned_date) : toDateInputValue(new Date()));
    setShowEditResignedDateModal(true);
  };

  const handleSaveResignedDate = async (e) => {
    e.preventDefault();
    if (!editingResignedEmp || !resignedDateInput) return;
    try {
      const res = await updateResignedEmployee(editingResignedEmp.id, { resigned_date: resignedDateInput });
      if (res.data.success) {
        setAlertDialog({ isOpen: true, title: 'Success', message: 'Resigned / Quit Date updated successfully.', type: 'success' });
        setShowEditResignedDateModal(false);
        setEditingResignedEmp(null);
        fetchData();
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Failed to update date.', type: 'error' });
    }
  };

  const handleDeleteResignedPermanently = emp => setConfirmDialog({
    isOpen: true, title: 'Permanently Delete Record', type: 'danger',
    message: `Are you sure you want to permanently delete the resigned record for "${emp.name}"? This action cannot be undone.`,
    onConfirm: async () => {
      try {
        const res = await deleteResignedEmployee(emp.id);
        if (res.data.success) {
          setAlertDialog({ isOpen: true, title: 'Deleted', message: `Record for "${emp.name}" deleted permanently.`, type: 'success' });
          fetchData();
        }
      } catch (error) {
        setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Delete failed.', type: 'error' });
      }
    }
  });

  const handleRestoreResigned = emp => setConfirmDialog({
    isOpen: true, title: 'Restore Employee', type: 'info',
    message: `Are you sure you want to restore "${emp.name}" back to the Active Employees list?`,
    onConfirm: async () => {
      try {
        const res = await restoreResignedEmployee(emp.id);
        if (res.data.success) {
          setAlertDialog({ isOpen: true, title: 'Restored', message: `Employee "${emp.name}" restored to active list.`, type: 'success' });
          fetchData();
        }
      } catch (error) {
        setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Restore failed.', type: 'error' });
      }
    }
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
    const listToExport = activeTab === 'active' ? employees : resignedEmployees;
    const getEmployeeName = (emp) => {
      return (emp.employee_name || emp.name || emp.full_name || "").trim();
    };

    const sortedEmployees = [...listToExport].sort((a, b) => {
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

    const exportData = sortedEmployees.map((emp, index) => {
      const row = {
        "S.No": index + 1,
        "Employee ID": emp.employee_id || emp.employee_code || "-",
        "Employee Name": emp.employee_name || emp.name || "-",
        "Department": emp.department_name || emp.department || "-",
        "Job Role / Designation": emp.designation || emp.job_role || "-",
        "Monthly Salary": emp.monthly_salary || emp.salary || 0,
        "Mobile Number": emp.mobile || emp.phone || "-",
        "Office Email": emp.email || "-",
        "Personal Email": emp.personal_email || "-",
        "Status": emp.status || (emp.is_active ? "Active" : "Resigned"),
        "Joining Date": emp.joining_date ? formatDate(emp.joining_date) : "-",
      };

      if (activeTab === 'resigned') {
        row["Resigned / Quit Date"] = emp.resigned_date ? formatDate(emp.resigned_date) : "-";
      } else {
        row["WFH Permission"] = emp.wfh_enabled || emp.is_wfh ? "Yes" : "No";
        row["Early Checkout Permission"] = emp.early_checkout_enabled ? "Yes" : "No";
      }

      Object.assign(row, {
        "Bank Name": emp.bank_name || "-",
        "Bank Address": emp.bank_address || "-",
        "Account Holder Name": emp.account_holder_name || "-",
        "Account Number": emp.account_number || "-",
        "IFSC Code": emp.ifsc_code || "-",
        "PAN Card Number": emp.pan_card_number || "-",
        "Aadhaar Card Number": emp.aadhar_card_number || "-",
        "Permanent Address": emp.permanent_address || "-",
        "Alternate Phone Number": emp.alternate_phone_number || "-"
      });

      return row;
    });

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

    const sheetName = activeTab === 'active' ? "Active_Employees" : "Resigned_Employees";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const today = toDateInputValue(new Date());
    XLSX.writeFile(workbook, `${sheetName.toLowerCase()}_export_${today}.xlsx`);
  };

  const closeModal = () => { 
    setShowModal(false); setEditMode(false); setShowPassword(false); 
    setFormData({ 
      id:'', employee_id:'', name:'', department_id:'', job_role:'', mobile:'', email:'', personal_email:'', password:'', status:'Active', date_of_birth:'', joining_date:'',
      monthly_salary:'', basic_salary:'', hra:'', special_allowance:'', staff_advance:'', professional_tax:'', tds:'',
      bank_name:'', bank_address:'', account_holder_name:'', account_number:'', ifsc_code:'', pan_card_number:'', aadhar_card_number:'', permanent_address:'', alternate_phone_number:''
    }); 
  };

  const filteredEmployeesRaw = employees.filter(emp =>
    (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.personal_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredEmployees = sortEmployeeRows(filteredEmployeesRaw, sortBy);

  const filteredResignedRaw = resignedEmployees.filter(emp =>
    (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.personal_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredResigned = sortEmployeeRows(filteredResignedRaw, sortBy);

  if (loading) return (
    <div className="flex h-screen bg-admin-bg"><Sidebar /><div className="flex-1 flex items-center justify-center"><Spinner size={36} /></div></div>
  );

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-14 lg:pt-0">
            <div>
              <h1 className="text-xl font-bold text-admin-heading">Employee Management</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {employees.length} active employees &bull; {resignedEmployees.length} resigned/former employees
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {hasPermission('employees', 'can_export') && (
                <button onClick={handleExportEmployeesExcel}
                  className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-glow-emerald-sm hover:shadow-glow-emerald hover:-translate-y-0.5">
                  <FiDownload size={16} /> Export {activeTab === 'active' ? 'Active' : 'Resigned'} Excel
                </button>
              )}
              {hasPermission('employees', 'can_clear') && activeTab === 'active' && (
                <button onClick={() => setShowClearModal(true)}
                  className="inline-flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200">
                  <FiTrash2 size={16} /> Clear Data
                </button>
              )}
              {hasPermission('employees', 'can_create') && activeTab === 'active' && (
                <button onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-glow-blue-sm hover:shadow-glow-blue hover:-translate-y-0.5">
                  <FiPlus size={16} /> Add Employee
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-admin-border mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2.5 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'active'
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-blue-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FiUsers size={16} />
              <span>Active Employees</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'active' ? 'bg-[#3B82F6] text-white' : 'bg-white/10 text-slate-400'}`}>
                {employees.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('resigned')}
              className={`flex items-center gap-2.5 px-5 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'resigned'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FiUserX size={16} />
              <span>Resigned / Quit Employees</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'resigned' ? 'bg-amber-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                {resignedEmployees.length}
              </span>
            </button>
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
            <div className="table-responsive overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px] dark-scroll relative">
              <table className="min-w-full divide-y divide-white/[0.04]">
                <thead className="bg-admin-bg sticky top-0 z-10 shadow-sm">
                  {activeTab === 'active' ? (
                    <tr>
                      {['Emp ID','Name','Department','Job Role','Monthly Salary','Mobile','Email','Status','Joining Date','WFH','Early CO','Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 z-10">{h}</th>
                      ))}
                    </tr>
                  ) : (
                    <tr>
                      {['Emp ID','Name','Department','Job Role','Monthly Salary','Mobile','Email','Status','Joining Date','Resigned / Quit Date','Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 z-10">{h}</th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {activeTab === 'active' ? (
                    filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                      <tr key={emp.id} className="admin-table-row">
                        <td className="px-4 py-3.5 text-sm font-mono whitespace-nowrap">
                          <button onClick={() => navigate(`/admin/employees/${emp.id}`)} className="text-blue-500 hover:text-blue-400 font-bold hover:underline cursor-pointer" title="View 360° Full Profile">
                            {emp.employee_id}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap">
                          <button onClick={() => navigate(`/admin/employees/${emp.id}`)} className="employee-name-clickable text-left" title="View 360° Full Profile">
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
                            <button 
                              onClick={() => navigate(`/admin/employees/${emp.id}`)} 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/10 transition-colors" 
                              title="View 360° Full Profile"
                            >
                              <FiEye size={14} />
                            </button>
                            {hasPermission('employees', 'can_edit') && (
                              <button onClick={() => handleEdit(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#60A5FA] hover:bg-blue-500/10 transition-colors" title="Edit"><FiEdit size={14} /></button>
                            )}
                            <button 
                              onClick={() => { setFormModalEmployee(emp); setShowFormModal(true); }} 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-400 hover:bg-purple-500/10 transition-colors" 
                              title="View & Download Employee Form"
                            >
                              <FiFileText size={14} />
                            </button>
                            {hasPermission('employees', 'can_delete') && (
                              <button onClick={() => handleDelete(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors" title="Delete Employee (Move to Resigned)"><FiTrash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={12} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3"><FiUsers size={28} className="text-[#475569]" /><p className="text-sm font-medium text-admin-secondary">{searchTerm ? 'No employees match your search' : 'No active employees yet'}</p></div>
                      </td></tr>
                    )
                  ) : (
                    filteredResigned.length > 0 ? filteredResigned.map(emp => (
                      <tr key={emp.id} className="admin-table-row">
                        <td className="px-4 py-3.5 text-sm font-mono whitespace-nowrap">
                          <button 
                            onClick={() => navigate(`/admin/employees/${emp.employee_id || emp.original_id || emp.id}`)} 
                            className="text-blue-500 hover:text-blue-400 font-bold hover:underline cursor-pointer" 
                            title="View 360° Full Profile"
                          >
                            {emp.employee_id}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap">
                          <button onClick={() => navigate(`/admin/employees/${emp.employee_id || emp.original_id || emp.id}`)} className="employee-name-clickable text-left" title="View 360° Full Profile">
                            {emp.name}
                          </button>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.department_name || '—'}</td>
                        <td className="hidden lg:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.job_role}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                          {(() => {
                            const monthlySalary = getMonthlySalaryValue(emp);
                            return monthlySalary ? formatCurrency(monthlySalary) : '-';
                          })()}
                        </td>
                        <td className="hidden xl:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.mobile || '—'}</td>
                        <td className="hidden xl:table-cell px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{emp.email || '—'}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            Resigned
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">{formatDate(emp.joining_date)}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-amber-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{formatDate(emp.resigned_date)}</span>
                            {hasPermission('employees', 'can_edit') && (
                              <button onClick={() => handleOpenEditResignedDate(emp)} className="text-slate-400 hover:text-amber-300 transition-colors p-1" title="Edit Resigned / Quit Date">
                                <FiCalendar size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => navigate(`/admin/employees/${emp.employee_id || emp.original_id || emp.id}`)} 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/10 transition-colors" 
                              title="View 360° Full Profile"
                            >
                              <FiEye size={14} />
                            </button>
                            {hasPermission('employees', 'can_edit') && (
                              <button onClick={() => handleOpenEditResignedDate(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-colors" title="Edit Resigned Date">
                                <FiCalendar size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => { setFormModalEmployee(emp); setShowFormModal(true); }} 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-400 hover:bg-purple-500/10 transition-colors" 
                              title="View & Download Employee Form"
                            >
                              <FiFileText size={14} />
                            </button>
                            {hasPermission('employees', 'can_create') && (
                              <button onClick={() => handleRestoreResigned(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Restore to Active List">
                                <FiRotateCcw size={14} />
                              </button>
                            )}
                            {hasPermission('employees', 'can_delete') && (
                              <button onClick={() => handleDeleteResignedPermanently(emp)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors" title="Permanently Delete Record">
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={11} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3"><FiUserX size={28} className="text-[#475569]" /><p className="text-sm font-medium text-admin-secondary">{searchTerm ? 'No resigned employees match your search' : 'No resigned employees yet'}</p></div>
                      </td></tr>
                    )
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
                  { label:'Office Email', name:'email',      type:'email'},
                  { label:'Personal Email', name:'personal_email', type:'email', required: false },
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
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Status</p><div className="mt-0.5"><StatusBadge status={selectedEmployee.status || 'Resigned'} dark /></div></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Joining Date</p><p className="text-sm font-medium text-admin-text">{formatDate(selectedEmployee.joining_date) || '—'}</p></div>
                  {selectedEmployee.resigned_date && (
                    <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Resigned / Quit Date</p><p className="text-sm font-semibold text-amber-400">{formatDate(selectedEmployee.resigned_date)}</p></div>
                  )}
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
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Personal Email</p><p className="text-sm font-medium text-admin-text truncate">{selectedEmployee.personal_email || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Alternate Phone</p><p className="text-sm font-medium text-admin-text">{selectedEmployee.alternate_phone_number || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Permanent Address</p><p className="text-sm font-medium text-admin-text whitespace-pre-wrap">{selectedEmployee.permanent_address || '—'}</p></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-admin-border bg-admin-bg rounded-b-2xl flex justify-between items-center">
              <button 
                type="button"
                onClick={() => { 
                  const emp = selectedEmployee;
                  setShowDetailModal(false);
                  setFormModalEmployee(emp); 
                  setShowFormModal(true); 
                }} 
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2 transition-all"
              >
                <FiFileText size={14} /> Download Form
              </button>
              <button onClick={() => { setShowDetailModal(false); setSelectedEmployee(null); }} className="admin-btn-neutral rounded-xl px-5 py-2 text-sm font-semibold shadow-sm hover:shadow transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Resigned / Quit Date Modal */}
      {showEditResignedDateModal && editingResignedEmp && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-md flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border">
              <div>
                <h2 className="text-base font-bold text-admin-text">Edit Resigned / Quit Date</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingResignedEmp.employee_id} - {editingResignedEmp.name}</p>
              </div>
              <button onClick={() => { setShowEditResignedDateModal(false); setEditingResignedEmp(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors"><FiX size={18} /></button>
            </div>
            <form onSubmit={handleSaveResignedDate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Resigned / Quit Date</label>
                <input
                  type="date"
                  value={resignedDateInput}
                  onChange={(e) => setResignedDateInput(e.target.value)}
                  required
                  className="admin-input"
                />
                <p className="text-xs text-slate-400 mt-2">By default, this is auto-populated with the date the employee was deleted from the admin panel. You can edit and update this date if needed.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditResignedDateModal(false); setEditingResignedEmp(null); }} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-glow-amber-sm transition-all duration-200">
                  Save Date
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ClearDataModal 
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearData}
        loading={clearing}
        title="Clear Employee Records"
        description="This will permanently delete employees who joined between the selected dates. This action cannot be undone."
      />

      {/* Employee Details Form Preview & Download Modal */}
      {showFormModal && formModalEmployee && (
        <EmployeeDetailsFormModal
          employee={formModalEmployee}
          onClose={() => { setShowFormModal(false); setFormModalEmployee(null); }}
        />
      )}

    </div>
  );
};
export default AdminEmployees;
