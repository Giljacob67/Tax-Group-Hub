import { useState, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import {
  FileText, Plus, Search, Download, CheckCircle, Clock,
  AlertTriangle, ChevronRight, ChevronLeft, RotateCw,
  Building2, Shield, BookOpen, Loader2, Edit3, Check,
  Archive, Copy, Trash2, X, History, Eye, ChevronDown, ChevronUp,
  Sparkles, Target, MessageSquare, CalendarDays, FileCheck2,
  RefreshCw, ExternalLink, Bot,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDeliverables,
  useGetDeliverable,
  useGenerateDeliverable,
  useUpdateDeliverable,
  useDeleteDeliverable,
  useUpdateDeliverableSection,
  useRegenerateDeliverableSection,
  useApproveDeliverable,
  useGetCrmContact,
  useListCrmContacts,
  exportDeliverable,
} from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliverableRow {
  id: number;
  title: string;
  type: string;
  product: string | null;
  status: string;
  confidenceLevel: string;
  contactId: number | null;
  ragSourceCount: number | null;
  guardrailWarnings: string[] | null;
  notes: string | null;
  companyName: string | null;
  companyCnpj: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Section {
  id: number;
  sectionKey: string;
  title: string;
  content: string;
  order: number;
  confidenceLevel: string;
  createdAt: string;
  updatedAt: string;
}

interface Source {
  id: number;
  sectionKey: string | null;
  sourceTitle: string;
  excerpt: string | null;
  similarityScore: number | null;
}

interface Version {
  id: number;
  version: number;
  changedBy: string | null;
  changeSummary: string | null;
  model: string | null;
  createdAt: string;
}

interface DeliverableDetail {
  deliverable: DeliverableRow & { companyRegime: string | null; companyScore: number | null; model: string | null; provider: string | null };
  sections: Section[];
  sources: Source[];
  versions: Version[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPES = [
  { id: "diagnostico",          label: "Diagnóstico Executivo",  icon: Target,        desc: "Análise tributária completa com hipóteses, riscos e recomendações." },
  { id: "proposta",             label: "Proposta Comercial",     icon: FileText,       desc: "Proposta estruturada com escopo, produto, metodologia e cronograma." },
  { id: "resumo_oportunidade",  label: "Resumo de Oportunidade", icon: Sparkles,       desc: "Overview executivo com score, potencial e abordagem recomendada." },
  { id: "followup",             label: "Follow-up Comercial",    icon: MessageSquare,  desc: "Mensagem e próxima ação para manutenção do relacionamento." },
  { id: "roteiro_reuniao",      label: "Roteiro de Reunião",     icon: CalendarDays,   desc: "Pauta, perguntas-chave, objeções e fechamento sugerido." },
];

const PRODUCTS = [
  { id: "RTI",              label: "RTI – Reforma Tributária" },
  { id: "AFD",              label: "AFD – Auditoria Fiscal Digital" },
  { id: "REP",              label: "REP – Encargos Previdenciários" },
  { id: "reforma_tributaria", label: "Reforma Tributária (geral)" },
  { id: "comercial",        label: "Comercial Geral" },
  { id: "outro",            label: "Outro" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", review: "Em Revisão", approved: "Aprovado",
  exported: "Exportado", archived: "Arquivado",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  review: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  exported: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  archived: "bg-muted/50 text-muted-foreground border-border",
};
const CONF_COLORS: Record<string, string> = {
  high: "text-emerald-400", medium: "text-amber-400", low: "text-orange-400", none: "text-muted-foreground",
};
const CONF_LABELS: Record<string, string> = {
  high: "Alta", medium: "Média", low: "Baixa", none: "Sem contexto",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ConfBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${CONF_COLORS[level] || CONF_COLORS.none}`}>
      <Shield className="w-3 h-3" /> {CONF_LABELS[level] || level}
    </span>
  );
}

function MetricCard({ label, value, icon: Icon, color = "text-primary" }: {
  label: string; value: string | number; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-xl font-bold text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface WizardProps {
  onClose: () => void;
  onCreated: (id: number) => void;
  prefillContactId?: number;
}

function DeliverableWizard({ onClose, onCreated, prefillContactId }: WizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(prefillContactId ? 2 : 1);
  const [selectedContact, setSelectedContact] = useState<DeliverableRow["contactId"] extends infer T ? any : any>(null);
  const [selectedType, setSelectedType] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("comercial");
  const [customTitle, setCustomTitle] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce contact search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(contactSearch), 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

  const { data: contactsData, isLoading: loadingContacts } = useListCrmContacts(
    { search: debouncedSearch || undefined, limit: 20 },
    { query: { enabled: step === 1 } } as any,
  );
  const contacts = contactsData?.contacts ?? [];

  const { data: prefilledData } = useGetCrmContact(prefillContactId!, {
    query: { enabled: !!prefillContactId },
  } as any);

  useEffect(() => {
    if (prefillContactId && prefilledData?.contact) {
      setSelectedContact(prefilledData.contact);
    }
  }, [prefillContactId, prefilledData]);

  const generateMutation = useGenerateDeliverable({
    mutation: {
      onSuccess: (d: any) => {
        toast({ title: "Entregável gerado com sucesso!" });
        onCreated(d.deliverable.id);
      },
      onError: (err: any) => {
        toast({ title: err?.message || "Erro ao gerar", variant: "destructive" });
      },
    },
  });

  const handleGenerate = () => {
    if (!selectedType) { toast({ title: "Selecione o tipo", variant: "destructive" }); return; }
    generateMutation.mutate({
      data: {
        contactId: selectedContact?.id || undefined,
        type: selectedType as any,
        product: selectedProduct,
        title: customTitle.trim() || undefined,
      },
    });
  };

  const generating = generateMutation.isPending;

  const stepTitles = ["Escolher Empresa", "Tipo de Entregável", "Produto & Contexto", "Gerar"];
  const canProceed = [
    true,                        // step 1 – company optional
    !!selectedType,              // step 2
    !!selectedProduct,           // step 3
    true,                        // step 4 – just generate
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Novo Entregável Comercial</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Etapa {step} de 4 — {stepTitles[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Progress */}
        <div className="flex px-6 pt-3 gap-1 flex-shrink-0">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Company */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm text-muted-foreground mb-4">Selecione uma empresa/lead do CRM para vincular ao entregável (opcional).</p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Buscar por nome ou CNPJ..."
                    className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                {loadingContacts ? (
                  <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {contacts.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedContact(selectedContact?.id === c.id ? null : c)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${selectedContact?.id === c.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted"}`}
                      >
                        <Building2 className={`w-4 h-4 flex-shrink-0 ${selectedContact?.id === c.id ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.razaoSocial || c.nomeFantasia || c.cnpj}</div>
                          <div className="text-[11px] text-muted-foreground">{c.cnpj} • {c.regimeTributario || "regime n/d"} {c.aiScore ? `• Score: ${c.aiScore}` : ""}</div>
                        </div>
                        {selectedContact?.id === c.id && <Check className="w-4 h-4 text-primary ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                    {contacts.length === 0 && !loadingContacts && (
                      <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma empresa encontrada</div>
                    )}
                  </div>
                )}
                {selectedContact && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                    <Check className="w-3.5 h-3.5" /> {selectedContact.razaoSocial || selectedContact.cnpj} selecionada
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Type */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm text-muted-foreground mb-4">Qual tipo de entregável você precisa gerar?</p>
                <div className="space-y-2">
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedType(t.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${selectedType === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted"}`}
                    >
                      <t.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selectedType === t.id ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <div className="text-sm font-semibold text-foreground">{t.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                      </div>
                      {selectedType === t.id && <Check className="w-4 h-4 text-primary ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Product & title */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm text-muted-foreground mb-4">Qual produto ou contexto tributário é o foco?</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {PRODUCTS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p.id)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2 ${selectedProduct === p.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-foreground hover:bg-muted"}`}
                    >
                      {selectedProduct === p.id && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span className={selectedProduct === p.id ? "" : "pl-5"}>{p.label}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Título personalizado (opcional)</label>
                  <input
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder={`Ex: Diagnóstico ${selectedContact?.razaoSocial || "Empresa"} – RTI 2025`}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 4: Generate */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="bg-card border border-border rounded-xl p-5 space-y-3 mb-6">
                  <h3 className="text-sm font-semibold text-foreground">Resumo da Geração</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="font-medium">{TYPES.find(t => t.id === selectedType)?.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Produto</span>
                      <span className="font-medium">{PRODUCTS.find(p => p.id === selectedProduct)?.label}</span>
                    </div>
                    {selectedContact && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Empresa</span>
                        <span className="font-medium truncate max-w-[200px]">{selectedContact.razaoSocial || selectedContact.cnpj}</span>
                      </div>
                    )}
                    {customTitle && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Título</span>
                        <span className="font-medium truncate max-w-[200px]">{customTitle}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-400 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Guardrails ativos</div>
                  <div>O entregável será marcado como rascunho e exigirá revisão humana antes do envio ao cliente.</div>
                  <div>Resultados tributários não são apresentados como garantia — apenas hipóteses baseadas nas informações disponíveis.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            disabled={generating}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {step === 1 ? "Cancelar" : "Voltar"}
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed[step - 1]}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Próximo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedType}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4" /> Gerar Entregável</>}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Editor View ──────────────────────────────────────────────────────────────

function DeliverableEditor({ id, onClose }: { id: number; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const { data: rawData, isLoading: loading } = useGetDeliverable(id);
  const data = rawData as unknown as DeliverableDetail | undefined;

  useEffect(() => {
    if (data?.sections?.length && !activeSection) {
      setActiveSection(data.sections[0]);
      setEditingContent(data.sections[0].content);
    }
  }, [data]);

  useEffect(() => {
    if (activeSection) setEditingContent(activeSection.content);
  }, [activeSection?.id]);

  const saveSectionMutation = useUpdateDeliverableSection({
    mutation: {
      onSuccess: (resp: any) => {
        const updated = resp.section;
        setData(prev => prev ? {
          ...prev,
          sections: prev.sections.map(s => s.id === updated.id ? { ...s, content: editingContent } : s),
        } : prev);
        setActiveSection(prev => prev ? { ...prev, content: editingContent } : prev);
        toast({ title: "Seção salva" });
      },
      onError: () => {
        toast({ title: "Erro ao salvar", variant: "destructive" });
      },
    },
  });

  const regenerateMutation = useRegenerateDeliverableSection({
    mutation: {
      onSuccess: (resp: any) => {
        const updated = resp.section;
        setData(prev => prev ? {
          ...prev,
          sections: prev.sections.map(s => s.id === updated.id ? updated : s),
        } : prev);
        if (activeSection?.id === updated.id) {
          setActiveSection(updated);
          setEditingContent(updated.content);
        }
        toast({ title: "Seção regenerada!" });
      },
      onError: () => {
        toast({ title: "Erro ao regenerar", variant: "destructive" });
      },
    },
  });

  const approveMutation = useApproveDeliverable({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/deliverables", id] });
        toast({ title: "Entregável aprovado! Versão salva." });
      },
      onError: () => {
        toast({ title: "Erro ao aprovar", variant: "destructive" });
      },
    },
  });

  const setData = useCallback((updater: (prev: DeliverableDetail | undefined) => DeliverableDetail | undefined) => {
    queryClient.setQueryData(
      [`/api/deliverables/${id}`],
      (old: any) => updater(old as DeliverableDetail | undefined),
    );
  }, [queryClient, id]);

  const handleSaveSection = () => {
    if (!activeSection) return;
    saveSectionMutation.mutate({
      id,
      sectionId: activeSection.id,
      data: { content: editingContent },
    });
  };

  const handleRegenerateSection = (section: Section) => {
    regenerateMutation.mutate({ id, sectionId: section.id });
  };

  const handleApprove = () => {
    approveMutation.mutate({
      id,
      data: { changeSummary: "Revisado e aprovado para envio" },
    });
  };

  const handleExport = async () => {
    try {
      const html = await exportDeliverable(id);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `entregavel-${id}.html`;
      a.click();
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ["/api/deliverables", id] });
      toast({ title: "HTML exportado! Abra no navegador para imprimir como PDF." });
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  );
  if (!data) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">Entregável não encontrado</div>
  );

  const { deliverable, sections, sources, versions } = data;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Editor header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors flex-shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{deliverable.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={deliverable.status} />
              <ConfBadge level={deliverable.confidenceLevel || "none"} />
              {deliverable.companyName && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {deliverable.companyName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowVersions(v => !v)}
            className={`p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors ${showVersions ? "bg-muted text-foreground" : ""}`}
            title="Histórico de versões"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSources(v => !v)}
            className={`p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors ${showSources ? "bg-muted text-foreground" : ""}`}
            title="Fontes RAG"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          {deliverable.status !== "approved" && deliverable.status !== "exported" && (
            <button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
              Aprovar
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar HTML
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: section list */}
        <div className="w-56 border-r border-border flex-shrink-0 overflow-y-auto bg-card/30">
          <div className="p-3 space-y-0.5">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${activeSection?.id === s.id ? "bg-primary/10 text-primary font-semibold" : "text-foreground/70 hover:bg-muted hover:text-foreground"}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{s.title}</span>
                  <span className={`flex-shrink-0 ${CONF_COLORS[s.confidenceLevel || "none"]}`}>
                    <Shield className="w-2.5 h-2.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: section editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeSection ? (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{activeSection.title}</h3>
                  <ConfBadge level={activeSection.confidenceLevel || "none"} />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRegenerateSection(activeSection)}
                    disabled={regenerateMutation.isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors disabled:opacity-50"
                    title="Regenerar esta seção com IA"
                  >
                    {regenerateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                    Regenerar
                  </button>
                  <button
                    onClick={handleSaveSection}
                    disabled={saveSectionMutation.isPending || editingContent === activeSection.content}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saveSectionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex">
                <textarea
                  value={editingContent}
                  onChange={e => setEditingContent(e.target.value)}
                  className="flex-1 bg-background text-sm text-foreground font-mono p-5 resize-none focus:outline-none leading-relaxed"
                  placeholder="Conteúdo da seção em Markdown..."
                  spellCheck={false}
                />
              </div>
              {/* Preview toggle */}
              <div className="border-t border-border bg-card/30 px-5 py-2 flex-shrink-0">
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Pré-visualização
                  </summary>
                  <div className="mt-3 text-sm prose prose-sm dark:prose-invert max-w-none max-h-48 overflow-y-auto border border-border rounded-lg p-4 bg-background">
                    <ReactMarkdown>{editingContent}</ReactMarkdown>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Edit3 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Selecione uma seção para editar</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: sources / versions panel */}
        {(showSources || showVersions) && (
          <div className="w-72 border-l border-border flex-shrink-0 overflow-y-auto bg-card/30">
            {showSources && (
              <div className="p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Fontes RAG ({sources.length})
                </h4>
                {sources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma fonte RAG utilizada.</p>
                ) : (
                  <div className="space-y-2">
                    {sources.map(s => (
                      <div key={s.id} className="bg-background border border-border rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-foreground truncate">{s.sourceTitle}</span>
                          {s.similarityScore != null && (
                            <span className={`text-[10px] font-semibold ml-1 flex-shrink-0 ${s.similarityScore >= 75 ? "text-emerald-400" : s.similarityScore >= 50 ? "text-amber-400" : "text-orange-400"}`}>
                              {s.similarityScore}%
                            </span>
                          )}
                        </div>
                        {s.excerpt && <p className="text-[10px] text-muted-foreground line-clamp-3">{s.excerpt}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Guardrails checklist */}
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-5 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Governança
                </h4>
                {deliverable.guardrailWarnings && deliverable.guardrailWarnings.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 mb-3">
                    {deliverable.guardrailWarnings.map((w: string, i: number) => (
                      <p key={i} className="text-[10px] text-amber-400">{w}</p>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  {[
                    "Resultados não apresentados como garantia",
                    "Hipóteses marcadas como [PREMISSA]",
                    "Fontes RAG rastreáveis",
                    "Requer revisão humana antes do envio",
                    "Diagnóstico final depende de análise técnica",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showVersions && (
              <div className="p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Histórico de Versões ({versions.length})
                </h4>
                {versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma versão salva.</p>
                ) : (
                  <div className="space-y-2">
                    {versions.map(v => (
                      <div key={v.id} className="bg-background border border-border rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-primary">v{v.version}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(v.createdAt), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                        {v.changeSummary && <p className="text-[10px] text-foreground/70">{v.changeSummary}</p>}
                        {v.model && <p className="text-[10px] text-muted-foreground">Modelo: {v.model}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliverablesPage() {
  usePageTitle("Entregáveis");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showWizard, setShowWizard] = useState(false);
  const [editorId, setEditorId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const { data: listData, isLoading, refetch } = useListDeliverables({
    limit: 100,
    status: filterStatus || undefined,
    type: filterType || undefined,
  });

  const deliverables = (listData?.deliverables ?? []) as unknown as DeliverableRow[];
  const filtered = deliverables.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.companyName || "").toLowerCase().includes(search.toLowerCase())
  );

  // Metrics
  const total = deliverables.length;
  const inReview = deliverables.filter(d => d.status === "review").length;
  const approved = deliverables.filter(d => d.status === "approved" || d.status === "exported").length;
  const lowConf = deliverables.filter(d => d.confidenceLevel === "low" || d.confidenceLevel === "none").length;

  const deleteMutation = useDeleteDeliverable({
    mutation: {
      onSuccess: () => {
        refetch();
        toast({ title: "Entregável excluído" });
      },
      onError: () => {
        toast({ title: "Erro ao excluir", variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateDeliverable({
    mutation: {
      onSuccess: () => {
        refetch();
      },
      onError: () => {
        toast({ title: "Erro ao atualizar status", variant: "destructive" });
      },
    },
  });

  const handleDelete = (id: number) => {
    if (!confirm("Excluir este entregável?")) return;
    deleteMutation.mutate({ id });
  };

  const handleStatusChange = (id: number, status: string) => {
    updateMutation.mutate({ id, data: { status } });
  };

  const handleInlineExport = async (id: number) => {
    try {
      const html = await exportDeliverable(id);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `entregavel-${id}.html`;
      a.click();
      URL.revokeObjectURL(url);
      refetch();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  };

  // If editor is open, render it instead
  if (editorId !== null) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <DeliverableEditor id={editorId} onClose={() => { setEditorId(null); refetch(); }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Entregáveis Comerciais</h1>
              <p className="text-xs text-muted-foreground">Gere diagnósticos, propostas e materiais de follow-up com fontes confiáveis da Tax Group.</p>
            </div>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Novo Entregável
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Total gerados" value={total} icon={FileText} />
            <MetricCard label="Em revisão" value={inReview} icon={Clock} color="text-amber-400" />
            <MetricCard label="Aprovados/Enviados" value={approved} icon={CheckCircle} color="text-emerald-400" />
            <MetricCard label="Baixa confiança" value={lowConf} icon={AlertTriangle} color="text-orange-400" />
          </div>

          {/* Filters + list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar entregáveis..."
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
              >
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
              >
                <option value="">Todos os tipos</option>
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <button onClick={() => refetch()} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Atualizar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-10" />
                <p className="text-sm font-medium">Nenhum entregável encontrado</p>
                <p className="text-xs mt-1">Clique em "Novo Entregável" para gerar o primeiro.</p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium mx-auto hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Criar agora
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-card/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Produto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Confiança</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Atualizado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(d => (
                    <tr key={d.id} className="hover:bg-card/50 transition-colors group">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditorId(d.id)}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors text-left truncate max-w-[200px] block"
                        >
                          {d.title}
                        </button>
                        <div className="text-[11px] text-muted-foreground">{TYPES.find(t => t.id === d.type)?.label || d.type}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-foreground/70 flex items-center gap-1">
                          {d.companyName ? <><Building2 className="w-3 h-3" /> {d.companyName}</> : <span className="text-muted-foreground">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-foreground/70">{d.product || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <ConfBadge level={d.confidenceLevel} />
                        {d.ragSourceCount != null && d.ragSourceCount > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">({d.ragSourceCount} fontes)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                        {format(new Date(d.updatedAt), "dd/MM HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditorId(d.id)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleInlineExport(d.id)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Exportar HTML"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {d.status !== "archived" && (
                            <button
                              onClick={() => handleStatusChange(d.id, "archived")}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Arquivar"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Wizard */}
      <AnimatePresence>
        {showWizard && (
          <DeliverableWizard
            onClose={() => setShowWizard(false)}
            onCreated={(id) => { setShowWizard(false); refetch(); setEditorId(id); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
