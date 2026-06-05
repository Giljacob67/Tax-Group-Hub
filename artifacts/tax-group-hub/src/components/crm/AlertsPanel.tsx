import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Loader2,
  Check,
  RefreshCw,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useListCrmAlerts,
  useResolveCrmAlert,
  useConvertCrmAlertToTask,
  useRefreshCrmAlerts,
} from "@workspace/api-client-react";

const SEVERITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  info: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    label: "Info",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    label: "Atenção",
  },
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    label: "Crítico",
  },
};

export default function AlertsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">(
    "all",
  );

  const { data, isLoading, refetch } = useListCrmAlerts(
    {
      ...(filter !== "all" ? { severity: filter } : {}),
      includeResolved: showResolved ? "true" : "false",
    } as any,
    { query: { refetchInterval: 60_000 } } as any,
  );

  const resolveMutation = useResolveCrmAlert({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/alerts"] });
        toast({ title: "Alerta resolvido" });
      },
    },
  });

  const convertMutation = useConvertCrmAlertToTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/alerts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
        toast({ title: "Tarefa criada a partir do alerta" });
      },
      onError: () =>
        toast({ title: "Erro ao converter alerta", variant: "destructive" }),
    },
  });

  const refreshMutation = useRefreshCrmAlerts({
    mutation: {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/alerts"] });
        toast({
          title:
            data?.automationsFired > 0
              ? `Alertas atualizados · ${data.created} novos · ${data.automationsFired} automações disparadas`
              : `Alertas atualizados · ${data?.created || 0} novos`,
        });
      },
      onError: () =>
        toast({ title: "Erro ao atualizar alertas", variant: "destructive" }),
    },
  });

  const alerts: any[] = (data as any)?.alerts || [];
  const total = alerts.length;
  const counts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Alertas Comerciais
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Alertas proativos baseados em regras. Cada um é acionável.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {(["all", "critical", "warning", "info"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  filter === f
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {f === "all" ? "Todos" : SEVERITY_STYLES[f]?.label}
                {f === "critical" && counts.critical > 0 && (
                  <span className="ml-1 font-bold">{counts.critical}</span>
                )}
                {f === "warning" && counts.warning > 0 && (
                  <span className="ml-1 font-bold">{counts.warning}</span>
                )}
                {f === "info" && counts.info > 0 && (
                  <span className="ml-1 font-bold">{counts.info}</span>
                )}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? (
              <BellOff className="w-3 h-3" />
            ) : (
              <Bell className="w-3 h-3" />
            )}
            {showResolved ? "Ocultar resolvidos" : "Ver resolvidos"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => refreshMutation.mutate(undefined as any)}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
          </div>
        ) : total === 0 ? (
          <div className="text-center py-16">
            <Check className="w-10 h-10 text-emerald-400/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">
              Nenhum alerta pendente
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              O sistema está monitorando follow-ups, Matriz e oportunidades
              automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {alerts.map((alert) => {
                const sev =
                  SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                const meta = alert.meta;
                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`p-3.5 rounded-lg border ${sev.bg} ${sev.border}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg leading-none mt-0.5">
                        {meta?.icon || "🔔"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sev.text} bg-background/40`}
                          >
                            {sev.label}
                          </span>
                          <h4 className="text-sm font-semibold text-foreground">
                            {alert.title}
                          </h4>
                        </div>
                        {alert.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {alert.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          {alert.contact?.razaoSocial && (
                            <span>📞 {alert.contact.razaoSocial}</span>
                          )}
                          <span>
                            ·{" "}
                            {new Date(alert.createdAt).toLocaleString("pt-BR")}
                          </span>
                          {alert.context?.diasAtraso && (
                            <span className="text-red-400 font-semibold">
                              {alert.context.diasAtraso}d atraso
                            </span>
                          )}
                          {alert.context?.diasSemAtividade && (
                            <span className="text-amber-400">
                              {alert.context.diasSemAtividade}d sem atividade
                            </span>
                          )}
                          {alert.context?.diasSemRetorno && (
                            <span className="text-amber-400">
                              {alert.context.diasSemRetorno}d sem retorno
                            </span>
                          )}
                          {alert.context?.diasParada && (
                            <span className="text-red-400">
                              {alert.context.diasParada}d parada
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!alert.isResolved && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                convertMutation.mutate({ id: alert.id })
                              }
                              disabled={convertMutation.isPending}
                            >
                              Criar Tarefa
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 text-muted-foreground"
                              onClick={() =>
                                resolveMutation.mutate({ id: alert.id })
                              }
                              disabled={resolveMutation.isPending}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
