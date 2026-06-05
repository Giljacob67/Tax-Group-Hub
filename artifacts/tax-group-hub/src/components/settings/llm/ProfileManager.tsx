import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Star,
  Loader2,
  CheckCircle2,
  Trash2,
  Save,
  Cpu,
  Zap,
  Brain,
  Eye,
  Paperclip,
  Palette,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LlmProfile, LlmConnection } from "./types";
import {
  useCreateLlmProfile,
  useActivateLlmProfile,
  useDeleteLlmProfile,
} from "@workspace/api-client-react";

interface Props {
  profiles: LlmProfile[];
  connections: LlmConnection[];
  onRefresh: () => void;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  chat: { label: "Chat Geral", icon: <Cpu className="w-3.5 h-3.5" /> },
  fast: { label: "Respostas Rápidas", icon: <Zap className="w-3.5 h-3.5" /> },
  reasoning: {
    label: "Raciocínio Complexo",
    icon: <Brain className="w-3.5 h-3.5" />,
  },
  vision: { label: "Análise de Imagem", icon: <Eye className="w-3.5 h-3.5" /> },
  embedding: {
    label: "Embeddings",
    icon: <Paperclip className="w-3.5 h-3.5" />,
  },
  image: {
    label: "Geração de Imagem",
    icon: <Palette className="w-3.5 h-3.5" />,
  },
  transcription: {
    label: "Transcrição",
    icon: <Mic className="w-3.5 h-3.5" />,
  },
};

export default function ProfileManager({
  profiles,
  connections,
  onRefresh,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [assignments, setAssignments] = useState<
    Record<string, number | undefined>
  >({});

  const connectionOptions = connections.filter(
    (c) => c.lastTestStatus === "ok" || c.lastTestStatus === "untested",
  );

  const createProfileMutate = useCreateLlmProfile({
    mutation: {
      onSuccess: () => {
        setCreating(false);
        setForm({ name: "", description: "" });
        setAssignments({});
        onRefresh();
      },
    },
  });

  const activateProfileMutate = useActivateLlmProfile({
    mutation: {
      onSuccess: () => {
        onRefresh();
      },
    },
  });

  const deleteProfileMutate = useDeleteLlmProfile({
    mutation: {
      onSuccess: () => {
        onRefresh();
      },
    },
  });

  async function handleCreate() {
    if (!form.name.trim()) return;
    const body: Record<string, any> = {
      name: form.name.trim(),
      description: form.description || null,
    };
    Object.entries(assignments).forEach(([key, val]) => {
      body[key] = val;
    });
    createProfileMutate.mutate({ data: body as any });
  }

  function handleActivate(id: number) {
    activateProfileMutate.mutate({ id });
  }

  function handleDelete(id: number) {
    deleteProfileMutate.mutate({ id });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Perfis de Uso</h3>
          <p className="text-xs text-muted-foreground">
            Defina qual modelo usar para cada tipo de tarefa.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? (
            "Cancelar"
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo Perfil
            </>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card/50 border border-border/40 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Nome
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Ex: Econômico"
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Descrição
                  </Label>
                  <Input
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Opcional"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TYPE_META).map(([key, meta]) => {
                  const field = `${key}ConnectionId`;
                  return (
                    <div key={key}>
                      <Label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                        {meta.icon}
                        {meta.label}
                      </Label>
                      <select
                        className="w-full bg-background border border-border/50 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-primary/40 focus:outline-none"
                        value={assignments[field] || ""}
                        onChange={(e) =>
                          setAssignments((prev) => ({
                            ...prev,
                            [field]: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      >
                        <option value="">— Nenhum —</option>
                        {connectionOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={createProfileMutate.isPending || !form.name.trim()}
                >
                  {createProfileMutate.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1" />
                  )}
                  Salvar Perfil
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`flex items-center gap-3 bg-card/50 border rounded-xl px-4 py-3 transition-all ${
              profile.isActive
                ? "border-primary/30 ring-1 ring-primary/10"
                : "border-border/40"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Star
                className={`w-4 h-4 ${profile.isActive ? "text-primary" : "text-muted-foreground"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{profile.name}</span>
                {profile.isActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                    ATIVO
                  </span>
                )}
                {profile.isDefault && !profile.isActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted border border-border/30">
                    Padrão
                  </span>
                )}
              </div>
              {profile.description && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {profile.description}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {Object.entries(TYPE_META).map(([key, meta]) => {
                  const connId = (profile as any)[`${key}ConnectionId`];
                  const conn = connections.find((c) => c.id === connId);
                  if (!conn) return null;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      {meta.icon}
                      <span className="truncate max-w-[120px]">
                        {conn.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!profile.isActive && (
                <Button
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => handleActivate(profile.id)}
                  disabled={activateProfileMutate.isPending}
                >
                  {activateProfileMutate.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}
                  Ativar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                onClick={() => handleDelete(profile.id)}
                disabled={deleteProfileMutate.isPending}
              >
                {deleteProfileMutate.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
