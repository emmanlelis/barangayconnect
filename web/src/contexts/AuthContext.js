import React, { createContext, useContext, useState, useEffect } from 'react';
import { Modal } from 'antd';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const cachedAdmin = localStorage.getItem('adminUser');

      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/auth/admin/me');
        
        if (response.data.success) {
          const adminData = response.data.data.admin;
          setUser(adminData);
          setIsAuthenticated(true);
          localStorage.setItem('adminUser', JSON.stringify(adminData));
        } else {
          logout();
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      const status = error.response?.status;

      // Only force logout for invalid/expired auth.
      if (status === 401 || status === 403) {
        logout();
      } else {
        // Keep the user signed in during transient errors (e.g., 429 rate limit).
        const token = localStorage.getItem('adminToken');
        const cachedAdmin = localStorage.getItem('adminUser');

        if (token) {
          setIsAuthenticated(true);
          if (cachedAdmin) {
            try {
              setUser(JSON.parse(cachedAdmin));
            } catch (parseError) {
              console.error('Failed to parse cached admin data:', parseError);
            }
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      console.log('Attempting login with:', credentials.email);
      console.log('API base URL:', api.defaults.baseURL);
      
      const response = await api.post('/auth/login', credentials);
      
      console.log('Login response:', response.data);

      if (response.data?.data?.requiresOtp) {
        return {
          success: false,
          requiresOtp: true,
          setupRequired: !!response.data?.data?.setupRequired,
          verificationId: response.data?.data?.verificationId,
          setupKey: response.data?.data?.setupKey,
          otpAuthUrl: response.data?.data?.otpAuthUrl,
          accountLabel: response.data?.data?.accountLabel,
          issuer: response.data?.data?.issuer,
          message: response.data?.message || 'Authenticator code is required'
        };
      }
      
      if (response.data.success && response.data.data.isAdmin) {
        const { token, admin } = response.data.data;
        
        Modal.destroyAll();
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminUser', JSON.stringify(admin));
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        setUser(admin);
        setIsAuthenticated(true);
        
        console.log('Login successful');
        return { success: true };
      } else {
        console.error('Invalid credentials or insufficient permissions');
        console.error('Response data:', response.data);
        return { success: false, error: 'Invalid credentials or insufficient permissions' };
      }
    } catch (error) {
      console.error('Full error object:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);

      if (error.response?.data?.data?.requiresOtp) {
        return {
          success: false,
          requiresOtp: true,
          setupRequired: !!error.response?.data?.data?.setupRequired,
          verificationId: error.response?.data?.data?.verificationId,
          setupKey: error.response?.data?.data?.setupKey,
          otpAuthUrl: error.response?.data?.data?.otpAuthUrl,
          accountLabel: error.response?.data?.data?.accountLabel,
          issuer: error.response?.data?.data?.issuer,
          message: error.response?.data?.message || 'Authenticator code is required'
        };
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      console.error('Login error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    Modal.destroyAll();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
    console.log('Logged out successfully');
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
