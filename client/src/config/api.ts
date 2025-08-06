import axios from 'axios';

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.204.221:3000';

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
    const token = localStorage.getItem('auth_token');
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
  (error) => {
    // Handle auth errors
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
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
    UPDATE: `${API_BASE_URL}/api/users/update`,
  },
  GAMES: {
    CREATE: `${API_BASE_URL}/api/games/create`,
    JOIN: `${API_BASE_URL}/api/games/join`,
    MOVE: `${API_BASE_URL}/api/games/move`,
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
    ADD: `${API_BASE_URL}/api/friends/add`,
    REMOVE: `${API_BASE_URL}/api/friends/remove`,
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