import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, FunnelChart, Funnel,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from "recharts";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Users, DollarSign,
  Target, Trophy, Zap, Activity, Minus,
} from "lucide-react";
import { Loader2 } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface OverviewData {
  kpis: {
    totalContacts: number;
    newLeadsInPeriod: number;
    newLeadsLastPeriod: number;
    leadsGrowth: number | null;
    pipelineValue: number;
    weightedValue: number;
    wonValue: number;
    wonValueInPeriod: number;
    qualificationRate: number;
    winRate: number;
    activeDeals: number;
    activitiesInPeriod: number;
  };
  activitiesByType?: Record<string, number>;
  statusDist: Record<string, number>;
  regimeDist: Record<string, number>;
  weeklyLeads: { week: string; leads: number; deals: number }[];
}

interface FunnelData {
  funnel: { stage: string; count: number; value: number }[];
  avgDaysPerStage: Record<string, number>;
}

// ─── Formatters ────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

// ─── Stage labels ──────────────────────────────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecção",
  discovery: "Descoberta",
  proposal: "Proposta",
  negotiation: "Negociação",
  closing: "Fechamento",
  won: "Ganhos",
  lost: "Perdidos",
};

const STAGE_COLORS: Record<string, string> = {
  prospecting: "#64748b",
  discovery: "#3b82f6",
  proposal: "#f59e0b",
  negotiation: "#f97316",
  closing: "#a855f7",
  won: "#10b981",
  lost: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  prospect: "#64748b",
  qualified: "#3b82f6",
  opportunity: "#f59e0b",
  client: "#10b981",
  churned: "#ef4444",
  lost: "#71717a",
};

const STATUS_LABELS: Record<string, string> = {
  prospect: "Prospect",
  qualified: "Qualificado",
  opportunity: "Oportunidade",
  client: "Cliente",
  churned: "Churned",
  lost: "Perdido",
};

