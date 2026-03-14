import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings, CheckCircle2, XCircle, Server,
  Cloud, Loader2, ExternalLink, RefreshCw, Cpu, Zap
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

const CATEGORY_META: Record<string, { label: string; icon: typeof Cloud }> = {
  llm: { label: "Modelos de Linguagem (LLM)", icon: Cpu },
  google: { label: "Google AI (Imagens + Embeddings)", icon: Zap },
};

const INTEGRATION_ICONS: Record<string, typeof Cloud> = {
  ollama: Server,
  openrouter: Cloud,
  gemini: Zap,
};

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
              e exponha com <code className="text-primary">ngrok http 11434</code>. Depois configure{" "}
              <code className="text-primary">OLLAMA_URL</code> com a URL publica gerada.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
