import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { 
  Send, Bot, User, Plus, MessageSquare, Loader2, 
  ChevronLeft, Copy, CheckCheck, Trash2
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

export default function AgentChat() {
  const { id: agentId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries
  const { data: agent, isLoading: isLoadingAgent } = useGetAgent(agentId!);
  const { data: conversations, isLoading: isLoadingConvs } = useListConversations({ agentId });
  const { data: activeConv, isLoading: isLoadingMessages } = useGetConversation(activeConvId!, {
    query: { enabled: !!activeConvId }
  });

  // Mutations
  const createMutation = useCreateConversation();
  const sendMutation = useSendMessage();
  const deleteMutation = useDeleteConversation();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, sendMutation.isPending]);

  // Set active conversation if we have ones but none is selected
  useEffect(() => {
    if (!activeConvId && conversations?.conversations?.length) {
      setActiveConvId(conversations.conversations[0].id);
    }
  }, [conversations, activeConvId]);

  const handleNewChat = () => {
    setActiveConvId(null);
  };

  const handleCreateAndSend = async (text: string) => {
    if (!text.trim() || !agentId) return;
    
    setInput("");
    try {
      let convId = activeConvId;
      
      // Create conversation if none active
      if (!convId) {
        const title = text.length > 30 ? text.substring(0, 30) + "..." : text;
        const newConv = await createMutation.mutateAsync({ data: { agentId, title } });
        convId = newConv.id;
        setActiveConvId(convId);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      }

      // Send message
      await sendMutation.mutateAsync({ 
        conversationId: convId, 
        data: { content: text, useKnowledgeBase: true } 
      });
      
      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
    } catch (err) {
      toast({
        title: "Error sending message",
        description: "There was a problem communicating with the AI. Please try again.",
        variant: "destructive"
      });
      setInput(text); // Restore input on failure
    }
  };

  const handleDelete = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync({ conversationId: convId });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ agentId }) });
      if (activeConvId === convId) setActiveConvId(null);
      toast({ title: "Conversation deleted" });
    } catch (err) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoadingAgent) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!agent) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Agent not found</div>;

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-background">
      {/* Conversations Sidebar */}
      <div className="w-72 border-r border-border/50 bg-card/30 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/50 backdrop-blur-sm">
          <h2 className="font-semibold text-sm text-muted-foreground tracking-wide uppercase">History</h2>
          <button 
            onClick={handleNewChat}
            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoadingConvs ? (
            <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : conversations?.conversations?.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground">No conversations yet</div>
          ) : (
            conversations?.conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start justify-between ${
                  activeConvId === conv.id 
                    ? 'bg-primary/10 border border-primary/20 shadow-[0_0_10px_rgba(30,64,175,0.1)]' 
                    : 'hover:bg-card border border-transparent'
                }`}
              >
                <div className="flex items-start space-x-3 overflow-hidden">
                  <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeConvId === conv.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex flex-col truncate">
                    <span className={`text-sm font-medium truncate ${activeConvId === conv.id ? 'text-foreground' : 'text-foreground/80'}`}>
                      {conv.title || "New Conversation"}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {format(new Date(conv.updatedAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
                <div 
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center px-6 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-glow">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">{agent.name}</h2>
              <p className="text-xs text-muted-foreground">{agent.blockLabel}</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            
            {!activeConvId && !isLoadingMessages && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="text-center mt-20"
              >
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Start a conversation</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">{agent.description}</p>
                
                {agent.suggestedPrompts?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                    {agent.suggestedPrompts.map((prompt, i) => (
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
              {activeConv?.messages?.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                    
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 ${
                      msg.role === 'user' ? 'bg-secondary' : 'bg-primary/20 border border-primary/30'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 text-foreground/70" /> : <Bot className="w-4 h-4 text-primary" />}
                    </div>

                    <div className={`relative group p-4 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-br-sm shadow-md' 
                        : 'bg-card border border-border/50 text-foreground rounded-bl-sm shadow-sm'
                    }`}>
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="absolute -right-10 top-2 p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy message"
                        >
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

        {/* Input Area */}
        <div className="p-4 bg-background border-t border-border/50">
          <div className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateAndSend(input);
                }
              }}
              placeholder={`Message ${agent.name}...`}
              className="w-full bg-card border border-border focus:border-primary focus:ring-1 focus:ring-primary/50 rounded-xl pl-5 pr-14 py-4 text-sm shadow-sm transition-all outline-none"
              disabled={sendMutation.isPending}
            />
            <button
              onClick={() => handleCreateAndSend(input)}
              disabled={!input.trim() || sendMutation.isPending}
              className="absolute right-2 p-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2 text-[11px] text-muted-foreground">
            Tax Group AI Hub uses advanced language models. Verify important tax information.
          </div>
        </div>
      </div>
    </div>
  );
}
