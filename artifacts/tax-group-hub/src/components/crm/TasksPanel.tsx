import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Loader2, Check, Trash2, Bell, BellOff,
  PhoneCall, AtSign, MessageSquare, Calendar, StickyNote,
  FileText, AlertCircle, Clock, ChevronDown, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type Task = {
  id: number;
  userId: string;
  contactId: number | null;
  dealId: number | null;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: string | null;
  reminderAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────
const TASK_TYPES = [
  { value: "call",     label: "Ligação",   icon: PhoneCall },
  { value: "email",    label: "E-mail",    icon: AtSign },
  { value: "whatsapp", label: "WhatsApp",  icon: MessageSquare },
  { value: "meeting",  label: "Reunião",   icon: Calendar },
  { value: "proposal", label: "Proposta",  icon: FileText },
  { value: "note",     label: "Nota",      icon: StickyNote },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low:    { label: "Baixa",   color: "text-slate-400",   dot: "bg-slate-400" },
  medium: { label: "Média",   color: "text-blue-400",    dot: "bg-blue-400" },
  high:   { label: "Alta",    color: "text-amber-400",   dot: "bg-amber-400" },
  urgent: { label: "Urgente", color: "text-red-400",     dot: "bg-red-500 animate-pulse" },
};

// ─── Push Notification helper ──────────────────────────────────────────────────
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function scheduleNotification(title: string, body: string, at: Date) {
  const delay = at.getTime() - Date.now();
  if (delay <= 0) return;
  setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(`📋 ${title}`, { body, icon: "/favicon.ico" });
    }
  }, Math.min(delay, 2_147_483_647)); // max 32-bit int timeout
}

// ─── Task Form ─────────────────────────────────────────────────────────────────
function TaskForm({
  contactId, onDone,
}: {
  contactId?: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle]         = useState("");
  const [type, setType]           = useState("call");
  const [priority, setPriority]   = useState("medium");
  const [dueDate, setDueDate]     = useState("");
  const [dueTime, setDueTime]     = useState("");
  const [reminder, setReminder]   = useState(false);
  const [description, setDesc]    = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const dueDateISO = dueDate
        ? new Date(`${dueDate}T${dueTime || "09:00"}:00`).toISOString()
        : null;
      const reminderAt = reminder && dueDateISO
        ? new Date(new Date(dueDateISO).getTime() - 30 * 60 * 1000).toISOString()
        : null;

      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, type, priority, description: description || null,
          dueDate: dueDateISO, reminderAt,
          contactId: contactId || null, status: "pending",
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar task");
      return res.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({ title: "✅ Tarefa criada!" });

      // Schedule push notification if reminder set
      if (data.task?.reminderAt) {
        const granted = await requestNotificationPermission();
        if (granted) {
          scheduleNotification(
            data.task.title,
            `Lembrete: ${data.task.type} — ${new Date(data.task.dueDate).toLocaleString("pt-BR")}`,
            new Date(data.task.reminderAt)
          );
          toast({ title: "🔔 Lembrete agendado para 30 min antes." });
        }
      }

      onDone();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="border border-border/60 rounded-xl p-3.5 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Nova Tarefa</span>
        <button onClick={onDone} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Input
        placeholder="Título da tarefa..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="text-xs h-8"
        autoFocus
      />

      {/* Type chips */}
      <div className="flex gap-1 flex-wrap">
        {TASK_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors ${
              type === t.value
                ? "bg-primary/20 border-primary/40 text-primary"
                : "border-border/50 text-muted-foreground hover:border-border"
            }`}
          >
            <t.icon className="w-2.5 h-2.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Priority */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Prioridade</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                    <span className={v.color}>{v.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due Date */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Data</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      </div>

      {/* Time + Reminder */}
      {dueDate && (
        <div className="flex gap-2 items-center">
          <Input
            type="time"
            value={dueTime}
            onChange={e => setDueTime(e.target.value)}
            className="h-7 text-xs w-28"
          />
          <button
            onClick={() => setReminder(r => !r)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors ${
              reminder
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "border-border/50 text-muted-foreground hover:border-border"
            }`}
          >
            {reminder ? <Bell className="w-2.5 h-2.5" /> : <BellOff className="w-2.5 h-2.5" />}
            Lembrete 30min antes
          </button>
        </div>
      )}

      <Textarea
        placeholder="Descrição (opcional)..."
        value={description}
        onChange={e => setDesc(e.target.value)}
        className="text-xs min-h-[52px] resize-none"
      />

      <Button
        size="sm" className="w-full text-xs h-7"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending || !title.trim()}
      >
        {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Plus className="w-3 h-3 mr-1.5" />}
        Criar Tarefa
      </Button>
    </div>
  );
}

