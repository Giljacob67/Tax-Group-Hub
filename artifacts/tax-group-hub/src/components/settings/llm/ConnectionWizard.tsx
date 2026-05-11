import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, Loader2, Wifi, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderMeta, DiscoveredModel, UsageType } from "./types";
import { USAGE_TYPES } from "./types";

interface Props {
  providers: ProviderMeta[];
  onClose: () => void;
  onCreated: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function ConnectionWizard({ providers, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [provider, setProvider] = useState<ProviderMeta | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [discoverError, setDiscoverError] = useState("");
  const [selectedModel, setSelectedModel] = useState<DiscoveredModel | null>(null);
  const [usageType, setUsageType] = useState<UsageType>("chat");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);

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
          apiKey,
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
    if (!provider || !selectedModel) return;
    setSaving(true);
    try {
      const r = await fetch("/api/llm/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${provider.name} — ${selectedModel.name}`,
          provider: provider.id,
          baseUrl: provider.needsBaseUrl ? baseUrl : null,
          apiKey,
          modelId: selectedModel.id,
          modelName: selectedModel.name,
          contextWindow: selectedModel.contextWindow,
          maxTokens: selectedModel.maxTokens,
          supportsVision: selectedModel.supportsVision,
          supportsTools: selectedModel.supportsTools,
          supportsJson: selectedModel.supportsJson,
          priceInput: selectedModel.priceInput,
          priceOutput: selectedModel.priceOutput,
          providerMetadata: selectedModel.providerMetadata,
          usageType,
        }),
      });
      if (!r.ok) throw new Error();
      onCreated();
    } catch {
      setDiscoverError("Erro ao salvar conexão");
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { num: 1, label: "Provedor" },
    { num: 2, label: "Credenciais" },
    { num: 3, label: "Modelos" },
    { num: 4, label: "Uso" },
    { num: 5, label: "Testar" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border/50 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nova Conexão LLM</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">×</button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-border/30 flex items-center gap-2 overflow-x-auto">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className={`text-[11px] ${step >= s.num ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Provider */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">Escolha o provedor de IA que deseja conectar.</p>
                <div className="grid grid-cols-2 gap-3">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setProvider(p); setStep(2); }}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left hover:shadow-sm ${
                        provider?.id === p.id
                          ? `border-primary/40 bg-primary/5 ring-1 ${p.ring}`
                          : "border-border/40 bg-card/50 hover:bg-card"
                      }`}
                    >
                      <span className={`text-xl ${p.color}`}>{p.icon}</span>
                      <div>
                        <div className="text-sm font-semibold">{p.label}</div>
                        <div className="text-[11px] text-muted-foreground">{p.supportsDiscovery ? "Descoberta automática" : "Configuração manual"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Credentials */}
            {step === 2 && provider && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{provider.keyLabel}</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={provider.keyPlaceholder}
                        className="text-xs font-mono pr-9"
                      />
                      <button onClick={() => setShowKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                {provider.needsBaseUrl && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Endpoint URL</Label>
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={provider.baseUrlPlaceholder || "https://..."}
                      className="text-xs font-mono"
                    />
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>Voltar</Button>
                  <Button size="sm" onClick={handleDiscover} disabled={!apiKey.trim() || discovering || (provider.needsBaseUrl && !baseUrl)}>
                    {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
                    Buscar Modelos
                  </Button>
                </div>
                {discoverError && (
                  <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{discoverError}</span>
                  </div>
                )}
                {models.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium">{models.length} modelos encontrados:</p>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m); setStep(4); }}
                          className={`p-3 rounded-lg border text-left transition-all text-xs ${
                            selectedModel?.id === m.id
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/40 bg-card/30 hover:bg-card"
                          }`}
                        >
                          <div className="font-medium truncate">{m.name}</div>
                          {m.contextWindow && <div className="text-xs text-muted-foreground mt-0.5">{m.contextWindow.toLocaleString()} tokens</div>}
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {m.supportsVision && <span className="text-[11px] bg-blue-500/10 text-blue-400 px-1 rounded">vision</span>}
                            {m.supportsTools && <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-1 rounded">tools</span>}
                            {m.priceInput && <span className="text-[11px] bg-amber-500/10 text-amber-400 px-1 rounded">{m.priceInput}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Usage Type */}
            {step === 4 && selectedModel && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="bg-muted/20 rounded-xl p-4 border border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{provider?.icon}</span>
                    <div>
                      <div className="text-sm font-semibold">{selectedModel.name}</div>
                      <div className="text-[11px] text-muted-foreground">{provider?.label}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de Uso</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {USAGE_TYPES.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setUsageType(u.id)}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all text-xs ${
                          usageType === u.id
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/40 bg-card/30 hover:bg-card"
                        }`}
                      >
                        <span className="text-base">{u.icon}</span>
                        <span className="font-medium">{u.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(2)}>Voltar</Button>
                  <Button size="sm" onClick={() => setStep(5)}>Continuar</Button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Test & Save */}
            {step === 5 && selectedModel && (
              <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Resumo da Conexão</div>
                  <div className="bg-muted/20 rounded-xl p-4 border border-border/30 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Provedor</span><span>{provider?.label}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="font-mono">{selectedModel.id}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Uso</span><span>{USAGE_TYPES.find((u) => u.id === usageType)?.label}</span></div>
                    {selectedModel.contextWindow && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Context Window</span><span>{selectedModel.contextWindow.toLocaleString()}</span></div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(4)}>Voltar</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                    Salvar e Ativar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