const REGIME_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444"];
const REGIME_LABELS: Record<string, string> = {
  simples: "Simples",
  lucro_presumido: "L. Presumido",
  lucro_real: "L. Real",
  mei: "MEI",
  desconhecido: "N/D",
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, growth, icon: Icon, color, delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  growth?: number | null;
  icon: React.ElementType;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border/50 rounded-2xl p-5 flex items-center gap-4 hover:border-border/80 transition-colors"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {(sub || growth !== undefined) && (
          <div className="flex items-center gap-1.5 mt-1">
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
            {growth !== null && growth !== undefined && (
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${
                growth > 0 ? "text-emerald-400" : growth < 0 ? "text-red-400" : "text-muted-foreground"
              }`}>
                {growth > 0 ? <TrendingUp className="w-3 h-3" /> : growth < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {growth > 0 ? "+" : ""}{growth}% vs. mês ant.
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Chart Card wrapper ─────────────────────────────────────────────────────────
function ChartCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border/50 rounded-2xl p-5"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </motion.div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function CRMDashboard() {
  const [period, setPeriod] = React.useState("this_month");

  const { data: overview, isLoading: loadingOverview } = useQuery<OverviewData>({
    queryKey: ["/api/crm/analytics/overview", period],
    queryFn: async () => {
      const r = await fetch(`/api/crm/analytics/overview?period=${period}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: funnelData, isLoading: loadingFunnel } = useQuery<FunnelData>({
    queryKey: ["/api/crm/analytics/funnel", period],
    queryFn: async () => {
      const r = await fetch(`/api/crm/analytics/funnel?period=${period}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  if (loadingOverview || loadingFunnel) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = overview?.kpis;

  // Status pie data
  const statusPie = Object.entries(overview?.statusDist || {}).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k,
    value: v,
    fill: STATUS_COLORS[k] || "#64748b",
  }));

  // Regime pie data
  const regimePie = Object.entries(overview?.regimeDist || {}).map(([k, v], i) => ({
    name: REGIME_LABELS[k] || k,
    value: v,
    fill: REGIME_COLORS[i % REGIME_COLORS.length],
  }));

  // Funnel bar data
  const funnelBar = (funnelData?.funnel || []).map(f => ({
    name: STAGE_LABELS[f.stage] || f.stage,
    deals: f.count,
    valor: f.value,
    color: STAGE_COLORS[f.stage] || "#64748b",
    days: funnelData?.avgDaysPerStage?.[f.stage] || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-end items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Período:</span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="text-sm bg-card border border-border/50 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="this_month">Este Mês</option>
          <option value="all">Todo o Período</option>
        </select>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total de Leads"
          value={String(kpis?.totalContacts || 0)}
          sub={`${kpis?.newLeadsInPeriod || 0} leads no período`}
          growth={kpis?.leadsGrowth}
          icon={Users}
          color="bg-blue-500/10 text-blue-400"
          delay={0}
        />
        <KpiCard
          label="Pipeline Ativo"
          value={fmt(kpis?.pipelineValue || 0)}
          sub={`Ponderado: ${fmt(kpis?.weightedValue || 0)}`}
          icon={DollarSign}
          color="bg-amber-500/10 text-amber-400"
          delay={0.05}
        />
        <KpiCard
          label="Taxa de Qualificação"
          value={`${kpis?.qualificationRate || 0}%`}
          sub="Leads qualificados / total"
          icon={Target}
          color="bg-purple-500/10 text-purple-400"
          delay={0.1}
        />
        <KpiCard
          label="Win Rate"
          value={`${kpis?.winRate || 0}%`}
          sub={`${fmt(kpis?.wonValueInPeriod || 0)} ganhos no período`}
          icon={Trophy}
          color="bg-emerald-500/10 text-emerald-400"
          delay={0.15}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita Total Ganho"
          value={fmt(kpis?.wonValue || 0)}
          icon={DollarSign}
          color="bg-emerald-500/10 text-emerald-400"
          delay={0.2}
        />
        <KpiCard
          label="Deals Ativos"
          value={String(kpis?.activeDeals || 0)}
          sub="Em andamento no pipeline"
          icon={Zap}
          color="bg-primary/10 text-primary"
          delay={0.25}
        />
        <KpiCard
          label="Atividades no Período"
          value={String(kpis?.activitiesInPeriod || 0)}
          sub="Ligações, emails, reuniões"
          icon={Activity}
          color="bg-pink-500/10 text-pink-400"
          delay={0.3}
        />
        <KpiCard
          label="Leads Novos (Período)"
          value={String(kpis?.newLeadsInPeriod || 0)}
          sub={`Período anterior: ${kpis?.newLeadsLastPeriod || 0}`}
          growth={kpis?.leadsGrowth}
          icon={TrendingUp}
          color="bg-cyan-500/10 text-cyan-400"
          delay={0.35}
        />
      </div>

      {/* Charts Row 1: Weekly Trend + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ChartCard title="Novos Leads e Deals — Últimas 8 Semanas" delay={0.4}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={overview?.weeklyLeads || []} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#3b82f6" fill="url(#gradLeads)" strokeWidth={2} />
                <Area type="monotone" dataKey="deals" name="Deals" stroke="#10b981" fill="url(#gradDeals)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="lg:col-span-2">
          <ChartCard title="Distribuição por Status" delay={0.45}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {statusPie.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [v, "Contatos"]} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Charts Row 2: Funnel + Regime */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ChartCard title="Funil de Deals por Etapa" delay={0.5}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelBar} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deals" name="Deals" radius={[4, 4, 0, 0]}>
                  {funnelBar.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Avg days per stage pills */}
            {funnelBar.filter(f => f.days > 0).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
                {funnelBar.filter(f => f.days > 0).map(f => (
                  <span
                    key={f.name}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${f.color}20`, color: f.color }}
                  >
                    {f.name}: {f.days}d
                  </span>
                ))}
              </div>
            )}
          </ChartCard>
        </div>

        <div className="lg:col-span-2">
          <ChartCard title="Regime Tributário dos Leads" delay={0.55}>
            {regimePie.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={regimePie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {regimePie.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Empresas"]} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>
      {/* Charts Row 3: Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Relatório de Atividades da Equipe" delay={0.6}>
          {!overview?.activitiesByType || Object.keys(overview.activitiesByType).length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
              Nenhuma atividade registrada no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={Object.entries(overview.activitiesByType).map(([k, v]) => ({
                  name: k === "call" ? "Ligação" : k === "email" ? "E-mail" : k === "whatsapp" ? "WhatsApp" : k === "meeting" ? "Reunião" : k === "proposal" ? "Proposta" : "Nota",
                  count: v,
                  fill: k === "call" ? "#3b82f6" : k === "email" ? "#f59e0b" : k === "whatsapp" ? "#10b981" : k === "meeting" ? "#a855f7" : k === "proposal" ? "#ef4444" : "#64748b",
                })).sort((a, b) => b.count - a.count)}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#foreground" }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Atividades" radius={[0, 4, 4, 0]}>
                  {Object.entries(overview.activitiesByType).map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
