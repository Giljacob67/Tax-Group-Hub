import type { ReactNode } from "react";
import { useCurrentUser, type Permission } from "@/hooks/use-current-user";

type CanProps = {
  permission?: Permission | Permission[];
  anyOf?: Permission[];
  allOf?: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function Can({ permission, anyOf, allOf, fallback = null, children }: CanProps) {
  const { has, hasAny, hasAll } = useCurrentUser();

  if (anyOf && anyOf.length > 0) {
    if (!hasAny(anyOf)) return <>{fallback}</>;
  }
  if (allOf && allOf.length > 0) {
    if (!hasAll(allOf)) return <>{fallback}</>;
  }
  if (permission !== undefined) {
    const perms = Array.isArray(permission) ? permission : [permission];
    if (!perms.every(has)) return <>{fallback}</>;
  }

  return <>{children}</>;
}
