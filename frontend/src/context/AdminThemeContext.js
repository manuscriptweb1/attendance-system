import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const AdminThemeContext = createContext();

export const useAdminTheme = () => {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return context;
};

export const AdminThemeProvider = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);

  // Apply theme to document body
  useEffect(() => {
    if (!isAdmin) return;
    
    document.documentElement.classList.remove('admin-theme-dark', 'admin-theme-light');
    document.body.classList.remove('admin-theme-dark', 'admin-theme-light');
    
    document.documentElement.classList.add(`admin-theme-${theme}`);
    document.body.classList.add(`admin-theme-${theme}`);
    
    // Toggle standard Tailwind 'dark' class
    if (theme === 'dark') {
      document.body.classList.add('dark');
      document.documentElement.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
      document.documentElement.classList.remove('dark');
    }
  }, [theme, isAdmin]);

  // Load initial theme
  useEffect(() => {
    if (isAdmin && user) {
      // 1. Try to load from user object (set during login)
      let initialTheme = user.theme_preference;
      
      // 2. Fallback to localStorage for fast loading
      if (!initialTheme) {
        initialTheme = localStorage.getItem(`admin_theme_${user.id}`);
      }
      
      if (initialTheme) {
        setTheme(initialTheme);
      }

      // 3. Fetch from API to ensure we have the latest from DB
      const fetchTheme = async () => {
        try {
          const response = await api.get('/admins/theme');
          if (response.data.success && response.data.theme) {
            const fetchedTheme = response.data.theme;
            setTheme(fetchedTheme);
            localStorage.setItem(`admin_theme_${user.id}`, fetchedTheme);
            
            // Sync the user object in sessionStorage if it differs
            if (user.theme_preference !== fetchedTheme) {
                const updatedUser = { ...user, theme_preference: fetchedTheme };
                sessionStorage.setItem('user', JSON.stringify(updatedUser));
            }
          }
        } catch (error) {
          console.error('Failed to fetch admin theme', error);
        } finally {
          setIsLoadingTheme(false);
        }
      };

      fetchTheme();
    } else {
      setIsLoadingTheme(false);
      // Clean up body classes when not admin
      document.documentElement.classList.remove('admin-theme-dark', 'admin-theme-light', 'dark');
      document.body.classList.remove('admin-theme-dark', 'admin-theme-light', 'dark');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.id]); // Safely depend on user.id

  const toggleTheme = async () => {
    if (!isAdmin) return;
    
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    
    // Optimistic UI update
    setTheme(newTheme);
    
    if (user) {
      localStorage.setItem(`admin_theme_${user.id}`, newTheme);
      // Sync the user object in sessionStorage
      const updatedUser = { ...user, theme_preference: newTheme };
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
    }

    try {
      await api.patch('/admins/theme', { theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference to server', error);
      // Depending on requirements, we could revert if it fails, but typically local state is fine to keep
    }
  };

  const value = {
    theme,
    toggleTheme,
    isLoadingTheme
  };

  return (
    <AdminThemeContext.Provider value={value}>
      {children}
    </AdminThemeContext.Provider>
  );
};
