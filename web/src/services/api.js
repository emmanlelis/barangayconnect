import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      // Token expired or invalid
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/admin/me'),
  changeAdminPassword: (data) => api.put('/auth/admin/change-password', data),
};

// Admin Services
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getComplaints: (params) => api.get('/admin/complaints', { params }),
  updateComplaintStatus: (id, data) => api.put(`/admin/complaints/${id}/status`, data),
  addAdminNote: (id, data) => api.post(`/admin/complaints/${id}/notes`, data),
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUserStatus: (id, data) => api.put(`/admin/users/${id}/status`, data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  resetUserPassword: (id, data) => api.put(`/admin/users/${id}/reset-password`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  hardDeleteUser: (id, data) => api.post(`/admin/users/${id}/permanent-delete`, data),
  recoverUser: (id) => api.put(`/admin/users/${id}/recover`),
  getComplaintDetail: (id) => api.get(`/admin/complaints/${id}`),
  getNotifications: () => api.get('/admin/notifications'),
  markNotificationRead: (notificationId) => api.put(`/admin/notifications/${notificationId}/read`),
  clearAllNotifications: () => api.delete('/admin/notifications'),
  getUserStats: () => api.get('/admin/users/stats'),
  getAnalytics: (dateRange) => api.get('/admin/analytics', { params: { dateRange } }),
  getBlotters: (params) => api.get('/blotters', { params }),
  getBlotterById: (id) => api.get(`/blotters/${id}`),
  updateBlotterStatus: (id, data) => api.put(`/blotters/${id}`, data),
  deleteBlotter: (id) => api.delete(`/blotters/${id}`),
  uploadAttachment: (formData) => api.post('/upload/attachment', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
  uploadSingleImage: (formData) => api.post('/upload/single-admin', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
  createComplaint: (data) => api.post('/complaints', data),
  createManualBlotter: (data) => api.post('/admin/blotters', data),
  sendSubpoenaEmail: (caseNumber, data) => api.post('/blotters/subpoena-email', { caseNumber, ...data }),
  searchUsers: (params) => api.get('/admin/users', { params }),
  getMediationComplaints: () => api.get('/admin/complaints/mediation'),
  attachDefendant: (complaintId, data) => api.put(`/admin/complaints/${complaintId}/defendant`, data),
  scheduleMediation: (complaintId, data) => api.put(`/admin/complaints/${complaintId}/mediation`, data),
  getDocumentTemplates: () => api.get('/admin/documents/templates'),
  createDocumentTemplate: (data) => api.post('/admin/documents/templates', data),
  updateDocumentTemplate: (templateKey, data) => api.put(`/admin/documents/templates/${templateKey}`, data),
  deleteDocumentTemplate: (templateKey) => api.delete(`/admin/documents/templates/${templateKey}`),
  
  // Mail Settings
  getMailSettings: () => api.get('/admin/mail-settings'),
  saveMailSettings: (data) => api.post('/admin/mail-settings', data),
  testMailSettings: (data) => api.post('/admin/mail-settings/test', data),
  
  // Calendar Schedule
  getScheduledEvents: (params) => api.get('/blotters/scheduled', { params }),
};

// Complaint Services
export const complaintAPI = {
  getComplaint: (id) => api.get(`/complaints/${id}`),
  submitFeedback: (id, data) => api.post(`/complaints/${id}/feedback`, data),
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
