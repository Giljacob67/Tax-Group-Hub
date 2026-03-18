import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, ExternalLink, X, Zap, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  agentId: string;
  task: string;
}

interface AgentResult {
  agentId: string;
  agentName: string;
  icon: string;
  response: string;
  conversationId: string;
  success: boolean;
  error?: string;
}

interface CoordinatorReview {
  response: string;
  conversationId: string;
}

// Lookup for display names when API hasn't resolved yet
const AGENT_NAMES: Record<string, { name: string; icon: string }> = {
  "prospeccao-tax-group": { name: "Prospecção", icon: "🎯" },
  "coach-descoberta-tax-group": { name: "Coach de Descoberta", icon: "🔍" },
  "qualificacao-leads-tax-group": { name: "Qualificação de Leads", icon: "📊" },
  "estrategista-deals-tax-group": { name: "Estrategista de Deals", icon: "♟️" },
  "objecoes-tax-group": { name: "Reversão de Objeções", icon: "🛡️" },
  "followup-tax-group": { name: "Follow-Up", icon: "📅" },
  "conteudo-linkedin-tax-group": { name: "LinkedIn", icon: "💼" },
  "email-marketing-tax-group": { name: "Email Marketing", icon: "✉️" },
  "materiais-comerciais-tax-group": { name: "Materiais Comerciais", icon: "📄" },
  "reformatributaria-insight": { name: "Reforma Tributária", icon: "⚖️" },
  "conteudo-video-tax-group": { name: "Conteúdo para Vídeo", icon: "🎬" },
  "whatsapp-tax-group": { name: "WhatsApp", icon: "📱" },
  "calendario-editorial-tax-group": { name: "Calendário Editorial", icon: "📆" },
  "midia-paga-tax-group": { name: "Mídia Paga", icon: "💰" },
  "seo-tax-group": { name: "SEO & Orgânico", icon: "🔍" },
  "gestao-pipeline-tax-group": { name: "Pipeline", icon: "🔄" },
  "roteiro-reuniao-tax-group": { name: "Roteiro de Reunião", icon: "📋" },
  "proposta-comercial-tax-group": { name: "Proposta Comercial", icon: "📑" },
  "relatorio-performance-tax-group": { name: "Relatório de Performance", icon: "📊" },
  "treinamento-parceiros-tax-group": { name: "Treinamento de Parceiros", icon: "👨‍🏫" },
  "expansao-carteira-tax-group": { name: "Expansão de Carteira", icon: "📈" },
  "coach-comercial-tax-group": { name: "Coach Comercial", icon: "🏋️" },
};

