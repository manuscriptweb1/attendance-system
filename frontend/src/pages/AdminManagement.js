import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { Spinner } from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiEdit2, FiTrash2, FiPlus, FiDownload, FiEye, FiEyeOff, FiShield, FiLock, FiList, FiX, FiUsers, FiActivity, FiKey } from 'react-icons/fi';
import { formatDate, formatTime } from '../utils/formatTime';

const TABS = [
  { id:'admins',   label:'Manage Admins',  Icon:FiShield },
  { id:'password', label:'Change Password', Icon:FiLock   },
  { id:'logs',     label:'Login Logs',      Icon:FiList   },
];

const AdminManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('admins');
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [alertDialog, setAlertDialog] = useState({ isOpen:false, title:'', message:'', type:'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'danger' });
  
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({ username:'', email:'', password:'' });
  
  const [passwordForm, setPasswordForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [showPw, setShowPw] = useState({ current:false, new:false, confirm:false });
  
  const [dateFilter, setDateFilter] = useState({ startDate:'', endDate:'' });

  useEffect(() => {
    fetchAdmins();
    fetchLoginLogs();
  }, []);

  const fetchAdmins = async () => { try { setLoading(true); const r = await api.get('/admins'); setAdmins(r.data.admins || []); } catch(e) { } finally { setLoading(false); } };
  const fetchLoginLogs = async () => {
    try { setLoading(true); const params = {}; if (dateFilter.startDate) params.startDate = dateFilter.startDate; if (dateFilter.endDate) params.endDate = dateFilter.endDate; const r = await api.get('/admins/login-logs', { params }); setLoginLogs(r.data.logs || []); }
    catch(e) { } finally { setLoading(false); }
  };

  const handleSaveAdmin = async () => {
    if (!adminForm.username || !adminForm.email) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Username and email are required', type:'error' }); return; }
    if (!editingAdmin && !adminForm.password) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Password is required for new admin', type:'error' }); return; }
    try { setLoading(true); editingAdmin ? await api.put(`/admins/${editingAdmin.id}`, { username:adminForm.username, email:adminForm.email }) : await api.post('/admins', adminForm); setAlertDialog({ isOpen:true, title:'Success', message: editingAdmin ? 'Admin updated!' : 'Admin added!', type:'success' }); setShowAdminForm(false); fetchAdmins(); }
    catch(e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Failed to save admin', type:'error' }); }
    finally { setLoading(false); }
  };

  const handleDeleteAdmin = admin => setConfirmDialog({
    isOpen:true, title:'Delete Admin', type:'danger', message:`Delete admin "${admin.username}"? This cannot be undone.`,
    onConfirm: async () => { try { setLoading(true); await api.delete(`/admins/${admin.id}`); setAlertDialog({ isOpen:true, title:'Success', message:'Admin deleted!', type:'success' }); fetchAdmins(); } catch(e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Failed to delete', type:'error' }); } finally { setLoading(false); } },
  });

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'All fields are required', type:'error' }); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Passwords do not match', type:'error' }); return; }
    if (passwordForm.newPassword.length < 6) { setAlertDialog({ isOpen:true, title:'Validation Error', message:'Password must be at least 6 characters', type:'error' }); return; }
    try { setLoading(true); await api.post('/admins/change-password', { adminId:user.id, currentPassword:passwordForm.currentPassword, newPassword:passwordForm.newPassword }); setAlertDialog({ isOpen:true, title:'Success', message:'Password changed successfully!', type:'success' }); setPasswordForm({ currentPassword:'', newPassword:'', confirmPassword:'' }); }
    catch(e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Failed to change password', type:'error' }); }
    finally { setLoading(false); }
  };

  const handleDownloadLogs = async () => {
    try { setLoading(true); const params = {}; if (dateFilter.startDate) params.startDate = dateFilter.startDate; if (dateFilter.endDate) params.endDate = dateFilter.endDate;
      const response = await api.get('/pdf/admin-logs', { params, responseType:'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data])); const link = document.createElement('a'); link.href = url; link.setAttribute('download', `admin_login_logs_${Date.now()}.pdf`); document.body.appendChild(link); link.click(); link.remove();
      setAlertDialog({ isOpen:true, title:'Success', message:'PDF downloaded!', type:'success' }); }
    catch(e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Failed to download PDF', type:'error' }); }
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
    const today = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    
    let loginsToday = 0;
    const activeBrowsers = new Set();
    
    loginLogs.forEach(l => {
      if (new Date(l.login_time).toDateString() === today) loginsToday++;
      if (l.browser_info) activeBrowsers.add(l.browser_info.split(' ')[0]);
    });

    const newAdminsThisMonth = admins.filter(a => new Date(a.created_at).getMonth() === currentMonth).length;

    return { 
      totalAdmins: admins.length, 
      superAdmins: 1, 
      standardAdmins: Math.max(0, admins.length - 1),
      activeSessions: activeBrowsers.size,
      twoFactorEnabled: 0,
      loginLogs: loginLogs.length, 
      loginsToday 
    };
  }, [admins, loginLogs]);

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
              <button onClick={() => { setEditingAdmin(null); setAdminForm({ username:'', email:'', password:'' }); setShowAdminForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-0.5">
                <FiPlus size={16} /> Add Admin
              </button>
            )}
          </div>

          {/* Stat Cards - CSS Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label:'Total Admins',     value:stats.totalAdmins,     color:'text-blue-400',    bg:'from-blue-500/10 to-transparent', border:'border-blue-500/20', icon:FiUsers },
              { label:'Super Admins',     value:stats.superAdmins,     color:'text-emerald-400', bg:'from-emerald-500/10 to-transparent', border:'border-emerald-500/20', icon:FiShield },
              { label:'Standard Admins',  value:stats.standardAdmins,  color:'text-purple-400',  bg:'from-purple-500/10 to-transparent', border:'border-purple-500/20', icon:FiUsers },
              { label:'Active Sessions',  value:stats.activeSessions,  color:'text-amber-400',   bg:'from-amber-500/10 to-transparent', border:'border-amber-500/20', icon:FiActivity },
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
            <div className="flex overflow-x-auto dark-scroll border-b border-admin-border bg-admin-surface backdrop-blur-md px-2 pt-2">
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
                <div className="overflow-x-auto dark-scroll flex-1">
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
                              <button onClick={() => { setEditingAdmin(a); setAdminForm({ username:a.username, email:a.email, password:'' }); setShowAdminForm(true); }} className="w-8 h-8 rounded-lg bg-admin-surface text-[#60A5FA] border border-admin-border hover:bg-blue-500/20 hover:border-blue-500/30 flex items-center justify-center transition-all shadow-[0_2px_8px_rgba(59,130,246,0.15)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.3)]"><FiEdit2 size={13} /></button>
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

              {/* ── Logs Tab ── */}
              {activeTab === 'logs' && (
                <div className="flex flex-col flex-1 h-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-admin-border bg-admin-bg">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input type="date" value={dateFilter.startDate} onChange={e => setDateFilter(d => ({ ...d, startDate: e.target.value }))} className="bg-admin-bg border border-admin-border text-admin-muted text-xs rounded-xl px-4 py-2 outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                      <span className="text-admin-secondary font-bold text-xs">TO</span>
                      <div className="relative">
                        <input type="date" value={dateFilter.endDate} onChange={e => setDateFilter(d => ({ ...d, endDate: e.target.value }))} className="bg-admin-bg border border-admin-border text-admin-muted text-xs rounded-xl px-4 py-2 outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                      <button onClick={fetchLoginLogs} className="px-4 py-2 bg-admin-surface border border-admin-border hover:border-admin-border text-admin-muted hover:text-admin-text text-xs font-bold rounded-xl transition-colors">Filter</button>
                    </div>
                    <button onClick={handleDownloadLogs} disabled={loginLogs.length === 0} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl disabled:opacity-50 transition-all shadow-clay-admin">
                      <FiDownload size={14} /> Export PDF
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto dark-scroll flex-1">
                    <table className="min-w-full">
                      <thead>
                        <tr>{['Admin', 'Timestamp', 'IP Address', 'Browser', 'Device'].map(h => <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 backdrop-blur-md z-10">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {loginLogs.length === 0 ? (
                          <tr><td colSpan="5" className="text-center py-16 text-admin-secondary text-sm font-bold">No login logs match criteria.</td></tr>
                        ) : loginLogs.map(log => (
                          <tr key={log.id} className="border-b border-admin-border hover:bg-admin-elevated/[0.02] transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-bold text-admin-text">{log.username}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="block text-xs font-semibold text-admin-secondary">{formatDate(log.login_time)}</span>
                              <span className="text-[10px] text-admin-secondary font-mono">{formatTime(log.login_time)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className="text-xs font-mono text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/10">{log.ip_address}</span></td>
                            <td className="px-6 py-4"><span className="text-xs text-admin-muted">{log.browser_info}</span></td>
                            <td className="px-6 py-4"><span className="text-xs text-admin-muted">{log.device_info}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Form Modal */}
      {showAdminForm && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.4)] w-full max-w-md animate-scale-in flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border bg-admin-surface shrink-0">
              <h2 className="text-sm font-bold text-admin-text flex items-center gap-2"><FiShield className="text-blue-400" /> {editingAdmin ? 'Edit Admin Details' : 'Register New Admin'}</h2>
              <button onClick={() => setShowAdminForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-admin-secondary hover:bg-admin-elevated hover:text-admin-text transition-colors"><FiX size={16} /></button>
            </div>
            <div className="p-6 space-y-5">
              {[['Username','username','text'],['Email Address','email','email'],...(!editingAdmin?[['Password','password','password']]:[])].map(([label,field,type]) => (
                <div key={field}>
                  <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">{label}</label>
                  <input type={type} value={adminForm[field]} onChange={e => setAdminForm(f => ({ ...f, [field]: e.target.value }))} required className="w-full bg-admin-bg border border-admin-border text-admin-text text-sm rounded-xl px-4 py-3 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all" placeholder={`Enter ${label.toLowerCase()}`} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-surface rounded-b-2xl">
              <button onClick={() => setShowAdminForm(false)} className="px-4 py-2 text-xs font-bold text-admin-muted border border-admin-border rounded-xl hover:bg-admin-elevated transition-colors">Cancel</button>
              <button onClick={handleSaveAdmin} className="px-6 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_4px_12px_rgba(59,130,246,0.3)] transition-colors">{editingAdmin ? 'Save Changes' : 'Create Admin'}</button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen:false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(d => ({ ...d, isOpen:false })); }} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText="Delete" />
    </div>
  );
};
export default AdminManagement;
