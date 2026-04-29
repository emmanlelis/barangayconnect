import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const extractProfileFromResponse = (payload) => {
    return payload?.data?.user || payload?.data?.admin || null;
  };

  const refreshProfile = async () => {
    try {
      const profileResponse = await authAPI.getProfile();
      const profile = extractProfileFromResponse(profileResponse);
      if (profile) {
        setUser(profile);
        await SecureStore.setItemAsync('userInfo', JSON.stringify(profile));
      }
      return { success: true, user: profile };
    } catch (error) {
      return { success: false, message: error?.message || 'Failed to refresh profile' };
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const loggedIn = await authAPI.isLoggedIn();
        if (loggedIn) {
          const refreshResult = await refreshProfile();
          if (!refreshResult.success || !refreshResult.user) {
            const storedUser = await authAPI.getUserInfo();
            setUser(storedUser || null);
          }
        }
        // load stored dark mode preference
        try {
          const stored = await SecureStore.getItemAsync('darkMode');
          if (stored !== null) {
            setIsDarkMode(stored === 'true');
          }
        } catch (err) {
          // ignore
        }
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    const persist = async () => {
      try {
        await SecureStore.setItemAsync('darkMode', isDarkMode ? 'true' : 'false');
      } catch (err) {
        // ignore
      }
    };
    persist();
  }, [isDarkMode]);

  const login = async (credentials) => {
    try {
      const result = await authAPI.login(credentials);
      if (result?.success) {
        const refreshResult = await refreshProfile();
        if (!refreshResult.success || !refreshResult.user) {
          const info = await authAPI.getUserInfo();
          setUser(info || null);
        }
      }
      return result;
    } catch (error) {
      return { success: false, message: error?.message || 'Login failed' };
    }
  };

  const register = async (payload) => {
    try {
      const result = await authAPI.register(payload);
      if (result?.success) {
        const refreshResult = await refreshProfile();
        if (!refreshResult.success || !refreshResult.user) {
          const info = await authAPI.getUserInfo();
          setUser(info || null);
        }
      }
      return result;
    } catch (error) {
      return { success: false, message: error?.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
      return { success: true };
    } catch (error) {
      return { success: false, message: error?.message || 'Logout failed' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshProfile, isDarkMode, setIsDarkMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
