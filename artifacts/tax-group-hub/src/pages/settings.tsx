import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, CheckCircle2, XCircle, Server, Cloud, Loader2,
  ExternalLink, Cpu, Zap, Eye, EyeOff, Save, Wifi, WifiOff,
  AlertCircle, Crown, Brain, MessageSquare, Trash2, Copy,
  Plus, ChevronDown, ChevronRight, RefreshCw, Radio, UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────
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

interface ChannelConfig {
  id: number;
  platform: string;
  externalId: string;
  agentId: string;
  config: Record<string, unknown>;
}

interface AgentOption { id: string; name: string; icon: string; }

// ─── Provider config ──────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: "google",
    name: "Google Gemini",
    icon: "✦",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    models: [
      { id: "gemini-2.0-flash-lite",        label: "Gemini 2.0 Flash Lite  · rápido" },
      { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro Preview · mais capaz" },
      { id: "gemini-1.5-flash",             label: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro",               label: "Gemini 1.5 Pro" },
    ],
    keyPlaceholder: "AIzaSy...",
    needsUrl: false,
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    icon: "◈",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    models: [
      { id: "claude-sonnet-4-6",            label: "Claude Sonnet 4.6 · recomendado" },
      { id: "claude-3-5-sonnet-20241022",   label: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022",    label: "Claude 3.5 Haiku · rápido" },
      { id: "claude-opus-4-7",             label: "Claude Opus 4.7 · máximo" },
    ],
    keyPlaceholder: "sk-ant-...",
    needsUrl: false,
  },
  {
    id: "openai",
    name: "OpenAI GPT",
    icon: "⬡",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    models: [
      { id: "gpt-4o",      label: "GPT-4o · recomendado" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini · rápido" },
      { id: "o3-mini",     label: "o3-mini · raciocínio" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
    keyPlaceholder: "sk-...",
    needsUrl: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "⇌",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    models: [
      { id: "meta-llama/llama-3.1-70b-instruct", label: "LLaMA 3.1 70B" },
      { id: "qwen/qwen-2.5-72b-instruct",         label: "Qwen 2.5 72B" },
      { id: "mistralai/mistral-7b-instruct",       label: "Mistral 7B · econômico" },
      { id: "google/gemini-flash-1.5",             label: "Gemini 1.5 Flash via OR" },
    ],
    keyPlaceholder: "sk-or-...",
    needsUrl: false,
  },
  {
    id: "ollama_cloud",
    name: "Ollama Cloud",
    icon: "☁",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    models: [],
    keyPlaceholder: "Bearer token (opcional)",
    needsUrl: true,
  },
];

// ─── Section nav ──────────────────────────────────────────────────────────────
const NAV = [
  { id: "llm",       label: "IA & LLM",   icon: Cpu          },
  { id: "whatsapp",  label: "WhatsApp",    icon: MessageSquare },
  { id: "branding",  label: "Identidade", icon: Crown        },
];

// ─── LLM Section ─────────────────────────────────────────────────────────────
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
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeInfo = PROVIDERS.find(p => p.id === activeProvider);
  const activeInt  = integrations.find(i => i.id === activeProvider);

  return (
    <div className="space-y-6">
      {/* Active provider banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${
        activeInfo
          ? `${activeInfo.bg} ${activeInfo.border}`
          : "bg-muted/20 border-border/40"
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold ${activeInfo?.bg ?? "bg-muted/40"}`}>
          {activeInfo?.icon ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">
              {activeInfo?.name ?? (activeProvider === "auto" ? "Automático" : activeProvider)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold">
              ATIVO
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {activeModel
              ? <span>Modelo: <code className="text-foreground/80">{activeModel}</code></span>
              : <span>Nenhum modelo selecionado</span>
            }
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse`} />
      </div>

      {/* Provider list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Provedores disponíveis
        </p>
        {PROVIDERS.map(prov => {
          const integration = integrations.find(i => i.id === prov.id);
          const isActive   = activeProvider === prov.id;
          const isOpen     = expanded === prov.id;
          const configured = integration?.configured ?? false;

          return (
            <div
              key={prov.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isActive
                  ? `${prov.border} ring-1 ring-offset-0 ${prov.bg}`
                  : "border-border/40 bg-card/50 hover:border-border/70"
              }`}
            >
              {/* Row */}
              <button
                onClick={() => setExpanded(isOpen ? null : prov.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className={`text-lg w-7 text-center font-bold ${prov.color}`}>{prov.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{prov.name}</span>
                    {isActive && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${prov.bg} ${prov.color} border ${prov.border}`}>
                        ativo
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {configured
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-muted-foreground/40" />
                  }
                  <span className={`text-xs ${configured ? "text-emerald-400" : "text-muted-foreground/50"}`}>
                    {configured ? "Chave salva" : "Sem chave"}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Expanded config */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ProviderConfig
                      prov={prov}
                      integration={integration}
                      activeProvider={activeProvider}
                      activeModel={activeModel}
                      onActivate={onActivate}
                      onClose={() => setExpanded(null)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* BYOK note */}
      <div className="rounded-xl border border-border/30 bg-muted/10 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary/60" />
        <span>
          Chaves armazenadas com criptografia AES-256. Nenhuma variável de ambiente necessária — configure aqui e use instantaneamente.
        </span>
      </div>
    </div>
  );
}

// ─── Provider Config (inline expanded) ───────────────────────────────────────
function ProviderConfig({
  prov, integration, activeProvider, activeModel, onActivate, onClose,
}: {
  prov: typeof PROVIDERS[0];
  integration: IntegrationStatus | undefined;
  activeProvider: string;
  activeModel: string;
  onActivate: (provider: string, model: string, customUrl?: string) => Promise<void>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const keyRef    = useRef<HTMLInputElement>(null);
  const isActive  = activeProvider === prov.id;

  const [showKey, setShowKey]       = useState(false);
  const [savingKey, setSavingKey]   = useState(false);
  const [model, setModel]           = useState(isActive ? activeModel : prov.models[0]?.id ?? "");
  const [customModel, setCustomModel] = useState(isActive ? activeModel : "");
  const [customUrl, setCustomUrl]   = useState("");
  const [activating, setActivating] = useState(false);
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; response?: string } | null>(null);

  async function saveKey() {
    const key = keyRef.current?.value?.trim();
    if (!key) return;
    setSavingKey(true);
    try {
      const r = await fetch("/api/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: prov.id, key }),
      });
      if (!r.ok) throw new Error("Falha");
      if (keyRef.current) keyRef.current.value = "";
      toast({ title: "✅ Chave salva com sucesso" });
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
          model: prov.needsUrl ? customModel : model,
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
    const m = prov.needsUrl ? customModel : model;
    await onActivate(prov.id, m, prov.needsUrl ? customUrl : undefined);
    setActivating(false);
    onClose();
  }

  const finalModel = prov.needsUrl ? customModel : model;

  return (
    <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-4">

      {/* API Key */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">
          Chave de API
          {integration?.configured && (
            <span className="ml-2 text-emerald-400">· chave atual salva</span>
          )}
        </Label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={keyRef}
              type={showKey ? "text" : "password"}
              placeholder={integration?.configured ? "Nova chave para substituir..." : prov.keyPlaceholder}
              className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-xs font-mono pr-8 focus:ring-1 focus:ring-primary/50 focus:outline-none"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <Button size="sm" onClick={saveKey} disabled={savingKey} className="flex-shrink-0 text-xs">
            {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </div>

      {/* URL (Ollama Cloud) */}
      {prov.needsUrl && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">URL do Endpoint</Label>
          <Input
            type="text"
            placeholder="https://meu-ollama.com"
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            className="text-xs font-mono"
          />
        </div>
      )}

      {/* Model */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo</Label>
        {prov.needsUrl ? (
          <Input
            type="text"
            placeholder="llama3.2, qwen2.5..."
            value={customModel}
            onChange={e => setCustomModel(e.target.value)}
            className="text-xs font-mono"
          />
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {prov.models.map(m => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`px-3 py-2 rounded-lg text-left text-xs border transition-all ${
                  model === m.id
                    ? `${prov.bg} ${prov.border} ${prov.color} font-semibold`
                    : "bg-background border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`rounded-lg px-3 py-2 text-xs border flex items-center gap-2 ${
          testResult.success
            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
            : "bg-red-500/5 border-red-500/20 text-red-400"
        }`}>
          {testResult.success
            ? <><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> Conexão OK {testResult.response && `· "${testResult.response.slice(0, 60)}"`}</>
            : <><WifiOff className="w-3.5 h-3.5 flex-shrink-0" /> {testResult.error}</>
          }
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
          className="flex-1 text-xs"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wifi className="w-3.5 h-3.5 mr-1" />}
          Testar conexão
        </Button>
        {isActive ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-primary font-semibold px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Provedor ativo
          </div>
        ) : (
          <Button
            size="sm"
            onClick={handleActivate}
            disabled={activating || (!integration?.configured && !prov.needsUrl)}
            className="flex-1 text-xs bg-primary hover:bg-primary/90"
          >
            {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
            Usar este
          </Button>
        )}
      </div>

      {!integration?.configured && !prov.needsUrl && (
        <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          Salve uma chave de API antes de ativar.
        </p>
      )}
    </div>
  );
}

// ─── WhatsApp Section ─────────────────────────────────────────────────────────
function WhatsAppSection() {
  const { toast } = useToast();
  const [channels, setChannels]       = useState<ChannelConfig[]>([]);
  const [agents, setAgents]           = useState<AgentOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [webhookUrl, setWebhookUrl]   = useState<string | null>(null);
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
        body: JSON.stringify({ platform: "whatsapp", externalId: form.phoneNumberId, agentId: form.agentId,
          config: { accessToken: form.accessToken, verifyToken: form.verifyToken, phoneNumberId: form.phoneNumberId } }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setWebhookUrl(`${window.location.origin}/api/webhooks/whatsapp/${d.channel.id}`);
      toast({ title: "✅ Canal criado!" });
      setForm({ phoneNumberId: "", accessToken: "", verifyToken: "", agentId: "" });
      const upd = await fetch("/api/settings/channels");
      if (upd.ok) { const d2 = await upd.json(); setChannels((d2.channels || []).filter((c: ChannelConfig) => c.platform === "whatsapp")); }
    } catch { toast({ title: "Erro ao salvar canal", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/settings/channels/${id}`, { method: "DELETE" });
      toast({ title: "Canal removido" });
      setChannels(prev => prev.filter(c => c.id !== id));
    } finally { setDeletingId(null); }
  }

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast({ title: "Copiado!" }); };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Canais WhatsApp</p>
          <p className="text-xs text-muted-foreground mt-0.5">Conecte números do WhatsApp Business API à agentes de IA.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setShowForm(v => !v); setWebhookUrl(null); }}>
          {showForm ? "Cancelar" : <><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar</>}
        </Button>
      </div>

      {/* Existing channels */}
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
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-400 h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => handleDelete(ch.id)} disabled={deletingId === ch.id}>
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

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-background/60 border border-border/40 rounded-xl p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Obtenha o <strong>Phone Number ID</strong> e <strong>Access Token</strong> em{" "}
                <span className="text-foreground">Meta for Developers → WhatsApp → API Setup</span>.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Phone Number ID <span className="text-red-400">*</span></Label>
                  <Input placeholder="123456789..." value={form.phoneNumberId}
                    onChange={e => setForm(p => ({ ...p, phoneNumberId: e.target.value }))} className="text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Agente Responsável <span className="text-red-400">*</span></Label>
                  <select value={form.agentId} onChange={e => setForm(p => ({ ...p, agentId: e.target.value }))}
                    className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary/50 focus:outline-none">
                    <option value="">— Selecionar —</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Access Token <span className="text-red-400">*</span></Label>
                  <Input type="password" placeholder="EAAxxxxxxxx..." value={form.accessToken}
                    onChange={e => setForm(p => ({ ...p, accessToken: e.target.value }))} className="text-xs font-mono" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Verify Token <span className="text-red-400">*</span></Label>
                  <Input placeholder="seu-token-secreto" value={form.verifyToken}
                    onChange={e => setForm(p => ({ ...p, verifyToken: e.target.value }))} className="text-xs font-mono" />
                  <p className="text-[10px] text-muted-foreground mt-1">String de sua escolha — cadastre o mesmo no painel Meta.</p>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar Canal
              </Button>

              {/* Webhook URL after creation */}
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
                      Meta → WhatsApp → Configuração → Webhooks → Editar. Cole esta URL e o Verify Token. Subscreva ao campo <code className="text-primary">messages</code>.
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
      if (d.id) setBranding({ companyName: d.companyName, primaryColor: d.primaryColor,
        customDomain: d.customDomain || "", logoUrl: d.logoStorageKey ? `/uploads/${d.logoStorageKey}` : "" });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch("/api/branding/update", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(branding) });
      if (r.ok) { toast({ title: "✅ Identidade salva! Recarregando..." }); setTimeout(() => window.location.reload(), 1200); }
      else throw new Error();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("logo", file);
    setSaving(true);
    try {
      const r = await fetch("/api/branding/logo", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) { setBranding(p => ({ ...p, logoUrl: d.logoUrl })); toast({ title: "Logo atualizada!" }); }
    } catch { toast({ title: "Erro no upload", variant: "destructive" }); }
    finally { setSaving(false); }
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
              <input type="color" value={branding.primaryColor}
                onChange={e => setBranding(p => ({ ...p, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded-lg cursor-pointer border border-border/50 bg-transparent" />
              <Input value={branding.primaryColor} onChange={e => setBranding(p => ({ ...p, primaryColor: e.target.value }))}
                className="font-mono text-sm flex-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Domínio Customizado</Label>
            <Input placeholder="hub.suaempresa.com" value={branding.customDomain}
              onChange={e => setBranding(p => ({ ...p, customDomain: e.target.value }))} />
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
  const [section, setSection]         = useState("llm");
  const [data, setData]               = useState<SettingsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [activeProvider, setActiveProvider] = useState("auto");
  const [activeModel, setActiveModel] = useState("");

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
    } finally { setLoading(false); }
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
      toast({ title: `✅ ${PROVIDERS.find(p => p.id === provider)?.name ?? provider} ativado!` });
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
      {/* ── Left nav ── */}
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

      {/* ── Content ── */}
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
