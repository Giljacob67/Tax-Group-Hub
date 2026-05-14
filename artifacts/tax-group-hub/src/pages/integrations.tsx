import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon, Link2, Sparkles, PenTool, Loader2, Plus, Activity,
  Zap, Webhook, FileText, Key, Search, Filter, CheckCircle2, AlertCircle,
  Clock, Copy, Check, ExternalLink, ChevronRight, Play, Pause,
  LayoutGrid, RefreshCw, Eye, EyeOff, Trash2, Settings,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  useGenerateImage,
  useGetCanvaLink,
  useGetIntegrationSettings,
  useGetCustomKeys,
  useSetCustomKey,
  useDeleteCustomKey,
  useGetImageGallery,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  INTEGRATIONS_CATALOG,
  INTEGRATION_CATEGORIES,
  AUTOMATION_RECIPES,
  WEBHOOK_EVENTS,
  DEMO_LOGS,
  IMAGE_PRESETS,
  CANVA_TEMPLATES,
  type IntegrationCategory,
  type IntegrationStatus,
} from "@/lib/integrations-catalog";

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(status: IntegrationStatus) {
  if (status === "connected") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (status === "error") return "text-red-400 bg-red-400/10 border-red-400/20";
  if (status === "available") return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
}

function statusLabel(status: IntegrationStatus) {
  if (status === "connected") return "Conectada";
  if (status === "error") return "Erro";
  if (status === "available") return "Disponível";
  return "Em breve";
}

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function HealthCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function IntegrationCard({ entry, onCta }: {
  entry: (typeof INTEGRATIONS_CATALOG)[0];
  onCta: (id: string) => void;
}) {
  const isComingSoon = entry.status === "coming_soon";
  return (
    <div className={`bg-card border border-border rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-border/80 ${isComingSoon ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{entry.emoji}</span>
          <div>
            <div className="font-semibold text-sm leading-tight">{entry.name}</div>
            <div className="text-xs text-muted-foreground">{entry.category}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor(entry.status)}`}>
            {statusLabel(entry.status)}
          </span>
          {entry.badge && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
              {entry.badge}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{entry.description}</p>
      <div className="flex flex-wrap gap-1">
        {entry.tags.map(t => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
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

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Integrations() {
  usePageTitle("Central de Integrações");
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState("catalogo");

  // Catalog filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IntegrationCategory | "Todas">("Todas");

  // Image generation
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgPreset, setImgPreset] = useState<string>(IMAGE_PRESETS[0].id);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const imageMutation = useGenerateImage();

  // Canva
  const [canvaTemplate, setCanvaTemplate] = useState<string>(CANVA_TEMPLATES[0].id);
  const canvaMutation = useGetCanvaLink();

  // Logs filter
  const [logFilter, setLogFilter] = useState<"all" | "success" | "error">("all");

  // Credentials
  const { data: customKeys } = useGetCustomKeys();
  const setKeyMutation = useSetCustomKey();
  const deleteKeyMutation = useDeleteCustomKey();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  // Webhooks copy state
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgPrompt.trim()) return;
    const preset = IMAGE_PRESETS.find(p => p.id === imgPreset) ?? IMAGE_PRESETS[0];
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
      const res = await canvaMutation.mutateAsync({ data: { contentType: canvaTemplate } });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Falha ao gerar link do Canva", variant: "destructive" });
    }
  };

  const handleCatalogCta = (id: string) => {
    if (id === "canva") {
      setActiveTab("catalogo");
      return;
    }
    if (id === "google-drive") {
      toast({ title: "Google Drive", description: "Em breve: integração com Google Drive." });
      return;
    }
    if (id === "make") {
      window.open("https://make.com", "_blank", "noopener,noreferrer");
      return;
    }
    toast({ description: `Configuração de "${id}" disponível em Configurações.` });
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    try {
      await setKeyMutation.mutateAsync({ data: { provider: newKeyName.trim(), key: newKeyValue.trim() } });
      setNewKeyName("");
      setNewKeyValue("");
      setShowNewKey(false);
      toast({ title: "Credencial salva com segurança" });
    } catch {
      toast({ title: "Erro ao salvar credencial", variant: "destructive" });
    }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      await deleteKeyMutation.mutateAsync({ provider });
      toast({ title: "Credencial removida" });
    } catch {
      toast({ title: "Erro ao remover credencial", variant: "destructive" });
    }
  };

  const handleCopyWebhook = () => {
    const url = `${window.location.origin}/api/webhooks/inbound`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const [copiedProvider, setCopiedProvider] = useState<string | null>(null);

  const handleCopyProvider = (provider: string) => {
    navigator.clipboard.writeText(provider);
    setCopiedProvider(provider);
    setTimeout(() => setCopiedProvider(null), 2000);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredCatalog = useMemo(() => {
    return INTEGRATIONS_CATALOG.filter(e => {
      const matchCat = categoryFilter === "Todas" || e.category === categoryFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.tags.some(t => t.includes(q));
      return matchCat && matchSearch;
    });
  }, [search, categoryFilter]);

  const connectedIntegrations = INTEGRATIONS_CATALOG.filter(e => e.status === "connected");
  const errorIntegrations = INTEGRATIONS_CATALOG.filter(e => e.status === "error");
  const activeAutomations = AUTOMATION_RECIPES.filter(r => r.status === "active").length;
  const filteredLogs = DEMO_LOGS.filter(l => logFilter === "all" || l.status === logFilter);

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : "https://app.taxgrouphub.com.br"}/api/webhooks/inbound`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Central de Integrações</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Conecte ferramentas, automatize fluxos e gerencie credenciais em um só lugar.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toast({ description: "Configure integrações nas configurações do sistema." })}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              <Plus className="w-4 h-4" /> Nova integração
            </button>
            <button
              onClick={() => toast({ description: "Teste de conectividade iniciado..." })}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              <Activity className="w-4 h-4" /> Testar
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
            value={connectedIntegrations.length}
            icon={CheckCircle2}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <HealthCard
            label="Com erros"
            value={errorIntegrations.length}
            icon={AlertCircle}
            color="bg-red-500/10 text-red-400"
          />
          <HealthCard
            label="Automações ativas"
            value={activeAutomations}
            icon={Zap}
            color="bg-yellow-500/10 text-yellow-400"
          />
          <HealthCard
            label="Webhooks ativos"
            value={WEBHOOK_EVENTS.length}
            icon={Webhook}
            color="bg-blue-500/10 text-blue-400"
          />
          <HealthCard
            label="Último disparo"
            value="10:42"
            sub="WhatsApp · hoje"
            icon={Clock}
            color="bg-purple-500/10 text-purple-400"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto p-1 bg-card border border-border">
            {[
              { id: "catalogo", label: "Catálogo", icon: LayoutGrid },
              { id: "conectadas", label: "Conectadas", icon: CheckCircle2 },
              { id: "automacoes", label: "Automações", icon: Zap },
              { id: "webhooks", label: "Webhooks", icon: Webhook },
              { id: "logs", label: "Logs", icon: FileText },
              { id: "credenciais", label: "Credenciais", icon: Key },
            ].map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 text-xs py-2">
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Catálogo ─────────────────────────────────────────────────── */}
          <TabsContent value="catalogo" className="mt-6 space-y-6">
            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar integrações..."
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["Todas", ...INTEGRATION_CATEGORIES] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat as IntegrationCategory | "Todas")}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      categoryFilter === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured tools (connected/enhanced) */}
            {categoryFilter === "Todas" && !search && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold">Ferramentas Ativas</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Image Generation - enhanced */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <div className="p-5 border-b border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center border border-primary/25">
                        <ImageIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Geração de Imagens</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">Conectada</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Google Gemini Imagen</p>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-medium mb-2 block text-muted-foreground">Preset de formato</label>
                        <div className="grid grid-cols-3 gap-2">
                          {IMAGE_PRESETS.map(p => (
                            <button
                              key={p.id}
                              onClick={() => setImgPreset(p.id)}
                              className={`py-1.5 px-2 rounded-lg border text-xs transition-all text-center ${
                                imgPreset === p.id
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "bg-background border-border hover:border-primary/40 text-muted-foreground"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <form onSubmit={handleGenerateImage} className="space-y-3">
                        <textarea
                          value={imgPrompt}
                          onChange={e => setImgPrompt(e.target.value)}
                          placeholder="Descreva a imagem — ex: profissional tributarista em reunião, estilo corporativo moderno..."
                          className="w-full bg-background border border-border rounded-lg p-3 text-sm min-h-[80px] focus:ring-1 focus:ring-primary outline-none resize-none"
                        />
                        <button
                          type="submit"
                          disabled={imageMutation.isPending || !imgPrompt.trim()}
                          className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {imageMutation.isPending
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                            : <><Sparkles className="w-4 h-4" /> Gerar Imagem</>}
                        </button>
                      </form>
                      <AnimatePresence>
                        {generatedImg && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                            className="rounded-lg overflow-hidden border border-border relative group"
                          >
                            <img src={generatedImg} loading="lazy" alt="Gerada" className="w-full h-auto" />
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

                  {/* Canva - enhanced */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <div className="p-5 border-b border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center border border-primary/25">
                        <PenTool className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Espaço Canva</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">Conectada</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Templates tributários prontos</p>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-medium mb-2 block text-muted-foreground">Tipo de template</label>
                        <div className="grid grid-cols-2 gap-2">
                          {CANVA_TEMPLATES.map(t => (
                            <button
                              key={t.id}
                              onClick={() => setCanvaTemplate(t.id)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                canvaTemplate === t.id
                                  ? "bg-primary/10 border-primary"
                                  : "bg-background border-border hover:border-primary/40"
                              }`}
                            >
                              <div className="text-lg mb-1">{t.emoji}</div>
                              <div className={`text-xs font-medium ${canvaTemplate === t.id ? "text-primary" : ""}`}>{t.label}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={handleCanvaLink}
                        disabled={canvaMutation.isPending}
                        className="w-full py-2.5 px-4 border-2 border-primary bg-primary/5 hover:bg-primary/15 text-primary rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {canvaMutation.isPending
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Abrindo...</>
                          : <><Link2 className="w-4 h-4" /> Abrir no Canva<ExternalLink className="w-3 h-3 opacity-60" /></>}
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>
            )}

            {/* Catalog grid */}
            <div>
              {categoryFilter !== "Todas" || search ? (
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {filteredCatalog.length} integrações
                    {categoryFilter !== "Todas" && ` em ${categoryFilter}`}
                    {search && ` para "${search}"`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4">
                  <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Todas as integrações</h2>
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

          {/* ── Conectadas ───────────────────────────────────────────────── */}
          <TabsContent value="conectadas" className="mt-6">
            <div className="space-y-3">
              {connectedIntegrations.length === 0 && (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  Nenhuma integração conectada ainda.
                </div>
              )}
              {connectedIntegrations.map(entry => (
                <div key={entry.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <span className="text-2xl">{entry.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{entry.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColor(entry.status)}`}>
                        {statusLabel(entry.status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toast({ description: `Reconectando ${entry.name}...` })}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Reconectar"
                    >
                      <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => toast({ description: `Configurações de ${entry.name}.` })}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Configurar"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Automações ───────────────────────────────────────────────── */}
          <TabsContent value="automacoes" className="mt-6">
            <div className="space-y-3">
              {AUTOMATION_RECIPES.map(recipe => (
                <div key={recipe.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
                  <span className="text-2xl mt-0.5">{recipe.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{recipe.name}</span>
                      {recipe.status === "coming_soon" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-400/10 border border-zinc-400/20 text-zinc-400">Em breve</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{recipe.description}</p>
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
                        onCheckedChange={() => toast({ description: "Configuração de automações disponível em breve." })}
                      />
                    )}
                    {recipe.status === "active" ? (
                      <span className="text-[10px] text-emerald-400">Ativa</span>
                    ) : recipe.status === "inactive" ? (
                      <span className="text-[10px] text-zinc-400">Inativa</span>
                    ) : (
                      <span className="text-[10px] text-zinc-500">Em breve</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Webhooks ─────────────────────────────────────────────────── */}
          <TabsContent value="webhooks" className="mt-6 space-y-6">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">URL de Webhook de Entrada</h3>
                <p className="text-xs text-muted-foreground mb-3">Use esta URL em plataformas externas para enviar eventos ao Tax Group Hub.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2.5 font-mono text-primary truncate">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={handleCopyWebhook}
                    className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors shrink-0"
                    title="Copiar URL"
                  >
                    {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold text-sm mb-3">Eventos disponíveis</h3>
                <div className="space-y-2">
                  {WEBHOOK_EVENTS.map(ev => (
                    <div key={ev.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                      <div className="flex-1 min-w-0">
                        <code className="text-xs font-mono text-primary">{ev.name}</code>
                        <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                      </div>
                      <button
                        onClick={() => toast({ description: `Evento ${ev.name} simulado.` })}
                        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/80 transition-colors"
                      >
                        <Play className="w-3 h-3" /> Testar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Logs ─────────────────────────────────────────────────────── */}
          <TabsContent value="logs" className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              {(["all", "success", "error"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    logFilter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  {f === "all" ? "Todos" : f === "success" ? "Sucesso" : "Erros"}
                </button>
              ))}
              <button
                onClick={() => toast({ description: "Logs atualizados." })}
                className="ml-auto p-2 rounded-lg bg-card border border-border hover:bg-secondary transition-colors"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Horário</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Integração</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Evento</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Mensagem</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, i) => (
                    <tr key={log.id} className={`border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{formatTs(log.timestamp)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span>{log.integrationEmoji}</span>
                          <span className="font-medium hidden sm:inline">{log.integration}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground hidden sm:table-cell">{log.event}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          log.status === "success"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : log.status === "error"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-yellow-500/10 text-yellow-400"
                        }`}>
                          {log.status === "success" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                          {log.status === "success" ? "OK" : log.status === "error" ? "Erro" : "Pend."}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{log.message}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                        {log.duration ? `${log.duration}ms` : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum log encontrado para este filtro.
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Credenciais ───────────────────────────────────────────────── */}
          <TabsContent value="credenciais" className="mt-6 space-y-6">
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300/80 leading-relaxed">
              🔒 Credenciais são criptografadas com AES-256-GCM antes de serem armazenadas. Chaves completas nunca são exibidas ou logadas. Use apenas prefixo/sufixo mascarado para identificar.
            </div>

            {/* Existing keys */}
            <div className="space-y-2">
              {!customKeys?.keys || customKeys.keys.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm bg-card border border-border rounded-xl">
                  Nenhuma credencial salva ainda.
                </div>
              ) : (
                customKeys.keys.map((k) => (
                  <div key={k.provider} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{k.provider}</div>
                      <code className="text-xs font-mono text-muted-foreground">
                        {revealedKeys.has(k.provider) ? "••••[chave registrada]••••" : "••••••••••••"}
                      </code>
                      <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                        Salva em {new Date(k.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setRevealedKeys(prev => {
                            const n = new Set(prev);
                            n.has(k.provider) ? n.delete(k.provider) : n.add(k.provider);
                            return n;
                          });
                        }}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors"
                        title={revealedKeys.has(k.provider) ? "Ocultar" : "Verificar existência"}
                      >
                        {revealedKeys.has(k.provider)
                          ? <EyeOff className="w-4 h-4 text-muted-foreground" />
                          : <Eye className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <button
                        onClick={() => handleCopyProvider(k.provider)}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors"
                        title="Copiar nome da credencial"
                      >
                        {copiedProvider === k.provider
                          ? <Check className="w-4 h-4 text-emerald-400" />
                          : <Copy className="w-4 h-4 text-muted-foreground" />}
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

            {/* Add new key */}
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
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-5 space-y-4"
              >
                <h3 className="font-semibold text-sm">Nova credencial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Nome da chave</label>
                    <input
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      placeholder="ex: OPENAI_API_KEY"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Valor</label>
                    <input
                      value={newKeyValue}
                      onChange={e => setNewKeyValue(e.target.value)}
                      placeholder="sk-..."
                      type="password"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewKey(false)} className="px-4 py-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={setKeyMutation.isPending || !newKeyName.trim() || !newKeyValue.trim()}
                    className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {setKeyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Salvar
                  </button>
                </div>
              </motion.form>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
