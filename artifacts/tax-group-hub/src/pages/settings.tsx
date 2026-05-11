import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Loader2,
  AlertCircle, Crown, MessageSquare, Cpu, Settings as SettingsIcon,
  Trash2, Copy, Plus, Save, UploadCloud,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ModelHub from "@/components/settings/llm/ModelHub";
import { SkeletonSettings } from "@/components/skeletons";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChannelConfig {
  id: number;
  platform: string;
  externalId: string;
  agentId: string;
  config: Record<string, unknown>;
}

interface AgentOption { id: string; name: string; icon: string; }

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "llm",      label: "IA & LLM",   icon: Cpu           },
  { id: "whatsapp", label: "WhatsApp",   icon: MessageSquare  },
  { id: "branding", label: "Identidade", icon: Crown          },
];

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

  if (loading) return <SkeletonSettings />;

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
                    <code className="text-xs text-muted-foreground font-mono truncate max-w-xs">{url}</code>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <p className="text-xs text-muted-foreground mt-1">String de sua escolha — cadastre o mesmo no painel Meta.</p>
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

  if (loading) return <SkeletonSettings />;

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
            ? <img src={branding.logoUrl} className="h-16 object-contain" loading="lazy" alt="Logo" />
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
  const [section, setSection] = useState("llm");

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left nav */}
      <div className="w-52 flex-shrink-0 border-r border-border/30 bg-background/50 flex flex-col py-6 px-3 gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">
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
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {section === "llm" && <ModelHub />}
            {section === "whatsapp" && (
              <div className="max-w-2xl mx-auto px-8 py-8">
                <WhatsAppSection />
              </div>
            )}
            {section === "branding" && (
              <div className="max-w-2xl mx-auto px-8 py-8">
                <BrandingSection />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
