import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Plus,
  RefreshCw,
  Loader2,
  Wifi,
  AlertTriangle,
  Star,
  Settings2,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ProviderGrid } from "./ProviderGrid";
import { ConnectionTable } from "./ConnectionTable";
import { DiagnosticsDrawer } from "./DiagnosticsDrawer";
import { HealthCheckPanel } from "./HealthCheckPanel";
import { ProfileMatrix } from "./ProfileMatrix";
import { ConnectionWizardV2 } from "./ConnectionWizardV2";
import EditConnectionModal from "./EditConnectionModal";
import type {
  ProviderMeta,
  LlmConnection,
  LlmProfile,
  DiagnosticResult,
  HealthCheckResult,
} from "./types";
import {
  useListLlmProviders,
  useListStaticLlmModels,
  useListLlmConnections,
  useListLlmProfiles,
  useLlmHealthCheck,
  useCreateLlmProfile,
  useActivateLlmConnection,
  useDeleteLlmConnection,
  useActivateLlmProfile,
  useDeleteLlmProfile,
  getListLlmProvidersQueryKey,
  getListStaticLlmModelsQueryKey,
  getListLlmConnectionsQueryKey,
  getListLlmProfilesQueryKey,
} from "@workspace/api-client-react";

export default function ModelHub() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<ProviderMeta | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"connections" | "profiles">(
    "connections",
  );
  const [showWizard, setShowWizard] = useState(false);
  const [wizardProviderId, setWizardProviderId] = useState<
    string | undefined
  >();
  const [editingConnection, setEditingConnection] =
    useState<LlmConnection | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [healthResults, setHealthResults] = useState<HealthCheckResult[]>([]);
  const [showHealth, setShowHealth] = useState(false);
  const [diagnosticsMap, setDiagnosticsMap] = useState<
    Map<number, { results: DiagnosticResult[]; overall: string }>
  >(new Map());
  const [diagConnection, setDiagConnection] = useState<LlmConnection | null>(
    null,
  );

  const { data: providersData, isLoading: loadingProviders } =
    useListLlmProviders();
  const { data: staticModelsData, isLoading: loadingStaticModels } =
    useListStaticLlmModels();
  const { data: connectionsData, isLoading: loadingConnections } =
    useListLlmConnections();
  const { data: profilesData, isLoading: loadingProfiles } =
    useListLlmProfiles();

  const providers: ProviderMeta[] =
    (providersData?.providers as ProviderMeta[]) || [];
  const staticModels: {
    id: string;
    name: string;
    provider: string;
    description?: string;
    tag?: string;
  }[] = (staticModelsData?.models as any) || [];
  const connections: LlmConnection[] =
    (connectionsData?.connections as unknown as LlmConnection[]) || [];
  const profiles: LlmProfile[] =
    (profilesData?.profiles as unknown as LlmProfile[]) || [];
  const loading =
    loadingProviders ||
    loadingStaticModels ||
    loadingConnections ||
    loadingProfiles;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListLlmProvidersQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getListStaticLlmModelsQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getListLlmConnectionsQueryKey(),
    });
    queryClient.invalidateQueries({ queryKey: getListLlmProfilesQueryKey() });
  };

  const healthCheckMutate = useLlmHealthCheck({
    mutation: {
      onSuccess: (data) => {
        const results = (data as any).results || [];
        setHealthResults(results);
        const newMap = new Map(diagnosticsMap);
        (results as HealthCheckResult[]).forEach((r) => {
          if (r.diagnostics) newMap.set(r.connectionId, r.diagnostics);
        });
        setDiagnosticsMap(newMap);
        const okCount = results.filter(
          (r: HealthCheckResult) => !r.error && r.diagnostics?.overall === "ok",
        ).length;
        toast({
          title: `Health check: ${okCount} OK, ${results.length - okCount} erro(s)`,
        });
      },
      onError: () => {
        toast({ title: "Erro no health check", variant: "destructive" });
      },
    },
  });

  const createProfileMutate = useCreateLlmProfile({
    mutation: {
      onSuccess: () => {
        toast({ title: "Perfil criado" });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Erro ao criar perfil", variant: "destructive" });
      },
    },
  });

  const activateConnMutate = useActivateLlmConnection({
    mutation: {
      onSuccess: () => {
        toast({ title: "Conexão ativada como padrão" });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Erro ao ativar", variant: "destructive" });
      },
    },
  });

  const deleteConnMutate = useDeleteLlmConnection({
    mutation: {
      onSuccess: () => {
        toast({ title: "Conexão removida" });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Erro ao remover", variant: "destructive" });
      },
    },
  });

  const activateProfileMutate = useActivateLlmProfile({
    mutation: {
      onSuccess: () => {
        toast({ title: "Perfil ativado" });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Erro ao ativar perfil", variant: "destructive" });
      },
    },
  });

  const deleteProfileMutate = useDeleteLlmProfile({
    mutation: {
      onSuccess: () => {
        toast({ title: "Perfil removido" });
        invalidateAll();
      },
      onError: () => {
        toast({ title: "Erro ao remover perfil", variant: "destructive" });
      },
    },
  });

  const handleTest = async (conn: LlmConnection) => {
    setTestingId(conn.id);
    try {
      const res = await fetch(`/api/llm/connections/${conn.id}/diagnostics`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.diagnostics) {
        setDiagnosticsMap((prev) =>
          new Map(prev).set(conn.id, data.diagnostics),
        );
        toast({
          title:
            data.diagnostics.overall === "ok"
              ? "Conexão OK"
              : "Problemas detectados",
          description:
            data.diagnostics.results.find((r: DiagnosticResult) => !r.ok)
              ?.userMessage || "Todas as etapas passaram.",
          variant:
            data.diagnostics.overall === "ok" ? "default" : "destructive",
        });
      }
    } catch {
      toast({ title: "Erro ao testar conexão", variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const handleActivate = (conn: LlmConnection) => {
    activateConnMutate.mutate({ id: conn.id });
  };

  const handleDelete = (conn: LlmConnection) => {
    if (!window.confirm(`Remover conexão "${conn.name}"?`)) return;
    deleteConnMutate.mutate({ id: conn.id });
  };

  const handleHealthCheck = () => {
    setShowHealth(true);
    healthCheckMutate.mutate();
  };

  const handleProfileCreate = (
    profile: Omit<LlmProfile, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => {
    createProfileMutate.mutate({ data: profile as any });
  };

  const handleProfileActivate = (id: number) => {
    activateProfileMutate.mutate({ id });
  };

  const handleProfileDelete = (id: number) => {
    if (!window.confirm("Remover perfil? Esta ação não pode ser desfeita."))
      return;
    deleteProfileMutate.mutate({ id });
  };

  // Stats
  const connectedProviders = new Set(connections.map((c) => c.provider)).size;
  const onlineConns = connections.filter(
    (c) => c.lastTestStatus === "ok",
  ).length;
  const defaultConn = connections.find((c) => c.isDefault);
  const errorConns = connections.filter(
    (c) => c.lastTestStatus === "error",
  ).length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            Carregando Central de Modelos...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Central de Modelos IA
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte provedores, valide modelos e defina perfis para os agentes
              da Tax Group.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={handleHealthCheck}
              disabled={healthCheckMutate.isPending}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {healthCheckMutate.isPending ? "Verificando..." : "Health Check"}
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setWizardProviderId(undefined);
                setShowWizard(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nova conexão
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Provedores</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {connectedProviders}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / {providers.length}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">
                Conexões online
              </span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {onlineConns}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / {connections.length}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-muted-foreground">
                Modelo padrão
              </span>
            </div>
            <p className="text-sm font-bold text-foreground truncate">
              {defaultConn?.modelId || "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle
                className={`w-3.5 h-3.5 ${errorConns > 0 ? "text-red-400" : "text-muted-foreground"}`}
              />
              <span className="text-xs text-muted-foreground">
                Erros pendentes
              </span>
            </div>
            <p
              className={`text-lg font-bold ${errorConns > 0 ? "text-red-400" : "text-foreground"}`}
            >
              {errorConns}
            </p>
          </div>
        </div>

        {/* Health Check Panel */}
        <AnimatePresence>
          {showHealth && (
            <HealthCheckPanel
              results={healthResults}
              loading={healthCheckMutate.isPending}
              onRun={handleHealthCheck}
              onClose={() => setShowHealth(false)}
            />
          )}
        </AnimatePresence>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="connections" className="text-xs h-7 gap-1">
              <Settings2 className="w-3 h-3" />
              Conexões
            </TabsTrigger>
            <TabsTrigger value="profiles" className="text-xs h-7 gap-1">
              <Star className="w-3 h-3" />
              Perfis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="mt-4 space-y-4">
            <ProviderGrid
              providers={providers}
              connections={connections}
              onSelectProvider={setSelectedProvider}
              onNewConnection={(id) => {
                setWizardProviderId(id);
                setShowWizard(true);
              }}
            />

            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedProvider
                    ? `Conexões: ${selectedProvider.name}`
                    : "Todas as conexões"}
                </h3>
                {selectedProvider && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setSelectedProvider(null)}
                  >
                    Ver todas
                  </Button>
                )}
              </div>
              <ConnectionTable
                connections={connections}
                providers={providers}
                selectedProvider={selectedProvider}
                testingId={testingId}
                diagnosticsMap={diagnosticsMap}
                onTest={handleTest}
                onActivate={handleActivate}
                onDelete={handleDelete}
                onEdit={setEditingConnection}
                onShowDiagnostics={(conn) => {
                  setDiagConnection(conn);
                  if (!diagnosticsMap.has(conn.id)) {
                    handleTest(conn);
                  }
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="profiles" className="mt-4">
            <ProfileMatrix
              profiles={profiles}
              connections={connections}
              onCreate={handleProfileCreate}
              onActivate={handleProfileActivate}
              onDelete={handleProfileDelete}
            />
          </TabsContent>
        </Tabs>

        {/* Security note */}
        <div className="text-center text-[11px] text-muted-foreground/60 pt-4 pb-2">
          🔒 Chaves API armazenadas com criptografia AES-256-GCM. Nunca expostas
          no frontend.
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showWizard && (
          <ConnectionWizardV2
            providers={providers}
            staticModels={staticModels}
            initialProviderId={wizardProviderId}
            onClose={() => setShowWizard(false)}
            onCreated={invalidateAll}
          />
        )}
      </AnimatePresence>

      {editingConnection && (
        <EditConnectionModal
          connection={editingConnection}
          providers={providers}
          onClose={() => setEditingConnection(null)}
          onSaved={invalidateAll}
        />
      )}

      <DiagnosticsDrawer
        connection={diagConnection}
        diagnostics={
          diagConnection ? diagnosticsMap.get(diagConnection.id) || null : null
        }
        onClose={() => setDiagConnection(null)}
        onRetest={handleTest}
      />
    </div>
  );
}
