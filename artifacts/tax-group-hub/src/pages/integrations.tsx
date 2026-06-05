import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  Link2,
  Sparkles,
  PenTool,
  Loader2,
  Plus,
  Activity,
  Zap,
  Webhook,
  FileText,
  Key,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  X,
  LayoutGrid,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Settings,
  Send,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useGenerateImage,
  useGetCanvaLink,
  useGetCustomKeys,
  useSetCustomKey,
  useDeleteCustomKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  INTEGRATIONS_CATALOG,
  INTEGRATION_CATEGORIES,
  AUTOMATION_RECIPES,
  WEBHOOK_EVENTS,
  IMAGE_PRESETS,
  CANVA_TEMPLATES,
  type IntegrationCategory,
  type IntegrationStatus,
} from "@/lib/integrations-catalog";

// ── API types ──────────────────────────────────────────────────────────────

interface IntegrationHealthEntry {
  key: string;
  name: string;
  category: string;
  isRealIntegration: boolean;
  status: "connected" | "available" | "coming_soon" | "error";
  configured: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  logCount: number;
}

interface HealthSummary {
  connected: number;
  errors: number;
  lastRun: string | null;
}

interface HealthResponse {
  integrations: IntegrationHealthEntry[];
  summary: HealthSummary;
}

interface IntegrationLogEntry {
  id: number;
  userId: string | null;
  integrationKey: string;
  integrationName: string;
  eventType: string;
  direction: "inbound" | "outbound";
  status: "success" | "error" | "pending" | "ignored";
  durationMs: number | null;
  httpStatus: number | null;
  requestUrl: string | null;
  requestMethod: string | null;
  payloadPreview: string | null;
  errorMessage: string | null;
  technicalDetails: string | null;
  correlationId: string;
  createdAt: string;
}

interface LogsResponse {
  logs: IntegrationLogEntry[];
  total: number;
}

interface MakeConfig {
  webhookUrl: string;
  hasSecret: boolean;
  enabled: boolean;
  environment: string;
  description: string;
  configured: boolean;
}

interface MakeConfigResponse {
  config: MakeConfig;
}

interface TestResult {
  ok: boolean;
  correlationId: string;
  durationMs: number;
  httpStatus?: number;
  errorMessage?: string;
  errorCode?: string;
}

// ── API fetch helpers ──────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ message: r.statusText }));
    throw new Error((err as { message?: string }).message ?? r.statusText);
  }
  return r.json() as Promise<T>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(
  status: IntegrationStatus | IntegrationHealthEntry["status"],
) {
  if (status === "connected")
    return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (status === "error") return "text-red-400 bg-red-400/10 border-red-400/20";
  if (status === "available")
    return "text-muted-foreground bg-muted/50 border-border";
  return "text-muted-foreground bg-muted/30 border-border";
}

function statusLabel(status: string) {
  if (status === "connected") return "Conectada";
  if (status === "error") return "Erro";
  if (status === "available") return "Disponível";
  return "Em breve";
}

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function integrationEmoji(key: string): string {
  const map: Record<string, string> = {
    make: "⚙️",
    webhooks: "🔗",
    whatsapp: "💬",
    telegram: "✈️",
    canva: "🎨",
    "gemini-images": "✨",
    openai: "🤖",
    anthropic: "🧠",
  };
  return map[key] ?? "🔌";
}

// ── Sub-components ─────────────────────────────────────────────────────────

function HealthCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums leading-tight">
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && (
          <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationCard({
  entry,
  onCta,
}: {
  entry: (typeof INTEGRATIONS_CATALOG)[0];
  onCta: (id: string) => void;
}) {
  const isComingSoon = entry.status === "coming_soon";
  return (
    <div
      className={`bg-card border border-border rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-border/80 ${isComingSoon ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{entry.emoji}</span>
          <div>
            <div className="font-semibold text-sm leading-tight">
              {entry.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {entry.category}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor(entry.status)}`}
          >
            {statusLabel(entry.status)}
          </span>
          {entry.badge && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
              {entry.badge}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">
        {entry.description}
      </p>
      <div className="flex flex-wrap gap-1">
        {entry.tags.map((t) => (
          <span
            key={t}
            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>
      <button
        onClick={() => !isComingSoon && onCta(entry.id)}
        disabled={isComingSoon}
        className={`mt-1 w-full py-2 rounded-lg text-xs font-medium transition-all ${
          isComingSoon
            ? "bg-secondary text-muted-foreground cursor-not-allowed"
            : entry.status === "connected"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
        }`}
      >
        {entry.ctaLabel}
      </button>
    </div>
  );
}

/** Inline log detail panel */
function LogDetailPanel({
  log,
  onClose,
}: {
  log: IntegrationLogEntry;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const diag = JSON.stringify(
    {
      id: log.id,
      integration: log.integrationName,
      event: log.eventType,
      direction: log.direction,
      status: log.status,
      httpStatus: log.httpStatus,
      durationMs: log.durationMs,
      correlationId: log.correlationId,
      errorMessage: log.errorMessage,
      errorCode: log.technicalDetails,
      url: log.requestUrl,
      timestamp: log.createdAt,
    },
    null,
    2,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="bg-card border border-border rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {integrationEmoji(log.integrationKey)}
          </span>
          <div>
            <div className="font-semibold text-sm">{log.integrationName}</div>
            <code className="text-[10px] font-mono text-muted-foreground">
              {log.correlationId}
            </code>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        {[
          { label: "Status", value: log.status },
          { label: "HTTP", value: log.httpStatus ?? "–" },
          {
            label: "Duração",
            value: log.durationMs ? `${log.durationMs}ms` : "–",
          },
          { label: "Direção", value: log.direction },
          { label: "Método", value: log.requestMethod ?? "POST" },
          { label: "Data/Hora", value: formatTs(log.createdAt) },
        ].map((f) => (
          <div key={f.label} className="bg-secondary/50 rounded-lg p-2">
            <div className="text-muted-foreground mb-0.5">{f.label}</div>
            <div className="font-medium">{String(f.value)}</div>
          </div>
        ))}
      </div>

      {log.requestUrl && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            URL (mascarada)
          </div>
          <code className="text-xs font-mono bg-background border border-border rounded px-2 py-1.5 block truncate">
            {log.requestUrl}
          </code>
        </div>
      )}

      {log.errorMessage && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">Erro</span>
            {log.technicalDetails && (
              <code className="text-[10px] font-mono text-red-400/60 ml-auto">
                {log.technicalDetails}
              </code>
            )}
          </div>
          <p className="text-xs text-red-300/80">{log.errorMessage}</p>
        </div>
      )}

      {log.payloadPreview && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Payload (preview)
          </div>
          <pre className="text-[10px] font-mono bg-background border border-border rounded p-2 overflow-x-auto max-h-32 text-muted-foreground">
            {log.payloadPreview}
          </pre>
        </div>
      )}

      <button
        onClick={() => {
          navigator.clipboard.writeText(diag);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="w-full py-2 rounded-lg border border-border hover:bg-secondary text-xs flex items-center justify-center gap-2 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" /> Copiar diagnóstico
          </>
        )}
      </button>
    </motion.div>
  );
}

/** Make.com configuration panel */
function MakeConfigPanel({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: configData, isLoading } = useQuery<MakeConfigResponse>({
    queryKey: ["make-config"],
    queryFn: () =>
      apiFetch<MakeConfigResponse>("/api/integrations/make/config"),
  });

  const [webhookUrl, setWebhookUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [environment, setEnvironment] = useState("production");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [secretDirty, setSecretDirty] = useState(false);

  // Sync form from server data once loaded
  const [synced, setSynced] = useState(false);
  if (configData && !synced) {
    setEnabled(configData.config.enabled);
    setEnvironment(configData.config.environment);
    setSynced(true);
  }

  const saveMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch<{ success: boolean; config: MakeConfig }>(
        "/api/integrations/make/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["make-config"] });
      qc.invalidateQueries({ queryKey: ["integration-health"] });
      toast({ title: "Configuração do Make.com salva" });
      onSuccess?.();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      apiFetch<TestResult>("/api/integrations/make/test", { method: "POST" }),
    onSuccess: (r) => {
      setTestResult(r);
      qc.invalidateQueries({ queryKey: ["integration-logs"] });
      if (r.ok)
        toast({ title: `Teste enviado com sucesso (${r.durationMs}ms)` });
      else
        toast({
          title: "Teste falhou",
          description: r.errorMessage,
          variant: "destructive",
        });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { enabled, environment };
    if (webhookUrl.trim()) body.webhookUrl = webhookUrl.trim();
    if (secretDirty && secret) body.secret = secret;
    saveMutation.mutate(body);
  };

  if (isLoading)
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
        Carregando...
      </div>
    );

  const configured = configData?.config.configured;

  return (
    <div className="space-y-4">
      {configured && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Make.com configurado. URL mascarada:{" "}
          <code className="font-mono ml-1 opacity-80">
            {configData?.config.webhookUrl}
          </code>
          {configData?.config.hasSecret && (
            <span className="ml-2 opacity-60">• Secret configurado</span>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            URL do Webhook Make.com
          </label>
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={
              configured
                ? "Deixe em branco para manter a URL atual"
                : "https://hook.eu1.make.com/..."
            }
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
            autoComplete="off"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Cole a URL do módulo Webhook em seu cenário Make.com.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Secret HMAC{" "}
            {configData?.config.hasSecret ? (
              <span className="text-emerald-400">(configurado)</span>
            ) : (
              "(opcional)"
            )}
          </label>
          <input
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value);
              setSecretDirty(true);
            }}
            placeholder={
              configData?.config.hasSecret
                ? "Deixe em branco para manter o secret atual"
                : "Secret para assinar payloads (opcional)"
            }
            type="password"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
            autoComplete="new-password"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Se configurado, payloads são assinados com HMAC-SHA256 no header{" "}
            <code>X-TaxGroup-Signature</code>.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium">Integração ativa</div>
            <div className="text-[10px] text-muted-foreground">
              Disparar eventos para Make.com
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Ambiente
          </label>
          <div className="flex gap-2">
            {["production", "demo"].map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setEnvironment(env)}
                className={`flex-1 py-2 rounded-lg border text-xs transition-all ${environment === env ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-muted-foreground"}`}
              >
                {env === "production" ? "Produção" : "Demo / Teste"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Salvar configuração
          </button>
          <button
            type="button"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !configured}
            title={
              !configured
                ? "Configure a URL primeiro"
                : "Enviar evento de teste"
            }
            className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50 flex items-center gap-2 transition-all"
          >
            {testMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Testar
          </button>
        </div>
      </form>

      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-lg p-3 text-xs ${testResult.ok ? "bg-emerald-500/8 border border-emerald-500/20" : "bg-red-500/8 border border-red-500/20"}`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {testResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              <span
                className={
                  testResult.ok
                    ? "text-emerald-400 font-medium"
                    : "text-red-400 font-medium"
                }
              >
                {testResult.ok ? "Teste enviado com sucesso" : "Teste falhou"}
              </span>
              <code className="ml-auto font-mono opacity-60">
                {testResult.durationMs}ms
              </code>
            </div>
            {!testResult.ok && testResult.errorMessage && (
              <p className="text-red-300/80 mb-1.5">
                {testResult.errorMessage}
              </p>
            )}
            <div className="flex items-center gap-2 opacity-60">
              <span>correlationId:</span>
              <code className="font-mono text-[10px]">
                {testResult.correlationId}
              </code>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface HubSpotConfig {
  accessToken: string;
  portalId: string;
  enabled: boolean;
  syncDirection: "bidirectional" | "to_hubspot" | "from_hubspot";
  configured: boolean;
  customPropertiesCreated: boolean;
  lastSyncAt: string | null;
}

interface HubSpotConfigResponse {
  config: HubSpotConfig;
}

interface HubSpotTestResponse {
  ok: boolean;
  portalInfo: {
    companyCount: number | null;
    pipelineCount: number | null;
    pipelines?: Array<{ id: string; label: string; stageCount: number }>;
  };
  errors?: {
    company?: string;
    pipeline?: string;
  };
}

interface SetupPropertiesResponse {
  ok: boolean;
  created: string[];
  existing: string[];
  errors: string[];
}

/** HubSpot CRM configuration panel */
function HubSpotConfigPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: configData, isLoading } = useQuery<HubSpotConfigResponse>({
    queryKey: ["hubspot-config"],
    queryFn: () =>
      apiFetch<HubSpotConfigResponse>("/api/integrations/hubspot/config"),
  });

  const [accessToken, setAccessToken] = useState("");
  const [portalId, setPortalId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [syncDirection, setSyncDirection] = useState<
    "bidirectional" | "to_hubspot" | "from_hubspot"
  >("bidirectional");
  const [testResult, setTestResult] = useState<HubSpotTestResponse | null>(
    null,
  );
  const [setupResult, setSetupResult] =
    useState<SetupPropertiesResponse | null>(null);
  const [tokenDirty, setTokenDirty] = useState(false);

  const [synced, setSynced] = useState(false);
  if (configData && !synced) {
    setEnabled(configData.config.enabled);
    setSyncDirection(configData.config.syncDirection);
    if (configData.config.portalId) setPortalId(configData.config.portalId);
    setSynced(true);
  }

  const saveMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch<{ success: boolean; config: HubSpotConfig }>(
        "/api/integrations/hubspot/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hubspot-config"] });
      qc.invalidateQueries({ queryKey: ["integration-health"] });
      toast({ title: "Configuração do HubSpot salva" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      apiFetch<HubSpotTestResponse>("/api/integrations/hubspot/test", {
        method: "POST",
      }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast({ title: "Conectado ao HubSpot com sucesso!" });
      else
        toast({
          title: "Teste falhou",
          description: r.errors?.company ?? r.errors?.pipeline,
          variant: "destructive",
        });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      apiFetch<SetupPropertiesResponse>(
        "/api/integrations/hubspot/setup-custom-properties",
        { method: "POST" },
      ),
    onSuccess: (r) => {
      setSetupResult(r);
      if (r.ok) {
        toast({
          title: `${r.created.length} propriedades criadas, ${r.existing.length} já existiam`,
        });
      } else {
        toast({
          title: `${r.errors.length} erros ao criar propriedades`,
          variant: "destructive",
        });
      }
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { enabled, syncDirection };
    if (tokenDirty && accessToken.trim()) body.accessToken = accessToken.trim();
    if (portalId.trim()) body.portalId = portalId.trim();
    saveMutation.mutate(body);
  };

  if (isLoading)
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
        Carregando...
      </div>
    );

  const configured = configData?.config.configured;
  const directionLabels: Record<string, string> = {
    bidirectional: "Bidirecional (push + pull)",
    to_hubspot: "Somente envio (Tax Group → HubSpot)",
    from_hubspot: "Somente recebimento (HubSpot → Tax Group)",
  };

  return (
    <div className="space-y-4">
      {configured && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          HubSpot configurado
          {configData?.config.portalId && (
            <span className="ml-2 opacity-60">
              • Portal {configData?.config.portalId}
            </span>
          )}
          {configData?.config.lastSyncAt && (
            <span className="ml-2 opacity-60">
              • Último sync:{" "}
              {new Date(configData.config.lastSyncAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Portal ID{" "}
            {configData?.config.portalId ? (
              <span className="text-emerald-400">(configurado)</span>
            ) : (
              ""
            )}
          </label>
          <input
            value={portalId}
            onChange={(e) => setPortalId(e.target.value)}
            placeholder={configData?.config.portalId || "12345678"}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
            autoComplete="off"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Encontre o ID do seu portal em HubSpot → Configurações → Geral.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Access Token{" "}
            {configData?.config.configured ? (
              <span className="text-emerald-400">(configurado)</span>
            ) : (
              ""
            )}
          </label>
          <input
            value={accessToken}
            onChange={(e) => {
              setAccessToken(e.target.value);
              setTokenDirty(true);
            }}
            placeholder={
              configData?.config.configured
                ? "Deixe em branco para manter o token atual"
                : "pat-na1-..."
            }
            type="password"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
            autoComplete="new-password"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Crie um Private App em HubSpot → Configurações → Apps Privadas. O
            token é criptografado.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Direção da Sincronização
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["bidirectional", "to_hubspot", "from_hubspot"] as const).map(
              (dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setSyncDirection(dir)}
                  className={`py-2 rounded-lg border text-xs transition-all ${syncDirection === dir ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {directionLabels[dir]}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium">Sincronização ativa</div>
            <div className="text-[10px] text-muted-foreground">
              {enabled
                ? "Eventos e polling automático ativos"
                : "Sincronização pausada"}
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Salvar configuração
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !configured}
              title={
                !configured
                  ? "Configure o token primeiro"
                  : "Testar conexão com HubSpot"
              }
              className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {testMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Testar Conexão
            </button>
            <button
              type="button"
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending || !configured}
              title={
                !configured
                  ? "Configure o token primeiro"
                  : "Criar propriedades customizadas no HubSpot"
              }
              className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {setupMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Setup Propriedades
            </button>
          </div>
        </div>
      </form>

      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-lg p-3 text-xs ${testResult.ok ? "bg-emerald-500/8 border border-emerald-500/20" : "bg-red-500/8 border border-red-500/20"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span
                className={
                  testResult.ok
                    ? "text-emerald-400 font-medium"
                    : "text-red-400 font-medium"
                }
              >
                {testResult.ok ? "Conectado ao HubSpot" : "Falha na conexão"}
              </span>
            </div>
            {testResult.portalInfo.companyCount !== null && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-background/50 rounded p-2">
                  <div className="text-lg font-semibold text-foreground">
                    {testResult.portalInfo.companyCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Empresas
                  </div>
                </div>
                <div className="bg-background/50 rounded p-2">
                  <div className="text-lg font-semibold text-foreground">
                    {testResult.portalInfo.pipelineCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Pipelines
                  </div>
                </div>
              </div>
            )}
            {testResult.portalInfo.pipelines &&
              testResult.portalInfo.pipelines.length > 0 && (
                <div className="space-y-1 mb-2">
                  <div className="text-[10px] text-muted-foreground">
                    Pipelines encontrados:
                  </div>
                  {testResult.portalInfo.pipelines.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-background/50 rounded px-2 py-1"
                    >
                      <span>{p.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.stageCount} estágios
                      </span>
                    </div>
                  ))}
                </div>
              )}
            {!testResult.ok && testResult.errors && (
              <div className="space-y-1">
                {testResult.errors.company && (
                  <p className="text-red-300/80">
                    Empresas: {testResult.errors.company}
                  </p>
                )}
                {testResult.errors.pipeline && (
                  <p className="text-red-300/80">
                    Pipelines: {testResult.errors.pipeline}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {setupResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-lg p-3 text-xs ${setupResult.ok ? "bg-emerald-500/8 border border-emerald-500/20" : "bg-amber-500/8 border border-amber-500/20"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {setupResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              )}
              <span
                className={
                  setupResult.ok
                    ? "text-emerald-400 font-medium"
                    : "text-amber-400 font-medium"
                }
              >
                {setupResult.ok
                  ? "Propriedades configuradas"
                  : "Configuração parcial"}
              </span>
            </div>
            {setupResult.created.length > 0 && (
              <div className="mb-1">
                <span className="text-emerald-400">
                  Criadas ({setupResult.created.length}):
                </span>{" "}
                <span className="opacity-70">
                  {setupResult.created.join(", ")}
                </span>
              </div>
            )}
            {setupResult.existing.length > 0 && (
              <div className="mb-1">
                <span className="text-muted-foreground">
                  Existentes ({setupResult.existing.length}):
                </span>{" "}
                <span className="opacity-50">
                  {setupResult.existing.join(", ")}
                </span>
              </div>
            )}
            {setupResult.errors.length > 0 && (
              <div>
                <span className="text-red-400">
                  Erros ({setupResult.errors.length}):
                </span>{" "}
                <span className="text-red-300/70">
                  {setupResult.errors.join("; ")}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Como configurar</h3>
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>
            Acesse HubSpot → Configurações → Apps Privadas → Criar app privada
          </li>
          <li>
            Adicione os escopos:{" "}
            <code className="text-[10px] bg-background px-1 rounded">
              crm.objects.contacts.*
            </code>
            ,{" "}
            <code className="text-[10px] bg-background px-1 rounded">
              crm.objects.companies.*
            </code>
            ,{" "}
            <code className="text-[10px] bg-background px-1 rounded">
              crm.objects.deals.*
            </code>
            ,{" "}
            <code className="text-[10px] bg-background px-1 rounded">
              crm.schemas.custom.*
            </code>
          </li>
          <li>Copie o token de acesso e cole aqui</li>
          <li>
            Clique em "Setup Propriedades" para criar os campos customizados
          </li>
          <li>Ative a sincronização e escolha a direção desejada</li>
          <li>A sincronização automática roda a cada 15 minutos (polling)</li>
        </ol>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Integrations() {
  usePageTitle("Central de Integrações");
  const { toast } = useToast();
  const qc = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState("catalogo");

  // Catalog filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    IntegrationCategory | "Todas"
  >("Todas");

  // Image generation
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgPreset, setImgPreset] = useState<string>(IMAGE_PRESETS[0].id);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const imageMutation = useGenerateImage();

  // Canva
  const [canvaTemplate, setCanvaTemplate] = useState<string>(
    CANVA_TEMPLATES[0].id,
  );
  const canvaMutation = useGetCanvaLink();

  // Logs
  const [logFilter, setLogFilter] = useState<"all" | "success" | "error">(
    "all",
  );
  const [selectedLog, setSelectedLog] = useState<IntegrationLogEntry | null>(
    null,
  );

  // Credentials
  const { data: customKeys } = useGetCustomKeys();
  const setKeyMutation = useSetCustomKey();
  const deleteKeyMutation = useDeleteCustomKey();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedProvider, setCopiedProvider] = useState<string | null>(null);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<string | null>(null);

  // Webhooks
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [inboundTestResult, setInboundTestResult] = useState<{
    correlationId: string;
  } | null>(null);

  // ── Real data queries ──────────────────────────────────────────────────

  const healthQuery = useQuery<HealthResponse>({
    queryKey: ["integration-health"],
    queryFn: () => apiFetch<HealthResponse>("/api/integrations/health"),
    refetchInterval: 30_000,
  });

  const logsQuery = useQuery<LogsResponse>({
    queryKey: ["integration-logs", logFilter, activeTab],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (logFilter !== "all") params.set("status", logFilter);
      return apiFetch<LogsResponse>(`/api/integrations/logs?${params}`);
    },
    enabled: activeTab === "logs",
    refetchInterval: activeTab === "logs" ? 15_000 : false,
  });

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgPrompt.trim()) return;
    const preset =
      IMAGE_PRESETS.find((p) => p.id === imgPreset) ?? IMAGE_PRESETS[0];
    try {
      const res = await imageMutation.mutateAsync({
        data: { prompt: imgPrompt, style: preset.style },
      });
      setGeneratedImg(res.imageUrl);
      toast({ title: "Imagem gerada com sucesso" });
    } catch {
      toast({ title: "Falha ao gerar imagem", variant: "destructive" });
    }
  };

  const handleCanvaLink = async () => {
    try {
      const res = await canvaMutation.mutateAsync({
        data: { contentType: canvaTemplate },
      });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Falha ao gerar link do Canva", variant: "destructive" });
    }
  };

  const handleCatalogCta = (id: string) => {
    if (id === "make") {
      setActiveTab("webhooks");
      return;
    }
    if (id === "hubspot") {
      setActiveTab("hubspot");
      return;
    }
    if (id === "google-drive") {
      toast({ description: "Em breve: integração com Google Drive." });
      return;
    }
    toast({
      description: `Configuração de "${id}" disponível em Configurações.`,
    });
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    try {
      await setKeyMutation.mutateAsync({
        data: { provider: newKeyName.trim(), key: newKeyValue.trim() },
      });
      setNewKeyName("");
      setNewKeyValue("");
      setShowNewKey(false);
      toast({ title: "Credencial salva com segurança" });
    } catch {
      toast({ title: "Erro ao salvar credencial", variant: "destructive" });
    }
  };

  const handleDeleteKey = async (provider: string) => {
    setDeleteKeyTarget(provider);
  };

  const handleConfirmDeleteKey = async () => {
    if (deleteKeyTarget) {
      try {
        await deleteKeyMutation.mutateAsync({ provider: deleteKeyTarget });
        toast({ title: "Credencial removida" });
        setDeleteKeyTarget(null);
      } catch {
        toast({ title: "Erro ao remover credencial", variant: "destructive" });
      }
    }
  };

  const handleCopyWebhook = () => {
    const url = `${window.location.origin}/api/integrations/inbound/external`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyPayload = () => {
    const ex = JSON.stringify(
      {
        event: "lead.created",
        source: "external-form",
        payload: {
          companyName: "Empresa Exemplo",
          cnpj: "00.000.000/0001-00",
          segment: "Indústria",
          interest: "RTI",
        },
      },
      null,
      2,
    );
    navigator.clipboard.writeText(ex);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleTestInbound = async () => {
    try {
      const r = await apiFetch<{ ok: boolean; correlationId: string }>(
        "/api/integrations/inbound/test-manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "integration.tested",
            source: "manual-test",
            payload: { message: "Teste manual de inbound webhook" },
          }),
        },
      );
      setInboundTestResult(r);
      qc.invalidateQueries({ queryKey: ["integration-logs"] });
      toast({
        title: "Webhook de teste enviado",
        description: `correlationId: ${r.correlationId}`,
      });
    } catch (e) {
      toast({
        title: "Erro no teste",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────

  const filteredCatalog = useMemo(() => {
    return INTEGRATIONS_CATALOG.filter((e) => {
      const matchCat =
        categoryFilter === "Todas" || e.category === categoryFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q));
      return matchCat && matchSearch;
    });
  }, [search, categoryFilter]);

  const healthData = healthQuery.data;
  const realConnected =
    healthData?.summary.connected ??
    INTEGRATIONS_CATALOG.filter((e) => e.status === "connected").length;
  const realErrors = healthData?.summary.errors ?? 0;
  const activeAutomations = AUTOMATION_RECIPES.filter(
    (r) => r.status === "active",
  ).length;
  const lastRun = healthData?.summary.lastRun;

  const logs = logsQuery.data?.logs ?? [];
  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/inbound/external`;

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Central de Integrações
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Motor operacional: webhooks, automações Make.com, logs e
              credenciais em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                healthQuery.refetch();
                toast({ description: "Status atualizado." });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              <Activity className="w-4 h-4" />{" "}
              {healthQuery.isFetching ? "Verificando..." : "Verificar"}
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <FileText className="w-4 h-4" /> Ver logs
            </button>
          </div>
        </div>

        {/* Health Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <HealthCard
            label="Conectadas"
            value={realConnected}
            icon={CheckCircle2}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <HealthCard
            label="Com erros"
            value={realErrors}
            icon={AlertCircle}
            color={
              realErrors > 0
                ? "bg-red-500/10 text-red-400"
                : "bg-secondary text-muted-foreground"
            }
          />
          <HealthCard
            label="Automações ativas"
            value={activeAutomations}
            icon={Zap}
            color="bg-yellow-500/10 text-yellow-400"
          />
          <HealthCard
            label="Eventos suportados"
            value={WEBHOOK_EVENTS.length}
            icon={Webhook}
            color="bg-blue-500/10 text-blue-400"
          />
          <HealthCard
            label="Último evento"
            value={lastRun ? formatTs(lastRun) : "–"}
            sub={lastRun ? "Registrado nos logs" : "Nenhum evento ainda"}
            icon={Clock}
            color="bg-primary/10 text-primary"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-7 w-full h-auto p-1 bg-card border border-border">
            {[
              { id: "catalogo", label: "Catálogo", icon: LayoutGrid },
              { id: "conectadas", label: "Conectadas", icon: CheckCircle2 },
              { id: "automacoes", label: "Automações", icon: Zap },
              { id: "webhooks", label: "Webhooks", icon: Webhook },
              { id: "hubspot", label: "HubSpot", icon: RefreshCw },
              { id: "logs", label: "Logs", icon: FileText },
              { id: "credenciais", label: "Credenciais", icon: Key },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 text-xs py-2"
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === "logs" && logsQuery.isFetching && (
                  <Loader2 className="w-2.5 h-2.5 animate-spin ml-0.5 hidden sm:inline" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Catálogo ─────────────────────────────────────────────── */}
          <TabsContent value="catalogo" className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar integrações..."
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
                  aria-label="Buscar integrações"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["Todas", ...INTEGRATION_CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setCategoryFilter(cat as IntegrationCategory | "Todas")
                    }
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {categoryFilter === "Todas" && !search && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold">Ferramentas Ativas</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Image Generation */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <div className="p-5 border-b border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center border border-primary/25">
                        <ImageIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Geração de Imagens</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                            Conectada
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Google Gemini Imagen
                        </p>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-medium mb-2 block text-muted-foreground">
                          Preset de formato
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {IMAGE_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => setImgPreset(p.id)}
                              className={`py-1.5 px-2 rounded-lg border text-xs transition-all text-center ${imgPreset === p.id ? "bg-primary/10 border-primary text-primary" : "bg-background border-border hover:border-primary/40 text-muted-foreground"}`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <form
                        onSubmit={handleGenerateImage}
                        className="space-y-3"
                      >
                        <textarea
                          value={imgPrompt}
                          onChange={(e) => setImgPrompt(e.target.value)}
                          placeholder="Descreva a imagem — ex: profissional tributarista em reunião, estilo corporativo moderno..."
                          className="w-full bg-background border border-border rounded-lg p-3 text-sm min-h-[80px] focus:ring-1 focus:ring-primary outline-none resize-none"
                        />
                        <button
                          type="submit"
                          disabled={
                            imageMutation.isPending || !imgPrompt.trim()
                          }
                          className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {imageMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />{" "}
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" /> Gerar Imagem
                            </>
                          )}
                        </button>
                      </form>
                      <AnimatePresence>
                        {generatedImg && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-lg overflow-hidden border border-border relative group"
                          >
                            <img
                              src={generatedImg}
                              loading="lazy"
                              alt="Gerada"
                              className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <a
                                href={generatedImg}
                                download={`imagem-${Date.now()}.png`}
                                className="bg-white/15 hover:bg-white/25 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors"
                              >
                                Baixar
                              </a>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>

                  {/* Canva */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <div className="p-5 border-b border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center border border-primary/25">
                        <PenTool className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Espaço Canva</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                            Conectada
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Templates tributários prontos
                        </p>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-medium mb-2 block text-muted-foreground">
                          Tipo de template
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {CANVA_TEMPLATES.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setCanvaTemplate(t.id)}
                              className={`p-3 rounded-lg border text-left transition-all ${canvaTemplate === t.id ? "bg-primary/10 border-primary" : "bg-background border-border hover:border-primary/40"}`}
                            >
                              <div className="text-lg mb-1">{t.emoji}</div>
                              <div
                                className={`text-xs font-medium ${canvaTemplate === t.id ? "text-primary" : ""}`}
                              >
                                {t.label}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                {t.description}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={handleCanvaLink}
                        disabled={canvaMutation.isPending}
                        className="w-full py-2.5 px-4 border-2 border-primary bg-primary/5 hover:bg-primary/15 text-primary rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {canvaMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />{" "}
                            Abrindo...
                          </>
                        ) : (
                          <>
                            <Link2 className="w-4 h-4" /> Abrir no Canva{" "}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>
            )}

            <div>
              {(categoryFilter !== "Todas" || search) && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">
                    {filteredCatalog.length} integrações
                    {categoryFilter !== "Todas" && ` em ${categoryFilter}`}
                  </span>
                </div>
              )}
              {!(categoryFilter !== "Todas" || search) && (
                <div className="flex items-center gap-2 mb-4">
                  <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">
                    Todas as integrações
                  </h2>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCatalog.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <IntegrationCard entry={entry} onCta={handleCatalogCta} />
                  </motion.div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Conectadas ───────────────────────────────────────────── */}
          <TabsContent value="conectadas" className="mt-6">
            <div className="space-y-3">
              {healthQuery.isLoading && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Verificando integrações...
                </div>
              )}
              {(healthData?.integrations ?? []).map((entry) => (
                <div
                  key={entry.key}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
                >
                  <span className="text-2xl">
                    {integrationEmoji(entry.key)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{entry.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColor(entry.status)}`}
                      >
                        {statusLabel(entry.status)}
                      </span>
                      {entry.logCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {entry.logCount} eventos
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {entry.lastRunAt
                        ? `Último evento: ${formatTs(entry.lastRunAt)}`
                        : "Nenhum evento registrado"}
                    </p>
                    {entry.lastError && (
                      <p className="text-[10px] text-red-400 mt-0.5 truncate">
                        ⚠ {entry.lastError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.key === "make" && (
                      <button
                        onClick={() => setActiveTab("webhooks")}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors"
                        title="Configurar Make.com"
                      >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        healthQuery.refetch();
                        toast({ description: "Reconectando..." });
                      }}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Reconectar"
                    >
                      <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {!healthQuery.isLoading &&
                (healthData?.integrations ?? []).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-border rounded-xl">
                    Nenhuma integração configurada ainda.
                  </div>
                )}
            </div>
          </TabsContent>

          {/* ── Automações ───────────────────────────────────────────── */}
          <TabsContent value="automacoes" className="mt-6">
            <div className="space-y-3">
              {AUTOMATION_RECIPES.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
                >
                  <span className="text-2xl mt-0.5">{recipe.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{recipe.name}</span>
                      {recipe.status === "coming_soon" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-400/10 border border-zinc-400/20 text-zinc-400">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {recipe.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                        Gatilho: {recipe.trigger}
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                        Ação: {recipe.action}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {recipe.status !== "coming_soon" && (
                      <Switch
                        checked={recipe.status === "active"}
                        onCheckedChange={() =>
                          toast({
                            description:
                              "Configure automações via Make.com na aba Webhooks.",
                          })
                        }
                      />
                    )}
                    <span
                      className={`text-[10px] ${recipe.status === "active" ? "text-emerald-400" : recipe.status === "inactive" ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {recipe.status === "active"
                        ? "Ativa"
                        : recipe.status === "inactive"
                          ? "Inativa"
                          : "Em breve"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Webhooks ─────────────────────────────────────────────── */}
          <TabsContent value="webhooks" className="mt-6 space-y-6">
            {/* Inbound */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <div>
                <h3 className="font-semibold text-sm mb-0.5">
                  Webhook de Entrada (Inbound)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Envie eventos externos para este endpoint. Qualquer plataforma
                  pode POST aqui.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2.5 font-mono text-primary truncate">
                  {webhookUrl}
                </code>
                <button
                  onClick={handleCopyWebhook}
                  className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors shrink-0"
                  title="Copiar URL"
                >
                  {copiedWebhook ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPayload}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  {copiedPayload ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copiar payload exemplo
                </button>
                <button
                  onClick={handleTestInbound}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" /> Enviar teste
                </button>
                {inboundTestResult && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ✓ {inboundTestResult.correlationId.slice(0, 8)}...
                  </span>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-semibold mb-3">
                  Eventos suportados
                </h4>
                <div className="space-y-2">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-xs font-mono text-primary">
                          {ev.name}
                        </code>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ev.description}
                        </p>
                      </div>
                      <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Make.com Outbound */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h3 className="font-semibold text-sm">
                    Make.com — Webhook de Saída (Outbound)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure para disparar cenários Make.com a partir de
                    eventos internos.
                  </p>
                </div>
                <a
                  href="https://make.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Abrir Make <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <MakeConfigPanel onSuccess={() => healthQuery.refetch()} />
            </div>

            {/* Signature docs */}
            <div className="bg-secondary/30 border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-semibold">
                  Como funciona a assinatura HMAC
                </h4>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Quando um secret é configurado, cada requisição de saída
                  inclui o header:
                </p>
                <code className="block bg-background border border-border rounded px-3 py-2 font-mono text-primary">
                  X-TaxGroup-Signature: sha256=HMAC-SHA256(body, secret)
                </code>
                <p>
                  No Make.com, valide o header no módulo HTTP → verificar
                  assinatura com o mesmo secret.
                </p>
                <p>Headers enviados em toda requisição:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                  {[
                    "X-TaxGroup-Event",
                    "X-TaxGroup-Correlation-Id",
                    "X-TaxGroup-Timestamp",
                    "X-TaxGroup-Signature*",
                  ].map((h) => (
                    <code
                      key={h}
                      className="bg-background border border-border rounded px-2 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      {h}
                    </code>
                  ))}
                </div>
                <p className="text-[10px] opacity-60">
                  * Apenas quando secret configurado.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ── HubSpot CRM ──────────────────────────────────────────── */}
          <TabsContent value="hubspot" className="mt-6 space-y-4">
            <HubSpotConfigPanel />
          </TabsContent>

          {/* ── Logs ─────────────────────────────────────────────────── */}
          <TabsContent value="logs" className="mt-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "success", "error"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setLogFilter(f);
                    setSelectedLog(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${logFilter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
                >
                  {f === "all"
                    ? "Todos"
                    : f === "success"
                      ? "Sucesso"
                      : "Erros"}
                </button>
              ))}
              <button
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["integration-logs"] });
                  setSelectedLog(null);
                }}
                className="ml-auto p-2 rounded-lg bg-card border border-border hover:bg-secondary transition-colors"
                title="Atualizar"
              >
                <RefreshCw
                  className={`w-4 h-4 text-muted-foreground ${logsQuery.isFetching ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <AnimatePresence>
              {selectedLog && (
                <LogDetailPanel
                  key={selectedLog.id}
                  log={selectedLog}
                  onClose={() => setSelectedLog(null)}
                />
              )}
            </AnimatePresence>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {logsQuery.isLoading && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Carregando logs...
                </div>
              )}
              {!logsQuery.isLoading && logs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  Nenhum log encontrado.
                  {logFilter !== "all" && " Tente remover o filtro."}
                  {logFilter === "all" &&
                    " Eventos aparecerão aqui após as primeiras integrações serem acionadas."}
                </div>
              )}
              {logs.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">
                        Horário
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Integração
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                        Evento
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Dir.
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                        ms
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr
                        key={log.id}
                        onClick={() =>
                          setSelectedLog(
                            selectedLog?.id === log.id ? null : log,
                          )
                        }
                        className={`border-b border-border/40 last:border-0 cursor-pointer transition-colors ${selectedLog?.id === log.id ? "bg-primary/5 border-primary/20" : "hover:bg-secondary/20"} ${i % 2 === 0 ? "" : "bg-secondary/5"}`}
                      >
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {formatTs(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span>{integrationEmoji(log.integrationKey)}</span>
                            <span className="font-medium hidden sm:inline">
                              {log.integrationName}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground hidden sm:table-cell">
                          {log.eventType}
                        </td>
                        <td className="px-4 py-3">
                          {log.direction === "inbound" ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              log.status === "success"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : log.status === "error"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            {log.status === "success" ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <AlertTriangle className="w-2.5 h-2.5" />
                            )}
                            {log.status === "success"
                              ? "OK"
                              : log.status === "error"
                                ? "Erro"
                                : "Pend."}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                          {log.durationMs ? `${log.durationMs}` : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* ── Credenciais ──────────────────────────────────────────── */}
          <TabsContent value="credenciais" className="mt-6 space-y-6">
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300/80 leading-relaxed">
              🔒 Credenciais criptografadas com AES-256-GCM. Secrets nunca são
              retornados em APIs GET. Somente o nome do provedor é exibido.
            </div>

            <div className="space-y-2">
              {!customKeys?.keys || customKeys.keys.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-xl">
                  Nenhuma credencial salva ainda.
                </div>
              ) : (
                customKeys.keys.map((k) => (
                  <div
                    key={k.provider}
                    className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{k.provider}</div>
                      <code className="text-xs font-mono text-muted-foreground">
                        {revealedKeys.has(k.provider)
                          ? "••••[chave registrada]••••"
                          : "••••••••••••"}
                      </code>
                      <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                        Salva em{" "}
                        {new Date(k.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          setRevealedKeys((prev) => {
                            const n = new Set(prev);
                            n.has(k.provider)
                              ? n.delete(k.provider)
                              : n.add(k.provider);
                            return n;
                          })
                        }
                        className="p-2 rounded-lg hover:bg-secondary transition-colors"
                        title="Verificar existência"
                      >
                        {revealedKeys.has(k.provider) ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(k.provider);
                          setCopiedProvider(k.provider);
                          setTimeout(() => setCopiedProvider(null), 2000);
                        }}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors"
                        title="Copiar nome"
                      >
                        {copiedProvider === k.provider ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteKey(k.provider)}
                        disabled={deleteKeyMutation.isPending}
                        className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!showNewKey ? (
              <button
                onClick={() => setShowNewKey(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar credencial
              </button>
            ) : (
              <motion.form
                onSubmit={handleSaveKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-5 space-y-4"
              >
                <h3 className="font-semibold text-sm">Nova credencial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Nome do provedor
                    </label>
                    <input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="ex: OPENAI_API_KEY"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Valor
                    </label>
                    <input
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      placeholder="sk-..."
                      type="password"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewKey(false)}
                    className="px-4 py-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      setKeyMutation.isPending ||
                      !newKeyName.trim() ||
                      !newKeyValue.trim()
                    }
                    className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {setKeyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}{" "}
                    Salvar
                  </button>
                </div>
              </motion.form>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Credential Confirmation */}
      <AlertDialog
        open={!!deleteKeyTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteKeyTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              A credencial{" "}
              <code className="font-mono text-primary/80">
                {deleteKeyTarget}
              </code>{" "}
              será permanentemente removida. Integrações que dependem dela
              pararão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
