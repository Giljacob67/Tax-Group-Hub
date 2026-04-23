import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Clock, AlertCircle, Calendar, Loader2,
  PhoneCall, AtSign, MessageSquare, StickyNote, FileText,
  RefreshCw, ChevronRight, User2, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// ─── Types ──────────────────────────────────────────────────────────────────
type Task = {
  id: number;
  contactId: number | null;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TASK_ICONS: Record<string, any> = {
  call:     PhoneCall,
  email:    AtSign,
  whatsapp: MessageSquare,
  meeting:  Calendar,
  proposal: FileText,
  note:     StickyNote,
};

const PRIORITY_DOT: Record<string, string> = {
  low:    "bg-slate-400",
  medium: "bg-blue-400",
  high:   "bg-amber-400",
  urgent: "bg-red-500 animate-pulse",
};

function isOverdue(task: Task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
}

function isToday(task: Task) {
  if (!task.dueDate) return false;
  const d = new Date(task.dueDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isTomorrow(task: Task) {
  if (!task.dueDate) return false;
  const d = new Date(task.dueDate);
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  return d.getFullYear() === tmr.getFullYear() &&
    d.getMonth() === tmr.getMonth() &&
    d.getDate() === tmr.getDate();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─── Task Row ───────────────────────────────────────────────────────────────
function TodayTaskRow({ task, onDone }: { task: Task; onDone: (id: number) => void }) {
  const Icon = TASK_ICONS[task.type] || StickyNote;
  const overdue = isOverdue(task);
  const done = task.status === "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: done ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex items-center gap-3 px-4 py-3 border-b border-border/30 group hover:bg-muted/20 transition-colors ${
        overdue ? "bg-red-500/5" : ""
      }`}
    >
      {/* Complete button */}
      <button
        onClick={() => onDone(task.id)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          done
            ? "bg-emerald-500 border-emerald-500"
            : overdue
            ? "border-red-400 hover:border-red-300"
            : "border-muted-foreground/40 hover:border-primary"
        }`}
      >
        {done && <CheckCheck className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Icon */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
        overdue ? "bg-red-500/10" : done ? "bg-muted" : "bg-primary/10"
      }`}>
        <Icon className={`w-3.5 h-3.5 ${overdue ? "text-red-400" : done ? "text-muted-foreground" : "text-primary"}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : overdue ? "text-red-300" : "text-foreground"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{task.description}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`} />
        {task.dueDate && (
          <span className={`text-[11px] font-mono ${overdue ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>
            {isToday(task) ? formatTime(task.dueDate) : formatDate(task.dueDate)}
          </span>
        )}
        {task.contactId && (
          <User2 className="w-3 h-3 text-muted-foreground/50" />
        )}
      </div>
    </motion.div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 border-b border-border/30 ${color} bg-current/5`}>
      <span className={`text-xs font-bold uppercase tracking-wider`}>{label}</span>
      <span className="text-xs font-mono bg-current/10 rounded-full px-2 py-0.5">{count}</span>
    </div>
  );
}

// ─── Main TodayView ─────────────────────────────────────────────────────────
export default function TodayView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDone, setShowDone] = useState(false);

  // Fetch all pending tasks (and upcoming)
  const { data: pendingData, isLoading: loadingPending, refetch } = useQuery<{ tasks: Task[] }>({
    queryKey: ["/api/crm/tasks?status=pending"],
    queryFn: async () => {
      const r = await fetch("/api/crm/tasks?status=pending");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: doneData, isLoading: loadingDone } = useQuery<{ tasks: Task[] }>({
    queryKey: ["/api/crm/tasks?status=done&today=true"],
    queryFn: async () => {
      const r = await fetch("/api/crm/tasks?status=done");
      return r.json();
    },
    enabled: showDone,
  });

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done", completedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks?status=pending"] });
      toast({ title: "✅ Tarefa concluída!" });
    },
    onError: () => toast({ title: "Erro ao concluir tarefa", variant: "destructive" }),
  });

  const allTasks = pendingData?.tasks || [];
  const overdueTasks   = allTasks.filter(t => isOverdue(t));
  const todayTasks     = allTasks.filter(t => isToday(t) && !isOverdue(t));
  const tomorrowTasks  = allTasks.filter(t => isTomorrow(t));
  const upcomingTasks  = allTasks.filter(t => t.dueDate && !isOverdue(t) && !isToday(t) && !isTomorrow(t));
  const nodateTasks    = allTasks.filter(t => !t.dueDate);

  const totalActionable = overdueTasks.length + todayTasks.length;
  const doneTodayTasks  = (doneData?.tasks || []).filter(t => isToday(t));

  if (loadingPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-border/50 bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalActionable === 0
                ? "🎉 Nenhuma tarefa urgente — tudo em dia!"
                : `${totalActionable} tarefa${totalActionable !== 1 ? "s" : ""} para hoje${overdueTasks.length > 0 ? ` · ${overdueTasks.length} atrasada${overdueTasks.length !== 1 ? "s" : ""}` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {overdueTasks.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 bg-red-500/5">
              <AlertCircle className="w-2.5 h-2.5 mr-1" />
              {overdueTasks.length} atrasada{overdueTasks.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {todayTasks.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 bg-amber-500/5">
              <Calendar className="w-2.5 h-2.5 mr-1" />
              {todayTasks.length} para hoje
            </Badge>
          )}
          {tomorrowTasks.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-400 bg-blue-500/5">
              <Clock className="w-2.5 h-2.5 mr-1" />
              {tomorrowTasks.length} amanhã
            </Badge>
          )}
          {nodateTasks.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
              {nodateTasks.length} sem data
            </Badge>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {allTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 text-emerald-400/30" />
            <p className="text-sm font-medium">Nenhuma tarefa pendente!</p>
            <p className="text-xs">Crie tarefas no painel do contato ou no Pipeline.</p>
          </div>
        ) : (
          <AnimatePresence>
            {/* OVERDUE */}
            {overdueTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-red-500/20 bg-red-500/5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">Atrasadas</span>
                  <span className="text-xs font-mono bg-red-500/10 text-red-400 rounded-full px-2 py-0.5">{overdueTasks.length}</span>
                </div>
                {overdueTasks.map(t => (
                  <TodayTaskRow key={t.id} task={t} onDone={id => completeMutation.mutate(id)} />
                ))}
              </div>
            )}

            {/* TODAY */}
            {todayTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/20 bg-amber-500/5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Hoje</span>
                  <span className="text-xs font-mono bg-amber-500/10 text-amber-400 rounded-full px-2 py-0.5">{todayTasks.length}</span>
                </div>
                {todayTasks.map(t => (
                  <TodayTaskRow key={t.id} task={t} onDone={id => completeMutation.mutate(id)} />
                ))}
              </div>
            )}

            {/* TOMORROW */}
            {tomorrowTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-blue-500/20 bg-blue-500/5">
                  <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Amanhã</span>
                  <span className="text-xs font-mono bg-blue-500/10 text-blue-400 rounded-full px-2 py-0.5">{tomorrowTasks.length}</span>
                </div>
                {tomorrowTasks.map(t => (
                  <TodayTaskRow key={t.id} task={t} onDone={id => completeMutation.mutate(id)} />
                ))}
              </div>
            )}

            {/* UPCOMING */}
            {upcomingTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/10">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próximas</span>
                  <span className="text-xs font-mono bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{upcomingTasks.length}</span>
                </div>
                {upcomingTasks.map(t => (
                  <TodayTaskRow key={t.id} task={t} onDone={id => completeMutation.mutate(id)} />
                ))}
              </div>
            )}

            {/* NO DATE */}
            {nodateTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/5">
                  <StickyNote className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">Sem data</span>
                  <span className="text-xs font-mono bg-muted/50 rounded-full px-2 py-0.5 text-muted-foreground/50">{nodateTasks.length}</span>
                </div>
                {nodateTasks.map(t => (
                  <TodayTaskRow key={t.id} task={t} onDone={id => completeMutation.mutate(id)} />
                ))}
              </div>
            )}
          </AnimatePresence>
        )}

        {/* Completed today section */}
        <div className="px-4 py-3 border-t border-border/30">
          <button
            onClick={() => setShowDone(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" />
            {showDone ? "Ocultar" : "Ver"} tarefas concluídas hoje
            {doneTodayTasks.length > 0 && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 rounded-full px-1.5 py-0.5 font-bold">
                {doneTodayTasks.length}
              </span>
            )}
          </button>
          {showDone && loadingDone && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-2" />}
          {showDone && !loadingDone && doneTodayTasks.map(t => (
            <TodayTaskRow key={t.id} task={t} onDone={id => completeMutation.mutate(id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
