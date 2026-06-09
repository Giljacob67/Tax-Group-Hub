import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAutomationSequences,
  useListSequenceEnrollments,
  useUpdateAutomationSequence,
  useDeleteAutomationSequence,
  useEnrollInSequence,
  useBroadcastWhatsApp,
  useCreateAutomationSequence,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  Zap,
  Trash2,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  Megaphone,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  List,
  Send,
  X,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ─── Types ───────────────────────────────────────────────────────────────────
type SequenceStep = {
  day: number;
  channel: "whatsapp" | "email" | "internal_note";
  agentId: string;
  inputTemplate: string;
};

type Sequence = {
  id: number;
  name: string;
  trigger: string;
  triggerValue: string | null;
  isActive: boolean | null;
  steps: SequenceStep[];
  createdAt: string;
};

type Enrollment = {
  id: number;
  sequenceId: number;
  contactId: number;
  currentStep: number;
  nextSendAt: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  sequenceName: string | null;
  totalSteps: SequenceStep[] | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TRIGGER_LABELS: Record<string, string> = {
  score_above: "Score acima de",
  deal_stage_changed: "Negócio muda para",
  contact_created: "Novo contato",
  manual: "Manual",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-primary/20 text-primary border-primary/30",
  paused: "bg-muted/20 text-muted-foreground border-muted/30",
  completed: "bg-primary/20 text-primary border-primary/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AutomationsPage() {
  usePageTitle("Automações");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("sequences");
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [enrollSeqId, setEnrollSeqId] = useState("");
  const [enrollContactId, setEnrollContactId] = useState("");
  const [deleteSeqId, setDeleteSeqId] = useState<number | null>(null);
  const [broadcastForm, setBroadcastForm] = useState({
    channelId: "",
    agentId: "whatsapp-broadcast-tax-group",
    inputTemplate: "",
    minScore: "",
    maxScore: "",
    status: "",
  });
  const [newSequence, setNewSequence] = useState({
    name: "",
    trigger: "manual",
    triggerValue: "",
    steps: [{ day: 0, channel: "whatsapp" as const, agentId: "", inputTemplate: "" }],
  });

  // ── Queries ──
  const { data: seqData, isLoading: seqLoading } = useListAutomationSequences();

  const { data: enrollData, isLoading: enrollLoading } =
    useListSequenceEnrollments(undefined, {
      query: { refetchInterval: 30_000 },
    } as any);

  const sequences = seqData?.sequences ?? [];
  const enrollments = enrollData?.enrollments ?? [];

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const completedToday = enrollments.filter(
    (e) =>
      e.completedAt &&
      new Date(e.completedAt).toDateString() === new Date().toDateString(),
  ).length;

  // ── Toggle active ──
  const toggleMutation = useUpdateAutomationSequence({
    mutation: {
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: ["/api/automate/sequences"] }),
    },
  });

  // ── Delete sequence ──
  const deleteMutation = useDeleteAutomationSequence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/automate/sequences"] });
        toast({ title: "Sequência removida" });
      },
    },
  });

  // ── Enroll contact ──
  const enrollMutation = useEnrollInSequence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/automate/enrollments"] });
        setShowEnrollDialog(false);
        setEnrollContactId("");
        toast({ title: "Contato inscrito na sequência" });
      },
      onError: (e: any) =>
        toast({
          title: "Erro",
          description: e.message,
          variant: "destructive",
        }),
    },
  });

  // ── Broadcast ──
  const broadcastMutation = useBroadcastWhatsApp({
    mutation: {
      onSuccess: (data) => {
        setShowBroadcastDialog(false);
        toast({ title: `Broadcast enviado: ${data.queued} contatos na fila` });
      },
      onError: (e: any) =>
        toast({
          title: "Erro no broadcast",
          description: e.message,
          variant: "destructive",
        }),
    },
  });

  // ── Create sequence ──
  const createMutation = useCreateAutomationSequence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/automate/sequences"] });
        setShowCreateDialog(false);
        setNewSequence({
          name: "",
          trigger: "manual",
          triggerValue: "",
          steps: [{ day: 0, channel: "whatsapp", agentId: "", inputTemplate: "" }],
        });
        toast({ title: "Sequência criada!" });
      },
      onError: (e: any) =>
        toast({
          title: "Erro ao criar sequência",
          description: e.message,
          variant: "destructive",
        }),
    },
  });

  const handleCreateSequence = () => {
    if (!newSequence.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (newSequence.steps.length === 0) {
      toast({ title: "Adicione pelo menos uma etapa", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      data: {
        name: newSequence.name.trim(),
        trigger: newSequence.trigger,
        triggerValue: newSequence.triggerValue || undefined,
        steps: newSequence.steps,
        isActive: true,
      },
    });
  };

  const addStep = () => {
    setNewSequence((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { day: prev.steps.length * 3, channel: "whatsapp" as const, agentId: "", inputTemplate: "" },
      ],
    }));
  };

  const removeStep = (index: number) => {
    setNewSequence((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  };

  const updateStep = (index: number, field: string, value: string | number) => {
    setNewSequence((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step
      ),
    }));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-6 pb-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              Automações
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sequências de WhatsApp e broadcasts segmentados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> Nova Sequência
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEnrollDialog(true)}
            >
              <Users className="w-4 h-4 mr-1" /> Inscrever Contato
            </Button>
            <Button
              size="sm"
              onClick={() => setShowBroadcastDialog(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Megaphone className="w-4 h-4 mr-1" /> Broadcast
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <KpiCard
            icon={<List className="w-4 h-4 text-primary" />}
            label="Sequências ativas"
            value={sequences.filter((s) => s.isActive).length}
            color="primary"
          />
          <KpiCard
            icon={<Users className="w-4 h-4 text-muted-foreground" />}
            label="Contatos em andamento"
            value={activeEnrollments.length}
            color="muted"
          />
          <KpiCard
            icon={<CheckCircle2 className="w-4 h-4 text-primary" />}
            label="Concluídos hoje"
            value={completedToday}
            color="primary"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-none px-6 pt-3">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="sequences">
              Sequências ({sequences.length})
            </TabsTrigger>
            <TabsTrigger value="enrollments">
              Contatos Ativos ({activeEnrollments.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab: Sequences ── */}
        <TabsContent value="sequences" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full px-6 py-4">
            {seqLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sequences.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-foreground">
                  Nenhuma automação configurada
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Crie sequências de WhatsApp e e-mail para nurturing automático
                  de leads qualificados.
                </p>
                <Button
                  onClick={() => setTab("enrollments")}
                  className="mt-4"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" /> Inscrever Contato
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sequences.map((seq) => {
                  const enrolled = enrollments.filter(
                    (e) => e.sequenceId === seq.id,
                  );
                  const active = enrolled.filter(
                    (e) => e.status === "active",
                  ).length;
                  return (
                    <motion.div
                      key={seq.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card/50 border border-border/50 rounded-xl p-4 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                              {seq.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                seq.isActive
                                  ? "border-primary/40 text-primary"
                                  : "border-muted text-muted-foreground"
                              }
                            >
                              {seq.isActive ? "Ativa" : "Pausada"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {TRIGGER_LABELS[seq.trigger] ?? seq.trigger}
                              {seq.triggerValue && (
                                <span className="font-medium text-foreground/70">
                                  {" "}
                                  {seq.triggerValue}
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <List className="w-3 h-3" />
                              {seq.steps.length} etapas
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {active} ativos
                              </span>
                            </span>
                          </div>
                          {/* Steps preview */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {seq.steps.map((s: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-center gap-0.5"
                              >
                                <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 border border-primary/20 text-primary/80">
                                  D+{s.day} ·{" "}
                                  {s.channel === "whatsapp"
                                    ? "WA"
                                    : s.channel === "email"
                                      ? "E-mail"
                                      : "Nota"}
                                </span>
                                {i < seq.steps.length - 1 && (
                                  <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleMutation.mutate({
                                id: seq.id,
                                data: { isActive: !seq.isActive },
                              })
                            }
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          >
                            {seq.isActive ? (
                              <ToggleRight className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEnrollSeqId(String(seq.id));
                              setShowEnrollDialog(true);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                            title="Inscrever contato"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSeqId(seq.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            title="Excluir sequência"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── Tab: Active Enrollments ── */}
        <TabsContent value="enrollments" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full px-6 py-4">
            {enrollLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : activeEnrollments.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-foreground">
                  Nenhum contato em sequência
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Inscreva leads em campanhas automáticas de follow-up
                  comercial.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeEnrollments.map((en) => {
                  const seqForEnroll = sequences.find(
                    (s) => s.id === en.sequenceId,
                  );
                  const totalSteps = seqForEnroll?.steps?.length ?? 0;
                  const pct =
                    totalSteps > 0
                      ? Math.round((en.currentStep / totalSteps) * 100)
                      : 0;
                  const overdue = en.nextSendAt
                    ? new Date(en.nextSendAt) < new Date()
                    : false;
                  return (
                    <div
                      key={en.id}
                      className="bg-card/50 border border-border/40 rounded-lg px-4 py-3 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {en.sequenceName ?? `Sequência #${en.sequenceId}`}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>Contato #{en.contactId}</span>
                          <span>
                            Etapa {en.currentStep + 1}/{totalSteps}
                          </span>
                          <span
                            className={`flex items-center gap-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {overdue ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {overdue ? "Atrasado · " : "Próximo: "}
                            {en.nextSendAt ? fmtDate(en.nextSendAt) : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-20">
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 text-right">
                          {pct}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* ── Enroll Dialog ── */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="bg-card/95 backdrop-blur-lg border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle>Inscrever Contato em Sequência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Sequência
              </Label>
              <Select value={enrollSeqId} onValueChange={setEnrollSeqId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {sequences
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                ID do Contato (CRM)
              </Label>
              <Input
                type="number"
                placeholder="Ex: 42"
                value={enrollContactId}
                onChange={(e) => setEnrollContactId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEnrollDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                enrollMutation.mutate({
                  id: Number(enrollSeqId),
                  data: { contactId: Number(enrollContactId) },
                })
              }
              disabled={
                !enrollSeqId || !enrollContactId || enrollMutation.isPending
              }
            >
              {enrollMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              Inscrever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Broadcast Dialog ── */}
      <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
        <DialogContent className="bg-card/95 backdrop-blur-lg border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> Broadcast WhatsApp
              Segmentado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  ID do Canal WhatsApp
                </Label>
                <Input
                  placeholder="ID do canal"
                  value={broadcastForm.channelId}
                  onChange={(e) =>
                    setBroadcastForm((f) => ({
                      ...f,
                      channelId: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Status dos contatos
                </Label>
                <Select
                  value={broadcastForm.status}
                  onValueChange={(v) =>
                    setBroadcastForm((f) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="qualified">Qualificado</SelectItem>
                    <SelectItem value="opportunity">Oportunidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Score mínimo
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={broadcastForm.minScore}
                  onChange={(e) =>
                    setBroadcastForm((f) => ({
                      ...f,
                      minScore: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Score máximo
                </Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={broadcastForm.maxScore}
                  onChange={(e) =>
                    setBroadcastForm((f) => ({
                      ...f,
                      maxScore: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Instrução para o agente
              </Label>
              <Textarea
                placeholder="Ex: Crie uma mensagem personalizada para {{contact_name}} da {{razao_social}} sobre a Reforma Tributária e como o Tax Group pode ajudar..."
                rows={4}
                value={broadcastForm.inputTemplate}
                onChange={(e) =>
                  setBroadcastForm((f) => ({
                    ...f,
                    inputTemplate: e.target.value,
                  }))
                }
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use:{" "}
                <code className="text-primary/80">{"{{contact_name}}"}</code>{" "}
                <code className="text-primary/80">{"{{razao_social}}"}</code>{" "}
                <code className="text-primary/80">{"{{product}}"}</code>{" "}
                <code className="text-primary/80">{"{{uf}}"}</code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBroadcastDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const filters: Record<string, any> = {};
                if (broadcastForm.minScore)
                  filters.minScore = Number(broadcastForm.minScore);
                if (broadcastForm.maxScore)
                  filters.maxScore = Number(broadcastForm.maxScore);
                if (broadcastForm.status)
                  filters.status = [broadcastForm.status];
                broadcastMutation.mutate({
                  data: {
                    channelId: Number(broadcastForm.channelId),
                    agentId: broadcastForm.agentId,
                    inputTemplate: broadcastForm.inputTemplate,
                    filters,
                  },
                });
              }}
              disabled={
                !broadcastForm.channelId ||
                !broadcastForm.inputTemplate ||
                broadcastMutation.isPending
              }
              className="bg-primary hover:bg-primary/90"
            >
              {broadcastMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Enviar Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sequence Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card/95 backdrop-blur-lg border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" /> Nova Sequência
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Nome da Sequência *
              </Label>
              <Input
                placeholder="Ex: Follow-up após qualificação"
                value={newSequence.name}
                onChange={(e) =>
                  setNewSequence((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Gatilho
                </Label>
                <Select
                  value={newSequence.trigger}
                  onValueChange={(v) =>
                    setNewSequence((f) => ({ ...f, trigger: v, triggerValue: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="score_above">Score acima de</SelectItem>
                    <SelectItem value="deal_stage_changed">Mudança de estágio</SelectItem>
                    <SelectItem value="contact_created">Novo contato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newSequence.trigger !== "manual" && newSequence.trigger !== "contact_created" && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Valor do Gatilho
                  </Label>
                  <Input
                    placeholder={newSequence.trigger === "score_above" ? "Ex: 70" : "Ex: qualified"}
                    value={newSequence.triggerValue}
                    onChange={(e) =>
                      setNewSequence((f) => ({ ...f, triggerValue: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs text-muted-foreground">
                  Etapas da Sequência
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addStep}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Etapa
                </Button>
              </div>
              <div className="space-y-3">
                {newSequence.steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 bg-muted/30 border border-border/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 pt-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                      <span className="text-xs font-mono text-muted-foreground w-12">
                        D+{step.day}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Dia</Label>
                        <Input
                          type="number"
                          value={step.day}
                          onChange={(e) => updateStep(index, "day", parseInt(e.target.value) || 0)}
                          className="h-8 text-xs"
                          min={0}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Canal</Label>
                        <Select
                          value={step.channel}
                          onValueChange={(v) => updateStep(index, "channel", v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="internal_note">Nota Interna</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Agente</Label>
                        <Input
                          placeholder="ID do agente"
                          value={step.agentId}
                          onChange={(e) => updateStep(index, "agentId", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Instrução / Template</Label>
                        <Textarea
                          placeholder="Ex: Crie uma mensagem personalizada para {{contact_name}} sobre..."
                          value={step.inputTemplate}
                          onChange={(e) => updateStep(index, "inputTemplate", e.target.value)}
                          className="text-xs min-h-[60px]"
                          rows={2}
                        />
                      </div>
                    </div>
                    {newSequence.steps.length > 1 && (
                      <button
                        onClick={() => removeStep(index)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors mt-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSequence}
              disabled={!newSequence.name.trim() || createMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {createMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Zap className="w-4 h-4 mr-1" />
              )}
              Criar Sequência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Sequence Confirmation */}
      <AlertDialog
        open={!!deleteSeqId}
        onOpenChange={(open) => {
          if (!open) setDeleteSeqId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sequência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A sequência e todas as inscrições
              associadas serão permanentemente excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSeqId) {
                  deleteMutation.mutate({ id: deleteSeqId });
                  setDeleteSeqId(null);
                }
              }}
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 border-primary/20",
    muted: "bg-muted/10 border-muted/20",
  };
  return (
    <div
      className={`rounded-xl border p-4 ${colorMap[color] ?? "bg-card/50 border-border/40"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
