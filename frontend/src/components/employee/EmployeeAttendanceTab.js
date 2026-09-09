import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiHome,
  FiFilter,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiX
} from 'react-icons/fi';
import StatusBadge from '../ui/StatusBadge';
import { Spinner } from '../Loader';
import { getEmployeeAttendanceHistory } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import AdminToast from '../AdminToast';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatTimeDisplay = (timeVal) => {
  if (!timeVal) return null;
  const str = String(timeVal).trim();
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(str)) {
    return str.toUpperCase();
  }
  const d = new Date(timeVal);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return str;
};

const EmployeeAttendanceTab = ({ employeeId, employee }) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1 - 12

  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'error' });
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState({});

  // Dynamically generate available years up to the current year
  const availableYears = useMemo(() => {
    const list = [];
    for (let yr = 2023; yr <= currentYear; yr++) {
      list.push(yr);
    }
    return list;
  }, [currentYear]);

  // Strictly compute period statistics from attendance records
  const computedStats = useMemo(() => {
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let wfhDays = 0;
    let totalWorkingHours = 0;
    let totalLateMinutes = 0;

    for (const r of attendanceRecords) {
      const st = (r.attendance_status || '').trim();

      // 1. Present: ONLY records with Present or On Time status
      if (st === 'Present' || st === 'On Time') {
        presentDays++;
      } 
      // 2. Half Day: ONLY Half Day
      else if (st === 'Half Day') {
        halfDays++;
      } 
      // 3. Absent: Absent or Not Mention
      else if (st === 'Absent' || st === 'Not Mention') {
        absentDays++;
      }

      // 4. Late: Late status, Late Check-in, or late_minutes > 0
      if (st === 'Late' || st === 'Late Check-in' || (r.late_minutes && Number(r.late_minutes) > 0)) {
        lateDays++;
        totalLateMinutes += Number(r.late_minutes || 0);
      }

      // 5. Work From Home
      if (r.is_wfh || st === 'Work From Home' || st === 'WFH') {
        wfhDays++;
      }

      // 6. Total working hours
      const hrs = Number(r.total_working_hours ?? r.total_hours ?? 0);
      if (hrs > 0) {
        totalWorkingHours += hrs;
      }
    }

    const totalDaysRecorded = attendanceRecords.length;
    const avgWorkingHours = totalDaysRecorded > 0 ? Number((totalWorkingHours / totalDaysRecorded).toFixed(1)) : 0;
    
    // Percentage rate calculation: Present %, Half Day %, Absent % summing to 100% of countable days
    const countableDays = presentDays + halfDays + absentDays;
    let presentRate = 0;
    let halfDayRate = 0;
    let absentRate = 0;

    if (countableDays > 0) {
      presentRate = Math.round((presentDays / countableDays) * 100);
      halfDayRate = Math.round((halfDays / countableDays) * 100);
      absentRate = Math.max(0, 100 - presentRate - halfDayRate);
    }

    return {
      presentDays,
      lateDays,
      halfDays,
      absentDays,
      wfhDays,
      totalWorkingHours: Number(totalWorkingHours.toFixed(1)),
      avgWorkingHours,
      totalLateMinutes,
      countableDays,
      presentRate,
      halfDayRate,
      absentRate,
      attendanceRate: presentRate,
      totalDaysRecorded
    };
  }, [attendanceRecords]);

  // Use computed stats whenever attendance records are present, fallback to server stats
  const activeStats = attendanceRecords.length > 0 ? computedStats : (stats || {});

  // Sort records from month starting date (1st upwards)
  const displayRecords = useMemo(() => {
    return [...attendanceRecords].sort((a, b) => new Date(a.attendance_date) - new Date(b.attendance_date));
  }, [attendanceRecords]);

  // Resolve target identifier safely
  const effectiveId = employeeId || employee?.id || employee?.employee_id;

  const fetchAttendance = useCallback(async () => {
    if (!effectiveId) return;
    try {
      setLoading(true);
      setError(null);
      const params = {
        year: selectedYear,
        month: selectedMonth,
        status: statusFilter
      };
      const res = await getEmployeeAttendanceHistory(effectiveId, params);
      if (res.data?.success) {
        setAttendanceRecords(res.data.attendance || []);
        setStats(res.data.stats || {});
      } else {
        setError(res.data?.message || 'Failed to retrieve attendance logs');
      }
    } catch (err) {
      console.error('Error fetching employee attendance history:', err);
      setError(err.response?.data?.message || err.message || 'Error loading attendance history');
    } finally {
      setLoading(false);
    }
  }, [effectiveId, selectedYear, selectedMonth, statusFilter]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const isAtCurrentMonthAndYear = parseInt(selectedYear) === currentYear && parseInt(selectedMonth) === currentMonth;

  const handlePrevMonth = () => {
    let m = parseInt(selectedMonth) - 1;
    let y = parseInt(selectedYear);
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(String(m));
    setSelectedYear(String(y));
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonth) + 1;
    let y = parseInt(selectedYear);
    if (m > 12) {
      m = 1;
      y += 1;
    }
    // Block future months
    if (y > currentYear || (y === currentYear && m > currentMonth)) {
      setToastConfig({
        message: `Cannot navigate to future month (${MONTH_NAMES[m - 1]} ${y}). Attendance records are only available up to the current month.`,
        type: 'error'
      });
      return;
    }
    setSelectedMonth(String(m));
    setSelectedYear(String(y));
  };

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value);
    const yr = parseInt(selectedYear);
    // Block selecting a future month
    if (yr > currentYear || (yr === currentYear && newMonth > currentMonth)) {
      setToastConfig({
        message: `Cannot select ${MONTH_NAMES[newMonth - 1]} ${yr}. Future months are not allowed.`,
        type: 'error'
      });
      return;
    }
    setSelectedMonth(String(newMonth));
  };

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    const m = parseInt(selectedMonth);
    // Block selecting a future year
    if (newYear > currentYear) {
      setToastConfig({
        message: `Cannot select ${newYear}. Future years are not allowed.`,
        type: 'error'
      });
      return;
    }
    // If selecting current year and the currently active month is beyond current month, cap it
    if (newYear === currentYear && m > currentMonth) {
      setSelectedMonth(String(currentMonth));
      setToastConfig({
        message: `Adjusted month to ${MONTH_NAMES[currentMonth - 1]} because future months are not allowed.`,
        type: 'error'
      });
    }
    setSelectedYear(String(newYear));
  };

  return (
    <div className="space-y-5">
      {/* Toast Alert for Blocked Future Months */}
      <AdminToast
        message={toastConfig.message}
        type={toastConfig.type}
        duration={3500}
        onClose={() => setToastConfig({ message: '', type: 'error' })}
      />

      {/* Inline Warning Banner for Blocked Future Months */}
      {toastConfig.message && (
        <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3 shadow-sm animate-shake">
          <div className="flex items-center gap-2">
            <FiAlertCircle size={16} className="shrink-0 text-red-400" />
            <span className="font-semibold">{toastConfig.message}</span>
          </div>
          <button
            onClick={() => setToastConfig({ message: '', type: 'error' })}
            className="text-red-400 hover:text-red-200 transition-colors p-1"
          >
            <FiX size={14} />
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <FiAlertCircle size={18} className="shrink-0 text-red-400" />
            <div>
              <p className="font-bold">Unable to load attendance records</p>
              <p className="text-[11px] opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchAttendance}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 font-bold rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Period Selector Bar */}
      <div className="overflow-x-auto pb-1 max-w-full no-scrollbar">
        <div className="inline-flex items-center gap-2 sm:gap-2.5 bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border rounded-2xl p-2 pl-3 sm:pl-3.5 pr-5 sm:pr-6 shadow-clay-admin shrink-0">
          {/* 1. Month Navigation Stepper */}
          <div className="flex items-center bg-slate-100 dark:bg-admin-bg border border-slate-200 dark:border-admin-border rounded-xl p-1 shadow-sm shrink-0">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-admin-secondary hover:text-slate-900 dark:hover:text-admin-text hover:bg-white dark:hover:bg-admin-surface transition-colors cursor-pointer"
              title="Previous Month"
            >
              <FiChevronLeft size={16} />
            </button>

            <span className="px-3 text-xs font-bold text-slate-800 dark:text-admin-text whitespace-nowrap">
              {MONTH_NAMES[parseInt(selectedMonth) - 1]} {selectedYear}
            </span>

            <button
              onClick={handleNextMonth}
              disabled={isAtCurrentMonthAndYear}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isAtCurrentMonthAndYear
                  ? 'text-slate-400 dark:text-admin-muted/40 cursor-not-allowed opacity-50'
                  : 'text-slate-600 dark:text-admin-secondary hover:text-slate-900 dark:hover:text-admin-text hover:bg-white dark:hover:bg-admin-surface'
              }`}
              title={isAtCurrentMonthAndYear ? 'Cannot navigate to future month' : 'Next Month'}
            >
              <FiChevronRight size={16} />
            </button>
          </div>

          {/* 2. Month Dropdown (Without "All Months" option) */}
          <select
            value={selectedMonth}
            onChange={handleMonthChange}
            className="admin-input py-1.5 px-3 text-xs font-semibold max-w-[130px] shrink-0 cursor-pointer"
            aria-label="Select Month"
          >
            {MONTH_NAMES.map((name, idx) => {
              const mNum = idx + 1;
              const isFuture = parseInt(selectedYear) === currentYear && mNum > currentMonth;
              return (
                <option key={mNum} value={String(mNum)} disabled={isFuture}>
                  {name}{isFuture ? ' (Future)' : ''}
                </option>
              );
            })}
          </select>

          {/* 3. Year Dropdown (Without "All Years" option, only up to current year) */}
          <select
            value={selectedYear}
            onChange={handleYearChange}
            className="admin-input py-1.5 px-3 text-xs font-semibold max-w-[110px] shrink-0 cursor-pointer"
            aria-label="Select Year"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>{yr}</option>
            ))}
          </select>

          {/* 4. Status Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-admin-bg border border-slate-200 dark:border-admin-border rounded-xl px-2.5 py-0.5 shadow-sm shrink-0">
            <FiFilter size={13} className="text-slate-500 dark:text-admin-secondary shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-admin-text py-1 text-xs font-semibold focus:outline-none cursor-pointer"
              aria-label="Filter Attendance Status"
            >
              <option value="all">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late Arrivals</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
              <option value="Work From Home">Work From Home</option>
            </select>
          </div>

          {/* 5. Quick Reset Filter Button */}
          {(parseInt(selectedMonth) !== currentMonth || parseInt(selectedYear) !== currentYear || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedMonth(String(currentMonth));
                setSelectedYear(String(currentYear));
                setStatusFilter('all');
              }}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 px-2.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="Reset all filters to current month"
            >
              Reset Filters
            </button>
          )}

          {/* Subtle separator */}
          <div className="h-5 w-px bg-slate-200 dark:bg-admin-border shrink-0 mx-1" />

          {/* 6. Refresh Button */}
          <button
            onClick={fetchAttendance}
            disabled={loading}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-admin-bg dark:hover:bg-admin-elevated border border-slate-200 dark:border-admin-border text-slate-600 dark:text-admin-secondary hover:text-slate-900 dark:hover:text-admin-text transition-all active:scale-95 cursor-pointer shadow-sm shrink-0 flex items-center justify-center"
            title="Refresh Attendance Table"
          >
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Period KPI Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Present Days */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-admin-surface border border-emerald-300/80 dark:border-emerald-500/30 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Present</span>
              <FiCheckCircle size={15} />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{activeStats.presentDays ?? 0}</p>
          </div>
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-extrabold text-[11px] border border-emerald-300/70 dark:border-emerald-500/40">
              {activeStats.presentRate ?? activeStats.attendanceRate ?? 0}% Rate
            </span>
          </div>
        </div>

        {/* Late Days */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-admin-surface border border-amber-300/80 dark:border-amber-500/30 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Late Arrivals</span>
              <FiClock size={15} />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{activeStats.lateDays ?? 0}</p>
          </div>
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 font-extrabold text-[11px] border border-amber-300/70 dark:border-amber-500/40 font-mono" title={`${activeStats.totalLateMinutes ?? 0} total minutes late`}>
              {activeStats.totalLateMinutes ? `${activeStats.totalLateMinutes} mins total` : '0 mins total'}
            </span>
          </div>
        </div>

        {/* Half Days */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-admin-surface border border-purple-300/80 dark:border-purple-500/30 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Half Days</span>
              <FiClock size={15} />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{activeStats.halfDays ?? 0}</p>
          </div>
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 font-extrabold text-[11px] border border-purple-300/70 dark:border-purple-500/40">
              {activeStats.halfDayRate ?? 0}% Rate
            </span>
          </div>
        </div>

        {/* Absent Days */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-admin-surface border border-red-300/80 dark:border-red-500/30 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-red-700 dark:text-red-400 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Absent</span>
              <FiAlertCircle size={15} />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{activeStats.absentDays ?? 0}</p>
          </div>
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 rounded-md bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200 font-extrabold text-[11px] border border-red-300/70 dark:border-red-500/40">
              {activeStats.absentRate ?? 0}% Rate
            </span>
          </div>
        </div>

        {/* WFH Days */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-admin-surface border border-blue-300/80 dark:border-blue-500/30 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">WFH</span>
              <FiHome size={15} />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{activeStats.wfhDays ?? 0}</p>
          </div>
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 font-extrabold text-[11px] border border-blue-300/70 dark:border-blue-500/40">
              Remote days
            </span>
          </div>
        </div>

        {/* Total Working Hours */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-admin-surface border border-cyan-300/80 dark:border-cyan-500/30 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-cyan-800 dark:text-cyan-400 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Hours Logged</span>
              <FiClock size={15} />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{activeStats.totalWorkingHours ?? 0}</p>
          </div>
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200 font-extrabold text-[11px] border border-cyan-300/70 dark:border-cyan-500/40 font-mono">
              Avg: {activeStats.avgWorkingHours ?? 0}h/day
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Attendance Records Table */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Spinner size="md" />
            <p className="text-xs text-admin-secondary mt-2">Loading attendance logs...</p>
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FiCalendar size={32} className="text-admin-muted mx-auto" />
            <div>
              <p className="text-sm font-bold text-admin-text">No attendance logs found</p>
              <p className="text-xs text-admin-secondary mt-1">
                No records found for {MONTH_NAMES[parseInt(selectedMonth) - 1]} {selectedYear}.
              </p>
            </div>
          </div>
        ) : (
          <div className="table-responsive overflow-y-auto max-h-[500px] dark-scroll relative">
            <table className="min-w-full divide-y divide-white/[0.04]">
              <thead className="bg-admin-bg sticky top-0 z-10 shadow-sm">
                <tr>
                  {['Date', 'Check-In', 'Check-Out', 'Working Hours', 'Status', 'Special Flags', 'Remarks / Excuse'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 z-10">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {displayRecords.map((record) => {
                  const isLate = record.attendance_status === 'Late' || record.attendance_status === 'Late Check-in' || (record.late_minutes && Number(record.late_minutes) > 0);
                  const isEarlyCO = record.early_minutes && Number(record.early_minutes) > 0;
                  const inTime = formatTimeDisplay(record.check_in_time || record.login_time);
                  const outTime = formatTimeDisplay(record.check_out_time || record.logout_time);

                  return (
                    <tr key={record.id} className="admin-table-row hover:bg-admin-elevated/40 transition-colors">
                      {/* Attendance Date */}
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-admin-text">
                        <div className="flex items-center gap-2">
                          <FiCalendar size={13} className="text-blue-400 shrink-0" />
                          <span>{formatDate(record.attendance_date)}</span>
                        </div>
                      </td>

                      {/* Check-in */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {inTime ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-admin-text">{inTime}</span>
                            {isLate && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold" title={`Late by ${record.late_minutes || 0} minutes`}>
                                +{record.late_minutes || 0}m
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-admin-muted font-mono">—</span>
                        )}
                      </td>

                      {/* Check-out */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {outTime ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-admin-text">{outTime}</span>
                            {isEarlyCO && (
                              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[10px] font-bold" title={`Early by ${record.early_minutes || 0} minutes`}>
                                -{record.early_minutes || 0}m
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-admin-muted font-mono">—</span>
                        )}
                      </td>

                      {/* Total Working Hours */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        {record.total_working_hours ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-admin-text">{Number(record.total_working_hours).toFixed(1)} hrs</span>
                            <div className="w-16 h-1.5 bg-admin-bg rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(100, (Number(record.total_working_hours) / 9) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-admin-muted">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={record.attendance_status || 'Not Mention'} dark />
                      </td>

                      {/* Special Flags */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {record.is_wfh && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 text-[10px] font-bold border border-blue-500/25">
                              WFH
                            </span>
                          )}
                          {record.is_auto_checkout && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[10px] font-bold border border-purple-500/25">
                              Auto CO
                            </span>
                          )}
                          {record.is_manual_entry && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold border border-amber-500/25">
                              Manual
                            </span>
                          )}
                          {!record.is_wfh && !record.is_auto_checkout && !record.is_manual_entry && (
                            <span className="text-admin-muted text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Remarks / Absent Reason */}
                      <td className="px-4 py-3 text-xs max-w-xs truncate text-admin-secondary" title={record.remarks || record.absent_reason || ''}>
                        {record.remarks || record.absent_reason ? (
                          <span className={record.attendance_status === 'Holiday' ? 'text-purple-400 font-semibold' : record.attendance_status === 'Sunday' ? 'text-slate-400 font-semibold' : 'text-amber-300 font-semibold'}>
                            {record.remarks || record.absent_reason}
                          </span>
                        ) : (
                          <span className="text-admin-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeAttendanceTab;
