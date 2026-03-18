import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import {
  Send, Bot, User, Plus, MessageSquare, Loader2,
  Copy, CheckCheck, Trash2, Search, Download,
  Settings, Sparkles, Pencil, Check, X, Cpu,
  ChevronDown
} from "lucide-react";
import {
  useGetAgent,
  useListConversations,
  useCreateConversation,
  useGetConversation,
  useSendMessage,
  useDeleteConversation,
  useRenameConversation,
  useHealthCheck,
  useGetAvailableModels,
  getListConversationsQueryKey,
  getGetConversationQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DesignStudioPanel } from "@/components/design-studio-panel";
import { OrchestrateModal } from "@/components/orchestrate-modal";

export default function AgentChat() {
  const { id: agentId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState("");
  const [showDesignStudio, setShowDesignStudio] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(() => {
    try { return localStorage.getItem("taxgroup_selected_model"); } catch { return null; }
  });
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [orchestrationPlan, setOrchestrationPlan] = useState<Array<{agentId: string; task: string}> | null>(null);
  const [showOrchestrateModal, setShowOrchestrateModal] = useState(false);

  const { data: agent, isLoading: isLoadingAgent } = useGetAgent(agentId!);
  const { data: conversations, isLoading: isLoadingConvs } = useListConversations({ agentId });
  const { data: activeConv, isLoading: isLoadingMessages } = useGetConversation(activeConvId!, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!activeConvId } as any
  });

  const createMutation = useCreateConversation();
  const sendMutation = useSendMessage();
  const deleteMutation = useDeleteConversation();
  const renameMutation = useRenameConversation();
  const { data: healthData, isError: healthError } = useHealthCheck({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { refetchInterval: 30000 } as any
  });
  const { data: modelsData } = useGetAvailableModels({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { staleTime: 300000 } as any
  });

  const isDesignStudioAgent = !!agent?.designStudio;
  const isOpenRouter = modelsData?.provider === "openrouter";
  const effectiveModel = isOpenRouter
    ? (selectedModel || activeConv?.model || modelsData?.defaultModel || "google/gemini-flash-1.5")
    : (activeConv?.model || modelsData?.defaultModel || "llama3.2");
  const displayModel = modelsData?.models?.find(m => m.id === effectiveModel)?.name || effectiveModel;
  const provider = activeConv?.provider || "OpenRouter";
  const isApiOnline = !!healthData?.status && !healthError;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, sendMutation.isPending]);

  useEffect(() => {
    if (!activeConvId && conversations?.conversations?.length) {
      setActiveConvId(conversations.conversations[0].id);
    }
  }, [conversations, activeConvId]);

  useEffect(() => {
    setActiveConvId(null);
    setCustomSystemPrompt(null);
    setShowDesignStudio(false);
  }, [agentId]);

  const handleNewChat = () => setActiveConvId(null);

  const handleCreateAndSend = async (text: string) => {
    if (!text.trim() || !agentId) return;
    setInput("");
    try {
      let convId = activeConvId;
      if (!convId) {
        const newConv = await createMutation.mutateAsync({ data: { agentId } });
        convId = newConv.id;
        setActiveConvId(convId);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      }
      const res = await sendMutation.mutateAsync({
        conversationId: convId,
        data: {
          content: text,
          useKnowledgeBase: true,
          customSystemPrompt: customSystemPrompt || undefined,
          model: (isOpenRouter && selectedModel) ? selectedModel : undefined,
        }
      });
      if (res.autoTitle) {
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      }
      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
    } catch {
      toast({ title: "Erro ao enviar mensagem", description: "Tente novamente.", variant: "destructive" });
      setInput(text);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ conversationId: deleteTarget });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      if (activeConvId === deleteTarget) setActiveConvId(null);
      toast({ title: "Conversa excluída" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleRename = async (convId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameMutation.mutateAsync({
        conversationId: convId,
        data: { title: renameValue.trim() },
      });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      if (activeConvId === convId) {
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
      }
    } catch {
      toast({ title: "Erro ao renomear", variant: "destructive" });
    }
    setRenamingId(null);
  };

  const handleExport = async () => {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/conversations/${activeConvId}/export`);
      if (!res.ok) throw new Error("Export failed");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversa-${activeConvId}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Conversa exportada!" });
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveSystemPrompt = () => {
    const newPrompt = editingPrompt || null;
    setCustomSystemPrompt(newPrompt);
    setShowSystemPrompt(false);
    toast({ title: newPrompt ? "System prompt atualizado" : "System prompt restaurado" });
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    try { localStorage.setItem("taxgroup_selected_model", modelId); } catch {}
    setShowModelSelector(false);
    const modelName = modelsData?.models?.find(m => m.id === modelId)?.name || modelId;
    toast({ title: `Modelo alterado: ${modelName}` });
  };

  const filteredConversations = conversations?.conversations?.filter(
    c => !searchFilter || c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  function parseOrchestrationPlan(content: string): Array<{agentId: string; task: string}> | null {
    const match = content.match(/\[ORCHESTRATION_PLAN\]\s*([\s\S]*?)\s*\[\/ORCHESTRATION_PLAN\]/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return null;
  }

  function stripOrchestrationBlock(content: string): string {
    return content.replace(/\n*\[ORCHESTRATION_PLAN\][\s\S]*?\[\/ORCHESTRATION_PLAN\]/g, "").trim();
  }

  if (isLoadingAgent) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agent) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Agent not found</div>;

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-background">
      <div className="w-72 border-r border-border/50 bg-card/30 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/50 backdrop-blur-sm">
          <h2 className="font-semibold text-sm text-muted-foreground tracking-wide uppercase">Histórico</h2>
          <button onClick={handleNewChat} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Novo Chat">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full bg-background border border-border/50 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-primary transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {isLoadingConvs ? (
            <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : filteredConversations?.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground">
              {searchFilter ? "Nenhum resultado" : "Nenhuma conversa ainda"}
            </div>
          ) : (
            filteredConversations?.map((conv) => (
              <div
                key={conv.id}
                onClick={() => { if (renamingId !== conv.id) setActiveConvId(conv.id); }}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start justify-between cursor-pointer ${
                  activeConvId === conv.id
                    ? 'bg-[#107ec2]/10 border-l-2 border-[#107ec2] border-y-0 border-r-0 rounded-l-none shadow-[0_0_10px_rgba(16,126,194,0.08)]'
                    : 'hover:bg-[#107ec2]/5 border border-transparent'
                }`}
              >
                <div className="flex items-start space-x-3 overflow-hidden flex-1 min-w-0">
                  <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeConvId === conv.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex flex-col min-w-0 flex-1">
                    {renamingId === conv.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleRename(conv.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="text-sm bg-background border border-primary rounded px-1.5 py-0.5 w-full focus:outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id); }} className="p-0.5 text-emerald-400 hover:text-emerald-300">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setRenamingId(null); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-sm font-medium truncate ${activeConvId === conv.id ? 'text-foreground' : 'text-foreground/80'}`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(conv.id);
                          setRenameValue(conv.title || "");
                        }}
                        title="Duplo-clique para renomear"
                      >
                        {conv.title || "Nova Conversa"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground mt-1">
                      {format(new Date(conv.updatedAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title || ""); }}
                    className="p-1 hover:bg-white/10 rounded transition-all"
                    title="Renomear"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv.id); }}
                    className="p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#107ec2]/15 flex items-center justify-center border border-[#107ec2]/25 shadow-glow text-xl select-none">
              {agent.icon || <Bot className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <h2 className="font-bold text-foreground">{agent.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{agent.blockLabel}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${
                  isApiOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isApiOnline ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                  {isApiOnline ? 'Online' : 'Offline'}
                </span>
                {isOpenRouter ? (
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                    title="Clique para trocar o modelo"
                  >
                    <Cpu className="w-2.5 h-2.5" /> {displayModel}
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" /> {displayModel}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">via {provider}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDesignStudioAgent && (
              <button
                onClick={() => setShowDesignStudio(!showDesignStudio)}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                  showDesignStudio ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/5 text-muted-foreground'
                }`}
                title="Design Studio"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden lg:inline">Design Studio</span>
              </button>
            )}
            {activeConvId && (
              <button
                onClick={handleExport}
                className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors"
                title="Exportar conversa (.md)"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => { setEditingPrompt(customSystemPrompt || agent.systemPrompt || ""); setShowSystemPrompt(true); }}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors"
              title="Editar System Prompt"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <AnimatePresence>
          {showModelSelector && isOpenRouter && modelsData?.models && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute top-16 left-0 right-0 z-20 bg-card/95 backdrop-blur-lg border-b border-border/50 shadow-xl"
            >
              <div className="max-w-3xl mx-auto p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Escolha o modelo</h3>
                  <button onClick={() => setShowModelSelector(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
                  {modelsData.models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleSelectModel(m.id)}
                      className={`text-left p-3 rounded-xl border transition-all hover:-translate-y-0.5 ${
                        effectiveModel === m.id
                          ? 'bg-primary/10 border-primary/30 shadow-[0_0_10px_rgba(30,64,175,0.15)]'
                          : 'bg-background/50 border-border/30 hover:border-primary/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${effectiveModel === m.id ? 'text-primary' : 'text-foreground'}`}>
                          {m.name}
                        </span>
                        {effectiveModel === m.id && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{m.description}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{m.id}</p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {!activeConvId && !isLoadingMessages && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mt-16">
                <div className="bg-card/50 border border-border/50 rounded-3xl p-10 max-w-lg w-full text-center shadow-lg mb-8">
                  <div className="text-6xl mb-5 select-none">{agent.icon || "🤖"}</div>
                  <h3 className="text-2xl font-bold text-white mb-2">{agent.name}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{agent.description}</p>
                </div>
                {agent.suggestedPrompts?.length > 0 && (
                  <div className="w-full max-w-2xl">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3 text-center">Sugestões de início</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {agent.suggestedPrompts.map((prompt: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => handleCreateAndSend(prompt)}
                          className="p-4 rounded-2xl border border-border/50 bg-card/40 hover:bg-[#107ec2]/8 hover:border-[#107ec2]/40 text-left text-sm text-foreground/80 hover:text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(16,126,194,0.1)]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence>
              {activeConv?.messages?.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 text-base select-none ${msg.role === 'user' ? 'bg-secondary' : 'bg-[#107ec2]/15 border border-[#107ec2]/20'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 text-foreground/70" /> : <span>{agent.icon || "🤖"}</span>}
                    </div>
                    <div className={`relative group p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#107ec2] text-white rounded-br-sm shadow-md' : 'bg-card/30 text-foreground rounded-bl-sm shadow-sm'}`}>
                      {msg.role === 'assistant' && (
                        <button onClick={() => handleCopy(msg.content, msg.id)} className="absolute -right-10 top-2 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" title="Copiar">
                          {copiedId === msg.id ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                      <div className={`text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none ${msg.role === 'user' ? 'prose-p:text-white prose-strong:text-white' : ''}`}>
                        <ReactMarkdown>{msg.role === 'assistant' ? stripOrchestrationBlock(msg.content) : msg.content}</ReactMarkdown>
                      </div>
                      <div className={`text-[10px] mt-2 text-right ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </div>
                      {msg.role === 'assistant' && agentId === 'coordenador-geral-tax-group' && (() => {
                        const plan = parseOrchestrationPlan(msg.content);
                        if (!plan) return null;
                        return (
                          <button
                            onClick={() => { setOrchestrationPlan(plan); setShowOrchestrateModal(true); }}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-[#107ec2] to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg"
                          >
                            🚀 Executar Plano com Agentes ({plan.length} agente{plan.length !== 1 ? 's' : ''})
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {sendMutation.isPending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-[#107ec2]/15 border border-[#107ec2]/20 flex items-center justify-center mb-1 text-base select-none">
                    {agent.icon || <Bot className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="bg-card/30 rounded-2xl rounded-bl-sm p-4 flex space-x-2 items-center h-12">
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 bg-background border-t border-border/50">
          <div className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateAndSend(input); } }}
              placeholder={`Mensagem para ${agent.name}...`}
              className="w-full bg-card border border-[#107ec2]/30 focus:border-[#107ec2] focus:shadow-[0_0_0_2px_rgba(16,126,194,0.20)] rounded-xl pl-5 pr-14 py-4 text-sm shadow-sm transition-all outline-none"
              disabled={sendMutation.isPending}
            />
            <button
              onClick={() => handleCreateAndSend(input)}
              disabled={!input.trim() || sendMutation.isPending}
              className="absolute right-2 p-2.5 rounded-lg bg-[#107ec2] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#107ec2]/90 transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-2">
            <Cpu className="w-3 h-3" /> {displayModel} via {provider}
            {customSystemPrompt && <span className="text-amber-400">• Prompt customizado</span>}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDesignStudio && isDesignStudioAgent && (
          <DesignStudioPanel
            agentId={agentId!}
            agentName={agent.name}
            onClose={() => setShowDesignStudio(false)}
          />
        )}
      </AnimatePresence>

      {showOrchestrateModal && orchestrationPlan && (
        <OrchestrateModal
          tasks={orchestrationPlan}
          onClose={() => { setShowOrchestrateModal(false); setOrchestrationPlan(null); }}
          onNavigate={(targetAgentId) => navigate(`/agent/${targetAgentId}`)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as mensagens desta conversa serão permanentemente excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSystemPrompt} onOpenChange={setShowSystemPrompt}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" /> System Prompt — {agent.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              className="w-full h-[400px] bg-background border border-border rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
              placeholder="System prompt do agente..."
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{editingPrompt.length} caracteres</span>
            {customSystemPrompt && (
              <button
                onClick={() => { setEditingPrompt(agent.systemPrompt || ""); setCustomSystemPrompt(null); }}
                className="text-amber-400 hover:text-amber-300 underline"
              >
                Restaurar original
              </button>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowSystemPrompt(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSaveSystemPrompt} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
