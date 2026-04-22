import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Zap, Loader2, Check, X, Bell, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type Automation = {
  id: number;
  userId: string;
  name: string;
  triggerType: string;
  triggerValue: string;
  actionType: string;
  actionPayload: any;
  isActive: boolean;
  createdAt: string;
};

const TRIGGER_TYPES = [
  { value: "status_changed", label: "Status mudar para..." },
  { value: "score_above", label: "Score de IA maior ou igual a..." },
  { value: "score_below", label: "Score de IA menor ou igual a..." },
];

const ACTION_TYPES = [
  { value: "create_task", label: "Criar uma Tarefa" },
  { value: "log_activity", label: "Registrar Atividade" },
];

const STATUS_OPTIONS = [
  { value: "prospect", label: "Prospect" },
  { value: "qualified", label: "Qualificado" },
  { value: "opportunity", label: "Oportunidade" },
  { value: "lost", label: "Perdido" },
  { value: "client", label: "Cliente" },
];

export default function AutomationsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("status_changed");
  const [triggerValue, setTriggerValue] = useState("");
  const [actionType, setActionType] = useState("create_task");
  
  // Payload states
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("high");

  const { data, isLoading } = useQuery<{ automations: Automation[] }>({
    queryKey: ["/api/crm/automations"],
    queryFn: async () => {
      const r = await fetch("/api/crm/automations");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = actionType === "create_task" 
        ? { title: taskTitle, type: "call", priority: taskPriority } 
        : { note: "Ação gerada por automação" };

      const res = await fetch("/api/crm/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, triggerType, triggerValue, actionType, actionPayload: payload
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar automação");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/automations"] });
      setShowForm(false);
      toast({ title: "Automação criada com sucesso!" });
      // Reset form
      setName(""); setTriggerValue(""); setTaskTitle("");
    },
    onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      const res = await fetch(`/api/crm/automations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/crm/automations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/automations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/automations"] });
      toast({ title: "Automação excluída" });
    },
  });

  const automations = data?.automations || [];

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Automações de Workflow
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Crie regras (If This, Then That) para automatizar ações repetitivas no CRM.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm" className="gap-2">
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
                  <Label>Nome da Regra</Label>
                  <Input placeholder="Ex: Ligar para Leads Quentes" value={name} onChange={e => setName(e.target.value)} className="mt-1" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3 bg-card p-3 border border-border/50 rounded-lg">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><span className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center rounded-full text-xs">1</span> SE (Gatilho)</h4>
                    <Select value={triggerType} onValueChange={setTriggerType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    
                    {triggerType === "status_changed" ? (
                      <Select value={triggerValue} onValueChange={setTriggerValue}>
                        <SelectTrigger><SelectValue placeholder="Selecione o status..." /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type="number" placeholder="Ex: 80" value={triggerValue} onChange={e => setTriggerValue(e.target.value)} />
                    )}
                  </div>

                  <div className="space-y-3 bg-card p-3 border border-border/50 rounded-lg">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><span className="bg-primary/20 text-primary w-5 h-5 flex items-center justify-center rounded-full text-xs">2</span> ENTÃO (Ação)</h4>
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
                            <SelectItem value="low">Prioridade Baixa</SelectItem>
                            <SelectItem value="medium">Prioridade Média</SelectItem>
                            <SelectItem value="high">Prioridade Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => createMutation.mutate()} 
                    disabled={createMutation.isPending || !name || !triggerValue || (actionType === "create_task" && !taskTitle)}
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Salvar Automação
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
        ) : automations.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhuma automação configurada.</p>
            <p className="text-xs text-muted-foreground">Clique em "Nova Regra" para criar sua primeira automação.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {automations.map(auto => (
              <div key={auto.id} className={`flex items-center justify-between p-4 border rounded-xl transition-all ${auto.isActive ? "bg-card border-border/60 shadow-sm" : "bg-muted/30 border-dashed opacity-70"}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${auto.isActive ? "bg-primary/10" : "bg-muted"}`}>
                    <Zap className={`w-5 h-5 ${auto.isActive ? "text-amber-500" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{auto.name}</h4>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className="font-medium bg-muted px-1.5 py-0.5 rounded">
                        SE {TRIGGER_TYPES.find(t => t.value === auto.triggerType)?.label.replace("...", "")} <strong>{auto.triggerValue}</strong>
                      </span>
                      <span>→</span>
                      <span className="font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {ACTION_TYPES.find(a => a.value === auto.actionType)?.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs cursor-pointer">{auto.isActive ? "Ativa" : "Pausada"}</Label>
                    <Switch 
                      checked={auto.isActive} 
                      onCheckedChange={(checked) => updateMutation.mutate({ id: auto.id, isActive: checked })}
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => {
                    if (confirm(`Deseja excluir a regra "${auto.name}"?`)) deleteMutation.mutate(auto.id);
                  }}>
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
