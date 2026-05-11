import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Bot, MessageSquare, Zap,
  Users, TrendingUp, Clock, Activity,
  Crown, Briefcase, Megaphone, Settings2,
  Sparkles, ChevronRight, BarChart3, Cpu,
  Globe, Mail, Phone, Layers, ShieldCheck,
  Server, Database, Wifi, AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useListAgents, useListConversations } from "@workspace/api-client-react";
import { SkeletonMetricsGrid, SkeletonAgentBlocks } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

const BLOCKS = [
  { id: "estrategia", title: "Estratégia e Inteligência", icon: Crown, gradient: "from-amber-500/10 to-amber-900/10", border: "border-amber-500/20", desc: "Centro de comando: orquestra campanhas e distribui tarefas.", accent: "amber", glow: "shadow-amber-500/10" },
  { id: "prospeccao", title: "Prospecção Comercial", icon: Briefcase, gradient: "from-blue-500/10 to-blue-900/10", border: "border-blue-500/20", desc: "Abordagem, qualificação, deals complexos e follow-up.", accent: "blue", glow: "shadow-blue-500/10" },
  { id: "marketing", title: "Agência Virtual de Marketing", icon: Megaphone, gradient: "from-purple-500/10 to-purple-900/10", border: "border-purple-500/20", desc: "LinkedIn, email, vídeo, WhatsApp e calendário editorial.", accent: "purple", glow: "shadow-purple-500/10" },
  { id: "gestao", title: "Gestão e Operação Interna", icon: Settings2, gradient: "from-emerald-500/10 to-emerald-900/10", border: "border-emerald-500/20", desc: "Pipeline, propostas, relatórios e treinamento de parceiros.", accent: "emerald", glow: "shadow-emerald-500/10" },
];

const ACCENT_COLORS: Record<string, { text: string; bg: string; border: string; glow: string; chart: string }> = {
  amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "shadow-amber-500/10", chart: "#f59e0b" },
  blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", glow: "shadow-blue-500/10", chart: "#3b82f6" },
  purple: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", glow: "shadow-purple-500/10", chart: "#a855f7" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "shadow-emerald-500/10", chart: "#10b981" },
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
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

