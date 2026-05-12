import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Bot, MessageSquare, Zap,
  Users, TrendingUp, Clock, Activity,
  Crown, Briefcase, Megaphone, Settings2,
  Sparkles, ChevronRight, BarChart3, Cpu,
  Globe, Mail, Phone, Layers, ShieldCheck,
  Server, Database, Wifi, AlertCircle,
  Building2, Target, DollarSign, Flame,
  Plus, FileText, Wheat, Factory, ShoppingCart, Truck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useListAgents, useListConversations } from "@workspace/api-client-react";
import { SkeletonMetricsGrid, SkeletonAgentBlocks } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

const BLOCKS = [
  { id: "estrategia", title: "Estratégia e Inteligência", icon: Crown, desc: "Orquestra campanhas e distribui tarefas estratégicas.", accent: "amber" },
  { id: "prospeccao", title: "Prospecção Comercial", icon: Briefcase, desc: "Abordagem, qualificação, deals e follow-up.", accent: "blue" },
  { id: "marketing", title: "Agência Virtual de Marketing", icon: Megaphone, desc: "LinkedIn, email, vídeo, WhatsApp e calendário editorial.", accent: "purple" },
  { id: "gestao", title: "Gestão e Operação Interna", icon: Settings2, desc: "Pipeline, propostas, relatórios e treinamento.", accent: "emerald" },
];

