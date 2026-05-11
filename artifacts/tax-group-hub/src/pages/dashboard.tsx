import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Bot, MessageSquare, Zap,
  Users, TrendingUp, Clock, Activity,
  Crown, Briefcase, Megaphone, Settings2,
  Sparkles, ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useListAgents, useListConversations } from "@workspace/api-client-react";
import { SkeletonMetricsGrid, SkeletonAgentBlocks } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

const BLOCKS = [
  { id: "estrategia", title: "Estratégia e Inteligência", icon: Crown, gradient: "from-amber-500/20 to-amber-900/20", border: "border-amber-500/30", desc: "Centro de comando: orquestra campanhas e distribui tarefas.", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]" },
  { id: "prospeccao", title: "Prospecção Comercial", icon: Briefcase, gradient: "from-blue-500/20 to-blue-900/20", border: "border-blue-500/30", desc: "Abordagem, qualificação, deals complexos e follow-up.", glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]" },
  { id: "marketing", title: "Agência Virtual de Marketing", icon: Megaphone, gradient: "from-purple-500/20 to-purple-900/20", border: "border-purple-500/30", desc: "LinkedIn, email, vídeo, WhatsApp e calendário editorial.", glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]" },
  { id: "gestao", title: "Gestão e Operação Interna", icon: Settings2, gradient: "from-emerald-500/20 to-emerald-900/20", border: "border-emerald-500/30", desc: "Pipeline, propostas, relatórios e treinamento de parceiros.", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

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
    { label: "Agentes ativos", value: agentsData?.agents?.length ?? 0, icon: Bot, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", ring: "ring-blue-500/20" },
    { label: "Conversas totais", value: totalConvs, icon: MessageSquare, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", ring: "ring-purple-500/20" },
    { label: "Contatos no CRM", value: totalContacts, icon: Users, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", ring: "ring-sky-500/20" },
    { label: "Enriquecidos com IA", value: enrichedCount, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", ring: "ring-amber-500/20" },
    { label: "Sequências ativas", value: activeSeqs, icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", ring: "ring-emerald-500/20" },
    { label: "Contatos em sequência", value: activeEnrolls, icon: Clock, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", ring: "ring-orange-500/20" },
  ];

  const isLoading = isLoadingAgents || isLoadingConvs;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden pb-safe">
      <div className="p-6 max-w-7xl mx-auto space-y-10">

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-primary/80">Tax Group AI Hub</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                Visão Geral
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {agentsData?.agents?.length ?? 0} agentes especializados prontos para operar seu negócio com inteligência artificial.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
                <Activity className="w-4 h-4" />
                <span>Sistema Online</span>
              </div>
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
                className={`group relative rounded-xl border ${m.border} ${m.bg} p-4 flex flex-col gap-3 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-default`}
              >
                <div className={`w-9 h-9 rounded-lg bg-background/40 flex items-center justify-center ring-1 ${m.ring} group-hover:scale-105 transition-transform`}>
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight">{m.value}</div>
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5">{m.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Agent Blocks ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Blocos de Agentes
            </h2>
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
                return (
                  <motion.div
                    key={block.id}
                    variants={itemVariants}
                    className={`group relative rounded-2xl border ${block.border} bg-gradient-to-b ${block.gradient} p-5 overflow-hidden hover:${block.glow} transition-all duration-300`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center ring-1 ring-white/10">
                            <block.icon className="w-4 h-4 text-white/70" />
                          </div>
                          <h3 className="text-sm font-bold text-white leading-tight">{block.title}</h3>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10 backdrop-blur-sm">
                          {blockAgents.length}
                        </span>
                      </div>
                      <p className="text-white/45 text-xs mb-4 leading-relaxed">{block.desc}</p>
                      <div className="space-y-1">
                        {blockAgents.slice(0, 4).map((agent: any) => (
                          <Link
                            key={agent.id}
                            href={`/agent/${agent.id}`}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/20 transition-all group/link"
                          >
                            <span className="text-xs text-white/75 group-hover/link:text-white truncate pr-2">{agent.name}</span>
                            <ArrowRight className="w-3 h-3 text-white/25 group-hover/link:text-white flex-shrink-0 transform group-hover/link:translate-x-0.5 transition-all" />
                          </Link>
                        ))}
                        {blockAgents.length > 4 && (
                          <div className="text-center text-[11px] text-white/30 pt-1">
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

        {/* ── Quick Tip ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-border/40 bg-card/30 p-4 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">Dica:</span> Use o <Link href="/" className="text-primary hover:underline">Coordenador Geral</Link> para orquestrar múltiplos agentes em campanhas complexas.
          </p>
        </motion.div>

      </div>
    </div>
  );
}