function SystemStatusCard({ icon: Icon, label, status, color }: { icon: any; label: string; status: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-xs font-semibold text-foreground">{status}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: agentsData, isLoading: isLoadingAgents } = useListAgents();
  const { data: convData, isLoading: isLoadingConvs } = useListConversations();

  const { data: contactsData } = useQuery<{ total: number; enriched: number; qualified: number }>({
    queryKey: ["/api/crm/contacts/summary"],
    queryFn: async () => {
      const r = await fetch("/api/crm/contacts?limit=1000");
      const d = await r.json();
      const contacts = d.contacts ?? [];
      return {
        total: contacts.length,
        enriched: contacts.filter((c: any) => c.aiScore != null).length,
        qualified: contacts.filter((c: any) => c.status === "qualified" || c.status === "opportunity" || c.status === "client").length,
      };
    },
    staleTime: 60_000,
  });

  const { data: seqData } = useQuery<{ sequences: any[] }>({
    queryKey: ["/api/automate/sequences"],
    queryFn: () => fetch("/api/automate/sequences").then(r => r.json()),
  });

  const { data: enrollData } = useQuery<{ enrollments: any[] }>({
    queryKey: ["/api/automate/enrollments"],
    queryFn: () => fetch("/api/automate/enrollments").then(r => r.json()),
  });

  const activeSeqs = seqData?.sequences?.filter((s: any) => s.isActive).length ?? 0;
  const activeEnrolls = enrollData?.enrollments?.filter((e: any) => e.status === "active").length ?? 0;
  const totalContacts = contactsData?.total ?? 0;
  const enrichedCount = contactsData?.enriched ?? 0;
  const totalConvs = (convData as any)?.conversations?.length ?? 0;

  const metrics = [
    { label: "Agentes ativos", value: agentsData?.agents?.length ?? 0, icon: Bot, spark: [2,4,3,5,6,7,8,9,8,10], color: "#3b82f6" },
    { label: "Conversas", value: totalConvs, icon: MessageSquare, spark: [1,2,3,5,4,6,8,7,9,10], color: "#a855f7" },
    { label: "Contatos CRM", value: totalContacts, icon: Users, spark: [10,12,15,14,18,20,22,25,28,30], color: "#0ea5e9" },
    { label: "Enriquecidos IA", value: enrichedCount, icon: TrendingUp, spark: [0,1,2,3,5,7,8,10,12,15], color: "#f59e0b" },
    { label: "Sequências", value: activeSeqs, icon: Zap, spark: [1,1,2,2,3,3,4,4,5,5], color: "#10b981" },
    { label: "Em sequência", value: activeEnrolls, icon: Clock, spark: [0,2,4,3,5,7,6,8,10,9], color: "#f97316" },
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
          className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card/50 backdrop-blur-xl p-8"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative">
                  <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/80">Sistema Online</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                Visão Geral
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
                {agentsData?.agents?.length ?? 0} agentes de IA especializados operando seu negócio
                com inteligência artificial de ponta.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/agent/coordenador-geral">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  <Sparkles className="w-4 h-4" />
                  <span>Coordenador Geral</span>
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
                className="group relative rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-4 flex flex-col gap-3 hover:border-primary/20 hover:bg-card/60 transition-all duration-300 cursor-default"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-background/60 flex items-center justify-center ring-1 ring-border/50 group-hover:ring-primary/30 transition-colors">
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

        {/* ── Charts + System Status ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="xl:col-span-2 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-6"
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
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-[11px] text-muted-foreground">Conversas</span>
                </div>
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_DATA} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradMsgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#107ec2" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#107ec2" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradConvs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(215 20.2% 65.1%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215 20.2% 65.1%)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220 70% 6%)",
                      border: "1px solid hsl(220 60% 12%)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      color: "hsl(210 40% 98%)",
                    }}
                  />
                  <Area type="monotone" dataKey="msgs" stroke="#107ec2" strokeWidth={2} fill="url(#gradMsgs)" />
                  <Area type="monotone" dataKey="convs" stroke="#a855f7" strokeWidth={2} fill="url(#gradConvs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* System Status */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-6 flex flex-col"
          >
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-foreground">Status do Sistema</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Saúde dos serviços em tempo real</p>
            </div>
            <div className="space-y-3 flex-1">
              <SystemStatusCard icon={Server} label="API Backend" status="Operacional" color="bg-emerald-500/15" />
              <SystemStatusCard icon={Database} label="Banco de Dados" status="Conectado" color="bg-blue-500/15" />
              <SystemStatusCard icon={Wifi} label="WebSocket" status="Ativo" color="bg-purple-500/15" />
              <SystemStatusCard icon={ShieldCheck} label="Autenticação" status="Segura" color="bg-amber-500/15" />
            </div>
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Uptime</span>
                <span className="text-emerald-400 font-medium">99.9%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted/40 mt-2 overflow-hidden">
                <div className="h-full w-[99.9%] bg-emerald-400 rounded-full" />
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
                    className={`group relative rounded-2xl border ${block.border} bg-gradient-to-b ${block.gradient} p-5 overflow-hidden hover:shadow-lg hover:${block.glow} transition-all duration-300 backdrop-blur-sm`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/40 hover:bg-background/70 border border-border/20 hover:border-primary/20 transition-all group/link"
                          >
                            <span className="text-xs text-foreground/80 group-hover/link:text-foreground truncate pr-2">{agent.name}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover/link:text-primary flex-shrink-0 transform group-hover/link:translate-x-0.5 transition-all" />
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
            className="md:col-span-2 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: MessageSquare, label: "Nova Conversa", href: "/agent/coordenador-geral", color: "bg-blue-500/10 text-blue-400" },
                { icon: Users, label: "Ver CRM", href: "/crm", color: "bg-sky-500/10 text-sky-400" },
                { icon: Layers, label: "Automações", href: "/automations", color: "bg-emerald-500/10 text-emerald-400" },
                { icon: BarChart3, label: "Relatórios", href: "/integrations", color: "bg-purple-500/10 text-purple-400" },
              ].map((action) => (
                <Link key={action.label} href={action.href}>
                  <button className="w-full flex flex-col items-center gap-2 p-4 rounded-xl border border-border/30 bg-background/30 hover:bg-background/60 hover:border-primary/20 transition-all group">
                    <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                      <action.icon className="w-5 h-5" />
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
            className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 flex flex-col justify-center"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-foreground font-medium mb-1">Dica do dia</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Use o <Link href="/agent/coordenador-geral" className="text-primary hover:underline">Coordenador Geral</Link> para orquestrar múltiplos agentes em campanhas complexas com um único comando.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
