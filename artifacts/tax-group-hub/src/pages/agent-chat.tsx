import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import {
  Send, Bot, User, Plus, MessageSquare, Loader2,
  Copy, CheckCheck, Trash2, Search, Download,
  Settings, Sparkles, Pencil, Check, X, Cpu,
  RotateCw, History, MessageCircle
} from "lucide-react";
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
  const [selectedConnection, setSelectedConnection] = useState<LlmConnection | null>(() => {
    try {
      const raw = localStorage.getItem("taxgroup_selected_connection");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [orchestrationPlan, setOrchestrationPlan] = useState<Array<{agentId: string; task: string}> | null>(null);
  const [showOrchestrateModal, setShowOrchestrateModal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [optimisticUserMsg, setOptimisticUserMsg] = useState<string | null>(null);
  const [showMobileHistory, setShowMobileHistory] = useState(false);

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
    if (!text.trim() || !agentId || isStreaming) return;
    setInput("");
    setStreamingContent("");
    setOptimisticUserMsg(text.trim());
    setIsStreaming(true);

    try {
      let convId = activeConvId;
      if (!convId) {
        const newConv = await createMutation.mutateAsync({ 
          data: { agentId, model: effectiveModel, provider: selectedConnection?.provider, connectionId: selectedConnection?.id || undefined } 
        });
        convId = newConv.id;
        setActiveConvId(convId);
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
          const lines = chunkStr.split("\\n\\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.type === "start" && data.autoTitle) {
                   queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
                } else if (data.type === "token" && data.text) {
                   fullText += data.text;
                   setStreamingContent(fullText);
                }
              } catch (e) { console.warn("[Chat] malformed SSE chunk:", e); }
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
    } catch (err) {
      console.error("[Chat] send failed:", err);
      toast({ title: "Erro ao enviar mensagem", description: "Tente novamente.", variant: "destructive" });
      setInput(text);
    } finally {
      setIsStreaming(false);
      setOptimisticUserMsg(null);
      setStreamingContent("");
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
      console.error("[Chat] delete failed:", err);
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
      console.error("[Chat] rename failed:", err);
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
      console.error("[Chat] export failed:", err);
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
    if (isStreaming || !activeConvId) return;
    try {
      await deleteMsgMutation.mutateAsync({ messageId: Number(msgId) });
      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(activeConvId) });
      // Find the last user message to replay
      const lastUserMsg = activeConv?.messages?.filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        handleCreateAndSend(lastUserMsg.content);
      }
    } catch (err) {
      console.error("[Chat] regenerate failed:", err);
      toast({ title: "Erro ao regenerar", variant: "destructive" });
    }
  };

  const handleSaveSystemPrompt = () => {
    const newPrompt = editingPrompt || null;
    setCustomSystemPrompt(newPrompt);
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
            <SkeletonChatSidebar />
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

      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25 shadow-glow text-xl select-none">
              {agent.icon || <Bot className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <h2 className="font-bold text-foreground">{agent.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{agent.blockLabel}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${
                    isApiOnline
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                  role="status"
                  aria-label={isApiOnline ? "API Online" : "API Offline"}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isApiOnline ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                  {isApiOnline ? 'Online' : 'Offline'}
                </span>
                <div className="w-40">
                  <ModelSelector
                    value={selectedConnection?.id || null}
                    onChange={handleSelectConnection}
                    placeholder="Modelo padrão"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile history button — only visible on small screens */}
            <button
              onClick={() => setShowMobileHistory(true)}
              className="md:hidden p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors"
              title="Histórico de conversas"
              aria-label="Abrir histórico de conversas"
            >
              <History className="w-4 h-4" />
            </button>
            {isDesignStudioAgent && (
              <button
                onClick={() => setShowDesignStudio(!showDesignStudio)}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                  showDesignStudio ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/5 text-muted-foreground'
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
                className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors"
                title="Exportar conversa (.md)"
                aria-label="Exportar conversa"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => { setEditingPrompt(customSystemPrompt || agent.systemPrompt || ""); setShowSystemPrompt(true); }}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors"
              title="Editar System Prompt"
              aria-label="Editar system prompt"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

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
                          className="p-4 rounded-2xl border border-border/50 bg-card/40 hover:bg-primary/8 hover:border-primary/40 text-left text-sm text-foreground/80 hover:text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_hsl(var(--primary)/0.1)]"
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 text-base select-none ${msg.role === 'user' ? 'bg-secondary' : 'bg-primary/15 border border-primary/20'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 text-foreground/70" /> : <span>{agent.icon || "🤖"}</span>}
                    </div>
                    <div className={`relative group p-4 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm shadow-md' : 'bg-card/30 text-foreground rounded-bl-sm shadow-sm'}`}>
                      {msg.role === 'assistant' && (
                        <button onClick={() => handleCopy(msg.content, msg.id)} className="absolute -right-10 top-2 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" title="Copiar" aria-label="Copiar mensagem">
                          {copiedId === msg.id ? <CheckCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                        </button>
                      )}
                      {msg.role === 'assistant' && msg.id === activeConv?.messages?.[activeConv.messages.length - 1]?.id && (
                        <button 
                          onClick={() => handleRegenerate(msg.id)} 
                          className="absolute -right-10 top-10 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" 
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
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </div>
                      {msg.role === 'assistant' && agentId === 'coordenador-geral-tax-group' && (() => {
                        const plan = parseOrchestrationPlan(msg.content);
                        if (!plan) return null;
                        return (
                          <button
                            onClick={() => { setOrchestrationPlan(plan); setShowOrchestrateModal(true); }}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-primary to-blue-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg"
                          >
                            🚀 Executar Plano com Agentes ({plan.length} agente{plan.length !== 1 ? 's' : ''})
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}

              {optimisticUserMsg && (
                <motion.div key="optimistic-user" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                  <div className="max-w-[85%] flex flex-row-reverse items-end gap-3">
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
                  <div className="max-w-[85%] flex flex-row items-end gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 text-base select-none bg-primary/15 border border-primary/20">
                      <span>{agent.icon || "🤖"}</span>
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

        <div className="p-4 bg-background border-t border-border/50">
          <div className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateAndSend(input); } }}
              placeholder={`Mensagem para ${agent.name}...`}
              className="w-full bg-card border border-primary/30 focus:border-primary focus:shadow-[0_0_0_2px_hsl(var(--primary)/0.2)] rounded-xl pl-5 pr-14 py-4 text-sm shadow-sm transition-all outline-none"
              disabled={isStreaming}
            />
            <button
              onClick={() => handleCreateAndSend(input)}
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 p-2.5 rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-md"
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
                        : "hover:bg-muted/30"
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
