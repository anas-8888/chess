// Environment Configuration
export const ENV = {
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL || 'http://192.168.1.4:3000',
  
  // App Configuration
  APP_NAME: 'شطرنج العرب',
  APP_VERSION: '1.0.0',
  
  // Development Configuration
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
  
  // Feature Flags
  ENABLE_DEBUG: import.meta.env.DEV,
  ENABLE_LOGGING: import.meta.env.DEV,
};

// Default API timeout
export const API_TIMEOUT = 10000; // 10 seconds

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
};

// Validation Rules
export const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9_\u0600-\u06FF\s]+$/,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 100,
  },
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'خطأ في الاتصال بالخادم',
  VALIDATION_ERROR: 'بيانات غير صحيحة',
  AUTH_ERROR: 'خطأ في المصادقة',
  SERVER_ERROR: 'خطأ في الخادم',
  UNKNOWN_ERROR: 'خطأ غير معروف',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'تم تسجيل الدخول بنجاح',
  REGISTER_SUCCESS: 'تم إنشاء الحساب بنجاح',
  LOGOUT_SUCCESS: 'تم تسجيل الخروج بنجاح',
  UPDATE_SUCCESS: 'تم التحديث بنجاح',
}; 