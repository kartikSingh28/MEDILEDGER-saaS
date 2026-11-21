import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getSession, homeFor, type Role } from "../lib/session";

// Signed-in users with the right role only; others go to sign in or their own home
export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const session = getSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.role !== role) {
    return <Navigate to={homeFor(session.role)} replace />;
  }

  return <>{children}</>;
}

// Sign in / sign up: already signed-in users go straight to their dashboard
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const session = getSession();
  if (session && homeFor(session.role) !== "/") {
    return <Navigate to={homeFor(session.role)} replace />;
  }
  return <>{children}</>;
}
