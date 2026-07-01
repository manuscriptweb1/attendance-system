import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/ui/StatusBadge';
import { Spinner } from '../components/Loader';
import { getDashboardStats, getAllAttendance, getTrustedDeviceStats, getAdminActivityStats, getAdminActivityLogs, getAllHolidays, getSystemHealth } from '../services/api';
import { formatTime, formatWorkingHours, formatDate } from '../utils/formatTime';
import {
  FiUsers, FiCheckCircle, FiClock, FiHome, FiXCircle, FiActivity, FiSmartphone,
  FiAlertTriangle, FiPlus, FiSettings, FiCalendar, FiDatabase, FiServer, FiWifi, FiMail,
  FiDollarSign, FiUserCheck
} from 'react-icons/fi';
import { Link } from 'react-router-dom';

const getLocalDateString = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; };

/* ─── CUSTOM CHART COMPONENTS ─── */
const DonutChart = ({ data, colors, labels }) => {
  const total = data.reduce((sum, val) => sum + val, 0);
  const size = 180;
  const cx = size / 2, cy = size / 2, radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  if (total === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-[#64748B]">
      <FiActivity size={32} className="opacity-20 mb-2" />
      <p className="text-xs font-semibold">No Data Today</p>
    </div>
  );

  return (
    <div className="relative flex items-center justify-center h-full">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {data.map((value, idx) => {
          if (value === 0) return null;
          const strokeDasharray = `${(value / total) * circumference} ${circumference}`;
          const strokeDashoffset = -currentOffset;
          currentOffset += (value / total) * circumference;
          return (
            <circle
              key={idx} cx={cx} cy={cy} r={radius} fill="transparent"
              stroke={colors[idx]} strokeWidth="18"
              strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round" className="transition-all duration-1000 ease-out hover:stroke-[22px] cursor-pointer"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{total}</span>
        <span className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider">Total</span>
      </div>
    </div>
  );
};

const LineChart = ({ data }) => {
  // data = array of objects { label: '8 AM', value: 10 }
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const height = 140, width = 400, padding = 20;
  
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-[#64748B]">
      <FiActivity size={32} className="opacity-20 mb-2" />
      <p className="text-xs font-semibold">No Check-ins Yet</p>
    </div>
  );

  const getPoints = () => {
    return data.map((d, i) => {
      const x = padding + (i * (width - 2*padding)) / Math.max(data.length - 1, 1);
      const y = height - padding - (d.value / maxVal) * (height - 2*padding);
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col justify-end pb-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d" style={{ filter: 'drop-shadow(0 8px 8px rgba(59,130,246,0.3))' }}>
        <polyline points={getPoints()} fill="none" stroke="url(#lineGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-line" />
        {data.map((d, i) => {
          const x = padding + (i * (width - 2*padding)) / Math.max(data.length - 1, 1);
          const y = height - padding - (d.value / maxVal) * (height - 2*padding);
          return (
            <circle key={i} cx={x} cy={y} r="4" fill="#161D2E" stroke="#3B82F6" strokeWidth="2.5" className="hover:r-6 hover:stroke-[3px] transition-all cursor-pointer group" />
          );
        })}
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-5">
        {data.filter((_, i) => i % Math.ceil(data.length/6) === 0).map((d, i) => (
          <span key={i} className="text-[10px] text-[#64748B] font-semibold">{d.label}</span>
        ))}
      </div>
    </div>
  );
};


/* ─── MAIN COMPONENT ─── */
const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalEmployees:0, activeEmployees:0, currentlyWorking:0, monthlyPayroll:0 });
  const [deviceStats, setDeviceStats] = useState({ pendingDevices:0, approvedDevices:0, rejectedDevices:0, blockedDevices:0, totalDevices:0 });
  const [activityStats, setActivityStats] = useState({ today:0, thisWeek:0, total:0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  
  // Attendance Table State
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  // Search & Filters for Table
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWFH, setFilterWFH] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const localDate = getLocalDateString();
      const now = new Date();
      
      const [statsRes, attendanceRes, deviceRes, activityRes, logsRes, holidaysRes, healthRes] = await Promise.all([
        getDashboardStats(), 
        getAllAttendance({ date: localDate }), 
        getTrustedDeviceStats(),
        getAdminActivityStats(),
        getAdminActivityLogs({ limit: 5 }),
        getAllHolidays(now.getFullYear(), now.getMonth() + 1),
        getSystemHealth()
      ]);
      
      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (attendanceRes.data.success) setAttendanceRecords(attendanceRes.data.attendance || []);
      if (deviceRes.data.success) setDeviceStats(deviceRes.data.stats);
      if (activityRes.data.success) setActivityStats(activityRes.data.stats);
      if (logsRes.data.success) setRecentActivities(logsRes.data.logs.slice(0, 5));
      if (holidaysRes.data.success) {
        const hols = holidaysRes.data.holidays.filter(h => h.is_enabled && new Date(h.holiday_date) >= new Date(localDate));
        setUpcomingHolidays(hols.slice(0, 3));
      }
      if (healthRes.data.success) setSystemHealth(healthRes.data.health);
    } catch (e) { console.error('Error fetching dashboard data:', e); }
    finally { setLoading(false); }
  };

  /* ─── COMPUTED DATA ─── */
  const checkedOutCount = attendanceRecords.filter(a => a.logout_time !== null).length;
  
  // Calculate mutually exclusive attendance categories to prevent double counting
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let wfhCount = 0;

  attendanceRecords.forEach(a => {
    switch (a.attendance_status) {
      case 'Present': presentCount++; break;
      case 'Absent': absentCount++; break;
      case 'Late': lateCount++; break;
      case 'Half Day': halfDayCount++; break;
      case 'Work From Home': wfhCount++; break;
      default: break;
    }
  });

  const donutData = [presentCount, absentCount, lateCount, halfDayCount, wfhCount];
  const donutColors = ['#22C55E', '#EF4444', '#F59E0B', '#EAB308', '#3B82F6'];
  const donutLabels = ['Present', 'Absent', 'Late', 'Half Day', 'WFH'];

  const lineData = useMemo(() => {
    const hours = {};
    attendanceRecords.forEach(a => {
      if (a.login_time) {
        const h = new Date(a.login_time).getHours();
        hours[h] = (hours[h] || 0) + 1;
      }
    });
    const result = [];
    for (let i = 8; i <= 18; i++) {
      result.push({ label: `${i > 12 ? i-12 : i} ${i >= 12 ? 'PM' : 'AM'}`, value: hours[i] || 0 });
    }
    return result;
  }, [attendanceRecords]);

  // Table Filtering
  const filteredAttendance = attendanceRecords.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.emp_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDept && a.department !== filterDept) return false;
    if (filterStatus && a.attendance_status !== filterStatus) return false;
    if (filterWFH !== '') {
      if (filterWFH === 'yes' && !a.is_wfh) return false;
      if (filterWFH === 'no' && a.is_wfh) return false;
    }
    return true;
  });
  
  const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage) || 1;
  const paginatedAttendance = filteredAttendance.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getGreeting = () => {
    const h = time.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) return (
    <div className="flex h-screen bg-[#0E1320]">
      <Sidebar />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Spinner size={40} color="blue" />
        <p className="text-[#64748B] text-sm font-medium animate-pulse">Loading Live Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0E1320] dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">

          {/* 1. HEADER */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">{getGreeting()}, Admin <span className="inline-block animate-wave">👋</span></h1>
              <p className="text-sm text-[#94A3B8] mt-1.5 font-medium">
                {time.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-[#1C2540] border border-white/[0.07] shadow-clay-admin rounded-xl px-4 py-2.5 flex items-center gap-3">
                <FiClock className="text-[#8B5CF6]" size={16} />
                <span className="text-sm font-mono font-bold text-white tracking-wider">{time.toLocaleTimeString('en-US', { hour12:true, hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
              </div>
              <div className="bg-[#1C2540] border border-emerald-500/20 shadow-clay-admin rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">System Online</span>
              </div>
            </div>
          </div>

          {/* 2. EMPLOYEE OVERVIEW (Today) */}
          <div className="mb-6 animate-fadeInUp stagger-2">
            <h2 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3 px-1">Employee Overview (Today)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { title: 'Total Employees', value: stats.totalEmployees, icon: FiUsers,       baseBg: 'bg-indigo-500/5', hoverBg: 'group-hover:bg-indigo-500/20', color: 'text-indigo-400', border: 'border-indigo-500/20', iconBg: 'bg-indigo-500/10' },
                { title: 'Active Employees',value: stats.activeEmployees,icon: FiUserCheck,   baseBg: 'bg-emerald-500/5', hoverBg: 'group-hover:bg-emerald-500/20', color: 'text-emerald-400', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/10' },
                { title: 'Currently Working',value: stats.currentlyWorking,icon: FiClock,     baseBg: 'bg-blue-500/5', hoverBg: 'group-hover:bg-blue-500/20', color: 'text-blue-400', border: 'border-blue-500/20', iconBg: 'bg-blue-500/10' },
                { title: 'Absent Today',     value: absentCount,            icon: FiXCircle,   baseBg: 'bg-red-500/5',   hoverBg: 'group-hover:bg-red-500/20', color: 'text-red-400', border: 'border-red-500/20', iconBg: 'bg-red-500/10' },
                { title: 'Est. Monthly Payroll', value: `₹${stats.monthlyPayroll?.toLocaleString() || 0}`, icon: FiDollarSign, baseBg: 'bg-purple-500/5', hoverBg: 'group-hover:bg-purple-500/20', color: 'text-purple-400', border: 'border-purple-500/20', iconBg: 'bg-purple-500/10' }
              ].map(card => (
                <div key={card.title} className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 shadow-clay-admin hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full ${card.baseBg} ${card.hoverBg} transition-all duration-300 group-hover:scale-110`} />
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${card.iconBg} ${card.color} ${card.border}`}>
                      <card.icon size={18} />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <p className="text-3xl font-extrabold text-white mb-1">{card.value}</p>
                    <p className="text-xs font-semibold text-[#94A3B8]">{card.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 & 4. SECOND ROW: Today's Summary & Trusted Devices */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6 animate-fadeInUp stagger-3">
            
            {/* Today's Attendance Summary */}
            <div>
              <h2 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3 px-1">Today's Attendance Summary</h2>
              <div className="grid grid-cols-2 gap-4 h-[calc(100%-28px)]">
                {[
                  { title: 'Working From Home', value: wfhCount, color: 'border-blue-500/50' },
                  { title: 'Half Day Today',    value: halfDayCount,       color: 'border-yellow-500/50' },
                  { title: 'Late Today',        value: lateCount,          color: 'border-amber-500/50' },
                  { title: 'Checked Out Today', value: checkedOutCount,    color: 'border-slate-500/50' }
                ].map(item => (
                  <div key={item.title} className={`bg-[#161D2E] border-l-2 ${item.color} border-y border-y-white/[0.06] border-r border-r-white/[0.06] rounded-r-2xl p-4 shadow-clay-admin flex flex-col justify-center`}>
                    <p className="text-xs font-semibold text-[#94A3B8] mb-1.5">{item.title}</p>
                    <p className="text-2xl font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trusted Device Summary */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">Trusted Device Summary</h2>
                {deviceStats.pendingDevices > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 uppercase tracking-widest animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Requires Approval
                  </span>
                )}
              </div>
              <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 shadow-clay-admin h-[calc(100%-28px)] flex flex-col justify-between">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <p className="text-xs font-semibold text-[#94A3B8] mb-1">Total Registered</p>
                    <p className="text-3xl font-extrabold text-white">{deviceStats.totalDevices}</p>
                  </div>
                  <Link to="/admin/trusted-devices" className="w-10 h-10 rounded-xl bg-[#1C2540] border border-white/10 flex items-center justify-center text-[#94A3B8] hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white transition-all shadow-sm">
                    <FiSmartphone size={18} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1C2540] rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Pending</p>
                    <p className="text-lg font-bold text-amber-400">{deviceStats.pendingDevices}</p>
                  </div>
                  <div className="bg-[#1C2540] rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Approved</p>
                    <p className="text-lg font-bold text-emerald-400">{deviceStats.approvedDevices}</p>
                  </div>
                  <div className="bg-[#1C2540] rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Rejected</p>
                    <p className="text-lg font-bold text-red-400">{deviceStats.rejectedDevices}</p>
                  </div>
                  <div className="bg-[#1C2540] rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Blocked</p>
                    <p className="text-lg font-bold text-gray-500">{deviceStats.blockedDevices}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* 5 & 6. CHARTS & ADMIN ACTIVITY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 animate-fadeInUp stagger-4">
            
            {/* Today's Attendance Trend */}
            <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 shadow-clay-admin flex flex-col col-span-1 lg:col-span-1 min-h-[260px]">
              <h3 className="text-xs font-bold text-white mb-6">Today's Attendance Trend</h3>
              <div className="flex-1 w-full"><LineChart data={lineData} /></div>
            </div>

            {/* Attendance Distribution */}
            <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 shadow-clay-admin flex flex-col col-span-1 lg:col-span-1 min-h-[260px]">
              <h3 className="text-xs font-bold text-white mb-4">Attendance Distribution</h3>
              <div className="flex-1 flex flex-col">
                <div className="flex-1"><DonutChart data={donutData} colors={donutColors} labels={donutLabels} /></div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                  {donutLabels.map((lbl, i) => (
                    <div key={lbl} className="flex items-center gap-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: donutColors[i] }} /> {lbl}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Admin Activity Summary */}
            <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 shadow-clay-admin col-span-1 lg:col-span-1 min-h-[260px] flex flex-col justify-between">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold text-white">Admin Activity Summary</h3>
                <FiActivity size={16} className="text-[#8B5CF6]" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
                  <span className="text-sm font-semibold text-[#94A3B8]">Activities Today</span>
                  <span className="text-lg font-bold text-white">{activityStats.today}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
                  <span className="text-sm font-semibold text-[#94A3B8]">Activities This Week</span>
                  <span className="text-lg font-bold text-white">{activityStats.thisWeek}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-[#94A3B8]">Total Activities</span>
                  <span className="text-lg font-bold text-white">{activityStats.total}</span>
                </div>
              </div>
              <Link to="/admin/activity-logs" className="mt-6 block text-center text-xs font-bold text-[#3B82F6] hover:text-[#60A5FA] uppercase tracking-wider py-2 bg-[#3B82F6]/10 rounded-xl hover:bg-[#3B82F6]/20 transition-colors">
                View All Logs
              </Link>
            </div>

          </div>

          {/* 7. TODAY'S ATTENDANCE TABLE */}
          <div className="mb-6 animate-fadeInUp stagger-5">
            <h2 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3 px-1">Today's Attendance</h2>
            <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl shadow-clay-admin overflow-hidden">
              
              {/* Toolbar */}
              <div className="p-4 border-b border-white/[0.06] bg-[#1C2540]/30 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input type="text" placeholder="Search Employee..." value={search} onChange={e=>setSearch(e.target.value)} className="admin-input text-sm py-2" />
                <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} className="admin-select text-sm py-2 text-[#94A3B8]">
                  <option value="">All Departments</option>
                  {[...new Set(attendanceRecords.map(a=>a.department))].filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="admin-select text-sm py-2 text-[#94A3B8]">
                  <option value="">All Statuses</option>
                  <option value="Currently Working">Currently Working</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                </select>
                <select value={filterWFH} onChange={e=>setFilterWFH(e.target.value)} className="admin-select text-sm py-2 text-[#94A3B8]">
                  <option value="">All Work Types</option>
                  <option value="yes">Work From Home</option>
                  <option value="no">Office</option>
                </select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-[#0E1320]/80">
                    <tr>{['Emp ID','Name','Department','Check In','Check Out','Hours','Status','WFH','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {paginatedAttendance.length > 0 ? paginatedAttendance.map(r => (
                      <tr key={r.id} className="admin-table-row">
                        <td className="px-4 py-3.5 text-xs text-[#94A3B8] font-mono whitespace-nowrap">{r.emp_id}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-white whitespace-nowrap">{r.name}</td>
                        <td className="px-4 py-3.5 text-xs text-[#CBD5E1] whitespace-nowrap">{r.department}</td>
                        <td className="px-4 py-3.5 text-xs text-[#CBD5E1] font-mono whitespace-nowrap">{formatTime(r.login_time)}</td>
                        <td className="px-4 py-3.5 text-xs text-[#CBD5E1] font-mono whitespace-nowrap">{formatTime(r.logout_time) || '—'}</td>
                        <td className="px-4 py-3.5 text-xs text-[#CBD5E1] font-mono whitespace-nowrap">{r.logout_time ? formatWorkingHours(parseFloat(r.total_working_hours)) : '—'}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge status={r.attendance_status} dark /></td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {r.is_wfh ? <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">WFH</span> : <span className="text-xs text-[#475569]">Office</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link to="/admin/attendance" className="text-xs font-bold text-[#3B82F6] hover:text-[#60A5FA] transition-colors">Manage</Link>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-[#64748B] text-sm font-medium">No records match your filters today.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-white/[0.06] bg-[#161D2E] flex justify-between items-center">
                  <span className="text-xs text-[#64748B] font-semibold">Page {page} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 bg-[#1C2540] text-white text-xs font-bold rounded-lg disabled:opacity-50 border border-white/10 hover:bg-[#0B1120]/10">Prev</button>
                    <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 bg-[#1C2540] text-white text-xs font-bold rounded-lg disabled:opacity-50 border border-white/10 hover:bg-[#0B1120]/10">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 8, 9, 10. RECENT ACTIVITIES & UPCOMING HOLIDAYS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 animate-fadeInUp stagger-6">
            
            {/* Recent Admin Activities */}
            <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl shadow-clay-admin flex flex-col">
              <div className="p-5 border-b border-white/[0.06] flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recent Admin Activities</h3>
                <Link to="/admin/activity-logs" className="text-[10px] font-bold text-[#3B82F6] hover:text-[#60A5FA] uppercase transition-colors">View All</Link>
              </div>
              <div className="p-2 flex-1">
                {recentActivities.length > 0 ? (
                  <div className="divide-y divide-white/[0.04]">
                    {recentActivities.map(log => (
                      <div key={log.id} className="p-4 hover:bg-[#0B1120]/[0.02] transition-colors flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400 font-bold text-[10px] uppercase">
                          {log.admin_name ? log.admin_name.substring(0, 2) : 'AD'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-bold text-white truncate pr-2">{log.action_type || log.description}</p>
                            <span className="text-[10px] font-semibold text-[#64748B] whitespace-nowrap">{formatTime(log.created_at)}</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8] line-clamp-1 mb-1.5">{log.description}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">{log.module_name}</span>
                            <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider">By {log.admin_name || 'System'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm font-medium text-[#64748B]">No recent activities</div>
                )}
              </div>
            </div>

            {/* Upcoming Holidays & Pending Approvals */}
            <div className="flex flex-col gap-6">
              
              {/* Upcoming Holidays */}
              <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 shadow-clay-admin">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Upcoming Holidays</h3>
                  <FiCalendar size={15} className="text-[#8B5CF6]" />
                </div>
                {upcomingHolidays.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingHolidays.map(h => (
                      <div key={h.id} className="flex items-center justify-between p-3 bg-[#1C2540] border border-white/[0.04] rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-white">{h.holiday_title}</p>
                          <p className="text-xs font-semibold text-[#94A3B8] mt-0.5">{formatDate(h.holiday_date)}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${h.holiday_type === 'Government Holiday' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                          {h.holiday_type}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm font-medium text-[#64748B]">No upcoming holidays this month.</div>
                )}
              </div>

              {/* Pending Approvals Compact */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-500 mb-1">Pending Approvals</h3>
                  <p className="text-xs font-semibold text-amber-500/70">{deviceStats.pendingDevices} Trusted Devices require review</p>
                </div>
                {deviceStats.pendingDevices > 0 ? (
                  <Link to="/admin/trusted-devices" className="px-4 py-2 bg-amber-500 text-amber-950 text-xs font-bold rounded-xl shadow-[0_4px_12px_rgba(245,158,11,0.2)] hover:bg-amber-400 transition-colors">
                    Review
                  </Link>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500"><FiCheckCircle size={14} /></span>
                )}
              </div>

            </div>
          </div>

          {/* 11 & 12. QUICK ACTIONS & SYSTEM HEALTH */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8 animate-fadeInUp stagger-7">
            
            {/* Quick Actions */}
            <div className="xl:col-span-2">
              <h2 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3 px-1">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label:'Add Employee', icon:FiPlus,        to:'/admin/employees', color:'bg-indigo-500/20 text-indigo-400 border-indigo-500/20' },
                  { label:'Add Holiday',  icon:FiCalendar,    to:'/admin/holidays',  color:'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' },
                  { label:'Trust Devices',icon:FiSmartphone,  to:'/admin/trusted-devices', color:'bg-amber-500/20 text-amber-400 border-amber-500/20' },
                  { label:'Attendance',   icon:FiClock,       to:'/admin/attendance', color:'bg-blue-500/20 text-blue-400 border-blue-500/20' },
                  { label:'Settings',     icon:FiSettings,    to:'/admin/settings',   color:'bg-slate-500/20 text-slate-400 border-slate-500/20' },
                  { label:'Activity Logs',icon:FiActivity,    to:'/admin/activity-logs', color:'bg-purple-500/20 text-purple-400 border-purple-500/20' }
                ].map(action => (
                  <Link key={action.label} to={action.to} className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-[#0B1120]/[0.04] hover:border-white/10 transition-all shadow-clay-admin group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-110 ${action.color}`}>
                      <action.icon size={18} />
                    </div>
                    <span className="text-xs font-semibold text-white">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className="xl:col-span-1">
              <h2 className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3 px-1">System Health</h2>
              <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 shadow-clay-admin h-[calc(100%-28px)]">
                <div className="space-y-4">
                  {systemHealth ? [
                    { label:'Database',      icon:FiDatabase, status: systemHealth.database.status,  color: systemHealth.database.color, bg: systemHealth.database.bg },
                    { label:'Backend API',   icon:FiServer,   status: systemHealth.backend.status,   color: systemHealth.backend.color,  bg: systemHealth.backend.bg },
                    { label:'Email Service', icon:FiMail,     status: systemHealth.email.status,     color: systemHealth.email.color,    bg: systemHealth.email.bg },
                    { label:'Cron Jobs',     icon:FiClock,    status: systemHealth.cron.status,      color: systemHealth.cron.color,     bg: systemHealth.cron.bg },
                  ].map(sys => (
                    <div key={sys.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#1C2540] border border-white/[0.04] flex items-center justify-center text-[#64748B]">
                          <sys.icon size={14} />
                        </div>
                        <span className="text-sm font-semibold text-[#CBD5E1]">{sys.label}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.04] ${sys.bg}`}>
                        {sys.color.includes('emerald') ? (
                          <span className={`w-1.5 h-1.5 rounded-full ${sys.color.replace('text', 'bg')} animate-pulse`} />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${sys.color.replace('text', 'bg')}`} />
                        )}
                        <span className={`text-[10px] font-bold ${sys.color} uppercase tracking-wider`}>{sys.status}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="flex justify-center items-center h-32">
                      <Spinner />
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
export default AdminDashboard;
