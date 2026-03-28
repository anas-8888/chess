import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '@/services/authService';
import { API_BASE_URL } from '@/config/urls';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  fallback = (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  ),
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
