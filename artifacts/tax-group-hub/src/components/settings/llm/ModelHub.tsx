import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ProviderSidebar from "./ProviderSidebar";
import ModelCatalog from "./ModelCatalog";
import ConnectionWizard from "./ConnectionWizard";
import ProfileManager from "./ProfileManager";
import type { ProviderMeta, LlmConnection, LlmProfile } from "./types";

export default function ModelHub() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [connections, setConnections] = useState<LlmConnection[]>([]);
  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderMeta | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [healthRunning, setHealthRunning] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, profRes] = await Promise.all([
        fetch("/api/llm/providers"),
        fetch("/api/llm/connections"),
        fetch("/api/llm/profiles"),
      ]);
      if (pRes.ok) {
        const d = await pRes.json();
        setProviders(d.providers || []);
      }
      if (cRes.ok) {
        const d = await cRes.json();
        setConnections(d.connections || []);
      }
      if (profRes.ok) {
        const d = await profRes.json();
        setProfiles(d.profiles || []);
      }
    } catch {
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleTest(id: number) {
    setTestingId(id);
    try {
      const r = await fetch(`/api/llm/connections/${id}/test`, { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        toast({ title: "Conexão OK", description: `${data.provider} · ${data.model}` });
      } else {
        toast({ title: "Falha na conexão", description: data.error || "Erro desconhecido", variant: "destructive" });
      }
      fetchAll();
    } catch {
      toast({ title: "Erro ao testar", variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  }

  async function handleActivate(id: number) {
    try {
      const r = await fetch(`/api/llm/connections/${id}/activate`, { method: "POST" });
      if (!r.ok) throw new Error();
      toast({ title: "Conexão ativada como padrão" });
      fetchAll();
    } catch {
      toast({ title: "Erro ao ativar", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem certeza que deseja remover esta conexão?")) return;
    try {
      const r = await fetch(`/api/llm/connections/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast({ title: "Conexão removida" });
      fetchAll();
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  }

  async function handleHealthCheck() {
    setHealthRunning(true);
    try {
      const r = await fetch("/api/llm/health-check", { method: "POST" });
      const data = await r.json();
      const ok = data.results?.filter((x: any) => x.status === "ok").length || 0;
      const err = data.results?.filter((x: any) => x.status === "error").length || 0;
      toast({ title: `Health check: ${ok} OK, ${err} erro(s)` });
      fetchAll();
    } catch {
      toast({ title: "Erro no health check", variant: "destructive" });
    } finally {
      setHealthRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b border-border/30 flex items-center justify-between px-4 bg-background/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Model Hub</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/30 text-muted-foreground">
            {connections.length} conex{connections.length === 1 ? "ão" : "ões"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-8"
            onClick={handleHealthCheck}
            disabled={healthRunning || connections.length === 0}
          >
            {healthRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Health Check
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <ProviderSidebar
          providers={providers}
          connections={connections}
          onSelectProvider={setSelectedProvider}
          onRefresh={fetchAll}
          onNewConnection={() => setShowWizard(true)}
          loading={loading}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-background/30">
            <ModelHubTab id="connections" label="Conexões" active />
            <ModelHubTab id="profiles" label="Perfis" />
          </div>

          <div className="flex-1 overflow-hidden">
            <motion.div
              key="connections"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full"
            >
              <ModelCatalog
                connections={connections}
                providers={providers}
                selectedProvider={selectedProvider}
                onTest={handleTest}
                onActivate={handleActivate}
                onDelete={handleDelete}
                testingId={testingId}
              />
            </motion.div>
          </div>
        </div>

        {/* Right panel: Profiles quick view */}
        <div className="w-72 flex-shrink-0 border-l border-border/30 bg-background/30 overflow-y-auto p-4">
          <ProfileManager profiles={profiles} connections={connections} onRefresh={fetchAll} />
        </div>
      </div>

      {/* Security note */}
      <div className="px-4 py-2 border-t border-border/30 bg-background/50 flex items-center gap-2 text-[11px] text-muted-foreground/60">
        <Shield className="w-3 h-3" />
        <span>Chaves armazenadas com criptografia AES-256-GCM. Nenhuma chave é enviada ao frontend.</span>
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <ConnectionWizard
          providers={providers}
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

function ModelHubTab({ id, label, active }: { id: string; label: string; active?: boolean }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      }`}
    >
      {label}
    </button>
  );
}
