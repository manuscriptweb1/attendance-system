import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in from sessionStorage (not localStorage)
    const storedToken = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Invalid saved session. Clearing session storage.', error);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    // Use sessionStorage instead of localStorage - clears on browser close
    sessionStorage.setItem('token', authToken);
    sessionStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.clear(); // Complete session clear
    
    // Clear all potential attendance session state
    localStorage.removeItem('attendance_session_id');
    localStorage.removeItem('check_in_time');
    localStorage.removeItem('wfh_status');
    localStorage.removeItem('check_in_device_id');
    localStorage.removeItem('cached_location');
    localStorage.removeItem('device_fingerprint');
  };

  const normalizeRole = (role) => 
    String(role || "").trim().toLowerCase().replace(/[_-]+/g, " ");

  const isSuperAdmin = 
    user?.is_super_admin === true || 
    user?.isSuperAdmin === true || 
    user?.emergency_admin === true ||
    normalizeRole(user?.role) === 'super admin' || 
    normalizeRole(user?.role) === 'superadmin';

  const isAdmin = 
    isSuperAdmin || 
    normalizeRole(user?.role) === 'admin';
  
  const hasPageAccess = (pageKey) => {
    if (isSuperAdmin) return true;
    if (!user?.permissions) return false;
    return user.permissions[pageKey] !== undefined;
  };

  const hasPermission = (pageKey, action = "can_view") => {
    if (isSuperAdmin) return true;
    if (!user?.permissions) return false;
    if (!user.permissions[pageKey]) return false;
    return user.permissions[pageKey][action] === true;
  };

  const getDefaultAdminRoute = () => {
    if (isSuperAdmin) return '/admin/dashboard';
    if (!user?.permissions) return '/admin/dashboard';
    
    // If they have dashboard view, send there
    if (user.permissions['dashboard']?.can_view) return '/admin/dashboard';

    const pages = Object.keys(user.permissions);
    const firstAllowed = pages.find(p => user.permissions[p]?.can_view);
    
    if (firstAllowed) {
       if (firstAllowed === 'manual_attendance') return '/admin/manual-attendance';
       if (firstAllowed === 'admin_management') return '/admin/management';
       if (firstAllowed === 'absent_reasons') return '/admin/absent-reasons';
       if (firstAllowed === 'trusted_devices') return '/admin/trusted-devices';
       if (firstAllowed === 'database_monitor') return '/admin/database-monitor';
       if (firstAllowed === 'activity_logs') return '/admin/activity-logs';
       if (firstAllowed === 'security_logs') return '/admin/security-logs';
       if (firstAllowed === 'otp_settings') return '/admin/otp-settings';
       return `/admin/${firstAllowed}`;
    }
    
    return '/admin/access-denied';
  };

  const value = {
    user,
    token,
    login,
    logout,
    loading,
    isAuthenticated: !!token,
    isAdmin,
    isSuperAdmin,
    isEmployee: user?.role === 'employee',
    hasPageAccess,
    hasPermission,
    getDefaultAdminRoute
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
