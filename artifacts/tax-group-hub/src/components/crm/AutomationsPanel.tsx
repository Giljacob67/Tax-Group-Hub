import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Zap, Loader2, Check, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type Automation = {
  id: number;
  name: string;
  triggerType: string;
  triggerValue: string;
  actionType: string;
  actionPayload: any;
  isActive: boolean;
};

type Sequence = { id: number; name: string };

const TRIGGER_TYPES = [
  { value: "status_changed",    label: "Status do contato mudar para..." },
  { value: "score_above",       label: "Score de IA maior ou igual a..." },
  { value: "score_below",       label: "Score de IA menor ou igual a..." },
  { value: "deal_stage_changed", label: "Etapa do deal mudar para..." },
];

const ACTION_TYPES = [
  { value: "create_task",      label: "Criar Tarefa" },
  { value: "log_activity",     label: "Registrar Atividade" },
  { value: "enroll_sequence",  label: "Enrolar em Sequência WhatsApp" },
];

const STATUS_OPTIONS = [
  { value: "prospect",    label: "Prospect" },
  { value: "qualified",   label: "Qualificado" },
  { value: "opportunity", label: "Oportunidade" },
  { value: "client",      label: "Cliente" },
  { value: "lost",        label: "Perdido" },
];

const STAGE_OPTIONS = [
  { value: "prospecting",  label: "Prospecção" },
  { value: "discovery",    label: "Descoberta" },
  { value: "proposal",     label: "Proposta" },
  { value: "negotiation",  label: "Negociação" },
  { value: "closing",      label: "Fechamento" },
  { value: "won",          label: "Ganho" },
  { value: "lost",         label: "Perdido" },
];

function triggerLabel(auto: Automation) {
  const t = TRIGGER_TYPES.find(t => t.value === auto.triggerType);
  const base = t?.label.replace("...", "") ?? auto.triggerType;
  return `${base} ${auto.triggerValue}`;
}

function actionLabel(auto: Automation) {
  const a = ACTION_TYPES.find(a => a.value === auto.actionType);
  if (auto.actionType === "enroll_sequence" && auto.actionPayload?.sequenceName) {
    return `Enrolar em "${auto.actionPayload.sequenceName}"`;
  }
  return a?.label ?? auto.actionType;
}

export default function AutomationsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("status_changed");
  const [triggerValue, setTriggerValue] = useState("");
  const [actionType, setActionType] = useState("create_task");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("high");
  const [seqId, setSeqId] = useState("");

  const { data, isLoading } = useQuery<{ automations: Automation[] }>({
    queryKey: ["/api/crm/automations"],
    queryFn: () => fetch("/api/crm/automations").then(r => r.json()),
  });

  const { data: seqData } = useQuery<{ sequences: Sequence[] }>({
    queryKey: ["/api/automate/sequences"],
    queryFn: () => fetch("/api/automate/sequences").then(r => r.json()),
  });

  const sequences = seqData?.sequences ?? [];

  function buildPayload() {
    if (actionType === "create_task") return { title: taskTitle, type: "call", priority: taskPriority };
    if (actionType === "enroll_sequence") {
      const seq = sequences.find(s => String(s.id) === seqId);
      return { sequenceId: Number(seqId), sequenceName: seq?.name ?? "" };
    }
    return { note: "Ação gerada por automação" };
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/crm/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, triggerType, triggerValue, actionType, actionPayload: buildPayload() }),
      });
      if (!r.ok) throw new Error("Erro ao criar");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/automations"] });
      setShowForm(false);
      toast({ title: "✅ Automação criada!" });
      setName(""); setTriggerValue(""); setTaskTitle(""); setSeqId("");
    },
    onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await fetch(`/api/crm/automations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/crm/automations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/crm/automations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/automations"] });
      toast({ title: "Automação removida" });
    },
  });

  const saveDisabled =
    createMutation.isPending ||
    !name.trim() ||
    !triggerValue ||
    (actionType === "create_task" && !taskTitle.trim()) ||
    (actionType === "enroll_sequence" && !seqId);

  const automations = data?.automations ?? [];

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" /> Automações de Workflow
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Regras SE → ENTÃO que disparam automaticamente no CRM.
          </p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} variant="outline" size="sm" className="gap-2">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Nova Regra"}
        </Button>
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto">
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome da Regra</Label>
                  <Input
                    placeholder="Ex: Enrolar em sequência ao enviar proposta"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* SE */}
                  <div className="space-y-3 bg-card p-3 border border-border/50 rounded-lg">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <span className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center rounded-full text-xs">1</span>
                      SE (Gatilho)
                    </h4>
                    <Select value={triggerType} onValueChange={v => { setTriggerType(v); setTriggerValue(""); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {triggerType === "status_changed" ? (
                      <Select value={triggerValue} onValueChange={setTriggerValue}>
                        <SelectTrigger><SelectValue placeholder="Selecionar status..." /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : triggerType === "deal_stage_changed" ? (
                      <Select value={triggerValue} onValueChange={setTriggerValue}>
                        <SelectTrigger><SelectValue placeholder="Selecionar etapa..." /></SelectTrigger>
                        <SelectContent>
                          {STAGE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type="number" placeholder="Ex: 70" value={triggerValue} onChange={e => setTriggerValue(e.target.value)} />
                    )}
                  </div>

                  {/* ENTÃO */}
                  <div className="space-y-3 bg-card p-3 border border-border/50 rounded-lg">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <span className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center rounded-full text-xs">2</span>
                      ENTÃO (Ação)
                    </h4>
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {actionType === "create_task" && (
                      <div className="space-y-2">
                        <Input placeholder="Título da tarefa..." value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                        <Select value={taskPriority} onValueChange={setTaskPriority}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {actionType === "enroll_sequence" && (
                      <Select value={seqId} onValueChange={setSeqId}>
                        <SelectTrigger><SelectValue placeholder="Selecionar sequência..." /></SelectTrigger>
                        <SelectContent>
                          {sequences.length === 0 ? (
                            <SelectItem value="none" disabled>Nenhuma sequência cadastrada</SelectItem>
                          ) : (
                            sequences.filter(s => (s as any).isActive !== false).map(s => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => createMutation.mutate()} disabled={saveDisabled}>
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Salvar Regra
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
        ) : automations.length === 0 ? (
          <div className="text-center py-16">
            <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhuma automação configurada.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Nova Regra" para criar a primeira.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map(auto => (
              <div
                key={auto.id}
                className={`flex items-center justify-between p-4 border rounded-xl transition-all ${
                  auto.isActive ? "bg-card border-border/60 shadow-sm" : "bg-muted/30 border-dashed opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${auto.isActive ? "bg-amber-500/15" : "bg-muted"}`}>
                    <Zap className={`w-4 h-4 ${auto.isActive ? "text-amber-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{auto.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        SE {triggerLabel(auto)}
                      </span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                        auto.actionType === "enroll_sequence"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {actionLabel(auto)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{auto.isActive ? "Ativa" : "Pausada"}</span>
                    <Switch
                      checked={!!auto.isActive}
                      onCheckedChange={checked => toggleMutation.mutate({ id: auto.id, isActive: checked })}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => { if (confirm(`Remover "${auto.name}"?`)) deleteMutation.mutate(auto.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
