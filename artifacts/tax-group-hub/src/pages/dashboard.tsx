import { Link } from "wouter";
import { motion } from "framer-motion";
import { Building2, MessageSquare, ArrowRight, ShieldCheck, Zap, Bot } from "lucide-react";
import { useListAgents, useListConversations, useListKnowledgeDocuments } from "@workspace/api-client-react";

export default function Dashboard() {
  const { data: agentsData } = useListAgents();
  const { data: convData } = useListConversations();
  const { data: docsData } = useListKnowledgeDocuments();

  const blocks = [
    { id: "estrategia", title: "Estratégia e Inteligência", desc: "Centro de comando: orquestra campanhas e distribui tarefas entre todos os agentes.", gradient: "from-amber-500/20 to-amber-900/20", border: "border-amber-500/30" },
    { id: "prospeccao", title: "Prospecção Comercial", desc: "Agents optimized for lead gen, scoring, and follow-ups.", gradient: "from-blue-500/20 to-blue-900/20", border: "border-blue-500/30" },
    { id: "marketing", title: "Agência Virtual de Marketing", desc: "Criação de conteúdo multi-canal: LinkedIn, email, vídeo, WhatsApp e calendário editorial.", gradient: "from-purple-500/20 to-purple-900/20", border: "border-purple-500/30" },
    { id: "gestao", title: "Gestão e Operação Interna", desc: "Pipeline, reuniões, propostas, relatórios de performance e treinamento de parceiros.", gradient: "from-emerald-500/20 to-emerald-900/20", border: "border-emerald-500/30" }
  ];

  return (
    <div className="min-h-screen w-full relative overflow-y-auto overflow-x-hidden">
      {/* Hero Background */}
      <div className="absolute top-0 left-0 w-full h-[50vh] z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Hero" 
          className="w-full h-full object-cover opacity-40 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/80 to-background"></div>
      </div>

      <div className="relative z-10 p-8 max-w-7xl mx-auto mt-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm mb-6">
            <ShieldCheck className="w-4 h-4 mr-2" /> 
            Enterprise Grade AI Systems
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Tax Group <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">AI Hub</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Welcome to the intelligent core of Tax Group. Leverage 17 specialized AI agents — coordinated by a strategic orchestrator — to accelerate prospecting, automate marketing, and streamline internal operations.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
        >
          {/* Stats Cards */}
          <div className="bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-3xl font-bold text-foreground">{agentsData?.agents?.length || 0}</h3>
            <p className="text-sm text-muted-foreground mt-1">Active AI Agents</p>
          </div>
          
          <div className="bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-3xl font-bold text-foreground">{convData?.conversations?.length || 0}</h3>
            <p className="text-sm text-muted-foreground mt-1">Total Conversations</p>
          </div>

          <div className="bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-3xl font-bold text-foreground">{docsData?.documents?.length || 0}</h3>
            <p className="text-sm text-muted-foreground mt-1">Knowledge Documents</p>
          </div>
        </motion.div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-8 flex items-center">
            Agent Blocks <ChevronIcon className="ml-2 w-5 h-5 text-primary" />
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {blocks.map((block, i) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 + (i * 0.1) }}
                className={`rounded-2xl border ${block.border} bg-gradient-to-b ${block.gradient} p-6 overflow-hidden relative group hover:shadow-glow transition-all duration-300`}
              >
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-white mb-2">{block.title}</h3>
                  <p className="text-white/70 text-sm mb-6 h-10">{block.desc}</p>
                  
                  <div className="space-y-2">
                    {agentsData?.agents?.filter(a => a.block === block.id).map(agent => (
                      <Link key={agent.id} href={`/agent/${agent.id}`} className="block w-full text-left px-4 py-3 rounded-xl bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/20 transition-all duration-200 group/link">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-white/90 group-hover/link:text-white truncate pr-4">{agent.name}</span>
                            <ArrowRight className="w-4 h-4 text-white/40 group-hover/link:text-white transform group-hover/link:translate-x-1 transition-transform" />
                          </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}
