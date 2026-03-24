import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { authService, User, AuthState } from '@/services/authService';
import { userService } from '@/services/userService';

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateStatus: (status: 'online' | 'offline' | 'in-game') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
  });

  // Connection refs
  const isOnlineRef = useRef<boolean>(true);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateUserStatus = async (status: 'online' | 'offline' | 'in-game') => {
    if (!authState.isAuthenticated) return;

    try {
      await userService.updateStatus(status);
      console.log('User status updated to: ' + status);
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  };

  // Debounced status update to avoid too many requests
  const debouncedUpdateStatus = (() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastStatus: string | null = null;

    return (status: 'online' | 'offline' | 'in-game') => {
      if (lastStatus === status) return;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        updateUserStatus(status);
        lastStatus = status;
      }, 500);
    };
  })();

  // Keep user online while authenticated unless network is actually offline.
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    debouncedUpdateStatus('online');
    isOnlineRef.current = true;

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (navigator.onLine !== false) {
        debouncedUpdateStatus('online');
      }
    }, 30000);

    const handleOnline = () => {
      debouncedUpdateStatus('online');
      isOnlineRef.current = true;
    };

    const handleOffline = () => {
      debouncedUpdateStatus('offline');
      isOnlineRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && navigator.onLine !== false) {
        debouncedUpdateStatus('online');
        isOnlineRef.current = true;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authState.isAuthenticated]);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const isValid = await authService.validateToken();
          if (isValid) {
            const user = authService.getCurrentUser();
            const token = authService.getToken();
            setAuthState({
              isAuthenticated: true,
              user,
              token,
              loading: false,
            });
          } else {
            setAuthState({
              isAuthenticated: false,
              user: null,
              token: null,
              loading: false,
            });
          }
        } else {
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
        });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = (token: string, user: User) => {
    authService.setAuth(token, user);
    setAuthState({
      isAuthenticated: true,
      user,
      token,
      loading: false,
    });
  };

  // Logout function
  const logout = async () => {
    // Update status to offline before logout
    try {
      await updateUserStatus('offline');
    } catch (error) {
      console.error('Failed to update status on logout:', error);
    }
    
    // Call authService logout which will handle server logout
    await authService.logout();
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
    });
    
    // Redirect to login page
    window.location.href = '/auth';
  };

  // Refresh auth function
  const refreshAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      if (authService.isAuthenticated()) {
        const isValid = await authService.validateToken();
        if (isValid) {
          const user = authService.getCurrentUser();
          const token = authService.getToken();
          setAuthState({
            isAuthenticated: true,
            user,
            token,
            loading: false,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
          });
        }
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Auth refresh error:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
      });
    }
  };

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshAuth,
    updateStatus: updateUserStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 

