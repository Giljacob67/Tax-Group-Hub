import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, Save, Wifi, WifiOff,
  AlertCircle, Crown, MessageSquare,
  Trash2, Copy, Plus, RefreshCw, UploadCloud, Cpu,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IntegrationStatus {
  id: string;
  name: string;
  configured: boolean;
  active: boolean;
  category: string;
}

interface SettingsData {
  integrations: IntegrationStatus[];
  activeLLM: string | null;
}

interface ChannelConfig {
  id: number;
  platform: string;
  externalId: string;
  agentId: string;
  config: Record<string, unknown>;
}

interface AgentOption { id: string; name: string; icon: string; }

// ─── Provider definitions ─────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    label: "Google Gemini",
    icon: "✦",
    color: "text-blue-400",
    ring: "ring-blue-500/40",
    dot: "bg-blue-400",
    models: [
      { id: "gemini-2.0-flash-lite",        label: "Gemini 2.0 Flash Lite" },
      { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro Preview" },
      { id: "gemini-1.5-flash",             label: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro",               label: "Gemini 1.5 Pro" },
    ],
    keyLabel: "Gemini API Key",
    keyPlaceholder: "AIzaSy...",
    needsUrl: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    label: "Anthropic Claude",
    icon: "◈",
    color: "text-amber-400",
    ring: "ring-amber-500/40",
    dot: "bg-amber-400",
    models: [
      { id: "claude-sonnet-4-6",           label: "Claude Sonnet 4.6" },
      { id: "claude-3-5-sonnet-20241022",  label: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022",   label: "Claude 3.5 Haiku" },
      { id: "claude-opus-4-7",             label: "Claude Opus 4.7" },
    ],
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    needsUrl: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    label: "OpenAI GPT",
    icon: "⬡",
    color: "text-emerald-400",
    ring: "ring-emerald-500/40",
    dot: "bg-emerald-400",
    models: [
      { id: "gpt-4o",      label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "o3-mini",     label: "o3-mini" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-...",
    needsUrl: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    label: "OpenRouter",
    icon: "⇌",
    color: "text-purple-400",
    ring: "ring-purple-500/40",
    dot: "bg-purple-400",
    models: [
      { id: "meta-llama/llama-3.1-70b-instruct", label: "LLaMA 3.1 70B" },
      { id: "qwen/qwen-2.5-72b-instruct",         label: "Qwen 2.5 72B" },
      { id: "mistralai/mistral-7b-instruct",       label: "Mistral 7B" },
      { id: "google/gemini-flash-1.5",             label: "Gemini 1.5 Flash" },
    ],
    keyLabel: "OpenRouter API Key",
    keyPlaceholder: "sk-or-...",
    needsUrl: false,
  },
  {
    id: "ollama_cloud",
    name: "Ollama",
    label: "Ollama / Custom",
    icon: "☁",
    color: "text-sky-400",
    ring: "ring-sky-500/40",
    dot: "bg-sky-400",
    models: [],
    keyLabel: "Bearer Token (opcional)",
    keyPlaceholder: "Deixe em branco se não houver auth",
    needsUrl: true,
  },
] as const;

type ProviderId = typeof PROVIDERS[number]["id"];

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "llm",      label: "IA & LLM",   icon: Cpu           },
  { id: "whatsapp", label: "WhatsApp",   icon: MessageSquare  },
  { id: "branding", label: "Identidade", icon: Crown          },
];

// ─── LLM Section ──────────────────────────────────────────────────────────────
function LLMSection({
  integrations,
  activeProvider,
  activeModel,
  onActivate,
}: {
  integrations: IntegrationStatus[];
  activeProvider: string;
  activeModel: string;
  onActivate: (provider: string, model: string, customUrl?: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [tab, setTab]           = useState<ProviderId>((activeProvider as ProviderId) || "google");
  const [apiKey, setApiKey]     = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [model, setModel]       = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [activating, setActivating] = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; response?: string } | null>(null);

  const prov = PROVIDERS.find(p => p.id === tab)!;
  const integration = integrations.find(i => i.id === tab);
  const isCurrentlyActive = activeProvider === tab;

  // Reset fields when switching tabs
  useEffect(() => {
    setApiKey("");
    setShowKey(false);
    setTestResult(null);
    if (tab === activeProvider) {
      setModel(activeModel || prov.models[0]?.id || "");
    } else {
      setModel(prov.models[0]?.id || "");
    }
    setCustomUrl("");
  }, [tab]);

  const effectiveModel = prov.needsUrl ? model : (model || prov.models[0]?.id || "");

  async function handleSaveKey() {
    const key = apiKey.trim();
    if (!key) return;
    setSavingKey(true);
    try {
      const r = await fetch("/api/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: prov.id, key }),
      });
      if (!r.ok) throw new Error();
      setApiKey("");
      toast({ title: "Chave salva!" });
    } catch {
      toast({ title: "Erro ao salvar chave", variant: "destructive" });
    } finally {
      setSavingKey(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/settings/active-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: prov.id,
          model: effectiveModel,
          customUrl: prov.needsUrl ? customUrl : undefined,
        }),
      });
      setTestResult(await r.json());
    } catch {
      setTestResult({ success: false, error: "Erro de rede" });
    } finally {
      setTesting(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    await onActivate(prov.id, effectiveModel, prov.needsUrl ? customUrl : undefined);
    setActivating(false);
  }

  return (
    <div className="space-y-6">

      {/* Active provider status */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/20 border border-border/40">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {activeProvider && activeProvider !== "auto" ? (
            <>
              <span className="text-xs text-muted-foreground">Provedor ativo: </span>
              <span className="text-xs font-semibold text-foreground">
                {PROVIDERS.find(p => p.id === activeProvider)?.label ?? activeProvider}
              </span>
              {activeModel && (
                <>
                  <span className="text-xs text-muted-foreground"> · modelo: </span>
                  <code className="text-xs text-primary/80">{activeModel}</code>
                </>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Nenhum provedor ativo. Configure um abaixo.</span>
          )}
        </div>
      </div>

      {/* Provider tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {PROVIDERS.map(p => {
          const configured = integrations.find(i => i.id === p.id)?.configured ?? false;
          const isActive   = activeProvider === p.id;
          const isSelected = tab === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setTab(p.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all border ${
                isSelected
                  ? `bg-card border-border ring-1 ${p.ring} text-foreground shadow-sm`
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <span className={`text-base leading-none ${p.color}`}>{p.icon}</span>
              <span>{p.name}</span>
              {configured && (
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-emerald-400" : "bg-border"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Config panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="bg-card/50 border border-border/50 rounded-2xl p-5 space-y-5"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${prov.color}`}>{prov.icon}</span>
              <span className="font-semibold text-sm">{prov.label}</span>
            </div>
            {isCurrentlyActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold">
                ATIVO
              </span>
            )}
            {integration?.configured && !isCurrentlyActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 font-medium">
                Configurado
              </span>
            )}
          </div>

          {/* API Key row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{prov.keyLabel}</Label>
              {integration?.configured && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Chave salva
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSaveKey()}
                  placeholder={integration?.configured ? "Nova chave para substituir..." : prov.keyPlaceholder}
                  className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-xs font-mono pr-8 focus:ring-1 focus:ring-primary/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveKey}
                disabled={savingKey || !apiKey.trim()}
                className="flex-shrink-0 text-xs px-3"
              >
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Salvar chave"}
              </Button>
            </div>
          </div>

          {/* URL field (Ollama) */}
          {prov.needsUrl && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL do endpoint</Label>
              <Input
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://meu-ollama.com"
                className="text-xs font-mono"
              />
            </div>
          )}

          {/* Model selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Modelo</Label>
            {prov.needsUrl ? (
              <Input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="llama3.2, qwen2.5, mistral..."
                className="text-xs font-mono"
              />
            ) : (
              <div className="relative">
                <select
                  value={effectiveModel}
                  onChange={e => setModel(e.target.value)}
                  className="w-full appearance-none bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary/40 focus:outline-none pr-8"
                >
                  {prov.models.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Test result */}
          <AnimatePresence>
            {testResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`rounded-lg px-3 py-2.5 text-xs border flex items-start gap-2 ${
                  testResult.success
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/5 border-red-500/20 text-red-400"
                }`}
              >
                {testResult.success ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>Conexão OK{testResult.response ? ` · "${testResult.response.slice(0, 80)}"` : ""}</span></>
                ) : (
                  <><WifiOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{testResult.error}</span></>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA row */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || (!integration?.configured && !prov.needsUrl)}
              className="text-xs"
            >
              {testing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
              Testar
            </Button>

            {isCurrentlyActive ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleActivate}
                disabled={activating}
                className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                {activating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Atualizar modelo
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleActivate}
                disabled={activating || (!integration?.configured && !prov.needsUrl)}
                className="flex-1 text-xs"
              >
                {activating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                Usar este provedor
              </Button>
            )}
          </div>

          {!integration?.configured && !prov.needsUrl && (
            <p className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              Salve uma chave de API para testar e ativar.
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5 px-1">
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        Chaves armazenadas com criptografia AES-256. Nenhuma variável de ambiente necessária.
      </p>
    </div>
  );
}

// ─── WhatsApp Section ──────────────────────────────────────────────────────────
function WhatsAppSection() {
  const { toast } = useToast();
  const [channels, setChannels]     = useState<ChannelConfig[]>([]);
  const [agents, setAgents]         = useState<AgentOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ phoneNumberId: "", accessToken: "", verifyToken: "", agentId: "" });

  useEffect(() => {
    Promise.all([fetch("/api/settings/channels"), fetch("/api/agents")]).then(async ([chRes, agRes]) => {
      if (chRes.ok) { const d = await chRes.json(); setChannels((d.channels || []).filter((c: ChannelConfig) => c.platform === "whatsapp")); }
      if (agRes.ok) { const d = await agRes.json(); setAgents(d.agents || []); }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!form.phoneNumberId || !form.accessToken || !form.verifyToken || !form.agentId) {
      toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/settings/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "whatsapp",
          externalId: form.phoneNumberId,
          agentId: form.agentId,
          config: { accessToken: form.accessToken, verifyToken: form.verifyToken, phoneNumberId: form.phoneNumberId },
        }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setWebhookUrl(`${window.location.origin}/api/webhooks/whatsapp/${d.channel.id}`);
      toast({ title: "Canal criado!" });
      setForm({ phoneNumberId: "", accessToken: "", verifyToken: "", agentId: "" });
      const upd = await fetch("/api/settings/channels");
      if (upd.ok) { const d2 = await upd.json(); setChannels((d2.channels || []).filter((c: ChannelConfig) => c.platform === "whatsapp")); }
      setShowForm(false);
    } catch {
      toast({ title: "Erro ao salvar canal", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/settings/channels/${id}`, { method: "DELETE" });
      toast({ title: "Canal removido" });
      setChannels(prev => prev.filter(c => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast({ title: "Copiado!" }); };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Canais WhatsApp</p>
          <p className="text-xs text-muted-foreground mt-0.5">Conecte números do WhatsApp Business API a agentes de IA.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setShowForm(v => !v); setWebhookUrl(null); }}>
          {showForm ? "Cancelar" : <><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar</>}
        </Button>
      </div>

      {channels.length > 0 && (
        <div className="space-y-2">
          {channels.map(ch => {
            const agent = agents.find(a => a.id === ch.agentId);
            const url   = `${window.location.origin}/api/webhooks/whatsapp/${ch.id}`;
            return (
              <div key={ch.id} className="flex items-center gap-3 bg-card/50 border border-border/40 rounded-xl px-4 py-3">
                <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{agent ? `${agent.icon} ${agent.name}` : ch.agentId}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="text-[10px] text-muted-foreground font-mono truncate max-w-xs">{url}</code>
                    <button onClick={() => copy(url)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm"
                  className="text-muted-foreground hover:text-red-400 h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => handleDelete(ch.id)}
                  disabled={deletingId === ch.id}
                >
                  {deletingId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {channels.length === 0 && !showForm && (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl">
          Nenhum canal configurado. Clique em "Adicionar" para começar.
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card/50 border border-border/40 rounded-xl p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Obtenha o <strong className="text-foreground">Phone Number ID</strong> e <strong className="text-foreground">Access Token</strong> em{" "}
                Meta for Developers → WhatsApp → API Setup.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Phone Number ID <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="123456789..."
                    value={form.phoneNumberId}
                    onChange={e => setForm(p => ({ ...p, phoneNumberId: e.target.value }))}
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Agente Responsável <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <select
                      value={form.agentId}
                      onChange={e => setForm(p => ({ ...p, agentId: e.target.value }))}
                      className="w-full appearance-none bg-background border border-border/50 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary/40 focus:outline-none pr-7"
                    >
                      <option value="">— Selecionar —</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Access Token <span className="text-red-400">*</span></Label>
                  <Input
                    type="password"
                    placeholder="EAAxxxxxxxx..."
                    value={form.accessToken}
                    onChange={e => setForm(p => ({ ...p, accessToken: e.target.value }))}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Verify Token <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="seu-token-secreto"
                    value={form.verifyToken}
                    onChange={e => setForm(p => ({ ...p, verifyToken: e.target.value }))}
                    className="text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">String de sua escolha — cadastre o mesmo no painel Meta.</p>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar Canal
              </Button>

              <AnimatePresence>
                {webhookUrl && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Canal criado! Registre o webhook no Meta:
                    </div>
                    <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border/40">
                      <code className="text-xs font-mono text-primary flex-1 break-all">{webhookUrl}</code>
                      <button onClick={() => copy(webhookUrl)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Meta → WhatsApp → Configuração → Webhooks → Editar. Cole esta URL e o Verify Token. Subscreva ao campo{" "}
                      <code className="text-primary">messages</code>.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Branding Section ─────────────────────────────────────────────────────────
function BrandingSection() {
  const { toast } = useToast();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [branding, setBranding] = useState({ companyName: "", primaryColor: "#107ec2", customDomain: "", logoUrl: "" });

  useEffect(() => {
    fetch("/api/branding/config").then(r => r.json()).then(d => {
      if (d.id) setBranding({
        companyName: d.companyName,
        primaryColor: d.primaryColor,
        customDomain: d.customDomain || "",
        logoUrl: d.logoStorageKey ? `/uploads/${d.logoStorageKey}` : "",
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch("/api/branding/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (r.ok) { toast({ title: "Identidade salva! Recarregando..." }); setTimeout(() => window.location.reload(), 1200); }
      else throw new Error();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("logo", file);
    setSaving(true);
    try {
      const r = await fetch("/api/branding/logo", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) { setBranding(p => ({ ...p, logoUrl: d.logoUrl })); toast({ title: "Logo atualizada!" }); }
    } catch {
      toast({ title: "Erro no upload", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold">Identidade Visual</p>
        <p className="text-xs text-muted-foreground mt-0.5">Personalize o nome, cores e logo do portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Nome da Empresa</Label>
            <Input value={branding.companyName} onChange={e => setBranding(p => ({ ...p, companyName: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Cor Primária</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={branding.primaryColor}
                onChange={e => setBranding(p => ({ ...p, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded-lg cursor-pointer border border-border/50 bg-transparent"
              />
              <Input
                value={branding.primaryColor}
                onChange={e => setBranding(p => ({ ...p, primaryColor: e.target.value }))}
                className="font-mono text-sm flex-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Domínio Customizado</Label>
            <Input
              placeholder="hub.suaempresa.com"
              value={branding.customDomain}
              onChange={e => setBranding(p => ({ ...p, customDomain: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border/30 rounded-2xl p-6 bg-muted/10">
          {branding.logoUrl
            ? <img src={branding.logoUrl} className="h-16 object-contain" alt="Logo" />
            : <Crown className="w-12 h-12 text-muted-foreground/30" />
          }
          <label className="cursor-pointer bg-card border border-border/50 hover:border-primary/40 text-sm px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2">
            <UploadCloud className="w-4 h-4" /> Alterar Logo
            <input type="file" className="hidden" accept="image/*" onChange={handleLogo} />
          </label>
          <p className="text-[11px] text-muted-foreground">PNG, SVG ou JPG — recomendado fundo transparente</p>
        </div>
      </div>

      <div className="pt-4 border-t border-border/30 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Identidade
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { toast } = useToast();
  const [section, setSection]               = useState("llm");
  const [data, setData]                     = useState<SettingsData | null>(null);
  const [loading, setLoading]               = useState(true);
  const [activeProvider, setActiveProvider] = useState("auto");
  const [activeModel, setActiveModel]       = useState("");

  async function fetchSettings() {
    try {
      const [intRes, provRes] = await Promise.all([
        fetch("/api/settings/integrations"),
        fetch("/api/settings/active-provider"),
      ]);
      if (intRes.ok)  setData(await intRes.json());
      if (provRes.ok) {
        const p = await provRes.json();
        setActiveProvider(p.provider || "auto");
        setActiveModel(p.model || "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSettings(); }, []);

  async function handleActivate(provider: string, model: string, customUrl?: string) {
    try {
      const r = await fetch("/api/settings/active-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, customUrl: customUrl ?? "" }),
      });
      if (!r.ok) throw new Error();
      setActiveProvider(provider);
      setActiveModel(model);
      toast({ title: `${PROVIDERS.find(p => p.id === provider)?.label ?? provider} ativado!` });
      fetchSettings();
    } catch {
      toast({ title: "Erro ao ativar provedor", variant: "destructive" });
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );

  const integrations = data?.integrations ?? [];

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left nav */}
      <div className="w-52 flex-shrink-0 border-r border-border/30 bg-background/50 flex flex-col py-6 px-3 gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">
          Configurações
        </p>
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
              section === item.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {section === "llm" && (
                <LLMSection
                  integrations={integrations.filter(i => i.category === "llm")}
                  activeProvider={activeProvider}
                  activeModel={activeModel}
                  onActivate={handleActivate}
                />
              )}
              {section === "whatsapp" && <WhatsAppSection />}
              {section === "branding"  && <BrandingSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
