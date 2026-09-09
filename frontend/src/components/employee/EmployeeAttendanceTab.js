import React, { useState, useEffect, useCallback } from 'react';
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiHome,
  FiFilter,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import StatusBadge from '../ui/StatusBadge';
import { Spinner } from '../Loader';
import { getEmployeeAttendanceHistory } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EmployeeAttendanceTab = ({ employeeId }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState({});

  const fetchAttendance = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const params = {
        year: selectedYear,
        month: selectedMonth,
        status: statusFilter
      };
      const res = await getEmployeeAttendanceHistory(employeeId, params);
      if (res.data?.success) {
        setAttendanceRecords(res.data.attendance || []);
        setStats(res.data.stats || {});
      }
    } catch (err) {
      console.error('Error fetching employee attendance history:', err);
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedYear, selectedMonth, statusFilter]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handlePrevMonth = () => {
    if (selectedMonth === 'all') return;
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
    if (selectedMonth === 'all') return;
    let m = parseInt(selectedMonth) + 1;
    let y = parseInt(selectedYear);
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(String(m));
    setSelectedYear(String(y));
  };

  return (
    <div className="space-y-5">
      {/* Filter and Period Selector Bar */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 sm:p-5 shadow-clay-admin flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Month Navigation & Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-admin-bg border border-admin-border rounded-xl p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              disabled={selectedMonth === 'all'}
              className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-surface disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <FiChevronLeft size={16} />
            </button>

            <span className="px-3 text-xs font-bold text-admin-text">
              {selectedMonth !== 'all' ? `${MONTH_NAMES[parseInt(selectedMonth) - 1]} ${selectedYear}` : `All Months (${selectedYear})`}
            </span>

            <button
              onClick={handleNextMonth}
              disabled={selectedMonth === 'all'}
              className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-surface disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Month"
            >
              <FiChevronRight size={16} />
            </button>
          </div>

          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="admin-input py-1.5 px-3 text-xs font-semibold max-w-[140px] cursor-pointer"
            aria-label="Select Month"
          >
            <option value="all">All Months</option>
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={String(idx + 1)}>{name}</option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="admin-input py-1.5 px-3 text-xs font-semibold max-w-[100px] cursor-pointer"
            aria-label="Select Year"
          >
            <option value="all">All Years</option>
            {[2024, 2025, 2026, 2027].map((yr) => (
              <option key={yr} value={String(yr)}>{yr}</option>
            ))}
          </select>
        </div>

        {/* Status Filter Dropdown & Refresh */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FiFilter size={14} className="text-admin-secondary" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-input py-1.5 px-3 text-xs font-semibold max-w-[150px] cursor-pointer"
              aria-label="Filter Attendance Status"
            >
              <option value="all">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late Check-in">Late</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
              <option value="Work From Home">Work From Home</option>
            </select>
          </div>

          <button
            onClick={fetchAttendance}
            disabled={loading}
            className="p-2 rounded-xl bg-admin-bg hover:bg-admin-elevated border border-admin-border text-admin-secondary hover:text-admin-text transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Refresh Attendance Table"
          >
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Period KPI Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Present Days */}
        <div className="p-3.5 rounded-xl bg-admin-surface border border-admin-border shadow-sm">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">Present</span>
            <FiCheckCircle size={14} />
          </div>
          <p className="text-lg font-black text-admin-text">{stats.presentDays ?? 0}</p>
          <span className="text-[10px] text-emerald-400/80 font-semibold">{stats.attendanceRate ?? 0}% Rate</span>
        </div>

        {/* Late Days */}
        <div className="p-3.5 rounded-xl bg-admin-surface border border-admin-border shadow-sm">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">Late Arrivals</span>
            <FiClock size={14} />
          </div>
          <p className="text-lg font-black text-admin-text">{stats.lateDays ?? 0}</p>
          <span className="text-[10px] text-amber-400/80 font-mono">{stats.totalLateMinutes ?? 0} mins total</span>
        </div>

        {/* Half Days */}
        <div className="p-3.5 rounded-xl bg-admin-surface border border-admin-border shadow-sm">
          <div className="flex items-center justify-between text-purple-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">Half Days</span>
            <FiClock size={14} />
          </div>
          <p className="text-lg font-black text-admin-text">{stats.halfDays ?? 0}</p>
          <span className="text-[10px] text-admin-muted font-medium">0.5 day credit</span>
        </div>

        {/* Absent Days */}
        <div className="p-3.5 rounded-xl bg-admin-surface border border-admin-border shadow-sm">
          <div className="flex items-center justify-between text-red-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">Absent</span>
            <FiAlertCircle size={14} />
          </div>
          <p className="text-lg font-black text-admin-text">{stats.absentDays ?? 0}</p>
          <span className="text-[10px] text-red-400/80 font-medium">Unexcused / Leave</span>
        </div>

        {/* WFH Days */}
        <div className="p-3.5 rounded-xl bg-admin-surface border border-admin-border shadow-sm">
          <div className="flex items-center justify-between text-blue-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">WFH</span>
            <FiHome size={14} />
          </div>
          <p className="text-lg font-black text-admin-text">{stats.wfhDays ?? 0}</p>
          <span className="text-[10px] text-blue-400/80 font-medium">Remote days</span>
        </div>

        {/* Total Working Hours */}
        <div className="p-3.5 rounded-xl bg-admin-surface border border-admin-border shadow-sm">
          <div className="flex items-center justify-between text-cyan-400 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">Hours Logged</span>
            <FiClock size={14} />
          </div>
          <p className="text-lg font-black text-admin-text">{stats.totalWorkingHours ?? 0}</p>
          <span className="text-[10px] text-cyan-400/80 font-mono">Avg: {stats.avgWorkingHours ?? 0}h/day</span>
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
          <div className="p-12 text-center space-y-2">
            <FiCalendar size={28} className="text-admin-muted mx-auto" />
            <p className="text-sm font-bold text-admin-text">No attendance logs found</p>
            <p className="text-xs text-admin-secondary">
              No records match the selected month/year and status filters.
            </p>
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
                {attendanceRecords.map((record) => {
                  const isLate = record.attendance_status === 'Late Check-in' || (record.late_minutes && Number(record.late_minutes) > 0);
                  const isEarlyCO = record.early_minutes && Number(record.early_minutes) > 0;

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
                        {record.check_in_time ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-admin-text">{record.check_in_time}</span>
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
                        {record.check_out_time ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-admin-text">{record.check_out_time}</span>
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
                      <td className="px-4 py-3 text-xs max-w-xs truncate text-admin-secondary" title={record.absent_reason || ''}>
                        {record.absent_reason ? (
                          <span className="text-amber-300 font-medium">{record.absent_reason}</span>
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
