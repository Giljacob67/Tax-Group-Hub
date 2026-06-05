import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Zap,
  FlaskConical,
  Plus,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  BarChart3,
  AlertTriangle,
  Bot,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  useListAgents,
  useGetAiQualitySummary,
  useListAiQualityRuns,
  useListAiTestCases,
  useListAiTestCaseRuns,
  useCreateAiTestCase,
  useRunAiTestCase,
  useDeleteAiTestCase,
} from "@workspace/api-client-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QualitySummary {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number | null;
  successRate: number;
  totalFeedback: number;
  satisfactionRate: number | null;
  positiveFeedback: number;
  negativeFeedback: number;
}

interface ExecutionRun {
  id: number;
  userId: string | null;
  conversationId: number | null;
  agentId: string | null;
  model: string | null;
  provider: string | null;
  usageType: string | null;
  totalTokens: number;
  latencyMs: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface TestCase {
  id: number;
  name: string;
  agentId: string;
  question: string;
  expectedAnswer: string | null;
  criteria: string | null;
  active: boolean;
  createdAt: string;
}

interface TestRun {
  id: number;
  testCaseId: number;
  model: string;
  provider: string;
  status: string;
  score: number | null;
  response: string | null;
  ragSources: string[] | null;
  latencyMs: number | null;
  tokensUsed: number | null;
  notes: string | null;
  createdAt: string;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 flex-shrink-0`}
      >
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        {sub && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    error: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    running: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    pending: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${map[status] || map.pending}`}
    >
      {status === "passed" && <CheckCircle className="w-3 h-3" />}
      {status === "failed" && <XCircle className="w-3 h-3" />}
      {status === "error" && <AlertTriangle className="w-3 h-3" />}
      {status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiQualityPage() {
  usePageTitle("Qualidade IA");
  const { toast } = useToast();
  const { data: agentsData } = useListAgents();

  const [activeTab, setActiveTab] = useState<"overview" | "runs" | "tests">(
    "overview",
  );
  const [expandedTest, setExpandedTest] = useState<number | null>(null);
  const [runningTest, setRunningTest] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // New test case form
  const [showNewTestForm, setShowNewTestForm] = useState(false);
  const [newTest, setNewTest] = useState({
    name: "",
    agentId: "",
    question: "",
    expectedAnswer: "",
    criteria: "",
  });

  const {
    data: summary,
    isLoading: loadingSummary,
    refetch: refetchSummary,
  } = useGetAiQualitySummary();
  const {
    data: runsData,
    isLoading: loadingRuns,
    refetch: refetchRuns,
  } = useListAiQualityRuns({ limit: 50 });
  const { data: testsData, isLoading: loadingTests } = useListAiTestCases();
  const { data: testRunsData, refetch: refetchTestRuns } =
    useListAiTestCaseRuns(expandedTest!, {
      query: { enabled: !!expandedTest },
    } as any);

  const runs = (runsData?.runs ?? []) as unknown as ExecutionRun[];
  const testCases = (testsData?.testCases ?? []) as unknown as TestCase[];
  const testRuns = expandedTest
    ? ((testRunsData?.runs ?? []) as unknown as TestRun[])
    : [];

  const createMutation = useCreateAiTestCase();
  const runMutation = useRunAiTestCase();
  const deleteMutation = useDeleteAiTestCase();

  const handleCreateTest = async () => {
    if (!newTest.name.trim() || !newTest.agentId || !newTest.question.trim()) {
      toast({
        title: "Preencha nome, agente e pergunta",
        variant: "destructive",
      });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: newTest.name.trim(),
          agentId: newTest.agentId,
          question: newTest.question.trim(),
          expectedAnswer: newTest.expectedAnswer.trim() || undefined,
          criteria: newTest.criteria.trim() || undefined,
        },
      });
      toast({ title: "Caso de teste criado!" });
      setNewTest({
        name: "",
        agentId: "",
        question: "",
        expectedAnswer: "",
        criteria: "",
      });
      setShowNewTestForm(false);
    } catch {
      toast({ title: "Erro ao criar caso de teste", variant: "destructive" });
    }
  };

  const handleRunTest = async (testCaseId: number) => {
    setRunningTest(testCaseId);
    try {
      const d = await runMutation.mutateAsync({ id: testCaseId });
      toast({ title: `Execução: ${(d as any).run?.status || "concluída"}` });
      if (expandedTest !== testCaseId) setExpandedTest(testCaseId);
    } catch {
      toast({ title: "Erro ao executar teste", variant: "destructive" });
    } finally {
      setRunningTest(null);
    }
  };

  const handleDeleteTest = async (id: number) => {
    setDeleteTarget(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteMutation.mutateAsync({ id: deleteTarget });
        toast({ title: "Caso de teste excluído" });
        setDeleteTarget(null);
      } catch {
        toast({ title: "Erro ao excluir", variant: "destructive" });
      }
    }
  };

  const agents = agentsData?.agents || [];

  const TABS = [
    { id: "overview", label: "Visão Geral", icon: BarChart3 },
    { id: "runs", label: "Execuções", icon: Activity },
    { id: "tests", label: "Casos de Teste", icon: FlaskConical },
  ] as const;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Qualidade & Rastreabilidade
              </h1>
              <p className="text-xs text-muted-foreground">
                Avaliação e monitoramento das respostas dos agentes IA
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchSummary()}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Atualizar"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingSummary ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-border -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-6 max-w-4xl">
            {loadingSummary ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    icon={Activity}
                    label="Total de Requisições"
                    value={summary.totalRequests.toLocaleString("pt-BR")}
                    sub="todas as chamadas à IA"
                  />
                  <MetricCard
                    icon={CheckCircle}
                    label="Taxa de Sucesso"
                    value={`${summary.successRate}%`}
                    color={
                      summary.successRate >= 95
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }
                    sub="respostas sem erro"
                  />
                  <MetricCard
                    icon={Clock}
                    label="Latência Média"
                    value={
                      summary.avgLatencyMs != null
                        ? `${(summary.avgLatencyMs / 1000).toFixed(1)}s`
                        : "—"
                    }
                    sub="tempo de resposta"
                  />
                  <MetricCard
                    icon={Zap}
                    label="Total de Tokens"
                    value={
                      summary.totalTokens >= 1000
                        ? `${(summary.totalTokens / 1000).toFixed(1)}k`
                        : summary.totalTokens
                    }
                    sub="tokens consumidos"
                  />
                </div>

                {/* Feedback section */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-primary" /> Feedback dos
                    Usuários
                  </h2>
                  {summary.totalFeedback === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhum feedback coletado ainda. Os usuários podem avaliar
                      respostas individuais no chat.
                    </div>
                  ) : (
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <ThumbsUp className="w-5 h-5" />
                        <span className="text-2xl font-bold">
                          {summary.positiveFeedback}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          positivos
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-rose-400">
                        <ThumbsDown className="w-5 h-5" />
                        <span className="text-2xl font-bold">
                          {summary.negativeFeedback}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          negativos
                        </span>
                      </div>
                      {summary.satisfactionRate !== null && (
                        <div className="ml-auto text-center">
                          <div className="text-3xl font-bold text-primary">
                            {summary.satisfactionRate}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            satisfação
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Guardrails info */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Guardrails
                    Ativos
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Fontes RAG visíveis por mensagem — usuário sabe de onde
                      vem a informação
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Nível de confiança exibido (alta/média/baixa/sem contexto)
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Instrução de incerteza injetada quando sem contexto RAG
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Feedback por mensagem coletado e armazenado
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Metadados RAG salvos no banco por mensagem (auditável)
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                Erro ao carregar métricas
              </div>
            )}
          </div>
        )}

        {/* ── Runs Tab ── */}
        {activeTab === "runs" && (
          <div className="max-w-5xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Histórico de Execuções
              </h2>
              <button
                onClick={() => refetchRuns()}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>
            {loadingRuns ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>
                  Nenhuma execução ainda. Use os agentes no chat para gerar
                  logs.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-card border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Data
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Agente
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Modelo
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Tokens
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Latência
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        className="hover:bg-card/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(run.createdAt), "dd/MM HH:mm", {
                            locale: ptBR,
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="flex items-center gap-1.5">
                            <Bot className="w-3 h-3 text-primary/60 flex-shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {run.agentId || "—"}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground/70">
                          {run.model || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground/70">
                          {run.totalTokens?.toLocaleString("pt-BR") || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground/70">
                          {run.latencyMs != null
                            ? `${(run.latencyMs / 1000).toFixed(1)}s`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {run.success ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" /> ok
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/30"
                              title={run.errorMessage || ""}
                            >
                              <XCircle className="w-3 h-3" /> erro
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Test Cases Tab ── */}
        {activeTab === "tests" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Casos de Teste por Agente
              </h2>
              <button
                onClick={() => setShowNewTestForm((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Caso
              </button>
            </div>

            {/* New test form */}
            {showNewTestForm && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Novo Caso de Teste
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Nome *
                    </label>
                    <input
                      value={newTest.name}
                      onChange={(e) =>
                        setNewTest((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="Ex: Pergunta sobre RTI básico"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Agente *
                    </label>
                    <select
                      value={newTest.agentId}
                      onChange={(e) =>
                        setNewTest((p) => ({ ...p, agentId: e.target.value }))
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                    >
                      <option value="">Selecionar agente...</option>
                      {agents.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Pergunta *
                    </label>
                    <textarea
                      value={newTest.question}
                      onChange={(e) =>
                        setNewTest((p) => ({ ...p, question: e.target.value }))
                      }
                      placeholder="O que devo perguntar ao agente?"
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all resize-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Resposta esperada (opcional)
                    </label>
                    <textarea
                      value={newTest.expectedAnswer}
                      onChange={(e) =>
                        setNewTest((p) => ({
                          ...p,
                          expectedAnswer: e.target.value,
                        }))
                      }
                      placeholder="Resposta ideal para comparação..."
                      rows={2}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all resize-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Critérios de avaliação (opcional)
                    </label>
                    <input
                      value={newTest.criteria}
                      onChange={(e) =>
                        setNewTest((p) => ({ ...p, criteria: e.target.value }))
                      }
                      placeholder="Ex: Deve mencionar alíquota correta, citar fonte..."
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCreateTest}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Criar
                  </button>
                  <button
                    onClick={() => setShowNewTestForm(false)}
                    className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {loadingTests ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : testCases.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>
                  Nenhum caso de teste criado. Crie um para validar o
                  comportamento dos agentes.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {testCases.map((tc) => {
                  const runs = expandedTest === tc.id ? testRuns : [];
                  const isExpanded = expandedTest === tc.id;
                  const isRunning = runningTest === tc.id;
                  const latestRun = runs[0];

                  return (
                    <div
                      key={tc.id}
                      className="bg-card border border-border rounded-xl overflow-hidden"
                    >
                      <div className="p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {tc.name}
                            </span>
                            {latestRun && (
                              <StatusBadge status={latestRun.status} />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Bot className="w-3 h-3 flex-shrink-0" />{" "}
                            {tc.agentId}
                          </div>
                          <div className="text-xs text-foreground/70 line-clamp-2">
                            {tc.question}
                          </div>
                          {tc.criteria && (
                            <div className="text-[11px] text-muted-foreground mt-1 italic">
                              Critérios: {tc.criteria}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={async () => {
                              if (!isExpanded) {
                                setExpandedTest(tc.id);
                              }
                              setExpandedTest(isExpanded ? null : tc.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Ver execuções"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRunTest(tc.id)}
                            disabled={isRunning}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                            title="Executar"
                          >
                            {isRunning ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteTest(tc.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Excluir"
                            aria-label="Excluir caso de teste"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border p-4 bg-background/50">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Histórico de Execuções
                          </h4>
                          {runs.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Nenhuma execução. Clique em Executar ▶ para rodar.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {runs.map((run) => (
                                <div
                                  key={run.id}
                                  className="border border-border rounded-lg p-3 bg-card"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <StatusBadge status={run.status} />
                                      <span className="text-[11px] text-muted-foreground">
                                        {run.model} · {run.provider}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                      {run.latencyMs != null && (
                                        <span>
                                          {(run.latencyMs / 1000).toFixed(1)}s
                                        </span>
                                      )}
                                      {run.tokensUsed != null && (
                                        <span>{run.tokensUsed} tokens</span>
                                      )}
                                      <span>
                                        {format(
                                          new Date(run.createdAt),
                                          "dd/MM HH:mm",
                                          { locale: ptBR },
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  {run.ragSources &&
                                    run.ragSources.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {run.ragSources.map((src, i) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                                          >
                                            <FileText className="w-2.5 h-2.5" />{" "}
                                            {src}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  {run.response && (
                                    <div className="text-xs text-foreground/80 bg-muted/40 rounded-lg p-2.5 line-clamp-4">
                                      {run.response}
                                    </div>
                                  )}
                                  {run.notes && (
                                    <div className="text-[11px] text-destructive mt-1">
                                      {run.notes}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Test Case Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir caso de teste?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O caso de teste e todo seu
              histórico de execuções serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
