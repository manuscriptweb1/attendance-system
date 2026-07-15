import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';

import { getReportSnapshot, generateMonthlyAttendanceReport, exportMonthlyAttendanceReport } from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';
import { validateMonthYear } from '../utils/dateValidation';
import { FiDownload, FiFileText, FiRefreshCw } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sortEmployeeRows } from '../utils/sorting';
import { getAttendanceStatusClass } from '../utils/attendanceStatusStyles';
import ClearDataModal from '../components/ClearDataModal';
import { clearDataByDate } from '../services/api';

const AdminReports = () => {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
  const [absentTable, setAbsentTable] = useState(null);
  const [holidayTable, setHolidayTable] = useState(null);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [sortBy, setSortBy] = useState('name_asc');

  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" }
  ];

  const sortOptions = [
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" }
  ];

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - 2 + i);
    }
    return years;
  };
  const yearOptions = generateYearOptions();
  
  const [treatLateAsPresent, setTreatLateAsPresent] = useState(false);
  const [hideActualLateTime, setHideActualLateTime] = useState(true);

  const formatLateTime = (minutes) => {
    const total = Number(minutes || 0);
    if (!total || total <= 0) return "-";
  
    const hours = Math.floor(total / 60);
    const mins = total % 60;
  
    if (hours <= 0) return `${mins} min`;
    return `${hours}h ${String(mins).padStart(2, "0")}m`;
  };

  const getReportDisplayStatus = (status) => {
    if (treatLateAsPresent && status === 'L') {
      return 'P';
    }
    return status;
  };
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  React.useEffect(() => {
    fetchSnapshot(month, year);
  }, [month, year]);

  const fetchSnapshot = async (m, y) => {
    try {
      setLoading(true);
      const res = await getReportSnapshot(m, y);
      if (res.data.success && !res.data.notFound) {
        setReportData(res.data.reports || []);
        setMatrixData(res.data.dailyAttendanceMatrix || null);
        setAbsentTable(res.data.absentTable || []);
        setHolidayTable(res.data.holidayTable || []);
      } else {
        setReportData(null);
        setMatrixData(null);
        setAbsentTable(null);
        setHolidayTable(null);
      }
    } catch (e) {
      setReportData(null);
      setMatrixData(null);
      setAbsentTable(null);
      setHolidayTable(null);
    } finally {
      setLoading(false);
    }
  };



  const handleExportPDF = async () => {
    if (!matrixData || !reportData) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Please generate a report first.', type: 'error' });
      return;
    }
    
    // Load image
    const logoUrl = `${window.location.origin}/favicon/web-app-manifest-192x192.png`;
    const imgData = await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 15;

    // Header
    if (imgData) {
      doc.addImage(imgData, 'PNG', pageWidth / 2 - 45, currentY - 6, 12, 12);
      doc.setFontSize(16);
      doc.text("Manuscript Technomedia LLP", pageWidth / 2 - 28, currentY + 3);
      currentY += 15;
    } else {
      doc.setFontSize(16);
      doc.text("Manuscript Technomedia LLP", pageWidth / 2, currentY, { align: "center" });
      currentY += 10;
    }

    doc.setFontSize(14);
    doc.text("ATTENDANCE REPORT", pageWidth / 2, currentY, { align: "center" });
    currentY += 8;
    
    doc.setFontSize(11);
    doc.text(`For the month of ${new Date(0, month-1).toLocaleString('default', { month: 'long' })} ${year}`, pageWidth / 2, currentY, { align: "center" });
    currentY += 5;
    
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 10;

    // Report Summary Table
    const summaryHead = [['Emp ID','Name','Department','Present','Absent','Half Day','Holiday','Late Count','Counted Late Time','Total Permission Time','Counted Late + Permission Time','Total Hours']];
    const summaryBody = sortEmployeeRows(reportData, sortBy).map(r => {
      const rawTotalHours = r.totalHours ?? r.total_hours ?? r.totalWorkingHours ?? r.total_working_hours ?? r.workingHours ?? r.working_hours ?? 0;
      const displayTotalHours = Number(rawTotalHours || 0);
      const hoursStr = displayTotalHours % 1 === 0 ? displayTotalHours.toString() : displayTotalHours.toFixed(1);
      const countedLate = Number(r.totalCountedLateMinutes || 0);
      const permTime = Number(r.totalPermissionMinutes || 0);
      return [r.employeeCode, r.employeeName, r.department, r.present, r.absent, r.halfDay, r.holiday, r.lateCount, formatLateTime(countedLate), formatLateTime(permTime), formatLateTime(countedLate + permTime), hoursStr];
    });

    autoTable(doc, {
      startY: currentY,
      head: summaryHead,
      body: summaryBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' }, 2: { halign: 'left' } },
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // Daily Attendance Matrix
    doc.setFontSize(12);
    doc.text("Daily Attendance Matrix", 14, currentY);
    currentY += 5;

    const sortedMatrix = [...matrixData.employees].sort((a, b) => a.name.localeCompare(b.name));
    const matrixHead = [['Employee', ...matrixData.days.map(d => String(d))]];
    const matrixBody = sortedMatrix.map(emp => {
      const row = [emp.name];
      matrixData.days.forEach(d => {
        row.push(emp.days[d] || '-');
      });
      return row;
    });

    autoTable(doc, {
      startY: currentY,
      head: matrixHead,
      body: matrixBody,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index > 0) {
          const val = data.cell.raw;
          if (val === 'P') data.cell.styles.textColor = [16, 185, 129];
          else if (val === 'A') data.cell.styles.textColor = [239, 68, 68];
          else if (val === 'HD') data.cell.styles.textColor = [245, 158, 11];
          else if (val === 'S') data.cell.styles.textColor = [100, 116, 139];
          else if (val === 'OH') data.cell.styles.textColor = [59, 130, 246];
          else if (val === 'GH') data.cell.styles.textColor = [168, 85, 247];
          else if (val === 'L') data.cell.styles.textColor = [249, 115, 22];
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 5;
    
    // Legend
    doc.setFontSize(9);
    doc.text("Legend: P - Present, A - Absent, HD - Half Day, S - Sunday, OH - Office Holiday, GH - Government Holiday, L - Late", 14, currentY + 5);

    currentY += 20;

    // Absent Table
    if (absentTable && absentTable.length > 0) {
      doc.setFontSize(12);
      doc.text("Employee Absent Details", 14, currentY);
      
      const absentHead = [['S.No', 'Employee ID', 'Employee Name', 'Date', 'Absent Reason']];
      const absentBody = absentTable.map((a, i) => [
        i + 1,
        a.employeeId,
        a.employeeName,
        new Date(a.date).toLocaleDateString(),
        a.reason
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: absentHead,
        body: absentBody,
        theme: 'grid',
        styles: { fontSize: 8 }
      });
      currentY = doc.lastAutoTable.finalY + 15;
    }

    // Holiday Table
    if (holidayTable && holidayTable.length > 0) {
      doc.setFontSize(12);
      doc.text("Holiday Details", 14, currentY);
      
      const holidayHead = [['S.No', 'Holiday Date', 'Holiday Type', 'Holiday Name', 'Notes']];
      const holidayBody = holidayTable.map((h, i) => [
        i + 1,
        new Date(h.date).toLocaleDateString(),
        h.type,
        h.name,
        h.notes
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: holidayHead,
        body: holidayBody,
        theme: 'grid',
        styles: { fontSize: 8 }
      });
    }

    doc.save(`Attendance_Matrix_${month}_${year}.pdf`);
  };

  const handleGenerateReport = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      const res = await generateMonthlyAttendanceReport(month, year);
      if (res.data.success) {
        setToastConfig({ message: 'Report generated successfully', type: 'success' });
        fetchSnapshot(month, year);
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: res.data.message || 'Failed to generate report', type: 'error' });
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async ({ fromDate, toDate }) => {
    try {
      setClearing(true);
      const res = await clearDataByDate('reports', { fromDate, toDate, confirmation: 'DELETE' });
      if (res.data.success) {
        setToastConfig({ message: res.data.message || 'Data cleared successfully', type: 'success' });
        setShowClearModal(false);
        fetchSnapshot(month, year);
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: res.data.message || 'Failed to clear data', type: 'error' });
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    } finally {
      setClearing(false);
    }
  };

  const handleExport = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      return;
    }

    try {
      const res = await exportMonthlyAttendanceReport(month, year);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; 
      link.download = `Attendance_Report_${month}_${year}.xlsx`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    }
  };

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight">Reports Central</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Generate and download comprehensive HR reports.</p>
            </div>
          </div>

          {/* Report Generator Box */}
          <div className="bg-admin-modal text-admin-modal-text border border-admin-border rounded-2xl p-6 mb-6 shadow-clay-admin animate-fadeInUp stagger-2 w-full">
            <h2 className="text-sm font-bold text-admin-text mb-4 flex items-center gap-2">
              <FiFileText className="text-blue-400" /> Monthly Attendance Report
            </h2>
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Month</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="admin-select report-filter-select w-full py-2.5 text-sm font-semibold">
                  {monthOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Year</label>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="admin-select report-filter-select w-full py-2.5 text-sm font-semibold">
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Sort By</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="admin-select report-filter-select w-full py-2.5 text-sm font-semibold cursor-pointer">
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 lg:mt-0">
                {hasPermission('reports', 'can_calculate') && (
                  <button onClick={handleGenerateReport} disabled={loading} className="flex items-center gap-2 bg-admin-elevated hover:bg-white/10 text-admin-text px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border border-admin-border shadow-sm disabled:opacity-50">
                    <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Generating...' : 'Generate'}
                  </button>
                )}
                {hasPermission('reports', 'can_export') && (
                  <>
                    <button onClick={handleExport} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)]">
                      <FiDownload size={16} /> Export Excel
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(239,68,68,0.2)]">
                      <FiDownload size={16} /> Download PDF
                    </button>
                  </>
                )}
                {hasPermission('reports', 'can_clear') && (
                  <button onClick={() => setShowClearModal(true)} className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
                    Clear Data
                  </button>
                )}
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-admin-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={treatLateAsPresent}
                      onChange={(e) => setTreatLateAsPresent(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                  </label>
                  <div>
                    <div className="text-sm font-bold text-admin-text">HR View: Treat Late as Present</div>
                    <div className="text-xs text-admin-muted">Late entries are shown as Present in this report view only.</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={hideActualLateTime}
                      onChange={(e) => setHideActualLateTime(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                  </label>
                  <div>
                    <div className="text-sm font-bold text-admin-text">Hide Actual Late Time</div>
                    <div className="text-xs text-admin-muted">Hides actual late time from the preview table. Counted late time remains visible.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {treatLateAsPresent && reportData && (
            <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
              <div className="text-blue-500 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                HR View is enabled: Late entries are displayed as Present on this page only. PDF/Excel exports and database records remain unchanged.
              </p>
            </div>
          )}

          {/* Preview Table */}
          {reportData && (
            <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-3">
              <div className="p-4 border-b border-admin-border bg-admin-elevated flex justify-between items-center">
                <h3 className="text-xs font-bold text-admin-text uppercase tracking-wider">Preview: {new Date(0, month-1).toLocaleString('default', { month: 'long' })} {year}</h3>
                <span className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest">{reportData.length} Records</span>
              </div>
              <div className="table-responsive dark-scroll">
                <table className="reports-summary-table min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg">
                    <tr>
                      <th style={{ width: '70px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Emp ID</th>
                      <th style={{ width: '140px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Name</th>
                      <th style={{ width: '110px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Department</th>
                      <th style={{ width: '60px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Present</th>
                      <th style={{ width: '60px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Absent</th>
                      <th style={{ width: '70px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Half Day</th>
                      <th style={{ width: '60px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Holiday</th>
                      <th style={{ width: '70px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Late Count</th>
                      {!hideActualLateTime && <th style={{ width: '100px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Actual Late Time</th>}
                      <th style={{ width: '100px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Counted Late Time</th>
                      <th style={{ width: '110px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Total Permission Time</th>
                      <th style={{ width: '120px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Counted Late + Permission Time</th>
                      <th style={{ width: '80px' }} className="text-left font-bold text-admin-secondary uppercase tracking-wider">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(() => {
                      const sortedData = sortEmployeeRows(reportData, sortBy);
                      return sortedData.map(r => {
                        const displayPresent = treatLateAsPresent ? (r.present + (r.lateCount || 0)) : r.present;
                        const displayLateCount = (treatLateAsPresent && r.lateCount > 0) ? '-' : r.lateCount;
                        
                        return (
                        <tr key={r.employeeCode} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors">
                        <td className="text-admin-muted font-mono">{r.employeeCode}</td>
                        <td className="employee-name-cell text-admin-text">{r.employeeName}</td>
                        <td className="text-admin-secondary">{r.department}</td>
                        <td className="font-bold text-emerald-400">{displayPresent}</td>
                        <td className="font-bold text-red-400">{r.absent}</td>
                        <td className="font-bold text-yellow-500">{r.halfDay}</td>
                        <td className="font-bold text-blue-400">{r.holiday}</td>
                        <td className="font-bold text-amber-500">{displayLateCount}</td>
                        {!hideActualLateTime && (
                          <td className="font-bold text-amber-600">{formatLateTime(r.totalActualLateMinutes !== undefined ? r.totalActualLateMinutes : r.totalLateMinutes)}</td>
                        )}
                        <td className="font-bold text-orange-500">{formatLateTime(r.totalCountedLateMinutes)}</td>
                        <td className="font-bold text-indigo-400">{formatLateTime(r.totalPermissionMinutes)}</td>
                        <td className="font-bold text-rose-500">{formatLateTime(r.countedLateAndPermissionMinutes)}</td>
                        <td className="text-admin-text">
                          {(() => {
                            const rawTotalHours = r.totalHours ?? r.total_hours ?? r.totalWorkingHours ?? r.total_working_hours ?? r.workingHours ?? r.working_hours ?? 0;
                            const displayTotalHours = Number(rawTotalHours || 0);
                            return displayTotalHours % 1 === 0 ? displayTotalHours.toString() : displayTotalHours.toFixed(1);
                          })()}
                        </td>
                      </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily Attendance Matrix */}
          {matrixData && matrixData.days && (
            <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4 mt-6">
              <div className="p-4 border-b border-admin-border bg-admin-elevated flex justify-between items-center">
                <h3 className="text-xs font-bold text-admin-text uppercase tracking-wider">Daily Attendance</h3>
              </div>
              <div className="table-responsive dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg">
                    <tr>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap sticky left-0 bg-admin-bg z-10">Employee</th>
                      {matrixData.days.map(d => (
                        <th key={d} className="px-2 py-4 text-center text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(() => {
                      const sortedMatrix = [...matrixData.employees].sort((a, b) => a.name.localeCompare(b.name));
                      return sortedMatrix.map((emp, i) => (
                        <tr key={i} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors">
                          <td className="px-5 py-3.5 text-xs font-bold text-admin-text whitespace-nowrap sticky left-0 bg-admin-surface z-10 border-r border-admin-border/50">
                            {emp.name}
                          </td>
                          {matrixData.days.map(d => {
                            const originalCode = emp.days[d];
                            const displayCode = getReportDisplayStatus(originalCode);
                            return (
                              <td key={d} className="px-2 py-3.5 text-center whitespace-nowrap">
                                <span className={getAttendanceStatusClass(displayCode)}>
                                  {displayCode}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Report Legend */}
          {matrixData && (
            <div className="bg-admin-surface border border-admin-border rounded-2xl p-6 shadow-clay-admin animate-fadeInUp stagger-5 mt-6">
              <h3 className="text-xs font-bold text-admin-secondary uppercase tracking-wider mb-4">Report Legend</h3>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2"><span className={getAttendanceStatusClass('P')}>P</span> <span className="text-xs font-medium text-admin-text">Present</span></div>
                <div className="flex items-center gap-2"><span className={getAttendanceStatusClass('A')}>A</span> <span className="text-xs font-medium text-admin-text">Absent</span></div>
                <div className="flex items-center gap-2"><span className={getAttendanceStatusClass('HD')}>HD</span> <span className="text-xs font-medium text-admin-text">Half Day</span></div>
                <div className="flex items-center gap-2"><span className={getAttendanceStatusClass('S')}>S</span> <span className="text-xs font-medium text-admin-text">Sunday</span></div>
                <div className="flex items-center gap-2"><span className={getAttendanceStatusClass('OH')}>OH</span> <span className="text-xs font-medium text-admin-text">Office Holiday</span></div>
                <div className="flex items-center gap-2"><span className={getAttendanceStatusClass('GH')}>GH</span> <span className="text-xs font-medium text-admin-text">Government Holiday</span></div>
                {treatLateAsPresent ? (
                  <div className="flex items-center gap-2">
                    <span className={getAttendanceStatusClass('L')}>L</span> 
                    <span className="text-xs font-medium text-admin-text">Late (Shown as Present in HR View)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={getAttendanceStatusClass('L')}>L</span> 
                    <span className="text-xs font-medium text-admin-text">Late</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Absent Table */}
          {absentTable && absentTable.length > 0 && (
            <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4 mt-6">
              <div className="p-4 border-b border-admin-border bg-admin-elevated flex justify-between items-center">
                <h3 className="text-xs font-bold text-admin-text uppercase tracking-wider">Employee Absent Details</h3>
              </div>
              <div className="table-responsive dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg">
                    <tr>{['S.No', 'Employee ID', 'Employee Name', 'Date', 'Absent Reason'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {absentTable.map((a, i) => (
                      <tr key={i} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors">
                        <td className="px-5 py-3.5 text-xs text-admin-muted font-mono whitespace-nowrap">{i + 1}</td>
                        <td className="px-5 py-3.5 text-xs text-admin-muted font-mono whitespace-nowrap">{a.employeeId}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-admin-text whitespace-nowrap">{a.employeeName}</td>
                        <td className="px-5 py-3.5 text-xs text-admin-secondary whitespace-nowrap">{new Date(a.date).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5 text-xs text-admin-text whitespace-nowrap">{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Holiday Table */}
          {holidayTable && holidayTable.length > 0 && (
            <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4 mt-6">
              <div className="p-4 border-b border-admin-border bg-admin-elevated flex justify-between items-center">
                <h3 className="text-xs font-bold text-admin-text uppercase tracking-wider">Holiday Details</h3>
              </div>
              <div className="table-responsive dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg">
                    <tr>{['S.No', 'Holiday Date', 'Holiday Type', 'Holiday Name', 'Notes'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {holidayTable.map((h, i) => (
                      <tr key={i} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors">
                        <td className="px-5 py-3.5 text-xs text-admin-muted font-mono whitespace-nowrap">{i + 1}</td>
                        <td className="px-5 py-3.5 text-xs font-bold text-blue-400 whitespace-nowrap">{new Date(h.date).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5 text-xs text-admin-secondary whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${h.type.includes('Government') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                            {h.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-bold text-admin-text whitespace-nowrap">{h.name}</td>
                        <td className="px-5 py-3.5 text-xs text-admin-muted max-w-xs truncate">{h.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      <ClearDataModal 
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearData}
        loading={clearing}
        title="Clear Report Snapshots"
        description="This will permanently delete report snapshots between the selected dates. This action cannot be undone."
      />

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <AdminToast 
        message={toastConfig.message} 
        type={toastConfig.type} 
        onClose={() => setToastConfig({ message: '', type: 'success' })} 
      />
    </div>
  );
};

export default AdminReports;
