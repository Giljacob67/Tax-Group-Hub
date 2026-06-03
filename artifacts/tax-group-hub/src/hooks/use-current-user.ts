import { useGetCrmMe } from "@workspace/api-client-react";
import type { GetCrmMe200 } from "@workspace/api-client-react";

export type CurrentUser = NonNullable<GetCrmMe200["user"]>;
export type Permission = keyof CurrentUser["permissions"];

const EMPTY_USER: CurrentUser = {
  userId: "anonymous",
  roles: ["leitura"],
  permissions: {
    canViewAll: true,
    canEditAll: false,
    canManageUsers: false,
    canManageSettings: false,
    canEditPipeline: false,
    canEditStatus: false,
    canCreateLists: false,
    canDeleteLists: false,
    canEditSystemViews: false,
    canExport: false,
    canTriggerIA: false,
    canManageAutomations: false,
    canViewDashboards: true,
    canViewAudit: false,
    canEditProposals: false,
  },
};

export function useCurrentUser() {
  const { data, isLoading, error, refetch } = useGetCrmMe({
    query: {
      queryKey: ["/api/crm/me"],
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  });

  const user: CurrentUser = (data as any)?.user ?? EMPTY_USER;

  const has = (permission: Permission): boolean => {
    return Boolean(user.permissions?.[permission]);
  };

  const hasAny = (permissions: Permission[]): boolean => {
    return permissions.some(has);
  };

  const hasAll = (permissions: Permission[]): boolean => {
    return permissions.every(has);
  };

  const isAdmin = user.roles?.includes("admin") ?? false;
  const isCoordenador = user.roles?.includes("coordenador") ?? false;

  return {
    user,
    isLoading,
    error,
    refetch,
    has,
    hasAny,
    hasAll,
    isAdmin,
    isCoordenador,
  };
}
