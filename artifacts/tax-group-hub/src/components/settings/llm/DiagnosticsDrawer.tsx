import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { LlmConnection, DiagnosticResult } from "./types";

interface DiagnosticsDrawerProps {
  connection: LlmConnection | null;
  diagnostics: { results: DiagnosticResult[]; overall: string } | null;
  onClose: () => void;
  onRetest: (conn: LlmConnection) => void;
}

function StageRow({ result }: { result: DiagnosticResult }) {
  const [showDetails, setShowDetails] = useState(false);

  const stageLabels: Record<string, string> = {
    auth: "Autenticação",
    models: "Listagem de modelos",
    chat: "Chat básico",
    json: "JSON mode",
    tools: "Function calling",
  };

  return (
    <div
      className={`rounded-lg border p-3 ${result.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {result.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {stageLabels[result.stage] || result.stage}
            </p>
            <p
              className={`text-xs mt-0.5 ${result.ok ? "text-emerald-400/80" : "text-red-400/80"}`}
            >
              {result.message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {result.latencyMs}ms
          </span>
          {result.technicalDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {!result.ok && result.userMessage && (
        <div className="mt-2 text-xs text-foreground/80 bg-background/50 rounded px-2 py-1.5 border border-border/30">
          <span className="font-medium">Diagnóstico:</span> {result.userMessage}
        </div>
      )}

      {!result.ok && result.howToFix && (
        <div className="mt-1.5 text-xs text-amber-400/90 bg-amber-500/5 rounded px-2 py-1.5 border border-amber-500/15">
          <span className="font-medium">Como corrigir:</span> {result.howToFix}
        </div>
      )}

      <AnimatePresence>
        {showDetails && result.technicalDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="mt-2 text-[11px] text-muted-foreground bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">
              {result.technicalDetails}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DiagnosticsDrawer({
  connection,
  diagnostics,
  onClose,
  onRetest,
}: DiagnosticsDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!connection || !diagnostics) return null;

  const handleCopy = () => {
    const text = diagnostics.results
      .map(
        (r) =>
          `[${r.ok ? "OK" : "FAIL"}] ${r.stage}: ${r.message}\n${r.userMessage || ""}\n${r.howToFix || ""}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/50 p-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Diagnóstico
            </h3>
            <p className="text-xs text-muted-foreground">{connection.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleCopy}
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => onRetest(connection)}
            >
              <RefreshCw className="w-3 h-3" />
              Retestar
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

        <div className="p-4 space-y-3">
          <div
            className={`rounded-lg border p-3 ${diagnostics.overall === "ok" ? "border-emerald-500/20 bg-emerald-500/5" : diagnostics.overall === "warning" ? "border-amber-500/20 bg-amber-500/5" : "border-red-500/20 bg-red-500/5"}`}
          >
            <div className="flex items-center gap-2">
              {diagnostics.overall === "ok" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {diagnostics.overall === "ok"
                    ? "Tudo certo"
                    : diagnostics.overall === "warning"
                      ? "Atenção necessária"
                      : "Problemas encontrados"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {diagnostics.results.filter((r) => r.ok).length} de{" "}
                  {diagnostics.results.length} etapas OK
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {diagnostics.results.map((result, i) => (
              <StageRow key={`${result.stage}-${i}`} result={result} />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
