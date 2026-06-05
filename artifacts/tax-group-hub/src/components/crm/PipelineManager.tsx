import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Edit2, Save, X, GripVertical,
  CheckCircle2, Loader2, ChevronRight, Star, Layers,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/can";
import {
  useListCrmPipelines,
  useCreateCrmPipeline,
  useUpdateCrmPipeline,
  useDeleteCrmPipeline,
  getListCrmPipelinesQueryKey,
} from "@workspace/api-client-react";
import {
  PIPELINE_TAX_GROUP_STAGES,
  PIPELINE_STAGE_LABELS,
  DEFAULT_PIPELINE_NAME,
} from "@workspace/db/crm-constants";

// ─── Types ──────────────────────────────────────────────────────────────────
export type Pipeline = {
  id: number;
  name: string;
  stages: string[];
  isDefault: boolean | null;
  createdAt?: string;
};

// ─── Default stages palette (Fase 1.5) ──────────────────────────────────────
// Apenas as 16 etapas oficiais do Pipeline Tax Group.
// O array legado (Prospecção, Contato Inicial, Qualificação, Descoberta,
// Proposta, Negociação, Fechamento, Ganhos, Perdidos, Onboarding, Pós-Venda,
// Renovação) foi removido. O usuário pode criar funis customizados, mas o
// funil padrão e a sugestão inicial são sempre as 16 etapas Tax Group.

const SUGGESTED_STAGES: string[] = [...PIPELINE_TAX_GROUP_STAGES];

function getStageColor(stage: string) {
  // O pipeline Tax Group usa labels canônicos; sem cor pré-definida para
  // a UI do editor, mantém-se o estilo neutro do badge.
  return "bg-muted/50 text-muted-foreground border-border/50";
}

function getStageLabel(stage: string): string {
  return (PIPELINE_STAGE_LABELS as Record<string, string | undefined>)[stage] || stage;
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
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
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
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getStageColor(stage)}`}>
                {getStageLabel(stage)}
              </span>
              <span className="flex-1" />
              <span className="text-[11px] text-muted-foreground/50 font-mono">{idx + 1}</span>
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
        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">Sugestões (Pipeline Tax Group)</p>
        <div className="flex gap-1.5 flex-wrap">
          {SUGGESTED_STAGES.filter(s => !stages.includes(s)).map(s => (
            <button
              key={s}
              onClick={() => onChange([...stages, s])}
              className="text-xs px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              + {getStageLabel(s)}
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
    initial?.stages || [...PIPELINE_TAX_GROUP_STAGES]
  );

  const createPipeline = useCreateCrmPipeline({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCrmPipelinesQueryKey() });
        toast({ title: "✅ Funil criado!" });
        onDone();
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updatePipeline = useUpdateCrmPipeline({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCrmPipelinesQueryKey() });
        toast({ title: "✅ Funil atualizado!" });
        onDone();
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const saveMutation = isEditing ? updatePipeline : createPipeline;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Nome do funil
        </label>
        <Input
          placeholder="Ex: Funil Customizado..."
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-9 text-sm"
          autoFocus
        />
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          O funil operacional padrão é o <strong className="text-foreground">Pipeline Tax Group</strong> (16 etapas).
          Use este formulário apenas se precisar criar um funil customizado para uso específico.
        </p>
      </div>

      <StageEditor stages={stages} onChange={setStages} />

      <div className="flex gap-2 pt-2 border-t border-border/30">
        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          size="sm" className="flex-1 text-xs"
          onClick={() => {
            if (isEditing) {
              updatePipeline.mutate({ id: initial!.id, data: { name: name.trim(), stages } });
            } else {
              createPipeline.mutate({ data: { name: name.trim(), stages } });
            }
          }}
          disabled={(isEditing ? updatePipeline : createPipeline).isPending || !name.trim() || stages.length === 0}
        >
          {(isEditing ? updatePipeline : createPipeline).isPending ? (
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

  const { data, isLoading } = useListCrmPipelines();

  const deletePipeline = useDeleteCrmPipeline({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCrmPipelinesQueryKey() });
        toast({ title: "Funil removido." });
        if (activePipelineId !== "default") onSelect("default");
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updateDefaultPipeline = useUpdateCrmPipeline({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCrmPipelinesQueryKey() });
        toast({ title: "Funil padrão atualizado." });
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const pipelines = (data as any)?.pipelines || [];
  const DEFAULT_PIPELINE = {
    id: 0, name: DEFAULT_PIPELINE_NAME, isDefault: true,
    stages: [...PIPELINE_TAX_GROUP_STAGES],
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
        <Can permission="canEditPipeline">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setMode("create")}>
          <Plus className="w-3 h-3" /> Novo Funil
        </Button>
        </Can>
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
                      <Badge variant="outline" className="text-[11px] border-primary/40 text-primary px-1.5 py-0 h-4">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
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
                        onClick={e => { e.stopPropagation(); updateDefaultPipeline.mutate({ id: pl.id, data: { isDefault: true } }); }}
                        className="p-1 hover:bg-amber-500/10 hover:text-amber-400 text-muted-foreground/50 rounded transition-colors"
                        title="Definir como padrão"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Can permission="canEditPipeline">
                    <button
                      onClick={e => { e.stopPropagation(); setEditTarget(pl); setMode("edit"); }}
                      className="p-1 hover:bg-primary/10 hover:text-primary text-muted-foreground/50 rounded transition-colors"
                      title="Editar funil"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deletePipeline.mutate({ id: pl.id }); }}
                      className="p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 rounded transition-colors"
                      title="Excluir funil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    </Can>
                  </div>
                )}

                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground/30"}`} />
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border/30 bg-muted/10">
        <p className="text-xs text-muted-foreground">
          Clique em um funil para ativá-lo no Kanban. O funil ativo define as colunas exibidas.
        </p>
      </div>
    </div>
  );
}
