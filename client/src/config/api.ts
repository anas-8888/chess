import axios from 'axios';
import { API_BASE_URL } from '@/config/urls';

// API Configuration
export { API_BASE_URL } from '@/config/urls';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle auth errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Try to refresh token
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token })
          });
          
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.data && refreshData.data.token) {
              const newToken = refreshData.data.token;
              localStorage.setItem('token', newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return api(originalRequest);
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
      
      // If refresh failed or no token, logout
      localStorage.removeItem('token');
      window.location.href = '/auth';
    }
    
    return Promise.reject(error);
  }
);

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    REGISTER: `${API_BASE_URL}/api/auth/register`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout`,
    VALIDATE: `${API_BASE_URL}/api/auth/validate`,
  },
  USERS: {
    PROFILE: `${API_BASE_URL}/api/users/profile`,
    UPDATE: `${API_BASE_URL}/api/users/profile`,
  },
  GAMES: {
    DETAILS: `${API_BASE_URL}/api/game/:id`,
    STATE: `${API_BASE_URL}/api/game/:id/state`,
    CONTROL_PLAYER: `${API_BASE_URL}/api/game/control-player`,
  },
  COURSES: {
    LIST: `${API_BASE_URL}/api/courses`,
    DETAIL: `${API_BASE_URL}/api/courses/:id`,
  },
  PUZZLES: {
    LIST: `${API_BASE_URL}/api/puzzles`,
    DETAIL: `${API_BASE_URL}/api/puzzles/:id`,
  },
  FRIENDS: {
    LIST: `${API_BASE_URL}/api/friends`,
    ADD: `${API_BASE_URL}/api/friends/request`,
    REMOVE: `${API_BASE_URL}/api/friends/:userId`,
  },
  LEADERBOARD: {
    GLOBAL: `${API_BASE_URL}/api/leaderboard/global`,
    FRIENDS: `${API_BASE_URL}/api/leaderboard/friends`,
  },
};

// HTTP Client Configuration
export const HTTP_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include' as RequestCredentials,
};

// Helper function to get auth headers
export const getAuthHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}; 
