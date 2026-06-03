import { useMemo, useState } from "react";
import {
  Activity, Bot, BotIcon, FileText, Filter, Loader2, Plug, RefreshCw,
  ScrollText, Server, User as UserIcon, Zap,
} from "lucide-react";
import {
  useGetCrmAuditLog,
  useGetCrmGovernanceRecent,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ACTOR_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  user:        { icon: UserIcon, color: "text-blue-400",    label: "Usuário" },
  ia:          { icon: Bot,      color: "text-purple-400",  label: "IA" },
  automation:  { icon: Zap,      color: "text-amber-400",   label: "Automação" },
  integration: { icon: Plug,     color: "text-emerald-400", label: "Integração" },
  service:     { icon: Server,   color: "text-slate-400",   label: "Serviço" },
};

const ENTITY_TYPES = [
  { value: "all",       label: "Todos" },
  { value: "contact",   label: "Contato" },
  { value: "deal",      label: "Negócio" },
  { value: "task",      label: "Tarefa" },
  { value: "view",      label: "View" },
  { value: "automation",label: "Automação" },
  { value: "sequence",  label: "Sequência" },
  { value: "alert",     label: "Alerta" },
];

const ACTOR_TYPES = [
  { value: "all",         label: "Todos" },
  { value: "user",        label: "Usuário" },
  { value: "ia",          label: "IA" },
  { value: "automation",  label: "Automação" },
  { value: "integration", label: "Integração" },
  { value: "service",     label: "Serviço" },
];

type AuditEntry = {
  id: number;
  userId: string;
  actorId?: string | null;
  actorType: string;
  entityType: string;
  entityId: number;
  action: string;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  context?: Record<string, any>;
  createdAt: string;
};

type RecentEntry = {
  source: "audit" | "activity";
  id: number;
  type: string;
  entityType: string;
  entityId: number;
  actorType: string;
  actorId?: string | null;
  title: string;
  description: string;
  createdAt: string;
};

function ActorIcon({ actorType, className }: { actorType: string; className?: string }) {
  const cfg = ACTOR_STYLES[actorType] || ACTOR_STYLES.service;
  const Icon = cfg.icon;
  return <Icon className={`${className} ${cfg.color}`} />;
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/70 transition-colors">
      <div className="flex items-start gap-3">
        <ActorIcon actorType={entry.actorType} className="w-4 h-4 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{entry.entityType}</Badge>
            <span className="text-xs font-medium text-foreground">#{entry.entityId}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-mono text-foreground/80">{entry.action}</span>
          </div>
          {entry.fieldName && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-foreground/80">{entry.fieldName}</span>:{" "}
              <span className="line-through opacity-60">{entry.oldValue ?? "∅"}</span>
              {" → "}
              <span className="text-foreground/80">{entry.newValue ?? "∅"}</span>
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {new Date(entry.createdAt).toLocaleString("pt-BR")}
            {entry.actorId && entry.actorId !== entry.userId && (
              <span className="ml-2">· ator: {entry.actorId}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function RecentEntryRow({ entry }: { entry: RecentEntry }) {
  return (
    <div className="p-3 rounded-lg border border-border/40 bg-card/40">
      <div className="flex items-start gap-3">
        {entry.source === "audit"
          ? <ActorIcon actorType={entry.actorType} className="w-4 h-4 mt-0.5" />
          : <Activity className="w-4 h-4 text-blue-400 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={entry.source === "audit" ? "default" : "secondary"} className="text-[10px]">
              {entry.source === "audit" ? "Auditoria" : "Atividade"}
            </Badge>
            <span className="text-xs font-medium text-foreground truncate">{entry.title}</span>
          </div>
          {entry.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {new Date(entry.createdAt).toLocaleString("pt-BR")}
            <span className="ml-2">· {entry.entityType}#{entry.entityId}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogPanel() {
  const [subtab, setSubtab] = useState<"audit" | "recent">("recent");
  const [entityType, setEntityType] = useState("all");
  const [actorType, setActorType] = useState("all");
  const [actionFilter, setActionFilter] = useState("");

  const auditParams = useMemo(() => {
    const p: any = { limit: 100 };
    if (entityType !== "all") p.entityType = entityType;
    if (actorType !== "all") p.actorType = actorType;
    if (actionFilter.trim()) p.action = actionFilter.trim();
    return p;
  }, [entityType, actorType, actionFilter]);

  const auditQuery = useGetCrmAuditLog(auditParams, {
    query: { queryKey: ["/api/crm/audit-log", auditParams], refetchOnWindowFocus: false },
  });
  const recentQuery = useGetCrmGovernanceRecent({ limit: 100 }, {
    query: { queryKey: ["/api/crm/governance/recent"], refetchOnWindowFocus: false },
  });

  const entries: AuditEntry[] = (auditQuery.data as any)?.entries ?? [];
  const recent: RecentEntry[] = (recentQuery.data as any)?.entries ?? [];

  const isLoading = auditQuery.isLoading || recentQuery.isLoading;
  const refresh = () => {
    auditQuery.refetch();
    recentQuery.refetch();
  };

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" /> Governança & Auditoria
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Trilha completa de alterações e atividades recentes.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={refresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        <Tabs value={subtab} onValueChange={(v) => setSubtab(v as any)} className="flex-1 flex flex-col">
          <div className="px-4 pt-3 border-b border-border/40">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="recent" className="text-xs gap-1.5">
                <Activity className="w-3 h-3" /> Feed Recente
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs gap-1.5">
                <ScrollText className="w-3 h-3" /> Auditoria Detalhada
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <TabsContent value="recent" className="mt-0 space-y-2">
              {recentQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                </div>
              ) : recent.length === 0 ? (
                <div className="text-center py-14">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Sem atividade recente</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conforme você usa o CRM, as ações aparecem aqui.
                  </p>
                </div>
              ) : (
                recent.map(e => <RecentEntryRow key={`${e.source}-${e.id}`} entry={e} />)
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-0 space-y-3">
              <div className="flex items-end gap-2 flex-wrap p-3 rounded-lg border border-border/40 bg-muted/20">
                <Filter className="w-3.5 h-3.5 text-muted-foreground mb-2" />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Entidade</label>
                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ator</label>
                  <Select value={actorType} onValueChange={setActorType}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTOR_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ação contém</label>
                  <Input
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    placeholder="ex: status_change"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {auditQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-14">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Nenhuma entrada encontrada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ajuste os filtros ou aguarde novas ações.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map(e => <AuditEntryRow key={e.id} entry={e} />)}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
