import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getEmployeeMonthlyAttendance } from '../services/api';
import { formatTime, formatDate, formatWorkingHours } from '../utils/formatTime';
import {
  FiCalendar, FiInfo, FiCheckCircle, FiAlertCircle, FiClock, FiTrendingUp,
  FiBarChart2
} from 'react-icons/fi';

const EmployeeAttendance = () => {
  const [attendance,    setAttendance]    = useState([]);
  const [holidays,      setHolidays]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear());

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]); // eslint-disable-line

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await getEmployeeMonthlyAttendance(selectedMonth, selectedYear);
      if (response.data.success) { setAttendance(response.data.attendance); setHolidays(response.data.holidays || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const isSunday = dateString => new Date(dateString).getDay() === 0;
  const getHolidayInfo = dateString => holidays.find(h => {
    const hd = new Date(h.holiday_date).toISOString().split('T')[0];
    const rd = new Date(dateString).toISOString().split('T')[0];
    return hd === rd;
  });
  const getDisplayStatus = record => {
    if (record.login_time) return { status:record.attendance_status, type:'attendance', holiday:null };
    const holiday = getHolidayInfo(record.attendance_date);
    if (holiday) return { status: holiday.holiday_type === 'Government Holiday' ? 'Government Holiday' : 'Office Holiday', type:'holiday', holiday };
    if (isSunday(record.attendance_date)) return { status:'Sunday', type:'sunday', holiday:null };
    return { status:'Absent', type:'absent', holiday:null };
  };

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  /* ─── Computed Stats ─── */
  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0, halfDay = 0;
    attendance.forEach(r => {
      const d = getDisplayStatus(r);
      if (d.status === 'Present' || d.status === 'Work From Home') present++;
      else if (d.status === 'Late') { present++; late++; }
      else if (d.status === 'Half Day') { halfDay++; }
      else if (d.status === 'Absent') absent++;
    });
    return { present, late, absent, halfDay };
  }, [attendance, holidays]); // eslint-disable-line

  /* ─── Attendance % ─── */
  const attendancePercent = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = parseInt(selectedMonth) === now.getMonth() + 1 && parseInt(selectedYear) === now.getFullYear();
    const maxDay = isCurrentMonth ? now.getDate() : new Date(selectedYear, selectedMonth, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= maxDay; d++) {
      const date = new Date(selectedYear, selectedMonth - 1, d);
      if (date.getDay() === 0) continue;
      const dateStr = date.toISOString().split('T')[0];
      const isHol = holidays.some(h => new Date(h.holiday_date).toISOString().split('T')[0] === dateStr);
      if (!isHol) workingDays++;
    }
    const totalPresent = stats.present + stats.halfDay;
    return workingDays > 0 ? Math.min(100, Math.round((totalPresent / workingDays) * 100)) : 0;
  }, [stats, selectedMonth, selectedYear, holidays]);

  /* ─── Progress Ring ─── */
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - attendancePercent / 100);

  return (
    <div className="flex h-screen" style={{ background: '#F5F7FB' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-4 py-5 lg:px-8 lg:py-7 max-w-[1400px] mx-auto pt-16 lg:pt-7">

          {/* ═══ HEADER ═══ */}
          <div className="mb-6 animate-fadeInUp stagger-1">
            <h1 className="text-2xl font-bold text-[#1E293B]">My Attendance</h1>
            <p className="text-sm text-[#64748B] mt-1">View your monthly attendance history.</p>
          </div>

          {/* ═══ SUMMARY CARDS ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Present Days', value: stats.present, icon: FiCheckCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', accent: 'from-emerald-500 to-emerald-400' },
              { label: 'Late Days',    value: stats.late,    icon: FiClock,       iconBg: 'bg-amber-50',   iconColor: 'text-amber-500',   accent: 'from-amber-500 to-amber-400'   },
              { label: 'Absent Days',  value: stats.absent,  icon: FiAlertCircle, iconBg: 'bg-red-50',     iconColor: 'text-red-500',     accent: 'from-red-500 to-red-400'       },
              { label: 'Half Days',    value: stats.halfDay,  icon: FiTrendingUp,  iconBg: 'bg-yellow-50',  iconColor: 'text-yellow-600',  accent: 'from-yellow-500 to-yellow-400' },
            ].map((card, i) => (
              <div key={card.label} className={`clay-stat-card p-5 animate-fadeInUp stagger-${i + 2}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-11 h-11 rounded-2xl ${card.iconBg} flex items-center justify-center`}>
                    <card.icon size={20} className={card.iconColor} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-[#1E293B]">{loading ? '–' : card.value}</p>
                <p className="text-xs text-[#64748B] mt-1 font-medium">{card.label}</p>
                <div className={`w-full h-1 rounded-full bg-gradient-to-r ${card.accent} opacity-30 mt-3`} />
              </div>
            ))}
          </div>

          {/* ═══ SECOND ROW: Monthly Overview + Attendance % ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* Monthly Overview */}
            <div className="clay-card-soft p-6 animate-fadeInUp stagger-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FiBarChart2 size={16} className="text-[#4F6CE1]" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B]">Monthly Attendance Overview</h3>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Present', value: stats.present, color: 'bg-emerald-500', total: attendance.length },
                  { label: 'Late',    value: stats.late,    color: 'bg-amber-500',   total: attendance.length },
                  { label: 'Absent',  value: stats.absent,  color: 'bg-red-500',     total: attendance.length },
                  { label: 'Half Day',value: stats.halfDay,  color: 'bg-yellow-500',  total: attendance.length },
                ].map(item => {
                  const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-[#64748B] font-medium">{item.label}</span>
                        <span className="font-bold text-[#1E293B]">{loading ? '–' : item.value} <span className="text-[#64748B] font-normal text-xs">({pct}%)</span></span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#F1F5F9]">
                        <div className={`${item.color} h-2 rounded-full transition-all duration-700 ease-out`} style={{ width: loading ? '0%' : `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-[#E7EBF2]/80 flex items-center justify-between text-xs text-[#64748B]">
                <span>Total Records: <span className="font-bold text-[#1E293B]">{attendance.length}</span></span>
                <span>{months[selectedMonth - 1]} {selectedYear}</span>
              </div>
            </div>

            {/* Attendance Percentage */}
            <div className="clay-card-soft p-6 flex flex-col items-center justify-center animate-fadeInUp stagger-6">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-5">Attendance Percentage</h3>
              <div className="relative">
                <svg width="130" height="130" viewBox="0 0 130 130">
                  <defs>
                    <linearGradient id="attendProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4F6CE1" />
                      <stop offset="100%" stopColor="#7B93F5" />
                    </linearGradient>
                  </defs>
                  <circle cx="65" cy="65" r={ringRadius} fill="none" stroke="#E8ECF4" strokeWidth="10" />
                  <circle
                    cx="65" cy="65" r={ringRadius}
                    fill="none"
                    stroke="url(#attendProgressGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={loading ? ringCircumference : ringOffset}
                    transform="rotate(-90 65 65)"
                    style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-[#1E293B]">{loading ? '–' : attendancePercent}%</span>
                </div>
              </div>
              <p className="text-sm text-[#64748B] mt-4 font-medium">
                {months[selectedMonth - 1]} {selectedYear}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                {attendancePercent >= 90 ? 'Excellent attendance! 🏆' : attendancePercent >= 75 ? 'Great progress! 🎉' : attendancePercent >= 50 ? 'Keep improving! 💪' : 'Room for improvement 📈'}
              </p>
            </div>
          </div>

          {/* ═══ FILTER CARD ═══ */}
          <div className="clay-card-soft p-5 mb-6 animate-fadeInUp stagger-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <FiCalendar size={16} className="text-[#4F6CE1]" />
              </div>
              <h2 className="text-sm font-bold text-[#1E293B]">Select Period</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full bg-white border border-[#E7EBF2] text-[#1E293B] rounded-2xl py-3 px-4 text-sm font-medium focus:outline-none focus:border-[#4F6CE1] focus:ring-4 focus:ring-[#4F6CE1]/10 transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', backgroundSize: '16px', paddingRight: '42px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(149,163,187,0.06)'
                  }}
                >
                  {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full bg-white border border-[#E7EBF2] text-[#1E293B] rounded-2xl py-3 px-4 text-sm font-medium focus:outline-none focus:border-[#4F6CE1] focus:ring-4 focus:ring-[#4F6CE1]/10 transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', backgroundSize: '16px', paddingRight: '42px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(149,163,187,0.06)'
                  }}
                >
                  {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ═══ ATTENDANCE TABLE ═══ */}
          <div className="clay-card-soft overflow-hidden animate-fadeInUp stagger-7">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Spinner size="lg" />
                  <p className="text-sm text-[#64748B] mt-4">Loading attendance records...</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full clay-table">
                  <thead>
                    <tr className="border-b border-[#E7EBF2]">
                      {['Date','Login','Logout','Working Hours','Status','Absent Reason','WFH'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length > 0 ? attendance.map(record => {
                      const d = getDisplayStatus(record);
                      const isWeekendOrHoliday = d.type !== 'attendance' && d.type !== 'absent';
                      return (
                        <tr key={record.id} className={isWeekendOrHoliday ? 'bg-[#FAFBFD]' : ''}>
                          <td className="font-medium text-[#1E293B]">{formatDate(record.attendance_date)}</td>
                          <td className="text-[#64748B]">{d.type === 'attendance' ? formatTime(record.login_time) : '—'}</td>
                          <td className="text-[#64748B]">
                            <div>
                              {d.type === 'attendance' ? formatTime(record.logout_time) : '—'}
                              {record.is_auto_checkout && record.logout_time && <span className="block text-[10px] text-amber-500 font-medium">(Auto checkout)</span>}
                            </div>
                          </td>
                          <td className="text-[#1E293B] font-semibold">{record.logout_time ? formatWorkingHours(parseFloat(record.total_working_hours)) : '—'}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={d.type === 'attendance' ? record.attendance_status : d.status} />
                              {record.validation_method === 'Manual' && (
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">Manual</span>
                              )}
                              {d.holiday && (
                                <div className="relative group">
                                  <FiInfo size={13} className="text-[#4F6CE1] cursor-help" />
                                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-white text-[#0F172A] text-xs rounded-2xl p-3.5 w-56 z-10 shadow-clay-soft-lg">
                                    <p className="font-semibold mb-0.5">{d.holiday.holiday_title}</p>
                                    {d.holiday.holiday_note && <p className="text-[#64748B]">{d.holiday.holiday_note}</p>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="text-[#64748B] font-semibold">
                            {d.type === 'absent' || record.attendance_status === 'Absent' ? (record.absent_reason || '—') : '—'}
                          </td>
                          <td>
                            {record.is_wfh
                              ? <span className="text-[11px] font-semibold text-[#4F6CE1] bg-[#4F6CE1]/8 border border-[#4F6CE1]/15 px-2.5 py-1 rounded-full">WFH</span>
                              : <span className="text-xs text-[#475569]">—</span>
                            }
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={6} className="!py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                            <FiCalendar size={24} className="text-[#475569]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#64748B]">No records for this period</p>
                            <p className="text-xs text-[#64748B] mt-0.5">Try selecting a different month or year</p>
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
    </div>
  );
};

export default EmployeeAttendance;
