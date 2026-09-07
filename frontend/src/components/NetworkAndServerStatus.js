import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import OfflinePage from '../pages/OfflinePage';
import ServerDownPage from '../pages/ServerDownPage';
import MaintenanceModePage from '../pages/MaintenanceModePage';
import InternalErrorPage from '../pages/InternalErrorPage';
import SessionExpiredPage from '../pages/SessionExpiredPage';

const NetworkAndServerStatus = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isServerDown, setIsServerDown] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isInternalError, setIsInternalError] = useState(false);

  // Check connectivity online/offline
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for custom system status events from Axios interceptor & app logic
  useEffect(() => {
    const handleServerDownEvent = () => setIsServerDown(true);
    const handleServerUpEvent = () => {
      setIsServerDown(false);
      setIsMaintenance(false);
      setIsInternalError(false);
    };
    const handleMaintenanceEvent = () => setIsMaintenance(true);
    const handleSessionExpiredEvent = () => setIsSessionExpired(true);
    const handleInternalErrorEvent = () => setIsInternalError(true);

    window.addEventListener('showServerDown', handleServerDownEvent);
    window.addEventListener('serverRestored', handleServerUpEvent);
    window.addEventListener('showMaintenanceMode', handleMaintenanceEvent);
    window.addEventListener('showSessionExpired', handleSessionExpiredEvent);
    window.addEventListener('showInternalError', handleInternalErrorEvent);

    return () => {
      window.removeEventListener('showServerDown', handleServerDownEvent);
      window.removeEventListener('serverRestored', handleServerUpEvent);
      window.removeEventListener('showMaintenanceMode', handleMaintenanceEvent);
      window.removeEventListener('showSessionExpired', handleSessionExpiredEvent);
      window.removeEventListener('showInternalError', handleInternalErrorEvent);
    };
  }, []);

  // Handler to test and recover from Server Down / Maintenance / 500
  const handleServerRetry = useCallback(async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const res = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      if (res.status === 200) {
        setIsServerDown(false);
        setIsMaintenance(false);
        setIsInternalError(false);
        window.dispatchEvent(new CustomEvent('serverRestored'));
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }, []);

  // Handler to test and recover from Offline
  const handleOfflineRetry = useCallback(async () => {
    if (navigator.onLine) {
      setIsOffline(false);
      await handleServerRetry();
    }
  }, [handleServerRetry]);

  // 1. If offline, display the No Internet Connection page
  if (isOffline) {
    return <OfflinePage onRetry={handleOfflineRetry} />;
  }

  // 2. If system is in maintenance mode, display the Maintenance Mode page
  if (isMaintenance) {
    return <MaintenanceModePage onRetry={handleServerRetry} />;
  }

  // 3. If server is down, display the Server Not Responding page
  if (isServerDown) {
    return <ServerDownPage onRetry={handleServerRetry} />;
  }

  // 4. If session has expired globally, display Session Expired page
  if (isSessionExpired) {
    return <SessionExpiredPage />;
  }

  // 5. If critical 500 internal error occurred globally, display Internal Error page
  if (isInternalError) {
    return <InternalErrorPage onRetry={handleServerRetry} />;
  }

  // 6. Otherwise, render the normal application
  return <>{children}</>;
};

export default NetworkAndServerStatus;
