import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import {
  Send, Bot, User, Plus, MessageSquare, Loader2,
  Copy, CheckCheck, Trash2, Search, Download,
  Settings, Sparkles, Pencil, Check, X, Cpu
} from "lucide-react";
import {
  useGetAgent,
  useListConversations,
  useCreateConversation,
  useGetConversation,
  useSendMessage,
  useDeleteConversation
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListConversationsQueryKey, getGetConversationQueryKey } from "@workspace/api-client-react";
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

const MARKETING_AGENTS = [
  "conteudo-linkedin-tax-group",
  "email-marketing-tax-group",
  "materiais-comerciais-tax-group",
  "reformatributaria-insight",
];

export default function AgentChat() {
  const { id: agentId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const { data: agent, isLoading: isLoadingAgent } = useGetAgent(agentId!);
  const { data: conversations, isLoading: isLoadingConvs } = useListConversations({ agentId });
  const { data: activeConv, isLoading: isLoadingMessages } = useGetConversation(activeConvId!, {
    query: { enabled: !!activeConvId }
  });

  const createMutation = useCreateConversation();
  const sendMutation = useSendMessage();
  const deleteMutation = useDeleteConversation();

  const isMarketingAgent = MARKETING_AGENTS.includes(agentId || "");
  const model = (activeConv as any)?.model || "google/gemini-flash-1.5";
  const provider = (activeConv as any)?.provider || "OpenRouter";

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
          ...(customSystemPrompt ? { customSystemPrompt } : {}),
        } as any
      });
      if ((res as any).autoTitle) {
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
      const res = await fetch(`/api/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      if (!res.ok) throw new Error("Rename failed");
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
    setCustomSystemPrompt(editingPrompt || null);
    setShowSystemPrompt(false);
    toast({ title: customSystemPrompt ? "System prompt atualizado" : "System prompt restaurado" });
  };

  const filteredConversations = conversations?.conversations?.filter(
    c => !searchFilter || c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

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
                    ? 'bg-primary/10 border border-primary/20 shadow-[0_0_10px_rgba(30,64,175,0.1)]'
                    : 'hover:bg-card border border-transparent'
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
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-glow">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">{agent.name}</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{agent.blockLabel}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" /> {model}
                </span>
                <span className="text-[10px] text-muted-foreground">via {provider}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMarketingAgent && (
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

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {!activeConvId && !isLoadingMessages && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-20">
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Iniciar conversa</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">{agent.description}</p>
                {agent.suggestedPrompts?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                    {agent.suggestedPrompts.map((prompt: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleCreateAndSend(prompt)}
                        className="p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-primary/5 hover:border-primary/30 text-left text-sm transition-all hover:-translate-y-0.5"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence>
              {activeConv?.messages?.map((msg: any) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 ${msg.role === 'user' ? 'bg-secondary' : 'bg-primary/20 border border-primary/30'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 text-foreground/70" /> : <Bot className="w-4 h-4 text-primary" />}
                    </div>
                    <div className={`relative group p-4 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm shadow-md' : 'bg-card border border-border/50 text-foreground rounded-bl-sm shadow-sm'}`}>
                      {msg.role === 'assistant' && (
                        <button onClick={() => handleCopy(msg.content, msg.id)} className="absolute -right-10 top-2 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" title="Copiar">
                          {copiedId === msg.id ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                      <div className={`text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none ${msg.role === 'user' ? 'prose-p:text-white prose-strong:text-white' : ''}`}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      <div className={`text-[10px] mt-2 text-right ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {sendMutation.isPending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mb-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm p-4 flex space-x-2 items-center h-12">
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
              className="w-full bg-card border border-border focus:border-primary focus:ring-1 focus:ring-primary/50 rounded-xl pl-5 pr-14 py-4 text-sm shadow-sm transition-all outline-none"
              disabled={sendMutation.isPending}
            />
            <button
              onClick={() => handleCreateAndSend(input)}
              disabled={!input.trim() || sendMutation.isPending}
              className="absolute right-2 p-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-2">
            <Cpu className="w-3 h-3" /> {model} via {provider}
            {customSystemPrompt && <span className="text-amber-400">• Prompt customizado</span>}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDesignStudio && isMarketingAgent && (
          <DesignStudioPanel
            agentId={agentId!}
            agentName={agent.name}
            onClose={() => setShowDesignStudio(false)}
          />
        )}
      </AnimatePresence>

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
