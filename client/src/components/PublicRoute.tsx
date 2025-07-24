import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '@/services/authService';

interface PublicRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ 
  children, 
  fallback = <div className="flex items-center justify-center min-h-screen">جاري التحقق من المصادقة...</div> 
}) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const validateAuth = async () => {
      try {
        // Check if user is authenticated locally
        if (authService.isAuthenticated()) {
          // Validate token with server
          const isValid = await authService.validateToken();
          setIsAuthenticated(isValid);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth validation error:', error);
        setIsAuthenticated(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateAuth();
  }, []);

  // Show loading while validating
  if (isValidating) {
    return <>{fallback}</>;
  }

  // If authenticated, redirect to dashboard or intended page
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  // Render children if not authenticated
  return <>{children}</>;
};

export default PublicRoute; 