// src/components/auth/AdminRoute.tsx
// Route guard — renders children only for users with role 'admin'.
// Anyone else (guests, regular users) is redirected to /home.
// NOTE: this only hides the UI; the API enforces admin access server-side.

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();

  // Wait for the session check on mount, otherwise a real admin
  // refreshing /admin would be bounced to /home before /api/auth/me returns.
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-cactus-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/home" replace />;

  return <>{children}</>;
}
