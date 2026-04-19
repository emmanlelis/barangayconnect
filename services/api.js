import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear it and redirect to login
      SecureStore.deleteItemAsync('authToken');
      SecureStore.deleteItemAsync('userInfo');
      // You might want to navigate to login screen here
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authAPI = {
  // Register user
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      if (response.data.success) {
        await SecureStore.setItemAsync('authToken', response.data.data.token);
        await SecureStore.setItemAsync('userInfo', JSON.stringify(response.data.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Registration failed' };
    }
  },

  // Login user/admin
  login: async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.success) {
        await SecureStore.setItemAsync('authToken', response.data.data.token);
        
        if (response.data.data.isAdmin) {
          await SecureStore.setItemAsync('isAdmin', 'true');
          await SecureStore.setItemAsync('userInfo', JSON.stringify(response.data.data.admin));
        } else {
          await SecureStore.setItemAsync('isAdmin', 'false');
          await SecureStore.setItemAsync('userInfo', JSON.stringify(response.data.data.user));
        }
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Login failed' };
    }
  },

  // Get current user profile
  getProfile: async () => {
    try {
      const isAdmin = await SecureStore.getItemAsync('isAdmin');
      const endpoint = isAdmin === 'true' ? '/auth/admin/me' : '/auth/me';
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get profile' };
    }
  },

  // Logout
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('userInfo');
      await SecureStore.deleteItemAsync('isAdmin');
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      throw { message: 'Logout failed' };
    }
  },

  // Check if user is logged in
  isLoggedIn: async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      return !!token;
    } catch (error) {
      return false;
    }
  },

  // Get stored user info
  getUserInfo: async () => {
    try {
      const userInfo = await SecureStore.getItemAsync('userInfo');
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
      return null;
    }
  },

  // Check if admin
  isAdmin: async () => {
    try {
      const isAdmin = await SecureStore.getItemAsync('isAdmin');
      return isAdmin === 'true';
    } catch (error) {
      return false;
    }
  }
};

// Complaint Services
export const complaintAPI = {
  // Submit new complaint
  submit: async (complaintData) => {
    try {
      const response = await api.post('/complaints', complaintData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to submit complaint' };
    }
  },

  // Get user's complaints
  getMyComplaints: async (filters = {}) => {
    try {
      const response = await api.get('/complaints/my', { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get complaints' };
    }
  },

  // Get single complaint details
  getComplaint: async (id) => {
    try {
      const response = await api.get(`/complaints/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get complaint' };
    }
  },

  // Submit feedback for resolved complaint
  submitFeedback: async (id, feedback) => {
    try {
      const response = await api.post(`/complaints/${id}/feedback`, feedback);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to submit feedback' };
    }
  }
};

// Upload Services
export const uploadAPI = {
  // Upload single image
  uploadSingle: async (formData) => {
    try {
      const response = await api.post('/upload/single', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to upload image' };
    }
  },

  // Upload multiple images
  uploadMultiple: async (formData) => {
    try {
      const response = await api.post('/upload/multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to upload images' };
    }
  },

  // Upload complaint images
  uploadComplaintImages: async (formData) => {
    try {
      const response = await api.post('/upload/complaint', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to upload complaint images' };
    }
  },

  // Upload profile picture
  uploadProfilePicture: async (formData) => {
    try {
      const response = await api.post('/upload/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to upload profile picture' };
    }
  }
};

// User Services
export const userAPI = {
  // Update profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/users/profile', profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update profile' };
    }
  },

  // Change password
  changePassword: async (passwordData) => {
    try {
      const response = await api.put('/users/password', passwordData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to change password' };
    }
  },

  // Get user statistics
  getStats: async () => {
    try {
      const response = await api.get('/users/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get statistics' };
    }
  }
};

// Admin Services
export const adminAPI = {
  // Get dashboard data
  getDashboard: async () => {
    try {
      const response = await api.get('/admin/dashboard');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get dashboard data' };
    }
  },

  // Get all complaints
  getComplaints: async (filters = {}) => {
    try {
      const response = await api.get('/admin/complaints', { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get complaints' };
    }
  },

  // Update complaint status
  updateComplaintStatus: async (id, statusData) => {
    try {
      const response = await api.put(`/complaints/${id}/status`, statusData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update complaint status' };
    }
  },

  // Add admin note
  addAdminNote: async (id, noteData) => {
    try {
      const response = await api.post(`/complaints/${id}/notes`, noteData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to add admin note' };
    }
  },

  // Assign complaint
  assignComplaint: async (id, assignData) => {
    try {
      const response = await api.put(`/complaints/${id}/assign`, assignData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to assign complaint' };
    }
  },

  // Get users
  getUsers: async (filters = {}) => {
    try {
      const response = await api.get('/admin/users', { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get users' };
    }
  }
};

// Health check
export const healthAPI = {
  check: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data;
    } catch (error) {
      throw { message: 'Server is not available' };
    }
  }
};

export default api;
