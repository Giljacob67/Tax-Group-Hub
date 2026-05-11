import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Bot, MessageSquare, Zap,
  Users, TrendingUp, Clock, CheckCircle2,
  Crown, Briefcase, Megaphone, Settings2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useListAgents, useListConversations } from "@workspace/api-client-react";
import { SkeletonMetricsGrid, SkeletonAgentBlocks } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

const BLOCKS = [
  { id: "estrategia", title: "Estratégia e Inteligência",    icon: Crown,     gradient: "from-amber-500/20 to-amber-900/20",   border: "border-amber-500/30",  desc: "Centro de comando: orquestra campanhas e distribui tarefas." },
  { id: "prospeccao", title: "Prospecção Comercial",          icon: Briefcase, gradient: "from-blue-500/20 to-blue-900/20",     border: "border-blue-500/30",   desc: "Abordagem, qualificação, deals complexos e follow-up." },
  { id: "marketing",  title: "Agência Virtual de Marketing",  icon: Megaphone, gradient: "from-purple-500/20 to-purple-900/20", border: "border-purple-500/30", desc: "LinkedIn, email, vídeo, WhatsApp e calendário editorial." },
  { id: "gestao",     title: "Gestão e Operação Interna",     icon: Settings2, gradient: "from-emerald-500/20 to-emerald-900/20", border: "border-emerald-500/30", desc: "Pipeline, propostas, relatórios e treinamento de parceiros." },
];

export default function Dashboard() {
  const { data: agentsData, isLoading: isLoadingAgents } = useListAgents();
  const { data: convData, isLoading: isLoadingConvs }   = useListConversations();

  const { data: contactsData } = useQuery<{ total: number; enriched: number; qualified: number }>({
    queryKey: ["/api/crm/contacts/summary"],
    queryFn: async () => {
      const r = await fetch("/api/crm/contacts?limit=1000");
      const d = await r.json();
      const contacts = d.contacts ?? [];
      return {
        total:     contacts.length,
        enriched:  contacts.filter((c: any) => c.aiScore != null).length,
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

  const activeSeqs    = seqData?.sequences?.filter((s: any) => s.isActive).length ?? 0;
  const activeEnrolls = enrollData?.enrollments?.filter((e: any) => e.status === "active").length ?? 0;
  const totalContacts = contactsData?.total ?? 0;
  const enrichedCount = contactsData?.enriched ?? 0;
  const totalConvs    = (convData as any)?.conversations?.length ?? 0;

  const metrics = [
    { label: "Agentes ativos",        value: agentsData?.agents?.length ?? 0,  icon: <Bot className="w-5 h-5 text-blue-400" />,     bg: "bg-blue-500/15",    border: "border-blue-500/20"    },
    { label: "Conversas totais",      value: totalConvs,                        icon: <MessageSquare className="w-5 h-5 text-purple-400" />, bg: "bg-purple-500/15", border: "border-purple-500/20" },
    { label: "Contatos no CRM",       value: totalContacts,                     icon: <Users className="w-5 h-5 text-sky-400" />,     bg: "bg-sky-500/15",     border: "border-sky-500/20"     },
    { label: "Enriquecidos com IA",   value: enrichedCount,                     icon: <TrendingUp className="w-5 h-5 text-amber-400" />, bg: "bg-amber-500/15",  border: "border-amber-500/20"  },
    { label: "Sequências ativas",     value: activeSeqs,                        icon: <Zap className="w-5 h-5 text-emerald-400" />,  bg: "bg-emerald-500/15", border: "border-emerald-500/20" },
    { label: "Contatos em sequência", value: activeEnrolls,                     icon: <Clock className="w-5 h-5 text-orange-400" />, bg: "bg-orange-500/15",  border: "border-orange-500/20"  },
  ];

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="p-6 max-w-7xl mx-auto space-y-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-1">
            <img
              src={`${import.meta.env.BASE_URL}images/logo-taxgroup-branco.svg`}
              alt="Tax Group"
              className="h-7 w-auto drop-shadow-[0_0_8px_rgba(16,126,194,0.5)]"
            />
            <span className="text-xs font-bold tracking-widest uppercase text-primary/70">AI Hub</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Visão Geral
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {agentsData?.agents?.length ?? 0} agentes especializados prontos para operar.
          </p>
        </motion.div>

        {/* ── Metrics ── */}
        {isLoadingAgents || isLoadingConvs ? (
          <SkeletonMetricsGrid />
        ) : (
          <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
        >
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              className={`rounded-xl border ${m.border} ${m.bg} p-4 flex flex-col gap-2 hover:brightness-110 transition-all`}
            >
              <div className={`w-8 h-8 rounded-lg bg-background/30 flex items-center justify-center`}>
                {m.icon}
              </div>
              <div className="text-2xl font-bold">{m.value}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">{m.label}</div>
            </motion.div>
          ))}
        </motion.div>
        )}

        {/* ── Agent Blocks ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <h2 className="text-base font-semibold mb-4 text-muted-foreground uppercase tracking-wider text-xs">
            Blocos de Agentes
          </h2>
          {isLoadingAgents ? (
            <SkeletonAgentBlocks />
          ) : agentsData?.agents?.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Nenhum agente encontrado"
              description="Os agentes de IA ainda não foram configurados. Verifique se o backend está rodando corretamente."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            {BLOCKS.map((block, i) => {
              const blockAgents = agentsData?.agents?.filter((a: any) => a.block === block.id) ?? [];
              return (
                <motion.div
                  key={block.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: 0.3 + i * 0.07 }}
                  className={`rounded-2xl border ${block.border} bg-gradient-to-b ${block.gradient} p-5 overflow-hidden group hover:shadow-glow transition-all duration-300`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <block.icon className="w-4 h-4 text-white/60" />
                      <h3 className="text-sm font-bold text-white leading-tight">{block.title}</h3>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
                      {blockAgents.length}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs mb-4 leading-relaxed">{block.desc}</p>
                  <div className="space-y-1.5">
                    {blockAgents.slice(0, 5).map((agent: any) => (
                      <Link
                        key={agent.id}
                        href={`/agent/${agent.id}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/20 transition-all group/link"
                      >
                        <span className="text-xs text-white/80 group-hover/link:text-white truncate pr-2">{agent.name}</span>
                        <ArrowRight className="w-3 h-3 text-white/30 group-hover/link:text-white flex-shrink-0 transform group-hover/link:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                    {blockAgents.length > 5 && (
                      <div className="text-center text-[11px] text-white/40 pt-1">
                        + {blockAgents.length - 5} mais na barra lateral
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
