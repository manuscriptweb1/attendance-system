import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import { Spinner } from '../components/Loader';
import api, { getMonthlyAttendanceReport, exportMonthlyAttendanceReport } from '../services/api';
import { FiDownload, FiFileText, FiRefreshCw } from 'react-icons/fi';

const AdminReports = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      const res = await getMonthlyAttendanceReport(month, year);
      if (res.data.success) {
        setReportData(res.data.reports || res.data.report || []);
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to generate report', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportMonthlyAttendanceReport(month, year);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; 
      link.download = `Attendance_Report_${month}_${year}.xlsx`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to export report', type: 'error' });
    }
  };

  return (
    <div className="flex h-screen bg-[#0E1320] dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Reports Central</h1>
              <p className="text-sm text-[#94A3B8] mt-1.5 font-medium">Generate and download comprehensive HR reports.</p>
            </div>
          </div>

          {/* Report Generator Box */}
          <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-6 mb-6 shadow-clay-admin animate-fadeInUp stagger-2 max-w-3xl">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FiFileText className="text-blue-400" /> Monthly Attendance Report
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Month</label>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="admin-select py-2.5 text-sm text-[#94A3B8]">
                  {[...Array(12).keys()].map(m => (
                    <option key={m+1} value={m+1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Year</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="admin-select py-2.5 text-sm text-[#94A3B8]">
                  {[...Array(5).keys()].map(y => {
                    const yearVal = new Date().getFullYear() - 2 + y;
                    return <option key={yearVal} value={yearVal}>{yearVal}</option>
                  })}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleGenerateReport} disabled={loading} className="flex items-center gap-2 bg-[#1C2540] hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border border-white/10 shadow-sm disabled:opacity-50">
                  <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Generating...' : 'Generate'}
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)]">
                  <FiDownload size={16} /> Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* Preview Table */}
          {reportData && (
            <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-3">
              <div className="p-4 border-b border-white/10 bg-[#1C2540]/50 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Preview: {new Date(0, month-1).toLocaleString('default', { month: 'long' })} {year}</h3>
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">{reportData.length} Records</span>
              </div>
              <div className="overflow-x-auto dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-[#0E1320]/80">
                    <tr>{['Emp ID','Name','Department','Present','Absent','Half Day','Holiday','Late Count','Total Hours'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {reportData.map(r => (
                      <tr key={r.employeeCode} className="admin-table-row hover:bg-[#0B1120]/[0.02] transition-colors">
                        <td className="px-5 py-3.5 text-xs text-[#94A3B8] font-mono whitespace-nowrap">{r.employeeCode}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-white whitespace-nowrap">{r.employeeName}</td>
                        <td className="px-5 py-3.5 text-xs text-[#CBD5E1] whitespace-nowrap">{r.department}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-emerald-400 whitespace-nowrap">{r.present}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-red-400 whitespace-nowrap">{r.absent}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-yellow-500 whitespace-nowrap">{r.halfDay}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-blue-400 whitespace-nowrap">{r.holiday}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-amber-500 whitespace-nowrap">{r.lateCount}</td>
                        <td className="px-5 py-3.5 text-xs text-white whitespace-nowrap">{r.totalHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
    </div>
  );
};

export default AdminReports;
