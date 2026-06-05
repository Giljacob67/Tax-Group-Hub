import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wifi,
  WifiOff,
  Loader2,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
  Search,
  Cpu,
  Zap,
  Brain,
  Eye,
  Paperclip,
  Palette,
  Mic,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LlmConnection, ProviderMeta } from "./types";
import { USAGE_TYPES } from "./types";

interface Props {
  connections: LlmConnection[];
  providers: ProviderMeta[];
  selectedProvider: ProviderMeta | null;
  onTest: (id: number) => void;
  onActivate: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit?: (conn: LlmConnection) => void;
  testingId: number | null;
}

const USAGE_ICONS: Record<string, React.ReactNode> = {
  chat: <Cpu className="w-3 h-3" />,
  fast: <Zap className="w-3 h-3" />,
  reasoning: <Brain className="w-3 h-3" />,
  vision: <Eye className="w-3 h-3" />,
  embedding: <Paperclip className="w-3 h-3" />,
  image: <Palette className="w-3 h-3" />,
  transcription: <Mic className="w-3 h-3" />,
};

export default function ModelCatalog({
  connections,
  providers,
  selectedProvider,
  onTest,
  onActivate,
  onDelete,
  onEdit,
  testingId,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = connections.filter((c) => {
    if (selectedProvider && c.provider !== selectedProvider.id) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.modelId.toLowerCase().includes(q) ||
      c.provider.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border/30 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo..."
            className="pl-8 text-xs"
          />
        </div>
        <div className="text-[11px] text-muted-foreground">
          {filtered.length} conex{filtered.length === 1 ? "ão" : "ões"}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <Cpu className="w-8 h-8 mb-2 opacity-30" />
            <p>Nenhuma conexão encontrada.</p>
            <p className="text-xs mt-1">
              Clique em "Nova Conexão" para começar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filtered.map((conn) => {
              const prov = providers.find((p) => p.id === conn.provider);
              const usage = USAGE_TYPES.find((u) => u.id === conn.usageType);
              const statusColor =
                conn.lastTestStatus === "ok"
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : conn.lastTestStatus === "error"
                    ? "text-red-400 bg-red-500/10 border-red-500/20"
                    : "text-amber-400 bg-amber-500/10 border-amber-500/20";

              return (
                <motion.div
                  key={conn.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group bg-card/50 border rounded-xl p-4 transition-all hover:shadow-sm ${
                    conn.isDefault
                      ? "border-primary/30 ring-1 ring-primary/10"
                      : "border-border/40"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`text-lg shrink-0 ${prov?.color || "text-muted-foreground"}`}
                      >
                        {prov?.icon || "◈"}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {conn.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate">
                          {conn.modelId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {conn.isDefault && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                          PADRÃO
                        </span>
                      )}
                      <button
                        onClick={() => onEdit?.(conn)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(conn.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {usage && (
                      <span className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted border border-border/30">
                        {USAGE_ICONS[usage.id]}
                        {usage.label}
                      </span>
                    )}
                    {conn.supportsVision && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        vision
                      </span>
                    )}
                    {conn.supportsTools && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        tools
                      </span>
                    )}
                    {conn.supportsJson && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        json
                      </span>
                    )}
                    {conn.contextWindow && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted border border-border/30">
                        {conn.contextWindow >= 1000
                          ? `${Math.round(conn.contextWindow / 1000)}k`
                          : conn.contextWindow}{" "}
                        ctx
                      </span>
                    )}
                    {conn.priceInput && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {conn.priceInput}
                      </span>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/20">
                    <div
                      className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border ${statusColor}`}
                    >
                      {conn.lastTestStatus === "ok" ? (
                        <Wifi className="w-3 h-3" />
                      ) : conn.lastTestStatus === "error" ? (
                        <WifiOff className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      <span>
                        {conn.lastTestStatus === "ok"
                          ? "Online"
                          : conn.lastTestStatus === "error"
                            ? "Erro"
                            : "Não testado"}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2.5"
                        onClick={() => onTest(conn.id)}
                        disabled={testingId === conn.id}
                      >
                        {testingId === conn.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Wifi className="w-3 h-3 mr-1" />
                        )}
                        Testar
                      </Button>
                      {!conn.isDefault && (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] px-2.5"
                          onClick={() => onActivate(conn.id)}
                        >
                          <Star className="w-3 h-3 mr-1" />
                          Ativar
                        </Button>
                      )}
                    </div>
                  </div>

                  {conn.lastError && conn.lastTestStatus === "error" && (
                    <div className="mt-2 text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-2 py-1 truncate">
                      {conn.lastError}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
