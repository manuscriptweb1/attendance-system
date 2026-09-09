import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Spinner } from '../components/Loader';
import StatusBadge from '../components/ui/StatusBadge';
import AlertDialog from '../components/AlertDialog';
import EmployeeJourneyTimeline from '../components/employee/EmployeeJourneyTimeline';
import EmployeeAttendanceTab from '../components/employee/EmployeeAttendanceTab';
import EmployeePermissionsTab from '../components/employee/EmployeePermissionsTab';
import EmployeePayrollTab from '../components/employee/EmployeePayrollTab';
import EmployeeDocumentsTab from '../components/employee/EmployeeDocumentsTab';
import EmployeeDetailsFormModal from '../components/EmployeeDetailsFormModal';
import {
  getEmployeeFullProfile,
  getAllDepartments,
  updateEmployee,
  enableWFH,
  disableWFH,
  toggleEarlyCheckout
} from '../services/api';
import { formatDate } from '../utils/dateUtils';
import {
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiCreditCard,
  FiDollarSign,
  FiBriefcase,
  FiCalendar,
  FiShield,
  FiClock,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiEdit,
  FiX,
  FiSave
} from 'react-icons/fi';

const formatCurrency = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

const AdminEmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'attendance' | 'permissions' | 'payroll' | 'documents'


  // Bio-Data Form Modal
  const [showFormModal, setShowFormModal] = useState(false);

  // Master Profile Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Privileges loading state
  const [togglingWFH, setTogglingWFH] = useState(false);
  const [togglingEarlyCO, setTogglingEarlyCO] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEmployeeFullProfile(id);
      if (res.data?.success) {
        setProfileData(res.data);
      } else {
        setError(res.data?.message || 'Failed to load employee profile');
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError(err.response?.data?.message || 'Employee not found or server error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
    getAllDepartments()
      .then(res => {
        if (res.data?.departments) setDepartments(res.data.departments);
      })
      .catch(() => {});
  }, [fetchProfile]);


  // Toggle WFH Privilege
  const handleToggleWFH = async () => {
    if (!profileData?.employee) return;
    try {
      setTogglingWFH(true);
      const emp = profileData.employee;
      if (emp.wfh_enabled) {
        await disableWFH(emp.employee_id);
      } else {
        await enableWFH(emp.employee_id);
      }
      fetchProfile();
    } catch (err) {
      console.error('Toggle WFH error:', err);
    } finally {
      setTogglingWFH(false);
    }
  };

  // Toggle Early Checkout Privilege
  const handleToggleEarlyCO = async () => {
    if (!profileData?.employee) return;
    try {
      setTogglingEarlyCO(true);
      const emp = profileData.employee;
      await toggleEarlyCheckout(emp.employee_id, !emp.early_checkout_enabled);
      fetchProfile();
    } catch (err) {
      console.error('Toggle early checkout error:', err);
    } finally {
      setTogglingEarlyCO(false);
    }
  };

  // Open Quick Edit Modal
  const handleOpenEditModal = () => {
    if (!employee) return;
    setEditFormData({
      id: employee.id,
      employee_id: employee.employee_id,
      name: employee.name || '',
      department_id: employee.department_id || '',
      job_role: employee.job_role || '',
      status: employee.status || 'Active',
      date_of_birth: employee.date_of_birth ? employee.date_of_birth.split('T')[0] : '',
      joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : '',
      mobile: employee.mobile || '',
      alternate_phone_number: employee.alternate_phone_number || '',
      email: employee.email || '',
      personal_email: employee.personal_email || '',
      permanent_address: employee.permanent_address || '',
      monthly_salary: employee.monthly_salary || 0,
      basic_salary: employee.basic_salary || 0,
      hra: employee.hra || 0,
      special_allowance: employee.special_allowance || 0,
      staff_advance: employee.staff_advance || 0,
      professional_tax: employee.professional_tax || 0,
      tds: employee.tds || 0,
      bank_name: employee.bank_name || '',
      bank_address: employee.bank_address || '',
      account_holder_name: employee.account_holder_name || '',
      account_number: employee.account_number || '',
      ifsc_code: employee.ifsc_code || '',
      pan_card_number: employee.pan_card_number || '',
      aadhar_card_number: employee.aadhar_card_number || ''
    });
    setShowEditModal(true);
  };

  // Automatically balance salary breakdown when Monthly Salary is changed
  const handleSalaryChange = (val) => {
    const s = parseFloat(val) || 0;
    const basic = Number((s * 0.50).toFixed(2));
    const hra = Number((s * 0.20).toFixed(2));
    const special = Math.max(0, Number((s - basic - hra).toFixed(2)));
    setEditFormData(prev => ({
      ...prev,
      monthly_salary: val,
      basic_salary: basic,
      hra: hra,
      special_allowance: special
    }));
  };

  // Save Employee Changes
  const handleSaveProfile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editFormData.name?.trim()) {
      setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'Employee Name is required.', type: 'danger' });
      return;
    }
    try {
      setSavingEdit(true);
      const payload = {
        ...editFormData,
        monthly_salary: Number(editFormData.monthly_salary || 0),
        basic_salary: Number(editFormData.basic_salary || 0),
        hra: Number(editFormData.hra || 0),
        special_allowance: Number(editFormData.special_allowance || 0),
        staff_advance: Number(editFormData.staff_advance || 0),
        professional_tax: Number(editFormData.professional_tax || 0),
        tds: Number(editFormData.tds || 0)
      };
      const res = await updateEmployee(employee.id, payload);
      if (res.data?.success) {
        setShowEditModal(false);
        setAlertDialog({ isOpen: true, title: 'Profile Updated', message: 'Employee details updated successfully!', type: 'success' });
        fetchProfile();
      } else {
        setAlertDialog({ isOpen: true, title: 'Update Failed', message: res.data?.message || 'Failed to update employee.', type: 'danger' });
      }
    } catch (err) {
      console.error('Update employee error:', err);
      setAlertDialog({ isOpen: true, title: 'Error', message: err.response?.data?.message || 'Failed to update employee.', type: 'danger' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Switch to Official Documents tab & focus/filter specific card
  const [highlightDoc, setHighlightDoc] = useState({ type: 'all', ts: 0 });

  const handleOpenOfferLetter = () => {
    setActiveTab('documents');
    setHighlightDoc({ type: 'offer', ts: Date.now() });
  };

  const handleOpenExperienceLetter = () => {
    setActiveTab('documents');
    setHighlightDoc({ type: 'experience', ts: Date.now() });
  };

  const handleOpenRelievingLetter = () => {
    setActiveTab('documents');
    setHighlightDoc({ type: 'relieving', ts: Date.now() });
  };

  const employee = profileData?.employee;
  const milestones = profileData?.milestones;
  const tenure = profileData?.tenure;
  const stats = profileData?.stats || {};
  const isResigned = employee?.status?.toLowerCase() === 'inactive' || !!employee?.resigned_date;

  return (
    <div className="flex h-screen bg-admin-bg font-sans overflow-hidden">
      {/* Sidebar preserved on left */}
      <Sidebar />

      {/* Main Full-Viewport Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto dark-scroll">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* Top Breadcrumbs & Back Navigation */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/employees')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-admin-surface hover:bg-admin-elevated border border-admin-border text-admin-text text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                title="Back to Employees Table"
              >
                <FiArrowLeft size={16} className="text-admin-accent" />
                <span>Back to Employees</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-admin-secondary">
                <Link to="/admin/employees" className="hover:text-admin-text transition-colors">
                  Employees
                </Link>
                <span>/</span>
                <span className="text-admin-text font-mono font-bold">
                  {employee?.employee_id || 'Profile'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchProfile}
                disabled={loading}
                className="p-2 rounded-xl bg-admin-surface hover:bg-admin-elevated border border-admin-border text-admin-secondary hover:text-admin-text transition-all active:scale-95 cursor-pointer"
                title="Refresh Profile"
              >
                <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && !profileData && (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <Spinner size="lg" />
              <p className="text-sm font-semibold text-admin-secondary mt-3">
                Loading Employee 360° Profile...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/25 text-center space-y-3">
              <FiAlertCircle size={32} className="text-red-400 mx-auto" />
              <h3 className="text-base font-bold text-red-300">Unable to load employee profile</h3>
              <p className="text-xs text-red-200/80">{error}</p>
              <button
                onClick={() => navigate('/admin/employees')}
                className="px-4 py-2 rounded-xl bg-admin-surface text-admin-text text-xs font-bold hover:bg-admin-elevated border border-admin-border transition-all"
              >
                Return to Employees List
              </button>
            </div>
          )}

          {/* Success State */}
          {profileData && employee && (
            <>
              {/* Profile Hero Card */}
              <div className="relative overflow-hidden bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-7 shadow-clay-admin">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Left: Avatar & Key Identifiers */}
                  <div className="flex items-center gap-4 sm:gap-5">
                    {/* Big Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-purple-600 flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-lg shadow-blue-500/25 border-2 border-white/10">
                        {employee.name ? employee.name.charAt(0).toUpperCase() : 'E'}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-admin-surface ${
                          isResigned ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        title={isResigned ? 'Resigned' : 'Active'}
                      />
                    </div>

                    {/* Name, Code, Designation */}
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-black text-admin-text tracking-tight">
                          {employee.name}
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold font-mono">
                          {employee.employee_id}
                        </span>
                        <StatusBadge status={employee.status || (isResigned ? 'Resigned' : 'Active')} dark />
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-admin-secondary mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-admin-accent">{employee.job_role || 'No Designation'}</span>
                        <span>•</span>
                        <span>{employee.department_name || 'No Department'}</span>
                      </p>

                      {/* Contact Badges */}
                      <div className="flex items-center gap-4 mt-2.5 text-xs text-admin-muted flex-wrap">
                        {employee.email && (
                          <span className="flex items-center gap-1.5 hover:text-admin-text transition-colors">
                            <FiMail size={13} className="text-blue-400" />
                            <span>{employee.email}</span>
                          </span>
                        )}
                        {employee.mobile && (
                          <span className="flex items-center gap-1.5 hover:text-admin-text transition-colors">
                            <FiPhone size={13} className="text-emerald-400" />
                            <span>{employee.mobile}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap md:self-center">
                    <button
                      onClick={handleOpenEditModal}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                      title="Edit Master Employee Profile"
                    >
                      <FiEdit size={14} />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      onClick={() => setShowFormModal(true)}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-admin-bg hover:bg-admin-elevated border border-admin-border text-admin-text text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
                      title="Preview and Download Official Bio-Data Form"
                    >
                      <FiFileText size={15} className="text-purple-400" />
                      <span>Bio-Data Form</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Career Journey & Milestone Stepper (Online Delivery Style) */}
              <EmployeeJourneyTimeline
                employee={employee}
                milestones={milestones}
                tenure={tenure}
                onRefresh={fetchProfile}
                onOpenOfferLetter={handleOpenOfferLetter}
                onOpenExperienceLetter={handleOpenExperienceLetter}
                onOpenRelievingLetter={handleOpenRelievingLetter}
              />

              {/* Quick KPI Counters Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* 1. Working Tenure */}
                <div className="p-4 rounded-xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Tenure</span>
                    <FiCalendar size={15} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                    {tenure?.formatted || '—'}
                  </p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                    Joined: {formatDate(employee.joining_date) || 'Not set'}
                  </p>
                </div>

                {/* 2. Total Present Days */}
                <div className="p-4 rounded-xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Days Present</span>
                    <FiCheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {stats?.attendance?.present_count ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                    {stats?.attendance?.total_working_hours ?? 0} total hrs logged
                  </p>
                </div>

                {/* 3. Monthly Salary / CTC */}
                <div className="p-4 rounded-xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Monthly CTC</span>
                    <FiDollarSign size={15} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {formatCurrency(employee.monthly_salary || employee.base_salary)}
                  </p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                    Annual: {formatCurrency((employee.monthly_salary || employee.base_salary || 0) * 12)}
                  </p>
                </div>

                {/* 4. Privileges & WFH */}
                <div className="p-4 rounded-xl bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Privileges</span>
                    <FiShield size={15} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  {isResigned ? (
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25">
                        Former Employee (Inactive)
                      </span>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-1">Privileges archived on exit</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleToggleWFH}
                          disabled={togglingWFH}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                            employee.wfh_enabled
                              ? 'bg-blue-100 text-blue-900 border-blue-400 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
                              : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 dark:bg-white/5 dark:text-admin-muted dark:border-white/10 dark:hover:bg-white/10'
                          }`}
                          title="Toggle WFH Privilege"
                        >
                          {togglingWFH ? '...' : (employee.wfh_enabled ? 'WFH: ON' : 'WFH: OFF')}
                        </button>
                        <button
                          onClick={handleToggleEarlyCO}
                          disabled={togglingEarlyCO}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                            employee.early_checkout_enabled
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                              : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 dark:bg-white/5 dark:text-admin-muted dark:border-white/10 dark:hover:bg-white/10'
                          }`}
                          title="Toggle Early Checkout Privilege"
                        >
                          {togglingEarlyCO ? '...' : (employee.early_checkout_enabled ? 'Early CO: ON' : 'Early CO: OFF')}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-1">Click tag to toggle</p>
                    </>
                  )}
                </div>
              </div>

              {/* Navigation Tabs Bar */}
              <div className="flex items-center gap-2 border-b border-admin-border pb-1 overflow-x-auto dark-scroll">
                {[
                  { id: 'overview', label: '360° Profile & HR Master', icon: FiUser },
                  { id: 'attendance', label: `Attendance History (${stats?.attendance?.total_days_recorded || 0})`, icon: FiCalendar },
                  { id: 'permissions', label: `Permissions & Leaves (${(stats?.total_permissions || 0) + (stats?.total_leaves || 0)})`, icon: FiClock },
                  { id: 'payroll', label: `Payroll & Payslips (${stats?.recent_payrolls?.length || 0})`, icon: FiDollarSign },
                  { id: 'documents', label: 'Official Documents & Letters', icon: FiFileText }
                ].map(t => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTab(t.id);
                        if (t.id === 'documents') {
                          setHighlightDoc({ type: 'all', ts: Date.now() });
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-admin-accent text-white shadow-md shadow-admin-accent/25'
                          : 'text-admin-secondary hover:text-admin-text hover:bg-admin-surface'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: 360° Profile & HR Details */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Card 1: Employment & Organization */}
                  <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 shadow-clay-admin space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-admin-border/60">
                      <FiBriefcase size={16} className="text-blue-400" />
                      <h3 className="text-sm font-bold text-admin-text uppercase tracking-wider">
                        Employment & Organization
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Department</p>
                        <p className="font-semibold text-admin-text mt-0.5">{employee.department_name || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Job Role / Title</p>
                        <p className="font-semibold text-admin-text mt-0.5">{employee.job_role || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Employee Code</p>
                        <p className="font-semibold font-mono text-blue-400 mt-0.5">{employee.employee_id}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Date of Joining</p>
                        <p className="font-semibold text-admin-text mt-0.5">{formatDate(employee.joining_date) || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Date of Birth</p>
                        <p className="font-semibold text-admin-text mt-0.5">{formatDate(employee.date_of_birth) || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Current Status</p>
                        <div className="mt-0.5">
                          <StatusBadge status={employee.status || (isResigned ? 'Resigned' : 'Active')} dark />
                        </div>
                      </div>

                      {employee.resigned_date && (
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold text-amber-400 uppercase">Resigned / Exit Date</p>
                          <p className="font-semibold text-amber-300 mt-0.5">{formatDate(employee.resigned_date)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Contact & Address */}
                  <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 shadow-clay-admin space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-admin-border/60">
                      <FiMapPin size={16} className="text-emerald-400" />
                      <h3 className="text-sm font-bold text-admin-text uppercase tracking-wider">
                        Contact & Address Details
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Company Email</p>
                        <p className="font-semibold text-admin-text mt-0.5 truncate">{employee.email || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Personal Email</p>
                        <p className="font-semibold text-admin-text mt-0.5 truncate">{employee.personal_email || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Primary Mobile</p>
                        <p className="font-semibold text-admin-text mt-0.5">{employee.mobile || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Alternate Phone</p>
                        <p className="font-semibold text-admin-text mt-0.5">{employee.alternate_phone_number || '—'}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Permanent Address</p>
                        <p className="font-medium text-admin-text mt-0.5 whitespace-pre-wrap leading-relaxed">
                          {employee.permanent_address || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Banking & Remittance */}
                  <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 shadow-clay-admin space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-admin-border/60">
                      <FiCreditCard size={16} className="text-purple-400" />
                      <h3 className="text-sm font-bold text-admin-text uppercase tracking-wider">
                        Banking & Remittance
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Bank Name</p>
                        <p className="font-semibold text-admin-text mt-0.5">{employee.bank_name || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Account Holder</p>
                        <p className="font-semibold text-admin-text mt-0.5">{employee.account_holder_name || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Account Number</p>
                        <p className="font-mono font-semibold text-admin-text mt-0.5">{employee.account_number || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">IFSC Code</p>
                        <p className="font-mono font-semibold text-admin-text mt-0.5">{employee.ifsc_code || '—'}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Bank Branch Address</p>
                        <p className="font-medium text-admin-text mt-0.5">{employee.bank_address || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Statutory & Salary Breakdown */}
                  <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 shadow-clay-admin space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-admin-border/60">
                      <FiDollarSign size={16} className="text-emerald-400" />
                      <h3 className="text-sm font-bold text-admin-text uppercase tracking-wider">
                        Statutory & Salary Breakdown
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">PAN Card</p>
                        <p className="font-mono font-semibold text-admin-text mt-0.5">{employee.pan_card_number || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Aadhar Card</p>
                        <p className="font-mono font-semibold text-admin-text mt-0.5">{employee.aadhar_card_number || '—'}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Basic Salary</p>
                        <p className="font-semibold text-admin-text mt-0.5">{formatCurrency(employee.basic_salary)}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">HRA</p>
                        <p className="font-semibold text-admin-text mt-0.5">{formatCurrency(employee.hra)}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Special Allowance</p>
                        <p className="font-semibold text-admin-text mt-0.5">{formatCurrency(employee.special_allowance)}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-admin-secondary uppercase">Professional Tax (PT)</p>
                        <p className="font-semibold text-admin-text mt-0.5">{formatCurrency(employee.professional_tax)}</p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: Attendance History Matrix */}
              {activeTab === 'attendance' && (
                <EmployeeAttendanceTab 
                  employeeId={id || employee?.id || employee?.employee_id} 
                  employee={employee}
                />
              )}

              {/* TAB 3: Permissions & Leaves Log */}
              {activeTab === 'permissions' && (
                <EmployeePermissionsTab 
                  employeeId={id || employee?.id || employee?.employee_id} 
                  employee={employee}
                />
              )}

              {/* TAB 4: Payroll & Historical Payslips */}
              {activeTab === 'payroll' && (
                <EmployeePayrollTab 
                  employeeId={id || employee?.id || employee?.employee_id} 
                  employee={employee} 
                />
              )}

              {/* TAB 5: Official Documents & Letters Hub */}
              {activeTab === 'documents' && (
                <EmployeeDocumentsTab
                  employeeId={id || employee?.id || employee?.employee_id}
                  employee={employee}
                  fullProfileData={profileData}
                  onRefreshProfile={fetchProfile}
                  highlightDoc={highlightDoc}
                  setHighlightDoc={setHighlightDoc}
                />
              )}


              {/* Employee Bio-Data Form Modal */}
              {showFormModal && employee && (
                <EmployeeDetailsFormModal
                  employee={employee}
                  onClose={() => setShowFormModal(false)}
                />
              )}

              {/* Master Profile Quick-Edit Modal */}
              {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
                  <div className="relative w-full max-w-3xl my-8 bg-admin-surface border border-admin-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-admin-text">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border bg-admin-bg/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-admin-accent/15 text-admin-accent flex items-center justify-center font-bold">
                          <FiEdit size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-admin-text">Edit Employee Master Profile</h3>
                          <p className="text-[11px] text-admin-secondary">
                            Editing {employee.employee_id} • {employee.name}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-bg transition"
                      >
                        <FiX size={18} />
                      </button>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handleSaveProfile} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto dark-scroll">
                      {/* Section 1: Basic & Employment */}
                      <div>
                        <h4 className="text-xs font-bold text-admin-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <FiUser size={13} className="text-blue-400" />
                          <span>Primary & Employment Details</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Full Name *</label>
                            <input
                              type="text"
                              value={editFormData.name || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                              required
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Department</label>
                            <select
                              value={editFormData.department_id || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            >
                              <option value="">Select Department</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Job Role / Designation</label>
                            <input
                              type="text"
                              value={editFormData.job_role || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, job_role: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Status</label>
                            <select
                              value={editFormData.status || 'Active'}
                              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Probation">Probation</option>
                              <option value="Notice Period">Notice Period</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Joining Date</label>
                            <input
                              type="date"
                              value={editFormData.joining_date || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, joining_date: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Date of Birth</label>
                            <input
                              type="date"
                              value={editFormData.date_of_birth || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Contact & Address */}
                      <div className="pt-3 border-t border-admin-border">
                        <h4 className="text-xs font-bold text-admin-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <FiMail size={13} className="text-emerald-400" />
                          <span>Contact & Address</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Company Email</label>
                            <input
                              type="email"
                              value={editFormData.email || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Personal Email</label>
                            <input
                              type="email"
                              value={editFormData.personal_email || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, personal_email: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Primary Mobile</label>
                            <input
                              type="text"
                              value={editFormData.mobile || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Alternate Phone</label>
                            <input
                              type="text"
                              value={editFormData.alternate_phone_number || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, alternate_phone_number: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Permanent Address</label>
                            <textarea
                              rows={2}
                              value={editFormData.permanent_address || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, permanent_address: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Compensation & Breakdown */}
                      <div className="pt-3 border-t border-admin-border">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-admin-secondary uppercase tracking-wider flex items-center gap-1.5">
                            <FiDollarSign size={13} className="text-emerald-400" />
                            <span>Compensation & Salary Structure</span>
                          </h4>
                          <span className="text-[10px] text-admin-muted font-normal">Auto-balances breakdown when CTC changes</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Monthly CTC (₹)</label>
                            <input
                              type="number"
                              value={editFormData.monthly_salary || ''}
                              onChange={(e) => handleSalaryChange(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-accent/50 text-admin-text font-bold focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Basic (50%)</label>
                            <input
                              type="number"
                              value={editFormData.basic_salary || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, basic_salary: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">HRA (20%)</label>
                            <input
                              type="number"
                              value={editFormData.hra || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, hra: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Special Allowance</label>
                            <input
                              type="number"
                              value={editFormData.special_allowance || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, special_allowance: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Prof. Tax (PT)</label>
                            <input
                              type="number"
                              value={editFormData.professional_tax || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, professional_tax: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">TDS (₹)</label>
                            <input
                              type="number"
                              value={editFormData.tds || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, tds: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Staff Advance (₹)</label>
                            <input
                              type="number"
                              value={editFormData.staff_advance || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, staff_advance: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Banking & Remittance */}
                      <div className="pt-3 border-t border-admin-border">
                        <h4 className="text-xs font-bold text-admin-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <FiCreditCard size={13} className="text-purple-400" />
                          <span>Banking & Statutory Identifiers</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Bank Name</label>
                            <input
                              type="text"
                              value={editFormData.bank_name || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, bank_name: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Account Holder</label>
                            <input
                              type="text"
                              value={editFormData.account_holder_name || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, account_holder_name: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Account Number</label>
                            <input
                              type="text"
                              value={editFormData.account_number || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, account_number: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text font-mono focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">IFSC Code</label>
                            <input
                              type="text"
                              value={editFormData.ifsc_code || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, ifsc_code: e.target.value.toUpperCase() })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text font-mono focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">PAN Card Number</label>
                            <input
                              type="text"
                              value={editFormData.pan_card_number || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, pan_card_number: e.target.value.toUpperCase() })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text font-mono focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Aadhar Card Number</label>
                            <input
                              type="text"
                              value={editFormData.aadhar_card_number || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, aadhar_card_number: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text font-mono focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-admin-secondary mb-1">Bank Branch Address</label>
                            <input
                              type="text"
                              value={editFormData.bank_address || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, bank_address: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-4 border-t border-admin-border flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEditModal(false)}
                          disabled={savingEdit}
                          className="px-4 py-2 rounded-xl bg-admin-bg hover:bg-admin-elevated border border-admin-border text-admin-text text-xs font-bold transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                        >
                          {savingEdit ? (
                            <>
                              <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <FiSave className="w-3.5 h-3.5" />
                              <span>Save Changes</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Alert Dialog */}
              <AlertDialog
                isOpen={alertDialog.isOpen}
                title={alertDialog.title}
                message={alertDialog.message}
                type={alertDialog.type}
                onClose={() => setAlertDialog({ isOpen: false, title: '', message: '', type: 'info' })}
              />

              {/* Employee Bio-Data Form Modal */}
              {showFormModal && employee && (
                <EmployeeDetailsFormModal
                  employee={employee}
                  onClose={() => setShowFormModal(false)}
                />
              )}

            </>
          )}

        </div>
      </main>
    </div>
  );
};

export default AdminEmployeeProfile;
