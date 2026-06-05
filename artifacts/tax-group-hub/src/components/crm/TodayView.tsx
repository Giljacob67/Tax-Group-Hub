import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Loader2,
  PhoneCall,
  AtSign,
  MessageSquare,
  StickyNote,
  FileText,
  RefreshCw,
  ChevronRight,
  User2,
  CheckCheck,
  Flame,
  Target,
  Briefcase,
  Building2,
  TrendingUp,
  Send,
  Clock3,
  FileWarning,
  Handshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { DEMO_TASKS } from "@/lib/demo-data";
import {
  useListCrmTasks,
  useUpdateCrmTask,
  getListCrmTasksQueryKey,
  useGetCrmOperationalSummary,
} from "@workspace/api-client-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type Task = {
  id: number;
  contactId?: number | null;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type OperationalSummary = {
  followupVencidos: number;
  followupHoje: number;
  reunioesHoje: number;
  tarefasVencidas: number;
  semAtividade7d: number;
  semAtividade14d: number;
  aguardandoMatriz: number;
  pendenciaDocumental: number;
  propostasAbertas: number;
  emNegociacao: number;
  leadsNovos24h: number;
  leadsQuentes: number;
  totalContatos: number;
  totalDeals: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TASK_ICONS: Record<string, any> = {
  call: PhoneCall,
  email: AtSign,
  whatsapp: MessageSquare,
  meeting: Calendar,
  proposal: FileText,
  note: StickyNote,
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-400",
  high: "bg-amber-400",
  urgent: "bg-red-500 animate-pulse",
};

function isOverdue(task: Task) {
  return (
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "done"
  );
}

function isToday(task: Task) {
  if (!task.dueDate) return false;
  const d = new Date(task.dueDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTomorrow(task: Task) {
  if (!task.dueDate) return false;
  const d = new Date(task.dueDate);
  const tmr = new Date();
  tmr.setDate(tmr.getDate() + 1);
  return (
    d.getFullYear() === tmr.getFullYear() &&
    d.getMonth() === tmr.getMonth() &&
    d.getDate() === tmr.getDate()
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

// ─── Task Row ───────────────────────────────────────────────────────────────
function TodayTaskRow({
  task,
  onDone,
}: {
  task: Task;
  onDone: (id: number) => void;
}) {
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

      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          overdue ? "bg-red-500/10" : done ? "bg-muted" : "bg-primary/10"
        }`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${overdue ? "text-red-400" : done ? "text-muted-foreground" : "text-primary"}`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : overdue ? "text-red-300" : "text-foreground"}`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium}`}
        />
        {task.dueDate && (
          <span
            className={`text-[11px] font-mono ${overdue ? "text-red-400 font-semibold" : "text-muted-foreground"}`}
          >
            {isToday(task)
              ? formatTime(task.dueDate)
              : formatDate(task.dueDate)}
          </span>
        )}
        {task.contactId && (
          <User2 className="w-3 h-3 text-muted-foreground/50" />
        )}
      </div>
    </motion.div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  count,
  color,
  urgent,
  href,
}: {
  icon: any;
  label: string;
  count: number;
  color: string;
  urgent?: boolean;
  href?: string;
}) {
  if (count === 0) return null;
  
  const content = (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${
        urgent
          ? "border-red-500/30 bg-red-500/5"
          : "border-border/50 bg-muted/20"
      } ${href ? "cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors" : ""}`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p
          className={`text-lg font-bold leading-none ${urgent ? "text-red-400" : "text-foreground"}`}
        >
          {count}
        </p>
      </div>
    </div>
  );
  
  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}

// ─── Main TodayView ─────────────────────────────────────────────────────────
export default function TodayView() {
  const { isDemo } = useDemoMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDone, setShowDone] = useState(false);

  // Fetch operational summary
  const {
    data: summaryData,
    isLoading: loadingSummary,
    refetch: refetchSummary,
  } = useGetCrmOperationalSummary({
    query: { refetchInterval: 120_000 },
  } as any);
  const summary: OperationalSummary | undefined = summaryData?.summary as any;

  // Fetch all pending tasks
  const {
    data: pendingData,
    isLoading: loadingPending,
    refetch,
  } = useListCrmTasks(
    { status: "pending" } as any,
    { query: { refetchInterval: 60_000 } } as any,
  );

  const { data: doneData, isLoading: loadingDone } = useListCrmTasks(
    { status: "done" } as any,
    { query: { enabled: showDone } } as any,
  );

  const completeMutation = useUpdateCrmTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCrmTasksQueryKey() });
        refetchSummary();
        toast({ title: "Tarefa concluida!" });
      },
      onError: () =>
        toast({ title: "Erro ao concluir tarefa", variant: "destructive" }),
    },
  });

  let allTasks = pendingData?.tasks || [];

  // Demo fallback
  if (isDemo && allTasks.length === 0 && !loadingPending) {
    allTasks = DEMO_TASKS as unknown as Task[];
  }

  const overdueTasks = allTasks.filter((t) => isOverdue(t));
  const todayTasks = allTasks.filter((t) => isToday(t) && !isOverdue(t));
  const tomorrowTasks = allTasks.filter((t) => isTomorrow(t));
  const upcomingTasks = allTasks.filter(
    (t) => t.dueDate && !isOverdue(t) && !isToday(t) && !isTomorrow(t),
  );
  const nodateTasks = allTasks.filter((t) => !t.dueDate);

  const totalActionable = overdueTasks.length + todayTasks.length;
  const doneTodayTasks = (doneData?.tasks || []).filter((t) => isToday(t));

  const isLoading = loadingPending && loadingSummary;

  if (isLoading) {
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
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalActionable === 0 &&
              (!summary || summary.followupVencidos === 0)
                ? "Nenhuma acao urgente — todas as atividades estao em dia."
                : `${totalActionable} tarefa${totalActionable !== 1 ? "s" : ""} para hoje`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                refetch();
                refetchSummary();
              }}
            >
              <RefreshCw className="w-3 h-3" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Operational Stats Grid */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
            <StatCard
              icon={AlertCircle}
              label="Follow-ups vencidos"
              count={summary.followupVencidos}
              color="bg-red-500/10 text-red-400"
              urgent
              href="/crm?tab=today&filter=overdue-followups"
            />
            <StatCard
              icon={Calendar}
              label="Follow-ups hoje"
              count={summary.followupHoje}
              color="bg-amber-500/10 text-amber-400"
              href="/crm?tab=today&filter=today-followups"
            />
            <StatCard
              icon={Handshake}
              label="Reunioes hoje"
              count={summary.reunioesHoje}
              color="bg-purple-500/10 text-purple-400"
              href="/crm?tab=today&filter=today-meetings"
            />
            <StatCard
              icon={Clock3}
              label="Tarefas vencidas"
              count={summary.tarefasVencidas}
              color="bg-red-500/10 text-red-400"
              urgent
              href="/crm?tab=today&filter=overdue-tasks"
            />
            <StatCard
              icon={Flame}
              label="Leads quentes"
              count={summary.leadsQuentes}
              color="bg-orange-500/10 text-orange-400"
              href="/crm?tab=contacts&filter=temperature:quente"
            />
            <StatCard
              icon={Target}
              label="Propostas abertas"
              count={summary.propostasAbertas}
              color="bg-cyan-500/10 text-cyan-400"
              href="/crm?tab=pipeline"
            />
            <StatCard
              icon={Send}
              label="Aguardando Matriz"
              count={summary.aguardandoMatriz}
              color="bg-pink-500/10 text-pink-400"
              href="/crm?tab=pipeline&filter=aguardando_matriz"
            />
            <StatCard
              icon={FileWarning}
              label="Pendencia documental"
              count={summary.pendenciaDocumental}
              color="bg-red-500/10 text-red-400"
              href="/crm?tab=pipeline&filter=pendencia_documental"
            />
            <StatCard
              icon={TrendingUp}
              label="Em negociacao"
              count={summary.emNegociacao}
              color="bg-indigo-500/10 text-indigo-400"
              href="/crm?tab=pipeline&filter=negociacao"
            />
            <StatCard
              icon={Building2}
              label="Sem atividade 7d"
              count={summary.semAtividade7d}
              color="bg-gray-500/10 text-gray-400"
              href="/crm?tab=contacts&filter=semAtividadeDias:7"
            />
            <StatCard
              icon={Building2}
              label="Sem atividade 14d"
              count={summary.semAtividade14d}
              color="bg-gray-500/10 text-gray-400"
              href="/crm?tab=contacts&filter=semAtividadeDias:14"
            />
            <StatCard
              icon={CheckCircle2}
              label="Leads novos 24h"
              count={summary.leadsNovos24h}
              color="bg-green-500/10 text-green-400"
            />
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {allTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-6">
            <CheckCircle2 className="w-12 h-12 text-primary/20" />
            <p className="text-sm font-medium text-foreground">
              Nenhuma tarefa pendente
            </p>
            <p className="text-xs text-center max-w-sm">
              Crie tarefas no painel do contato ou no pipeline para organizar o
              follow-up comercial.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {/* OVERDUE */}
            {overdueTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-red-500/20 bg-red-500/5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                    Atrasadas
                  </span>
                  <span className="text-xs font-mono bg-red-500/10 text-red-400 rounded-full px-2 py-0.5">
                    {overdueTasks.length}
                  </span>
                </div>
                {overdueTasks.map((t) => (
                  <TodayTaskRow
                    key={t.id}
                    task={t}
                    onDone={(id) =>
                      completeMutation.mutate({
                        id,
                        data: {
                          status: "done",
                          completedAt: new Date().toISOString(),
                        },
                      })
                    }
                  />
                ))}
              </div>
            )}

            {/* TODAY */}
            {todayTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/20 bg-amber-500/5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Hoje
                  </span>
                  <span className="text-xs font-mono bg-amber-500/10 text-amber-400 rounded-full px-2 py-0.5">
                    {todayTasks.length}
                  </span>
                </div>
                {todayTasks.map((t) => (
                  <TodayTaskRow
                    key={t.id}
                    task={t}
                    onDone={(id) =>
                      completeMutation.mutate({
                        id,
                        data: {
                          status: "done",
                          completedAt: new Date().toISOString(),
                        },
                      })
                    }
                  />
                ))}
              </div>
            )}

            {/* TOMORROW */}
            {tomorrowTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/20 bg-primary/5">
                  <ChevronRight className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Amanha
                  </span>
                  <span className="text-xs font-mono bg-primary/10 text-primary rounded-full px-2 py-0.5">
                    {tomorrowTasks.length}
                  </span>
                </div>
                {tomorrowTasks.map((t) => (
                  <TodayTaskRow
                    key={t.id}
                    task={t}
                    onDone={(id) =>
                      completeMutation.mutate({
                        id,
                        data: {
                          status: "done",
                          completedAt: new Date().toISOString(),
                        },
                      })
                    }
                  />
                ))}
              </div>
            )}

            {/* UPCOMING */}
            {upcomingTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/10">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Proximas
                  </span>
                  <span className="text-xs font-mono bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                    {upcomingTasks.length}
                  </span>
                </div>
                {upcomingTasks.map((t) => (
                  <TodayTaskRow
                    key={t.id}
                    task={t}
                    onDone={(id) =>
                      completeMutation.mutate({
                        id,
                        data: {
                          status: "done",
                          completedAt: new Date().toISOString(),
                        },
                      })
                    }
                  />
                ))}
              </div>
            )}

            {/* NO DATE */}
            {nodateTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/5">
                  <StickyNote className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">
                    Sem data
                  </span>
                  <span className="text-xs font-mono bg-muted/50 rounded-full px-2 py-0.5 text-muted-foreground/50">
                    {nodateTasks.length}
                  </span>
                </div>
                {nodateTasks.map((t) => (
                  <TodayTaskRow
                    key={t.id}
                    task={t}
                    onDone={(id) =>
                      completeMutation.mutate({
                        id,
                        data: {
                          status: "done",
                          completedAt: new Date().toISOString(),
                        },
                      })
                    }
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        )}

        {/* Completed today section */}
        <div className="px-4 py-3 border-t border-border/30">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" />
            {showDone ? "Ocultar" : "Ver"} tarefas concluidas hoje
            {doneTodayTasks.length > 0 && (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 rounded-full px-1.5 py-0.5 font-bold">
                {doneTodayTasks.length}
              </span>
            )}
          </button>
          {showDone && loadingDone && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-2" />
          )}
          {showDone &&
            !loadingDone &&
            doneTodayTasks.map((t) => (
              <TodayTaskRow
                key={t.id}
                task={t}
                onDone={(id) =>
                  completeMutation.mutate({
                    id,
                    data: {
                      status: "done",
                      completedAt: new Date().toISOString(),
                    },
                  })
                }
              />
            ))}
        </div>
      </div>
    </div>
  );
}
