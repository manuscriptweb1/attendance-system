import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiHome, FiUsers, FiCalendar, FiLogOut, FiUser, FiClock,
  FiSettings, FiShield, FiMenu, FiX, FiLock, FiKey,
  FiAlertCircle, FiUmbrella, FiChevronRight, FiSmartphone, FiActivity, FiLayers,
  FiDollarSign, FiTrendingUp, FiPieChart, FiClipboard, FiUserX
} from 'react-icons/fi';

const adminSections = [
  { label: 'Overview',         items: [{ path: '/admin/dashboard', icon: FiHome, label: 'Dashboard' }] },
  { label: 'People',           items: [{ path: '/admin/employees', icon: FiUsers, label: 'Employees' }, { path: '/admin/departments', icon: FiLayers, label: 'Departments' }, { path: '/admin/management', icon: FiShield, label: 'Admin Management' }] },
  { label: 'Time & Attendance',items: [{ path: '/admin/attendance', icon: FiCalendar, label: 'Attendance' }, { path: '/admin/manual-attendance', icon: FiClipboard, label: 'Manual Attendance' }, { path: '/admin/absent-reasons', icon: FiUserX, label: 'Absent Reasons' }, { path: '/admin/holidays', icon: FiUmbrella, label: 'Holidays' }] },
  { label: 'HR & Finance',     items: [{ path: '/admin/payroll', icon: FiDollarSign, label: 'Payroll' }, { path: '/admin/expenses', icon: FiTrendingUp, label: 'Expenses' }, { path: '/admin/reports', icon: FiPieChart, label: 'Reports' }] },
  { label: 'System',           items: [{ path: '/admin/settings', icon: FiSettings, label: 'Settings' }, { path: '/admin/trusted-devices', icon: FiSmartphone, label: 'Trusted Devices' }, { path: '/admin/activity-logs', icon: FiActivity, label: 'Activity Logs' }, { path: '/admin/otp-settings', icon: FiKey, label: 'OTP Settings' }, { path: '/admin/security-logs', icon: FiAlertCircle, label: 'Security Logs' }] },
];
const employeeSections = [
  { label: 'Overview',   items: [{ path: '/employee/dashboard', icon: FiHome, label: 'Dashboard' }] },
  { label: 'Attendance', items: [{ path: '/employee/attendance', icon: FiClock, label: 'My Attendance' }] },
  { label: 'Account',    items: [{ path: '/employee/profile', icon: FiUser, label: 'Profile' }, { path: '/employee/change-password', icon: FiLock, label: 'Change Password' }] },
];

const AdminNavItem = ({ path, icon: Icon, label, isActive, onClick }) => (
  <li>
    <Link to={path} onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive ? 'bg-blue-500/20 text-[#0F172A] dark:text-white nav-active-glow' : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-white/5 hover:text-[#0F172A] dark:hover:text-white'
      }`}>
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#3B82F6] rounded-r-full" />}
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-[#60A5FA]' : 'text-[#64748B] group-hover:text-[#64748B] dark:text-[#94A3B8]'}`}><Icon size={17} /></span>
      <span className="truncate">{label}</span>
      {isActive && <FiChevronRight size={12} className="ml-auto text-[#60A5FA]/70 flex-shrink-0" />}
    </Link>
  </li>
);

