import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Loader2,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HealthCheckResult, DiagnosticStage } from "./types";

interface HealthCheckPanelProps {
  results: HealthCheckResult[];
  loading: boolean;
  onRun: () => void;
  onClose: () => void;
}

const STAGE_ORDER: DiagnosticStage[] = [
  "auth",
  "models",
  "chat",
  "json",
  "tools",
];
const STAGE_LABELS: Record<string, string> = {
  auth: "Auth",
  models: "Modelos",
  chat: "Chat",
  json: "JSON",
  tools: "Tools",
};

function StageDot({ ok }: { ok?: boolean }) {
  if (ok === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (ok === false) return <AlertCircle className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-muted-foreground/40" />;
}

export function HealthCheckPanel({
  results,
  loading,
  onRun,
  onClose,
}: HealthCheckPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const okCount = results.filter(
    (r) => !r.error && r.diagnostics?.overall === "ok",
  ).length;
  const errorCount = results.length - okCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-border/50 bg-card/40 overflow-hidden"
    >
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Health Check
            </h3>
            <p className="text-xs text-muted-foreground">
              {results.length > 0 ? (
                <span className="text-emerald-400">{okCount} OK</span>
              ) : (
                <span>Clique para testar todas as conexões</span>
              )}
              {errorCount > 0 && (
                <span className="text-red-400 ml-2">{errorCount} erro(s)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onRun}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Activity className="w-3 h-3" />
            )}
            {loading ? "Executando..." : "Executar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left px-2 py-1.5 font-medium">
                      Conexão
                    </th>
                    {STAGE_ORDER.map((s) => (
                      <th
                        key={s}
                        className="text-center px-2 py-1.5 font-medium w-16"
                      >
                        {STAGE_LABELS[s]}
                      </th>
                    ))}
                    <th className="text-left px-2 py-1.5 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const isExpanded = expandedId === r.connectionId;
                    const stageMap = new Map(
                      r.diagnostics?.results.map((res) => [
                        res.stage,
                        res.ok,
                      ]) || [],
                    );

                    return (
                      <>
                        <tr
                          key={r.connectionId}
                          className="border-b border-border/20 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : r.connectionId)
                          }
                        >
                          <td className="px-2 py-2">
                            <div>
                              <p className="font-medium text-foreground">
                                {r.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {r.provider}
                              </p>
                            </div>
                          </td>
                          {STAGE_ORDER.map((s) => (
                            <td key={s} className="px-2 py-2 text-center">
                              <StageDot ok={stageMap.get(s)} />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            {r.error ? (
                              <span className="text-red-400">Erro</span>
                            ) : r.diagnostics?.overall === "ok" ? (
                              <span className="text-emerald-400">OK</span>
                            ) : r.diagnostics?.overall === "warning" ? (
                              <span className="text-amber-400">Atenção</span>
                            ) : (
                              <span className="text-red-400">Falha</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && r.diagnostics && (
                          <tr>
                            <td colSpan={8} className="px-2 py-2">
                              <div className="rounded-lg bg-muted/20 p-2 space-y-1">
                                {r.diagnostics.results.map((res) => (
                                  <div
                                    key={res.stage}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <StageDot ok={res.ok} />
                                    <span className="text-muted-foreground">
                                      {STAGE_LABELS[res.stage]}:
                                    </span>
                                    <span
                                      className={
                                        res.ok
                                          ? "text-emerald-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {res.message}
                                    </span>
                                    <span className="text-muted-foreground/60 ml-auto">
                                      {res.latencyMs}ms
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
