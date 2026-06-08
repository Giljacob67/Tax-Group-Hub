import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  Search,
  X,
  Filter,
  Calendar,
  User,
  AlertCircle,
  Shield,
  KeyRound,
  UserPlus,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: number;
  actorId: number | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

async function fetchAuditLogs(token: string, limit = 100, offset = 0): Promise<{
  logs: AuditLog[];
  pagination: { total: number; limit: number; offset: number };
}> {
  const res = await fetch(`/api/auth/audit-logs?limit=${limit}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}

const ACTION_ICONS: Record<string, any> = {
  "user.login": User,
  "user.2fa_enabled": Shield,
  "user.2fa_disabled": Shield,
  "admin.user_created": UserPlus,
  "admin.user_deactivated": UserX,
  "admin.password_reset": KeyRound,
};

const ACTION_LABELS: Record<string, string> = {
  "user.login": "Login realizado",
  "user.login_failed": "Login falhou",
  "user.2fa_enabled": "2FA ativado",
  "user.2fa_disabled": "2FA desativado",
  "admin.user_created": "Usuário criado",
  "admin.user_deactivated": "Usuário desativado",
  "admin.password_reset": "Senha resetada",
};

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogsPage() {
  usePageTitle("Logs de Auditoria");
  const { token, isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetchAuditLogs(token!),
    enabled: !!token && isAdmin,
  });

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return undefined;
    return data.logs.filter((log) => {
      const lowerSearch = search.toLowerCase();
      const matchesSearch =
        !search ||
        log.actorEmail?.toLowerCase().includes(lowerSearch) ||
        log.action.toLowerCase().includes(lowerSearch) ||
        log.resourceId?.toLowerCase().includes(lowerSearch);

      const matchesAction = actionFilter === "all" || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [data?.logs, search, actionFilter]);

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
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

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Logs de Auditoria
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Histórico de ações administrativas e de segurança
            </p>
          </div>
        </motion.div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Atividade Recente</CardTitle>
                <CardDescription>
                  {data?.pagination?.total ?? 0} registro(s) encontrado(s)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email ou ação..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filtrar por ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    <SelectItem value="user.login">Logins</SelectItem>
                    <SelectItem value="admin.user_created">Criação de usuários</SelectItem>
                    <SelectItem value="admin.user_deactivated">Desativações</SelectItem>
                    <SelectItem value="admin.password_reset">Reset de senhas</SelectItem>
                    <SelectItem value="user.2fa_enabled">2FA ativado</SelectItem>
                    <SelectItem value="user.2fa_disabled">2FA desativado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const Icon = ACTION_ICONS[log.action] || FileText;
                  const label = ACTION_LABELS[log.action] || log.action;

                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{label}</span>
                          <Badge variant="outline" className="text-xs">
                            {log.resourceType}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {log.actorEmail ? (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.actorEmail}
                            </span>
                          ) : (
                            <span className="italic">Sistema</span>
                          )}
                          {log.resourceId && (
                            <span className="ml-2">
                              ID: {log.resourceId}
                            </span>
                          )}
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono text-muted-foreground">
                            {JSON.stringify(log.details, null, 2)}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(log.createdAt)}
                        </div>
                        {log.ipAddress && (
                          <div className="mt-1">{log.ipAddress}</div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {search || actionFilter !== "all" ? (
                  <>
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum log encontrado para os filtros selecionados</p>
                  </>
                ) : (
                  <>
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum log registrado ainda</p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
