import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/shared/auth/auth-context";
import { isAdminUser } from "@/lib/auth/roles";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!currentUser) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminUser(currentUser)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
