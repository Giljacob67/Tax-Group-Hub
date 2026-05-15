import { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, AlertCircle, CheckCircle2, WifiOff, Box, Cloud, Cpu, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProviderMeta, LlmConnection, ProviderCardStatus } from "./types";

interface ProviderGridProps {
  providers: ProviderMeta[];
  connections: LlmConnection[];
  onSelectProvider: (provider: ProviderMeta | null) => void;
  onNewConnection: (providerId?: string) => void;
}

function getProviderStatus(provider: ProviderMeta, conns: LlmConnection[]): ProviderCardStatus {
  const providerConns = conns.filter((c) => c.provider === provider.id);
  if (providerConns.length === 0) return "unconfigured";
  const hasError = providerConns.some((c) => c.lastTestStatus === "error");
  const hasOk = providerConns.some((c) => c.lastTestStatus === "ok");
  const allOffline = providerConns.every((c) => c.lastTestStatus === "error");
  if (allOffline) return "offline";
  if (hasError) return "attention_required";
  if (hasOk) return "online";
  return "unconfigured";
}

const STATUS_CONFIG: Record<ProviderCardStatus, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  online: { label: "Online", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  unconfigured: { label: "Não configurado", icon: Box, color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border/30" },
  error: { label: "Erro", icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  offline: { label: "Offline", icon: WifiOff, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  no_models: { label: "Sem modelos", icon: Box, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  attention_required: { label: "Requer atenção", icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

const TAG_CONFIG: Record<string, { label: string; icon: typeof Cloud; color: string }> = {
  cloud: { label: "Cloud", icon: Cloud, color: "text-sky-400 bg-sky-500/10" },
  local: { label: "Local", icon: Cpu, color: "text-emerald-400 bg-emerald-500/10" },
  compatible: { label: "Compatível OpenAI", icon: Plug, color: "text-purple-400 bg-purple-500/10" },
};

export function ProviderGrid({ providers, connections, onSelectProvider, onNewConnection }: ProviderGridProps) {
  const providerStats = useMemo(() => {
    return providers.map((p) => {
      const conns = connections.filter((c) => c.provider === p.id);
      const status = getProviderStatus(p, connections);
      const defaultConn = conns.find((c) => c.isDefault);
      return { provider: p, conns, status, defaultConn };
    });
  }, [providers, connections]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {providerStats.map(({ provider, conns, status, defaultConn }) => {
        const cfg = STATUS_CONFIG[status];
        const StatusIcon = cfg.icon;
        const tag = provider.tag ? TAG_CONFIG[provider.tag] : null;

        return (
          <motion.div
            key={provider.id}
            whileHover={{ y: -2 }}
            className={`relative rounded-xl border ${cfg.border} ${cfg.bg} p-4 cursor-pointer transition-colors hover:bg-opacity-20`}
            onClick={() => onSelectProvider(provider)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{provider.icon}</span>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{provider.name}</h4>
                  <p className="text-xs text-muted-foreground">{provider.label}</p>
                </div>
              </div>
              {tag && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${tag.color}`}>
                  <tag.icon className="w-3 h-3" />
                  {tag.label}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                {conns.length > 0 ? (
                  <span>{conns.length} conexão{conns.length > 1 ? "ões" : ""}</span>
                ) : (
                  <span>Sem conexões</span>
                )}
              </div>

              {defaultConn && (
                <div className="text-xs text-foreground truncate">
                  Padrão: <span className="font-medium">{defaultConn.modelId}</span>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 h-7 text-xs gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onNewConnection(provider.id);
              }}
            >
              <Plus className="w-3 h-3" />
              {conns.length > 0 ? "Nova conexão" : "Conectar"}
            </Button>
          </motion.div>
        );
      })}

      {/* All providers card */}
      <motion.div
        whileHover={{ y: -2 }}
        className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-4 cursor-pointer hover:bg-muted/20 transition-colors flex flex-col items-center justify-center gap-2 text-center"
        onClick={() => onSelectProvider(null)}
      >
        <span className="text-2xl text-muted-foreground">🔍</span>
        <div>
          <h4 className="text-sm font-medium text-foreground">Todos os provedores</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Ver todas as conexões</p>
        </div>
      </motion.div>
    </div>
  );
}
