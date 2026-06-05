import { useState } from "react";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProviderMeta, LlmConnection } from "./types";

interface Props {
  providers: ProviderMeta[];
  connections: LlmConnection[];
  onSelectProvider: (p: ProviderMeta | null) => void;
  onRefresh: () => void;
  onNewConnection: () => void;
  loading: boolean;
}

export default function ProviderSidebar({
  providers,
  connections,
  onSelectProvider,
  onRefresh,
  onNewConnection,
  loading,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const counts = (pid: string) =>
    connections.filter((c) => c.provider === pid).length;
  const okCount = (pid: string) =>
    connections.filter((c) => c.provider === pid && c.lastTestStatus === "ok")
      .length;

  return (
    <div className="w-full lg:w-60 flex-shrink-0 border-r border-border/30 bg-background/50 flex flex-col h-full">
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            Conectores
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <Button
          size="sm"
          className="w-full text-xs gap-1.5"
          onClick={onNewConnection}
        >
          <Plus className="w-3.5 h-3.5" /> Nova Conexão
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <button
          onClick={() => {
            setSelected(null);
            onSelectProvider(null);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
            selected === null
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          <span className="text-base leading-none">⊞</span>
          <span className="flex-1">Todos</span>
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
            {connections.length}
          </span>
        </button>

        {providers.map((p) => {
          const c = counts(p.id);
          const ok = okCount(p.id);
          const isSel = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p.id);
                onSelectProvider(p);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isSel
                  ? `bg-card border ring-1 ${p.ring} text-foreground shadow-sm`
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <span className={`text-base leading-none ${p.color}`}>
                {p.icon}
              </span>
              <span className="flex-1 truncate">{p.name}</span>
              {c > 0 && (
                <span className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${ok > 0 ? "bg-emerald-400" : "bg-amber-400"}`}
                  />
                  <span className="text-xs text-muted-foreground">{c}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
