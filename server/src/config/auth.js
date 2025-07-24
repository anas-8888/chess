// Authentication Configuration
export const AUTH_CONFIG = {
  // JWT Configuration
  JWT: {
    SECRET: process.env.JWT_SECRET || 'your-secret-key',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    ISSUER: 'smart-chess-api',
    AUDIENCE: 'smart-chess-users',
  },

  // Session Configuration
  SESSION: {
    POLICY: process.env.SESSION_POLICY || 'multiple',
    MAX_SESSIONS: parseInt(process.env.MAX_SESSIONS) || 5,
    CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
  },

  // Protected Routes Configuration
  PROTECTED_ROUTES: {
    // Auth routes that require authentication
    AUTH: [
      '/api/auth/logout',
      '/api/auth/refresh',
      '/api/auth/validate',
    ],
    
    // User routes
    USER: [
      '/api/users/*',
    ],
    
    // Game routes
    GAME: [
      '/api/games/*',
    ],
    
    // Friend routes
    FRIEND: [
      '/api/friends/*',
    ],
    
    // Invite routes
    INVITE: [
      '/api/invites/*',
    ],
    
    // Board routes
    BOARD: [
      '/api/boards/*',
    ],
    
    // Puzzle routes
    PUZZLE: [
      '/api/puzzles/*',
    ],
    
    // Course routes
    COURSE: [
      '/api/courses/*',
    ],
    
    // Challenge routes
    CHALLENGE: [
      '/api/challenges/*',
    ],
    
    // Leaderboard routes
    LEADERBOARD: [
      '/api/leaderboard/*',
    ],
    
    // Matchmaking routes
    MATCHMAKING: [
      '/api/matchmaking/*',
    ],
    
    // History routes
    HISTORY: [
      '/api/history/*',
    ],
  },

  // Public Routes (no authentication required)
  PUBLIC_ROUTES: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/validate',
    '/health',
    '/api/stats',
    '/api/search',
  ],

  // Error Messages
  ERROR_MESSAGES: {
    NO_TOKEN: 'Access denied. No token provided.',
    INVALID_TOKEN: 'Invalid or expired token.',
    TOKEN_EXPIRED: 'Token has expired.',
    USER_NOT_FOUND: 'User not found.',
    SESSION_EXPIRED: 'Session has expired.',
    AUTH_REQUIRED: 'Authentication required.',
  },

  // Success Messages
  SUCCESS_MESSAGES: {
    LOGIN_SUCCESS: 'Login successful.',
    REGISTER_SUCCESS: 'Registration successful.',
    LOGOUT_SUCCESS: 'Logout successful.',
    TOKEN_VALID: 'Token is valid.',
  },
};

// Helper function to check if route is protected
export const isProtectedRoute = (path) => {
  // Check if path matches any protected route pattern
  const protectedPatterns = [
    /^\/api\/auth\/(?!login|register|validate$)/,
    /^\/api\/users\//,
    /^\/api\/games\//,
    /^\/api\/friends\//,
    /^\/api\/invites\//,
    /^\/api\/boards\//,
    /^\/api\/puzzles\//,
    /^\/api\/courses\//,
    /^\/api\/challenges\//,
    /^\/api\/leaderboard\//,
    /^\/api\/matchmaking\//,
    /^\/api\/history\//,
  ];

  return protectedPatterns.some(pattern => pattern.test(path));
};

// Helper function to check if route is public
export const isPublicRoute = (path) => {
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/validate',
    '/health',
    '/api/stats',
    '/api/search',
  ];

  return publicRoutes.includes(path);
}; 