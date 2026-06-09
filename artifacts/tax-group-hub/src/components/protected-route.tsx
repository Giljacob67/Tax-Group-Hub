import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("demo") === "1";
  } catch {
    return false;
  }
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { token, isAdmin, user, isLoading } = useAuth();
  const demo = isDemoMode();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Verificando autenticação...</span>
        </div>
      </div>
    );
  }

  if (!demo && (!token || !user)) {
    return <Redirect to="/login" />;
  }

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