export function OrchestrateModal({
  tasks,
  onClose,
  onNavigate,
}: {
  tasks: Task[];
  onClose: () => void;
  onNavigate: (agentId: string) => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"preview" | "running" | "reviewing" | "done">("preview");
  const [results, setResults] = useState<AgentResult[]>([]);
  const [coordinatorReview, setCoordinatorReview] = useState<CoordinatorReview | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [reviewExpanded, setReviewExpanded] = useState(true);

  const toggleExpand = (agentId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(agentId) ? next.delete(agentId) : next.add(agentId);
      return next;
    });
  };

  const handleExecute = async () => {
    setStatus("running");
    setResults(tasks.map(t => ({
      agentId: t.agentId,
      agentName: AGENT_NAMES[t.agentId]?.name || t.agentId,
      icon: AGENT_NAMES[t.agentId]?.icon || "🤖",
      response: "",
      conversationId: "",
      success: false,
    })));

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      if (!res.ok) throw new Error("Orchestration request failed");
      const data = await res.json() as { results: AgentResult[]; coordinatorReview?: CoordinatorReview };

      // Show agent results and transition to "reviewing" phase
      setResults(data.results);
      setStatus("reviewing");

      // Small delay so user sees the "reviewing" state before done
      await new Promise(r => setTimeout(r, 600));

      if (data.coordinatorReview?.response) {
        setCoordinatorReview(data.coordinatorReview);
      }
      setStatus("done");

      // Auto-expand first successful result
      const firstSuccess = data.results.find(r => r.success);
      if (firstSuccess) setExpandedIds(new Set([firstSuccess.agentId]));
      toast({ title: `✅ ${data.results.filter(r => r.success).length}/${tasks.length} agentes + parecer do Coordenador` });
    } catch (err) {
      void err;
      toast({ title: "Erro na orquestração", description: "Verifique a conexão com a API.", variant: "destructive" });
      setStatus("preview");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && status !== "running") onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-card border border-border/50 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-gradient-to-r from-[#107ec2]/10 to-blue-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#107ec2]/20 flex items-center justify-center text-xl">🚀</div>
            <div>
              <h2 className="font-bold text-lg text-white">
                {status === "preview" ? "Executar Plano com Agentes"
                  : status === "running" ? "Executando agentes..."
                  : status === "reviewing" ? "Coordenador analisando..."
                  : "Plano Executado ✓"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {status === "preview" ? `${tasks.length} agente${tasks.length !== 1 ? "s" : ""} serão acionados em paralelo`
                  : status === "running" ? "Aguardando respostas dos especialistas..."
                  : status === "reviewing" ? "Coordenador Geral revisando os outputs..."
                  : `${results.filter(r => r.success).length}/${tasks.length} agentes + parecer do Coordenador`}
              </p>
            </div>
          </div>
          {status !== "running" && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {status === "preview" && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Confirme as tarefas que serão enviadas a cada agente:
              </p>
              {tasks.map((task, i) => {
                const meta = AGENT_NAMES[task.agentId] || { name: task.agentId, icon: "🤖" };
                return (
                  <motion.div
                    key={task.agentId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-background/50 border border-border/50 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{meta.icon}</span>
                      <span className="font-semibold text-sm text-white">{meta.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{task.task}</p>
                  </motion.div>
                );
              })}
            </>
          )}

          {(status === "running" || status === "reviewing" || status === "done") && results.map((result) => (
            <div key={result.agentId} className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
              result.success ? "border-emerald-500/20 bg-emerald-500/5" : result.response === "" && status === "running" ? "border-border/50 bg-background/30" : "border-red-500/20 bg-red-500/5"
            }`}>
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => result.success && toggleExpand(result.agentId)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{result.icon}</span>
                  <span className="font-semibold text-sm text-white">{result.agentName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === "running" && !result.success && result.response === "" && (
                    <Loader2 className="w-4 h-4 animate-spin text-[#107ec2]" />
                  )}
                  {result.success && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {expandedIds.has(result.agentId) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </>
                  )}
                  {!result.success && result.error && <XCircle className="w-4 h-4 text-red-400" />}
                </div>
              </div>
              <AnimatePresence>
                {expandedIds.has(result.agentId) && result.success && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-border/30">
                      <div className="mt-3 text-xs text-foreground/80 prose prose-xs dark:prose-invert max-w-none max-h-48 overflow-y-auto">
                        <ReactMarkdown>{result.response}</ReactMarkdown>
                      </div>
                      <button
                        onClick={() => { onNavigate(result.agentId); onClose(); }}
                        className="mt-3 flex items-center gap-1.5 text-xs text-[#107ec2] hover:text-[#107ec2]/80 transition-colors font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver conversa completa
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!result.success && result.error && (
                <div className="px-4 pb-3 text-xs text-red-400">{result.error}</div>
              )}
            </div>
          ))}
          {/* Coordinator reviewing indicator */}
          {status === "reviewing" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-amber-500/30 bg-amber-500/5 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-lg shrink-0">🎖️</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">Coordenador Geral</p>
                <p className="text-xs text-muted-foreground">Analisando coerência e preparando parecer executivo...</p>
              </div>
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            </motion.div>
          )}

          {/* Coordinator final review card */}
          {status === "done" && coordinatorReview?.response && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-amber-500/5 rounded-2xl overflow-hidden"
            >
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setReviewExpanded(v => !v)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-lg shrink-0">🎖️</div>
                  <div>
                    <p className="text-sm font-bold text-amber-300">Parecer do Coordenador Geral</p>
                    <p className="text-xs text-muted-foreground">Análise executiva consolidada</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  {reviewExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
              <AnimatePresence>
                {reviewExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-amber-500/20">
                      <div className="mt-3 text-xs text-foreground/85 prose prose-xs dark:prose-invert max-w-none max-h-64 overflow-y-auto">
                        <ReactMarkdown>{coordinatorReview.response}</ReactMarkdown>
                      </div>
                      {coordinatorReview.conversationId && (
                        <button
                          onClick={() => { onNavigate("coordenador-geral-tax-group"); onClose(); }}
                          className="mt-3 flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver conversa de supervisão completa
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        {(status === "preview" || status === "running" || status === "reviewing") && (
          <div className="p-6 border-t border-border/50 flex gap-3">
            <button
              onClick={onClose}
              disabled={status === "running" || status === "reviewing"}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleExecute}
              disabled={status === "running" || status === "reviewing"}
              className="flex-2 flex-grow-[2] py-3 rounded-xl bg-gradient-to-r from-[#107ec2] to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === "running" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Executando agentes...</>
              ) : status === "reviewing" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Coordenador analisando...</>
              ) : (
                <><Zap className="w-4 h-4" /> Confirmar e Executar</>
              )}
            </button>
          </div>
        )}
        {status === "done" && (
          <div className="p-6 border-t border-border/50">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#107ec2]/20 text-[#107ec2] border border-[#107ec2]/30 text-sm font-semibold hover:bg-[#107ec2]/30 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
