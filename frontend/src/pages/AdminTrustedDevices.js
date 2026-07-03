import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import DetailsDialog from '../components/DetailsDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import PromptDialog from '../components/PromptDialog';
import { Spinner } from '../components/Loader';
import { FiSmartphone, FiCheck, FiX, FiEdit2, FiSave, FiRefreshCw, FiEye, FiTrash2, FiSearch, FiMonitor, FiTablet, FiAlertTriangle, FiShieldOff, FiUnlock } from 'react-icons/fi';
import { getAllTrustedDevices, approveTrustedDevice, rejectTrustedDevice, updateTrustedDeviceAlias, removeTrustedDeviceApproval, deleteTrustedDevice, getTrustedDeviceStats, blockTrustedDevice, unblockTrustedDevice } from '../services/api';
import { formatDate } from '../utils/formatTime';

const TABS = [
  { id: 'pending',  label: 'Pending',  icon: FiAlertTriangle },
  { id: 'approved', label: 'Approved', icon: FiCheck },
  { id: 'rejected', label: 'Rejected', icon: FiX },
  { id: 'blocked', label: 'Blocked', icon: FiShieldOff },
];

const DeviceTypePill = ({ type }) => {
  const map = {
    Desktop: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: FiMonitor },
    Laptop:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: FiMonitor },
    Mobile:  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', icon: FiSmartphone },
    Tablet:  { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', icon: FiTablet },
  };
  const style = map[type] || { bg: 'bg-admin-elevated', text: 'text-admin-muted', border: 'border-admin-border', icon: FiMonitor };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
      <Icon size={12} /> {type || 'Unknown'}
    </span>
  );
};

const Th = ({ children }) => (
  <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 backdrop-blur-md z-10">{children}</th>
);

const Td = ({ children, className = '' }) => (
  <td className={`px-5 py-4 text-sm text-admin-secondary border-b border-admin-border group-hover:bg-admin-elevated/[0.02] transition-colors ${className}`}>{children}</td>
);

const EmptyState = ({ message }) => (
  <tr>
    <td colSpan="99" className="text-center py-16">
      <div className="flex flex-col items-center justify-center text-admin-secondary">
        <div className="w-16 h-16 rounded-2xl bg-admin-elevated/[0.02] flex items-center justify-center mb-4">
          <FiSmartphone size={32} className="opacity-20" />
        </div>
        <p className="text-sm font-bold">{message}</p>
        <p className="text-xs font-medium mt-1">No devices currently match this status or search filter.</p>
      </div>
    </td>
  </tr>
);

