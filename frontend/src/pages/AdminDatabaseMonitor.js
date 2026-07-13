import React, { useState, useEffect } from 'react';
import { getDatabaseMonitor } from '../services/api';
import Sidebar from '../components/Sidebar';
import { FiDatabase, FiRefreshCw, FiAlertTriangle, FiCheckCircle, FiInfo, FiUsers, FiCalendar, FiActivity, FiDollarSign } from 'react-icons/fi';
import { Spinner } from '../components/Loader';
import { getErrorMessage } from '../utils/errorHandler';

const AdminDatabaseMonitor = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const STORAGE_LIMIT_MB = parseInt(process.env.REACT_APP_DATABASE_STORAGE_LIMIT_MB || '500', 10);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      
      const res = await getDatabaseMonitor();
      if (res.data.success) {
        setData(res.data);
      } else {
        throw new Error(res.data.message || 'Failed to load monitor data');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" className="text-admin-accent mb-4" />
        <p className="text-sm font-medium text-admin-secondary animate-pulse">Scanning database health...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center max-w-lg mx-auto mt-10">
        <FiAlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-500 mb-2">Monitor Failed</h3>
        <p className="text-sm text-admin-secondary mb-4">{error}</p>
        <button onClick={() => fetchData()} className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-red-600 transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  const { database, summary, tables, warnings } = data;
  const storagePercentage = Math.min((database.sizeBytes / (STORAGE_LIMIT_MB * 1024 * 1024)) * 100, 100);
  
  let progressColor = 'bg-emerald-500';
  if (storagePercentage > 90) progressColor = 'bg-red-500';
  else if (storagePercentage > 70) progressColor = 'bg-orange-500';

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll pb-24 relative">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8 animate-fadeIn">
          <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-admin-surface border border-admin-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <FiDatabase size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-admin-text tracking-tight">Database Monitor</h1>
            <p className="text-sm font-medium text-admin-secondary mt-1">Monitor database storage, table size, and important system data.</p>
          </div>
        </div>
        <button 
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="admin-btn-primary flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-70"
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warnings.map((w, idx) => {
            const isError = w.type === 'error';
            const isWarn = w.type === 'warning';
            return (
              <div key={idx} className={`flex items-start gap-3 p-4 rounded-xl border ${isError ? 'bg-red-500/10 border-red-500/20 text-red-500' : isWarn ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                <div className="mt-0.5">
                  {isError ? <FiAlertTriangle size={18} /> : isWarn ? <FiAlertTriangle size={18} /> : <FiInfo size={18} />}
                </div>
                <p className="text-sm font-bold leading-tight">{w.message}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Storage Health */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-lg font-bold text-admin-text">Storage Health</h2>
            <p className="text-sm text-admin-secondary mt-1">Free Tier Limit: {STORAGE_LIMIT_MB} MB</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-admin-text">{database.size}</span>
            <span className="text-sm font-bold text-admin-secondary ml-2">used</span>
          </div>
        </div>
        <div className="h-4 bg-admin-elevated rounded-full overflow-hidden border border-admin-border shadow-inner">
          <div className={`h-full ${progressColor} transition-all duration-1000 ease-out`} style={{ width: `${storagePercentage}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-xs font-bold text-admin-muted">
          <span>0 MB</span>
          <span>{storagePercentage.toFixed(1)}% Full</span>
          <span>{STORAGE_LIMIT_MB} MB</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Tables', val: database.tableCount, icon: FiDatabase, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Employees', val: summary.employees, icon: FiUsers, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Attendance', val: summary.attendanceRecords, icon: FiCalendar, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Manual Logs', val: summary.manualAttendanceLogs, icon: FiCheckCircle, color: 'text-teal-500', bg: 'bg-teal-500/10' },
          { label: 'Activity Logs', val: summary.activityLogs, icon: FiActivity, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Payroll Records', val: summary.payrollRecords, icon: FiDollarSign, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-admin-surface border border-admin-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-admin-text">{stat.val.toLocaleString()}</p>
              <p className="text-xs font-bold text-admin-secondary uppercase tracking-wider mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tables List */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-admin-border bg-admin-elevated">
          <h2 className="text-lg font-bold text-admin-text">Database Table Usage</h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-5 py-4 text-xs font-bold text-admin-secondary uppercase tracking-wider border-b border-admin-border bg-admin-surface/50">Table Name</th>
                <th className="px-5 py-4 text-xs font-bold text-admin-secondary uppercase tracking-wider border-b border-admin-border bg-admin-surface/50">Rows (Est.)</th>
                <th className="px-5 py-4 text-xs font-bold text-admin-secondary uppercase tracking-wider border-b border-admin-border bg-admin-surface/50">Table Size</th>
                <th className="px-5 py-4 text-xs font-bold text-admin-secondary uppercase tracking-wider border-b border-admin-border bg-admin-surface/50">Index Size</th>
                <th className="px-5 py-4 text-xs font-bold text-admin-secondary uppercase tracking-wider border-b border-admin-border bg-admin-surface/50 text-right">Total Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {tables.map((t, idx) => (
                <tr key={t.tableName} className="hover:bg-admin-elevated/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-sm font-bold text-admin-text">{t.tableName}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-admin-secondary">{t.estimatedRows.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-admin-secondary">{t.tableSize}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-admin-secondary">{t.indexSize}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-sm font-black ${idx === 0 && t.totalSizeBytes > 10 * 1024 * 1024 ? 'text-red-500' : 'text-admin-text'}`}>{t.totalSize}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDatabaseMonitor;
