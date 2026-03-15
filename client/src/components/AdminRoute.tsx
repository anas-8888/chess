import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '@/services/authService';
import { API_BASE_URL } from '@/config/urls';

interface AdminRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  fallback = <div className="flex items-center justify-center min-h-screen">جاري التحقق من صلاحيات المدير...</div>,
}) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const validateAdminAccess = async () => {
      try {
        if (!authService.isAuthenticated()) {
          setIsAllowed(false);
          return;
        }

        const isTokenValid = await authService.validateToken();
        if (!isTokenValid) {
          setIsAllowed(false);
          return;
        }

        const currentUser = authService.getCurrentUser();
        if (currentUser?.type !== 'admin') {
          setIsAllowed(false);
          return;
        }

        const token = authService.getToken();
        if (!token) {
          setIsAllowed(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/admin/access`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setIsAllowed(response.ok);
      } catch {
        setIsAllowed(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateAdminAccess();
  }, []);

  if (isValidating) {
    return <>{fallback}</>;
  }

  if (!authService.isAuthenticated()) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
