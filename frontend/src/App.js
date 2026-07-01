import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Loader from './components/Loader';
import LogoutWarningDialog from './components/LogoutWarningDialog';
import GlobalErrorDialog from './components/GlobalErrorDialog';

// Public Pages
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import FAQPage from './pages/FAQPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsAndConditionsPage from './pages/TermsAndConditionsPage';
import SupportPage from './pages/SupportPage';

// Auth Pages
import AdminLogin from './pages/AdminLogin';
import EmployeeLogin from './pages/EmployeeLogin';
import ForgotPassword from './pages/ForgotPassword';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminEmployees from './pages/AdminEmployees';
import AdminDepartments from './pages/AdminDepartments';
import AdminAttendance from './pages/AdminAttendance';
import AdminSettings from './pages/AdminSettings';
import AdminManagement from './pages/AdminManagement';
import AdminHolidays from './pages/AdminHolidays';
import AdminManualAttendance from './pages/AdminManualAttendance';
import AdminAbsentReasons from './pages/AdminAbsentReasons';
import AdminOTPSettings from './pages/AdminOTPSettings';
import AdminSecurityLogs from './pages/AdminSecurityLogs';
import AdminTrustedDevices from './pages/AdminTrustedDevices';
import AdminActivityLogs from './pages/AdminActivityLogs';
import AdminPayroll from './pages/AdminPayroll';
import AdminExpenses from './pages/AdminExpenses';
import AdminReports from './pages/AdminReports';

// Employee Pages
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeAttendance from './pages/EmployeeAttendance';
import EmployeeProfile from './pages/EmployeeProfile';
import ChangePassword from './pages/ChangePassword';

// Protected Route Component with custom logout warning dialog
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Show logout warning when trying to close tab/window
  useEffect(() => {
    if (isAuthenticated) {
      const handleBeforeUnload = (e) => {
        // This will trigger the browser's native dialog
        // We cannot show ONLY our custom dialog due to browser security
        e.preventDefault();
        // Modern browsers require returnValue to be set
        e.returnValue = 'Are you sure you want to leave? Please logout properly.';
        return 'Are you sure you want to leave? Please logout properly.';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isAuthenticated]);

  // Add keyboard shortcut (Ctrl/Cmd + W) to show custom logout dialog
  useEffect(() => {
    if (isAuthenticated) {
      const handleKeyDown = (e) => {
        // Detect Ctrl+W or Cmd+W (close tab shortcut)
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
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {children}
      <LogoutWarningDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onLogout={handleLogout}
        userRole={user?.role === 'admin' ? 'Administrator' : 'Employee'}
      />
    </>
  );
};

// Public Route Component (redirect if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <Loader />;
  }

  if (isAuthenticated) {
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user?.role === 'employee') {
      return <Navigate to="/employee/dashboard" replace />;
    }
  }

  return children;
};

// ScrollToTop Component
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pathname, hash]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <GlobalErrorDialog />
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Public Pages */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
          <Route path="/support" element={<SupportPage />} />

          {/* Auth Routes */}
          <Route
            path="/employee/login"
            element={
              <PublicRoute>
                <EmployeeLogin />
              </PublicRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PublicRoute>
                <AdminLogin />
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
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminEmployees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDepartments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminAttendance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/management"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/holidays"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminHolidays />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/manual-attendance"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminManualAttendance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/absent-reasons"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminAbsentReasons />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/otp-settings"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminOTPSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/security-logs"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminSecurityLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/trusted-devices"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminTrustedDevices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/activity-logs"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminActivityLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payroll"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPayroll />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/expenses"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminExpenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminReports />
              </ProtectedRoute>
            }
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
      </Router>
    </AuthProvider>
  );
}

export default App;
