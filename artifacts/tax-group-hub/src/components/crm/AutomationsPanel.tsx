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
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Can } from "@/components/can";
import {
  useListCrmAutomations,
  useCreateCrmAutomation,
  useDeleteCrmAutomation,
  useListAutomationSequences,
  getListCrmAutomationsQueryKey,
} from "@workspace/api-client-react";
import {
  CONTACT_STATUSES, CONTACT_STATUS_LABELS,
  DEAL_STAGES, DEAL_STAGE_LABELS,
  AUTOMATION_TRIGGER_LABELS, AUTOMATION_ACTION_LABELS,
  ALERT_TYPES, ALERT_LABELS,
  type AutomationTriggerType, type AutomationActionType,
  PRIORIDADE_COMERCIAL_NIVEIS,
} from "@workspace/db/crm-constants";

type Automation = {
  id: number;
  name: string;
  triggerType: string;
  triggerValue?: string | null;
  actionType: string;
  actionPayload: any;
  isActive: boolean;
};

type Sequence = { id: number; name: string; isActive?: boolean };

const TRIGGER_TYPES: { value: AutomationTriggerType; label: string }[] = [
  { value: "status_changed",            label: AUTOMATION_TRIGGER_LABELS.status_changed },
  { value: "score_above",               label: AUTOMATION_TRIGGER_LABELS.score_above },
  { value: "score_below",               label: AUTOMATION_TRIGGER_LABELS.score_below },
  { value: "deal_stage_changed",        label: AUTOMATION_TRIGGER_LABELS.deal_stage_changed },
  { value: "followup_vencido",          label: AUTOMATION_TRIGGER_LABELS.followup_vencido },
  { value: "sem_atividade_7d",          label: AUTOMATION_TRIGGER_LABELS.sem_atividade_7d },
  { value: "sem_atividade_14d",         label: AUTOMATION_TRIGGER_LABELS.sem_atividade_14d },
  { value: "matriz_enviado",            label: AUTOMATION_TRIGGER_LABELS.matriz_enviado },
  { value: "matriz_aguardando",         label: AUTOMATION_TRIGGER_LABELS.matriz_aguardando },
  { value: "matriz_pendencia",          label: AUTOMATION_TRIGGER_LABELS.matriz_pendencia },
  { value: "proposta_pronta",           label: AUTOMATION_TRIGGER_LABELS.proposta_pronta },
  { value: "proposta_enviada",          label: AUTOMATION_TRIGGER_LABELS.proposta_enviada },
  { value: "proposta_sem_retorno_7d",   label: AUTOMATION_TRIGGER_LABELS.proposta_sem_retorno_7d },
];

const ACTION_TYPES: { value: AutomationActionType; label: string }[] = [
  { value: "create_task",      label: AUTOMATION_ACTION_LABELS.create_task },
  { value: "log_activity",     label: AUTOMATION_ACTION_LABELS.log_activity },
  { value: "enroll_sequence",  label: AUTOMATION_ACTION_LABELS.enroll_sequence },
  { value: "send_whatsapp",    label: AUTOMATION_ACTION_LABELS.send_whatsapp },
  { value: "add_tag",          label: AUTOMATION_ACTION_LABELS.add_tag },
  { value: "set_priority",     label: AUTOMATION_ACTION_LABELS.set_priority },
  { value: "set_assignee",     label: AUTOMATION_ACTION_LABELS.set_assignee },
  { value: "create_alert",     label: AUTOMATION_ACTION_LABELS.create_alert },
];