const ACCENT_COLORS: Record<string, { text: string; bg: string; border: string; chart: string }> = {
  amber:   { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   chart: "#f59e0b" },
  blue:    { text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    chart: "#3b82f6" },
  purple:  { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20",  chart: "#a855f7" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", chart: "#10b981" },
};

const ACTIVITY_DATA = [
  { day: "Seg", msgs: 124, convs: 8 },
  { day: "Ter", msgs: 198, convs: 12 },
  { day: "Qua", msgs: 156, convs: 9 },
  { day: "Qui", msgs: 278, convs: 18 },
  { day: "Sex", msgs: 234, convs: 15 },
  { day: "Sáb", msgs: 89, convs: 4 },
  { day: "Dom", msgs: 45, convs: 2 },
];

const SEGMENT_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  agro:      { label: "Agro",      icon: Wheat,        color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  industria: { label: "Indústria", icon: Factory,      color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  atacado:   { label: "Atacado",   icon: ShoppingCart, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
  logistica: { label: "Logística", icon: Truck,        color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } }
};

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${color})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const { data: agentsData, isLoading: isLoadingAgents } = useListAgents();
  const { data: convData, isLoading: isLoadingConvs } = useListConversations();

  const { data: contactsData } = useQuery<{ total: number; enriched: number; qualified: number; hot: number; deals: number }>({
    queryKey: ["/api/crm/contacts/summary"],
    queryFn: async () => {
      const r = await fetch("/api/crm/contacts?limit=1000");
      const d = await r.json();
      const contacts = d.contacts ?? [];
      return {
        total: contacts.length,
        enriched: contacts.filter((c: any) => c.aiScore != null).length,
        qualified: contacts.filter((c: any) => c.status === "qualified" || c.status === "opportunity" || c.status === "client").length,
        hot: contacts.filter((c: any) => (c.aiScore ?? 0) >= 70).length,
        deals: contacts.filter((c: any) => c.status === "opportunity").length,
      };
    },
    staleTime: 60_000,
  });

  const { data: pipelineData } = useQuery<{ meta: { totalValue: number; totalDeals: number } }>({
    queryKey: ["/api/crm/deals/pipeline"],
    queryFn: async () => {
      const r = await fetch("/api/crm/deals/pipeline");
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: segmentsData } = useQuery<{ segments: Array<{ id: string; label: string; contacts: number; deals: number; potentialValue: number; hotLeads: number }> }>({
    queryKey: ["/api/crm/segments"],
    queryFn: async () => {
      const r = await fetch("/api/crm/segments");
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: tasksData } = useQuery<{ tasks: any[] }>({
    queryKey: ["/api/crm/tasks?status=pending"],
    queryFn: async () => { const r = await fetch("/api/crm/tasks?status=pending"); return r.json(); },
    staleTime: 30_000,
  });

  const { data: seqData } = useQuery<{ sequences: any[] }>({
    queryKey: ["/api/automate/sequences"],
    queryFn: () => fetch("/api/automate/sequences").then(r => r.json()),
  });

  const activeSeqs = seqData?.sequences?.filter((s: any) => s.isActive).length ?? 0;
  const totalContacts = contactsData?.total ?? 0;
  const hotLeads = contactsData?.hot ?? 0;
  const openDeals = contactsData?.deals ?? 0;
  const potentialRevenue = pipelineData?.meta?.totalValue ?? 0;
  const pendingTasks = tasksData?.tasks?.filter((t: any) =>
    t.dueDate && new Date(t.dueDate) <= new Date(new Date().setHours(23,59,59,999))
  ).length ?? 0;
  const totalConvs = (convData as any)?.conversations?.length ?? 0;

  const metrics = [
    { label: "Empresas no CRM", value: totalContacts, icon: Building2, spark: [2,4,3,5,6,7,8,9,8,10], color: "#107EC2" },
    { label: "Leads quentes", value: hotLeads, icon: Flame, spark: [0,1,2,3,5,7,8,10,12,15], color: "#D6A847" },
    { label: "Propostas abertas", value: openDeals, icon: FileText, spark: [1,2,3,5,4,6,8,7,9,10], color: "#22C55E" },
    { label: "Receita potencial", value: potentialRevenue > 0 ? `R$ ${(potentialRevenue/1_000_000).toFixed(1)}M` : "R$ 0", icon: DollarSign, spark: [10,12,15,14,18,20,22,25,28,30], color: "#0ea5e9" },
    { label: "Ações hoje", value: pendingTasks, icon: Clock, spark: [0,2,4,3,5,7,6,8,10,9], color: "#f97316" },
    { label: "Campanhas ativas", value: activeSeqs, icon: Zap, spark: [1,1,2,2,3,3,4,4,5,5], color: "#10b981" },
  ];

  const isLoading = isLoadingAgents || isLoadingConvs;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden pb-safe">
      <div className="p-6 max-w-7xl mx-auto space-y-8">

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-xl border border-border bg-card p-8"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/80">Operação ativa</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                Command Center Tax Group
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
                Inteligência tributária operacional para transformar dados, agentes e pipeline em contratos.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link href="/crm">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors">
                  <Plus className="w-4 h-4" />
                  <span>Adicionar empresa-alvo</span>
                </button>
              </Link>
              <Link href="/agent/coordenador-geral-tax-group">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Target className="w-4 h-4" />
                  <span>Acionar Coordenador Geral</span>
                </button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Metrics ── */}
        {isLoading ? (
          <SkeletonMetricsGrid />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
          >
            {metrics.map((m) => (
              <motion.div
                key={m.label}
                variants={itemVariants}
                className="group relative rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors cursor-default"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center ring-1 ring-border group-hover:ring-primary/30 transition-colors">
                    <m.icon className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <MiniSpark data={m.spark} color={m.color} />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight">{m.value}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{m.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Prioridades de hoje + Oportunidades por segmento ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="xl:col-span-2 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Oportunidades por segmento</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Receita potencial estimada por vertical</p>
              </div>
              <Link href="/crm" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                Ver pipeline <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {segmentsData?.segments?.length ? (
                segmentsData.segments.map((seg) => {
                  const meta = SEGMENT_META[seg.id];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const valueText = seg.potentialValue >= 1_000_000
                    ? `R$ ${(seg.potentialValue / 1_000_000).toFixed(1)}M`
                    : seg.potentialValue >= 1_000
                    ? `R$ ${(seg.potentialValue / 1_000).toFixed(0)}k`
                    : `R$ ${seg.potentialValue}`;
                  return (
                    <div key={seg.id} className={`rounded-lg border ${meta.border} ${meta.bg} p-4 flex flex-col gap-2`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                        <span className="text-xs font-medium text-foreground">{meta.label}</span>
                      </div>
                      <div className="text-lg font-bold text-foreground">{valueText}</div>
                      <div className="text-[11px] text-muted-foreground">{seg.contacts} empresas · {seg.deals} propostas</div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  Nenhum segmento identificado. Adicione empresas ao CRM com CNAE ou tags para classificação automática.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="rounded-xl border border-border bg-card p-6 flex flex-col"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Prioridades de hoje</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ações que exigem atenção imediata</p>
            </div>
            <div className="space-y-3 flex-1">
              {pendingTasks > 0 ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <Clock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-foreground">{pendingTasks} tarefa(s) pendente(s)</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Revisar no CRM &gt; Aba Hoje</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Nenhuma ação urgente</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Todas as tarefas do dia estão em dia</div>
                  </div>
                </div>
              )}
              {hotLeads > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <Flame className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-foreground">{hotLeads} lead(s) quente(s)</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Score IA acima de 70 — priorizar contato</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Bot className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-foreground">{agentsData?.agents?.length ?? 0} agentes disponíveis</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Prontos para diagnóstico e prospecção</div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/crm" className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                <ArrowRight className="w-3.5 h-3.5" /> Ir para CRM
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ── Charts + System Status ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="xl:col-span-2 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Atividade Semanal</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mensagens e conversas nos últimos 7 dias</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[11px] text-muted-foreground">Mensagens</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Conversas</span>
                </div>
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_DATA} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradMsgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#107EC2" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#107EC2" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradConvs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#94A3B8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 65%)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(218 45% 9%)",
                      border: "1px solid hsl(215 28% 17%)",
                      borderRadius: "0.625rem",
                      fontSize: "12px",
                      color: "hsl(210 40% 98%)",
                    }}
                  />
                  <Area type="monotone" dataKey="msgs" stroke="#107EC2" strokeWidth={2} fill="url(#gradMsgs)" />
                  <Area type="monotone" dataKey="convs" stroke="#94A3B8" strokeWidth={2} fill="url(#gradConvs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="rounded-xl border border-border bg-card p-5 flex flex-col"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Status do Sistema</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Saúde dos serviços</p>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="w-6 h-6 rounded bg-emerald-500/15 flex items-center justify-center">
                  <Server className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground">API Backend</div>
                </div>
                <span className="text-[11px] font-medium text-emerald-400">Operacional</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center">
                  <Database className="w-3 h-3 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground">Banco de Dados</div>
                </div>
                <span className="text-[11px] font-medium text-primary">Conectado</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="w-6 h-6 rounded bg-amber-500/15 flex items-center justify-center">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground">Autenticação</div>
                </div>
                <span className="text-[11px] font-medium text-amber-400">Segura</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Agentes ativos</span>
                <span className="text-foreground font-medium">{agentsData?.agents?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-muted-foreground">Conversas</span>
                <span className="text-foreground font-medium">{totalConvs}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Agent Blocks ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Blocos de Agentes</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{agentsData?.agents?.length ?? 0} agentes organizados por função</p>
            </div>
            <Link href="/settings" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              Gerenciar <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoadingAgents ? (
            <SkeletonAgentBlocks />
          ) : agentsData?.agents?.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Nenhum agente encontrado"
              description="Os agentes de IA ainda não foram configurados. Verifique se o backend está rodando corretamente."
            />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4"
            >
              {BLOCKS.map((block) => {
                const blockAgents = agentsData?.agents?.filter((a: any) => a.block === block.id) ?? [];
                const accent = ACCENT_COLORS[block.accent];
                return (
                  <motion.div
                    key={block.id}
                    variants={itemVariants}
                    className={`group relative rounded-xl border ${accent.border} ${accent.bg} p-5 overflow-hidden transition-colors hover:border-primary/30`}
                  >
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${accent.bg} flex items-center justify-center ring-1 ${accent.border}`}>
                            <block.icon className={`w-4 h-4 ${accent.text}`} />
                          </div>
                          <h3 className="text-sm font-bold text-foreground leading-tight">{block.title}</h3>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${accent.bg} ${accent.text} border ${accent.border}`}>
                          {blockAgents.length}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs mb-4 leading-relaxed">{block.desc}</p>
                      <div className="space-y-1">
                        {blockAgents.slice(0, 4).map((agent: any) => (
                          <Link
                            key={agent.id}
                            href={`/agent/${agent.id}`}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/40 hover:bg-background/70 border border-border/20 hover:border-primary/20 transition-colors group/link"
                          >
                            <span className="text-xs text-foreground/80 group-hover/link:text-foreground truncate pr-2">{agent.name}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover/link:text-primary flex-shrink-0 transform group-hover/link:translate-x-0.5 transition-transform" />
                          </Link>
                        ))}
                        {blockAgents.length > 4 && (
                          <div className="text-center text-[11px] text-muted-foreground/50 pt-1">
                            + {blockAgents.length - 4} mais
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </motion.div>

        {/* ── Quick Actions + Tip ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2 rounded-xl border border-border bg-card p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: MessageSquare, label: "Novo Diagnóstico", href: "/agent/coordenador-geral-tax-group", color: "bg-primary/10 text-primary" },
                { icon: Users, label: "Ver Pipeline", href: "/crm", color: "bg-muted text-muted-foreground" },
                { icon: Layers, label: "Campanhas", href: "/automations", color: "bg-muted text-muted-foreground" },
                { icon: BarChart3, label: "Relatórios", href: "/integrations", color: "bg-muted text-muted-foreground" },
              ].map((action) => (
                <Link key={action.label} href={action.href}>
                  <button className="w-full flex flex-row sm:flex-col items-center gap-3 sm:gap-2 p-3 sm:p-4 rounded-xl border border-border bg-background hover:bg-muted hover:border-primary/20 transition-colors group">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${action.color} flex items-center justify-center flex-shrink-0`}>
                      <action.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                  </button>
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-border bg-card p-5 flex flex-col justify-center"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-foreground font-medium mb-1">Dica do dia</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Use o <Link href="/agent/coordenador-geral-tax-group" className="text-primary hover:underline">Coordenador Geral</Link> para orquestrar múltiplos agentes em campanhas complexas com um único comando.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
