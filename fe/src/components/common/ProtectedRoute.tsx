import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  staffOnly?: boolean;
  allowedUserTypes?: ('ADMIN' | 'STAFF' | 'USER')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly = false,
  staffOnly = false,
  allowedUserTypes
}) => {
  const { isAuthenticated, isAdmin, isStaff, userType, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (adminOnly && !isAdmin) {
        // Admin-only route, redirect non-admins to their dashboard
        if (isStaff) {
          router.push('/staff/dashboard');
        } else {
          router.push('/dashboard');
        }
      } else if (staffOnly && !isStaff && !isAdmin) {
        // Staff-only route, redirect non-staff
        router.push('/dashboard');
      } else if (allowedUserTypes && userType && !allowedUserTypes.includes(userType)) {
        // Route with specific allowed user types
        if (userType === 'ADMIN') {
          router.push('/admin/dashboard');
        } else if (userType === 'STAFF') {
          router.push('/staff/dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    }
  }, [isAuthenticated, isAdmin, isStaff, userType, isLoading, adminOnly, staffOnly, allowedUserTypes, router]);

  if (isLoading || !isAuthenticated ||
    (adminOnly && !isAdmin) ||
    (staffOnly && !isStaff && !isAdmin) ||
    (allowedUserTypes && userType && !allowedUserTypes.includes(userType))) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;