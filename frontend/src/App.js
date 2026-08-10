import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminThemeProvider } from './context/AdminThemeContext';
import Loader from './components/Loader';
import LogoutWarningDialog from './components/LogoutWarningDialog';
import GlobalErrorDialog from './components/GlobalErrorDialog';
import AdminAssistantBot from './components/AdminAssistantBot';

// Public Pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsAndConditionsPage = lazy(() => import('./pages/TermsAndConditionsPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const PublicEmployeeInfo = lazy(() => import('./pages/PublicEmployeeInfo'));

// Auth Pages
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const EmployeeLogin = lazy(() => import('./pages/EmployeeLogin'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminEmployees = lazy(() => import('./pages/AdminEmployees'));
const AdminDepartments = lazy(() => import('./pages/AdminDepartments'));
const AdminAttendance = lazy(() => import('./pages/AdminAttendance'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const AdminManage = lazy(() => import('./pages/AdminManage'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const AdminHolidays = lazy(() => import('./pages/AdminHolidays'));
const AdminManualAttendance = lazy(() => import('./pages/AdminManualAttendance'));
const AdminAbsentReasons = lazy(() => import('./pages/AdminAbsentReasons'));
const AdminOTPSettings = lazy(() => import('./pages/AdminOTPSettings'));
const AdminSecurityLogs = lazy(() => import('./pages/AdminSecurityLogs'));
const AdminTrustedDevices = lazy(() => import('./pages/AdminTrustedDevices'));
const AdminActivityLogs = lazy(() => import('./pages/AdminActivityLogs'));
const AdminPayroll = lazy(() => import('./pages/AdminPayroll'));
const AdminExpenses = lazy(() => import('./pages/AdminExpenses'));
const AdminPermissions = lazy(() => import('./pages/AdminPermissions'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminDatabaseMonitor = lazy(() => import('./pages/AdminDatabaseMonitor'));
const AdminAccessDenied = lazy(() => import('./pages/AdminAccessDenied'));
const DeveloperTestingSandbox = lazy(() => import('./pages/DeveloperTestingSandbox'));

// Employee Pages
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const EmployeeAttendance = lazy(() => import('./pages/EmployeeAttendance'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));

// Protected Route Component with custom logout warning dialog
const ProtectedRoute = ({ children, requiredRole, requiredPageKey }) => {
  const { isAuthenticated, user, loading, logout, hasPageAccess, isAdmin, isEmployee } = useAuth();
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Please logout properly.';
        return 'Are you sure you want to leave? Please logout properly.';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
          e.preventDefault();
          setShowLogoutDialog(true);
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    try {
      await logout();
      setShowLogoutDialog(false);
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  if (requiredRole === 'employee' && !isEmployee) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (requiredRole === 'admin' && requiredPageKey && !hasPageAccess(requiredPageKey)) {
    return <AdminAccessDenied pageKey={requiredPageKey} />;
  }

  return (
    <>
      {children}
      <LogoutWarningDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleLogout}
      />
    </>
  );
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, isAdmin, isEmployee, getDefaultAdminRoute } = useAuth();

  if (loading) {
    return <Loader />;
  }

  if (isAuthenticated) {
    if (isAdmin) {
      return <Navigate to={getDefaultAdminRoute ? getDefaultAdminRoute() : "/admin/dashboard"} replace />;
    } else if (isEmployee) {
      return <Navigate to="/employee/dashboard" replace />;
    }
  }

  return children;
};

// ScrollToTop Component
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
};

function App() {
  return (
    <AuthProvider>
      <AdminThemeProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <Suspense fallback={<Loader />}>
            <AdminAssistantBot />
            <GlobalErrorDialog />
            <Routes>
              {/* Public Pages */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/public/employee/:employeeId" element={<PublicEmployeeInfo />} />

              {/* Auth Pages */}
              <Route
                path="/admin"
                element={
                  <PublicRoute>
                    <AdminLogin />
                  </PublicRoute>
                }
              />
              <Route
                path="/admin/login"
                element={
                  <PublicRoute>
                    <AdminLogin />
                  </PublicRoute>
                }
              />
              <Route
                path="/employee/login"
                element={
                  <PublicRoute>
                    <EmployeeLogin />
                  </PublicRoute>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicRoute>
                    <ForgotPassword />
                  </PublicRoute>
                }
              />

              {/* Admin Protected Routes */}
              <Route
                path="/admin/access-denied"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminAccessDenied />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="dashboard"><AdminDashboard /></ProtectedRoute>}
              />
              <Route
                path="/admin/employees"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="employees"><AdminEmployees /></ProtectedRoute>}
              />
              <Route
                path="/admin/departments"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="departments"><AdminDepartments /></ProtectedRoute>}
              />
              <Route
                path="/admin/attendance"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="attendance"><AdminAttendance /></ProtectedRoute>}
              />
              <Route
                path="/admin/settings"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="settings"><AdminSettings /></ProtectedRoute>}
              />
              <Route
                path="/admin/manage"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="manage"><AdminManage /></ProtectedRoute>}
              />
              <Route
                path="/admin/management"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="admin_management"><AdminManagement /></ProtectedRoute>}
              />
              <Route
                path="/admin/holidays"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="holidays"><AdminHolidays /></ProtectedRoute>}
              />
              <Route
                path="/admin/manual-attendance"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="manual_attendance"><AdminManualAttendance /></ProtectedRoute>}
              />
              <Route
                path="/admin/absent-reasons"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="absent_reasons"><AdminAbsentReasons /></ProtectedRoute>}
              />
              <Route
                path="/admin/otp-settings"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="otp_settings"><AdminOTPSettings /></ProtectedRoute>}
              />
              <Route
                path="/admin/security-logs"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="security_logs"><AdminSecurityLogs /></ProtectedRoute>}
              />
              <Route
                path="/admin/database-monitor"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="database_monitor"><AdminDatabaseMonitor /></ProtectedRoute>}
              />
              <Route
                path="/admin/trusted-devices"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="trusted_devices"><AdminTrustedDevices /></ProtectedRoute>}
              />
              <Route
                path="/admin/activity-logs"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="activity_logs"><AdminActivityLogs /></ProtectedRoute>}
              />
              <Route
                path="/admin/payroll"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="payroll"><AdminPayroll /></ProtectedRoute>}
              />
              <Route
                path="/admin/expenses"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="expenses"><AdminExpenses /></ProtectedRoute>}
              />
              <Route
                path="/admin/permissions"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="permissions"><AdminPermissions /></ProtectedRoute>}
              />
              <Route
                path="/admin/reports"
                element={<ProtectedRoute requiredRole="admin" requiredPageKey="reports"><AdminReports /></ProtectedRoute>}
              />
              <Route
                path="/admin/developer-testing"
                element={<DeveloperTestingSandbox />}
              />

              {/* Employee Protected Routes */}
              <Route
                path="/employee/dashboard"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <EmployeeDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/attendance"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <EmployeeAttendance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/profile"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <EmployeeProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/change-password"
                element={
                  <ProtectedRoute requiredRole="employee">
                    <ChangePassword />
                  </ProtectedRoute>
                }
              />

              {/* 404 Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AdminThemeProvider>
    </AuthProvider>
  );
}

export default App;
