import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminTheme } from '../context/AdminThemeContext';
import {
  FiHome, FiUsers, FiCalendar, FiLogOut, FiUser, FiClock,
  FiSettings, FiShield, FiMenu, FiX, FiLock, FiKey,
  FiAlertCircle, FiUmbrella, FiChevronRight, FiChevronDown, FiSmartphone, FiActivity, FiLayers, FiGrid,
  FiDollarSign, FiTrendingUp, FiPieChart, FiClipboard, FiUserX, FiSun, FiMoon
} from 'react-icons/fi';

const adminSections = [
  { label: 'Overview',         items: [{ path: '/admin/dashboard', icon: FiHome, label: 'Dashboard', pageKey: 'dashboard' }] },
  { label: 'People',           items: [{ path: '/admin/employees', icon: FiUsers, label: 'Employees', pageKey: 'employees' }, { path: '/admin/departments', icon: FiLayers, label: 'Departments', pageKey: 'departments' }, { path: '/admin/management', icon: FiShield, label: 'Admin Management', pageKey: 'admin_management' }] },
  { label: 'Time & Attendance',items: [{ path: '/admin/attendance', icon: FiCalendar, label: 'Attendance', pageKey: 'attendance' }, { path: '/admin/permissions', icon: FiClock, label: 'Permissions', pageKey: 'permissions' }, { path: '/admin/manual-attendance', icon: FiClipboard, label: 'Manual Attendance', pageKey: 'manual_attendance' }, { path: '/admin/absent-reasons', icon: FiUserX, label: 'Absent Reasons', pageKey: 'absent_reasons' }, { path: '/admin/holidays', icon: FiUmbrella, label: 'Holidays', pageKey: 'holidays' }] },
  { label: 'HR & Finance',     items: [{ path: '/admin/payroll', icon: FiDollarSign, label: 'Payroll', pageKey: 'payroll' }, { path: '/admin/expenses', icon: FiTrendingUp, label: 'Expenses', pageKey: 'expenses' }, { path: '/admin/reports', icon: FiPieChart, label: 'Reports', pageKey: 'reports' }] },
  { label: 'System',           items: [{ path: '/admin/settings', icon: FiSettings, label: 'Settings', pageKey: 'settings' }, { path: '/admin/manage', icon: FiGrid, label: 'Manage', pageKey: 'manage' }, { path: '/admin/trusted-devices', icon: FiSmartphone, label: 'Trusted Devices', pageKey: 'trusted_devices' }, { path: '/admin/activity-logs', icon: FiActivity, label: 'Activity Logs', pageKey: 'activity_logs' }, { path: '/admin/otp-settings', icon: FiKey, label: 'OTP Settings', pageKey: 'otp_settings' }, { path: '/admin/security-logs', icon: FiAlertCircle, label: 'Security Logs', pageKey: 'security_logs' }] },
];
const employeeSections = [
  { label: 'Overview',   items: [{ path: '/employee/dashboard', icon: FiHome, label: 'Dashboard' }] },
  { label: 'Attendance', items: [{ path: '/employee/attendance', icon: FiClock, label: 'My Attendance' }] },
  { label: 'Account',    items: [{ path: '/employee/profile', icon: FiUser, label: 'Profile' }, { path: '/employee/change-password', icon: FiLock, label: 'Change Password' }] },
];

