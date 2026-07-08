import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import ConfirmDialog from '../components/ConfirmDialog';
import { Spinner } from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiEdit2, FiTrash2, FiPlus, FiEye, FiEyeOff, FiShield, FiLock, FiX, FiUsers, FiKey } from 'react-icons/fi';
import { formatDate } from '../utils/formatTime';

const TABS = [
  { id:'admins',   label:'Manage Admins',  Icon:FiShield },
  { id:'password', label:'Change Password', Icon:FiLock   },
];

const PAGE_SECTIONS = [
  { label: 'Overview', pages: ['dashboard'] },
  { label: 'People', pages: ['employees', 'departments', 'admin_management'] },
  { label: 'Time & Attendance', pages: ['attendance', 'manual_attendance', 'absent_reasons', 'holidays'] },
  { label: 'HR & Finance', pages: ['payroll', 'expenses', 'reports'] },
  { label: 'System', pages: ['settings', 'manage', 'database_monitor', 'trusted_devices', 'activity_logs', 'otp_settings', 'security_logs'] }
];

const PERMISSION_MAPPING = {
  dashboard: ['can_view'],
  employees: ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'],
  departments: ['can_view', 'can_create', 'can_edit', 'can_delete'],
  admin_management: ['can_view', 'can_create', 'can_edit', 'can_delete'],
  attendance: ['can_view', 'can_edit', 'can_delete', 'can_clear'],
  manual_attendance: ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_clear'],
  absent_reasons: ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_clear'],
  holidays: ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_clear'],
  payroll: ['can_view', 'can_edit', 'can_calculate', 'can_clear', 'can_export'],
  expenses: ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_clear', 'can_export'],
  reports: ['can_view', 'can_calculate', 'can_export'],
  settings: ['can_view', 'can_edit'],
  manage: ['can_view', 'can_create', 'can_edit', 'can_delete'],
  database_monitor: ['can_view'],
  trusted_devices: ['can_view', 'can_edit', 'can_delete', 'can_approve'],
  activity_logs: ['can_view', 'can_export', 'can_clear'],
  otp_settings: ['can_view', 'can_edit'],
  security_logs: ['can_view', 'can_export', 'can_clear'],
};

const PAGE_DESCRIPTIONS = {
  dashboard: 'Overview and system summary.',
  employees: 'Manage employee records and employee details.',
  departments: 'Manage company departments.',
  admin_management: 'Manage admin users and permissions.',
  attendance: 'View and manage daily attendance.',
  manual_attendance: 'Create and update manual attendance records.',
  absent_reasons: 'Manage employee absent reasons.',
  holidays: 'Manage office and government holidays.',
  payroll: 'Calculate and manage employee payroll.',
  expenses: 'Track and manage company expenses.',
  reports: 'Generate and export attendance reports.',
  settings: 'Manage system settings.',
  manage: 'Central management hub for common records.',
  database_monitor: 'View database storage and health details.',
  trusted_devices: 'Approve and manage trusted employee devices.',
  activity_logs: 'View and export admin activity history.',
  otp_settings: 'Manage OTP and security settings.',
  security_logs: 'View security and failed action logs.'
};

const AdminManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('admins');
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [alertDialog, setAlertDialog] = useState({ isOpen:false, title:'', message:'', type:'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'danger' });
  
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({ username:'', email:'', password:'', role: 'admin', permissions: {} });
  const [adminPages, setAdminPages] = useState([]);
  
  const [passwordForm, setPasswordForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [showPw, setShowPw] = useState({ current:false, new:false, confirm:false });

  useEffect(() => {
    fetchAdmins();
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAdmins = async () => { try { setLoading(true); const r = await api.get('/admins'); setAdmins(r.data.admins || []); } catch(e) { } finally { setLoading(false); } };
  const fetchPages = async () => { try { const r = await api.get('/admins/permissions/pages'); setAdminPages(r.data.pages || []); } catch(e) { console.error('Error fetching pages', e); } };

  const handleSaveAdmin = async () => {
    if (!adminForm.username || !adminForm.email) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Username and email are required', type:'error' }); return; }
    if (!editingAdmin && !adminForm.password) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Password is required for new admin', type:'error' }); return; }
    if (adminForm.role !== 'super_admin' && Object.keys(adminForm.permissions).length === 0) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Please select at least one permission for the limited admin', type:'error' }); return; }
    
    try { 
      setLoading(true); 
      // Transform permissions object to array for backend
      const permissionsArray = Object.keys(adminForm.permissions).map(page_key => ({
        page_key,
        ...adminForm.permissions[page_key]
      }));

      const payload = { username: adminForm.username, email: adminForm.email, role: adminForm.role, permissions: permissionsArray };
      if (!editingAdmin) payload.password = adminForm.password;
      
      editingAdmin ? await api.put(`/admins/${editingAdmin.id}`, payload) : await api.post('/admins', payload); 
      setToastConfig({ message: editingAdmin ? 'Admin updated!' : 'Admin added!', type: 'success' }); 
      setShowAdminForm(false); 
      fetchAdmins(); 
    }
    catch(e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Failed to save admin', type:'error' }); }
    finally { setLoading(false); }
  };

  const handleEditClick = async (a) => {
    setEditingAdmin(a);
    setAdminForm({ username:a.username, email:a.email, password:'', role: a.role || 'admin', permissions: {} });
    setShowAdminForm(true);
    setLoading(true);
    try {
      const res = await api.get(`/admins/permissions/${a.id}`);
      // Transform array from backend into object for frontend
      const permsObj = {};
      if (res.data.permissions && Array.isArray(res.data.permissions)) {
        res.data.permissions.forEach(p => {
          permsObj[p.page_key] = {
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
            can_export: p.can_export,
            can_clear: p.can_clear,
            can_calculate: p.can_calculate,
            can_approve: p.can_approve
          };
        });
      }
      setAdminForm(f => ({ ...f, permissions: permsObj }));
    } catch(e) {
      console.error('Error fetching admin permissions', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = admin => setConfirmDialog({
    isOpen:true, title:'Delete Admin', type:'danger', message:`Delete admin "${admin.username}"? This cannot be undone.`,
    onConfirm: async () => { try { setLoading(true); await api.delete(`/admins/${admin.id}`); setToastConfig({ message: 'Admin deleted!', type: 'success' }); fetchAdmins(); } catch(e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Failed to delete', type:'error' }); } finally { setLoading(false); } },
  });

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'All fields are required', type:'error' }); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Passwords do not match', type:'error' }); return; }
    if (passwordForm.newPassword.length < 6) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Password must be at least 6 characters', type:'error' }); return; }
    try { setLoading(true); await api.post('/admins/change-password', { adminId:user.id, currentPassword:passwordForm.currentPassword, newPassword:passwordForm.newPassword }); setToastConfig({ message: 'Password changed successfully!', type: 'success' }); setPasswordForm({ currentPassword:'', newPassword:'', confirmPassword:'' }); }
    catch(e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Failed to change password', type:'error' }); }
    finally { setLoading(false); }
  };


  const PwField = ({ label, field, pwKey }) => (
    <div className="relative z-10">
      <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <input type={showPw[pwKey] ? 'text' : 'password'} value={passwordForm[field]} onChange={e => setPasswordForm(f => ({ ...f, [field]: e.target.value }))} className="w-full bg-admin-bg border border-admin-border text-admin-text text-sm rounded-xl px-4 py-3 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all pr-12" placeholder={`Enter ${label.toLowerCase()}`} />
        <button type="button" onClick={() => setShowPw(p => ({ ...p, [pwKey]: !p[pwKey] }))} className="absolute right-4 top-1/2 -translate-y-1/2 text-admin-secondary hover:text-admin-text transition-colors">
          {showPw[pwKey] ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      </div>
    </div>
  );

  /* ─── STATS CALCULATION ─── */
  const stats = useMemo(() => {
    return { 
      totalAdmins: admins.length, 
      superAdmins: 1, 
      standardAdmins: Math.max(0, admins.length - 1),
      twoFactorEnabled: 0
    };
  }, [admins]);

  /* ─── QUICK ACTION PERMISSION HANDLERS ─── */
  const handleFullAccess = () => {
    const newPerms = {};
    adminPages.forEach(page => {
      const allowedActions = PERMISSION_MAPPING[page.page_key] || ['can_view'];
      newPerms[page.page_key] = {};
      allowedActions.forEach(action => {
        newPerms[page.page_key][action] = true;
      });
    });
    setAdminForm(f => ({ ...f, permissions: newPerms }));
  };

  const handleViewOnly = () => {
    const newPerms = {};
    adminPages.forEach(page => {
      if (PERMISSION_MAPPING[page.page_key]?.includes('can_view')) {
        newPerms[page.page_key] = { can_view: true };
      }
    });
    setAdminForm(f => ({ ...f, permissions: newPerms }));
  };

  const handleClearAll = () => {
    setAdminForm(f => ({ ...f, permissions: {} }));
  };

  const handleDashboardOnly = () => {
    setAdminForm(f => ({ ...f, permissions: { dashboard: { can_view: true } } }));
  };

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll pb-24 relative">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8 animate-fadeIn">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight drop-shadow-md">Admin Management</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Manage administrators, security protocols, and system access.</p>
            </div>
            {activeTab === 'admins' && (
              <button onClick={() => { setEditingAdmin(null); setAdminForm({ username:'', email:'', password:'', permissions: {} }); setShowAdminForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-0.5">
                <FiPlus size={16} /> Add Admin
              </button>
            )}
          </div>

          {/* Stat Cards - CSS Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label:'Total Admins',     value:stats.totalAdmins,     color:'text-blue-400',    bg:'from-blue-500/10 to-transparent', border:'border-blue-500/20', icon:FiUsers },
              { label:'Super Admins',     value:stats.superAdmins,     color:'text-emerald-400', bg:'from-emerald-500/10 to-transparent', border:'border-emerald-500/20', icon:FiShield },
              { label:'Standard Admins',  value:stats.standardAdmins,  color:'text-purple-400',  bg:'from-purple-500/10 to-transparent', border:'border-purple-500/20', icon:FiUsers },
              { label:'2FA Enabled',      value:stats.twoFactorEnabled,color:'text-cyan-400',    bg:'from-cyan-500/10 to-transparent', border:'border-cyan-500/20', icon:FiLock },
            ].map((s, i) => (
              <div key={i} className={`bg-admin-elevated border ${s.border} rounded-2xl p-4 shadow-clay-admin overflow-hidden relative group hover:-translate-y-1 transition-transform duration-300`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} opacity-50 group-hover:opacity-100 transition-opacity`} />
                <div className="relative z-10 flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold text-admin-secondary uppercase tracking-widest">{s.label}</p>
                  <s.icon size={12} className={`${s.color} opacity-70`} />
                </div>
                <div className="relative z-10">
                  <p className={`text-3xl font-black ${s.color} drop-shadow-sm`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin overflow-hidden flex flex-col min-h-[500px]">
            
            {/* Tabs */}
            <div className="flex table-responsive dark-scroll border-b border-admin-border bg-admin-surface backdrop-blur-md px-2 pt-2">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition-all duration-300 whitespace-nowrap ${activeTab === t.id ? 'border-blue-500 text-blue-400 bg-admin-elevated/[0.02]' : 'border-transparent text-admin-secondary hover:text-admin-muted hover:bg-admin-elevated/[0.02]'}`}>
                  <t.Icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 relative flex flex-col">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-admin-elevated backdrop-blur-sm z-20">
                  <Spinner size={40} color="blue" />
                  <p className="text-xs font-bold text-blue-400 mt-4 animate-pulse">Syncing Data...</p>
                </div>
              ) : null}

              {/* ── Admins Tab ── */}
              {activeTab === 'admins' && (
                <div className="table-responsive dark-scroll flex-1">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        {['Admin', 'Email Address', 'Creation Date', 'Actions'].map(h => (
                          <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 backdrop-blur-md z-10">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {admins.length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-16 text-admin-secondary text-sm font-bold">No admins found.</td></tr>
                      ) : admins.map(a => (
                        <tr key={a.id} className="group border-b border-admin-border hover:bg-admin-elevated/[0.02] transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs uppercase shadow-inner">
                                {a.username.substring(0, 2)}
                              </div>
                              <div>
                                <span className="block text-sm font-bold text-admin-text">{a.username}</span>
                                <span className="text-[10px] text-admin-secondary font-mono">ID: {a.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-admin-secondary">{a.email}</span></td>
                          <td className="px-6 py-4 whitespace-nowrap"><span className="text-xs font-bold text-admin-muted">{formatDate(a.created_at)}</span></td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center gap-2 opacity-100 transition-opacity">
                              <button onClick={() => handleEditClick(a)} className="w-8 h-8 rounded-lg bg-admin-surface text-[#60A5FA] border border-admin-border hover:bg-blue-500/20 hover:border-blue-500/30 flex items-center justify-center transition-all shadow-[0_2px_8px_rgba(59,130,246,0.15)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.3)]"><FiEdit2 size={13} /></button>
                              {user?.id !== a.id && (
                                <button onClick={() => handleDeleteAdmin(a)} className="w-8 h-8 rounded-lg bg-admin-surface text-red-400 border border-admin-border hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center transition-all shadow-[0_2px_8px_rgba(239,68,68,0.1)] hover:shadow-[0_4px_12px_rgba(239,68,68,0.25)]"><FiTrash2 size={13} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Password Tab ── */}
              {activeTab === 'password' && (
                <div className="p-6 md:p-8 flex items-center justify-center flex-1">
                  <div className="w-full max-w-md bg-admin-surface border border-admin-border rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -ml-16 -mb-16" />
                    
                    <div className="flex items-center gap-3 mb-8 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400"><FiKey size={18} /></div>
                      <div>
                        <h2 className="text-lg font-bold text-admin-heading">Update Password</h2>
                        <p className="text-[10px] text-admin-secondary uppercase tracking-wider font-bold mt-0.5">Secure your account</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <PwField label="Current Password" field="currentPassword" pwKey="current" />
                      <PwField label="New Password"     field="newPassword"     pwKey="new"     />
                      <PwField label="Confirm Password" field="confirmPassword" pwKey="confirm" />
                    </div>
                    
                    <button onClick={handleChangePassword} disabled={loading} className="relative z-10 w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl text-sm font-bold shadow-[0_4px_16px_rgba(59,130,246,0.3)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0">
                      {loading ? 'Processing...' : 'Confirm Change'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Admin Form Modal */}
      {showAdminForm && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-5xl flex flex-col my-auto max-h-[90vh] relative overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/80 shrink-0 relative z-10">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center border border-blue-500/20 dark:border-blue-500/30">
                    <FiShield className="text-blue-600 dark:text-blue-400" size={20} />
                  </div>
                  {editingAdmin ? 'Edit Admin Details' : 'Register New Admin'}
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 ml-13">Configure credentials and system access permissions.</p>
              </div>
              <button onClick={() => setShowAdminForm(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white transition-colors">
                <FiX size={20} />
              </button>
            </div>
            
            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto dark-scroll p-8 space-y-10 relative z-10 bg-white dark:bg-slate-800">
              
              {/* Basic Details Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FiUsers className="text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Admin Basic Details</h3>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[['Username','username','text'],['Email Address','email','email'],...(!editingAdmin?[['Password','password','password']]:[])].map(([label,field,type]) => (
                    <div key={field}>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{label}</label>
                      <input type={type} value={adminForm[field]} onChange={e => setAdminForm(f => ({ ...f, [field]: e.target.value }))} required className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white text-sm rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500" placeholder={`Enter ${label.toLowerCase()}`} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Role Selection */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FiKey className="text-slate-400 dark:text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Admin Role</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`relative flex flex-col p-5 cursor-pointer rounded-2xl border-2 transition-all shadow-sm ${adminForm.role === 'admin' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <input type="radio" name="role" value="admin" checked={adminForm.role === 'admin'} onChange={(e) => setAdminForm(f => ({ ...f, role: e.target.value }))} className="sr-only" />
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">Limited Admin</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${adminForm.role === 'admin' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                        {adminForm.role === 'admin' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Access only selected pages and actions.</span>
                  </label>

                  <label className={`relative flex flex-col p-5 cursor-pointer rounded-2xl border-2 transition-all shadow-sm ${adminForm.role === 'super_admin' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <input type="radio" name="role" value="super_admin" checked={adminForm.role === 'super_admin'} onChange={(e) => setAdminForm(f => ({ ...f, role: e.target.value }))} className="sr-only" />
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Super Admin</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${adminForm.role === 'super_admin' ? 'border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                        {adminForm.role === 'super_admin' && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Full access to all pages and actions.</span>
                  </label>
                </div>
              </section>

              {/* Permissions Section */}
              {adminForm.role === 'super_admin' ? (
                <div className="p-8 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-3xl flex flex-col items-center justify-center text-center animate-scale-in">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-200 dark:border-emerald-500/30">
                    <FiShield size={32} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Super Admin has full access to all pages and actions.</p>
                </div>
              ) : (
                <section className="animate-fadeIn">
                  <div className="flex flex-col xl:flex-row xl:items-end justify-between border-b border-slate-200 dark:border-slate-700 pb-4 mb-6 gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">Page & Action Permissions</h3>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Choose which pages and actions this admin can access.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={handleFullAccess} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all shadow-sm">Full Access</button>
                      <button onClick={handleViewOnly} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all shadow-sm">View Only</button>
                      <button onClick={handleDashboardOnly} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all shadow-sm">Dashboard Only</button>
                      <button onClick={handleClearAll} className="px-4 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all shadow-sm">Clear All</button>
                    </div>
                  </div>
                  
                  <div className="space-y-10">
                    {PAGE_SECTIONS.map(section => (
                      <div key={section.label} className="space-y-5">
                        <div className="flex items-center gap-3">
                          <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{section.label}</h4>
                          <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {section.pages.map(pageKey => {
                            const page = adminPages.find(p => p.page_key === pageKey);
                            if (!page) return null;
                            const availableActions = PERMISSION_MAPPING[page.page_key] || [];
                            const pagePerms = adminForm.permissions[page.page_key] || {};
                            const hasView = !!pagePerms['can_view'];
                            const isSelected = Object.values(pagePerms).some(v => v === true);
                            const desc = PAGE_DESCRIPTIONS[page.page_key] || 'Manage access and controls for this module.';

                            return (
                              <div key={page.page_key} className={`bg-white dark:bg-slate-900/50 border rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-all duration-300 shadow-sm ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30 dark:bg-blue-500/5 dark:border-blue-500/50 dark:ring-blue-500/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                                <div className="min-w-[220px] flex flex-col items-start gap-1">
                                  <div className="flex items-center gap-3">
                                    <h5 className="text-sm font-bold text-slate-800 dark:text-white">{page.page_name}</h5>
                                    {isSelected && <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">Selected</span>}
                                  </div>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{desc}</p>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2 xl:gap-3">
                                  {availableActions.map(action => {
                                    let actionLabel = action.replace('can_', '').replace('_', ' ');
                                    if (page.page_key === 'reports' && action === 'can_calculate') {
                                      actionLabel = 'generate';
                                    }
                                    
                                    return (
                                      <label key={action} className={`flex items-center gap-2 cursor-pointer group px-3 py-2 rounded-full transition-all border ${!!pagePerms[action] ? 'bg-blue-100/50 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'} ${!hasView && action !== 'can_view' ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                                        <div className="relative flex items-center">
                                          <input 
                                            type="checkbox" 
                                            className="sr-only"
                                            checked={!!pagePerms[action]}
                                            disabled={!hasView && action !== 'can_view'}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setAdminForm(f => {
                                                const newPerms = { ...f.permissions };
                                                if (!newPerms[page.page_key]) newPerms[page.page_key] = {};
                                                newPerms[page.page_key][action] = checked;
                                                
                                                if (checked && action !== 'can_view') {
                                                  newPerms[page.page_key]['can_view'] = true;
                                                }
                                                if (!checked && action === 'can_view') {
                                                  availableActions.forEach(a => { newPerms[page.page_key][a] = false; });
                                                }
                                                return { ...f, permissions: newPerms };
                                              });
                                            }}
                                          />
                                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${!!pagePerms[action] ? 'bg-blue-500 border-blue-500 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                            <svg className={`w-3 h-3 text-white transition-all duration-200 ${!!pagePerms[action] ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                          </div>
                                        </div>
                                        <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${!!pagePerms[action] ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}>
                                          {actionLabel}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
            
            {/* Sticky Footer */}
            <div className="flex items-center justify-between px-8 py-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0 relative z-10">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:block">Please review all changes before saving.</p>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button onClick={() => setShowAdminForm(false)} className="px-6 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">Cancel</button>
                <button onClick={handleSaveAdmin} className="px-8 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all">{editingAdmin ? 'Save Changes' : 'Create Admin'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen:false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(d => ({ ...d, isOpen:false })); }} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText="Delete" />
      <AdminToast 
        message={toastConfig.message} 
        type={toastConfig.type} 
        onClose={() => setToastConfig({ message: '', type: 'success' })} 
      />
    </div>
  );
};

export default AdminManagement;
