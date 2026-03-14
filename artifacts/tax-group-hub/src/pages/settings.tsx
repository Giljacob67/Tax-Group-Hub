import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings, CheckCircle2, XCircle, Server,
  Cloud, Loader2, ExternalLink, RefreshCw, Cpu, Zap,
  Eye, EyeOff, Save, Wifi, WifiOff, AlertCircle
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
  openrouter: Cloud,
  gemini: Zap,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function OllamaCard({ integration, onSettingsChange }: {
  integration: IntegrationStatus;
  onSettingsChange: () => void;
}) {
  const IntIcon = INTEGRATION_ICONS[integration.id] || Cloud;
  const [ollamaSettings, setOllamaSettings] = useState<OllamaSettings | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [editUrl, setEditUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<OllamaTestResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
        body: JSON.stringify({ url: editUrl || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setOllamaSettings(prev => prev ? { ...prev, url: data.url, source: data.source } : prev);
        setSaveMessage("URL salva com sucesso!");
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

  const hasUnsavedChanges = editUrl !== (ollamaSettings?.url || "");

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
            <h3 className="font-semibold text-foreground">{integration.name}</h3>
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
            {ollamaSettings.model && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Modelo: <code className="text-primary">{ollamaSettings.model}</code>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Nova URL do Ollama</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editUrl}
                onChange={(e) => {
                  setEditUrl(e.target.value);
                  setTestResult(null);
                  setSaveMessage(null);
                }}
                placeholder="http://seu-host:11434"
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-background border border-border/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 font-mono placeholder:text-muted-foreground/50"
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
            {editUrl.trim() && (
              <button
                onClick={() => {
                  setEditUrl("");
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
    </motion.div>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/integrations");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
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
                <h1 className="text-2xl font-bold text-foreground">Configuracoes</h1>
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
                    : `Modelo cloud: ${data.openrouterModel}`
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}

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
                  if (integration.id === "ollama") {
                    return (
                      <OllamaCard
                        key={integration.id}
                        integration={integration}
                        onSettingsChange={fetchSettings}
                      />
                    );
                  }

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
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            integration.configured ? 'bg-emerald-500/10' : 'bg-muted/50'
                          }`}>
                            <IntIcon className={`w-5 h-5 ${integration.configured ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{integration.name}</h3>
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

                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {integration.description}
                      </p>

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
          <h3 className="text-sm font-semibold text-foreground">Como configurar</h3>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
            <li>No Replit, clique no icone de <strong>cadeado</strong> na barra lateral esquerda</li>
            <li>Clique em <strong>"Add new secret"</strong></li>
            <li>Insira o nome da variavel (ex: <code className="text-primary">OPENROUTER_API_KEY</code>) e seu valor</li>
            <li>Reinicie o servidor para aplicar as alteracoes</li>
          </ol>
          <div className="pt-2 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              <strong>Ollama:</strong> Para usar LLM local, rode <code className="text-primary">ollama serve</code> na sua maquina
              e exponha com <code className="text-primary">ngrok http 11434</code>. Depois configure a URL usando o card acima
              ou defina <code className="text-primary">OLLAMA_URL</code> nas variaveis de ambiente.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
