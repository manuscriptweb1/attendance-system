import React, { useState, useEffect } from 'react';
import { FiActivity, FiDownload, FiFilter, FiSearch, FiX, FiEye, FiRefreshCw, FiTrash2, FiSettings, FiCalendar, FiLogIn, FiAlertTriangle } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import ClearDataDialog from '../components/ClearDataDialog';
import { Spinner } from '../components/Loader';
import { 
  getAdminActivityLogs, 
  exportAdminActivityLogs,
  getAdminActionTypes,
  getAdminModuleNames,
  clearAdminActivityLogs,
  getAdminActivityStats
} from '../services/api';
import { formatTime, formatDate } from '../utils/formatTime';

const AdminActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [detailsDialog, setDetailsDialog] = useState({ isOpen: false, log: null });
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, total: 0 });
  
  const [filters, setFilters] = useState({
    search: '', actionType: '', moduleName: '', startDate: '', endDate: '', sortOrder: 'desc', page: 1, limit: 10
  });

  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [actionTypes, setActionTypes] = useState([]);
  const [moduleNames, setModuleNames] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [clearDialog, setClearDialog] = useState({ isOpen: false });

  useEffect(() => {
    fetchLogs();
    fetchActionTypes();
    fetchModuleNames();
    fetchStats();
  }, [filters.page, filters.sortOrder]);

  const fetchStats = async () => {
    try {
      const res = await getAdminActivityStats();
      if (res.data.success) setStats(res.data.stats);
    } catch (e) { console.error('Stats error:', e); }
  };

  const fetchLogs = async (currentFilters = filters) => {
    setLoading(true);
    try {
      const response = await getAdminActivityLogs(currentFilters);
      if (response.data.success) {
        setLogs(response.data.logs);
        setPagination(response.data.pagination);
      }
    } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to load activity logs', type: 'error' }); } 
    finally { setLoading(false); }
  };

  const fetchActionTypes = async () => {
    try { const response = await getAdminActionTypes(); if (response.data.success) setActionTypes(response.data.actionTypes); } catch (e) {}
  };

  const fetchModuleNames = async () => {
    try { const response = await getAdminModuleNames(); if (response.data.success) setModuleNames(response.data.moduleNames); } catch (e) {}
  };

  const handleSearch = () => { 
    const newFilters = { ...filters, page: 1 };
    setFilters(newFilters); 
    fetchLogs(newFilters); 
  };

  const handleClearFilters = () => {
    const cleared = { search: '', actionType: '', moduleName: '', startDate: '', endDate: '', sortOrder: 'desc', page: 1, limit: 10 };
    setFilters(cleared);
    fetchLogs(cleared);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await exportAdminActivityLogs(filters);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `admin_activity_logs_${Date.now()}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      setAlertDialog({ isOpen: true, title: 'Success', message: 'Activity logs exported successfully', type: 'success' });
    } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Export failed', type: 'error' }); } 
    finally { setExporting(false); }
  };

  const handleClearActivityLogs = async () => {
    try {
      const response = await clearAdminActivityLogs();
      if (response.data.success) {
        setAlertDialog({ isOpen: true, title: 'Success', message: 'Logs cleared successfully', type: 'success' });
        fetchLogs(); fetchStats();
      } else { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to clear logs', type: 'error' }); }
    } catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to clear activity logs', type: 'error' }); }
  };

  const formatJSON = (jsonString) => {
    if (!jsonString) return null;
    try {
      const obj = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      return (
        <div className="space-y-1.5 font-mono text-[10px] sm:text-xs">
          {Object.entries(obj).map(([key, value]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
              <span className="text-blue-400 font-bold shrink-0">{key}:</span>
              <span className="text-admin-secondary break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          ))}
        </div>
      );
    } catch { return <span className="text-admin-muted text-xs font-mono">{jsonString}</span>; }
  };

  // Count metrics from current page logs (since stats API only gives basic counts)
  const currentPageMetrics = {
    logins: logs.filter(l => l.action_type?.toLowerCase().includes('login')).length,
    settings: logs.filter(l => l.module_name?.toLowerCase().includes('setting')).length,
    holidays: logs.filter(l => l.module_name?.toLowerCase().includes('holiday')).length,
    failed: logs.filter(l => l.description?.toLowerCase().includes('failed') || l.description?.toLowerCase().includes('error')).length
  };

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 overflow-y-auto dark-scroll pb-24">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8 animate-fadeIn">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight drop-shadow-md">Admin Activity Logs</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Complete audit trail of all administrator actions.</p>
            </div>
            <div className="flex gap-2">
              {logs.length > 0 && (
                <button onClick={() => setClearDialog({ isOpen: true })} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 hover:border-red-500/30 text-red-400 text-xs font-bold rounded-xl transition-all shadow-clay-admin">
                  <FiTrash2 size={14} /> Clear
                </button>
              )}
              <button onClick={handleExport} disabled={exporting || logs.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl disabled:opacity-50 transition-all shadow-clay-admin">
                {exporting ? <Spinner size="sm" /> : <FiDownload size={14} />} Export PDF
              </button>
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[
              { label:'Total Logs', value:stats.total, color:'text-blue-400', icon:FiActivity },
              { label:'Today Logs', value:stats.today, color:'text-emerald-400', icon:FiActivity },
              { label:'This Week', value:stats.thisWeek, color:'text-purple-400', icon:FiCalendar },
              { label:'Admin Logins', value:currentPageMetrics.logins, color:'text-cyan-400', icon:FiLogIn, isPageStat:true },
              { label:'Settings Updates', value:currentPageMetrics.settings, color:'text-orange-400', icon:FiSettings, isPageStat:true },
              { label:'Holiday Changes', value:currentPageMetrics.holidays, color:'text-pink-400', icon:FiCalendar, isPageStat:true },
              { label:'Failed Actions', value:currentPageMetrics.failed, color:'text-red-400', icon:FiAlertTriangle, isPageStat:true },
              { label:'Total Pages', value:pagination.totalPages, color:'text-indigo-400', icon:FiSearch },
            ].map((s, i) => (
              <div key={i} className="bg-admin-elevated border border-admin-border rounded-2xl p-3 shadow-clay-admin flex flex-col justify-between group hover:-translate-y-1 transition-transform relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-admin-elevated opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <s.icon size={12} className={s.color} />
                  {s.isPageStat && <span className="text-[8px] font-bold text-[#475569] uppercase" title="Current Page Only">PG</span>}
                </div>
                <div className="relative z-10">
                  <p className={`text-xl font-extrabold ${s.color} drop-shadow-sm`}>{s.value}</p>
                  <p className="text-[9px] font-bold text-admin-secondary uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters Area */}
          <div className="bg-admin-elevated border border-admin-border rounded-2xl p-5 mb-6 shadow-clay-admin">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-admin-text flex items-center gap-2"><FiFilter className="text-blue-400" /> Filter Activities</h2>
              <button onClick={() => setShowFilters(!showFilters)} className="text-[10px] font-bold uppercase tracking-wider text-admin-secondary hover:text-admin-muted transition-colors bg-admin-elevated px-3 py-1 rounded-full">
                {showFilters ? 'Hide Advanced' : 'Show Advanced'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Search admin, email, desc..." className="admin-input text-xs py-2.5" />
              <select value={filters.actionType} onChange={e => setFilters({ ...filters, actionType: e.target.value })} className="admin-select text-xs py-2.5 text-admin-muted">
                <option value="">All Actions</option>
                {actionTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleSearch} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl py-2.5 shadow-[0_4px_12px_rgba(59,130,246,0.2)] transition-colors">Search</button>
                <button onClick={handleClearFilters} className="px-4 bg-admin-surface border border-admin-border hover:border-admin-border text-admin-muted hover:text-admin-text rounded-xl transition-colors"><FiX size={14} /></button>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-admin-border animate-fadeIn">
                <select value={filters.moduleName} onChange={e => setFilters({ ...filters, moduleName: e.target.value })} className="admin-select text-xs py-2.5 text-admin-muted">
                  <option value="">All Modules</option>
                  {moduleNames.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="admin-input text-xs py-2.5" />
                <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="admin-input text-xs py-2.5" />
                <select value={filters.sortOrder} onChange={e => setFilters({ ...filters, sortOrder: e.target.value })} className="admin-select text-xs py-2.5 text-admin-muted">
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-admin-elevated border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin min-h-[400px] flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <Spinner size={36} color="blue" />
                <p className="text-xs font-bold text-blue-400 mt-4 animate-pulse">Syncing Logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-admin-secondary">
                <div className="w-16 h-16 rounded-2xl bg-admin-elevated/[0.02] flex items-center justify-center mb-4">
                  <FiActivity size={32} className="opacity-20" />
                </div>
                <p className="text-sm font-bold">No activity logs found</p>
                <p className="text-xs mt-1">Adjust filters to see more results.</p>
              </div>
            ) : (
              <div className="overflow-x-auto dark-scroll">
                <table className="min-w-full relative">
                  <thead>
                    <tr>
                      {['Time', 'Admin', 'Action', 'Module', 'Description', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 backdrop-blur-md z-10">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="group border-b border-admin-border hover:bg-admin-elevated/[0.02] transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="block text-xs font-semibold text-admin-text">{formatDate(log.created_at)}</span>
                          <span className="text-[10px] text-admin-secondary font-mono">{formatTime(log.created_at)}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="block text-sm font-bold text-admin-text">{log.admin_name || 'N/A'}</span>
                          <span className="text-[10px] text-admin-muted">{log.admin_email || 'N/A'}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">{log.action_type}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">{log.module_name}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-admin-secondary line-clamp-2">{log.description}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <button onClick={() => setDetailsDialog({ isOpen: true, log })} className="w-8 h-8 rounded-lg bg-admin-surface text-[#60A5FA] border border-admin-border hover:bg-blue-500/20 hover:border-blue-500/30 flex items-center justify-center transition-all shadow-sm">
                            <FiEye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination Strip */}
            {!loading && logs.length > 0 && (
              <div className="mt-auto px-5 py-3 bg-admin-elevated border-t border-admin-border flex items-center justify-between">
                <span className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest">
                  Showing {((pagination.page - 1) * filters.limit) + 1} – {Math.min(pagination.page * filters.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setFilters({ ...filters, page: filters.page - 1 })} disabled={filters.page === 1} className="px-3 py-1.5 bg-admin-surface text-admin-text text-xs font-bold rounded-lg disabled:opacity-50 border border-admin-border hover:bg-admin-elevated transition-colors">Prev</button>
                  <button onClick={() => setFilters({ ...filters, page: filters.page + 1 })} disabled={filters.page >= pagination.totalPages} className="px-3 py-1.5 bg-admin-surface text-admin-text text-xs font-bold rounded-lg disabled:opacity-50 border border-admin-border hover:bg-admin-elevated transition-colors">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Details Dialog */}
      {detailsDialog.isOpen && detailsDialog.log && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.4)] w-full max-w-3xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border bg-admin-surface shrink-0">
              <h2 className="text-sm font-bold text-admin-text flex items-center gap-2"><FiActivity className="text-blue-400" /> Log Details</h2>
              <button onClick={() => setDetailsDialog({ isOpen: false, log: null })} className="w-8 h-8 rounded-xl flex items-center justify-center text-admin-secondary hover:bg-admin-elevated hover:text-admin-text transition-colors"><FiX size={16} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto dark-scroll space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-admin-surface rounded-xl p-4 border border-admin-border">
                  <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest mb-3">Admin Data</p>
                  <p className="text-sm font-bold text-admin-text">{detailsDialog.log.admin_name || 'N/A'}</p>
                  <p className="text-xs text-admin-muted">{detailsDialog.log.admin_email || 'N/A'}</p>
                </div>
                <div className="bg-admin-surface rounded-xl p-4 border border-admin-border">
                  <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest mb-3">Action Info</p>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400">{detailsDialog.log.action_type}</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400">{detailsDialog.log.module_name}</span>
                  </div>
                  <p className="text-xs text-admin-text font-mono mt-3">{formatDate(detailsDialog.log.created_at)} {formatTime(detailsDialog.log.created_at)}</p>
                </div>
              </div>

              <div className="bg-admin-surface rounded-xl p-4 border border-admin-border">
                <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest mb-2">Description</p>
                <p className="text-sm font-medium text-admin-text leading-relaxed">{detailsDialog.log.description}</p>
              </div>

              <div className="bg-admin-surface rounded-xl p-4 border border-admin-border grid grid-cols-3 gap-4">
                <div><p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest mb-1">IP Address</p><p className="text-xs font-mono text-admin-secondary">{detailsDialog.log.ip_address || '—'}</p></div>
                <div><p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest mb-1">Device</p><p className="text-xs text-admin-secondary">{detailsDialog.log.device_info || '—'}</p></div>
                <div><p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest mb-1">Browser</p><p className="text-xs text-admin-secondary">{detailsDialog.log.browser_info || '—'}</p></div>
              </div>

              {(detailsDialog.log.old_data || detailsDialog.log.new_data) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailsDialog.log.old_data && (
                    <div className="bg-admin-surface rounded-xl p-4 border border-red-500/20 flex flex-col max-h-[300px]">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">Old Data (Removed)</p>
                      <div className="flex-1 overflow-y-auto dark-scroll bg-red-950/20 rounded-lg p-3 border border-red-500/10">
                        {formatJSON(detailsDialog.log.old_data)}
                      </div>
                    </div>
                  )}
                  {detailsDialog.log.new_data && (
                    <div className="bg-admin-surface rounded-xl p-4 border border-emerald-500/20 flex flex-col max-h-[300px]">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">New Data (Added)</p>
                      <div className="flex-1 overflow-y-auto dark-scroll bg-emerald-950/20 rounded-lg p-3 border border-emerald-500/10">
                        {formatJSON(detailsDialog.log.new_data)}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </div>
        </div>
      )}

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <ClearDataDialog isOpen={clearDialog.isOpen} onClose={() => setClearDialog({ isOpen: false })} onConfirm={handleClearActivityLogs} title="Clear Admin Logs" message="Permanently delete ALL admin activity records? This action cannot be undone." confirmText="delete" type="danger" />
    </div>
  );
};

export default AdminActivityLogs;
