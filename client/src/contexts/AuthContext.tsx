import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, User, AuthState } from '@/services/authService';

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
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
  const logout = () => {
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