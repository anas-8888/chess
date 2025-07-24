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

  // Refs for activity monitoring
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isOnlineRef = useRef<boolean>(true);

  // Activity monitoring functions
  const updateUserStatus = async (status: 'online' | 'offline' | 'in-game') => {
    if (!authState.isAuthenticated) return;
    
    try {
      await userService.updateStatus(status);
      console.log(`User status updated to: ${status}`);
    } catch (error) {
      console.error('Failed to update user status:', error);
      // Don't throw error to avoid breaking the app
      // Just log it for debugging
    }
  };

  // Debounced status update to avoid too many requests
  const debouncedUpdateStatus = (() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastStatus: string | null = null;
    
    return (status: 'online' | 'offline' | 'in-game') => {
      if (lastStatus === status) return; // Skip if same status
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        updateUserStatus(status);
        lastStatus = status;
      }, 1000); // 1 second debounce
    };
  })();

  const resetActivityTimer = () => {
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    lastActivityRef.current = Date.now();
    
    // Set offline after 5 minutes of inactivity
    activityTimeoutRef.current = setTimeout(() => {
      if (isOnlineRef.current) {
        updateUserStatus('offline');
        isOnlineRef.current = false;
      }
    }, 5 * 60 * 1000); // 5 minutes
  };

      const handleUserActivity = () => {
      if (!isOnlineRef.current) {
        debouncedUpdateStatus('online');
        isOnlineRef.current = true;
      }
      resetActivityTimer();
    };

  // Set up activity monitoring
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    // Set initial online status
    debouncedUpdateStatus('online');
    resetActivityTimer();

    // Activity event listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (document.hidden) {
        debouncedUpdateStatus('offline');
        isOnlineRef.current = false;
      } else {
        debouncedUpdateStatus('online');
        isOnlineRef.current = true;
        resetActivityTimer();
      }
    };

    // Online/offline handlers
    const handleOnline = () => {
      debouncedUpdateStatus('online');
      isOnlineRef.current = true;
      resetActivityTimer();
    };

    const handleOffline = () => {
      debouncedUpdateStatus('offline');
      isOnlineRef.current = false;
    };

    // Before unload handler
    const handleBeforeUnload = () => {
      debouncedUpdateStatus('offline');
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      // Update status to offline when component unmounts
      debouncedUpdateStatus('offline');
      
      // Clear activity timer
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      
      // Remove event listeners
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
    
    authService.logout();
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
    });
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