import { useState } from "react";
import { useGetCrmDashboard } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Briefcase, Calendar, CheckCircle2, Clock,
  DollarSign, Flame, Loader2, Target, TrendingUp, Trophy, UserCheck,
  Users, XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";

type Persona = "executive" | "coordenador" | "operacional" | "pos_venda";
type Period = "7d" | "30d" | "90d" | "this_month" | "all";

const PERSONAS: { value: Persona; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "executive",   label: "Executivo",     icon: TrendingUp },
  { value: "coordenador", label: "Coordenação",   icon: Users },
  { value: "operacional", label: "Operacional",   icon: Activity },
  { value: "pos_venda",   label: "Pós-Venda",     icon: UserCheck },
];

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d",          label: "7 dias" },
  { value: "30d",         label: "30 dias" },
  { value: "90d",         label: "90 dias" },
  { value: "this_month",  label: "Este mês" },
  { value: "all",         label: "Todo período" },
];

function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

function pct(n: number | undefined | null): string {
  if (n == null) return "—";
  return `${n}%`;
}

function MetricCard({
  label, value, sub, icon: Icon, accent, delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-border/50 bg-card/50 h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {label}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1 leading-none">{value}</p>
              {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
            </div>
            <div className={`p-2 rounded-lg ${accent} bg-background/40 flex-shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground mb-3 mt-2">{children}</h3>
  );
}

function DataList({ items, empty }: { items: { key: string; label: string; value: string | number; badge?: string }[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">{empty}</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={`${item.key}-${idx}`} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/30">
          <span className="truncate text-foreground/90">{item.label}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.badge && (
              <Badge variant="outline" className="text-[10px]">{item.badge}</Badge>
            )}
            <span className="font-mono text-xs font-semibold">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Executive view ──────────────────────────────────────────────────────────

function ExecutiveView({ data }: { data: any }) {
  const pipeline = data.pipeline || {};
  const conversion = data.conversion || {};
  const leads = data.leads || {};
  const matriz = data.matriz || {};
  const meetings = data.meetings || {};
  const avgDaysPerStage: Record<string, number> = data.avgDaysPerStage || {};
  const dealsByStage: Record<string, number> = data.dealsByStage || {};

  return (
    <div className="space-y-4">
      <SectionTitle>Visão Executiva — Pipeline & Conversão</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Pipeline" value={fmt(pipeline.value)}
          sub={`Ponderado: ${fmt(pipeline.weighted)}`}
          icon={DollarSign} accent="text-emerald-400" />
        <MetricCard label="Ganho (período)" value={fmt(pipeline.wonValueInPeriod)}
          sub={`Total: ${fmt(pipeline.wonValue)}`}
          icon={Trophy} accent="text-amber-400" />
        <MetricCard label="Qualificação" value={pct(conversion.qualificationRate)}
          sub="Leads qualificados" icon={Target} accent="text-blue-400" />
        <MetricCard label="Win Rate" value={pct(conversion.winRate)}
          sub={`${pipeline.wonCount} ganhos · ${pipeline.lostCount} perdidos`}
          icon={TrendingUp} accent="text-purple-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Leads (total)" value={leads.total || 0}
          sub={`${leads.newInPeriod || 0} novos no período`} icon={Users} accent="text-cyan-400" />
        <MetricCard label="Qualificados" value={leads.qualificados || 0} icon={CheckCircle2} accent="text-emerald-400" />
        <MetricCard label="Reuniões" value={meetings.thisWeek || 0}
          sub={`${meetings.today || 0} hoje`} icon={Calendar} accent="text-blue-400" />
        <MetricCard label="Deals ativos" value={pipeline.activeCount || 0}
          sub={`${pipeline.stuckCount || 0} parados 14+d`} icon={Briefcase} accent="text-primary" />
      </div>

      <SectionTitle>Matriz</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Enviados" value={matriz.enviado || 0} icon={Activity} accent="text-blue-400" />
        <MetricCard label="Aguardando" value={matriz.aguardando || 0} icon={Clock} accent="text-amber-400" />
        <MetricCard label="Acima do prazo" value={matriz.acimaPrazo || 0}
          icon={AlertTriangle} accent="text-red-400" />
        <MetricCard label="Tempo médio" value={`${matriz.avgDaysAwaiting || 0}d`}
          sub="aguardando retorno" icon={Clock} accent="text-muted-foreground" />
      </div>

      {Object.keys(avgDaysPerStage).length > 0 && (
        <>
          <SectionTitle>Tempo médio por etapa</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem dados de tempo por etapa."
                items={Object.entries(avgDaysPerStage)
                  .sort(([, a], [, b]) => b - a)
                  .map(([stage, days]) => ({
                    key: stage,
                    label: stage,
                    value: `${days}d`,
                  }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {Object.keys(dealsByStage).length > 0 && (
        <>
          <SectionTitle>Deals por etapa</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem deals."
                items={Object.entries(dealsByStage).map(([stage, count]) => ({
                  key: stage,
                  label: stage,
                  value: count,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Coordenador view ────────────────────────────────────────────────────────

function CoordenadorView({ data }: { data: any }) {
  const responsibles: { name: string; contacts: number; deals: number; value: number; hot: number }[] =
    data.responsibles || [];

  const stageBreakdown: Record<string, { count: number; avgDays: number; value: number }> =
    data.stageBreakdown || {};

  const upcoming: { id: number; name: string; followup: string; status: string }[] =
    data.upcomingFollowups || [];

  return (
    <div className="space-y-4">
      <SectionTitle>Equipe — Visão do Coordenador</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Leads quentes" value={data.hotLeads || 0} icon={Flame} accent="text-red-400" />
        <MetricCard label="Negociações críticas" value={data.criticalNegotiations || 0}
          sub="Probabilidade ≥ 60%" icon={Target} accent="text-amber-400" />
        <MetricCard label="Propostas sem retorno" value={data.proposalsNoReturn || 0}
          sub="7+ dias" icon={XCircle} accent="text-red-400" />
        <MetricCard label="Contas inativas" value={data.accountsInactive || 0}
          sub="14+ dias" icon={Activity} accent="text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Aguardando Matriz" value={data.awaitingMatriz || 0} icon={Clock} accent="text-amber-400" />
        <MetricCard label="Aguardando ação" value={data.awaitingAction || 0}
          sub="Briefing incompleto" icon={AlertTriangle} accent="text-red-400" />
      </div>

      {responsibles.length > 0 && (
        <>
          <SectionTitle>Por responsável</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem responsáveis."
                items={responsibles.map(r => ({
                  key: r.name,
                  label: r.name,
                  value: fmt(r.value),
                  badge: `${r.contacts} contatos · ${r.deals} deals · ${r.hot}🔥`,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {Object.keys(stageBreakdown).length > 0 && (
        <>
          <SectionTitle>Gargalos por etapa</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem dados de gargalo."
                items={Object.entries(stageBreakdown)
                  .sort(([, a], [, b]) => b.avgDays - a.avgDays)
                  .map(([stage, info]) => ({
                    key: stage,
                    label: `${stage} · ${info.count} deals`,
                    value: `${info.avgDays}d · ${fmt(info.value)}`,
                  }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionTitle>Próximos follow-ups (7 dias)</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem follow-ups."
                items={upcoming.map(f => ({
                  key: String(f.id),
                  label: f.name || `Contato #${f.id}`,
                  value: f.followup ? new Date(f.followup).toLocaleDateString("pt-BR") : "—",
                  badge: f.status,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Operacional view ────────────────────────────────────────────────────────

function OperacionalView({ data }: { data: any }) {
  const today = data.today || {};
  const overdue = data.overdue || {};
  const byStatus: Record<string, number> = data.byStatus || {};
  const byLote: { lote: string; count: number }[] = data.byLote || [];
  const needFollowup: { id: number; name: string; cnpj: string; daysSince: number }[] =
    data.needFollowup || [];

  return (
    <div className="space-y-4">
      <SectionTitle>Dia a dia — Operacional</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Tarefas hoje" value={today.tasks || 0} icon={CheckCircle2} accent="text-emerald-400" />
        <MetricCard label="Follow-ups hoje" value={today.followups || 0} icon={Calendar} accent="text-blue-400" />
        <MetricCard label="Reuniões (semana)" value={today.meetings || 0} icon={Calendar} accent="text-purple-400" />
        <MetricCard label="Leads (24h)" value={today.newLeads || 0} icon={TrendingUp} accent="text-cyan-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Tarefas vencidas" value={overdue.tasks || 0} icon={AlertTriangle} accent="text-red-400" />
        <MetricCard label="Follow-ups vencidos" value={overdue.followups || 0} icon={AlertTriangle} accent="text-red-400" />
      </div>

      {Object.keys(byStatus).length > 0 && (
        <>
          <SectionTitle>Por status</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem dados."
                items={Object.entries(byStatus).map(([k, v]) => ({
                  key: k,
                  label: k,
                  value: v,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {byLote.length > 0 && (
        <>
          <SectionTitle>Por lote de prospecção</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem lotes."
                items={byLote.map(l => ({
                  key: l.lote,
                  label: l.lote,
                  value: l.count,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {needFollowup.length > 0 && (
        <>
          <SectionTitle>Precisam de follow-up (7+ dias sem atividade)</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Tudo em dia."
                items={needFollowup.map(c => ({
                  key: String(c.id),
                  label: c.name || c.cnpj || `Contato #${c.id}`,
                  value: `${c.daysSince}d`,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Pós-venda view ──────────────────────────────────────────────────────────

function PosVendaView({ data }: { data: any }) {
  const byResponsavel: { name: string; count: number; deals: number; value: number }[] =
    data.byResponsavel || [];
  const recentWins: { id: number; name: string; value: number; wonAt: string }[] =
    data.recentWins || [];

  return (
    <div className="space-y-4">
      <SectionTitle>Pós-venda — Expansão</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total de clientes" value={data.totalClientes || 0} icon={Users} accent="text-emerald-400" />
        <MetricCard label="Ativos (30d)" value={data.activeClients || 0}
          sub="com atividade recente" icon={Activity} accent="text-blue-400" />
        <MetricCard label="Pendências abertas" value={data.openPendencias || 0}
          icon={AlertTriangle} accent="text-amber-400" />
        <MetricCard label="Expansão (30+ d)" value={data.expansionCandidates || 0}
          sub="sem ação há 30+d" icon={TrendingUp} accent="text-purple-400" />
      </div>

      {byResponsavel.length > 0 && (
        <>
          <SectionTitle>Clientes por responsável</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem dados."
                items={byResponsavel.map(r => ({
                  key: r.name,
                  label: r.name,
                  value: fmt(r.value),
                  badge: `${r.count} clientes · ${r.deals} deals`,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      {recentWins.length > 0 && (
        <>
          <SectionTitle>Ganhos recentes (90 dias)</SectionTitle>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-3">
              <DataList
                empty="Sem ganhos recentes."
                items={recentWins.map(w => ({
                  key: String(w.id),
                  label: w.name || `Negócio #${w.id}`,
                  value: fmt(w.value),
                  badge: w.wonAt ? new Date(w.wonAt).toLocaleDateString("pt-BR") : undefined,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function PersonaDashboard() {
  const { has } = useCurrentUser();
  const [persona, setPersona] = useState<Persona>("executive");
  const [period, setPeriod] = useState<Period>("30d");

  const dashboardQuery = useGetCrmDashboard(
    persona,
    persona === "operacional" || persona === "pos_venda" ? undefined : { period },
    { query: { queryKey: ["/api/crm/dashboards", persona, period], refetchOnWindowFocus: false } },
  );

  const isLoading = dashboardQuery.isLoading;
  const data: any = (dashboardQuery.data as any)?.data;
  const error = dashboardQuery.error;

  if (!has("canViewDashboards")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <XCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground">Sem permissão</p>
        <p className="text-xs text-muted-foreground mt-1">Você não tem acesso a dashboards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-1 flex-wrap">
          {PERSONAS.map(p => {
            const Icon = p.icon;
            return (
              <button
                key={p.value}
                onClick={() => setPersona(p.value)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                  persona === p.value
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
        {persona !== "operacional" && persona !== "pos_venda" && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Período:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="text-xs bg-card border border-border/50 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
            >
              {PERIODS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 text-amber-400/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Erro ao carregar dashboard</p>
          <p className="text-xs text-muted-foreground mt-1">Tente novamente em alguns instantes.</p>
        </div>
      ) : !data ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Sem dados disponíveis para este período.</p>
        </div>
      ) : (
        <>
          {persona === "executive"   && <ExecutiveView data={data} />}
          {persona === "coordenador" && <CoordenadorView data={data} />}
          {persona === "operacional" && <OperacionalView data={data} />}
          {persona === "pos_venda"   && <PosVendaView data={data} />}
        </>
      )}
    </div>
  );
}
