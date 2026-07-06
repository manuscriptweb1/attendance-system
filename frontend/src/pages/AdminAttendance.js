import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import ClearRangeDialog from '../components/ClearRangeDialog';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getAllAttendance, resetAttendance, deleteAttendance, clearAttendanceRange } from '../services/api';
import { formatTime, formatDate, formatWorkingHours } from '../utils/formatTime';
import { getErrorMessage } from '../utils/errorHandler';
import { validateDateString } from '../utils/dateValidation';
import { FiFilter, FiRefreshCw, FiTrash2, FiRotateCcw, FiCalendar, FiCheckCircle, FiClock, FiHome, FiTrendingUp } from 'react-icons/fi';
import { sortEmployeeRows } from '../utils/sorting';

const getLocalDateString = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; };

const AdminAttendance = () => {
  const [attendance,   setAttendance]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filters,      setFilters]      = useState({ date: getLocalDateString(), status:'', employee_id:'', department:'', is_wfh:'' });
  const [sortBy,       setSortBy]       = useState('name_asc');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'info' });
  const [alertDialog,   setAlertDialog]   = useState({ isOpen:false, title:'', message:'', type:'success' });

  const [clearDialog, setClearDialog] = useState({ isOpen: false });

  const fetchAttendance = async () => {
    try { 
      setLoading(true); 
      // API expects filters
      const r = await getAllAttendance(filters); 
      if (r.data.success) setAttendance(r.data.attendance); 
    }
    catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
    finally { setLoading(false); }
  };
  
  useEffect(() => { fetchAttendance(); }, [filters]); // eslint-disable-line

  const handleFilterChange = (e) => {
    if (e.target.name === 'date') {
      const dateError = validateDateString(e.target.value, { allowFuture: false });
      if (dateError) {
        setAlertDialog({ isOpen: true, title: 'Error', message: dateError, type: 'error' });
        return; // do not update filter
      }
    }
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  /* ─── ACTIONS ─── */

  const handleResetAttendance = (record, resetType) => {
    const resetText = resetType === 'check-in' ? 'Check-In' : 'Check-Out';
    setConfirmDialog({ isOpen:true, title:`Reset ${resetText}`, type:'warning', message:`Reset ${resetText} for "${record.name}" on ${formatDate(record.attendance_date)}?`,
      onConfirm: async () => {
        try { const r = await resetAttendance(record.id, resetType); if (r.data.success) { fetchAttendance(); } else throw new Error(r.data.message); }
        catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
      },
    });
  };

  const handleDeleteAttendance = record => setConfirmDialog({
    isOpen:true, title:'Delete Attendance Record', type:'danger',
    message:`Permanently delete the attendance record for "${record.name}" on ${formatDate(record.attendance_date)}?`,
    onConfirm: async () => {
      try { const r = await deleteAttendance(record.id); if (r.data.success) { fetchAttendance(); } else throw new Error(r.data.message); }
      catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
    },
  });

  const handleClearRange = async (data) => {
    try {
      setClearDialog(prev => ({ ...prev, isLoading: true }));
      const response = await clearAttendanceRange(data);
      if (response.data.success) {
        setClearDialog({ isOpen: false, isLoading: false });
        setAlertDialog({ isOpen: true, title: 'Success', message: response.data.message || 'Records cleared successfully.', type: 'success' });
        fetchAttendance();
      } else {
        setClearDialog(prev => ({ ...prev, isLoading: false }));
        setAlertDialog({ isOpen: true, title: 'Error', message: response.data.message || 'Failed to clear attendance', type: 'error' });
      }
    } catch (error) {
      setClearDialog(prev => ({ ...prev, isLoading: false }));
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  /* ─── COMPUTED STATS (For selected date only) ─── */
  const stats = useMemo(() => {
    let present = 0, late = 0, halfDay = 0, wfh = 0;
    // Absent cannot be perfectly calculated without total employee count, 
    // but we'll show Present, Late, Half Day, WFH based on records.
    attendance.forEach(a => {
      if (a.attendance_status === 'Present') present++;
      else if (a.attendance_status === 'Late') { present++; late++; }
      else if (a.attendance_status === 'Half Day') { halfDay++; }
      if (a.is_wfh) wfh++;
    });
    return { present, late, halfDay, wfh };
  }, [attendance]);

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">

          {/* ═══ HEADER ═══ */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight">Attendance Management</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Monitor and manage employee attendance.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => setClearDialog({ isOpen: true })} className="admin-btn-neutral px-4 py-2.5 rounded-xl text-sm font-semibold hover:text-red-500 hover:border-red-500/50">
                <FiTrash2 size={16} /> Clear Month
              </button>
            </div>
          </div>

          {/* ═══ TODAY'S SUMMARY ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fadeInUp stagger-2">
            {[
              { label: 'Present',  value: stats.present, icon: FiCheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Late',     value: stats.late,    icon: FiClock,       color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
              { label: 'Half Day', value: stats.halfDay, icon: FiTrendingUp,  color: 'text-yellow-500',  bg: 'bg-yellow-500/10 border-yellow-500/20' },
              { label: 'WFH',      value: stats.wfh,     icon: FiHome,        color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' }
            ].map((stat, i) => (
              <div key={i} className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-clay-admin flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-2xl font-extrabold text-admin-heading">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.bg} ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
              </div>
            ))}
          </div>

          {/* ═══ FILTERS ═══ */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FiFilter size={14} className="text-blue-400" />
              </div>
              <h2 className="text-sm font-bold text-admin-text">Filter Records</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Date</label>
                <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="admin-input py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Search ID</label>
                <input type="text" name="employee_id" value={filters.employee_id} onChange={handleFilterChange} placeholder="EMP-001" className="admin-input py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Department</label>
                <select name="department" value={filters.department || ''} onChange={handleFilterChange} className="admin-select py-2.5 text-sm text-admin-muted">
                  <option value="">All Depts</option>
                  {[...new Set(attendance.map(a=>a.department))].filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Status</label>
                <select name="status" value={filters.status} onChange={handleFilterChange} className="admin-select py-2.5 text-sm text-admin-muted">
                  <option value="">All Statuses</option>
                  <option value="Currently Working">Currently Working</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                  <option value="Not Mention">Not Mention</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Work Type</label>
                <select name="is_wfh" value={filters.is_wfh || ''} onChange={handleFilterChange} className="admin-select py-2.5 text-sm text-admin-muted">
                  <option value="">All Types</option>
                  <option value="false">Office</option>
                  <option value="true">WFH</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Sort By</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="admin-select py-2.5 text-sm text-admin-muted cursor-pointer">
                  <option value="name_asc" className="text-slate-900">Name A-Z</option>
                  <option value="name_desc" className="text-slate-900">Name Z-A</option>
                  <option value="employee_id_asc" className="text-slate-900">Employee ID A-Z</option>
                  <option value="employee_id_desc" className="text-slate-900">Employee ID Z-A</option>

                </select>
              </div>
            </div>
          </div>

          {/* ═══ TABLE ═══ */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Spinner size={36} color="blue" />
                <p className="text-sm font-medium text-admin-secondary mt-4 animate-pulse">Loading records...</p>
              </div>
            ) : (
              <div className="table-responsive attendance-table-wrapper dark-scroll">
                <table className="attendance-table divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg">
                    <tr>{['DATE', 'EMP ID', 'NAME', 'DEPT', 'CHECK IN', 'CHECK OUT', 'HOURS', 'IN STATUS', 'OUT STATUS', 'STATUS', 'ABSENT REASON', 'TYPE', 'ACTIONS'].map(h => (
                      <th key={h} className={`px-3 py-2.5 text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap ${h === 'ACTIONS' ? 'actions-column' : 'text-left'}`}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(() => {
                      const sortedAttendance = sortEmployeeRows(attendance, sortBy);
                      return sortedAttendance.length > 0 ? sortedAttendance.map(r => (
                        <tr key={r.id} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors group">
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-admin-secondary whitespace-nowrap">{formatDate(r.attendance_date)}</td>
                        <td className="px-3 py-2.5 text-[11px] font-mono text-admin-text whitespace-nowrap">{r.emp_id}</td>
                        <td className="px-3 py-2.5 text-[11px] font-bold text-admin-text whitespace-nowrap">{r.name}</td>
                        <td className="px-3 py-2.5 text-[11px] text-admin-secondary whitespace-nowrap">{r.department}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-[11px] text-admin-secondary font-mono">{formatTime(r.login_time) || '—'}</div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-[11px] text-admin-secondary font-mono">
                            {formatTime(r.logout_time) || '—'}
                            {r.is_auto_checkout && r.logout_time && <span className="ml-1 text-[9px] text-amber-500/80 font-bold">(Auto)</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-admin-secondary font-mono whitespace-nowrap">{r.logout_time ? formatWorkingHours(parseFloat(r.total_working_hours)) : '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {(() => {
                            if (r.checkin_status === 'late') return <span className="block text-[10px] text-amber-500 font-bold">Late {r.late_minutes}m</span>;
                            if (r.checkin_status === 'early') return <span className="block text-[10px] text-purple-400 font-bold">Early</span>;
                            if (r.login_time) return <span className="block text-[10px] text-emerald-400 font-bold">On Time</span>;
                            return <span className="block text-[10px] text-admin-muted font-bold">—</span>;
                          })()}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {(() => {
                            if (r.checkout_status === 'late') return <span className="block text-[10px] text-amber-500 font-bold">Late</span>;
                            if (r.checkout_status === 'early') return <span className="block text-[10px] text-purple-400 font-bold">Early {r.early_minutes}m</span>;
                            if (r.logout_time) return <span className="block text-[10px] text-emerald-400 font-bold">On Time</span>;
                            return <span className="block text-[10px] text-admin-muted font-bold">—</span>;
                          })()}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={r.attendance_status || 'Not Mention'} dark />
                            {r.validation_method === 'Manual' && <span className="text-[10px] font-bold text-purple-500 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">Manual</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-admin-secondary whitespace-nowrap">
                          {r.attendance_status === 'Absent' || r.attendance_status === 'Not Mention' ? (r.absent_reason || '—') : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {r.is_wfh ? <span className="text-[9px] font-bold text-blue-400 bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded-sm">WFH</span> : <span className="text-[9px] text-[#475569] font-medium">Office</span>}
                          </div>
                        </td>
                        <td className="actions-column px-3 py-2.5 whitespace-nowrap">
                          <div className="action-buttons opacity-50 group-hover:opacity-100 transition-opacity">
                            {r.login_time && (
                              <button onClick={() => handleResetAttendance(r, 'check-in')} title="Reset Check-In" className="action-icon-btn text-amber-500 bg-admin-elevated border border-admin-border hover:bg-amber-500/10 hover:border-amber-500/20 transition-all shadow-sm"><FiRotateCcw size={16} /></button>
                            )}
                            {r.logout_time && (
                              <button onClick={() => handleResetAttendance(r, 'check-out')} title="Reset Check-Out" className="action-icon-btn text-blue-400 bg-admin-elevated border border-admin-border hover:bg-blue-500/10 hover:border-blue-500/20 transition-all shadow-sm"><FiRefreshCw size={16} /></button>
                            )}
                            <button onClick={() => handleDeleteAttendance(r)} title="Delete Record" className="action-icon-btn text-red-500 bg-admin-elevated border border-admin-border hover:bg-red-500/10 hover:border-red-500/20 transition-all shadow-sm"><FiTrash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={13} className="px-5 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-admin-elevated/[0.02] flex items-center justify-center">
                            <FiCalendar size={28} className="text-[#475569]" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-admin-muted">No records found</p>
                            <p className="text-xs font-medium text-admin-secondary mt-1">Try adjusting your filters</p>
                          </div>
                        </div>
                      </td></tr>
                    );
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ DIALOGS ═══ */}
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(d => ({ ...d, isOpen:false })); }} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.type === 'danger' ? 'Delete' : 'Confirm'} />
      <AlertDialog   isOpen={alertDialog.isOpen}   onClose={() => setAlertDialog(d => ({ ...d, isOpen:false }))}   title={alertDialog.title}   message={alertDialog.message}   type={alertDialog.type} />
      <ClearRangeDialog 
        isOpen={clearDialog.isOpen} 
        onClose={() => setClearDialog({ isOpen: false })} 
        onConfirm={handleClearRange} 
        title="Clear Attendance Range" 
        message="⚠️ WARNING: This will permanently delete ALL attendance records for the selected date range. This action cannot be undone." 
        isLoading={clearDialog.isLoading}
      />
    </div>
  );
};
export default AdminAttendance;