const AdminTrustedDevices = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({ totalDevices:0, pendingDevices:0, approvedDevices:0, rejectedDevices:0, blockedDevices:0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDevice, setEditingDevice] = useState(null);
  const [editAlias, setEditAlias] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);
  const [aliasError, setAliasError] = useState('');
  
  const [detailsDialog, setDetailsDialog] = useState({ isOpen: false, title: '', details: null });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });
  const [promptDialog, setPromptDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info', confirmText: 'Submit' });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  useEffect(() => { 
    fetchDevices(); 
    fetchStats();
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const res = await getTrustedDeviceStats();
      if (res.data.success) setStats(res.data.stats);
    } catch (e) { console.error('Failed to fetch stats'); }
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await getAllTrustedDevices({ status: activeTab.charAt(0).toUpperCase() + activeTab.slice(1), search: searchTerm });
      if (response.data.success) setDevices(response.data.devices || []);
    } catch (error) { setDevices([]); } 
    finally { setLoading(false); }
  };

  const handleSearch = () => fetchDevices();

  const handleApprove = async (deviceId) => {
    try {
      const response = await approveTrustedDevice(deviceId);
      if (response.data.success) {
        setAlertDialog({ isOpen: true, title: 'Success', message: 'Device approved successfully', type: 'success' });
        fetchDevices(); fetchStats();
      }
    } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to approve device', type: 'error' }); }
  };

  const handleReject = (device) => {
    setPromptDialog({
      isOpen: true, title: 'Reject Device', type: 'danger', confirmText: 'Reject',
      message: `Are you sure you want to reject ${device.device_alias || device.employee_name}'s device?`,
      onConfirm: async (remarks) => {
        try {
          const response = await rejectTrustedDevice(device.id, remarks);
          if (response.data.success) {
            setAlertDialog({ isOpen: true, title: 'Success', message: 'Device rejected successfully', type: 'success' });
            fetchDevices(); fetchStats();
          }
        } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to reject device', type: 'error' }); }
      }
    });
  };

  const handleBlock = (device) => {
    setConfirmDialog({
      isOpen: true, title: 'Block Device', type: 'danger', confirmText: 'Block',
      message: `Are you sure you want to block this trusted device? The employee will no longer be able to use this device for attendance until it is unblocked.`,
      onConfirm: async () => {
        try {
          // You could optionally ask for remarks using PromptDialog, but requirements say optional and confirm dialog is fine.
          const response = await blockTrustedDevice(device.id, 'Blocked by Admin');
          if (response.data.success) {
            setAlertDialog({ isOpen: true, title: 'Success', message: 'Device blocked successfully', type: 'success' });
            fetchDevices(); fetchStats();
          }
        } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to block device', type: 'error' }); }
      }
    });
  };

  const handleUnblock = (device) => {
    setConfirmDialog({
      isOpen: true, title: 'Unblock Device', type: 'info', confirmText: 'Unblock',
      message: `This device will become trusted again.`,
      onConfirm: async () => {
        try {
          const response = await unblockTrustedDevice(device.id);
          if (response.data.success) {
            setAlertDialog({ isOpen: true, title: 'Success', message: 'Device unblocked successfully', type: 'success' });
            fetchDevices(); fetchStats();
          }
        } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to unblock device', type: 'error' }); }
      }
    });
  };

  const handleEditAlias = (device) => { setEditingDevice(device.id); setEditAlias(device.device_alias || ''); setAliasError(''); };
  const handleCancelEdit = () => { setEditingDevice(null); setEditAlias(''); setAliasError(''); };

  const handleSaveAlias = async (deviceId) => {
    if (!editAlias.trim()) { setAliasError('Alias cannot be empty'); return; }
    setSavingAlias(true); setAliasError('');
    try {
      const response = await updateTrustedDeviceAlias(deviceId, editAlias.trim());
      if (response.data.success) {
        setDevices(devices.map(d => d.id === deviceId ? { ...d, device_alias: editAlias.trim() } : d));
        setEditingDevice(null); setEditAlias('');
      } else { setAliasError(response.data.message || 'Failed to update'); }
    } catch (error) { setAliasError('Failed to update alias'); } 
    finally { setSavingAlias(false); }
  };

  const handleRemoveApproval = (device) => {
    setConfirmDialog({
      isOpen: true, title: 'Remove Approval', type: 'warning',
      message: `Are you sure you want to remove approval for ${device.device_alias || device.employee_name}'s device? It will be set to Pending status.`,
      onConfirm: async () => {
        try {
          const response = await removeTrustedDeviceApproval(device.id);
          if (response.data.success) {
            setAlertDialog({ isOpen: true, title: 'Success', message: 'Approval removed successfully', type: 'success' });
            fetchDevices(); fetchStats();
          }
        } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to remove approval', type: 'error' }); }
      }
    });
  };

  const handleDelete = (device) => {
    setConfirmDialog({
      isOpen: true, title: 'Delete Device', type: 'danger', confirmText: 'Delete',
      message: `Permanently delete ${device.device_alias || device.employee_name}'s device? This cannot be undone.`,
      onConfirm: async () => {
        try {
          const response = await deleteTrustedDevice(device.id);
          if (response.data.success) {
            setAlertDialog({ isOpen: true, title: 'Success', message: 'Device deleted successfully', type: 'success' });
            fetchDevices(); fetchStats();
          }
        } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to delete device', type: 'error' }); }
      }
    });
  };

  const handleViewDetails = (device) => {
    setDetailsDialog({
      isOpen: true,
      title: `Device Details: ${device.device_alias || device.employee_name}`,
      details: {
        'Employee ID': device.employee_id,
        'Employee Name': device.employee_name,
        'Job Role': device.job_role || 'N/A',
        'Department': device.department || 'N/A',
        'Device Alias': device.device_alias || 'No alias set',
        'Device Source': device.device_source === 'electron-desktop' ? 'Electron Desktop App' : 'Browser',
        'Device Type': device.device_type,
        'Desktop Hostname': device.desktop_hostname || 'N/A',
        'Desktop Platform': device.desktop_platform || 'N/A',
        'Electron App Version': device.electron_app_version || 'N/A',
        'Browser': `${device.browser_name || 'Unknown'} ${device.browser_version || ''}`,
        'Operating System': device.operating_system || 'Unknown',
        'Screen Resolution': device.screen_resolution || 'Unknown',
        'Platform': device.platform || 'Unknown',
        'Fingerprint': device.device_fingerprint || 'N/A',
        'Public Key Hash': device.desktop_public_key_hash ? `${device.desktop_public_key_hash.substring(0, 16)}...` : 'N/A',
        'Signature Verified': device.desktop_signature_verified_at ? formatDate(device.desktop_signature_verified_at) : 'N/A',
        'First Seen': formatDate(device.first_seen),
        'Last Used': formatDate(device.last_used),
        'Approval Status': device.approved_status,
        'Approved By': device.approved_by ? `Admin ${device.approved_by}` : 'N/A',
        'Remarks': device.remarks || 'None'
      }
    });
  };

  const filteredDevices = devices.filter(device =>
    device.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.device_alias?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 overflow-y-auto dark-scroll pb-24">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8 animate-fadeIn">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight drop-shadow-md">Trusted Devices</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Manage and approve employee devices for secure attendance.</p>
            </div>
            <button onClick={() => { fetchDevices(); fetchStats(); }} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 bg-admin-surface border border-admin-border hover:border-admin-border text-admin-muted hover:text-admin-text text-xs font-bold rounded-xl transition-all shadow-clay-admin">
              <FiRefreshCw size={14} className={loading ? 'animate-spin text-blue-400' : ''} />
              {loading ? 'Syncing...' : 'Refresh Data'}
            </button>
          </div>

          {/* Stat Cards - CSS Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label:'Total Devices',   value:stats.totalDevices,   color:'text-blue-400',    bg:'from-blue-500/10 to-transparent', border:'border-blue-500/20' },
              { label:'Pending Devices', value:stats.pendingDevices, color:'text-amber-400',   bg:'from-amber-500/10 to-transparent', border:'border-amber-500/20', alert:stats.pendingDevices>0 },
              { label:'Approved Devices',value:stats.approvedDevices,color:'text-emerald-400', bg:'from-emerald-500/10 to-transparent', border:'border-emerald-500/20' },
              { label:'Rejected Devices',value:stats.rejectedDevices,color:'text-red-400',     bg:'from-red-500/10 to-transparent', border:'border-red-500/20' },
              { label:'Blocked Devices', value: stats.blockedDevices,color:'text-purple-400',  bg:'from-purple-500/10 to-transparent', border:'border-purple-500/20' },
            ].map((s, i) => (
              <div key={i} className={`bg-admin-elevated border ${s.border} rounded-2xl p-4 shadow-clay-admin overflow-hidden relative group hover:-translate-y-1 transition-transform duration-300`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} opacity-50 group-hover:opacity-100 transition-opacity`} />
                {s.alert && <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
                <div className="relative z-10">
                  <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest">{s.label}</p>
                  <p className={`text-3xl font-extrabold mt-1 ${s.color} drop-shadow-sm`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin overflow-hidden flex flex-col min-h-[500px]">
            
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-admin-border bg-admin-surface backdrop-blur-md p-4 gap-4">
              <div className="flex items-center gap-2 p-1 bg-admin-bg border border-admin-border rounded-xl w-fit">
                {TABS.map(({ id, label, icon:Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${activeTab === id ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-admin-secondary hover:text-admin-muted hover:bg-admin-elevated'}`}>
                    <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
                    {id === 'pending' && stats.pendingDevices > 0 && <span className="ml-1 bg-amber-500 text-amber-950 px-1.5 py-0.5 rounded-md text-[9px]">{stats.pendingDevices}</span>}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" size={14} />
                  <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSearch()} placeholder="Search employees or aliases..." className="w-full bg-admin-bg border border-admin-border text-admin-text text-xs rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all" />
                </div>
                <button onClick={handleSearch} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-[0_4px_12px_rgba(59,130,246,0.2)]">Search</button>
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[600px] dark-scroll relative">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-admin-elevated backdrop-blur-sm z-20">
                  <Spinner size={40} color="blue" />
                  <p className="text-xs font-bold text-blue-400 mt-4 animate-pulse">Syncing Devices...</p>
                </div>
              ) : (
                <div className="min-w-[900px]">
                  <table className="min-w-full relative">
                    <thead>
                      <tr>
                        <Th>Employee</Th>
                        <Th>Device Alias</Th>
                        <Th>Type</Th>
                        <Th>Browser & OS / Source</Th>
                        {activeTab === 'pending' && <Th>First Seen</Th>}
                        {activeTab === 'approved' && <Th>Last Used / Approved</Th>}
                        {activeTab === 'rejected' && <Th>Rejected Date</Th>}
                        {activeTab === 'blocked' && <Th>Blocked Date</Th>}
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.length === 0 ? <EmptyState message={`No ${activeTab} devices found`} /> : filteredDevices.map((device, i) => (
                        <tr key={device.id} className="group border-b border-admin-border hover:bg-admin-elevated/[0.02] transition-colors">
                          <Td>
                            <div className="flex flex-col">
                              <span className="font-bold text-admin-text">{device.employee_name}</span>
                              <span className="text-[10px] text-admin-secondary font-mono mt-0.5">{device.employee_id}</span>
                            </div>
                          </Td>
                          <Td>
                            {editingDevice === device.id ? (
                              <div className="flex flex-col gap-1">
                                <input type="text" value={editAlias} onChange={(e) => setEditAlias(e.target.value)} className="admin-input text-xs py-1.5 px-2 w-32" placeholder="e.g., Reception PC" autoFocus />
                                {aliasError && <span className="text-[10px] text-red-400">{aliasError}</span>}
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-bold text-admin-muted">{device.device_alias || <span className="text-[#475569] italic font-normal">No alias</span>}</span>
                                <span className="text-[10px] text-[#475569] font-mono mt-0.5">{device.device_fingerprint ? device.device_fingerprint.substring(0,8)+'…' : '—'}</span>
                              </div>
                            )}
                          </Td>
                          <Td><DeviceTypePill type={device.device_type} /></Td>
                          <Td>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-admin-secondary">
                                {device.device_source === 'electron-desktop' ? 'Electron App' : (device.browser_name || '—') + (device.browser_version ? ` v${device.browser_version}` : '')}
                              </span>
                              <span className="text-[10px] text-admin-secondary mt-0.5">
                                {device.device_source === 'electron-desktop' ? device.desktop_hostname : device.operating_system || '—'}
                              </span>
                            </div>
                          </Td>
                          
                          {activeTab === 'pending' && (
                            <Td className="whitespace-nowrap"><span className="text-[10px] font-bold text-admin-muted uppercase">{formatDate(device.first_seen)}</span></Td>
                          )}
                          
                          {activeTab === 'approved' && (
                            <Td>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-emerald-400/80 uppercase">Appr: {formatDate(device.approved_at)}</span>
                                <span className="text-[10px] font-bold text-admin-secondary uppercase">Used: {formatDate(device.last_used)}</span>
                              </div>
                            </Td>
                          )}
                          
                          {activeTab === 'rejected' && (
                            <Td className="whitespace-nowrap"><span className="text-[10px] font-bold text-red-400/80 uppercase">{formatDate(device.rejected_at)}</span></Td>
                          )}
                          
                          {activeTab === 'blocked' && (
                            <Td className="whitespace-nowrap"><span className="text-[10px] font-bold text-purple-400/80 uppercase">{formatDate(device.rejected_at || device.updated_at)}</span></Td>
                          )}
                          
                          <Td>
                            <div className="flex items-center gap-2">
                              {editingDevice === device.id ? (
                                <>
                                  <button onClick={() => handleSaveAlias(device.id)} disabled={savingAlias} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 flex items-center justify-center disabled:opacity-50"><FiSave size={14} /></button>
                                  <button onClick={handleCancelEdit} disabled={savingAlias} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center justify-center disabled:opacity-50"><FiX size={14} /></button>
                                </>
                              ) : (
                                <>
                                  {activeTab === 'pending' && (
                                    <>
                                      <button onClick={() => handleApprove(device.id)} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 flex items-center justify-center transition-all" title="Approve"><FiCheck size={14} /></button>
                                      <button onClick={() => handleReject(device)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center justify-center transition-all" title="Reject"><FiX size={14} /></button>
                                    </>
                                  )}
                                  {activeTab === 'approved' && (
                                    <>
                                      <button onClick={() => handleBlock(device)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center justify-center transition-all" title="Block Device"><FiShieldOff size={14} /></button>
                                      <button onClick={() => handleRemoveApproval(device)} className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 flex items-center justify-center transition-all" title="Revoke Approval"><FiX size={14} /></button>
                                    </>
                                  )}
                                  {activeTab === 'rejected' && (
                                    <button onClick={() => handleApprove(device.id)} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 flex items-center justify-center transition-all" title="Approve"><FiCheck size={14} /></button>
                                  )}
                                  {activeTab === 'blocked' && (
                                    <button onClick={() => handleUnblock(device)} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 flex items-center justify-center transition-all" title="Unblock Device"><FiUnlock size={14} /></button>
                                  )}
                                  <button onClick={() => handleEditAlias(device)} className="w-8 h-8 rounded-lg bg-admin-surface text-admin-muted border border-admin-border hover:text-blue-400 hover:border-blue-500/20 hover:bg-blue-500/10 flex items-center justify-center transition-all" title="Edit Alias"><FiEdit2 size={13} /></button>
                                  <button onClick={() => handleViewDetails(device)} className="w-8 h-8 rounded-lg bg-admin-surface text-admin-muted border border-admin-border hover:text-admin-text hover:border-admin-border flex items-center justify-center transition-all" title="View Details"><FiEye size={14} /></button>
                                  <button onClick={() => handleDelete(device)} className="w-8 h-8 rounded-lg bg-red-500/5 text-red-500/50 border border-red-500/10 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/10 flex items-center justify-center transition-all" title="Delete"><FiTrash2 size={13} /></button>
                                </>
                              )}
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <DetailsDialog isOpen={detailsDialog.isOpen} onClose={() => setDetailsDialog({ isOpen: false, title: '', details: null })} title={detailsDialog.title} details={detailsDialog.details} />
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog({ ...confirmDialog, isOpen: false }); }} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.confirmText || (confirmDialog.type === 'danger' ? 'Delete' : 'Confirm')} />
      <PromptDialog isOpen={promptDialog.isOpen} onClose={() => setPromptDialog({ ...promptDialog, isOpen: false })} onConfirm={(val) => { promptDialog.onConfirm(val); setPromptDialog({ ...promptDialog, isOpen: false }); }} title={promptDialog.title} message={promptDialog.message} type={promptDialog.type} confirmText={promptDialog.confirmText} />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
    </div>
  );
};

export default AdminTrustedDevices;
