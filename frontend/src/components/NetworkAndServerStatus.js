import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import OfflinePage from '../pages/OfflinePage';
import ServerDownPage from '../pages/ServerDownPage';

const NetworkAndServerStatus = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isServerDown, setIsServerDown] = useState(false);

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

  // Listen for custom server-down events from Axios interceptor
  useEffect(() => {
    const handleServerDownEvent = () => {
      setIsServerDown(true);
    };

    const handleServerUpEvent = () => {
      setIsServerDown(false);
    };

    window.addEventListener('showServerDown', handleServerDownEvent);
    window.addEventListener('serverRestored', handleServerUpEvent);

    return () => {
      window.removeEventListener('showServerDown', handleServerDownEvent);
      window.removeEventListener('serverRestored', handleServerUpEvent);
    };
  }, []);

  // Handler to test and recover from Server Down
  const handleServerRetry = useCallback(async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const res = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      if (res.status === 200) {
        setIsServerDown(false);
        window.dispatchEvent(new CustomEvent('serverRestored'));
        return true;
      }
    } catch (err) {
      // Still down
      return false;
    }
    return false;
  }, []);

  // Handler to test and recover from Offline
  const handleOfflineRetry = useCallback(async () => {
    if (navigator.onLine) {
      setIsOffline(false);
      // Also check if server is reachable
      await handleServerRetry();
    }
  }, [handleServerRetry]);

  // 1. If offline, display the No Internet Connection page
  if (isOffline) {
    return <OfflinePage onRetry={handleOfflineRetry} />;
  }

  // 2. If server is down, display the Server Not Responding page
  if (isServerDown) {
    return <ServerDownPage onRetry={handleServerRetry} />;
  }

  // 3. Otherwise, render the normal application
  return <>{children}</>;
};

export default NetworkAndServerStatus;
