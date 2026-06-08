import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { token, isAdmin, user } = useAuth();

  // Not authenticated
  if (!token || !user) {
    return <Redirect to="/login" />;
  }

  // Requires admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Acesso Restrito
          </h2>
          <p className="text-muted-foreground">
            Esta página é acessível apenas para administradores.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
