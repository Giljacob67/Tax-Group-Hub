import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Trash2,
  Edit2,
  TestTube,
  Star,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CapabilityBadge } from "./CapabilityBadge";
import type { LlmConnection, ProviderMeta, DiagnosticResult } from "./types";

interface ConnectionTableProps {
  connections: LlmConnection[];
  providers: ProviderMeta[];
  selectedProvider: ProviderMeta | null;
  testingId: number | null;
  diagnosticsMap: Map<number, { results: DiagnosticResult[]; overall: string }>;
  onTest: (conn: LlmConnection) => void;
  onActivate: (conn: LlmConnection) => void;
  onDelete: (conn: LlmConnection) => void;
  onEdit: (conn: LlmConnection) => void;
  onShowDiagnostics: (conn: LlmConnection) => void;
}

function StatusBadge({
  status,
  error,
}: {
  status: string;
  error: string | null;
}) {
  if (status === "ok")
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1"
      >
        <CheckCircle2 className="w-3 h-3" />
        OK
      </Badge>
    );
  if (status === "error")
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 text-red-400 bg-red-500/10 gap-1"
      >
        <AlertCircle className="w-3 h-3" />
        Erro
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="border-muted text-muted-foreground bg-muted/20 gap-1"
    >
      <Clock className="w-3 h-3" />
      Não testado
    </Badge>
  );
}

export function ConnectionTable({
  connections,
  providers,
  selectedProvider,
  testingId,
  diagnosticsMap,
  onTest,
  onActivate,
  onDelete,
  onEdit,
  onShowDiagnostics,
}: ConnectionTableProps) {
  const [search, setSearch] = useState("");

  const filtered = connections.filter((c) => {
    if (selectedProvider && c.provider !== selectedProvider.id) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.modelId.toLowerCase().includes(q) ||
      c.provider.toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
          <Activity className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {selectedProvider
            ? "Nenhuma conexão para este provedor."
            : "Nenhuma conexão configurada ainda."}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Clique em "Conectar" em um provedor para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar conexões..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm bg-background"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((conn) => {
          const provider = providers.find((p) => p.id === conn.provider);
          const diag = diagnosticsMap.get(conn.id);
          const isTesting = testingId === conn.id;

          return (
            <motion.div
              key={conn.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border/40 bg-card/40 p-3 hover:bg-card/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{provider?.icon || "🤖"}</span>
                    <h4 className="text-sm font-semibold text-foreground truncate">
                      {conn.name}
                    </h4>
                    {conn.isDefault && (
                      <Badge
                        variant="outline"
                        className="border-primary/30 text-primary bg-primary/10 gap-1 text-[10px]"
                      >
                        <Star className="w-2.5 h-2.5" />
                        Padrão
                      </Badge>
                    )}
                    <StatusBadge
                      status={conn.lastTestStatus}
                      error={conn.lastError}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span>{conn.modelId}</span>
                    <span>·</span>
                    <span className="capitalize">{conn.provider}</span>
                    {conn.contextWindow && (
                      <>
                        <span>·</span>
                        <CapabilityBadge
                          type="context"
                          value={`${(conn.contextWindow / 1000).toFixed(0)}k`}
                        />
                      </>
                    )}
                    {conn.supportsTools && <CapabilityBadge type="tools" />}
                    {conn.supportsJson && <CapabilityBadge type="json" />}
                    {conn.supportsVision && <CapabilityBadge type="vision" />}
                  </div>

                  {diag && diag.overall !== "ok" && (
                    <button
                      onClick={() => onShowDiagnostics(conn)}
                      className="mt-2 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {diag.results.find((r) => !r.ok)?.userMessage ||
                        "Problemas detectados"}
                    </button>
                  )}

                  {conn.lastTestedAt && (
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      Último teste:{" "}
                      {new Date(conn.lastTestedAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onTest(conn)}
                    disabled={isTesting}
                    title="Testar"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <TestTube className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  {!conn.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onActivate(conn)}
                      title="Ativar como padrão"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onEdit(conn)}
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(conn)}
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
