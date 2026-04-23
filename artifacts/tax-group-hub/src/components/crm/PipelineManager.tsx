import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Edit2, Save, X, GripVertical,
  CheckCircle2, Loader2, ChevronRight, Star, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────
export type Pipeline = {
  id: number;
  name: string;
  stages: string[];
  isDefault: boolean | null;
  createdAt: string;
};

// ─── Default stages palette ──────────────────────────────────────────────────
const SUGGESTED_STAGES = [
  "Prospecção", "Contato Inicial", "Qualificação", "Descoberta",
  "Proposta", "Negociação", "Fechamento", "Ganhos", "Perdidos",
  "Onboarding", "Pós-Venda", "Renovação",
];

const STAGE_COLORS: Record<string, string> = {
  "Prospecção":     "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "Contato Inicial":"bg-sky-500/20 text-sky-300 border-sky-500/30",
  "Qualificação":   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Descoberta":     "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Proposta":       "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Negociação":     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Fechamento":     "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Ganhos":         "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Perdidos":       "bg-red-500/20 text-red-300 border-red-500/30",
  "Onboarding":     "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Pós-Venda":      "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Renovação":      "bg-lime-500/20 text-lime-300 border-lime-500/30",
};

function getStageColor(stage: string) {
  return STAGE_COLORS[stage] || "bg-muted/50 text-muted-foreground border-border/50";
}

