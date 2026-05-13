import { useMemo } from "react";
import { useLocation } from "wouter";

/**
 * Detecta modo de demonstração via query parameter `?demo=1`.
 * Quando ativo, o frontend exibe dados demonstrativos e copy de apresentação.
 * Não persiste nada no backend e não altera autenticação.
 */
export function useDemoMode(): { isDemo: boolean } {
  const [location] = useLocation();

  const isDemo = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("demo") === "1";
    } catch {
      return false;
    }
  }, [location]);

  return { isDemo };
}
