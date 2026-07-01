import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import ClearDataDialog from '../components/ClearDataDialog';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getAllAttendance, downloadMonthlyMatrixPDF, downloadMonthlyMatrixExcel, downloadMonthlyExcel, resetAttendance, deleteAttendance, clearMonthlyAttendance } from '../services/api';
import { formatTime, formatDate, formatWorkingHours } from '../utils/formatTime';
import { FiDownload, FiFilter, FiRefreshCw, FiTrash2, FiRotateCcw, FiX, FiCalendar, FiCheckCircle, FiAlertCircle, FiClock, FiHome, FiTrendingUp } from 'react-icons/fi';

const getLocalDateString = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; };

const AdminAttendance = () => {
  const [attendance,   setAttendance]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filters,      setFilters]      = useState({ date: getLocalDateString(), status:'', employee_id:'', department:'', is_wfh:'' });
  
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [downloadData,   setDownloadData]   = useState({ month:'', year:'' });
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
    catch (e) { setAlertDialog({ isOpen:true, title:'Error', message:'Error loading attendance data', type:'error' }); }
    finally { setLoading(false); }
  };
  
  useEffect(() => { fetchAttendance(); }, [filters]); // eslint-disable-line

  const handleFilterChange = e => setFilters(f => ({ ...f, [e.target.name]: e.target.value }));

  /* ─── DOWNLOAD & ACTIONS ─── */
  const handleDownloadPDF = format => {
    setDownloadFormat(format);
    const now = new Date(); setDownloadData({ month: String(now.getMonth()+1), year: String(now.getFullYear()) });
    setShowDownloadDialog(true);
  };

  const downloadMatrix = async () => {
    const { month, year } = downloadData;
    if (!month || !year || parseInt(month) < 1 || parseInt(month) > 12) { setAlertDialog({ isOpen:true, title:'Error', message:'Please enter a valid month (1–12) and year.', type:'error' }); return; }
    setShowDownloadDialog(false);
    try {
      let response, fileName;
      if (downloadFormat === 'pdf') { response = await downloadMonthlyMatrixPDF(month, year); fileName = `attendance_matrix_${month}_${year}.pdf`; }
      else if (downloadFormat === 'excel') { response = await downloadMonthlyMatrixExcel(month, year); fileName = `attendance_matrix_${month}_${year}.xlsx`; }
      else if (downloadFormat === 'excel-list') { response = await downloadMonthlyExcel(month, year); fileName = `attendance_report_${month}_${year}.xlsx`; }
      const blob = new Blob([response.data], { type: downloadFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = fileName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
      setAlertDialog({ isOpen:true, title:'Success', message:`${downloadFormat.toUpperCase()} downloaded successfully!`, type:'success' });
    } catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Error downloading file.', type:'error' }); }
  };

  const handleResetAttendance = (record, resetType) => {
    const resetText = resetType === 'check-in' ? 'Check-In' : 'Check-Out';
    setConfirmDialog({ isOpen:true, title:`Reset ${resetText}`, type:'warning', message:`Reset ${resetText} for "${record.name}" on ${formatDate(record.attendance_date)}?`,
      onConfirm: async () => {
        try { const r = await resetAttendance(record.id, resetType); if (r.data.success) { setAlertDialog({ isOpen:true, title:'Success', message:`${resetText} reset successfully!`, type:'success' }); fetchAttendance(); } else throw new Error(r.data.message); }
        catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Operation failed.', type:'error' }); }
      },
    });
  };

  const handleDeleteAttendance = record => setConfirmDialog({
    isOpen:true, title:'Delete Attendance Record', type:'danger',
    message:`Permanently delete the attendance record for "${record.name}" on ${formatDate(record.attendance_date)}?`,
    onConfirm: async () => {
      try { const r = await deleteAttendance(record.id); if (r.data.success) { setAlertDialog({ isOpen:true, title:'Success', message:'Record deleted successfully!', type:'success' }); fetchAttendance(); } else throw new Error(r.data.message); }
      catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: e.response?.data?.message || 'Delete failed.', type:'error' }); }
    },
  });

  const handleClearMonthlyAttendance = async (year, month) => {
    try {
      const response = await clearMonthlyAttendance(year, month);
      if (response.data.success) {
        setAlertDialog({ isOpen: true, title: 'Success', message: `Attendance records for ${month}/${year} cleared successfully`, type: 'success' });
        fetchAttendance();
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: response.data.message || 'Failed to clear attendance', type: 'error' });
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || 'Failed to clear attendance records', type: 'error' });
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
    <div className="flex h-screen bg-[#0E1320] dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">

          {/* ═══ HEADER ═══ */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Attendance Management</h1>
              <p className="text-sm text-[#94A3B8] mt-1.5 font-medium">Monitor and manage employee attendance.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => setClearDialog({ isOpen: true })} className="flex items-center gap-2 bg-[#1C2540] hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white hover:text-red-400 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-clay-admin">
                <FiTrash2 size={16} /> Clear
              </button>
              <button onClick={() => handleDownloadPDF('pdf')} className="flex items-center gap-2 bg-[#1C2540] hover:bg-red-500 border border-white/10 hover:border-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-clay-admin">
                <FiDownload size={16} /> PDF
              </button>
              <button onClick={() => handleDownloadPDF('excel')} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)]">
                <FiDownload size={16} /> Excel
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
              <div key={i} className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-4 shadow-clay-admin flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-2xl font-extrabold text-white">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.bg} ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
              </div>
            ))}
          </div>

          {/* ═══ FILTERS ═══ */}
          <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FiFilter size={14} className="text-blue-400" />
              </div>
              <h2 className="text-sm font-bold text-white">Filter Records</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Date</label>
                <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="admin-input py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Search ID</label>
                <input type="text" name="employee_id" value={filters.employee_id} onChange={handleFilterChange} placeholder="EMP-001" className="admin-input py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Department</label>
                <select name="department" value={filters.department || ''} onChange={handleFilterChange} className="admin-select py-2.5 text-sm text-[#94A3B8]">
                  <option value="">All Depts</option>
                  {[...new Set(attendance.map(a=>a.department))].filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Status</label>
                <select name="status" value={filters.status} onChange={handleFilterChange} className="admin-select py-2.5 text-sm text-[#94A3B8]">
                  <option value="">All Statuses</option>
                  <option value="Currently Working">Currently Working</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Work Type</label>
                <select name="is_wfh" value={filters.is_wfh || ''} onChange={handleFilterChange} className="admin-select py-2.5 text-sm text-[#94A3B8]">
                  <option value="">All Types</option>
                  <option value="false">Office</option>
                  <option value="true">WFH</option>
                </select>
              </div>
            </div>
          </div>

          {/* ═══ TABLE ═══ */}
          <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Spinner size={36} color="blue" />
                <p className="text-sm font-medium text-[#64748B] mt-4 animate-pulse">Loading records...</p>
              </div>
            ) : (
              <div className="overflow-x-auto dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-[#0E1320]/80">
                    <tr>{['Date','Emp ID','Name','Dept','Check In','Check Out','Hours','Late/Early','Status','Absent Reason','Type','Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {attendance.length > 0 ? attendance.map(r => (
                      <tr key={r.id} className="admin-table-row hover:bg-[#0B1120]/[0.02] transition-colors group">
                        <td className="px-5 py-4 text-xs font-semibold text-[#CBD5E1] whitespace-nowrap">{formatDate(r.attendance_date)}</td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8] font-mono whitespace-nowrap">{r.emp_id}</td>
                        <td className="px-5 py-4 text-sm font-bold text-white whitespace-nowrap">{r.name}</td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8] whitespace-nowrap">{r.department}</td>
                        <td className="px-5 py-4 text-xs text-[#CBD5E1] font-mono whitespace-nowrap">{formatTime(r.login_time)}</td>
                        <td className="px-5 py-4 text-xs text-[#CBD5E1] font-mono whitespace-nowrap">
                          {formatTime(r.logout_time) || '—'}
                          {r.is_auto_checkout && r.logout_time && <span className="block text-[10px] text-amber-500/80 font-bold mt-0.5">(Auto)</span>}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#CBD5E1] font-mono whitespace-nowrap">{r.logout_time ? formatWorkingHours(parseFloat(r.total_working_hours)) : '—'}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {(() => {
                            const isLate = r.late_minutes > 0;
                            const isEarly = r.early_minutes > 0;
                            const isLateStatus = r.checkin_status === 'late' || String(r.attendance_status || '').toLowerCase() === 'late';
                            
                            if (isLate && isEarly) {
                              return (
                                <>
                                  <span className="block text-[10px] text-amber-500 font-bold">Late: {r.late_minutes}m</span>
                                  <span className="block text-[10px] text-purple-400 font-bold">Early: {r.early_minutes}m</span>
                                </>
                              );
                            }
                            if (isLate) return <span className="block text-[10px] text-amber-500 font-bold">Late: {r.late_minutes}m</span>;
                            if (isEarly) return <span className="block text-[10px] text-purple-400 font-bold">Early: {r.early_minutes}m</span>;
                            if (isLateStatus) return <span className="block text-[10px] text-amber-500 font-bold">Late</span>;
                            if (r.login_time) return <span className="text-[10px] text-emerald-400 font-bold">On Time</span>;
                            return <span className="text-[10px] text-[#64748B]">—</span>;
                          })()}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={r.attendance_status || 'Absent'} dark />
                            {r.validation_method === 'Manual' && (
                              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full">Manual</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-[#CBD5E1] whitespace-nowrap">
                          {r.attendance_status === 'Absent' ? (r.absent_reason || '—') : '—'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {r.is_wfh ? <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-full">WFH</span> : <span className="text-xs text-[#475569] font-medium">Office</span>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                            {r.login_time && (
                              <button onClick={() => handleResetAttendance(r, 'check-in')} title="Reset Check-In" className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-500 bg-[#1C2540] border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all shadow-sm"><FiRotateCcw size={14} /></button>
                            )}
                            {r.logout_time && (
                              <button onClick={() => handleResetAttendance(r, 'check-out')} title="Reset Check-Out" className="w-8 h-8 rounded-xl flex items-center justify-center text-blue-400 bg-[#1C2540] border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 transition-all shadow-sm"><FiRefreshCw size={14} /></button>
                            )}
                            <button onClick={() => handleDeleteAttendance(r)} title="Delete Record" className="w-8 h-8 rounded-xl flex items-center justify-center text-red-500 bg-[#1C2540] border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 transition-all shadow-sm"><FiTrash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={10} className="px-5 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-[#0B1120]/[0.02] flex items-center justify-center">
                            <FiCalendar size={28} className="text-[#475569]" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#94A3B8]">No records found</p>
                            <p className="text-xs font-medium text-[#64748B] mt-1">Try adjusting your filters</p>
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ DIALOGS ═══ */}
      {showDownloadDialog && (
        <div className="fixed inset-0 bg-[#0E1320]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#161D2E] border border-white/[0.08] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.4)] w-full max-w-sm animate-scale-in overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-[#1C2540]/30">
              <h2 className="text-sm font-bold text-white">Download Attendance</h2>
              <button onClick={() => setShowDownloadDialog(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:bg-[#0B1120]/5 hover:text-white transition-colors"><FiX size={16} /></button>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Month (1–12)</label>
                <input type="number" min="1" max="12" value={downloadData.month} onChange={e => setDownloadData(d => ({ ...d, month: e.target.value }))} placeholder="1–12" className="admin-input py-2.5" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Year</label>
                <input type="number" min="2020" max="2030" value={downloadData.year} onChange={e => setDownloadData(d => ({ ...d, year: e.target.value }))} placeholder="e.g. 2026" className="admin-input py-2.5" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-5 border-t border-white/[0.06] bg-[#1C2540]/30">
              <button onClick={() => setShowDownloadDialog(false)} className="flex-1 px-4 py-2.5 text-sm font-bold text-[#94A3B8] border border-white/10 rounded-xl hover:bg-[#0B1120]/5 transition-colors">Cancel</button>
              <button onClick={downloadMatrix} className={`flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all duration-200 ${downloadFormat === 'pdf' ? 'bg-red-600 hover:bg-red-500 shadow-[0_4px_16px_rgba(220,38,38,0.2)]' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.2)]'}`}>
                Download {downloadFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(d => ({ ...d, isOpen:false })); }} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.type === 'danger' ? 'Delete' : 'Confirm'} />
      <AlertDialog   isOpen={alertDialog.isOpen}   onClose={() => setAlertDialog(d => ({ ...d, isOpen:false }))}   title={alertDialog.title}   message={alertDialog.message}   type={alertDialog.type} />
      <ClearDataDialog isOpen={clearDialog.isOpen} onClose={() => setClearDialog({ isOpen: false })} onConfirm={handleClearMonthlyAttendance} title="Clear Monthly Attendance" message="⚠️ WARNING: This will permanently delete ALL attendance records for the selected month and year. This action cannot be undone." confirmText="delete this month attendance" type="attendance" />
    </div>
  );
};
export default AdminAttendance;
