import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Zap, Play, Pause, Trash2, Plus, Users, Clock,
  CheckCircle2, XCircle, ChevronRight, Megaphone,
  CalendarClock, AlertCircle, ToggleLeft, ToggleRight,
  RefreshCw, MessageSquare, List, Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
  score_above:        "Score acima de",
  deal_stage_changed: "Deal muda para",
  contact_created:    "Novo contato",
  manual:             "Manual",
};

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  paused:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
  completed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AutomationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("sequences");
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [enrollSeqId, setEnrollSeqId] = useState("");
  const [enrollContactId, setEnrollContactId] = useState("");
  const [broadcastForm, setBroadcastForm] = useState({
    channelId: "",
    agentId: "whatsapp-broadcast-tax-group",
    inputTemplate: "",
    minScore: "",
    maxScore: "",
    status: "",
  });

  // ── Queries ──
  const { data: seqData, isLoading: seqLoading } = useQuery<{ sequences: Sequence[] }>({
    queryKey: ["/api/automate/sequences"],
    queryFn: () => fetch("/api/automate/sequences").then(r => r.json()),
  });

  const { data: enrollData, isLoading: enrollLoading } = useQuery<{ enrollments: Enrollment[] }>({
    queryKey: ["/api/automate/enrollments"],
    queryFn: () => fetch("/api/automate/enrollments").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const sequences = seqData?.sequences ?? [];
  const enrollments = enrollData?.enrollments ?? [];

  const activeEnrollments = enrollments.filter(e => e.status === "active");
  const completedToday = enrollments.filter(e => e.completedAt && new Date(e.completedAt).toDateString() === new Date().toDateString()).length;

  // ── Toggle active ──
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(`/api/automate/sequences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/automate/sequences"] }),
  });

  // ── Delete sequence ──
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/automate/sequences/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/automate/sequences"] });
      toast({ title: "Sequência removida" });
    },
  });

  // ── Enroll contact ──
  const enrollMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/automate/sequences/${enrollSeqId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: Number(enrollContactId) }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Falha"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/automate/enrollments"] });
      setShowEnrollDialog(false);
      setEnrollContactId("");
      toast({ title: "✅ Contato enrolado na sequência" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Broadcast ──
  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const filters: Record<string, any> = {};
      if (broadcastForm.minScore) filters.minScore = Number(broadcastForm.minScore);
      if (broadcastForm.maxScore) filters.maxScore = Number(broadcastForm.maxScore);
      if (broadcastForm.status)   filters.status = [broadcastForm.status];
      const r = await fetch("/api/automate/broadcast-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: Number(broadcastForm.channelId),
          agentId: broadcastForm.agentId,
          inputTemplate: broadcastForm.inputTemplate,
          filters,
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Falha"); }
      return r.json();
    },
    onSuccess: (data) => {
      setShowBroadcastDialog(false);
      toast({ title: `📤 Broadcast enviado: ${data.queued} contatos na fila` });
    },
    onError: (e: any) => toast({ title: "Erro no broadcast", description: e.message, variant: "destructive" }),
  });

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
            <p className="text-sm text-muted-foreground mt-0.5">Sequências de WhatsApp e broadcasts segmentados</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEnrollDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Enrolar Contato
            </Button>
            <Button size="sm" onClick={() => setShowBroadcastDialog(true)} className="bg-primary hover:bg-primary/90">
              <Megaphone className="w-4 h-4 mr-1" /> Broadcast
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <KpiCard icon={<List className="w-4 h-4 text-blue-400" />} label="Sequências ativas" value={sequences.filter(s => s.isActive).length} color="blue" />
          <KpiCard icon={<Users className="w-4 h-4 text-amber-400" />} label="Contatos em andamento" value={activeEnrollments.length} color="amber" />
          <KpiCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} label="Concluídos hoje" value={completedToday} color="emerald" />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-none px-6 pt-3">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="sequences">Sequências ({sequences.length})</TabsTrigger>
            <TabsTrigger value="enrollments">Contatos Ativos ({activeEnrollments.length})</TabsTrigger>
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
                <p className="text-sm">Nenhuma sequência cadastrada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sequences.map(seq => {
                  const enrolled = enrollments.filter(e => e.sequenceId === seq.id);
                  const active = enrolled.filter(e => e.status === "active").length;
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
                            <span className="font-semibold text-sm text-foreground">{seq.name}</span>
                            <Badge variant="outline" className={seq.isActive ? "border-emerald-500/40 text-emerald-400" : "border-muted text-muted-foreground"}>
                              {seq.isActive ? "Ativa" : "Pausada"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {TRIGGER_LABELS[seq.trigger] ?? seq.trigger}
                              {seq.triggerValue && <span className="font-medium text-foreground/70"> {seq.triggerValue}</span>}
                            </span>
                            <span className="flex items-center gap-1">
                              <List className="w-3 h-3" />
                              {seq.steps.length} etapas
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-amber-400" />
                              <span className="text-amber-400">{active} ativos</span>
                            </span>
                          </div>
                          {/* Steps preview */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {seq.steps.map((s, i) => (
                              <div key={i} className="flex items-center gap-0.5">
                                <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 border border-primary/20 text-primary/80">
                                  D+{s.day} · {s.channel === "whatsapp" ? "WA" : s.channel === "email" ? "✉" : "📝"}
                                </span>
                                {i < seq.steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => toggleMutation.mutate({ id: seq.id, isActive: !seq.isActive })}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          >
                            {seq.isActive
                              ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                              : <ToggleLeft className="w-4 h-4" />
                            }
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              setEnrollSeqId(String(seq.id));
                              setShowEnrollDialog(true);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                            title="Enrolar contato"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => deleteMutation.mutate(seq.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
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
                <p className="text-sm">Nenhum contato em andamento no momento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeEnrollments.map(en => {
                  const totalSteps = en.totalSteps?.length ?? 0;
                  const pct = totalSteps > 0 ? Math.round(((en.currentStep) / totalSteps) * 100) : 0;
                  const overdue = new Date(en.nextSendAt) < new Date();
                  return (
                    <div key={en.id} className="bg-card/50 border border-border/40 rounded-lg px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{en.sequenceName ?? `Sequência #${en.sequenceId}`}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>Contato #{en.contactId}</span>
                          <span>Step {en.currentStep + 1}/{totalSteps}</span>
                          <span className={`flex items-center gap-1 ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
                            {overdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {overdue ? "Atrasado · " : "Próximo: "}
                            {fmtDate(en.nextSendAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-20">
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 text-right">{pct}%</div>
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
            <DialogTitle>Enrolar Contato em Sequência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Sequência</Label>
              <Select value={enrollSeqId} onValueChange={setEnrollSeqId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {sequences.filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">ID do Contato (CRM)</Label>
              <Input
                type="number"
                placeholder="Ex: 42"
                value={enrollContactId}
                onChange={e => setEnrollContactId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={!enrollSeqId || !enrollContactId || enrollMutation.isPending}
            >
              {enrollMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
              Enrolar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Broadcast Dialog ── */}
      <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
        <DialogContent className="bg-card/95 backdrop-blur-lg border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> Broadcast WhatsApp Segmentado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">ID do Canal WhatsApp</Label>
                <Input placeholder="ID do canal" value={broadcastForm.channelId} onChange={e => setBroadcastForm(f => ({ ...f, channelId: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Status dos contatos</Label>
                <Select value={broadcastForm.status} onValueChange={v => setBroadcastForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="qualified">Qualificado</SelectItem>
                    <SelectItem value="opportunity">Oportunidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Score mínimo</Label>
                <Input type="number" placeholder="0" value={broadcastForm.minScore} onChange={e => setBroadcastForm(f => ({ ...f, minScore: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Score máximo</Label>
                <Input type="number" placeholder="100" value={broadcastForm.maxScore} onChange={e => setBroadcastForm(f => ({ ...f, maxScore: e.target.value }))} />
              </div>
            </div>
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Instrução para o agente</Label>
              <Textarea
                placeholder="Ex: Crie uma mensagem personalizada para {{contact_name}} da {{razao_social}} sobre a Reforma Tributária e como o Tax Group pode ajudar..."
                rows={4}
                value={broadcastForm.inputTemplate}
                onChange={e => setBroadcastForm(f => ({ ...f, inputTemplate: e.target.value }))}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use: <code className="text-primary/80">{"{{contact_name}}"}</code> <code className="text-primary/80">{"{{razao_social}}"}</code> <code className="text-primary/80">{"{{product}}"}</code> <code className="text-primary/80">{"{{uf}}"}</code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBroadcastDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => broadcastMutation.mutate()}
              disabled={!broadcastForm.channelId || !broadcastForm.inputTemplate || broadcastMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {broadcastMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Enviar Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue:    "bg-blue-500/10 border-blue-500/20",
    amber:   "bg-amber-500/10 border-amber-500/20",
    emerald: "bg-emerald-500/10 border-emerald-500/20",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] ?? "bg-card/50 border-border/40"}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
