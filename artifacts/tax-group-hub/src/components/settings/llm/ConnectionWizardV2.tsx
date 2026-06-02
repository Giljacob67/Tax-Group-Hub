import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle,
  Loader2, Eye, EyeOff, Key, Link2, Wrench, Braces, Bot,
  Sparkles, MessageSquare, BookOpen, Code, DollarSign, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ProviderMeta, DiscoveredModel, DiagnosticResult, WizardStep, WIZARD_STEPS } from "./types";
import {
  useValidateLlmCredentials,
  useDiscoverLlmModels,
  useCreateLlmConnection,
  useTestLlmConnection,
  useDeleteLlmConnection,
} from "@workspace/api-client-react";

interface ConnectionWizardV2Props {
  providers: ProviderMeta[];
  initialProviderId?: string;
  onClose: () => void;
  onCreated: () => void;
}

const USAGE_OPTIONS = [
  { id: "chat", label: "Chat Comercial", icon: MessageSquare, desc: "Interação natural com leads e clientes" },
  { id: "reasoning", label: "Diagnóstico Tributário", icon: Sparkles, desc: "Análise técnica profunda de cenários fiscais" },
  { id: "fast", label: "RAG / Base de Conhecimento", icon: BookOpen, desc: "Recuperação de informações documentais" },
  { id: "json", label: "Automações JSON", icon: Code, desc: "Saída estruturada para integrações" },
  { id: "vision", label: "Baixo Custo", icon: DollarSign, desc: "Modelo econômico para alto volume" },
  { id: "embedding", label: "Fallback Geral", icon: ShieldAlert, desc: "Backup quando o principal falha" },
];