const STATUS_OPTIONS = CONTACT_STATUSES.map(s => ({ value: s, label: CONTACT_STATUS_LABELS[s] }));
const STAGE_OPTIONS = DEAL_STAGES.map(s => ({ value: s, label: DEAL_STAGE_LABELS[s] }));
const PRIORITY_OPTIONS = PRIORIDADE_COMERCIAL_NIVEIS.map(p => ({ value: p, label: p }));

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
  const [showConfirm, confirmDialog] = useConfirmDialog();
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
  const [tagName, setTagName] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [alertType, setAlertType] = useState<string>(ALERT_TYPES[0]);
  const [alertSeverity, setAlertSeverity] = useState<string>("warning");
  const [alertTitle, setAlertTitle] = useState("");

  const { data, isLoading } = useListCrmAutomations();

  const { data: seqData } = useListAutomationSequences();

  const sequences: Sequence[] = (seqData as any)?.sequences ?? [];

  function buildPayload() {
    switch (actionType) {
      case "create_task": return { title: taskTitle, type: "call", priority: taskPriority };
      case "enroll_sequence": {
        const seq = sequences.find(s => String(s.id) === seqId);
        return { sequenceId: Number(seqId), sequenceName: seq?.name ?? "" };
      }
      case "add_tag": return { tag: tagName };
      case "set_priority": return { priority: taskPriority === "high" ? "alta" : taskPriority === "urgent" ? "critica" : taskPriority };
      case "set_assignee": return { responsavelUnidade: assigneeName };
      case "create_alert": return { type: alertType, severity: alertSeverity, title: alertTitle };
      default: return { note: "Ação gerada por automação" };
    }
  }

  const createAutomation = useCreateCrmAutomation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCrmAutomationsQueryKey() });
        setShowForm(false);
        toast({ title: "✅ Automação criada!" });
        setName(""); setTriggerValue(""); setTaskTitle(""); setSeqId("");
      },
      onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
    },
  });

  function handleCreate() {
    createAutomation.mutate({
      data: { name, triggerType, triggerValue, actionType, actionPayload: buildPayload() },
    });
  }

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

  const deleteAutomation = useDeleteCrmAutomation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCrmAutomationsQueryKey() });
        toast({ title: "Automação removida" });
      },
    },
  });

  const saveDisabled =
    createAutomation.isPending ||
    !name.trim() ||
    (
      // For event-based triggers, triggerValue is not required
      !["followup_vencido", "sem_atividade_7d", "sem_atividade_14d",
        "matriz_enviado", "matriz_aguardando", "matriz_pendencia",
        "proposta_pronta", "proposta_enviada", "proposta_sem_retorno_7d"
      ].includes(triggerType) && !triggerValue
    ) ||
    (actionType === "create_task" && !taskTitle.trim()) ||
    (actionType === "enroll_sequence" && !seqId) ||
    (actionType === "add_tag" && !tagName.trim()) ||
    (actionType === "create_alert" && !alertTitle.trim());

  const automations: Automation[] = (data as any)?.automations ?? [];

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
        <Can permission="canManageAutomations">
        <Button onClick={() => setShowForm(v => !v)} variant="outline" size="sm" className="gap-2">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Nova Regra"}
        </Button>
        </Can>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    ) : (triggerType === "score_above" || triggerType === "score_below") ? (
                      <Input type="number" placeholder="Ex: 70" value={triggerValue} onChange={e => setTriggerValue(e.target.value)} />
                    ) : (
                      <p className="text-xs text-muted-foreground italic px-2 py-1.5 bg-muted/30 rounded">
                        ⏱ Dispara automaticamente quando o evento ocorre (sem valor adicional).
                      </p>
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

                    {actionType === "add_tag" && (
                      <Input placeholder="Nome da tag (ex: lead-quente)" value={tagName}
                        onChange={e => setTagName(e.target.value)} />
                    )}

                    {actionType === "set_assignee" && (
                      <Input placeholder="Nome do responsável" value={assigneeName}
                        onChange={e => setAssigneeName(e.target.value)} />
                    )}

                    {actionType === "set_priority" && (
                      <Select value={taskPriority} onValueChange={setTaskPriority}>
                        <SelectTrigger><SelectValue placeholder="Prioridade..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="critica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {actionType === "create_alert" && (
                      <div className="space-y-2">
                        <Input placeholder="Título do alerta..." value={alertTitle}
                          onChange={e => setAlertTitle(e.target.value)} />
                        <Select value={alertType} onValueChange={setAlertType}>
                          <SelectTrigger><SelectValue placeholder="Tipo de alerta..." /></SelectTrigger>
                          <SelectContent>
                            {ALERT_TYPES.map(t => <SelectItem key={t} value={t}>{ALERT_LABELS[t]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={alertSeverity} onValueChange={setAlertSeverity}>
                          <SelectTrigger><SelectValue placeholder="Severidade..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warning">Atenção</SelectItem>
                            <SelectItem value="critical">Crítico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleCreate} disabled={saveDisabled}>
                    {createAutomation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
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
                  <Can permission="canManageAutomations">
                  <Button
                    variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => {
                      showConfirm(
                        { title: `Remover "${auto.name}"?`, variant: "destructive", confirmLabel: "Remover" },
                        () => deleteAutomation.mutate({ id: auto.id })
                      );
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  </Can>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
