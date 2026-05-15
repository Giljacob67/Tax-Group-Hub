import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Send, Bot, User, Plus, MessageSquare, Loader2,
  Copy, CheckCheck, Trash2, Search, Download,
  Settings, Sparkles, Pencil, Check, X, Cpu,
  RotateCw, History, FileText, CheckSquare, Building2,
  ClipboardList, Rocket, Lightbulb,
  ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Shield, AlertTriangle, BookOpen
} from "lucide-react";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { usePageTitle } from "@/hooks/use-page-title";
import { DEMO_CHAT_SUGGESTIONS } from "@/lib/demo-data";
import { SkeletonChat, SkeletonChatSidebar } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import {
  useGetAgent,
  useListConversations,
  useCreateConversation,
  useGetConversation,
  useSendMessage,
  useDeleteConversation,
  useRenameConversation,
  useDeleteMessage,
  useHealthCheck,
  // useGetAvailableModels, // replaced by ModelSelector from Model Hub
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
import ModelSelector from "@/components/settings/llm/ModelSelector";
import type { LlmConnection } from "@/components/settings/llm/types";

export default function AgentChat() {
  usePageTitle("Agente");
  const { isDemo } = useDemoMode();
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
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(`taxgroup_system_prompt_${agentId}`);
      return raw || null;
    } catch { return null; }
  });
  const [editingPrompt, setEditingPrompt] = useState("");
  const [showDesignStudio, setShowDesignStudio] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<LlmConnection | null>(() => {
    try {
      const raw = localStorage.getItem("taxgroup_selected_connection");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [orchestrationPlan, setOrchestrationPlan] = useState<Array<{agentId: string; task: string}> | null>(null);
  const [showOrchestrateModal, setShowOrchestrateModal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingConvId, setStreamingConvId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [optimisticUserMsg, setOptimisticUserMsg] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);

  // Per-message RAG quality metadata (captured from SSE done event)
  const [messageMeta, setMessageMeta] = useState<Record<string, {
    ragSources: Array<{ filename: string; score: number }>;
    confidenceLevel: string;
  }>>({});
  // Track which message sources panels are open
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  // Track feedback sent per message
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | -1>>({});

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
  const deleteMsgMutation = useDeleteMessage();
  const { data: healthData, isError: healthError } = useHealthCheck({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { refetchInterval: 30000 } as any
  });
  const isDesignStudioAgent = !!agent?.designStudio;
  const effectiveModel = selectedConnection?.modelId || activeConv?.model || "google/gemini-flash-1.5";
  const displayModel = selectedConnection?.name || activeConv?.model || "Padrão";
  const provider = selectedConnection?.provider || activeConv?.provider || "auto";
  const isApiOnline = !!healthData?.status && !healthError;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeConv?.messages, scrollToBottom]);

  const [isCreatingNewChat, setIsCreatingNewChat] = useState(false);
  const [availableConnections, setAvailableConnections] = useState<LlmConnection[]>([]);

  useEffect(() => {
    if (!activeConvId && conversations?.conversations?.length && !isCreatingNewChat) {
      setActiveConvId(conversations.conversations[0].id);
    }
  }, [conversations, activeConvId, isCreatingNewChat]);

  useEffect(() => {
    fetch("/api/llm/connections")
      .then(r => r.json())
      .then(d => setAvailableConnections(d.connections || []))
      .catch(() => setAvailableConnections([]));
  }, []);

  useEffect(() => {
    if (activeConv?.connectionId && availableConnections.length) {
      const match = availableConnections.find(c => c.id === activeConv.connectionId);
      if (match) setSelectedConnection(match);
    }
  }, [activeConv?.connectionId, availableConnections]);

  useEffect(() => {
    setActiveConvId(null);
    setIsCreatingNewChat(false);
    setCustomSystemPrompt(null);
    setShowDesignStudio(false);
  }, [agentId]);

  const handleNewChat = () => {
    setIsCreatingNewChat(true);
    setActiveConvId(null);
  };

  const handleCreateAndSend = async (text: string) => {
    if (!text.trim() || !agentId || isStreaming) return;
    setInput("");
    setStreamingContent("");
    setOptimisticUserMsg(text.trim());
    setIsStreaming(true);

    try {
      let convId = activeConvId;
      setStreamingConvId(convId || "new");
      if (!convId) {
        const newConv = await createMutation.mutateAsync({ 
          data: { agentId, model: effectiveModel, provider: selectedConnection?.provider, connectionId: selectedConnection?.id || undefined }
        });
        convId = newConv.id;
        setIsCreatingNewChat(false);
        setActiveConvId(convId);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      }

      const response = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim(),
          useKnowledgeBase: true,
          customSystemPrompt: customSystemPrompt || undefined,
          connectionId: selectedConnection?.id || activeConv?.connectionId || undefined,
          stream: true,
        }),
      });

      if (!response.ok) throw new Error("Mensagem falhou");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let fullText = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split("\n\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.type === "start" && data.autoTitle) {
                   queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
                } else if (data.type === "token" && data.text) {
                   fullText += data.text;
                   setStreamingContent(fullText);
                } else if (data.type === "done" && data.assistantMessage?.id) {
                   const msgId = String(data.assistantMessage.id);
                   setMessageMeta(prev => ({
                     ...prev,
                     [msgId]: {
                       ragSources: data.ragSources || [],
                       confidenceLevel: data.confidenceLevel || "none",
                     }
                   }));
                }
              } catch (e) { /* SSE parse error — silently skip malformed chunks */ }
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
    } catch (err) {
      toast({ title: "Erro ao enviar mensagem", description: "Tente novamente.", variant: "destructive" });
      setInput(text);
    } finally {
      setIsStreaming(false);
      setStreamingConvId(null);
      setOptimisticUserMsg(null);
      setStreamingContent("");
      scrollToBottom();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ conversationId: deleteTarget });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      if (activeConvId === deleteTarget) setActiveConvId(null);
      toast({ title: "Conversa excluída" });
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Mensagem copiada",
      duration: 2000,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = async (msgId: string) => {
    if (isStreaming || isRegenerating || !activeConvId) return;
    setIsRegenerating(true);
    try {
      await deleteMsgMutation.mutateAsync({ messageId: Number(msgId) });
      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(activeConvId) });
      const lastUserMsg = activeConv?.messages?.filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        await handleCreateAndSend(lastUserMsg.content);
      }
    } catch (err) {
      toast({ title: "Erro ao regenerar", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSaveSystemPrompt = () => {
    const newPrompt = editingPrompt || null;
    setCustomSystemPrompt(newPrompt);
    if (agentId) {
      try {
        if (newPrompt) localStorage.setItem(`taxgroup_system_prompt_${agentId}`, newPrompt);
        else localStorage.removeItem(`taxgroup_system_prompt_${agentId}`);
      } catch {}
    }
    setShowSystemPrompt(false);
    toast({ title: newPrompt ? "System prompt atualizado" : "System prompt restaurado" });
  };

  const handleSelectConnection = (conn: LlmConnection | null) => {
    setSelectedConnection(conn);
    try { localStorage.setItem("taxgroup_selected_connection", conn ? JSON.stringify(conn) : ""); } catch {}
    if (conn) {
      toast({ title: `Modelo: ${conn.name}` });
    }
  };

  const handleFeedback = async (
    messageId: string,
    convId: string,
    rating: 1 | -1,
    reason?: string
  ) => {
    if (feedbackSent[messageId]) return;
    try {
      await fetch("/api/ai-quality/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: Number(messageId),
          conversationId: Number(convId),
          agentId: agentId || "",
          rating,
          reason,
        }),
      });
      setFeedbackSent(prev => ({ ...prev, [messageId]: rating }));
      toast({ title: rating === 1 ? "Obrigado pelo feedback positivo!" : "Feedback registrado", duration: 2000 });
    } catch {
      toast({ title: "Erro ao registrar feedback", variant: "destructive" });
    }
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
    // Strip complete blocks (with closing tag)
    let cleaned = content.replace(/\n*\[ORCHESTRATION_PLAN\][\s\S]*?\[\/ORCHESTRATION_PLAN\]/g, "");
    // Strip truncated/incomplete blocks (no closing tag — LLM hit token limit)
    cleaned = cleaned.replace(/\n*\[ORCHESTRATION_PLAN\][\s\S]*/g, "");
    return cleaned.trim();
  }

  if (isLoadingAgent) return (
    <div className="flex-1 flex flex-col">
      <div className="h-16 border-b border-border/50 flex items-center px-6 gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10" />
        <div className="space-y-2">
          <div className="w-32 h-4 bg-primary/10 rounded" />
          <div className="w-20 h-3 bg-primary/10 rounded" />
        </div>
      </div>
      <SkeletonChat />
    </div>
  );
  if (!agent) return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
      <Bot className="w-10 h-10 text-muted-foreground/20" />
      <p className="text-sm font-medium text-foreground">Agente não encontrado</p>
      <p className="text-xs text-center max-w-sm">Verifique se o agente está configurado corretamente ou retorne para a lista de agentes.</p>
    </div>
  );

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-background" data-tour="chat">
      {/* Left sidebar — conversation history */}
      <div className="w-72 border-r border-border bg-card/40 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
          <h2 className="font-semibold text-sm text-muted-foreground tracking-wide uppercase">Conversas</h2>
          <button onClick={handleNewChat} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Nova conversa">
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
            <SkeletonChatSidebar />
          ) : filteredConversations?.length === 0 ? (
            <div className="text-center p-6">
              <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchFilter ? "Nenhum resultado" : "Inicie uma conversa com o agente para transformar uma oportunidade em plano de ação."}
              </p>
            </div>
          ) : (
            filteredConversations?.map((conv) => (
              <div
                key={conv.id}
                onClick={() => { if (renamingId !== conv.id) { setIsCreatingNewChat(false); setActiveConvId(conv.id); } }}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start justify-between cursor-pointer ${
                  activeConvId === conv.id
                    ? 'bg-primary/10 border-l-2 border-primary border-y-0 border-r-0 rounded-l-none shadow-[0_0_10px_hsl(var(--primary)/0.08)]'
                    : 'hover:bg-primary/5 border border-transparent'
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
                      {(() => {
                        try {
                          return conv.updatedAt ? format(new Date(conv.updatedAt), "dd 'de' MMM, HH:mm", { locale: ptBR }) : "";
                        } catch { return ""; }
                      })()}
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
                    aria-label="Excluir conversa"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-background">
        <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-xl select-none">
              {agent.icon || <Bot className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <h2 className="font-bold text-foreground">{agent.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{agent.blockLabel}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${
                    isApiOnline
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                  role="status"
                  aria-label={isApiOnline ? "API Online" : "API Offline"}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isApiOnline ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  {isApiOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile history button — only visible on small screens */}
            <button
              onClick={() => setShowMobileHistory(true)}
              className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title="Histórico de conversas"
              aria-label="Abrir histórico de conversas"
            >
              <History className="w-4 h-4" />
            </button>
            {isDesignStudioAgent && (
              <button
                onClick={() => setShowDesignStudio(!showDesignStudio)}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                  showDesignStudio ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'
                }`}
                title="Design Studio"
                aria-label="Abrir Design Studio"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden lg:inline">Design Studio</span>
              </button>
            )}
            {activeConvId && (
              <button
                onClick={handleExport}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                title="Exportar conversa"
                aria-label="Exportar conversa"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => { setEditingPrompt(customSystemPrompt || agent.systemPrompt || ""); setShowSystemPrompt(true); }}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title="Configurações avançadas"
              aria-label="Configurações avançadas"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {!activeConvId && !isLoadingMessages && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mt-12">
                <div className="bg-card border border-border rounded-2xl p-8 max-w-lg w-full text-center mb-6">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
                    {agent.icon ? <span className="text-2xl select-none" role="img" aria-label="Assistente">{agent.icon}</span> : <Bot className="w-7 h-7 text-primary" />}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{agent.name}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{agent.description || "Assistente especializado da Tax Group."}</p>
                  {isDemo && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                      <Lightbulb className="w-3 h-3 text-primary" />
                      <span className="text-[11px] text-primary font-medium">Modo de apresentação ativo</span>
                    </div>
                  )}
                </div>
                {(agent.suggestedPrompts?.length > 0 || isDemo) && (
                  <div className="w-full max-w-2xl">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3 text-center">Sugestões de início</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(isDemo ? DEMO_CHAT_SUGGESTIONS : agent.suggestedPrompts || []).map((prompt: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => handleCreateAndSend(prompt)}
                          className="p-4 rounded-xl border border-border bg-card hover:bg-muted hover:border-primary/30 text-left text-sm text-foreground/80 hover:text-foreground transition-colors"
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
                  <div className={`max-w-[92%] md:max-w-[85%] flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 text-base select-none ${msg.role === 'user' ? 'bg-secondary' : 'bg-primary/15 border border-primary/20'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 text-foreground/70" /> : agent.icon ? <span role="img" aria-label="Assistente">{agent.icon}</span> : <Bot className="w-4 h-4 text-primary" />}
                    </div>
                    <div className={`relative group p-4 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm shadow-md' : 'bg-card text-foreground rounded-bl-sm shadow-sm border border-border'}`}>
                      {msg.role === 'assistant' && (
                        <button onClick={() => handleCopy(msg.content, msg.id)} className="absolute right-2 top-2 md:-right-10 md:top-2 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" title="Copiar" aria-label="Copiar mensagem">
                          {copiedId === msg.id ? <CheckCheck className="w-4 h-4 text-primary" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                        </button>
                      )}
                      {msg.role === 'assistant' && msg.id === activeConv?.messages?.[activeConv.messages.length - 1]?.id && (
                        <button
                          onClick={() => handleRegenerate(msg.id)}
                          className="absolute right-2 top-10 md:-right-10 md:top-10 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          disabled={isStreaming}
                          title="Regenerar"
                        >
                          <RotateCw className={`w-4 h-4 ${isStreaming ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <div className={`text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none ${msg.role === 'user' ? 'prose-p:text-white prose-strong:text-white' : ''}`}>
                        <ReactMarkdown>{msg.role === 'assistant' ? stripOrchestrationBlock(msg.content) : msg.content}</ReactMarkdown>
                      </div>
                      <div className={`text-xs mt-2 text-right ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {(() => {
                          try {
                            return msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : "";
                          } catch { return ""; }
                        })()}
                      </div>
                      {msg.role === 'assistant' && agentId === 'coordenador-geral-tax-group' && (() => {
                        const plan = parseOrchestrationPlan(msg.content);
                        if (!plan) return null;
                        return (
                          <button
                            onClick={() => { setOrchestrationPlan(plan); setShowOrchestrateModal(true); }}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                          >
                            <Rocket className="w-4 h-4" /> Executar Plano com Agentes ({plan.length} agente{plan.length !== 1 ? 's' : ''})
                          </button>
                        );
                      })()}
                      {/* Quality layer: confidence + sources + feedback */}
                      {msg.role === 'assistant' && (() => {
                        const meta = messageMeta[msg.id] || (() => {
                          const raw = (msg as any).metadata;
                          if (raw && raw.confidenceLevel) return raw;
                          return null;
                        })();
                        if (!meta) return null;
                        const { confidenceLevel, ragSources } = meta;
                        const confColors: Record<string, string> = {
                          high: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                          medium: "text-amber-400 border-amber-500/30 bg-amber-500/10",
                          low: "text-orange-400 border-orange-500/30 bg-orange-500/10",
                          none: "text-muted-foreground border-border bg-muted/30",
                        };
                        const confLabel: Record<string, string> = {
                          high: "Alta confiança", medium: "Confiança média",
                          low: "Baixa confiança", none: "Sem contexto RAG",
                        };
                        const isOpen = expandedSources[msg.id];
                        return (
                          <div className="mt-3 border-t border-border/50 pt-2 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${confColors[confidenceLevel] || confColors.none}`}>
                                  {confidenceLevel === "none" ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                  {confLabel[confidenceLevel] || confidenceLevel}
                                </span>
                                {ragSources?.length > 0 && (
                                  <button
                                    onClick={() => setExpandedSources(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    {ragSources.length} fonte{ragSources.length !== 1 ? 's' : ''}
                                    {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                              {/* Feedback buttons */}
                              <div className="flex items-center gap-1">
                                {feedbackSent[msg.id] ? (
                                  <span className="text-[10px] text-muted-foreground">{feedbackSent[msg.id] === 1 ? "👍 Obrigado!" : "👎 Registrado"}</span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleFeedback(msg.id, String(msg.conversationId), 1)}
                                      className="p-1 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                      title="Resposta útil"
                                    >
                                      <ThumbsUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleFeedback(msg.id, String(msg.conversationId), -1, "poor_quality")}
                                      className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                      title="Resposta problemática"
                                    >
                                      <ThumbsDown className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {isOpen && ragSources?.length > 0 && (
                              <div className="space-y-1">
                                {ragSources.map((src: { filename: string; score: number }, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-[10px] bg-muted/40 rounded px-2 py-1 gap-2">
                                    <span className="flex items-center gap-1.5 text-foreground/70 truncate">
                                      <FileText className="w-3 h-3 flex-shrink-0 text-primary/60" />
                                      <span className="truncate">{src.filename}</span>
                                    </span>
                                    <span className={`flex-shrink-0 font-medium ${src.score >= 0.75 ? 'text-emerald-400' : src.score >= 0.5 ? 'text-amber-400' : 'text-orange-400'}`}>
                                      {Math.round(src.score * 100)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}

              {optimisticUserMsg && (
                <motion.div key="optimistic-user" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                  <div className="max-w-[92%] md:max-w-[85%] flex flex-row-reverse items-end gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 text-base select-none bg-secondary">
                      <User className="w-4 h-4 text-foreground/70" />
                    </div>
                    <div className="relative p-4 rounded-2xl bg-primary text-white rounded-br-sm shadow-md opacity-80">
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:text-white prose-strong:text-white">
                        <ReactMarkdown>{optimisticUserMsg}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {isStreaming && (
                <motion.div key="optimistic-bot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="max-w-[92%] md:max-w-[85%] flex flex-row items-end gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 text-base select-none bg-primary/15 border border-primary/20">
                      {agent.icon ? <span role="img" aria-label="Assistente">{agent.icon}</span> : <Bot className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="relative p-4 rounded-2xl bg-card/30 text-foreground rounded-bl-sm shadow-sm">
                      {streamingContent ? (
                        <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{stripOrchestrationBlock(streamingContent)}</ReactMarkdown>
                          <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex space-x-2 items-center h-4">
                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-xs text-muted-foreground animate-pulse font-medium">Pensando...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 bg-background border-t border-border">
          <div className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateAndSend(input); } }}
              placeholder={agent?.name ? `Envie uma mensagem para ${agent.name}...` : "Digite sua mensagem..."}
              className="w-full bg-card border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl pl-5 pr-14 py-4 text-sm shadow-sm transition-all outline-none"
              disabled={isStreaming}
            />
            <button
              onClick={() => handleCreateAndSend(input)}
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 p-2.5 rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              aria-label="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-2">
            <Cpu className="w-3 h-3" /> {displayModel}
            {customSystemPrompt && <span className="text-primary">• Instrução customizada</span>}
          </div>
        </div>
      </div>

      {/* Right context panel — only on large screens */}
      <div className="w-64 border-l border-border bg-card/40 flex-col hidden xl:flex">
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contexto do Agente</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Objetivo</div>
            <p className="text-xs text-foreground leading-relaxed">{agent.description || "Assistente especializado da Tax Group."}</p>
          </div>
          {activeConv && (
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Modelo em uso</div>
              <div className="text-xs text-foreground font-medium">{displayModel}</div>
              <div className="text-[11px] text-muted-foreground">{provider}</div>
            </div>
          )}
          <div>
            <div className="text-[11px] text-muted-foreground mb-2">Ações rápidas</div>
            <div className="space-y-1.5">
              <button
                onClick={() => handleCreateAndSend("Gere um resumo executivo das oportunidades tributárias identificadas.")}
                className="w-full text-left px-3 py-2 rounded-lg text-xs bg-background border border-border hover:border-primary/30 hover:bg-muted transition-colors flex items-center gap-2"
              >
                <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" /> Resumo executivo
              </button>
              <button
                onClick={() => handleCreateAndSend("Baseado nesta conversa, gere uma proposta comercial estruturada.")}
                className="w-full text-left px-3 py-2 rounded-lg text-xs bg-background border border-border hover:border-primary/30 hover:bg-muted transition-colors flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Gerar proposta
              </button>
              <button
                onClick={() => handleCreateAndSend("Crie uma tarefa de follow-up com os próximos passos.")}
                className="w-full text-left px-3 py-2 rounded-lg text-xs bg-background border border-border hover:border-primary/30 hover:bg-muted transition-colors flex items-center gap-2"
              >
                <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" /> Criar tarefa
              </button>
              <Link href="/crm" className="block w-full text-left px-3 py-2 rounded-lg text-xs bg-background border border-border hover:border-primary/30 hover:bg-muted transition-colors flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Adicionar nota no CRM
              </Link>
            </div>
          </div>
          <div className="pt-3 border-t border-border">
            <div className="text-[11px] text-muted-foreground mb-1">Configuração avançada</div>
            <ModelSelector
              value={selectedConnection?.id || null}
              onChange={handleSelectConnection}
              placeholder="Modelo padrão"
            />
            {customSystemPrompt && (
              <div className="mt-2 text-[11px] text-primary flex items-center gap-1"><Settings className="w-3 h-3" /> Instrução customizada ativa</div>
            )}
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
                className="text-primary hover:text-primary/80 underline"
              >
                Restaurar original
              </button>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowSystemPrompt(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button onClick={handleSaveSystemPrompt} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mobile conversation history drawer ── */}
      <AnimatePresence>
        {showMobileHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileHistory(false)}
              className="md:hidden fixed inset-0 bg-black/60 z-40"
            />
            {/* Bottom sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 rounded-t-2xl"
              style={{ maxHeight: "75vh" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <h3 className="font-semibold text-sm">Histórico de Conversas</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handleNewChat} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowMobileHistory(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="px-3 pt-2 pb-1">
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
              <div className="overflow-y-auto px-3 pb-6 space-y-1.5" style={{ maxHeight: "calc(75vh - 8rem)" }}>
                {filteredConversations?.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => { setActiveConvId(conv.id); setShowMobileHistory(false); }}
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 ${
                      activeConvId === conv.id
                        ? "bg-primary/10 border-l-2 border-primary rounded-l-none"
                        : "hover:bg-muted"
                    }`}
                  >
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${activeConvId === conv.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm truncate">{conv.title || "Nova Conversa"}</span>
                  </div>
                ))}
                {!filteredConversations?.length && (
                  <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma conversa ainda</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
