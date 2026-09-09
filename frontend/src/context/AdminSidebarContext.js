import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const AdminSidebarContext = createContext();

export const useAdminSidebar = () => {
  const context = useContext(AdminSidebarContext);
  if (!context) {
    throw new Error('useAdminSidebar must be used within an AdminSidebarProvider');
  }
  return context;
};

export const AdminSidebarProvider = ({ children }) => {
  const location = useLocation();

  // Wide table pages default to collapsed unless admin explicitly chose expanded
  const isWideTablePage = useCallback((pathname) => {
    return pathname.includes('/admin/attendance') || pathname.includes('/admin/payroll');
  }, []);

  // Initialize state: check localStorage first, else check if wide page
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin_sidebar_collapsed');
    if (saved !== null) {
      return saved === 'true';
    }
    return isWideTablePage(window.location.pathname);
  });

  const [hasManualPreference, setHasManualPreference] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') !== null;
  });

  // If user hasn't explicitly set a preference, auto-adjust on wide table pages
  useEffect(() => {
    if (!hasManualPreference) {
      setIsCollapsed(isWideTablePage(location.pathname));
    }
  }, [location.pathname, hasManualPreference, isWideTablePage]);

  // Toggle function
  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      setHasManualPreference(true);
      return next;
    });
  }, []);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
    localStorage.setItem('admin_sidebar_collapsed', 'false');
    setHasManualPreference(true);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsCollapsed(true);
    localStorage.setItem('admin_sidebar_collapsed', 'true');
    setHasManualPreference(true);
  }, []);

  // Keyboard shortcuts to toggle sidebar: Alt+S, Backslash (\), or F2
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

      // 1. Alt + S (left hand resting position)
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // 2. F2 (single key at top-left)
      if (e.key === 'F2') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // 3. Single key '\' or '[' when not typing in an input
      if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === '\\' || e.key === '[')) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // 4. Ctrl + \ (standard IDE toggle)
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  return (
    <AdminSidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        expandSidebar,
        collapseSidebar
      }}
    >
      {children}
    </AdminSidebarContext.Provider>
  );
};

export default AdminSidebarContext;
