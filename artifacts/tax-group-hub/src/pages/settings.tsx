import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Settings, CheckCircle2, XCircle, Server,
  Cloud, Loader2, ExternalLink, RefreshCw, Cpu, Zap,
  Eye, EyeOff, Save, Wifi, WifiOff, AlertCircle, Crown, Brain, 
} from "lucide-react";

interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  envVar: string;
  configured: boolean;
  active: boolean;
  category: string;
}

interface SettingsData {
  integrations: IntegrationStatus[];
  activeLLM: string | null;
  ollamaModel: string;
  openrouterModel: string;
  geminiModel?: string;
}

interface OllamaSettings {
  url: string | null;
  source: "db" | "env" | null;
  model: string;
}

interface OllamaTestResult {
  success: boolean;
  error?: string;
  models?: Array<{ name: string; size: number; modifiedAt: string }>;
  url?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Cloud }> = {
  llm: { label: "Modelos de Linguagem (LLM)", icon: Cpu },
  google: { label: "Google AI (Imagens + Embeddings)", icon: Zap },
};

const INTEGRATION_ICONS: Record<string, typeof Cloud> = {
  ollama: Server,
  ollama_cloud: Cloud,
  openrouter: Cloud,
  gemini: Zap,
  google: Zap,
  anthropic: Cpu,
  openai: Brain,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function OllamaCard({ integration, onSettingsChange, activeProvider, onActivate }: {
  integration: IntegrationStatus;
  onSettingsChange: () => void;
  activeProvider: string;
  onActivate: (provider: string, url: string, model: string) => Promise<void>;
}) {
  const IntIcon = INTEGRATION_ICONS[integration.id] || Cloud;
  const [ollamaSettings, setOllamaSettings] = useState<OllamaSettings | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [editUrl, setEditUrl] = useState("");
  const [editModel, setEditModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [testResult, setTestResult] = useState<OllamaTestResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const isThisActive = activeProvider === "ollama";

  useEffect(() => {
    fetchOllamaSettings();
  }, []);

  const fetchOllamaSettings = async () => {
    try {
      const res = await fetch("/api/settings/ollama");
      if (res.ok) {
        const data = await res.json();
        setOllamaSettings(data);
        setEditUrl(data.url || "");
        setEditModel(data.model || "");
      }
    } catch {}
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/ollama/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: editUrl || undefined }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Erro de rede ao testar conexao." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/settings/ollama", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: editUrl || "", model: editModel || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setOllamaSettings(prev => prev ? { ...prev, url: data.url, source: data.source, model: data.model } : prev);
        setEditUrl(data.url || "");
        setEditModel(data.model || "");
        setSaveMessage("Configurações salvas com sucesso!");
        onSettingsChange();
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const err = await res.json();
        setSaveMessage(err.error || "Erro ao salvar.");
      }
    } catch {
      setSaveMessage("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const maskedUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//****${parsed.port ? ":" + parsed.port : ""}`;
    } catch {
      return "****";
    }
  };

  const hasUnsavedChanges = editUrl !== (ollamaSettings?.url || "") || editModel !== (ollamaSettings?.model || "");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25 }}
      className={`bg-card border rounded-2xl p-5 transition-all md:col-span-2 ${
        integration.configured
          ? 'border-emerald-500/20 hover:border-emerald-500/40'
          : 'border-border/50 hover:border-yellow-500/30'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            integration.configured ? 'bg-emerald-500/10' : 'bg-muted/50'
          }`}>
            <IntIcon className={`w-5 h-5 ${integration.configured ? 'text-emerald-400' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{integration.name}</h3>
              {isThisActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold border border-primary/30">
                  ✓ ATIVO
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {integration.configured ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Configurado</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs text-yellow-500 font-medium">Nao configurado</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        {integration.description}
      </p>

      {ollamaSettings && (
        <div className="space-y-4">
          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">URL Atual</p>
              {ollamaSettings.source && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  ollamaSettings.source === 'db'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  Fonte: {ollamaSettings.source === 'db' ? 'Banco de Dados' : 'Variavel de Ambiente'}
                </span>
              )}
            </div>
            {ollamaSettings.url ? (
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-primary flex-1 break-all">
                  {showUrl ? ollamaSettings.url : maskedUrl(ollamaSettings.url)}
                </code>
                <button
                  onClick={() => setShowUrl(!showUrl)}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  title={showUrl ? "Ocultar URL" : "Mostrar URL"}
                >
                  {showUrl ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhuma URL configurada</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">URL do Ollama</label>
              <input
                type="text"
                value={editUrl}
                onChange={(e) => {
                  setEditUrl(e.target.value);
                  setTestResult(null);
                  setSaveMessage(null);
                }}
                placeholder="http://seu-host:11434"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 font-mono placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Modelo</label>
              <input
                type="text"
                value={editModel}
                onChange={(e) => {
                  setEditModel(e.target.value);
                  setSaveMessage(null);
                }}
                placeholder="qwen3.5"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 font-mono placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing || !editUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              Testar Conexao
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar
            </button>
            {(editUrl.trim() || editModel.trim()) && (
              <button
                onClick={() => {
                  setEditUrl("");
                  setEditModel("");
                  setTestResult(null);
                  setSaveMessage(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all"
              >
                Limpar
              </button>
            )}
          </div>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg p-3 border ${
                testResult.success
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">Conexao bem-sucedida!</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-400">Falha na conexao</span>
                  </>
                )}
              </div>
              {testResult.success && testResult.models && testResult.models.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {testResult.models.length} modelo(s) disponivel(is):
                  </p>
                  <div className="space-y-1">
                    {testResult.models.map((m) => (
                      <div key={m.name} className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1.5">
                        <span className="font-mono text-foreground">{m.name}</span>
                        <span className="text-muted-foreground">{formatBytes(m.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : testResult.success && testResult.models && testResult.models.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum modelo encontrado. Execute <code className="text-primary">ollama pull llama3.2</code> para baixar um modelo.</p>
              ) : testResult.error ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-300">{testResult.error}</p>
                </div>
              ) : null}
            </motion.div>
          )}

          {saveMessage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-xs font-medium px-3 py-2 rounded-lg ${
                saveMessage.includes("sucesso")
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {saveMessage}
            </motion.div>
          )}
        </div>
      )}

      {!ollamaSettings && (
        <div className="bg-background/50 rounded-lg p-3 border border-border/30">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Variavel de Ambiente</p>
          <code className="text-xs font-mono text-primary">{integration.envVar}</code>
          {!integration.configured && (
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Configure no painel Secrets do Replit (icone de cadeado na barra lateral)
            </p>
          )}
        </div>
      )}

      {/* Activate button */}
      <div className="pt-2 border-t border-border/30">
        {isThisActive ? (
          <div className="flex items-center gap-2 py-2 text-xs text-primary font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {editModel ? `Ativo: ${editModel}` : 'Provedor Ollama ativo'} — todos os agentes usam este.
          </div>
        ) : (
          <button
            disabled={activating || !editUrl.trim()}
            onClick={async () => {
              setActivating(true);
              await onActivate("ollama", "", editModel);
              setActivating(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-all disabled:opacity-50"
          >
            {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Usar este provedor
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Model lists per provider ────────────────────────────────────────────────
const PROVIDER_MODELS: Record<string, { id: string; label: string }[]> = {
  google: [
    { id: "gemini-1.5-flash",              label: "Gemini 1.5 Flash (rápido)" },
    { id: "gemini-1.5-pro",                label: "Gemini 1.5 Pro (avançado)" },
    { id: "gemini-2.0-flash-lite",         label: "Gemini 2.0 Flash Lite" },
    { id: "gemini-2.5-pro-preview-05-06",  label: "Gemini 2.5 Pro Preview" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20241022",  label: "Claude 3.5 Sonnet (recomendado)" },
    { id: "claude-3-5-haiku-20241022",   label: "Claude 3.5 Haiku (rápido)" },
    { id: "claude-3-opus-20240229",      label: "Claude 3 Opus (poderoso)" },
  ],
  openai: [
    { id: "gpt-4o",      label: "GPT-4o (recomendado)" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini (rápido)" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "o3-mini",     label: "o3-mini (raciocínio)" },
  ],
  openrouter: [
    { id: "meta-llama/llama-3.1-70b-instruct",  label: "LLaMA 3.1 70B" },
    { id: "meta-llama/llama-3.1-8b-instruct",   label: "LLaMA 3.1 8B (rápido)" },
    { id: "mistralai/mistral-7b-instruct",       label: "Mistral 7B" },
    { id: "qwen/qwen-2.5-72b-instruct",          label: "Qwen 2.5 72B" },
    { id: "google/gemini-flash-1.5",             label: "Gemini 1.5 Flash (via OR)" },
  ],
  ollama_cloud: [],  // free-text
};

function LLMProviderCard({
  integration,
  activeProvider,
  activeModel,
  onActivate,
}: {
  integration: IntegrationStatus;
  activeProvider: string;
  activeModel: string | null;
  onActivate: (provider: string, url: string, model: string) => Promise<void>;
}) {
  const IntIcon = INTEGRATION_ICONS[integration.id] || Cloud;
  const isThisActive = activeProvider === integration.id;
  const models = PROVIDER_MODELS[integration.id] ?? [];
  const needsUrl = integration.id === "ollama_cloud";
  const hasFreeTextModel = integration.id === "ollama_cloud";

  const [customUrl, setCustomUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [activating, setActivating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; provider?: string; model?: string; response?: string; error?: string } | null>(null);

  // Pre-fill model with active model when this card is the active one
  useEffect(() => {
    if (isThisActive && activeModel && !selectedModel) {
      setSelectedModel(activeModel);
    }
  }, [isThisActive, activeModel]);

  const handleActivate = async () => {
    setActivating(true);
    setTestResult(null);
    await onActivate(integration.id, customUrl, selectedModel);
    setActivating(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/active-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: integration.id,
          customUrl: needsUrl ? customUrl : undefined,
          model: selectedModel || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Erro de rede ao testar." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-card border rounded-2xl p-5 transition-all ${
        isThisActive
          ? 'border-primary/50 ring-1 ring-primary/20'
          : integration.configured
            ? 'border-emerald-500/20 hover:border-emerald-500/40'
            : 'border-border/50 hover:border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isThisActive ? 'bg-primary/10' : integration.configured ? 'bg-emerald-500/10' : 'bg-muted/50'
          }`}>
            <IntIcon className={`w-5 h-5 ${
              isThisActive ? 'text-primary' : integration.configured ? 'text-emerald-400' : 'text-muted-foreground'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{integration.name}</h3>
              {isThisActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold border border-primary/30">
                  ✓ ATIVO
                </span>
              )}
            </div>
              {isThisActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold border border-primary/30">
                  ✓ ATIVO
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {integration.configured ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400 font-medium">Configurado</span></>
              ) : (
                <><XCircle className="w-3.5 h-3.5 text-yellow-500" /><span className="text-xs text-yellow-500 font-medium">Chave pendente</span></>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{integration.description}</p>

      {/* API Key input */}
      <div className="bg-background/50 rounded-lg p-3 border border-border/30 mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Chave de API</p>
          <span className={`text-[10px] px-2 py-0 rounded-full font-medium ${
            integration.configured ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {integration.configured ? 'Salva' : 'Pendente'}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="password"
            placeholder="Cole sua chave de API aqui..."
            className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary/50"
            id={`key-${integration.id}`}
          />
          <button
            onClick={async () => {
              const input = document.getElementById(`key-${integration.id}`) as HTMLInputElement;
              if (!input?.value) return;
              await fetch("/api/settings/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: integration.id, key: input.value }),
              });
              input.value = '';
            }}
            className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90"
          >Salvar</button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Armazenamento criptografado (AES-256)
        </p>
      </div>

      {/* URL for Ollama Cloud */}
      {needsUrl && (
        <div className="bg-background/50 rounded-lg p-3 border border-border/30 mb-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">URL do Endpoint (obrigatório)</p>
          <input
            type="text"
            placeholder="https://meuollama.com"
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            className="w-full bg-background border border-border/50 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary/50"
          />
          <p className="text-[10px] text-muted-foreground">Endpoint compatível com API OpenAI (Ollama serve)</p>
        </div>
      )}

      {/* Model selector */}
      {(models.length > 0 || hasFreeTextModel) && (
        <div className="bg-background/50 rounded-lg p-3 border border-border/30 mb-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Modelo</p>
          {hasFreeTextModel ? (
            <input
              type="text"
              placeholder="llama3.2, qwen2.5, etc."
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full bg-background border border-border/50 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-primary/50"
            />
          ) : (
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full bg-background border border-border/50 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary/50"
            >
              <option value="">— Selecionar modelo —</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Activate + Test buttons */}
      <div className="space-y-2 pt-1 border-t border-border/30">
        {isThisActive ? (
          <>
            <div className="flex items-center gap-2 py-2 text-xs text-primary font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {activeModel ? `Ativo: ${activeModel}` : 'Provedor LLM ativo'} — todos os agentes usam este.
            </div>
            <button
              disabled={testing}
              onClick={handleTest}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-background hover:bg-muted/50 border border-border/50 text-xs font-medium transition-all disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              Testar conexão
            </button>
            {testResult && (
              <div className={`text-xs rounded-lg px-3 py-2 border ${
                testResult.success
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/5 border-red-500/20 text-red-400'
              }`}>
                {testResult.success
                  ? `✓ ${testResult.provider} · ${testResult.model} — ${testResult.response}`
                  : `✗ ${testResult.error}`}
              </div>
            )}
          </>
        ) : (
          <button
            disabled={activating}
            onClick={handleActivate}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-all disabled:opacity-50"
          >
            {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Usar este provedor
          </button>
        )}
      </div>
    </motion.div>
  );
}

function BrandingSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({
    companyName: "",
    primaryColor: "#3b82f6",
    customDomain: "",
    logoUrl: ""
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/branding/config")
      .then(r => r.json())
      .then(data => {
        if (data.id) {
          setBranding({
            companyName: data.companyName,
            primaryColor: data.primaryColor,
            customDomain: data.customDomain || "",
            logoUrl: data.logoStorageKey ? `/uploads/${data.logoStorageKey}` : ""
          });
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/branding/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding)
      });
      if (res.ok) {
        setMsg("Branding atualizado! Recarregue a página para aplicar.");
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setMsg("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const formData = new FormData();
    formData.append("logo", e.target.files[0]);
    
    setSaving(true);
    try {
      const res = await fetch("/api/branding/logo", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setBranding(prev => ({ ...prev, logoUrl: data.logoUrl }));
        setMsg("Logo atualizada!");
      }
    } catch {
      setMsg("Erro no upload.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-2xl p-6 space-y-6"
    >
      <div className="flex items-center gap-3">
        <Crown className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-foreground">Identidade Visual & Branding</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Nome da Empresa</label>
            <input
              type="text"
              value={branding.companyName}
              onChange={e => setBranding({...branding, companyName: e.target.value})}
              className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Cor Primária (Hex)</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={branding.primaryColor}
                onChange={e => setBranding({...branding, primaryColor: e.target.value})}
                className="w-10 h-10 rounded cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={branding.primaryColor}
                onChange={e => setBranding({...branding, primaryColor: e.target.value})}
                className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          
          <div className="space-y-2">
             <label className="text-xs font-medium text-muted-foreground uppercase">Domínio Customizado</label>
             <input
               type="text"
               value={branding.customDomain}
               placeholder="hub.suaempresa.com"
               onChange={e => setBranding({...branding, customDomain: e.target.value})}
               className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm"
             />
          </div>
        </div>

        <div className="space-y-4 flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/30 rounded-2xl bg-muted/20">
           <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Logotipo</p>
           {branding.logoUrl ? (
             <img src={branding.logoUrl} className="h-16 object-contain mb-4" alt="Preview" />
           ) : (
             <Crown className="w-12 h-12 text-muted-foreground/30 mb-4" />
           )}
           <label className="cursor-pointer bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
             Alterar Logo
             <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
           </label>
        </div>
      </div>

      <div className="pt-4 border-t border-border/30 flex items-center justify-between">
         <p className="text-xs text-muted-foreground">{msg || "Altere a cor e o nome para personalizar seu portal."}</p>
         <button
           onClick={handleSave}
           disabled={saving}
           className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
         >
           {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
           Salvar Identidade
         </button>
      </div>
    </motion.div>
  );
}

function ModelSelector({ activeProvider, activeModel, onModelChange }: {
  activeProvider: string;
  activeModel: string | null;
  onModelChange: () => void;
}) {
  const [data, setData] = useState<{ models: any[], defaultModel: string, provider: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings/models")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Only show if provider is not ollama (Ollama has its own card)
  if (loading || !data?.provider || activeProvider === "ollama" || activeProvider === "ollama_cloud") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="bg-card border border-border/50 rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Cpu className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Seleção de Modelo (Cloud)</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Escolha o modelo para as operações do sistema. O modelo atual afeta a velocidade e qualidade das análises.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.models.map((model: any) => {
          const isActive = activeModel === model.id;
          return (
            <div
              key={model.id}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-primary/30'
                  : 'bg-background hover:bg-muted/50 border-border/50 hover:border-primary/30'
              }`}
              onClick={async () => {
                try {
                  await fetch("/api/settings/active-provider", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ provider: activeProvider, model: model.id }),
                  });
                  toast({ title: `Modelo "${model.name}" selecionado.` });
                  onModelChange();
                } catch {
                  toast({ title: "Erro ao salvar modelo", variant: "destructive" });
                }
              }}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>{model.name}</span>
                {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{model.description}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>("auto");
  const [activeLlmUrl, setActiveLlmUrl] = useState<string>("");
  const [activeLlmModel, setActiveLlmModel] = useState<string>("");
  const [activating, setActivating] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const [intRes, provRes] = await Promise.all([
        fetch("/api/settings/integrations"),
        fetch("/api/settings/active-provider"),
      ]);
      if (intRes.ok) setData(await intRes.json());
      if (provRes.ok) {
        const p = await provRes.json();
        setActiveProvider(p.provider || "auto");
        setActiveLlmUrl(p.customUrl || "");
        setActiveLlmModel(p.model || "");
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const activateProvider = async (provider: string, customUrl?: string, model?: string) => {
    setActivating(provider);
    try {
      const res = await fetch("/api/settings/active-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, customUrl: customUrl || "", model: model || "" }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setActiveProvider(provider);
      if (customUrl !== undefined) setActiveLlmUrl(customUrl);
      if (model !== undefined) setActiveLlmModel(model);
      toast({ title: `Provedor "${provider}" ativado com sucesso!` });
      fetchSettings();
    } catch (e: any) {
      toast({ title: "Erro ao ativar provedor", description: e.message, variant: "destructive" });
    } finally {
      setActivating(null);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSettings();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const integrations = data?.integrations || [];
  const configuredCount = integrations.filter(i => i.configured).length;
  const categories = [...new Set(integrations.map(i => i.category))];

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
                <p className="text-sm text-muted-foreground">Status das integracoes e provedores de IA</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/50 hover:border-primary/30 text-sm font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </motion.div>

        {/* Phase 10 Branding */}
        <BrandingSection />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="bg-card border border-border/50 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total de Integracoes</p>
            <p className="text-3xl font-bold text-foreground">{integrations.length}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Configuradas</p>
            <p className="text-3xl font-bold text-emerald-400">{configuredCount}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Provedor LLM Ativo</p>
            <p className="text-lg font-bold text-primary truncate">{data?.activeLLM || "Nenhum"}</p>
          </div>
        </motion.div>

        {data?.activeLLM && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-emerald-400">IA Ativa: {data.activeLLM}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.activeLLM?.startsWith("Ollama")
                    ? `Modelo local: ${data.ollamaModel}`
                    : `Modelo cloud detectado. (Atualmente ${data.activeLLM.includes('Gemini') ? (data as any).geminiModel : 'Padrão'})`
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <ModelSelector
          activeProvider={activeProvider}
          activeModel={activeLlmModel || null}
          onModelChange={fetchSettings}
        />

        {categories.map((category, catIdx) => {
          const catMeta = CATEGORY_META[category] || { label: category, icon: Settings };
          const catIntegrations = integrations.filter(i => i.category === category);
          const CatIcon = catMeta.icon;

          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + catIdx * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <CatIcon className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{catMeta.label}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catIntegrations.map((integration, i) => {
                  // Ollama local has its own dedicated card
                  if (integration.id === "ollama") {
                    return (
                      <OllamaCard
                        key={integration.id}
                        integration={integration}
                        onSettingsChange={fetchSettings}
                          activeProvider={activeProvider}
                          onActivate={async (provider, url, model) => {
                            await activateProvider(provider, url, model);
                          }}
                      />
                    );
                  }

                  // All other LLM providers use LLMProviderCard
                  if (category === "llm") {
                    return (
                      <LLMProviderCard
                        key={integration.id}
                        integration={integration}
                        activeProvider={activeProvider}
                        activeModel={activeLlmModel || null}
                        onActivate={async (provider, url, model) => {
                          await activateProvider(provider, url, model);
                        }}
                      />
                    );
                  }

                  // Non-LLM integrations (google, tool, etc.) — simple card
                  const IntIcon = INTEGRATION_ICONS[integration.id] || Cloud;
                  return (
                    <motion.div
                      key={integration.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className={`bg-card border rounded-2xl p-5 transition-all ${
                        integration.configured
                          ? 'border-emerald-500/20 hover:border-emerald-500/40'
                          : 'border-border/50 hover:border-yellow-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          integration.configured ? 'bg-emerald-500/10' : 'bg-muted/50'
                        }`}>
                          <IntIcon className={`w-5 h-5 ${integration.configured ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{integration.name}</h3>
              {isThisActive && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold border border-primary/30">
                  ✓ ATIVO
                </span>
              )}
            </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {integration.configured ? (
                              <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400 font-medium">Configurado</span></>
                            ) : (
                              <><XCircle className="w-3.5 h-3.5 text-yellow-500" /><span className="text-xs text-yellow-500 font-medium">Nao configurado</span></>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{integration.description}</p>
                      <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Variavel de Ambiente</p>
                        <code className="text-xs font-mono text-primary">{integration.envVar}</code>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-card/30 border border-border/30 rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-sm font-semibold text-foreground">BYOK (Bring Your Own Keys)</h3>
          <p className="text-xs text-muted-foreground">
            Suas chaves são salvas de forma segura no banco de dados com criptografia AES-256 (GCM). Você não precisa definir variáveis de ambiente externamente. Basta salvar as chaves através deste painel e utilizá-las instantaneamente.
          </p>
          <div className="pt-2 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              <strong>Ollama:</strong> Para usar LLM local, rode <code className="text-primary">ollama serve</code> na sua maquina
              e exponha o acesso. Depois configure a URL usando o painel superior.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