const AdminNavItem = ({ path, icon: Icon, label, isActive, onClick, isCollapsed }) => (
  <li>
    <Link to={path} onClick={onClick} title={isCollapsed ? label : undefined}
      className={`group relative flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive ? 'bg-admin-accent/20 text-admin-text nav-active-glow' : 'text-admin-secondary hover:bg-admin-elevated hover:text-admin-text'
      }`}>
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-admin-accent rounded-r-full" />}
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-admin-accent2' : 'text-admin-muted group-hover:text-admin-secondary'}`}><Icon size={17} /></span>
      {!isCollapsed && <span className="truncate">{label}</span>}
      {!isCollapsed && isActive && <FiChevronRight size={12} className="ml-auto text-admin-accent2/70 flex-shrink-0" />}
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
  const { logout, isAdmin, user, hasPageAccess } = useAuth();
  const { theme, toggleTheme } = useAdminTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State to track open/collapsed sections for Admin Sidebar
  // Defaults: Overview, Time & Attendance, HR & Finance open; People & System closed
  const [openSections, setOpenSections] = useState(() => ({
    'Overview': true,
    'People': false,
    'Time & Attendance': true,
    'HR & Finance': true,
    'System': false
  }));

  // Auto-expand section if current pathname belongs to that section
  useEffect(() => {
    adminSections.forEach(section => {
      const hasActive = section.items.some(item => location.pathname === item.path);
      if (hasActive) {
        setOpenSections(prev => ({ ...prev, [section.label]: true }));
      }
    });
  }, [location.pathname]);

  const toggleSection = (label) => {
    setOpenSections(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const handleLogoutClick = async () => { try { await logout(); navigate('/'); } catch (e) { console.error(e); } };

  // Filter sections based on permissions
  const filteredAdminSections = adminSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => hasPageAccess(item.pageKey))
    }))
    .filter(section => section.items.length > 0);

  const sections = isAdmin ? filteredAdminSections : employeeSections;
  const nameStr  = user?.name || user?.username || 'U';
  const initials = nameStr.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const isWideTablePage = location.pathname.includes('/admin/attendance') || location.pathname.includes('/admin/payroll');
  const isCollapsed = isAdmin && isWideTablePage;

  /* ─── Admin Sidebar ─── */
  if (isAdmin) {
    return (
      <>
        <button onClick={() => setIsMobileMenuOpen(v => !v)} aria-label="Toggle menu"
          className="lg:hidden fixed top-4 left-4 z-50 bg-admin-elevated border border-admin-border text-admin-text p-2 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-clay-admin">
          {isMobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
        {isMobileMenuOpen && <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={() => setIsMobileMenuOpen(false)} />}
        <aside className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 ${isCollapsed ? 'w-14' : 'w-64'} flex-shrink-0 h-screen flex flex-col overflow-hidden bg-admin-bg border-r border-admin-border transform transition-transform duration-300 ease-out dark-scroll ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          {/* Logo */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-5'} h-16 border-b border-admin-border flex-shrink-0`}>
            <div className="flex items-center justify-center flex-shrink-0">
              <img src="/favicon/favicon-96x96.png" alt="MTM Attendance" className="brand-logo" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="font-bold text-admin-text text-sm leading-none tracking-tight">MTM Attendance</p>
                <p className="text-[10px] text-admin-accent mt-0.5 font-medium">Admin Panel</p>
              </div>
            )}
          </div>
          {/* User chip */}
          <div className={`px-4 py-3 border-b border-admin-border flex-shrink-0 ${isCollapsed ? 'hidden' : ''}`}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-admin-surface border border-admin-border">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-admin-accent to-admin-accent2 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">{initials}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-admin-text truncate leading-none">{nameStr}</p>
                <p className="text-[11px] text-admin-muted truncate mt-0.5">Administrator</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            </div>
          </div>
          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-3 dark-scroll">
            {sections.map(section => {
              const isOpen = openSections[section.label] ?? true;
              const hasActiveItem = section.items.some(item => location.pathname === item.path);

              return (
                <div key={section.label} className="transition-all duration-200">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    title={isCollapsed ? `${section.label} (${isOpen ? 'Click to collapse' : 'Click to expand'})` : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0 py-1 my-1' : 'justify-between px-3 py-1.5 mb-1'
                    } text-[11px] font-extrabold uppercase tracking-[0.15em] transition-all duration-200 rounded-lg group select-none cursor-pointer ${
                      hasActiveItem && !isOpen
                        ? 'text-admin-accent font-extrabold bg-admin-accent/10'
                        : 'text-admin-secondary dark:text-slate-300 hover:text-admin-text hover:bg-admin-elevated/50'
                    }`}
                  >
                    {!isCollapsed ? (
                      <>
                        <span className="flex items-center gap-1.5">
                          {section.label}
                          {hasActiveItem && !isOpen && (
                            <span className="w-1.5 h-1.5 rounded-full bg-admin-accent" />
                          )}
                        </span>
                        <FiChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${
                            isOpen ? 'rotate-0 text-admin-secondary dark:text-slate-300' : '-rotate-90 text-admin-muted group-hover:text-admin-text'
                          }`}
                        />
                      </>
                    ) : (
                      <div className="flex items-center justify-center relative w-full py-1">
                        <span className="w-6 border-t border-admin-border/70 group-hover:border-admin-accent/50 transition-colors" />
                        {hasActiveItem && !isOpen && (
                          <span className="absolute w-2 h-2 rounded-full bg-admin-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                        )}
                      </div>
                    )}
                  </button>

                  {isOpen && (
                    <ul className="space-y-0.5 transition-all duration-200">
                      {section.items.map(item => (
                        <AdminNavItem
                          key={item.path}
                          {...item}
                          isActive={location.pathname === item.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          isCollapsed={isCollapsed}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
          
          {/* Theme Toggle */}
          <div className={`px-3 py-2 flex-shrink-0 border-t border-admin-border ${isCollapsed ? 'flex justify-center' : ''}`}>
            <button onClick={toggleTheme} title={isCollapsed ? (theme === 'dark' ? 'Light Theme' : 'Dark Theme') : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium text-admin-muted hover:bg-admin-elevated hover:text-admin-text transition-all duration-200`}>
              {theme === 'dark' ? <FiSun size={17} className="flex-shrink-0" /> : <FiMoon size={17} className="flex-shrink-0" />}
              {!isCollapsed && <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>}
            </button>
          </div>

          {/* Sign out */}
          <div className={`px-3 pb-4 pt-1 flex-shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
            <button onClick={() => { setIsMobileMenuOpen(false); handleLogoutClick(); }} title={isCollapsed ? 'Sign Out' : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium text-admin-muted hover:bg-red-500/10 hover:text-red-400 transition-all duration-200`}>
              <FiLogOut size={17} className="flex-shrink-0" />{!isCollapsed && <span>Sign Out</span>}
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
          <div className="flex items-center justify-center flex-shrink-0">
            <img src="/favicon/favicon-96x96.png" alt="MTM Attendance" className="brand-logo" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#1E293B] text-[15px] leading-none tracking-tight">MTM Attendance</p>
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