// ─── Stage editor ────────────────────────────────────────────────────────────
function StageEditor({
  stages, onChange,
}: {
  stages: string[];
  onChange: (stages: string[]) => void;
}) {
  const [newStage, setNewStage] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function addStage() {
    const name = newStage.trim();
    if (!name || stages.includes(name)) return;
    onChange([...stages, name]);
    setNewStage("");
  }

  function removeStage(idx: number) {
    onChange(stages.filter((_, i) => i !== idx));
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault(); setDragOverIdx(idx);
  }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...stages];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    onChange(next);
    setDragIdx(null); setDragOverIdx(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        Etapas do funil <span className="normal-case">(arraste para reordenar)</span>
      </p>

      {/* Stage list */}
      <div className="space-y-1.5">
        <AnimatePresence>
          {stages.map((stage, idx) => (
            <motion.div
              key={stage}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-grab ${
                dragOverIdx === idx ? "border-primary/50 bg-primary/5" :
                dragIdx === idx ? "opacity-40" :
                "border-border/40 bg-card/50 hover:border-border/70"
              }`}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStageColor(stage)}`}>
                {stage}
              </span>
              <span className="flex-1" />
              <span className="text-[9px] text-muted-foreground/50 font-mono">{idx + 1}</span>
              <button onClick={() => removeStage(idx)}
                className="p-0.5 hover:text-destructive text-muted-foreground/40 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {stages.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-4 border border-dashed rounded-lg border-border/30">
            Adicione ao menos uma etapa
          </p>
        )}
      </div>

      {/* Add stage */}
      <div className="flex gap-2">
        <Input
          placeholder="Nova etapa..."
          value={newStage}
          onChange={e => setNewStage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addStage()}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={addStage} disabled={!newStage.trim()}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>

      {/* Suggested stages */}
      <div>
        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">Sugestões</p>
        <div className="flex gap-1.5 flex-wrap">
          {SUGGESTED_STAGES.filter(s => !stages.includes(s)).map(s => (
            <button
              key={s}
              onClick={() => onChange([...stages, s])}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Form (create or edit) ─────────────────────────────────────────
function PipelineForm({
  initial, onDone,
}: {
  initial?: Pipeline;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!initial;

  const [name, setName] = useState(initial?.name || "");
  const [stages, setStages] = useState<string[]>(
    initial?.stages || ["Prospecção", "Qualificação", "Proposta", "Negociação", "Fechamento", "Ganhos", "Perdidos"]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = isEditing ? `/api/crm/pipelines/${initial!.id}` : "/api/crm/pipelines";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), stages }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Erro"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      toast({ title: isEditing ? "✅ Funil atualizado!" : "✅ Funil criado!" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Nome do funil
        </label>
        <Input
          placeholder="Ex: Funil de Renovação, Pós-Venda..."
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-9 text-sm"
          autoFocus
        />
      </div>

      <StageEditor stages={stages} onChange={setStages} />

      <div className="flex gap-2 pt-2 border-t border-border/30">
        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          size="sm" className="flex-1 text-xs"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name.trim() || stages.length === 0}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
          ) : (
            <Save className="w-3 h-3 mr-1.5" />
          )}
          {isEditing ? "Salvar Alterações" : "Criar Funil"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main PipelineManager ────────────────────────────────────────────────────
export default function PipelineManager({
  activePipelineId,
  onSelect,
}: {
  activePipelineId: string;
  onSelect: (id: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Pipeline | null>(null);

  const { data, isLoading } = useQuery<{ pipelines: Pipeline[] }>({
    queryKey: ["/api/crm/pipelines"],
    queryFn: async () => { const r = await fetch("/api/crm/pipelines"); return r.json(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/pipelines/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      toast({ title: "Funil removido." });
      if (activePipelineId !== "default") onSelect("default");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/pipelines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      toast({ title: "Funil padrão atualizado." });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const pipelines = data?.pipelines || [];
  const DEFAULT_PIPELINE = {
    id: 0, name: "Funil Comercial (Padrão)", isDefault: true,
    stages: ["prospecting", "discovery", "proposal", "negotiation", "closing", "won", "lost"],
    createdAt: "",
  } as Pipeline;

  const allPipelines = [DEFAULT_PIPELINE, ...pipelines];

  if (mode === "create" || mode === "edit") {
    return (
      <div className="w-[420px] bg-card border border-border/50 rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold">{mode === "create" ? "Novo Funil" : "Editar Funil"}</h3>
          <button onClick={() => { setMode("list"); setEditTarget(null); }}
            className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <PipelineForm
          initial={editTarget ?? undefined}
          onDone={() => { setMode("list"); setEditTarget(null); }}
        />
      </div>
    );
  }

  return (
    <div className="w-[380px] bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Gerenciar Funis</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setMode("create")}>
          <Plus className="w-3 h-3" /> Novo Funil
        </Button>
      </div>

      {/* Pipeline list */}
      <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
          </div>
        ) : (
          allPipelines.map(pl => {
            const isActive = activePipelineId === (pl.id === 0 ? "default" : String(pl.id));
            return (
              <div
                key={pl.id}
                className={`group flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive ? "bg-primary/10 border-primary/30" : "bg-card/50 border-border/40 hover:border-border/70 hover:bg-muted/20"
                }`}
                onClick={() => onSelect(pl.id === 0 ? "default" : String(pl.id))}
              >
                {/* Active indicator */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-primary" : "bg-muted"}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{pl.name}</span>
                    {pl.isDefault && (
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                    )}
                    {isActive && (
                      <Badge variant="outline" className="text-[9px] border-primary/40 text-primary px-1.5 py-0 h-4">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {pl.stages.length} etapa{pl.stages.length !== 1 ? "s" : ""}
                    {" · "}
                    {pl.stages.slice(0, 3).join(" → ")}
                    {pl.stages.length > 3 && " ..."}
                  </p>
                </div>

                {/* Actions */}
                {pl.id !== 0 && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!pl.isDefault && (
                      <button
                        onClick={e => { e.stopPropagation(); setDefaultMutation.mutate(pl.id); }}
                        className="p-1 hover:bg-amber-500/10 hover:text-amber-400 text-muted-foreground/50 rounded transition-colors"
                        title="Definir como padrão"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setEditTarget(pl); setMode("edit"); }}
                      className="p-1 hover:bg-blue-500/10 hover:text-blue-400 text-muted-foreground/50 rounded transition-colors"
                      title="Editar funil"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate(pl.id); }}
                      className="p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 rounded transition-colors"
                      title="Excluir funil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground/30"}`} />
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border/30 bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          Clique em um funil para ativá-lo no Kanban. O funil ativo define as colunas exibidas.
        </p>
      </div>
    </div>
  );
}
