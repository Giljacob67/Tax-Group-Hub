import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, DollarSign, Activity, Clock,
  Bot, Zap, AlertCircle, ChevronDown
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PERIODS = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
];

const COLORS = ["#107EC2", "#D6A847", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export default function AnalyticsPage() {
  usePageTitle("Analytics");
  const [period, setPeriod] = useState("30d");

  const { data: overview } = useQuery({
    queryKey: ["/api/analytics/overview", period],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/overview?period=${period}`);
      return r.json();
    },
  });

  const { data: daily } = useQuery({
    queryKey: ["/api/analytics/daily-usage", period],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/daily-usage?period=${period}`);
      return r.json();
    },
  });

  const { data: providers } = useQuery({
    queryKey: ["/api/analytics/providers", period],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/providers?period=${period}`);
      return r.json();
    },
  });

  const { data: models } = useQuery({
    queryKey: ["/api/analytics/models", period],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/models?period=${period}`);
      return r.json();
    },
  });

  const { data: costTrend } = useQuery({
    queryKey: ["/api/analytics/cost-trend", period],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/cost-trend?period=${period}`);
      return r.json();
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["/api/analytics/recent-logs"],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/recent-logs?limit=50`);
      return r.json();
    },
  });

  const ov = overview || {};
  const dailyData = (daily?.usageByDay || []).map((d: any) => ({
    day: new Date(d.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    tokens: Number(d.tokens),
    promptTokens: Number(d.promptTokens),
    completionTokens: Number(d.completionTokens),
    cost: Number(d.cost) / 100,
    latency: Math.round(Number(d.avgLatency)),
  }));

  const providerData = (providers?.providerStats || []).map((p: any) => ({
    name: p.provider,
    value: Number(p.totalTokens),
    cost: Number(p.cost) / 100,
    calls: Number(p.calls),
  }));

  const costData = (costTrend?.costByDay || []).map((d: any) => ({
    day: new Date(d.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    cost: Number(d.cost) / 100,
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Analytics de LLM</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Consumo, custo e performance dos modelos de IA.</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <Button
                key={p.id}
                variant={period === p.id ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Activity} label="Total Tokens" value={formatNumber(ov.totalTokens || 0)} color="text-primary" />
          <KpiCard icon={TrendingUp} label="Requisições" value={formatNumber(ov.messageCount || 0)} color="text-emerald-400" />
          <KpiCard icon={DollarSign} label="Custo Estimado" value={formatCurrency(ov.totalCostCents || 0)} color="text-amber-400" />
          <KpiCard icon={Clock} label="Latência Média" value={`${ov.avgLatencyMs || 0}ms`} color="text-sky-400" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Tokens por dia" icon={BarChart3}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="gradTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#107EC2" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#107EC2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(218 45% 9%)", border: "1px solid hsl(215 28% 17%)", borderRadius: "0.5rem", fontSize: "12px" }} />
                <Area type="monotone" dataKey="tokens" stroke="#107EC2" strokeWidth={2} fill="url(#gradTokens)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Custo por dia" icon={DollarSign}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(218 45% 9%)", border: "1px solid hsl(215 28% 17%)", borderRadius: "0.5rem", fontSize: "12px" }} formatter={(v: number) => formatCurrency(v * 100)} />
                <Bar dataKey="cost" fill="#D6A847" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Por provedor" icon={Zap}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={providerData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                  {providerData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(218 45% 9%)", border: "1px solid hsl(215 28% 17%)", borderRadius: "0.5rem", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Latência por dia" icon={Clock}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="gradLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(218 45% 9%)", border: "1px solid hsl(215 28% 17%)", borderRadius: "0.5rem", fontSize: "12px" }} formatter={(v: number) => `${v}ms`} />
                <Area type="monotone" dataKey="latency" stroke="#10B981" strokeWidth={2} fill="url(#gradLatency)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Models table */}
        <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> Uso por modelo
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left px-4 py-2 font-medium">Modelo</th>
                  <th className="text-left px-4 py-2 font-medium">Provedor</th>
                  <th className="text-right px-4 py-2 font-medium">Tokens</th>
                  <th className="text-right px-4 py-2 font-medium">Chamadas</th>
                  <th className="text-right px-4 py-2 font-medium">Custo</th>
                  <th className="text-right px-4 py-2 font-medium">Latência média</th>
                </tr>
              </thead>
              <tbody>
                {(models?.modelStats || []).map((m: any, i: number) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium text-foreground">{m.model}</td>
                    <td className="px-4 py-2 text-muted-foreground capitalize">{m.provider}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(Number(m.totalTokens))}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(Number(m.calls))}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(Number(m.cost))}</td>
                    <td className="px-4 py-2 text-right">{Math.round(Number(m.avgLatency))}ms</td>
                  </tr>
                ))}
                {(!models?.modelStats || models.modelStats.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum dado disponível para o período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent logs */}
        <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Logs recentes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-left px-4 py-2 font-medium">Agente</th>
                  <th className="text-left px-4 py-2 font-medium">Modelo</th>
                  <th className="text-right px-4 py-2 font-medium">Tokens</th>
                  <th className="text-right px-4 py-2 font-medium">Custo</th>
                  <th className="text-right px-4 py-2 font-medium">Latência</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(recentLogs?.logs || []).map((log: any, i: number) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground">{new Date(log.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2 font-medium text-foreground">{log.agentId || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{log.model}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(log.totalTokens)}</td>
                    <td className="px-4 py-2 text-right">{log.cost ? formatCurrency(log.cost) : "—"}</td>
                    <td className="px-4 py-2 text-right">{log.latencyMs}ms</td>
                    <td className="px-4 py-2 text-center">
                      {log.success ? (
                        <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 text-[10px]">OK</Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-500/20 text-red-400 text-[10px]">Erro</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {(!recentLogs?.logs || recentLogs.logs.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum log disponível.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string; color: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-xl border border-border/40 bg-card/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </motion.div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h3>
      {children}
    </div>
  );
}
