import { useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, Copy, Database, Loader2,
  RefreshCw, ShieldAlert, TrendingUp, Users,
} from "lucide-react";
import {
  useGetCrmQualityDuplicates,
  useGetCrmQualityHealth,
  useGetCrmQualityIssues,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  info:     { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/30",    label: "Info" },
  warning:  { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/30",   label: "Atenção" },
  critical: { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30",     label: "Crítico" },
};

const RULE_LABELS: Record<string, string> = {
  missing_cnpj:             "CNPJ ausente",
  missing_razao_social:     "Razão social ausente",
  missing_contato:          "Sem telefone/e-mail",
  missing_setor:            "Setor não definido",
  missing_regime_tributario:"Regime tributário não definido",
  missing_decisor:          "Decisor não identificado",
  no_responsavel:           "Sem responsável atribuído",
  no_followup:              "Sem próximo follow-up",
  no_deal_qualificado:      "Lead qualificado sem negócio",
  matriz_no_briefing:       "Enviado p/ Matriz sem briefing",
  proposta_no_status:       "Proposta sem status definido",
  perda_no_motivo:          "Perda sem motivo registrado",
};

const ENTITY_LABELS: Record<string, string> = {
  contact: "Contato",
  deal:    "Negócio",
};

type HealthData = {
  totalContacts: number;
  totalDeals: number;
  completenessPct: number;
  withResponsiblePct: number;
  withFollowupPct: number;
  duplicates: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  topRules: { rule: string; count: number }[];
};

type Issue = {
  rule: string;
  severity: "info" | "warning" | "critical";
  entityType: "contact" | "deal";
  entityId: number;
  entityLabel: string;
  context: Record<string, any>;
};

type Duplicate = {
  field: "cnpj" | "razao_social";
  value: string;
  contactIds: number[];
  labels: string[];
};

function MetricCard({
  label, value, hint, icon: Icon, accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={`p-2 rounded-md ${accent} bg-background/40`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function pctColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}

export default function DataQualityPanel() {
  const [subtab, setSubtab] = useState<"overview" | "issues" | "duplicates">("overview");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "info">("all");

  const healthQuery = useGetCrmQualityHealth({
    query: { queryKey: ["/api/crm/quality/health"], refetchOnWindowFocus: false },
  });
  const issuesQuery = useGetCrmQualityIssues({
    query: { queryKey: ["/api/crm/quality/issues"], refetchOnWindowFocus: false },
  });
  const duplicatesQuery = useGetCrmQualityDuplicates({
    query: { queryKey: ["/api/crm/quality/duplicates"], refetchOnWindowFocus: false },
  });

  const isLoading = healthQuery.isLoading || issuesQuery.isLoading || duplicatesQuery.isLoading;

  const refreshAll = () => {
    healthQuery.refetch();
    issuesQuery.refetch();
    duplicatesQuery.refetch();
  };

  const health = (healthQuery.data as any) as HealthData | undefined;
  const allIssues: Issue[] = (issuesQuery.data as any)?.issues ?? [];
  const duplicates: Duplicate[] = (duplicatesQuery.data as any)?.duplicates ?? [];

  const filteredIssues = severityFilter === "all"
    ? allIssues
    : allIssues.filter(i => i.severity === severityFilter);

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> Qualidade dos Dados
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Saúde da base, problemas de completude e possíveis duplicidades.
          </p>
        </div>
        <Button
          variant="outline" size="sm" className="gap-1.5 text-xs"
          onClick={refreshAll} disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        <Tabs value={subtab} onValueChange={(v) => setSubtab(v as any)} className="flex-1 flex flex-col">
          <div className="px-4 pt-3 border-b border-border/40">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
              <TabsTrigger value="issues" className="text-xs gap-1.5">
                Problemas
                {health && (health.criticalIssues + health.warningIssues + health.infoIssues) > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {health.criticalIssues + health.warningIssues + health.infoIssues}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="duplicates" className="text-xs gap-1.5">
                Duplicidades
                {duplicates.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{duplicates.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <TabsContent value="overview" className="mt-0 space-y-4">
              {healthQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                </div>
              ) : !health ? (
                <div className="text-center py-10 text-sm text-muted-foreground">Sem dados disponíveis.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard
                      label="Completude" value={`${health.completenessPct}%`}
                      hint="responsável + follow-up"
                      icon={Activity}
                      accent={pctColor(health.completenessPct)}
                    />
                    <MetricCard
                      label="Com Responsável" value={`${health.withResponsiblePct}%`}
                      icon={Users}
                      accent={pctColor(health.withResponsiblePct)}
                    />
                    <MetricCard
                      label="Com Follow-up" value={`${health.withFollowupPct}%`}
                      icon={TrendingUp}
                      accent={pctColor(health.withFollowupPct)}
                    />
                    <MetricCard
                      label="Duplicidades" value={health.duplicates}
                      hint="possíveis matches"
                      icon={Copy}
                      accent={health.duplicates > 0 ? "text-amber-400" : "text-emerald-400"}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Críticos</p>
                          <p className="text-2xl font-bold text-red-400">{health.criticalIssues}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Atenção</p>
                          <p className="text-2xl font-bold text-amber-400">{health.warningIssues}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-blue-500/30 bg-blue-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Activity className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Informativos</p>
                          <p className="text-2xl font-bold text-blue-400">{health.infoIssues}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {health.topRules && health.topRules.length > 0 && (
                    <Card className="border-border/50 bg-card/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Regras mais violadas</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1.5">
                          {health.topRules.map(({ rule, count }) => (
                            <div key={rule} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{RULE_LABELS[rule] || rule}</span>
                              <Badge variant="outline" className="font-mono">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div className="p-3 rounded-md border border-border/40 bg-background/40">
                      <span className="block text-foreground text-2xl font-bold">{health.totalContacts}</span>
                      <span>contatos</span>
                    </div>
                    <div className="p-3 rounded-md border border-border/40 bg-background/40">
                      <span className="block text-foreground text-2xl font-bold">{health.totalDeals}</span>
                      <span>negócios</span>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="issues" className="mt-0 space-y-3">
              <div className="flex items-center gap-1 flex-wrap">
                {(["all", "critical", "warning", "info"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setSeverityFilter(f)}
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${
                      severityFilter === f
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {f === "all" ? "Todos" : SEVERITY_STYLES[f].label}
                  </button>
                ))}
              </div>

              {issuesQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="text-center py-14">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Nenhum problema neste nível</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {severityFilter === "all" ? "A base está limpa." : `Nenhum problema ${SEVERITY_STYLES[severityFilter]?.label.toLowerCase()}.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredIssues.map((issue, idx) => {
                    const sev = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.info;
                    return (
                      <div key={`${issue.entityType}-${issue.entityId}-${idx}`}
                        className={`p-3 rounded-lg border ${sev.bg} ${sev.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sev.text} bg-background/40`}>
                                {sev.label}
                              </span>
                              <span className="text-xs font-medium text-foreground">
                                {RULE_LABELS[issue.rule] || issue.rule}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {ENTITY_LABELS[issue.entityType] || issue.entityType}: {issue.entityLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="duplicates" className="mt-0">
              {duplicatesQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                </div>
              ) : duplicates.length === 0 ? (
                <div className="text-center py-14">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Nenhuma duplicidade detectada</p>
                  <p className="text-xs text-muted-foreground mt-1">A busca é feita por CNPJ e razão social.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {duplicates.map((dup, idx) => (
                    <div key={`${dup.field}-${dup.value}-${idx}`}
                      className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                      <div className="flex items-start gap-2">
                        <Copy className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {dup.field === "cnpj" ? "CNPJ" : "Razão Social"}
                            </Badge>
                            <span className="text-xs font-mono text-foreground truncate">{dup.value}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {dup.contactIds.length} contatos:
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {dup.labels.map((label, i) => (
                              <li key={i} className="text-xs text-foreground/80 truncate">
                                · {label} <span className="text-muted-foreground">(#{dup.contactIds[i]})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
