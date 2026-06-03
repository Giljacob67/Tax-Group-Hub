import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check, ChevronDown, ChevronRight, Loader2, Plus, Shield, Trash2,
  UserCog, UserPlus, Users as UsersIcon, X,
} from "lucide-react";
import {
  useGrantCrmUserRole,
  useListCrmRoles,
  useListCrmUsers,
  useRevokeCrmUserRole,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";

type UserRole = {
  id: number;
  role: string;
  scope: string | null;
  isActive: boolean;
  grantedAt?: string;
};

type CrmUser = {
  userId: string;
  roles: UserRole[];
};

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin:       { label: "Admin",       color: "bg-red-500/10 text-red-400 border-red-500/30" },
  coordenador: { label: "Coordenação", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  comercial:   { label: "Comercial",   color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  marketing:   { label: "Marketing",   color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  leitura:     { label: "Leitura",     color: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
};

function RoleBadge({ role, isActive }: { role: string; isActive?: boolean }) {
  const cfg = ROLE_BADGE[role] || { label: role, color: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={`${cfg.color} text-[10px] ${!isActive ? "opacity-50 line-through" : ""}`}>
      {cfg.label}
    </Badge>
  );
}

function GrantRoleDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const rolesQuery = useListCrmRoles({ query: { queryKey: ["/api/crm/roles"] } });
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [scope, setScope] = useState("");

  const grantMutation = useGrantCrmUserRole({
    mutation: {
      onSuccess: () => {
        toast({ title: "Papel atribuído" });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/users"] });
        onOpenChange(false);
        setSelectedRole("");
        setScope("");
      },
      onError: () => toast({ title: "Erro ao atribuir papel", variant: "destructive" }),
    },
  });

  const submit = () => {
    if (!selectedRole) return;
    grantMutation.mutate({
      userId,
      data: {
        role: selectedRole as any,
        scope: scope.trim() || undefined,
      },
    });
  };

  const roles: string[] = (rolesQuery.data as any)?.roles ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Atribuir papel
          </DialogTitle>
          <DialogDescription>
            Para o usuário <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{userId}</code>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-select" className="text-xs">Papel</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select" className="h-9">
                <SelectValue placeholder="Selecione um papel" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r} value={r}>
                    {ROLE_BADGE[r]?.label || r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-scope" className="text-xs">Escopo (opcional)</Label>
            <Input
              id="role-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="ex: agro, logistica"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Vazio = papel global. Use um valor para limitar o escopo.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!selectedRole || grantMutation.isPending}>
            {grantMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({ user }: { user: CrmUser }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);

  const revokeMutation = useRevokeCrmUserRole({
    mutation: {
      onSuccess: () => {
        toast({ title: "Papel removido" });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/users"] });
      },
      onError: () => toast({ title: "Erro ao remover papel", variant: "destructive" }),
    },
  });

  const activeRoles = user.roles.filter(r => r.isActive);
  const inactiveRoles = user.roles.filter(r => !r.isActive);

  return (
    <>
      <tr className="border-b border-border/40 hover:bg-muted/20">
        <td className="p-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
          >
            {expanded
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />}
            <UsersIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">{user.userId}</span>
          </button>
        </td>
        <td className="p-3">
          <div className="flex flex-wrap gap-1">
            {activeRoles.length === 0
              ? <span className="text-xs text-muted-foreground">— sem papéis —</span>
              : activeRoles.map(r => <RoleBadge key={r.id} role={r.role} isActive />)}
            {inactiveRoles.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-1">
                (+{inactiveRoles.length} inativo{inactiveRoles.length !== 1 ? "s" : ""})
              </span>
            )}
          </div>
        </td>
        <td className="p-3 text-right">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setGrantOpen(true)}>
            <Plus className="w-3 h-3 mr-1" /> Atribuir
          </Button>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={3} className="p-4">
            {user.roles.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum papel atribuído a este usuário.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left p-1.5">Papel</th>
                    <th className="text-left p-1.5">Escopo</th>
                    <th className="text-left p-1.5">Concedido em</th>
                    <th className="text-left p-1.5">Status</th>
                    <th className="text-right p-1.5">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {user.roles.map(r => (
                    <tr key={r.id} className="border-t border-border/30">
                      <td className="p-1.5"><RoleBadge role={r.role} isActive={r.isActive} /></td>
                      <td className="p-1.5 text-muted-foreground">{r.scope || "(global)"}</td>
                      <td className="p-1.5 text-muted-foreground">
                        {r.grantedAt ? new Date(r.grantedAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-1.5">
                        {r.isActive
                          ? <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Ativo</Badge>
                          : <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-500/30">Inativo</Badge>}
                      </td>
                      <td className="p-1.5 text-right">
                        {r.isActive && (
                          <Button
                            variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-red-400"
                            onClick={() => revokeMutation.mutate({ userId: user.userId, roleId: r.id })}
                            disabled={revokeMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}

      <GrantRoleDialog userId={user.userId} open={grantOpen} onOpenChange={setGrantOpen} />
    </>
  );
}

export default function RolesAdminPanel() {
  const { has, user } = useCurrentUser();
  const { toast } = useToast();
  const usersQuery = useListCrmUsers({
    query: { queryKey: ["/api/crm/users"], refetchOnWindowFocus: false },
  });
  const rolesQuery = useListCrmRoles({
    query: { queryKey: ["/api/crm/roles"] },
  });

  const users: CrmUser[] = (usersQuery.data as any)?.users ?? [];
  const roles: string[] = (rolesQuery.data as any)?.roles ?? [];

  if (!has("canManageUsers")) {
    return (
      <Card className="border-border/50 bg-card/50 h-full">
        <CardContent className="p-10 text-center">
          <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Acesso restrito</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Apenas administradores podem gerenciar papéis de usuários. Seu papel atual:
            {" "}
            <Badge variant="outline" className="text-[10px]">
              {user.roles.join(", ")}
            </Badge>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" /> Usuários & Papéis
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Defina quem pode fazer o quê no CRM. {users.length} usuário{users.length !== 1 ? "s" : ""} · {roles.length} papéis disponíveis.
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled>
          <UserPlus className="w-3 h-3" /> Convidar (em breve)
        </Button>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto">
        {usersQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-14">
            <UsersIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum usuário encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              À medida que sua equipe usa o CRM, os usuários aparecem aqui.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border/40 bg-muted/20">
                <th className="text-left p-3 font-medium">Usuário</th>
                <th className="text-left p-3 font-medium">Papéis</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => <UserRow key={u.userId} user={u} />)}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