export function ConnectionWizardV2({ providers, initialProviderId, onClose, onCreated }: ConnectionWizardV2Props) {
  const [step, setStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<ProviderMeta | null>(
    providers.find((p) => p.id === initialProviderId) || null
  );
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<DiagnosticResult[] | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<DiscoveredModel | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [usageType, setUsageType] = useState("chat");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const validateMutate = useValidateLlmCredentials();
  const discoverMutate = useDiscoverLlmModels();
  const createConnMutate = useCreateLlmConnection();
  const testConnMutate = useTestLlmConnection();
  const deleteConnMutate = useDeleteLlmConnection();

  const canAdvance = () => {
    if (step === 1) return !!selectedProvider;
    if (step === 2) {
      if (!selectedProvider) return false;
      if (selectedProvider.needsBaseUrl && !baseUrl.trim()) return false;
      return true;
    }
    if (step === 3) return manualMode || (validationResults && validationResults.every((r) => r.ok));
    if (step === 4) return !!selectedModel;
    if (step === 5) return !!usageType;
    if (step === 6) return manualMode || (testResult && testResult.ok);
    return true;
  };

  const handleValidate = async () => {
    if (!selectedProvider) return;
    setValidating(true);
    setValidationResults(null);
    try {
      const data = await validateMutate.mutateAsync({
        data: { provider: selectedProvider.id, apiKey, baseUrl: baseUrl || undefined },
      });
      setValidationResults((data as any).results || []);
    } catch (err: any) {
      setValidationResults([{ ok: false, stage: "auth", latencyMs: 0, message: err.message, userMessage: "Erro de rede ao validar credenciais." }]);
    } finally {
      setValidating(false);
    }
  };

  const handleDiscover = async () => {
    if (!selectedProvider) return;
    setDiscovering(true);
    try {
      const data = await discoverMutate.mutateAsync({
        data: { provider: selectedProvider.id, apiKey, baseUrl: baseUrl || undefined },
      });
      setDiscoveredModels((data as any).models || []);
    } catch {
      setDiscoveredModels([]);
    } finally {
      setDiscovering(false);
    }
  };

  const handleTest = async () => {
    if (!selectedProvider || !selectedModel) return;
    setTesting(true);
    setTestResult(null);
    try {
      const createResult = await createConnMutate.mutateAsync({
        data: {
          provider: selectedProvider.id,
          apiKey,
          baseUrl: baseUrl || undefined,
          modelId: selectedModel.id,
          modelName: selectedModel.name,
          usageType,
          supportsVision: selectedModel.supportsVision,
          supportsTools: selectedModel.supportsTools,
          supportsJson: selectedModel.supportsJson,
          contextWindow: selectedModel.contextWindow,
        } as any,
      });
      const connId = (createResult as any).connection?.id;
      if (!connId) throw new Error("Falha ao criar conexão de teste");

      const testData = await testConnMutate.mutateAsync({ id: connId });
      await deleteConnMutate.mutateAsync({ id: connId });

      setTestResult({
        ok: testData.ok,
        message: testData.ok ? "Teste bem-sucedido" : testData.error || "Falha no teste",
        latencyMs: testData.executionTimeMs,
      });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || "Erro no teste" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider || !selectedModel) return;
    setSaving(true);
    try {
      await createConnMutate.mutateAsync({
        data: {
          provider: selectedProvider.id,
          apiKey,
          baseUrl: baseUrl || undefined,
          modelId: selectedModel.id,
          modelName: selectedModel.name,
          usageType,
          supportsVision: selectedModel.supportsVision,
          supportsTools: selectedModel.supportsTools,
          supportsJson: selectedModel.supportsJson,
          contextWindow: selectedModel.contextWindow,
        },
      });
      onCreated();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const filteredModels = discoveredModels.filter((m) =>
    !modelSearch || m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nova Conexão</h3>
            <p className="text-xs text-muted-foreground">Passo {step} de 7</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-1 overflow-x-auto">
          {([
            { id: 1, label: "Provedor" },
            { id: 2, label: "Credenciais" },
            { id: 3, label: "Validar" },
            { id: 4, label: "Modelos" },
            { id: 5, label: "Finalidade" },
            { id: 6, label: "Testar" },
            { id: 7, label: "Salvar" },
          ] as const).map((s) => (
            <div key={s.id} className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${step === s.id ? "bg-primary/10 text-primary" : step > s.id ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
              {step > s.id ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[8px]">{s.id}</span>}
              {s.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <p className="text-sm text-muted-foreground">Escolha o provedor de IA que deseja conectar.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvider(p)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${selectedProvider?.id === p.id ? "border-primary bg-primary/5" : "border-border/40 hover:bg-muted/20"}`}
                    >
                      <span className="text-xl">{p.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {p.needsBaseUrl && <Badge variant="outline" className="text-[10px] h-5">Base URL</Badge>}
                          <Badge variant="outline" className="text-[10px] h-5">API Key</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && selectedProvider && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">Insira as credenciais para {selectedProvider.name}.</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{selectedProvider.keyLabel}</label>
                    <div className="relative">
                      <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        type={showKey ? "text" : "password"}
                        placeholder={selectedProvider.keyPlaceholder}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pl-8 pr-8 h-9 text-sm"
                      />
                      <button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {selectedProvider.needsBaseUrl && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Base URL</label>
                      <div className="relative">
                        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder={selectedProvider.baseUrlPlaceholder}
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={manualMode} onChange={(e) => setManualMode(e.target.checked)} className="rounded border-border" />
                  Modo manual — pular validação e testes (avançado)
                </label>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {manualMode ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                    <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">Modo manual ativado</p>
                    <p className="text-xs text-muted-foreground mt-1">A validação será pulada. Use com cuidado.</p>
                  </div>
                ) : (
                  <>
                    <Button onClick={handleValidate} disabled={validating} className="w-full gap-1">
                      {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {validating ? "Validando..." : "Validar credenciais"}
                    </Button>

                    {validationResults && (
                      <div className="space-y-2">
                        {validationResults.map((r, i) => (
                          <div key={i} className={`rounded-lg border p-3 ${r.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                            <div className="flex items-center gap-2">
                              {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                              <span className={`text-sm font-medium ${r.ok ? "text-emerald-400" : "text-red-400"}`}>{r.message}</span>
                            </div>
                            {!r.ok && r.userMessage && <p className="text-xs text-muted-foreground mt-1">{r.userMessage}</p>}
                            {!r.ok && r.howToFix && <p className="text-xs text-amber-400/80 mt-1">{r.howToFix}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button onClick={handleDiscover} disabled={discovering} size="sm" className="gap-1">
                    {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    {discovering ? "Buscando..." : "Buscar modelos"}
                  </Button>
                </div>

                {discoveredModels.length > 0 && (
                  <>
                    <Input placeholder="Filtrar modelos..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} className="h-8 text-sm" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {filteredModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModel(m)}
                          className={`text-left p-2.5 rounded-lg border transition-all ${selectedModel?.id === m.id ? "border-primary bg-primary/5" : "border-border/30 hover:bg-muted/20"}`}
                        >
                          <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {m.contextWindow && <Badge variant="outline" className="text-[10px] h-4">{(m.contextWindow / 1000).toFixed(0)}k</Badge>}
                            {m.supportsTools && <Badge variant="outline" className="text-[10px] h-4 border-emerald-500/20 text-emerald-400">Tools</Badge>}
                            {m.supportsJson && <Badge variant="outline" className="text-[10px] h-4 border-blue-500/20 text-blue-400">JSON</Badge>}
                            {m.supportsVision && <Badge variant="outline" className="text-[10px] h-4 border-amber-500/20 text-amber-400">Vision</Badge>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {discoveredModels.length === 0 && !discovering && (
                  <div className="text-center py-8">
                    <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Clique em "Buscar modelos" para descobrir os disponíveis.</p>
                  </div>
                )}
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <p className="text-sm text-muted-foreground">Qual a finalidade principal desta conexão?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {USAGE_OPTIONS.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setUsageType(u.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${usageType === u.id ? "border-primary bg-primary/5" : "border-border/40 hover:bg-muted/20"}`}
                    >
                      <u.icon className={`w-4 h-4 mt-0.5 ${usageType === u.id ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.label}</p>
                        <p className="text-xs text-muted-foreground">{u.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {manualMode ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                    <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">Modo manual — teste pulado</p>
                    <p className="text-xs text-muted-foreground mt-1">A conexão será salva sem teste real.</p>
                  </div>
                ) : (
                  <>
                    <Button onClick={handleTest} disabled={testing} className="w-full gap-1">
                      {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {testing ? "Testando..." : "Executar teste real"}
                    </Button>

                    {testResult && (
                      <div className={`rounded-lg border p-3 ${testResult.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                        <div className="flex items-center gap-2">
                          {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                          <span className={`text-sm font-medium ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>{testResult.message}</span>
                        </div>
                        {testResult.latencyMs && <p className="text-xs text-muted-foreground mt-1">Latência: {testResult.latencyMs}ms</p>}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {step === 7 && (
              <motion.div key="step7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Resumo da conexão</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Provedor</span><span className="font-medium">{selectedProvider?.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="font-medium">{selectedModel?.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Finalidade</span><span className="font-medium capitalize">{usageType}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Teste</span><span className={testResult?.ok ? "text-emerald-400" : "text-amber-400"}>{testResult?.ok ? "Aprovado" : manualMode ? "Pulado (manual)" : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Recursos</span>
                      <div className="flex gap-1">
                        {selectedModel?.supportsTools && <Wrench className="w-3.5 h-3.5 text-emerald-400" />}
                        {selectedModel?.supportsJson && <Braces className="w-3.5 h-3.5 text-blue-400" />}
                        {selectedModel?.supportsVision && <Eye className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/20 p-2.5 text-xs text-muted-foreground border border-border/30">
                    🔒 Chave API armazenada com criptografia AES-256-GCM. Nunca exposta no frontend.
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full gap-1">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {saving ? "Salvando..." : "Salvar conexão"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </Button>
          <Button size="sm" onClick={() => setStep((s) => Math.min(7, s + 1))} disabled={!canAdvance() || step === 7} className="gap-1">
            Próximo <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
