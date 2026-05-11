import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wifi, Loader2, CheckCircle2, Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LlmConnection, ProviderMeta } from "./types";

interface Props {
  connection: LlmConnection;
  providers: ProviderMeta[];
  onClose: () => void;
  onSaved: () => void;
}

interface DiscoveredModel {
  id: string;
  name: string;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsJson?: boolean;
}

export default function EditConnectionModal({ connection, providers, onClose, onSaved }: Props) {
  const provider = providers.find((p) => p.id === connection.provider);

  const [baseUrl, setBaseUrl] = useState(connection.baseUrl || "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<DiscoveredModel | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Pre-select current model if discovered
  useEffect(() => {
    if (models.length && connection.modelId) {
      const current = models.find((m) => m.id === connection.modelId);
      if (current) setSelectedModel(current);
    }
  }, [models, connection.modelId]);

  async function handleDiscover() {
    if (!provider) return;
    setDiscovering(true);
    setDiscoverError("");
    setModels([]);
    try {
      const r = await fetch("/api/llm/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.id,
          apiKey: apiKey.trim() || "x",
          baseUrl: provider.needsBaseUrl ? baseUrl : undefined,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setModels(data.models);
        if (data.models.length === 0) setDiscoverError("Nenhum modelo encontrado.");
      } else {
        setDiscoverError(data.error || "Falha na descoberta");
      }
    } catch {
      setDiscoverError("Erro de rede");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleSave() {
    if (!selectedModel) return;
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, any> = {
        name: `${provider?.name || connection.provider} — ${selectedModel.name}`,
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        contextWindow: selectedModel.contextWindow,
        supportsVision: selectedModel.supportsVision,
        supportsTools: selectedModel.supportsTools,
        supportsJson: selectedModel.supportsJson,
      };
      if (baseUrl !== (connection.baseUrl || "")) body.baseUrl = baseUrl || null;
      if (apiKey.trim()) body.apiKey = apiKey.trim();

      const r = await fetch(`/api/llm/connections/${connection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      onSaved();
      onClose();
    } catch {
      setSaveError("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-lg">{provider?.icon || "◈"}</span>
            <div>
              <div className="text-sm font-semibold">Editar Conexão</div>
              <div className="text-[11px] text-muted-foreground">{connection.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Credentials */}
          {provider?.needsBaseUrl && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">URL do Servidor</label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={provider.baseUrlPlaceholder} className="text-xs" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{provider?.keyLabel || "API Key"}</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiKey ? "" : "•••••••• (preencha apenas se quiser alterar)"}
                  className="text-xs font-mono pr-9"
                />
                <button onClick={() => setShowKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Deixe em branco para manter a chave atual.</p>
          </div>

          {/* Discover */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiscover}
              disabled={discovering || (provider?.needsBaseUrl && !baseUrl)}
              className="text-xs"
            >
              {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
              Buscar Modelos
            </Button>
            {discoverError && <span className="text-xs text-red-400">{discoverError}</span>}
          </div>

          {/* Models */}
          <AnimatePresence>
            {models.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{models.length} modelo(s) encontrado(s)</div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/30 rounded-xl p-2">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                        selectedModel?.id === m.id
                          ? "bg-primary/10 border border-primary/30 text-primary"
                          : "bg-card/50 border border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{m.name}</span>
                        {selectedModel?.id === m.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {m.supportsVision && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1 rounded">vision</span>}
                        {m.supportsTools && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1 rounded">tools</span>}
                        {m.contextWindow && <span className="text-[10px] bg-muted px-1 rounded">{Math.round(m.contextWindow / 1000)}k ctx</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {saveError && <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{saveError}</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/30">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancelar</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !selectedModel}
            className="text-xs"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Salvar Alterações
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