// ─── Task Item ─────────────────────────────────────────────────────────────────
function TaskItem({ task, onUpdate, onDelete }: {
  task: Task;
  onUpdate: (t: Task) => void;
  onDelete: (id: number) => void;
}) {
  const Icon = TASK_TYPES.find(t => t.value === task.type)?.icon || StickyNote;
  const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isDone = task.status === "done";
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all group ${
        isDone
          ? "bg-muted/20 border-border/30 opacity-60"
          : isOverdue
          ? "bg-red-500/5 border-red-500/20"
          : "bg-card/50 border-border/40 hover:border-border/70"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onUpdate({ ...task, status: isDone ? "pending" : "done" })}
        className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
          isDone ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40 hover:border-primary"
        }`}
      >
        {isDone && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </button>

      {/* Icon */}
      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isDone ? "bg-muted" : "bg-primary/10"
      }`}>
        <Icon className={`w-3 h-3 ${isDone ? "text-muted-foreground" : "text-primary"}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-tight ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[9px] font-semibold ${prio.color}`}>{prio.label}</span>
          {task.dueDate && (
            <span className={`text-[9px] flex items-center gap-0.5 ${
              isOverdue ? "text-red-400 font-semibold" : "text-muted-foreground"
            }`}>
              {isOverdue && <AlertCircle className="w-2.5 h-2.5" />}
              <Clock className="w-2 h-2" />
              {new Date(task.dueDate).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" })}
              {" "}
              {new Date(task.dueDate).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
            </span>
          )}
          {task.reminderAt && !isDone && (
            <Bell className="w-2.5 h-2.5 text-amber-400/70" />
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive text-muted-foreground transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// ─── Main TasksPanel ───────────────────────────────────────────────────────────
export default function TasksPanel({ contactId }: { contactId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");

  const queryKey = [`/api/crm/tasks?contactId=${contactId}`];

  const { data, isLoading } = useQuery<{ tasks: Task[] }>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/crm/tasks?contactId=${contactId}`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (task: Task) => {
      const res = await fetch(`/api/crm/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Erro ao atualizar tarefa", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Tarefa removida." });
    },
    onError: () => toast({ title: "Erro ao remover tarefa", variant: "destructive" }),
  });

  const allTasks = data?.tasks || [];
  const filtered = filter === "all"
    ? allTasks
    : allTasks.filter(t => t.status === filter);

  const pendingCount  = allTasks.filter(t => t.status === "pending").length;
  const overdueCount  = allTasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done"
  ).length;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Tarefas</span>
          {pendingCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
              {pendingCount}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold flex items-center gap-0.5">
              <AlertCircle className="w-2.5 h-2.5" />{overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button
          variant="outline" size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={() => setShowForm(v => !v)}
        >
          <Plus className="w-2.5 h-2.5" /> Nova
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(["pending", "all", "done"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              filter === f
                ? "bg-primary/20 border-primary/40 text-primary font-medium"
                : "border-border/50 text-muted-foreground hover:border-border"
            }`}
          >
            {f === "pending" ? "Pendentes" : f === "done" ? "Concluídas" : "Todas"}
          </button>
        ))}
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <TaskForm
              contactId={contactId}
              onDone={() => {
                setShowForm(false);
                queryClient.invalidateQueries({ queryKey });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          {filter === "pending" ? "Nenhuma tarefa pendente." : "Nenhuma tarefa encontrada."}
        </p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={t => updateMutation.mutate(t)}
                onDelete={id => deleteMutation.mutate(id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
