import * as React from "react";
import { useState, useRef, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2, Plus, Loader2, Search, MapPin,
  Briefcase, RefreshCw, ChevronRight, X,
  Clock, MessageSquare, Bot, CheckCircle2, TrendingUp,
  FileText, Calendar, Trophy,
  Download, Paperclip, Trash2, File, FileImage,
  ChevronUp, ChevronDown, ChevronsUpDown, DollarSign,
  Target, ArrowRight, Edit2, Save, BarChart3, Percent,
  PhoneCall, AtSign, Users, StickyNote, Layers,
  SlidersHorizontal, CheckSquare, Square,
  List, AlertCircle, Link2, ExternalLink,
  Flame, Zap, Compass, ShoppingCart
} from "lucide-react";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { DEMO_CONTACTS, DEMO_DEALS } from "@/lib/demo-data";
import {
  useListCrmTasks,
  useListCrmContacts,
  useListCrmTags,
  useListCrmDeals,
  useListCrmContactActivities,
  useListCrmContactAttachments,
  useListCrmViews,
  useGetCrmPipeline,
  useListSequenceEnrollments,
  useCreateCrmContact,
  useUpdateCrmContact,
  useDeleteCrmContact,
  useBulkDeleteCrmContacts,
  useBulkUpdateStatusCrmContacts,
  useBulkTagCrmContacts,
  useBulkUpdateTemperatureCrmContacts,
  useBulkAssignCrmContacts,
  useBulkUpdateFollowupCrmContacts,
  useEnrichCrmContact,
  useQualifyCrmContact,
  useCreateCrmContactActivity,
  useCreateCrmContactAttachment,
  useDeleteCrmContactAttachment,
  useCreateCrmDeal,
  useUpdateCrmDeal,
  useDeleteCrmDeal,
  useCreateCrmView,
  useUpdateCrmView,
  useDeleteCrmView,
  useSeedSystemCrmViews,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { BulkImportDialog } from "@/components/crm/BulkImportDialog";
import { UploadCloud } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
const CRMDashboard = lazy(() => import("@/components/crm/CRMDashboard"));
import TasksPanel from "@/components/crm/TasksPanel";
import GlobalTimeline from "@/components/crm/GlobalTimeline";
import AutomationsPanel from "@/components/crm/AutomationsPanel";
import TodayView from "@/components/crm/TodayView";
import PipelineManager from "@/components/crm/PipelineManager";
import AlertsPanel from "@/components/crm/AlertsPanel";
import NextStepCard from "@/components/crm/NextStepCard";
import BriefingChecklist from "@/components/crm/BriefingChecklist";
import { CompanyAvatar } from "@/components/crm/CompanyAvatar";
import {
  CONTACT_STATUSES, CONTACT_STATUS_LABELS, CONTACT_STATUS_COLORS,
  DEAL_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_COLORS,
  PIPELINE_TAX_GROUP_STAGES, PIPELINE_STAGE_LABELS, PIPELINE_STAGE_COLORS,
  MATRIX_STATUSES, MATRIX_STATUS_LABELS, MATRIX_STATUS_COLORS,
  ORIGEM_LEAD_OPTIONS, TEMPERATURA_OPTIONS, PRODUTO_INTERESSE_OPTIONS,
  DEFAULT_PIPELINE_ID,
  SYSTEM_VIEWS, SYSTEM_VIEW_CATEGORIES,
} from "@workspace/db/crm-constants";

// ─── Types ───────────────────────────────────────────────────────────────────
type CrmSavedView = {
  id: number;
  name: string;
  emoji: string | null;
  filters: Record<string, any>;
  isDefault: boolean | null;
  sortField: string | null;
  sortDir: string | null;
};

type Contact = {
  id: number;
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  regimeTributario: string | null;
  cnae: string | null;
  porte: string | null;
  uf: string | null;
  cidade: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  website: string | null;
  nomeDecissor: string | null;
  cargoDecissor: string | null;
  contatoDecisor: string | null;
  faturamentoEstimado: string | null;
  socios: any[] | null;
  status: string;
  origemLead: string | null;
  setor: string | null;
  segmento: string | null;
  temperatura: string | null;
  produtoInteresse: string | null;
  observacoes: string | null;
  aiScore: number | null;
  aiScoreDetails: any | null;
  aiRecommendedProduct: string | null;
  tags: string[] | null;
  source: string;
  lastEnrichedAt: string | null;
  createdAt: string;
};

type Deal = {
  id: number;
  contactId: number;
  title: string;
  produto: string | null;
  stage: string;
  value: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  origem: string | null;
  resumoDiagnosticoComercial: string | null;
  briefingMatriz: string | null;
  statusMatriz: string | null;
  observacoesNegociacao: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
  // from LEFT JOIN
  razaoSocial?: string | null;
  cnpj?: string | null;
};

type Activity = {
  id: number;
  type: string;
  subject: string | null;
  content: string | null;
  agentId: string | null;
  completedAt: string | null;
  createdAt: string;
};

type Attachment = {
  id: number;
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
};

type Filters = {
  regime: string;
  porte: string;
  uf: string;
  cidade: string;
  scoreMin: string;
  scoreMax: string;
  setor: string;
  segmento: string;
  origemLead: string;
  loteProspeccao: string;
  produtoInteresse: string;
  responsavelUnidade: string;
  temperatura: string;
  statusMatriz: string;
  followupVencido: string;
  semAtividadeDias: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const REGIMES = [
  { value: "simples",          label: "Simples Nacional" },
  { value: "lucro_presumido",  label: "Lucro Presumido" },
  { value: "lucro_real",       label: "Lucro Real" },
  { value: "lucro_presumido",  label: "Lucro Presumido" },
  { value: "mei",              label: "MEI" },
];

const PORTES = [
  { value: "MEI",    label: "MEI" },
  { value: "ME",     label: "ME" },
  { value: "EPP",    label: "EPP" },
  { value: "Médio",  label: "Médio" },
  { value: "Grande", label: "Grande" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  nao_iniciado:      { label: CONTACT_STATUS_LABELS.nao_iniciado,      color: "bg-muted/40 text-muted-foreground border-border" },
  em_abordagem:      { label: CONTACT_STATUS_LABELS.em_abordagem,      color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  respondeu:         { label: CONTACT_STATUS_LABELS.respondeu,         color: "bg-violet-500/10 text-violet-500 border-violet-500/30" },
  reuniao_agendada:  { label: CONTACT_STATUS_LABELS.reuniao_agendada,  color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  qualificado:       { label: CONTACT_STATUS_LABELS.qualificado,       color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  enviado_matriz:    { label: CONTACT_STATUS_LABELS.enviado_matriz,    color: "bg-pink-500/10 text-pink-500 border-pink-500/30" },
  aguardando_matriz: { label: CONTACT_STATUS_LABELS.aguardando_matriz, color: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
  proposta_enviada:  { label: CONTACT_STATUS_LABELS.proposta_enviada,  color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30" },
  em_negociacao:     { label: CONTACT_STATUS_LABELS.em_negociacao,     color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30" },
  cliente:           { label: CONTACT_STATUS_LABELS.cliente,           color: "bg-green-500/10 text-green-500 border-green-500/30" },
  sem_resposta:      { label: CONTACT_STATUS_LABELS.sem_resposta,      color: "bg-red-500/10 text-red-500 border-red-500/30" },
  reciclar_depois:   { label: CONTACT_STATUS_LABELS.reciclar_depois,   color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  stand_by:          { label: CONTACT_STATUS_LABELS.stand_by,          color: "bg-gray-400/10 text-gray-400 border-gray-400/30" },
  perdido:           { label: CONTACT_STATUS_LABELS.perdido,           color: "bg-red-600/10 text-red-600 border-red-600/30" },
};

const STAGE_DICT: Record<string, { label: string; accent: string; header: string }> = {
  // Pipeline stages
  lead_novo:                 { label: PIPELINE_STAGE_LABELS.lead_novo,                 accent: "border-t-slate-400",    header: "text-slate-400" },
  qualificacao_comercial:    { label: PIPELINE_STAGE_LABELS.qualificacao_comercial,    accent: "border-t-blue-500",     header: "text-blue-500" },
  reuniao_agendada:          { label: PIPELINE_STAGE_LABELS.reuniao_agendada,          accent: "border-t-violet-500",   header: "text-violet-500" },
  diagnostico_comercial:     { label: PIPELINE_STAGE_LABELS.diagnostico_comercial,     accent: "border-t-amber-500",    header: "text-amber-500" },
  enviado_para_matriz:       { label: PIPELINE_STAGE_LABELS.enviado_para_matriz,       accent: "border-t-pink-500",     header: "text-pink-500" },
  aguardando_matriz:         { label: PIPELINE_STAGE_LABELS.aguardando_matriz,         accent: "border-t-orange-500",   header: "text-orange-500" },
  proposta_pronta:           { label: PIPELINE_STAGE_LABELS.proposta_pronta,           accent: "border-t-emerald-500",  header: "text-emerald-500" },
  apresentacao_ao_cliente:   { label: PIPELINE_STAGE_LABELS.apresentacao_ao_cliente,   accent: "border-t-cyan-500",     header: "text-cyan-500" },
  negociacao:                { label: PIPELINE_STAGE_LABELS.negociacao,                accent: "border-t-indigo-500",   header: "text-indigo-500" },
  fechado_ganho:             { label: PIPELINE_STAGE_LABELS.fechado_ganho,             accent: "border-t-green-500",    header: "text-green-500" },
  perdido_standby:           { label: PIPELINE_STAGE_LABELS.perdido_standby,           accent: "border-t-red-500",      header: "text-red-500" },
  onboarding_cliente:        { label: PIPELINE_STAGE_LABELS.onboarding_cliente,        accent: "border-t-teal-500",     header: "text-teal-500" },
  execucao_pela_matriz:      { label: PIPELINE_STAGE_LABELS.execucao_pela_matriz,      accent: "border-t-purple-500",   header: "text-purple-500" },
  acompanhamento_pendencias: { label: PIPELINE_STAGE_LABELS.acompanhamento_pendencias, accent: "border-t-amber-600",    header: "text-amber-600" },
  pos_venda_expansao:        { label: PIPELINE_STAGE_LABELS.pos_venda_expansao,        accent: "border-t-blue-400",     header: "text-blue-400" },
  encerrado:                 { label: PIPELINE_STAGE_LABELS.encerrado,                 accent: "border-t-slate-500",    header: "text-slate-500" },
  // Deal stages (for edit modal)
  proposta_em_preparacao:    { label: DEAL_STAGE_LABELS.proposta_em_preparacao,    accent: "border-t-violet-400",   header: "text-violet-400" },
  proposta_enviada:          { label: DEAL_STAGE_LABELS.proposta_enviada,          accent: "border-t-cyan-400",     header: "text-cyan-400" },
  proposta_apresentada:      { label: DEAL_STAGE_LABELS.proposta_apresentada,      accent: "border-t-indigo-400",   header: "text-indigo-400" },
  em_negociacao:             { label: DEAL_STAGE_LABELS.em_negociacao,             accent: "border-t-purple-400",   header: "text-purple-400" },
  perdido:                   { label: DEAL_STAGE_LABELS.perdido,                   accent: "border-t-red-400",      header: "text-red-400" },
  stand_by:                  { label: DEAL_STAGE_LABELS.stand_by,                  accent: "border-t-gray-400",     header: "text-gray-400" },
};

const ACTIVITY_ICONS: Record<string, any> = {
  ai_generated: Bot,
  call:         PhoneCall,
  email:        AtSign,
  whatsapp:     MessageSquare,
  meeting:      Calendar,
  note:         StickyNote,
  stage_change: TrendingUp,
  linkedin:     Users,
};

const ACTIVITY_TYPES = [
  { value: "call",     label: "Ligação",  icon: PhoneCall },
  { value: "email",    label: "E-mail",   icon: AtSign },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "meeting",  label: "Reunião",  icon: Calendar },
  { value: "note",     label: "Nota",     icon: StickyNote },
];

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatCurrency(value: string | null | undefined): string {
  const n = parseFloat(value || "0");
  if (!n) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

// ─── XLSX Export ──────────────────────────────────────────────────────────────
// SheetJS is bundled via npm (see package.json "xlsx") so the export works
// offline, behind strict CSP, and without leaking the user's IP/headers to
// a third-party CDN at runtime.
import * as XLSX from "xlsx";

async function exportContactsToXlsx(contacts: Contact[]) {
  const rows = contacts.map(c => ({
    "CNPJ": c.cnpj, "Razão Social": c.razaoSocial || "", "Nome Fantasia": c.nomeFantasia || "",
    "Regime Tributário": c.regimeTributario || "", "CNAE": c.cnae || "", "Porte": c.porte || "",
    "UF": c.uf || "", "Cidade": c.cidade || "", "Telefone": c.telefone || "", "E-mail": c.email || "",
    "Decissor": c.nomeDecissor || "", "Faturamento Estimado": c.faturamentoEstimado || "",
    "Score IA": c.aiScore ?? "", "Produto Recomendado": c.aiRecommendedProduct || "",
    "Status": c.status, "Fonte": c.source,
    "Cadastrado em": new Date(c.createdAt).toLocaleDateString("pt-BR"),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, `leads-tax-group-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── Score Badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 70 ? "text-primary" : score >= 45 ? "text-muted-foreground" : "text-destructive";
  return (
    <span className={`font-bold text-sm ${color}`}>
      {score}<span className="text-xs font-normal text-muted-foreground">/100</span>
    </span>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────
function SortIcon({ field, sort }: { field: string; sort: { field: string; dir: "asc" | "desc" } | null }) {
  if (!sort || sort.field !== field) return <ChevronsUpDown className="w-3 h-3 ml-1 text-muted-foreground/40 inline" />;
  return sort.dir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 text-primary inline" />
    : <ChevronDown className="w-3 h-3 ml-1 text-primary inline" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CRMPage() {
  usePageTitle("CRM");
  const [activeTab, setActiveTab]             = useState("today");

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isImportOpen, setIsImportOpen]       = useState(false);
  const queryClient = useQueryClient();

  // Pending tasks count for badge
  const { data: pendingTasksData } = useListCrmTasks({ status: "pending" } as any, { query: { refetchInterval: 60_000 } } as any);
  const pendingCount = pendingTasksData?.tasks?.filter(t =>
    t.dueDate && new Date(t.dueDate) <= new Date(new Date().setHours(23,59,59,999))
  ).length || 0;

  return (
    <div className="flex h-full overflow-hidden bg-background" data-tour="crm">
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v !== "contacts") setSelectedContact(null); }} className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-none px-6 pt-6 pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground">CRM & Pipeline</h1>
              <TabsList className="bg-muted/50 border border-border/50 h-auto flex-wrap">
                <TabsTrigger value="today" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative">
                  Hoje
                  {pendingCount > 0 && (
                    <span className="ml-1.5 text-[11px] font-bold bg-primary/20 text-primary rounded-full px-1.5 py-0.5 leading-none border border-primary/30">
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Pipeline</TabsTrigger>
                <TabsTrigger value="contacts" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Empresas</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Atividades</TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Alertas</TabsTrigger>
                <TabsTrigger value="automations" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Automações</TabsTrigger>
                <TabsTrigger value="dashboard" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Resumo</TabsTrigger>
              </TabsList>
            </div>
            {(activeTab === "contacts" || activeTab === "today") && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                  <UploadCloud className="w-4 h-4 mr-2" />Importar
                </Button>
                <AddLeadDialog />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative bg-muted/10">
          <TabsContent value="contacts" className="h-full m-0 p-0 overflow-y-auto">
            <ContactsView onSelect={setSelectedContact} selected={selectedContact} />
          </TabsContent>
          <TabsContent value="pipeline" className="h-full m-0 p-0">
            <PipelineKanbanView />
          </TabsContent>
          <TabsContent value="today" className="h-full m-0 p-0">
            <TodayView />
          </TabsContent>
          <TabsContent value="timeline" className="h-full m-0 p-6 overflow-y-auto max-w-4xl mx-auto">
            <GlobalTimeline />
          </TabsContent>
          <TabsContent value="alerts" className="h-full m-0 p-6 overflow-hidden">
            <AlertsPanel />
          </TabsContent>
          <TabsContent value="automations" className="h-full m-0 p-6 overflow-y-auto max-w-4xl mx-auto">
            <AutomationsPanel />
          </TabsContent>
          <TabsContent value="dashboard" className="h-full m-0 p-6 overflow-y-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            }>
              <CRMDashboard />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>

      {/* Desktop: side panel */}
      {selectedContact && (
        <div className="hidden md:block">
          <ContactDetailPanel
            contact={selectedContact}
            onClose={() => setSelectedContact(null)}
            onUpdate={(c) => setSelectedContact(c)}
            onDelete={() => {
              setSelectedContact(null);
              queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
            }}
          />
        </div>
      )}
      {/* Mobile: sheet drawer */}
      <Sheet open={!!selectedContact} onOpenChange={(open) => { if (!open) setSelectedContact(null); }}>
        <SheetContent side="right" className="w-full sm:w-[480px] p-0 md:hidden">
          {selectedContact && (
            <ContactDetailPanel
              contact={selectedContact}
              onClose={() => setSelectedContact(null)}
              onUpdate={(c) => setSelectedContact(c)}
              onDelete={() => {
                setSelectedContact(null);
                queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <BulkImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] })}
      />
    </div>
  );
}

// ─── Contacts View ────────────────────────────────────────────────────────────
function ContactsView({ onSelect, selected }: { onSelect: (c: Contact) => void; selected: Contact | null }) {
  const { isDemo } = useDemoMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialogState = useConfirmDialog();

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [listFilter, setListFilter]     = useState("");
  const [sort, setSort]               = useState<{ field: string; dir: "asc" | "desc" } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]         = useState<Filters>({
    regime: "", porte: "", uf: "", cidade: "", scoreMin: "", scoreMax: "",
    setor: "", segmento: "", origemLead: "", loteProspeccao: "",
    produtoInteresse: "", responsavelUnidade: "", temperatura: "",
    statusMatriz: "", followupVencido: "", semAtividadeDias: "",
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkTempOpen, setBulkTempOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkFollowupOpen, setBulkFollowupOpen] = useState(false);
  const [bulkFollowupDate, setBulkFollowupDate] = useState("");
  const [bulkAssignValue, setBulkAssignValue] = useState("");

  const activeFilterCount = Object.values(filters).filter(v => v !== "").length + (statusFilter ? 1 : 0);

  const contactsParams: any = {};
  if (search)              contactsParams.search = search;
  if (statusFilter)        contactsParams.status = statusFilter;
  if (listFilter)          contactsParams.tag = listFilter;
  if (filters.regime)      contactsParams.regime = filters.regime;
  if (filters.porte)       contactsParams.porte = filters.porte;
  if (filters.uf)          contactsParams.uf = filters.uf;
  if (filters.cidade)      contactsParams.cidade = filters.cidade;
  if (filters.scoreMin)    contactsParams.scoreMin = filters.scoreMin;
  if (filters.scoreMax)    contactsParams.scoreMax = filters.scoreMax;
  if (filters.setor)       contactsParams.setor = filters.setor;
  if (filters.segmento)    contactsParams.segmento = filters.segmento;
  if (filters.origemLead)  contactsParams.origemLead = filters.origemLead;
  if (filters.loteProspeccao) contactsParams.loteProspeccao = filters.loteProspeccao;
  if (filters.produtoInteresse) contactsParams.produtoInteresse = filters.produtoInteresse;
  if (filters.responsavelUnidade) contactsParams.responsavelUnidade = filters.responsavelUnidade;
  if (filters.temperatura) contactsParams.temperatura = filters.temperatura;
  if (filters.statusMatriz) contactsParams.statusMatriz = filters.statusMatriz;
  if (filters.followupVencido) contactsParams.followupVencido = filters.followupVencido;
  if (filters.semAtividadeDias) contactsParams.semAtividadeDias = filters.semAtividadeDias;
  if (sort)                { contactsParams.sort = sort.field; contactsParams.sortDir = sort.dir; }

  const { data, isLoading } = useListCrmContacts(contactsParams);

  const { data: tagsData } = useListCrmTags();

  let contacts = (data?.contacts || []) as unknown as Contact[];

  // Demo fallback: quando não há dados reais e modo demo está ativo
  if (isDemo && contacts.length === 0 && !isLoading) {
    contacts = DEMO_CONTACTS as unknown as Contact[];
  }

  function toggleSort(field: string) {
    setSort(prev => {
      if (!prev || prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return null;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === contacts.length && contacts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const bulkDeleteMutation = useBulkDeleteCrmContacts({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        setSelectedIds(new Set());
        toast({ title: `${variables.data.ids.length} contato(s) removido(s).` });
      },
      onError: () => toast({ title: "Erro ao deletar", variant: "destructive" }),
    },
  });

  const bulkStatusMutation = useBulkUpdateStatusCrmContacts({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        setSelectedIds(new Set());
        setBulkStatusOpen(false);
        toast({ title: `${variables.data.ids.length} contato(s) atualizados.` });
      },
      onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
    },
  });

  const bulkTagsMutation = useBulkTagCrmContacts({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        setSelectedIds(new Set());
        setBulkListOpen(false);
        setNewListName("");
        toast({ title: `${variables.data.ids.length} contato(s) ${variables.data.action === "add" ? "adicionados à" : "removidos da"} lista "${variables.data.tag}".` });
      },
      onError: () => toast({ title: "Erro ao atualizar lista", variant: "destructive" }),
    },
  });

  const bulkTempMutation = useBulkUpdateTemperatureCrmContacts({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        setSelectedIds(new Set());
        setBulkTempOpen(false);
        toast({ title: `${variables.data.ids.length} contato(s) atualizados.` });
      },
      onError: () => toast({ title: "Erro ao atualizar temperatura", variant: "destructive" }),
    },
  });

  const bulkAssignMutation = useBulkAssignCrmContacts({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        setSelectedIds(new Set());
        setBulkAssignOpen(false);
        setBulkAssignValue("");
        toast({ title: `${variables.data.ids.length} contato(s) atribuído(s).` });
      },
      onError: () => toast({ title: "Erro ao atribuir", variant: "destructive" }),
    },
  });

  const bulkFollowupMutation = useBulkUpdateFollowupCrmContacts({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        setSelectedIds(new Set());
        setBulkFollowupOpen(false);
        setBulkFollowupDate("");
        toast({ title: `${variables.data.ids.length} contato(s) atualizados.` });
      },
      onError: () => toast({ title: "Erro ao atualizar follow-up", variant: "destructive" }),
    },
  });

  const updateContactStatusMutation = useUpdateCrmContact({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        toast({ title: "Status atualizado!" });
      },
    },
  });

  const [bulkListOpen, setBulkListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const selectedArray = Array.from(selectedIds);
  const allSelected   = contacts.length > 0 && selectedIds.size === contacts.length;
  const someSelected  = selectedIds.size > 0 && !allSelected;
  const allTags       = tagsData?.tags || [];

  const [activeViewId, setActiveViewId] = useState("all");
  const [isSaveViewOpen, setIsSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  function clearFilters() {
    setFilters({
      regime: "", porte: "", uf: "", cidade: "", scoreMin: "", scoreMax: "",
      setor: "", segmento: "", origemLead: "", loteProspeccao: "",
      produtoInteresse: "", responsavelUnidade: "", temperatura: "",
      statusMatriz: "", followupVencido: "", semAtividadeDias: "",
    });
    setStatusFilter("");
    setListFilter("");
    setSearch("");
  }

  const { data: savedViewsData } = useListCrmViews();
  const seedSystemViewsMutation = useSeedSystemCrmViews({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/views"] });
      },
    },
  });

  // Seed system views on first load
  React.useEffect(() => {
    seedSystemViewsMutation.mutate(undefined as any);
  }, []);

  const saveViewMutation = useCreateCrmView({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/views"] });
        setIsSaveViewOpen(false);
        setNewViewName("");
        toast({ title: "Visualização salva com sucesso." });
      },
      onError: () => toast({ title: "Erro ao salvar view", variant: "destructive" }),
    },
  });

  const deleteViewMutation = useDeleteCrmView({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/views"] });
        setActiveViewId("all");
        toast({ title: "Visualização removida." });
      },
    },
  });

  function applyView(viewId: string, viewFilters: Record<string, string>) {
    setActiveViewId(viewId);
    setSearch("");
    setStatusFilter(viewFilters.status || "");
    setListFilter(viewFilters.tag || "");
    setFilters({
      regime: viewFilters.regime || "",
      porte: viewFilters.porte || "",
      uf: viewFilters.uf || "",
      cidade: viewFilters.cidade || "",
      scoreMin: viewFilters.scoreMin || "",
      scoreMax: viewFilters.scoreMax || "",
      setor: viewFilters.setor || "",
      segmento: viewFilters.segmento || "",
      origemLead: viewFilters.origemLead || "",
      loteProspeccao: viewFilters.loteProspeccao || "",
      produtoInteresse: viewFilters.produtoInteresse || "",
      responsavelUnidade: viewFilters.responsavelUnidade || "",
      temperatura: viewFilters.temperatura || "",
      statusMatriz: viewFilters.statusMatriz || "",
      followupVencido: viewFilters.followupVencido || "",
      semAtividadeDias: viewFilters.semAtividadeDias || "",
    });
  }

  const userViews = (savedViewsData?.views || []).filter((v: any) => v.type !== "system");
  const systemViews = (savedViewsData?.views || []).filter((v: any) => v.type === "system");


  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none px-6 pt-3 pb-2 border-b border-border/50 bg-card/50 space-y-3">
        {/* Smart Views Row */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-2 px-2 items-center">
          {/* System views grouped by category */}
          {SYSTEM_VIEW_CATEGORIES.map(cat => {
            const catViews = systemViews.filter((v: any) => v.category === cat.id);
            if (catViews.length === 0) return null;
            return (
              <React.Fragment key={cat.id}>
                {catViews.map((v: any) => (
                  <button
                    key={`sys-${v.id}`}
                    onClick={() => applyView(`sys-${v.id}`, (v.filters || {}) as Record<string, string>)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                      activeViewId === `sys-${v.id}`
                        ? "bg-primary/10 border-primary/30 text-primary font-medium"
                        : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <span>{v.emoji || "📋"}</span> {v.name}
                  </button>
                ))}
                <div className="w-px h-5 bg-border mx-1" />
              </React.Fragment>
            );
          })}

          {userViews.length > 0 && <div className="w-px h-5 bg-border mx-1" />}

          {userViews.map((v: any) => (
            <button
              key={`user-${v.id}`}
              onClick={() => applyView(`user-${v.id}`, (v.filters || {}) as Record<string, string>)}
              onDoubleClick={() => {
                confirmDialogState[0](
                  { title: `Excluir view "${v.name}"?`, description: "Esta ação não pode ser desfeita.", variant: "destructive", confirmLabel: "Excluir" },
                  () => deleteViewMutation.mutate({ id: v.id })
                );
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                activeViewId === `user-${v.id}`
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
              title="Duplo clique para excluir"
            >
              <List className="w-3 h-3" /> {v.name}
            </button>
          ))}

          <Dialog open={isSaveViewOpen} onOpenChange={setIsSaveViewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full px-3 h-8 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 ml-1">
                <Plus className="w-3.5 h-3.5 mr-1" /> Salvar Segmento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Salvar Segmento</DialogTitle>
                <DialogDescription>
                  Salve os filtros atuais como uma lista. Ficará visível na barra superior para acesso rápido.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label>Nome da View</Label>
                <Input
                  autoFocus
                  placeholder="Ex: Contatos SP Quentes"
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSaveViewOpen(false)}>Cancelar</Button>
                <Button onClick={() => saveViewMutation.mutate({ data: { name: newViewName, emoji: "🔖", filters: { ...filters, status: statusFilter, tag: listFilter } } })} disabled={!newViewName.trim() || saveViewMutation.isPending}>
                  {saveViewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-none px-6 py-2 border-b border-border/50 bg-card/50 space-y-2">
        {/* Search + status + filter button row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por Razão Social ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            className="text-sm bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">Todas as listas</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <Button
            variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowFilters(p => !p)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-primary-foreground text-primary rounded-full text-xs w-4 h-4 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <span className="text-xs text-muted-foreground whitespace-nowrap">{contacts.length} leads</span>

          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs"
            disabled={contacts.length === 0}
            onClick={() => exportContactsToXlsx(contacts)}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className="border border-border/50 rounded-lg p-3 bg-muted/20 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Regime</Label>
                <Select value={filters.regime} onValueChange={(v) => setFilters(f => ({ ...f, regime: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Porte</Label>
                <Select value={filters.porte} onValueChange={(v) => setFilters(f => ({ ...f, porte: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {PORTES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">UF</Label>
                <Input placeholder="Ex: SP" value={filters.uf}
                  onChange={(e) => setFilters(f => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                  className="h-8 text-xs" maxLength={2} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Cidade</Label>
                <Input placeholder="Ex: São Paulo" value={filters.cidade}
                  onChange={(e) => setFilters(f => ({ ...f, cidade: e.target.value }))}
                  className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Temperatura</Label>
                <Select value={filters.temperatura} onValueChange={(v) => setFilters(f => ({ ...f, temperatura: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {TEMPERATURA_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Setor</Label>
                <Input placeholder="Ex: Agronegócio" value={filters.setor}
                  onChange={(e) => setFilters(f => ({ ...f, setor: e.target.value }))}
                  className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Segmento</Label>
                <Input placeholder="Ex: Cooperativas" value={filters.segmento}
                  onChange={(e) => setFilters(f => ({ ...f, segmento: e.target.value }))}
                  className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Origem</Label>
                <Select value={filters.origemLead} onValueChange={(v) => setFilters(f => ({ ...f, origemLead: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {ORIGEM_LEAD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Produto</Label>
                <Select value={filters.produtoInteresse} onValueChange={(v) => setFilters(f => ({ ...f, produtoInteresse: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {PRODUTO_INTERESSE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Lote</Label>
                <Input placeholder="Ex: Lote 1" value={filters.loteProspeccao}
                  onChange={(e) => setFilters(f => ({ ...f, loteProspeccao: e.target.value }))}
                  className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Responsável</Label>
                <Input placeholder="Ex: João" value={filters.responsavelUnidade}
                  onChange={(e) => setFilters(f => ({ ...f, responsavelUnidade: e.target.value }))}
                  className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Score mín.</Label>
                <Input type="number" min={0} max={100} placeholder="0" value={filters.scoreMin}
                  onChange={(e) => setFilters(f => ({ ...f, scoreMin: e.target.value }))}
                  className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Score máx.</Label>
                <Input type="number" min={0} max={100} placeholder="100" value={filters.scoreMax}
                  onChange={(e) => setFilters(f => ({ ...f, scoreMax: e.target.value }))}
                  className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Status Matriz</Label>
                <Select value={filters.statusMatriz} onValueChange={(v) => setFilters(f => ({ ...f, statusMatriz: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {MATRIX_STATUSES.map(s => <SelectItem key={s} value={s}>{MATRIX_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Follow-up</Label>
                <Select value={filters.followupVencido} onValueChange={(v) => setFilters(f => ({ ...f, followupVencido: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    <SelectItem value="true">Vencidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Sem Atividade</Label>
                <Select value={filters.semAtividadeDias} onValueChange={(v) => setFilters(f => ({ ...f, semAtividadeDias: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    <SelectItem value="7">7+ dias</SelectItem>
                    <SelectItem value="14">14+ dias</SelectItem>
                    <SelectItem value="30">30+ dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <span className="text-xs text-muted-foreground">{activeFilterCount} filtro(s) ativo(s)</span>
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">Limpar todos</button>
              </div>
            )}
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium text-primary">{selectedIds.size} selecionado(s)</span>
            <div className="flex items-center gap-1.5 ml-auto">
              {/* Bulk status */}
              <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7">Alterar Status</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[300px]">
                  <DialogHeader>
                    <DialogTitle>Alterar Status em Massa</DialogTitle>
                    <DialogDescription>{selectedIds.size} contato(s) selecionado(s)</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-3">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => bulkStatusMutation.mutate({ data: { ids: selectedArray, status: k } })}
                        disabled={bulkStatusMutation.isPending}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Badge variant="outline" className={`text-xs border ${v.color}`}>{v.label}</Badge>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Bulk List/Tag */}
              <Dialog open={bulkListOpen} onOpenChange={setBulkListOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                    <List className="w-3.5 h-3.5" /> Lista
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[320px]">
                  <DialogHeader>
                    <DialogTitle>Gerenciar Listas</DialogTitle>
                    <DialogDescription>{selectedIds.size} contato(s) selecionado(s)</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Nova Lista</Label>
                      <div className="flex gap-2">
                        <Input placeholder="Ex: Campanha SP" value={newListName}
                          onChange={e => setNewListName(e.target.value)} className="h-8 text-xs" />
                        <Button size="sm" className="h-8 text-xs"
                          disabled={!newListName.trim() || bulkTagsMutation.isPending}
                          onClick={() => bulkTagsMutation.mutate({ data: { ids: selectedArray, tag: newListName.trim(), action: "add" } })}>
                          Criar
                        </Button>
                      </div>
                    </div>
                    {allTags.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">Listas Existentes</Label>
                        <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
                          {allTags.map(tag => (
                            <button key={tag}
                              onClick={() => bulkTagsMutation.mutate({ data: { ids: selectedArray, tag, action: "add" } })}
                              disabled={bulkTagsMutation.isPending}
                              className="text-left px-3 py-2 text-xs border border-border/50 rounded-md hover:bg-muted/50 transition-colors flex items-center justify-between group">
                              <span>{tag}</span>
                              <Plus className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Bulk Temperature */}
              <Dialog open={bulkTempOpen} onOpenChange={setBulkTempOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                    <Flame className="w-3.5 h-3.5" /> Temperatura
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[300px]">
                  <DialogHeader>
                    <DialogTitle>Alterar Temperatura</DialogTitle>
                    <DialogDescription>{selectedIds.size} contato(s) selecionado(s)</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-3">
                    {TEMPERATURA_OPTIONS.map(t => (
                      <button key={t.value}
                        onClick={() => bulkTempMutation.mutate({ data: { ids: selectedArray, temperatura: t.value } })}
                        disabled={bulkTempMutation.isPending}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="text-xs font-medium">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Bulk Assign */}
              <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                    <Users className="w-3.5 h-3.5" /> Atribuir
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[300px]">
                  <DialogHeader>
                    <DialogTitle>Atribuir Responsável</DialogTitle>
                    <DialogDescription>{selectedIds.size} contato(s) selecionado(s)</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-3">
                    <Input placeholder="Nome do responsável" value={bulkAssignValue}
                      onChange={e => setBulkAssignValue(e.target.value)} className="text-sm" />
                    <Button className="w-full" disabled={bulkAssignMutation.isPending}
                      onClick={() => bulkAssignMutation.mutate({ data: { ids: selectedArray, responsavelUnidade: bulkAssignValue } })}>
                      {bulkAssignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Atribuir
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Bulk Follow-up */}
              <Dialog open={bulkFollowupOpen} onOpenChange={setBulkFollowupOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Follow-up
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[300px]">
                  <DialogHeader>
                    <DialogTitle>Agendar Follow-up</DialogTitle>
                    <DialogDescription>{selectedIds.size} contato(s) selecionado(s)</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-3">
                    <Input type="date" value={bulkFollowupDate}
                      onChange={e => setBulkFollowupDate(e.target.value)} className="text-sm" />
                    <div className="flex gap-2">
                      <Button className="flex-1" disabled={bulkFollowupMutation.isPending || !bulkFollowupDate}
                        onClick={() => bulkFollowupMutation.mutate({ data: { ids: selectedArray, proximoFollowup: bulkFollowupDate } })}>
                        {bulkFollowupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Agendar
                      </Button>
                      <Button variant="outline" className="flex-1"
                        onClick={() => bulkFollowupMutation.mutate({ data: { ids: selectedArray, proximoFollowup: null } })}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Bulk export */}
              <Button
                variant="outline" size="sm" className="text-xs h-7 gap-1"
                onClick={() => exportContactsToXlsx(contacts.filter(c => selectedIds.has(c.id)))}
              >
                <Download className="w-3 h-3" /> Exportar
              </Button>

              {/* Bulk delete */}
              <Button
                variant="outline" size="sm" className="text-xs h-7 gap-1 text-destructive hover:text-destructive border-destructive/30"
                onClick={() => {
                  confirmDialogState[0](
                    { title: "Excluir contatos?", description: `Deletar ${selectedIds.size} contato(s)? Esta ação não pode ser desfeita.`, variant: "destructive", confirmLabel: "Excluir" },
                    () => bulkDeleteMutation.mutate({ data: { ids: selectedArray } })
                  );
                }}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Trash2 className="w-3 h-3" />}
                Excluir
              </Button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-14 border-t border-border/50">
            <Building2 className="w-14 h-14 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-base font-medium">
              {activeFilterCount > 0 ? "Nenhum resultado para os filtros" : "Sua operação comercial ainda não tem empresas mapeadas"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {activeFilterCount > 0 ? (
                <>Ajuste os critérios ou <button onClick={clearFilters} className="text-primary hover:underline">limpar filtros</button>.</>
              ) : "Importe uma lista de CNPJs ou adicione uma empresa-alvo para iniciar a priorização por IA."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border/50 bg-muted/30">
                <tr>
                  {/* Select all */}
                  <th className="px-3 py-2.5 w-8">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : someSelected
                          ? <div className="w-4 h-4 border-2 border-primary rounded-sm bg-primary/20" />
                          : <Square className="w-4 h-4 text-muted-foreground/50" />}
                    </button>
                  </th>
                  <th
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("razaoSocial")}
                  >
                    Empresa <SortIcon field="razaoSocial" sort={sort} />
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Regime</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Porte</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Setor</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Temp.</th>
                  <th
                    className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("aiScore")}
                  >
                    Score IA <SortIcon field="aiScore" sort={sort} />
                  </th>
                  <th
                    className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("status")}
                  >
                    Status <SortIcon field="status" sort={sort} />
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Produto</th>
                  <th
                    className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("createdAt")}
                  >
                    Entrada <SortIcon field="createdAt" sort={sort} />
                  </th>
                  <th className="px-4 py-2.5 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {contacts.map((contact) => {
                  const s          = STATUS_CONFIG[contact.status] || STATUS_CONFIG.prospect;
                  const isSelected = selected?.id === contact.id;
                  const isBulkSel  = selectedIds.has(contact.id);

                  return (
                    <tr
                      key={contact.id}
                      className={`cursor-pointer transition-colors ${
                        isBulkSel   ? "bg-primary/5 border-l-2 border-l-primary/50"
                        : isSelected ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-muted/30 border-l-2 border-l-transparent"
                      }`}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSelect(contact.id)}
                          className="flex items-center justify-center"
                        >
                          {isBulkSel
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-muted-foreground/30 hover:text-muted-foreground" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5" onClick={() => onSelect(contact)}>
                        <div className="flex items-center gap-2.5">
                          <CompanyAvatar name={contact.razaoSocial} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground text-sm truncate">{contact.razaoSocial || "—"}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <span className="font-mono">{contact.cnpj}</span>
                              {contact.cidade && (
                                <><span>·</span><MapPin className="w-3 h-3" />{contact.cidade}/{contact.uf}</>
                              )}
                            </div>
                            {contact.tags && contact.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {contact.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/50">{tag}</span>
                                ))}
                                {contact.tags.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground">+{contact.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <span className="text-xs text-muted-foreground">{contact.regimeTributario?.replace(/_/g, " ") || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <Badge variant="secondary" className="text-xs">{contact.porte || "—"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <span className="text-xs text-muted-foreground">{contact.setor || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        {contact.temperatura ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-full border"
                            style={{ borderColor: TEMPERATURA_OPTIONS.find(t => t.value === contact.temperatura)?.color || "#6B7280",
                              color: TEMPERATURA_OPTIONS.find(t => t.value === contact.temperatura)?.color || "#6B7280" }}>
                            {TEMPERATURA_OPTIONS.find(t => t.value === contact.temperatura)?.label || contact.temperatura}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <ScoreBadge score={contact.aiScore} />
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Select value={contact.status} onValueChange={(v) => {
                          updateContactStatusMutation.mutate({ id: contact.id, data: { status: v } });
                        }}>
                          <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none ring-0 focus:ring-0">
                            <Badge variant="outline" className={`text-xs border ${s.color} cursor-pointer hover:opacity-80`}>{s.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                <Badge variant="outline" className={`text-xs border ${v.color}`}>{v.label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        {contact.aiRecommendedProduct
                          ? <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{contact.aiRecommendedProduct}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <span className="text-xs text-muted-foreground">
                          {new Date(contact.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={() => onSelect(contact)}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {confirmDialogState[1]}
    </div>
  );
}

// ─── Contact Detail Panel ─────────────────────────────────────────────────────
function ContactDetailPanel({ contact, onClose, onUpdate, onDelete }: {
  contact: Contact;
  onClose: () => void;
  onUpdate: (c: Contact) => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detailTab, setDetailTab]           = useState("info");
  const fileInputRef                        = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]           = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showActivityForm, setShowActivityForm]   = useState(false);
  const [activityType, setActivityType]           = useState("note");
  const [activitySubject, setActivitySubject]     = useState("");
  const [activityContent, setActivityContent]     = useState("");
  const [showNewDealForm, setShowNewDealForm]     = useState(false);
  const [newDealTitle, setNewDealTitle]           = useState("");
  const [newDealValue, setNewDealValue]           = useState("");
  const [newDealOrigem, setNewDealOrigem]         = useState("");
  const [newDealResumoDiag, setNewDealResumoDiag] = useState("");
  const [newDealBriefing, setNewDealBriefing]     = useState("");
  const [newDealStatusMatriz, setNewDealStatusMatriz] = useState("nao_enviado");
  const [newDealObsNegociacao, setNewDealObsNegociacao] = useState("");

  const enrichMutation = useEnrichCrmContact({
    mutation: {
      onSuccess: (data) => {
        onUpdate(data.contact as unknown as Contact);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        toast({ title: `Dados enriquecidos! ${data.fieldsUpdated?.length || 0} campos atualizados.` });
      },
      onError: (e: any) => toast({ title: "Erro no enriquecimento", description: e.message, variant: "destructive" }),
    },
  });

  const qualifyMutation = useQualifyCrmContact({
    mutation: {
      onSuccess: (data) => {
        onUpdate(data.contact as unknown as Contact);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contact.id}/activities`] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
        toast({ title: `Pontuação IA: ${data.qualification?.score}/100 — Nível ${data.qualification?.tier}` });
      },
      onError: (e: any) => toast({ title: "Erro na qualificação", description: e.message, variant: "destructive" }),
    },
  });

  const updateStatusMutation = useUpdateCrmContact({
    mutation: {
      onSuccess: (data) => {
        onUpdate(data.contact as unknown as Contact);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        toast({ title: "Status atualizado!" });
      },
      onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteCrmContact({
    mutation: {
      onSuccess: () => { toast({ title: "Contato removido." }); onDelete(); },
      onError: () => toast({ title: "Erro ao deletar contato", variant: "destructive" }),
    },
  });

  const createDealMutation = useCreateCrmDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
        toast({ title: "Negócio criado!" });
        setShowNewDealForm(false);
        setNewDealTitle("");
        setNewDealValue("");
        setNewDealOrigem("");
        setNewDealResumoDiag("");
        setNewDealBriefing("");
        setNewDealStatusMatriz("nao_enviado");
        setNewDealObsNegociacao("");
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const logActivityMutation = useCreateCrmContactActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contact.id}/activities`] });
        toast({ title: "Atividade registrada!" });
        setShowActivityForm(false);
        setActivitySubject(""); setActivityContent(""); setActivityType("note");
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const { data: activitiesData }   = useListCrmContactActivities(contact.id);

  const { data: attachmentsData, refetch: refetchAttachments } = useListCrmContactAttachments(contact.id);

  const { data: dealsData } = useListCrmDeals({ contactId: contact.id } as any);

  const { data: enrollmentsData } = useListSequenceEnrollments({ contactId: contact.id, status: "active" } as any);

  const deleteAttachmentMutation = useDeleteCrmContactAttachment({
    mutation: {
      onSuccess: () => { refetchAttachments(); toast({ title: "Arquivo removido." }); },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    },
  });

  const createAttachmentMutation = useCreateCrmContactAttachment({
    mutation: {
      onSuccess: () => {
        refetchAttachments();
        queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contact.id}/activities`] });
      },
    },
  });

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        createAttachmentMutation.mutate(
          { id: contact.id, data: { fileName: file.name, fileSize: file.size, mimeType: file.type, url: dataUrl } },
          { onSuccess: () => resolve(), onError: (e) => reject(e) }
        );
      });
      toast({ title: `${file.name} anexado.` });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const activities  = activitiesData?.activities || [];
  const attachments = attachmentsData?.attachments || [];
  const deals       = dealsData?.deals || [];
  const status      = STATUS_CONFIG[contact.status] || STATUS_CONFIG.prospect;
  const scoreDetails = contact.aiScoreDetails as any;

  // Score de Saúde / Relacionamento
  let healthColor = "bg-slate-400";
  let healthLabel = "Sem Atividades";
  if (activities.length > 0) {
    const daysSince = Math.floor((Date.now() - new Date(activities[0].createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 3) {
      healthColor = "bg-emerald-500"; healthLabel = "Quente";
    } else if (daysSince <= 7) {
      healthColor = "bg-amber-400"; healthLabel = "Morno";
    } else {
      healthColor = "bg-red-500"; healthLabel = "Frio";
    }
  }

  function getMimeIcon(mime: string) {
    if (mime.startsWith("image/")) return FileImage;
    if (mime === "application/pdf") return FileText;
    return File;
  }

  return (
    <div className="w-full md:w-[480px] flex-shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Header with avatar */}
      <div className="flex-none p-4 border-b border-border bg-muted/20">
        <div className="flex items-start gap-3">
          <CompanyAvatar name={contact.razaoSocial} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm leading-tight truncate">{contact.razaoSocial || "Empresa"}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1.5 text-xs font-medium bg-background px-1.5 py-0.5 rounded-full border border-border">
                <span className={`w-2 h-2 rounded-full ${healthColor}`} />
                {healthLabel}
              </span>
              <p className="text-[11px] text-muted-foreground font-mono">{contact.cnpj}</p>
            </div>
            {contact.cidade && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" /> {contact.cidade}/{contact.uf}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="destructive" className="text-xs h-7 px-2"
                  onClick={() => deleteMutation.mutate({ id: contact.id })} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowDeleteConfirm(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                title="Deletar contato"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick action buttons — each opens channel AND logs activity */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {contact.telefone && (
            <button
              onClick={() => {
                window.open(`tel:${contact.telefone}`, "_self");
                logActivityMutation.mutate({ id: contact.id, data: { type: "call", subject: "Ligação realizada", content: `Ligação para ${contact.telefone}`, completedAt: new Date().toISOString() } as any });
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs text-primary hover:text-primary/80 transition-colors border border-primary/20"
              title={contact.telefone}
            >
              <PhoneCall className="w-3 h-3" /> Ligar
            </button>
          )}
          {contact.telefone && (
            <button
              onClick={() => {
                const phone = contact.telefone!.replace(/\D/g, "");
                const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
                const name = contact.razaoSocial || "empresa";
                const text = encodeURIComponent(`Olá, tudo bem? Meu nome é da Tax Group Hub e gostaria de conversar sobre oportunidades de otimização tributária para a ${name}.`);
                window.open(`https://wa.me/${fullPhone}?text=${text}`, "_blank");
                logActivityMutation.mutate({ id: contact.id, data: { type: "whatsapp", subject: "WhatsApp enviado", content: `Mensagem WhatsApp enviada para ${contact.telefone}`, completedAt: new Date().toISOString() } as any });
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs text-primary hover:text-primary/80 transition-colors border border-primary/20"
              title="Abrir WhatsApp"
            >
              <MessageSquare className="w-3 h-3" /> WhatsApp
            </button>
          )}
          {contact.email && (
            <button
              onClick={() => {
                window.open(`mailto:${contact.email}`, "_self");
                logActivityMutation.mutate({ id: contact.id, data: { type: "email", subject: "E-mail enviado", content: `E-mail para ${contact.email}`, completedAt: new Date().toISOString() } as any });
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/50"
              title={contact.email}
            >
              <AtSign className="w-3 h-3" /> Email
            </button>
          )}
          {contact.website && (
            <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/50"
            >
              <ExternalLink className="w-3 h-3" /> Site
            </a>
          )}
        </div>
      </div>

      {/* Score + Status + Product */}
      <div className="flex-none p-4 space-y-3 border-b border-border">
        <div className="flex gap-2">
          <div className="flex-1 bg-background rounded-lg p-3 text-center border border-border">
            <div className="text-xs text-muted-foreground mb-1">Score IA</div>
            <ScoreBadge score={contact.aiScore} />
            {scoreDetails?.tier && <div className="text-xs text-muted-foreground mt-0.5">Tier {scoreDetails.tier}</div>}
          </div>
          <div className="flex-1 bg-background rounded-lg p-3 text-center border border-border">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <Select value={contact.status} onValueChange={(v) => updateStatusMutation.mutate({ id: contact.id, data: { status: v } })}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-center focus:ring-0 shadow-none">
                <Badge variant="outline" className={`text-xs border ${status.color} cursor-pointer`}>
                  {status.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <Badge variant="outline" className={`text-xs border ${v.color}`}>{v.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {contact.aiRecommendedProduct && (
            <div className="flex-1 bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
              <div className="text-xs text-muted-foreground mb-1">Produto recomendado</div>
              <span className="text-xs font-bold text-primary leading-tight block">{contact.aiRecommendedProduct}</span>
            </div>
          )}
        </div>
        {scoreDetails?.nextAction && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="text-[11px] text-muted-foreground mb-1">Próximo passo sugerido</div>
            <div className="text-xs text-foreground font-medium flex items-start gap-1.5">
              <ArrowRight className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
              {scoreDetails.nextAction}
            </div>
          </div>
        )}
        {/* Active sequence enrollment indicator */}
        {(enrollmentsData?.enrollments?.length ?? 0) > 0 && (
          <div className="space-y-1">
            {(enrollmentsData as any)?.enrollments?.map((en: any) => {
              const total = en.totalSteps?.length ?? 0;
              const pct   = total > 0 ? Math.round((en.currentStep / total) * 100) : 0;
              return (
                <div key={en.id} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <Zap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-primary truncate">{en.sequenceName ?? "Sequência"}</div>
                    <div className="text-xs text-muted-foreground">Etapa {en.currentStep + 1}/{total} · {pct}% concluído</div>
                  </div>
                  <div className="w-12 h-1.5 bg-primary/20 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs"
            disabled={enrichMutation.isPending} onClick={() => enrichMutation.mutate({ id: contact.id })}>
            {enrichMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
            Enriquecer dados
          </Button>
          <Button size="sm" className="flex-1 text-xs bg-primary"
            disabled={qualifyMutation.isPending} onClick={() => qualifyMutation.mutate({ id: contact.id })}>
            {qualifyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Bot className="w-3 h-3 mr-1.5" />}
            Qualificar IA
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={detailTab} onValueChange={setDetailTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-none border-b border-border/50 px-4 overflow-x-auto">
          <TabsList className="bg-transparent p-0 h-auto gap-4 flex-wrap">
            {[
              { value: "info",     label: "Dados" },
              { value: "deals",    label: `Negócios (${deals.length})` },
              { value: "tasks",    label: "Tarefas" },
              { value: "timeline", label: `Timeline (${activities.length})` },
              { value: "files",    label: `Arquivos (${attachments.length})` },
            ].map(t => (
              <TabsTrigger key={t.value} value={t.value}
                className="text-xs px-0 pb-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* ── Info Tab ── */}
          <TabsContent value="info" className="m-0">
            <div className="p-4 space-y-4">
              <NextStepCard contactId={contact.id} />
              <BriefingChecklist contactId={contact.id} />
              {scoreDetails?.reasoning && (
                <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                    <Bot className="w-3 h-3" /> Análise do Agente
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed">{scoreDetails.reasoning}</p>
                  {scoreDetails.nextAction && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-xs text-primary font-medium flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" /> {scoreDetails.nextAction}
                    </div>
                  )}
                </div>
              )}
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</h4>
                {[
                  { label: "Regime",      value: contact.regimeTributario?.replace(/_/g, " ") },
                  { label: "CNAE",        value: contact.cnae },
                  { label: "Porte",       value: contact.porte },
                  { label: "Setor",       value: contact.setor },
                  { label: "Segmento",    value: contact.segmento },
                  { label: "Temperatura", value: contact.temperatura },
                  { label: "Produto",     value: contact.produtoInteresse },
                  { label: "Origem",      value: contact.origemLead },
                  { label: "Faturamento", value: contact.faturamentoEstimado },
                  { label: "Website",     value: contact.website },
                  { label: "Localização", value: contact.cidade && contact.uf ? `${contact.cidade}/${contact.uf}` : contact.uf },
                  { label: "Endereço",    value: contact.endereco },
                  { label: "Telefone",    value: contact.telefone },
                  { label: "E-mail",      value: contact.email },
                  { label: "Decissor",    value: contact.nomeDecissor },
                  { label: "Contato Dec.", value: contact.contatoDecisor },
                  { label: "Sócios",      value: Array.isArray(contact.socios) ? contact.socios.map((s: any) => s.nome).join(", ") : undefined },
                  { label: "Observações", value: contact.observacoes },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground w-20 flex-shrink-0 pt-0.5">{f.label}</span>
                    <span className="text-foreground flex-1 break-words leading-relaxed">{f.value}</span>
                  </div>
                ))}
                {contact.lastEnrichedAt && (
                  <div className="flex gap-2 text-xs pt-1">
                    <span className="text-muted-foreground w-20 flex-shrink-0">Enriquecido</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {new Date(contact.lastEnrichedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Tasks Tab ── */}
          <TabsContent value="tasks" className="m-0">
            <TasksPanel contactId={contact.id} />
          </TabsContent>

          {/* ── Deals Tab ── */}
          <TabsContent value="deals" className="m-0">
            <div className="p-4 space-y-3">
              {!showNewDealForm ? (
                <Button size="sm" variant="outline" className="w-full text-xs gap-1.5"
                  onClick={() => setShowNewDealForm(true)}>
                  <Plus className="w-3.5 h-3.5" /> Novo Negócio
                </Button>
              ) : (
                <div className="space-y-2 p-3 border border-border/50 rounded-xl bg-background/50">
                  <Input placeholder="Título da oportunidade" value={newDealTitle} onChange={e => setNewDealTitle(e.target.value)} className="text-xs h-8" />
                  <Input placeholder="Valor (R$)" type="number" value={newDealValue} onChange={e => setNewDealValue(e.target.value)} className="text-xs h-8" />
                  <Select value={newDealOrigem} onValueChange={setNewDealOrigem}>
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Origem" /></SelectTrigger>
                    <SelectContent>
                      {ORIGEM_LEAD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newDealStatusMatriz} onValueChange={setNewDealStatusMatriz}>
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Status Matriz" /></SelectTrigger>
                    <SelectContent>
                      {MATRIX_STATUSES.map(s => <SelectItem key={s} value={s}>{MATRIX_STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Resumo do diagnóstico comercial" value={newDealResumoDiag}
                    onChange={e => setNewDealResumoDiag(e.target.value)} className="text-xs min-h-[48px] resize-none" />
                  <Textarea placeholder="Briefing para a matriz" value={newDealBriefing}
                    onChange={e => setNewDealBriefing(e.target.value)} className="text-xs min-h-[48px] resize-none" />
                  <Textarea placeholder="Observações de negociação" value={newDealObsNegociacao}
                    onChange={e => setNewDealObsNegociacao(e.target.value)} className="text-xs min-h-[48px] resize-none" />
                  <div className="flex gap-2">
                    <Button size="sm" className="text-xs flex-1" disabled={createDealMutation.isPending} onClick={() => createDealMutation.mutate({ data: { title: newDealTitle || "Nova Oportunidade", stage: "qualificacao_comercial", value: newDealValue || undefined, contactId: contact.id, probability: 20, pipelineId: DEFAULT_PIPELINE_ID, notes: [newDealResumoDiag, newDealBriefing, newDealObsNegociacao].filter(Boolean).join("\n\n") || undefined } as any })}>
                      {createDealMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowNewDealForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
              {deals.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-xl border-border/50">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  Nenhum negócio ativo.
                </div>
              ) : (
                <div className="space-y-2">
                  {(deals as any[]).map(d => (
                    <div key={d.id} className="p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs font-semibold">{d.title}</p>
                        <Badge variant="outline" className="text-[11px] whitespace-nowrap bg-muted/50">{STAGE_DICT[d.stage]?.label || d.stage}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-muted-foreground">
                          {d.produto || "Sem produto"}
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {formatCurrency(d.value)}
                        </span>
                      </div>
                      {d.statusMatriz && d.statusMatriz !== "nao_enviado" && (
                        <div className="mt-2">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                            style={{ borderColor: MATRIX_STATUS_COLORS[d.statusMatriz as keyof typeof MATRIX_STATUS_COLORS] || "#6B7280", color: MATRIX_STATUS_COLORS[d.statusMatriz as keyof typeof MATRIX_STATUS_COLORS] || "#6B7280" }}
                          >
                            Matriz: {MATRIX_STATUS_LABELS[d.statusMatriz as keyof typeof MATRIX_STATUS_LABELS] || d.statusMatriz}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Timeline Tab ── */}
          <TabsContent value="timeline" className="m-0">
            <div className="p-4 space-y-3">
              {!showActivityForm ? (
                <Button variant="outline" size="sm" className="w-full text-xs gap-1.5"
                  onClick={() => setShowActivityForm(true)}>
                  <Plus className="w-3.5 h-3.5" /> Registrar Atividade
                </Button>
              ) : (
                <div className="border border-border/60 rounded-lg p-3 space-y-2.5 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Nova atividade</span>
                    <button onClick={() => setShowActivityForm(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {ACTIVITY_TYPES.map(t => (
                      <button key={t.value} onClick={() => setActivityType(t.value)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                          activityType === t.value
                            ? "bg-primary/20 border-primary/40 text-primary"
                            : "border-border/50 text-muted-foreground hover:border-border"
                        }`}>
                        <t.icon className="w-2.5 h-2.5" /> {t.label}
                      </button>
                    ))}
                  </div>
                  <Input placeholder="Assunto (opcional)" value={activitySubject}
                    onChange={(e) => setActivitySubject(e.target.value)} className="text-xs h-8" />
                  <Textarea placeholder="Anotações..." value={activityContent}
                    onChange={(e) => setActivityContent(e.target.value)}
                    className="text-xs min-h-[64px] resize-none" />
                  <Button size="sm" className="w-full text-xs"
                    onClick={() => logActivityMutation.mutate({ id: contact.id, data: { type: activityType, subject: activitySubject || ACTIVITY_TYPES.find(t => t.value === activityType)?.label, content: activityContent, completedAt: new Date().toISOString() } as any })}
                    disabled={logActivityMutation.isPending || (!activitySubject && !activityContent)}>
                    {logActivityMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                      : <Save className="w-3 h-3 mr-1.5" />}
                    Salvar
                  </Button>
                </div>
              )}
              <Separator />
              {!activitiesData ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                </div>
              ) : (activitiesData as any)?.activities?.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade registrada.</p>
              ) : (
                <div className="space-y-3">
                  {((activitiesData as any)?.activities || []).map((a: Activity) => {
                    const Icon = ACTIVITY_ICONS[a.type] || Clock;
                    return (
                      <div key={a.id} className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{a.subject || a.type}</div>
                          {a.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-line">{a.content}</p>}
                          <div className="text-xs text-muted-foreground/60 mt-1">
                            {new Date(a.createdAt).toLocaleString("pt-BR")}
                            {a.agentId && <span className="ml-1 text-primary/70">· {a.agentId}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Files Tab ── */}
          <TabsContent value="files" className="m-0">
            <div className="p-4 space-y-3">
              <div
                className="border-2 border-dashed border-border/50 rounded-lg p-5 text-center hover:border-primary/40 transition-colors cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
              >
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,.txt"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                {uploading
                  ? <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto" />
                  : <Paperclip className="w-7 h-7 text-muted-foreground/40 group-hover:text-primary/50 mx-auto transition-colors" />}
                <p className="text-xs text-muted-foreground mt-2">{uploading ? "Enviando..." : "Clique ou arraste um arquivo"}</p>
                <p className="text-xs text-muted-foreground/50 mt-1">PDF, Imagens, XLSX, Word, TXT</p>
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum arquivo anexado.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const Icon = getMimeIcon(att.mimeType);
                    const isImage = att.mimeType.startsWith("image/");
                    return (
                      <div key={att.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                        {isImage
                          ? <img src={att.url} loading="lazy" alt={att.fileName} className="w-8 h-8 rounded object-cover flex-shrink-0 border border-border/50" />
                          : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{att.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB · ` : ""}
                            {new Date(att.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={att.url} download={att.fileName}>
                            <Button size="icon" variant="ghost" className="w-6 h-6"><Download className="w-3 h-3" /></Button>
                          </a>
                          <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive hover:text-destructive"
                            onClick={() => deleteAttachmentMutation.mutate({ contactId: contact.id, attachmentId: att.id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ─── Add Lead Dialog ──────────────────────────────────────────────────────────
function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [setor, setSetor] = useState("");
  const [segmento, setSegmento] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [produtoInteresse, setProdutoInteresse] = useState("");
  const [origemLead, setOrigemLead] = useState("");
  const [decisor, setDecisor] = useState("");
  const [contatoDecisor, setContatoDecisor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  function resetForm() {
    setCnpj(""); setSetor(""); setSegmento(""); setTemperatura("");
    setProdutoInteresse(""); setOrigemLead(""); setDecisor("");
    setContatoDecisor(""); setObservacoes("");
  }

  const mutation = useCreateCrmContact({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        toast({ title: "Lead criado." + (data.contact ? " Dados enriquecidos." : "") });
        setOpen(false); resetForm();
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Lead via CNPJ</DialogTitle>
          <DialogDescription>Busca automaticamente os dados no EmpresAqui (se configurado).</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input id="cnpj" placeholder="00.000.000/0001-00" value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Input value={setor} onChange={e => setSetor(e.target.value)} placeholder="Ex: Agronegócio" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Input value={segmento} onChange={e => setSegmento(e.target.value)} placeholder="Ex: Cooperativas" className="text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temperatura</Label>
              <Select value={temperatura} onValueChange={setTemperatura}>
                <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {TEMPERATURA_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produto de Interesse</Label>
              <Select value={produtoInteresse} onValueChange={setProdutoInteresse}>
                <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {PRODUTO_INTERESSE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Origem do Lead</Label>
            <Select value={origemLead} onValueChange={setOrigemLead}>
              <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {ORIGEM_LEAD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Decisor</Label>
              <Input value={decisor} onChange={e => setDecisor(e.target.value)} placeholder="Nome do decisor" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Contato do Decisor</Label>
              <Input value={contatoDecisor} onChange={e => setContatoDecisor(e.target.value)} placeholder="E-mail ou telefone" className="text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Anotações sobre o lead..." className="text-sm min-h-[60px] resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate({ data: { cnpj: cnpj.replace(/\D/g, ""), setor: setor || undefined, segmento: segmento || undefined, temperatura: temperatura || undefined, produtoInteresse: produtoInteresse || undefined, origemLead: origemLead || undefined, nomeDecissor: decisor || undefined, contatoDecisor: contatoDecisor || undefined, observacoes: observacoes || undefined } as any })}
            disabled={mutation.isPending || cnpj.replace(/\D/g, "").length < 14} className="w-full">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {mutation.isPending ? "Buscando..." : "Criar e Enriquecer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Deal Edit Modal ──────────────────────────────────────────────────────────
function DealEditModal({ deal, onClose, onSaved, onDeleted }: {
  deal: Deal;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle]               = useState(deal.title);
  const [value, setValue]               = useState(deal.value || "");
  const [probability, setProbability]   = useState(deal.probability ?? 0);
  const [stage, setStage]               = useState(deal.stage);
  const [notes, setNotes]               = useState(deal.notes || "");
  const [produto, setProduto]           = useState(deal.produto || "");
  const [expectedClose, setExpectedClose] = useState(
    deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().slice(0, 10) : ""
  );
  const [origem, setOrigem]                       = useState(deal.origem || "");
  const [resumoDiagnosticoComercial, setResumoDiagnosticoComercial] = useState(deal.resumoDiagnosticoComercial || "");
  const [briefingMatriz, setBriefingMatriz]       = useState(deal.briefingMatriz || "");
  const [statusMatriz, setStatusMatriz]           = useState(deal.statusMatriz || "nao_enviado");
  const [observacoesNegociacao, setObservacoesNegociacao] = useState(deal.observacoesNegociacao || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveMutation = useUpdateCrmDeal({
    mutation: {
      onSuccess: () => { toast({ title: "Negócio atualizado." }); onSaved(); },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteCrmDeal({
    mutation: {
      onSuccess: () => { toast({ title: "Negócio removido." }); onDeleted(); },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    },
  });

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" /> Editar Oportunidade
        </DialogTitle>
        {(deal.razaoSocial || deal.cnpj) && (
          <DialogDescription className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            {deal.razaoSocial || deal.cnpj}
          </DialogDescription>
        )}
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Valor (R$)
            </Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <Input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex: RTI, AFD..." className="text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Percent className="w-3 h-3" /> Probabilidade: {probability}%
          </Label>
          <input type="range" min={0} max={100} step={5} value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            className="w-full h-1.5 rounded-full accent-primary cursor-pointer" />
          <div className="flex justify-between text-xs text-muted-foreground/60">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map(s => (
                  <SelectItem key={s} value={s}><span className={STAGE_DICT[s]?.header || ""}>{DEAL_STAGE_LABELS[s]}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Fechamento Previsto
            </Label>
            <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} className="text-sm h-9" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {ORIGEM_LEAD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status Matriz</Label>
            <Select value={statusMatriz} onValueChange={setStatusMatriz}>
              <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATRIX_STATUSES.map(s => <SelectItem key={s} value={s}>{MATRIX_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Resumo Diagnóstico Comercial</Label>
          <Textarea value={resumoDiagnosticoComercial} onChange={(e) => setResumoDiagnosticoComercial(e.target.value)}
            placeholder="Resumo do diagnóstico..." className="text-sm min-h-[60px] resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Briefing Matriz</Label>
          <Textarea value={briefingMatriz} onChange={(e) => setBriefingMatriz(e.target.value)}
            placeholder="Briefing para a matriz..." className="text-sm min-h-[60px] resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Observações de Negociação</Label>
          <Textarea value={observacoesNegociacao} onChange={(e) => setObservacoesNegociacao(e.target.value)}
            placeholder="Observações..." className="text-sm min-h-[60px] resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexto, próximos passos..." className="text-sm min-h-[80px] resize-none" />
        </div>
      </div>

      <DialogFooter className="flex items-center gap-2">
        {showDeleteConfirm ? (
          <>
            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate({ id: deal.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Confirmar exclusão
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive mr-auto"
              onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir deal
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => saveMutation.mutate({ id: deal.id, data: { title, value: value || undefined, probability, stage, notes, produto, expectedCloseDate: expectedClose ? new Date(expectedClose).toISOString() : undefined, origem: origem || undefined, resumoDiagnosticoComercial: resumoDiagnosticoComercial || undefined, briefingMatriz: briefingMatriz || undefined, statusMatriz: statusMatriz || undefined, observacoesNegociacao: observacoesNegociacao || undefined } as any })} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Salvar
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Quick Add Deal Form ──────────────────────────────────────────────────────
function QuickAddDealForm({ stage, onDone }: { stage: string; onDone: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle]   = useState("");
  const [value, setValue]   = useState("");
  const [contactId, setContactId] = useState("");

  const { data: contactsData } = useListCrmContacts();

  const contacts = contactsData?.contacts || [];
  const stageInfo = STAGE_DICT[stage] || { label: PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS] || stage };

  const mutation = useCreateCrmDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
        toast({ title: `Deal criado em ${stageInfo?.label || stage}!` });
        onDone();
      },
      onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <div className="p-2 space-y-2 border-t border-border/50 mt-1">
      <Input
        placeholder="Título da oportunidade"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-xs h-7"
        autoFocus
      />
      {contacts.length > 1 && (
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="w-full text-xs bg-muted/50 border border-border/50 rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">Selecionar contato...</option>
          {contacts.map(c => (
            <option key={c.id} value={c.id}>{c.razaoSocial || c.cnpj}</option>
          ))}
        </select>
      )}
      <Input
        type="number"
        placeholder="Valor (R$)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs h-7"
      />
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1 text-xs h-7"
          onClick={() => mutation.mutate({ data: { title: title || "Nova Oportunidade", stage, value: value || undefined, contactId: contactId ? Number(contactId) : contacts[0]?.id, probability: 20, pipelineId: DEFAULT_PIPELINE_ID } })} disabled={mutation.isPending || contacts.length === 0}>
          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar"}
        </Button>
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={onDone}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Pipeline Kanban ──────────────────────────────────────────────────────────
function PipelineKanbanView() {
  const { isDemo } = useDemoMode();
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const [draggedDealId, setDraggedDealId]       = useState<number | null>(null);
  const [draggedFromStage, setDraggedFromStage] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage]       = useState<string | null>(null);
  const [editingDeal, setEditingDeal]           = useState<Deal | null>(null);
  const [addingInStage, setAddingInStage]       = useState<string | null>(null);
  const [activePipelineId, setActivePipelineId] = useState("default");
  const [showPipelineMgr, setShowPipelineMgr]   = useState(false);

  // Forecast goal — must be declared before any conditional return
  const MONTHLY_GOAL_KEY = "crm_monthly_goal";
  const savedGoal = typeof window !== "undefined" ? Number(localStorage.getItem(MONTHLY_GOAL_KEY) || 50000) : 50000;
  const [monthlyGoal, setMonthlyGoal] = useState(savedGoal);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput]     = useState(String(savedGoal));

  const pipelineQueryParam = activePipelineId === "default" ? "" : `?pipelineId=${activePipelineId}`;

  const { data, isLoading } = useGetCrmPipeline({ pipelineId: activePipelineId === "default" ? undefined : activePipelineId } as any);

  const moveDealMutation = useUpdateCrmDeal({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
        toast({ title: `Negócio movido para ${STAGE_DICT[variables.data.stage!]?.label || variables.data.stage}` });
      },
      onError: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
        toast({ title: "Erro ao mover negócio", variant: "destructive" });
      },
    },
  });

  function handleDragStart(dealId: number, fromStage: string) {
    setDraggedDealId(dealId); setDraggedFromStage(fromStage);
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  }

  function handleDrop(e: React.DragEvent, targetStage: string) {
    e.preventDefault();
    if (draggedDealId && targetStage !== draggedFromStage) {
      queryClient.setQueryData<any>(["/api/crm/deals/pipeline"], (old: any) => {
        if (!old) return old;
        const newPipeline = { ...old.pipeline };
        newPipeline[draggedFromStage!] = (newPipeline[draggedFromStage!] || []).filter((d: Deal) => d.id !== draggedDealId);
        const allDeals = Object.values(old.pipeline).flat() as Deal[];
        const deal = allDeals.find((d: Deal) => d.id === draggedDealId);
        if (deal) newPipeline[targetStage] = [{ ...deal, stage: targetStage }, ...(newPipeline[targetStage] || [])];
        return { ...old, pipeline: newPipeline };
      });
      moveDealMutation.mutate({ id: draggedDealId, data: { stage: targetStage } });
    }
    setDraggedDealId(null); setDraggedFromStage(null); setDragOverStage(null);
  }

  function handleDragEnd() {
    setDraggedDealId(null); setDraggedFromStage(null); setDragOverStage(null);
  }

  if (isLoading) return (
    <div className="h-[50vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  let pipeline: any = data?.pipeline || {};
  let stages      = data?.stages || [];

  // Demo fallback: quando pipeline está vazio e modo demo ativo
  if (isDemo && stages.length === 0 && Object.keys(pipeline).length === 0) {
    stages = [...PIPELINE_TAX_GROUP_STAGES];
    const demoPipeline: Record<string, Deal[]> = {};
    for (const s of stages) {
      demoPipeline[s] = DEMO_DEALS.filter(d => d.stage === s) as unknown as Deal[];
    }
    pipeline = demoPipeline;
  }

  const allDeals    = Object.values(pipeline).flat() as Deal[];
  const activeDeals = allDeals.filter(d => !["perdido", "perdido_standby", "encerrado"].includes(d.stage));
  const totalActiveValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
  const weightedValue    = activeDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0) * ((d.probability || 0) / 100), 0);
  const wonDeals         = allDeals.filter(d => d.stage === "fechado_ganho");
  const wonValue         = wonDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);

  // Forecast bar
  const progressPct = Math.min(100, Math.round((wonValue / monthlyGoal) * 100));
  const pipelinePct = Math.min(100, Math.round(((wonValue + weightedValue) / monthlyGoal) * 100));

  return (
    <div className="h-full flex flex-col gap-3 p-6">

      {/* ── Forecast Bar ─────────────────────────────────────────── */}
      <div className="bg-card/50 border border-border/40 rounded-xl p-3 flex-none">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Forecast do Mês</span>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Pipeline selector */}
            <div className="relative">
              <button
                onClick={() => setShowPipelineMgr(v => !v)}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-border/50 hover:border-border bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <Layers className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {activePipelineId === "default" ? "Funil Padrão" : `Funil #${activePipelineId}`}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
              {showPipelineMgr && (
                <div className="absolute top-full right-0 mt-2 z-50">
                  <PipelineManager
                    activePipelineId={activePipelineId}
                    onSelect={(id) => {
                      setActivePipelineId(id);
                      setShowPipelineMgr(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline", id] });
                    }}
                  />
                </div>
              )}
            </div>
            {editingGoal ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Meta R$</span>
                <input
                  type="number"
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  className="w-24 text-xs bg-muted border border-border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const v = Number(goalInput);
                      if (v > 0) { setMonthlyGoal(v); localStorage.setItem(MONTHLY_GOAL_KEY, String(v)); }
                      setEditingGoal(false);
                    } else if (e.key === "Escape") {
                      setEditingGoal(false);
                    }
                  }}
                  autoFocus
                />
                <button onClick={() => {
                  const v = Number(goalInput);
                  if (v > 0) { setMonthlyGoal(v); localStorage.setItem(MONTHLY_GOAL_KEY, String(v)); }
                  setEditingGoal(false);
                }} className="text-xs text-primary hover:text-primary/80 font-medium">Salvar</button>
              </div>
            ) : (
              <button onClick={() => { setGoalInput(String(monthlyGoal)); setEditingGoal(true); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Meta: {formatCurrencyShort(monthlyGoal)} ✏️
              </button>
            )}
          </div>
        </div>
        <div className="relative h-4 bg-muted/60 rounded-full overflow-hidden">
          {/* Pipeline ponderado (background) */}
          <div
            className="absolute inset-y-0 left-0 bg-primary/20 rounded-full transition-all duration-700"
            style={{ width: `${pipelinePct}%` }}
          />
          {/* Ganhos reais */}
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Ganhos: <strong className="text-emerald-400">{formatCurrencyShort(wonValue)}</strong>
            </span>
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-primary/40 inline-block" />
              Pipeline: <strong className="text-primary/80">{formatCurrencyShort(weightedValue)}</strong>
            </span>
          </div>
          <span className={`text-xs font-bold ${progressPct >= 100 ? "text-emerald-400" : progressPct >= 70 ? "text-amber-400" : "text-muted-foreground"}`}>
            {progressPct}% da meta
          </span>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 flex-none">
        {[
          { label: "Pipeline Ativo",   value: formatCurrencyShort(totalActiveValue), icon: BarChart3, color: "text-primary" },
          { label: "Valor Ponderado",  value: formatCurrencyShort(weightedValue),    icon: Target,    color: "text-muted-foreground" },
          { label: "Ganhos",           value: formatCurrencyShort(wonValue),          icon: Trophy,    color: "text-primary" },
          { label: "Oportunidades",    value: `${activeDeals.length} deals`,          icon: Layers,    color: "text-muted-foreground" },
        ].map(stat => (
          <div key={stat.label} className="bg-card/50 border border-border/40 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{stat.value}</div>
              <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {allDeals.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl bg-card/30">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
          <p className="font-medium text-foreground">Pipeline vazio</p>
          <p className="text-xs mt-1 max-w-md mx-auto">
            Sua operação comercial ainda não tem negócios em andamento. Qualifique um lead no CRM ou crie uma oportunidade manualmente.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 pb-4 h-full" style={{ minWidth: "max-content" }}>
          {stages.map((stageId) => {
            const deals      = (pipeline[stageId] || []) as Deal[];
            const dict       = STAGE_DICT[stageId] || { label: stageId.toUpperCase(), accent: "border-t-slate-400", header: "text-slate-300" };
            const stageValue = deals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
            const isDropTarget = dragOverStage === stageId && draggedFromStage !== stageId;
            const isAdding     = addingInStage === stageId;

            return (
              <div
                key={stageId}
                className={`w-[268px] flex-shrink-0 rounded-xl border border-border/50 border-t-2 transition-colors ${dict.accent} ${
                  isDropTarget ? "bg-primary/5 border-primary/30" : "bg-card/40"
                }`}
                onDragOver={(e) => handleDragOver(e, stageId)}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => handleDrop(e, stageId)}
              >
                {/* Column header */}
                <div className="p-3 border-b border-border/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-semibold truncate ${dict.header}`}>{dict.label}</span>
                    <span className="text-xs font-mono bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground flex-shrink-0">
                      {deals.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {stageValue > 0 && (
                      <span className="text-xs text-muted-foreground font-mono">{formatCurrencyShort(stageValue)}</span>
                    )}
                    <button
                      onClick={() => setAddingInStage(isAdding ? null : stageId)}
                      className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={`Adicionar deal em ${dict.label}`}
                    >
                      {isAdding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Quick add form */}
                {isAdding && (
                  <QuickAddDealForm
                    stage={stageId}
                    onDone={() => setAddingInStage(null)}
                  />
                )}

                {/* Drop indicator */}
                {isDropTarget && !isAdding && (
                  <div className="mx-2 mt-2 h-1 rounded-full bg-primary/40 animate-pulse" />
                )}

                {/* Deal cards */}
                <div className={`p-2 space-y-2 min-h-[140px] ${isDropTarget ? "bg-primary/3" : ""}`}>
                  {deals.length === 0 && !isAdding ? (
                    <div className={`h-16 flex items-center justify-center border border-dashed rounded-lg transition-colors ${
                      isDropTarget ? "border-primary/40 text-primary/50" : "border-border/30 text-muted-foreground/40"
                    }`}>
                      <span className="text-xs">{isDropTarget ? "Soltar aqui" : "Vazio"}</span>
                    </div>
                  ) : (
                    deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        isDragging={draggedDealId === deal.id}
                        onDragStart={() => handleDragStart(deal.id, stageId)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setEditingDeal(deal)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deal edit modal */}
      {editingDeal && (
        <Dialog open={!!editingDeal} onOpenChange={(open) => { if (!open) setEditingDeal(null); }}>
          <DealEditModal
            deal={editingDeal}
            onClose={() => setEditingDeal(null)}
            onSaved={() => {
              setEditingDeal(null);
              queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
            }}
            onDeleted={() => {
              setEditingDeal(null);
              queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({ deal, isDragging, onDragStart, onDragEnd, onClick }: {
  deal: Deal;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const prob      = deal.probability ?? 0;
  const probColor = prob >= 70 ? "bg-emerald-500" : prob >= 40 ? "bg-amber-500" : "bg-slate-500";

  // Days in current stage (proxy: days since updatedAt)
  const daysSinceUpdate = Math.round(
    (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const isUrgent  = daysSinceUpdate >= 14;
  const isWarning = daysSinceUpdate >= 7 && !isUrgent;
  const urgencyColor = isUrgent
    ? "text-red-400 bg-red-500/10 border-red-500/20"
    : isWarning
    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-muted-foreground/50 bg-muted/30 border-transparent";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group cursor-grab active:cursor-grabbing rounded-xl border bg-background/80 hover:bg-background transition-all select-none ${
        isDragging
          ? "opacity-40 border-primary/50 shadow-lg scale-95"
          : "border-border/50 hover:border-primary/40 hover:shadow-md"
      }`}
    >
      <div className="p-3 space-y-2">
        {/* Header: title + edit icon */}
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2 flex-1">{deal.title}</p>
          <Edit2 className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 mt-0.5 transition-colors" />
        </div>

        {/* Contact row */}
        {deal.razaoSocial && (
          <div className="flex items-center gap-1.5">
            <CompanyAvatar name={deal.razaoSocial} size="sm" />
            <p className="text-xs text-muted-foreground truncate flex-1">{deal.razaoSocial}</p>
          </div>
        )}

        {/* Product + Value */}
        <div className="flex items-center justify-between gap-2">
          {deal.produto && (
            <Badge variant="secondary" className="text-[11px] py-0 px-1.5 h-4">{deal.produto}</Badge>
          )}
          {deal.value && (
            <span className="text-xs font-bold text-primary ml-auto">{formatCurrency(deal.value)}</span>
          )}
        </div>

        {/* Matrix status badge */}
        {deal.statusMatriz && deal.statusMatriz !== "nao_enviado" && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-0.5"
            style={{ borderColor: MATRIX_STATUS_COLORS[deal.statusMatriz as keyof typeof MATRIX_STATUS_COLORS] || "#6B7280", color: MATRIX_STATUS_COLORS[deal.statusMatriz as keyof typeof MATRIX_STATUS_COLORS] || "#6B7280" }}
          >
            Matriz: {MATRIX_STATUS_LABELS[deal.statusMatriz as keyof typeof MATRIX_STATUS_LABELS] || deal.statusMatriz}
          </span>
        )}

        {/* Footer: close date + urgency + risk badge */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {deal.expectedCloseDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5 text-muted-foreground/50" />
              <span className="text-[11px] text-muted-foreground">
                {new Date(deal.expectedCloseDate).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}
          {/* Risk badge: stale deal with close date approaching */}
          {(() => {
            const daysToClose = deal.expectedCloseDate
              ? Math.ceil((new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000*60*60*24))
              : null;
            const isAtRisk = daysSinceUpdate >= 5 && daysToClose !== null && daysToClose <= 15 && daysToClose >= 0
              && !['fechado_ganho','perdido','perdido_standby','encerrado'].includes(deal.stage);
            if (!isAtRisk) return null;
            return (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border bg-red-500/10 border-red-500/30 text-red-400 font-semibold flex items-center gap-0.5">
                <AlertCircle className="w-2.5 h-2.5" /> Em Risco
              </span>
            );
          })()}
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium ml-auto ${urgencyColor}`}>
            {daysSinceUpdate === 0 ? "Hoje" : `${daysSinceUpdate}d`}
          </span>
        </div>

        {/* Probability bar */}
        {prob > 0 && (
          <div className="space-y-0.5">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${probColor}`} style={{ width: `${prob}%` }} />
            </div>
            <span className="text-[11px] text-muted-foreground">{prob}% prob.</span>
          </div>
        )}
      </div>
    </div>
  );
}
