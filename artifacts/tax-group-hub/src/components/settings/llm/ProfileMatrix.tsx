import { useState } from "react";
import { motion } from "framer-motion";
import {
  Star,
  Trash2,
  Zap,
  Brain,
  BookOpen,
  Code,
  DollarSign,
  ShieldAlert,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { LlmProfile, LlmConnection } from "./types";

interface ProfileMatrixProps {
  profiles: LlmProfile[];
  connections: LlmConnection[];
  onCreate: (
    profile: Omit<LlmProfile, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => void;
  onActivate: (id: number) => void;
  onDelete: (id: number) => void;
}

const PROFILE_TEMPLATES = [
  {
    id: "chat_commercial",
    name: "Chat Comercial",
    description: "Respostas naturais para interação com leads e clientes",
    icon: Zap,
    color: "text-sky-400",
  },
  {
    id: "diagnostic",
    name: "Diagnóstico Tributário",
    description: "Análise técnica profunda de cenários fiscais",
    icon: Brain,
    color: "text-amber-400",
  },
  {
    id: "rag",
    name: "RAG / Base de Conhecimento",
    description: "Recuperação de informações com contexto documental",
    icon: BookOpen,
    color: "text-emerald-400",
  },
  {
    id: "json_auto",
    name: "Automações JSON",
    description: "Saída estruturada para integrações e workflows",
    icon: Code,
    color: "text-purple-400",
  },
  {
    id: "low_cost",
    name: "Baixo Custo",
    description: "Modelo econômico para tarefas simples e de alto volume",
    icon: DollarSign,
    color: "text-teal-400",
  },
  {
    id: "fallback",
    name: "Fallback Geral",
    description: "Backup quando o modelo principal falha",
    icon: ShieldAlert,
    color: "text-rose-400",
  },
];

const TYPE_FIELDS: { key: keyof LlmProfile; label: string }[] = [
  { key: "chatConnectionId", label: "Chat" },
  { key: "fastConnectionId", label: "Rápido" },
  { key: "reasoningConnectionId", label: "Raciocínio" },
  { key: "visionConnectionId", label: "Visão" },
  { key: "embeddingConnectionId", label: "Embedding" },
];

export function ProfileMatrix({
  profiles,
  connections,
  onCreate,
  onActivate,
  onDelete,
}: ProfileMatrixProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [assignments, setAssignments] = useState<Record<string, number | null>>(
    {},
  );

  const testableConnections = connections.filter(
    (c) => c.lastTestStatus === "ok" || c.lastTestStatus === "untested",
  );

  const handleCreate = () => {
    if (!form.name.trim()) return;
    onCreate({
      name: form.name,
      description: form.description || null,
      chatConnectionId: assignments.chatConnectionId || null,
      fastConnectionId: assignments.fastConnectionId || null,
      reasoningConnectionId: assignments.reasoningConnectionId || null,
      visionConnectionId: assignments.visionConnectionId || null,
      embeddingConnectionId: assignments.embeddingConnectionId || null,
      imageConnectionId: null,
      transcriptionConnectionId: null,
      isDefault: profiles.length === 0,
      isActive: profiles.length === 0,
    });
    setForm({ name: "", description: "" });
    setAssignments({});
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Perfis de Uso
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agentes usam perfis, não modelos diretamente. Cada perfil define
            qual conexão usar para cada tipo de tarefa.
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-3 h-3" />
          Novo perfil
        </Button>
      </div>

      {/* Templates hint */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {PROFILE_TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border border-border/30 bg-muted/10 p-2.5 hover:bg-muted/20 transition-colors cursor-pointer"
            onClick={() => {
              setForm({ name: t.name, description: t.description });
              setShowForm(true);
            }}
          >
            <div className="flex items-center gap-2">
              <t.icon className={`w-3.5 h-3.5 ${t.color}`} />
              <span className="text-xs font-medium text-foreground">
                {t.name}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {t.description}
            </p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Nome do perfil"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Descrição (opcional)"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TYPE_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {label}
                </label>
                <select
                  className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                  value={assignments[key] || ""}
                  onChange={(e) =>
                    setAssignments((a) => ({
                      ...a,
                      [key]: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">Nenhum</option>
                  {testableConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.modelId})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
              Criar perfil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </motion.div>
      )}

      {/* Profiles list */}
      <div className="space-y-2">
        {profiles.map((profile) => (
          <motion.div
            key={profile.id}
            layout
            className="rounded-lg border border-border/40 bg-card/40 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-foreground">
                    {profile.name}
                  </h4>
                  {profile.isActive && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] gap-1"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Ativo
                    </Badge>
                  )}
                  {profile.isDefault && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 text-primary bg-primary/10 text-[10px] gap-1"
                    >
                      <Star className="w-2.5 h-2.5" />
                      Padrão
                    </Badge>
                  )}
                </div>
                {profile.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile.description}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TYPE_FIELDS.map(({ key, label }) => {
                    const connId = profile[key] as number | null;
                    const conn = connections.find((c) => c.id === connId);
                    if (!conn) return null;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/30 bg-muted/20 text-[10px]"
                      >
                        <span className="text-muted-foreground">{label}:</span>
                        <span className="text-foreground font-medium">
                          {conn.modelId}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!profile.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onActivate(profile.id)}
                  >
                    Ativar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(profile.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