/* ─── Claymorphism Employee Nav Item ─── */
const EmpNavItem = ({ path, icon: Icon, label, isActive, onClick }) => (
  <li>
    <Link to={path} onClick={onClick}
      className={`clay-nav-item group flex items-center gap-3 text-sm font-medium ${
        isActive
          ? 'active text-[#4F6CE1]'
          : 'text-[#0F172A]'
      }`}>
      <span className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-br from-[#4F6CE1] to-[#7B93F5] text-white shadow-[0_3px_10px_rgba(79,108,225,0.25)]'
          : 'bg-[#e2e8f0] text-[#64748B] group-hover:bg-[#cbd5e1] group-hover:text-[#1E293B]'
      }`}>
        <Icon size={15} />
      </span>
      <span className="truncate">{label}</span>
      {isActive && <FiChevronRight size={12} className="ml-auto text-[#4F6CE1]/50 flex-shrink-0" />}
    </Link>
  </li>
);

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAdmin, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const handleLogoutClick = async () => { try { await logout(); navigate('/'); } catch (e) { console.error(e); } };
  const sections = isAdmin ? adminSections : employeeSections;
  const nameStr  = user?.name || user?.username || 'U';
  const initials = nameStr.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  /* ─── Admin Sidebar (COMPLETELY UNCHANGED) ─── */
  if (isAdmin) {
    return (
      <>
        <button onClick={() => setIsMobileMenuOpen(v => !v)} aria-label="Toggle menu"
          className="lg:hidden fixed top-4 left-4 z-50 bg-[#1C2540] border border-[#E2E8F0] dark:border-white/10 text-[#0F172A] dark:text-white p-2 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-clay-admin">
          {isMobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
        {isMobileMenuOpen && <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={() => setIsMobileMenuOpen(false)} />}
        <aside className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-64 flex-shrink-0 h-screen flex flex-col overflow-hidden bg-[#F1F5F9] dark:bg-[#0E1320] border-r border-[#E2E8F0] dark:border-white/[0.06] transform transition-transform duration-300 ease-out dark-scroll ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 h-16 border-b border-[#E2E8F0] dark:border-white/[0.06] flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#6366f1] flex items-center justify-center flex-shrink-0 shadow-glow-blue-sm">
              <FiClock size={16} className="text-[#0F172A] dark:text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#0F172A] dark:text-white text-sm leading-none tracking-tight">AttendanceMS</p>
              <p className="text-[10px] text-[#60A5FA] mt-0.5 font-medium">Admin Panel</p>
            </div>
          </div>
          {/* User chip */}
          <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-[#0B1120]/[0.04] border border-[#E2E8F0] dark:border-white/[0.06]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#6366f1] flex items-center justify-center flex-shrink-0 text-[#0F172A] dark:text-white text-xs font-bold">{initials}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F172A] dark:text-white truncate leading-none">{nameStr}</p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">Administrator</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            </div>
          </div>
          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 dark-scroll">
            {sections.map(section => (
              <div key={section.label}>
                <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#64748B] dark:text-[#94A3B8]/50">{section.label}</p>
                <ul className="space-y-0.5">
                  {section.items.map(item => <AdminNavItem key={item.path} {...item} isActive={location.pathname === item.path} onClick={() => setIsMobileMenuOpen(false)} />)}
                </ul>
              </div>
            ))}
          </nav>
          {/* Sign out */}
          <div className="px-3 py-4 border-t border-[#E2E8F0] dark:border-white/[0.06] flex-shrink-0">
            <button onClick={() => { setIsMobileMenuOpen(false); handleLogoutClick(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-red-500/10 hover:text-red-400 transition-all duration-200">
              <FiLogOut size={17} className="flex-shrink-0" /><span>Sign Out</span>
            </button>
          </div>
        </aside>
      </>
    );
  }

  /* ─── Claymorphism Employee Sidebar ─── */
  return (
    <>
      {/* Mobile toggle button */}
      <button onClick={() => setIsMobileMenuOpen(v => !v)} aria-label="Toggle menu"
        className="lg:hidden fixed top-4 left-4 z-50 clay-card-soft p-2.5 rounded-2xl text-[#1E293B] dark:text-[#F8FAFC]">
        {isMobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-[272px] flex-shrink-0 h-screen flex flex-col overflow-hidden clay-sidebar-emp transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

        <div className="flex items-center gap-3 px-5 h-[68px] border-b border-[#E7EBF2]/80 flex-shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4F6CE1] to-[#7B93F5] flex items-center justify-center flex-shrink-0 shadow-[0_4px_14px_rgba(79,108,225,0.3)]">
            <FiClock size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#1E293B] text-[15px] leading-none tracking-tight">AttendanceMS</p>
            <p className="text-[10px] text-[#4F6CE1] mt-0.5 font-semibold tracking-wide uppercase">Employee Portal</p>
          </div>
        </div>

        {/* ─── Profile Card ─── */}
        <div className="px-4 py-4 border-b border-[#E7EBF2]/60 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-gradient-to-br from-[#4F6CE1] to-[#7B93F5] shadow-[0_4px_14px_rgba(79,108,225,0.3)] border border-[#4F6CE1]/20">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate leading-none">{nameStr}</p>
              <p className="text-[11px] text-blue-100 truncate mt-1">{user?.job_role || 'Employee'}</p>
            </div>
            <div className="clay-live-dot flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)] bg-emerald-400" />
          </div>
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {sections.map(section => (
            <div key={section.label}>
              <p className="px-3 mb-2.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#64748B]">
                {section.label}
              </p>
              <ul className="space-y-1">
                {section.items.map(item => (
                  <EmpNavItem
                    key={item.path} {...item}
                    isActive={location.pathname === item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* ─── Sign Out ─── */}
        <div className="px-4 py-4 border-t border-[#E7EBF2]/60 flex-shrink-0">
          <button onClick={() => { setIsMobileMenuOpen(false); handleLogoutClick(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-[#64748B] hover:bg-red-50 hover:text-red-500 transition-all duration-200">
            <span className="w-8 h-8 rounded-xl bg-[#f1f5f9] flex items-center justify-center group-hover:bg-red-50">
              <FiLogOut size={15} />
            </span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
