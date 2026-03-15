import { Link } from "wouter";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Building2, MessageSquare, ArrowRight, ShieldCheck, Zap, Bot,
  TrendingUp, Calendar, Target, Crown, Sparkles, Clock, AlertTriangle,
  ChevronRight, BarChart3, Users, FileText
} from "lucide-react";
import { useListAgents, useListConversations, useListKnowledgeDocuments } from "@workspace/api-client-react";

interface StatsData {
  totalAgents: number;
  totalConversations: number;
  agentUsage: { agentId: string; name: string; icon: string; block: string; conversations7d: number }[];
  fiscalDates: { name: string; date: string; urgency: string }[];
  weeklyFocus: { title: string; description: string; agentId: string; agentName: string };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatFiscalDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const NEW_AGENT_IDS = ["cmo-maestro-tax-group", "inteligencia-prospects-tax-group"];

export default function Dashboard() {
  const { data: agentsData } = useListAgents();
  const { data: convData } = useListConversations();
  const { data: docsData } = useListKnowledgeDocuments();
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const blocks = [
    { id: "prospeccao", title: "Prospecção Comercial", desc: "Qualificação, abordagem ativa e inteligência de prospects.", gradient: "from-blue-600/30 to-blue-900/20", border: "border-blue-500/30", iconColor: "text-blue-400" },
    { id: "marketing", title: "Agência Virtual de Marketing", desc: "Conteúdo multicanal, estratégia e materiais de vendas.", gradient: "from-purple-600/30 to-purple-900/20", border: "border-purple-500/30", iconColor: "text-purple-400" },
    { id: "gestao", title: "Gestão & Operação", desc: "Pipeline, roteiros de reunião e propostas comerciais.", gradient: "from-emerald-600/30 to-emerald-900/20", border: "border-emerald-500/30", iconColor: "text-emerald-400" }
  ];

  const agentConvCounts: Record<string, number> = {};
  if (stats?.agentUsage) {
    stats.agentUsage.forEach(a => { agentConvCounts[a.agentId] = a.conversations7d; });
  }

  const topAgents = stats?.agentUsage?.slice(0, 5) || [];

  return (
    <div className="min-h-screen w-full relative overflow-y-auto overflow-x-hidden">
      <div className="absolute top-0 left-0 w-full h-[50vh] z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Hero"
          className="w-full h-full object-cover opacity-40 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/80 to-background" />
      </div>

      <div className="relative z-10 p-4 sm:p-8 max-w-7xl mx-auto mt-6 sm:mt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm mb-4">
            <ShieldCheck className="w-4 h-4 mr-2" />
            17 Agentes Especializados
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Tax Group!</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Central de inteligência artificial da Tax Group. Prospecção, marketing e gestão — tudo orquestrado por IA.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8"
        >
          <StatCard icon={<Bot className="w-5 h-5 text-blue-400" />} value={stats?.totalAgents || agentsData?.agents?.length || 0} label="Agentes Ativos" bg="bg-blue-500/15" />
          <StatCard icon={<MessageSquare className="w-5 h-5 text-purple-400" />} value={stats?.totalConversations || convData?.conversations?.length || 0} label="Conversas" bg="bg-purple-500/15" />
          <StatCard icon={<FileText className="w-5 h-5 text-emerald-400" />} value={docsData?.documents?.length || 0} label="Documentos" bg="bg-emerald-500/15" />
          <StatCard icon={<TrendingUp className="w-5 h-5 text-amber-400" />} value={stats?.agentUsage?.reduce((s, a) => s + a.conversations7d, 0) || 0} label="Conversas 7d" bg="bg-amber-500/15" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-10"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Estratégia & Growth
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats?.weeklyFocus && (
              <div className="md:col-span-2 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Foco da Semana</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{stats.weeklyFocus.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{stats.weeklyFocus.description}</p>
                  <Link
                    href={`/agent/${stats.weeklyFocus.agentId}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Abrir {stats.weeklyFocus.agentName} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}

            <div className="bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Datas Fiscais</span>
              </div>
              <div className="space-y-2.5">
                {stats?.fiscalDates?.slice(0, 4).map((fd, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {fd.urgency === "urgent" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm truncate">{fd.name}</span>
                    </div>
                    <span className={`text-xs font-mono flex-shrink-0 ml-2 px-2 py-0.5 rounded-full ${
                      fd.urgency === "urgent" ? "bg-red-500/20 text-red-400" :
                      fd.urgency === "soon" ? "bg-amber-500/20 text-amber-400" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {daysUntil(fd.date)}d — {formatFiscalDate(fd.date)}
                    </span>
                  </div>
                ))}
                {(!stats?.fiscalDates || stats.fiscalDates.length === 0) && (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                )}
              </div>
            </div>
          </div>

          {topAgents.length > 0 && (
            <div className="mt-4 bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Agentes mais usados (7 dias)</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {topAgents.map((a, i) => (
                  <Link
                    key={a.agentId}
                    href={`/agent/${a.agentId}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-sm group"
                  >
                    <span className="text-base">{a.icon}</span>
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{a.conversations7d}</span>
                    {i === 0 && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-12 mb-12"
        >
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Blocos de Agentes
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {blocks.map((block, i) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.4 + (i * 0.08) }}
                className={`rounded-2xl border ${block.border} bg-gradient-to-b ${block.gradient} p-5 overflow-hidden relative group`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <h3 className="text-lg font-bold text-white mb-1">{block.title}</h3>
                  <p className="text-white/60 text-xs mb-4">{block.desc}</p>

                  <div className="space-y-1.5">
                    {agentsData?.agents?.filter(a => a.block === block.id).map(agent => {
                      const isNew = NEW_AGENT_IDS.includes(agent.id);
                      const convCount = agentConvCounts[agent.id] || 0;
                      const isPopular = convCount >= 3;
                      return (
                        <Link
                          key={agent.id}
                          href={`/agent/${agent.id}`}
                          className="block w-full text-left px-3 py-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/20 transition-all duration-200 group/link hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-base flex-shrink-0">{agent.icon}</span>
                              <span className="font-medium text-sm text-white/90 group-hover/link:text-white truncate">{agent.name}</span>
                              {isNew && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex-shrink-0">
                                  NOVO
                                </span>
                              )}
                              {isPopular && !isNew && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold flex-shrink-0">
                                  POPULAR
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {convCount > 0 && (
                                <span className="text-[10px] text-white/40">{convCount} conv</span>
                              )}
                              <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover/link:text-white transform group-hover/link:translate-x-1 transition-transform" />
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] text-white/30 group-hover/link:text-white/50 truncate transition-colors pl-7">
                            {agent.suggestedPrompts?.[0] || agent.description}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, bg }: { icon: React.ReactNode; value: number; label: string; bg: string }) {
  return (
    <div className="bg-card/50 backdrop-blur-md border border-border/50 rounded-xl p-4 shadow-sm">
      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <h3 className="text-2xl sm:text-3xl font-bold text-foreground">{value}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
