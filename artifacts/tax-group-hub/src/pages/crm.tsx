import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Loader2, Search, MapPin, Phone, Mail,
  Briefcase, RefreshCw, ChevronRight, X,
  Clock, MessageSquare, Bot, CheckCircle2, TrendingUp,
  FileText, Calendar, Trophy,
  Download, Paperclip, Trash2, File, FileImage,
  ChevronUp, ChevronDown, ChevronsUpDown, DollarSign,
  Target, ArrowRight, Edit2, Save, BarChart3, Percent,
  PhoneCall, AtSign, Users, StickyNote, Layers,
  SlidersHorizontal, Check, CheckSquare, Square, AlertTriangle
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { BulkImportDialog } from "@/components/crm/BulkImportDialog";
import { UploadCloud } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ───────────────────────────────────────────────────────────────────
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
  faturamentoEstimado: string | null;
  socios: any[] | null;
  status: string;
  aiScore: number | null;
  aiScoreDetails: any | null;
  aiRecommendedProduct: string | null;
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
  scoreMin: string;
  scoreMax: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const REGIMES = [
  { value: "simples",          label: "Simples Nacional" },
  { value: "lucro_presumido",  label: "Lucro Presumido" },
  { value: "lucro_real",       label: "Lucro Real" },
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
  prospect:    { label: "Prospect",     color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  qualified:   { label: "Qualificado",  color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  opportunity: { label: "Oportunidade", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  client:      { label: "Cliente",      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  churned:     { label: "Churned",      color: "bg-red-500/20 text-red-300 border-red-500/30" },
  lost:        { label: "Perdido",      color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

const STAGE_DICT: Record<string, { label: string; accent: string; header: string }> = {
  prospecting: { label: "Prospecção",  accent: "border-t-slate-400",   header: "text-slate-300" },
  discovery:   { label: "Descoberta",  accent: "border-t-blue-400",    header: "text-blue-300" },
  proposal:    { label: "Proposta",    accent: "border-t-amber-400",   header: "text-amber-300" },
  negotiation: { label: "Negociação",  accent: "border-t-orange-400",  header: "text-orange-300" },
  closing:     { label: "Fechamento",  accent: "border-t-purple-400",  header: "text-purple-300" },
  won:         { label: "Ganhos",      accent: "border-t-emerald-400", header: "text-emerald-300" },
  lost:        { label: "Perdidos",    accent: "border-t-red-400",     header: "text-red-300" },
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
async function exportContactsToXlsx(contacts: Contact[]) {
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" as any);
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
  const color = score >= 70 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-red-400";
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
  const [activeTab, setActiveTab]         = useState("contacts");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isImportOpen, setIsImportOpen]   = useState(false);
  const queryClient = useQueryClient();

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-none p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Briefcase className="w-7 h-7 text-primary" />
                CRM e Pipeline
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Leads enriquecidos, qualificação por IA e funil comercial.
              </p>
            </div>
            {activeTab === "contacts" && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                  <UploadCloud className="w-4 h-4 mr-2" />Importar
                </Button>
                <AddLeadDialog />
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="contacts">Contatos</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent value="contacts" className="m-0 p-0">
                <ContactsView onSelect={setSelectedContact} selected={selectedContact} />
              </TabsContent>
              <TabsContent value="pipeline" className="m-0 p-0">
                <PipelineKanbanView />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort]               = useState<{ field: string; dir: "asc" | "desc" } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]         = useState<Filters>({ regime: "", porte: "", uf: "", scoreMin: "", scoreMax: "" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter(v => v !== "").length + (statusFilter ? 1 : 0);

  const queryParams = new URLSearchParams();
  if (search)              queryParams.set("search",    search);
  if (statusFilter)        queryParams.set("status",    statusFilter);
  if (filters.regime)      queryParams.set("regime",    filters.regime);
  if (filters.porte)       queryParams.set("porte",     filters.porte);
  if (filters.uf)          queryParams.set("uf",        filters.uf);
  if (filters.scoreMin)    queryParams.set("scoreMin",  filters.scoreMin);
  if (filters.scoreMax)    queryParams.set("scoreMax",  filters.scoreMax);
  if (sort)                { queryParams.set("sort", sort.field); queryParams.set("sortDir", sort.dir); }

  const { data, isLoading } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/crm/contacts", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const contacts = data?.contacts || [];

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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/crm/contacts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Falha ao deletar");
      return res.json();
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} contato(s) removido(s).` });
    },
    onError: () => toast({ title: "Erro ao deletar", variant: "destructive" }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      const res = await fetch("/api/crm/contacts/bulk-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar");
      return res.json();
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setSelectedIds(new Set());
      setBulkStatusOpen(false);
      toast({ title: `${ids.length} contato(s) atualizados.` });
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const selectedArray = Array.from(selectedIds);
  const allSelected   = contacts.length > 0 && selectedIds.size === contacts.length;
  const someSelected  = selectedIds.size > 0 && !allSelected;

  function clearFilters() {
    setFilters({ regime: "", porte: "", uf: "", scoreMin: "", scoreMax: "" });
    setStatusFilter("");
    setSearch("");
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3 space-y-3">
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

          <Button
            variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowFilters(p => !p)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-primary-foreground text-primary rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
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
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Regime</Label>
                <Select value={filters.regime} onValueChange={(v) => setFilters(f => ({ ...f, regime: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Qualquer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {REGIMES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Porte</Label>
                <Select value={filters.porte} onValueChange={(v) => setFilters(f => ({ ...f, porte: v === "_all" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Qualquer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Qualquer</SelectItem>
                    {PORTES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">UF</Label>
                <Input
                  placeholder="Ex: SP"
                  value={filters.uf}
                  onChange={(e) => setFilters(f => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                  className="h-8 text-xs"
                  maxLength={2}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Score mín.</Label>
                <Input
                  type="number" min={0} max={100} placeholder="0"
                  value={filters.scoreMin}
                  onChange={(e) => setFilters(f => ({ ...f, scoreMin: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Score máx.</Label>
                <Input
                  type="number" min={0} max={100} placeholder="100"
                  value={filters.scoreMax}
                  onChange={(e) => setFilters(f => ({ ...f, scoreMax: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground">{activeFilterCount} filtro(s) ativo(s)</span>
                <button
                  onClick={clearFilters}
                  className="text-[10px] text-primary hover:underline"
                >
                  Limpar todos
                </button>
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
                        onClick={() => bulkStatusMutation.mutate({ ids: selectedArray, status: k })}
                        disabled={bulkStatusMutation.isPending}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left"
                      >
                        <Badge variant="outline" className={`text-[10px] border ${v.color}`}>{v.label}</Badge>
                      </button>
                    ))}
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
                  if (confirm(`Deletar ${selectedIds.size} contato(s)? Esta ação não pode ser desfeita.`))
                    bulkDeleteMutation.mutate(selectedArray);
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
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-14 border-t border-border/50">
            <Building2 className="w-14 h-14 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-base font-medium">Nenhum lead encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFilterCount > 0 ? (
                <>Nenhum resultado para os filtros aplicados. <button onClick={clearFilters} className="text-primary hover:underline">Limpar filtros</button></>
              ) : "Adicione o primeiro CNPJ ou importe uma lista."}
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
                      <td className="px-4 py-3" onClick={() => onSelect(contact)}>
                        <div className="font-medium text-foreground">{contact.razaoSocial || "—"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span className="font-mono">{contact.cnpj}</span>
                          {contact.cidade && (
                            <><span>·</span><MapPin className="w-3 h-3" />{contact.cidade}/{contact.uf}</>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <span className="text-xs text-muted-foreground">{contact.regimeTributario?.replace(/_/g, " ") || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <Badge variant="secondary" className="text-[10px]">{contact.porte || "—"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <ScoreBadge score={contact.aiScore} />
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        <Badge variant="outline" className={`text-[10px] border ${s.color}`}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={() => onSelect(contact)}>
                        {contact.aiRecommendedProduct
                          ? <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">{contact.aiRecommendedProduct}</Badge>
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
      </CardContent>
    </Card>
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

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/contacts/${contact.id}/enrich`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Falha"); }
      return res.json();
    },
    onSuccess: (data) => {
      onUpdate(data.contact);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: `✅ Enriquecido! ${data.fieldsUpdated?.length || 0} campos atualizados.` });
    },
    onError: (e: any) => toast({ title: "Erro no enriquecimento", description: e.message, variant: "destructive" }),
  });

  const qualifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/contacts/${contact.id}/qualify`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Falha"); }
      return res.json();
    },
    onSuccess: (data) => {
      onUpdate(data.contact);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contact.id}/activities`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
      toast({ title: `🤖 Score: ${data.qualification?.score}/100 — Tier ${data.qualification?.tier}` });
    },
    onError: (e: any) => toast({ title: "Erro na qualificação", description: e.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/crm/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: (data) => {
      onUpdate(data.contact);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Status atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha");
    },
    onSuccess: () => { toast({ title: "Contato removido." }); onDelete(); },
    onError: () => toast({ title: "Erro ao deletar contato", variant: "destructive" }),
  });

  const logActivityMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/contacts/${contact.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activityType,
          subject: activitySubject || ACTIVITY_TYPES.find(t => t.value === activityType)?.label,
          content: activityContent,
          completedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contact.id}/activities`] });
      toast({ title: "Atividade registrada!" });
      setShowActivityForm(false);
      setActivitySubject(""); setActivityContent(""); setActivityType("note");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const { data: activitiesData }   = useQuery<{ activities: Activity[] }>({
    queryKey: [`/api/crm/contacts/${contact.id}/activities`],
    queryFn: async () => { const r = await fetch(`/api/crm/contacts/${contact.id}/activities`); return r.json(); },
  });

  const { data: attachmentsData, refetch: refetchAttachments } = useQuery<{ attachments: Attachment[] }>({
    queryKey: [`/api/crm/contacts/${contact.id}/attachments`],
    queryFn: async () => { const r = await fetch(`/api/crm/contacts/${contact.id}/attachments`); return r.json(); },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/contacts/${contact.id}/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro");
    },
    onSuccess: () => { refetchAttachments(); toast({ title: "Arquivo removido." }); },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
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
      const res = await fetch(`/api/crm/contacts/${contact.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type, url: dataUrl }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      refetchAttachments();
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contact.id}/activities`] });
      toast({ title: `📎 ${file.name} anexado!` });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const activities  = activitiesData?.attachments  as any || activitiesData?.activities  || [];
  const attachments = attachmentsData?.attachments || [];
  const status      = STATUS_CONFIG[contact.status] || STATUS_CONFIG.prospect;
  const scoreDetails = contact.aiScoreDetails as any;

  function getMimeIcon(mime: string) {
    if (mime.startsWith("image/")) return FileImage;
    if (mime === "application/pdf") return FileText;
    return File;
  }

  return (
    <div className="w-[390px] flex-shrink-0 border-l border-border/50 bg-card/30 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none p-4 border-b border-border/50 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{contact.razaoSocial || "Empresa"}</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{contact.cnpj}</p>
          {contact.cidade && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {contact.cidade}/{contact.uf}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="destructive" className="text-xs h-7 px-2"
                onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
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

      {/* Score + Status + Actions */}
      <div className="flex-none p-4 space-y-3 border-b border-border/50">
        <div className="flex gap-2">
          <div className="flex-1 bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Score IA</div>
            <ScoreBadge score={contact.aiScore} />
            {scoreDetails?.tier && <div className="text-xs text-muted-foreground mt-0.5">Tier {scoreDetails.tier}</div>}
          </div>
          <div className="flex-1 bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <Select value={contact.status} onValueChange={(v) => updateStatusMutation.mutate(v)}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-center focus:ring-0 shadow-none">
                <Badge variant="outline" className={`text-[10px] border ${status.color} cursor-pointer`}>
                  {status.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <Badge variant="outline" className={`text-[10px] border ${v.color}`}>{v.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {contact.aiRecommendedProduct && (
            <div className="flex-1 bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Produto</div>
              <span className="text-xs font-bold text-primary leading-tight block">{contact.aiRecommendedProduct}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs"
            disabled={enrichMutation.isPending} onClick={() => enrichMutation.mutate()}>
            {enrichMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
            Enriquecer
          </Button>
          <Button size="sm" className="flex-1 text-xs bg-primary"
            disabled={qualifyMutation.isPending} onClick={() => qualifyMutation.mutate()}>
            {qualifyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Bot className="w-3 h-3 mr-1.5" />}
            Qualificar IA
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={detailTab} onValueChange={setDetailTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-none border-b border-border/50 px-4">
          <TabsList className="bg-transparent p-0 h-9 gap-4">
            {[
              { value: "info",     label: "Dados" },
              { value: "timeline", label: `Timeline (${(activitiesData as any)?.activities?.length ?? 0})` },
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
                  { label: "Faturamento", value: contact.faturamentoEstimado },
                  { label: "Website",     value: contact.website },
                  { label: "Localização", value: contact.cidade && contact.uf ? `${contact.cidade}/${contact.uf}` : contact.uf },
                  { label: "Endereço",    value: contact.endereco },
                  { label: "Telefone",    value: contact.telefone },
                  { label: "E-mail",      value: contact.email },
                  { label: "Decissor",    value: contact.nomeDecissor },
                  { label: "Sócios",      value: Array.isArray(contact.socios) ? contact.socios.map((s: any) => s.nome).join(", ") : undefined },
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
                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors ${
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
                    onClick={() => logActivityMutation.mutate()}
                    disabled={logActivityMutation.isPending || (!activitySubject && !activityContent)}>
                    {logActivityMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                      : <Save className="w-3 h-3 mr-1.5" />}
                    Salvar
                  </Button>
                </div>
              )}
              <Separator />
              {(activitiesData as any)?.activities?.length === 0 ? (
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
                          <div className="text-[10px] text-muted-foreground/60 mt-1">
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
                <p className="text-[10px] text-muted-foreground/50 mt-1">PDF, Imagens, XLSX, Word, TXT</p>
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
                          ? <img src={att.url} alt={att.fileName} className="w-8 h-8 rounded object-cover flex-shrink-0 border border-border/50" />
                          : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{att.fileName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB · ` : ""}
                            {new Date(att.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={att.url} download={att.fileName}>
                            <Button size="icon" variant="ghost" className="w-6 h-6"><Download className="w-3 h-3" /></Button>
                          </a>
                          <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive hover:text-destructive"
                            onClick={() => deleteAttachmentMutation.mutate(att.id)}>
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const mutation = useMutation({
    mutationFn: async (raw: string) => {
      const res = await fetch("/api/crm/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: raw.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar contato");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "✅ Lead criado!" + (data.enriched ? " Dados enriquecidos!" : "") });
      setOpen(false); setCnpj("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Adicionar Lead via CNPJ</DialogTitle>
          <DialogDescription>Busca automaticamente os dados no EmpresAqui (se configurado).</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="cnpj" className="mb-2 block">CNPJ</Label>
          <Input id="cnpj" placeholder="00.000.000/0001-00" value={cnpj}
            onChange={(e) => setCnpj(formatCnpj(e.target.value))} />
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate(cnpj)}
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/deals/${deal.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, value, probability, stage, notes, produto,
          expectedCloseDate: expectedClose ? new Date(expectedClose).toISOString() : null }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Deal atualizado!" }); onSaved(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/deals/${deal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro");
    },
    onSuccess: () => { toast({ title: "Deal removido." }); onDeleted(); },
    onError: () => toast({ title: "Erro ao deletar", variant: "destructive" }),
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
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_DICT).map(([k, v]) => (
                  <SelectItem key={k} value={k}><span className={v.header}>{v.label}</span></SelectItem>
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
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexto, próximos passos..." className="text-sm min-h-[80px] resize-none" />
        </div>
      </div>

      <DialogFooter className="flex items-center gap-2">
        {showDeleteConfirm ? (
          <>
            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
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
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
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

  const { data: contactsData } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/crm/contacts", ""],
    queryFn: async () => { const r = await fetch("/api/crm/contacts"); return r.json(); },
  });

  const contacts = contactsData?.contacts || [];
  const stageInfo = STAGE_DICT[stage];

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/deals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Nova Oportunidade",
          stage,
          value: value || null,
          contactId: contactId ? Number(contactId) : contacts[0]?.id,
          probability: 20,
          pipelineId: "default",
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar deal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
      toast({ title: `Deal criado em ${stageInfo?.label || stage}!` });
      onDone();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
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
          onClick={() => mutation.mutate()} disabled={mutation.isPending || contacts.length === 0}>
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
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const [draggedDealId, setDraggedDealId]       = useState<number | null>(null);
  const [draggedFromStage, setDraggedFromStage] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage]       = useState<string | null>(null);
  const [editingDeal, setEditingDeal]           = useState<Deal | null>(null);
  const [addingInStage, setAddingInStage]       = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    pipeline: Record<string, Deal[]>;
    stages: string[];
    meta: any;
    stats: any;
  }>({
    queryKey: ["/api/crm/deals/pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/crm/deals/pipeline");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const moveDealMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: number; stage: string }) => {
      const res = await fetch(`/api/crm/deals/${dealId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Falha ao mover");
      return res.json();
    },
    onSuccess: (_, { stage }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
      toast({ title: `Deal movido para ${STAGE_DICT[stage]?.label || stage}` });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
      toast({ title: "Erro ao mover deal", variant: "destructive" });
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
      moveDealMutation.mutate({ dealId: draggedDealId, stage: targetStage });
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

  const pipeline    = data?.pipeline || {};
  const stages      = data?.stages || [];
  const allDeals    = Object.values(pipeline).flat() as Deal[];
  const activeDeals = allDeals.filter(d => !["lost"].includes(d.stage));
  const totalActiveValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
  const weightedValue    = activeDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0) * ((d.probability || 0) / 100), 0);
  const wonDeals         = allDeals.filter(d => d.stage === "won");
  const wonValue         = wonDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Pipeline Ativo",   value: formatCurrencyShort(totalActiveValue), icon: BarChart3, color: "text-blue-400" },
          { label: "Valor Ponderado",  value: formatCurrencyShort(weightedValue),    icon: Target,    color: "text-amber-400" },
          { label: "Ganhos",           value: formatCurrencyShort(wonValue),          icon: Trophy,    color: "text-emerald-400" },
          { label: "Oportunidades",    value: `${activeDeals.length} deals`,          icon: Layers,    color: "text-purple-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-card/50 border border-border/40 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground truncate">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {allDeals.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-xl">
          <Trophy className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          Nenhum deal criado ainda. Qualifique um lead ou use o "+" em qualquer coluna.
        </div>
      )}

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4 min-w-max">
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
                    <span className="text-[10px] font-mono bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground flex-shrink-0">
                      {deals.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {stageValue > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono">{formatCurrencyShort(stageValue)}</span>
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
                      <span className="text-[10px]">{isDropTarget ? "Soltar aqui" : "Vazio"}</span>
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
      </ScrollArea>

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

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group cursor-grab active:cursor-grabbing rounded-lg border bg-background/70 hover:bg-background transition-all select-none ${
        isDragging
          ? "opacity-40 border-primary/50 shadow-lg scale-95"
          : "border-border/50 hover:border-primary/40 hover:shadow-md"
      }`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <p className="text-xs font-semibold leading-snug line-clamp-2 flex-1">{deal.title}</p>
          <Edit2 className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 mt-0.5 transition-colors" />
        </div>

        {/* Contact name */}
        {deal.razaoSocial && (
          <p className="text-[10px] text-muted-foreground/70 mb-1.5 flex items-center gap-1 truncate">
            <Building2 className="w-2.5 h-2.5 flex-shrink-0" /> {deal.razaoSocial}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mb-2">
          {deal.produto && <Badge variant="secondary" className="text-[9px] py-0 px-1.5">{deal.produto}</Badge>}
          {deal.value && <span className="text-xs font-bold text-primary ml-auto">{formatCurrency(deal.value)}</span>}
        </div>

        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1 mb-2">
            <Calendar className="w-2.5 h-2.5 text-muted-foreground/50" />
            <span className="text-[9px] text-muted-foreground">
              {new Date(deal.expectedCloseDate).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}

        {prob > 0 && (
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${probColor}`} style={{ width: `${prob}%` }} />
            </div>
            <span className="text-[9px] text-muted-foreground">{prob}% probabilidade</span>
          </div>
        )}
      </div>
    </div>
  );
}
