import axios from 'axios';

// Resolve API base at runtime so cached builds still hit the correct backend
const API_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  registerTenant: (data) => api.post('/auth/register-tenant', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout')
};

// Tenant APIs
export const tenantAPI = {
  getTenant: (id) => api.get(`/tenants/${id}`),
  updateTenant: (id, data) => api.put(`/tenants/${id}`, data),
  listTenants: (params) => api.get('/tenants', { params })
};

// User APIs
export const userAPI = {
  addUser: (tenantId, data) => api.post(`/users/tenants/${tenantId}/users`, data),
  listUsers: (tenantId, params) => api.get(`/users/tenants/${tenantId}/users`, { params }),
  updateUser: (userId, data) => api.put(`/users/${userId}`, data),
  deleteUser: (userId) => api.delete(`/users/${userId}`)
};

// Project APIs
export const projectAPI = {
  createProject: (data) => api.post('/projects', data),
  listProjects: (params) => api.get('/projects', { params }),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/projects/${id}`)
};

// Task APIs
export const taskAPI = {
  createTask: (projectId, data) => api.post(`/projects/${projectId}/tasks`, data),
  listTasks: (projectId, params) => api.get(`/projects/${projectId}/tasks`, { params }),
  // Status/update use dedicated /api/tasks endpoint (no projectId needed)
  updateTaskStatus: (taskId, data) => api.patch(`/tasks/${taskId}/status`, data),
  updateTask: (taskId, data) => api.put(`/tasks/${taskId}`, data)
};

export default api;
