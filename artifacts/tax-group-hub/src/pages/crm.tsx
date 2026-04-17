import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Loader2, Search, MapPin, Phone, Mail,
  Briefcase, Star, Zap, RefreshCw, ChevronRight, X,
  Clock, MessageSquare, Bot, CheckCircle2, TrendingUp,
  FileText, Calendar, MoreVertical, AlertCircle, Trophy
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { BulkImportDialog } from "@/components/crm/BulkImportDialog";
import { UploadCloud } from "lucide-react";

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

type Activity = {
  id: number;
  type: string;
  subject: string | null;
  content: string | null;
  agentId: string | null;
  completedAt: string | null;
  createdAt: string;
};

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  prospect:    { label: "Prospect",    color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  qualified:   { label: "Qualificado", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  opportunity: { label: "Oportunidade",color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  client:      { label: "Cliente",     color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  churned:     { label: "Churned",     color: "bg-red-500/20 text-red-300 border-red-500/30" },
  lost:        { label: "Perdido",     color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

const ACTIVITY_ICONS: Record<string, any> = {
  ai_generated: Bot,
  call: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  meeting: Calendar,
  note: FileText,
  stage_change: TrendingUp,
};

// ─── Score Badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 70 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-red-400";
  return (
    <span className={`font-bold text-sm ${color}`}>{score}
      <span className="text-xs font-normal text-muted-foreground">/100</span>
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [activeTab, setActiveTab] = useState("contacts");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Main content */}
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
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Importar
                </Button>
                <AddLeadDialog />
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="contacts">Contatos</TabsTrigger>
              <TabsTrigger value="pipeline">Kanban</TabsTrigger>
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

      {/* Contact detail panel */}
      {selectedContact && (
        <ContactDetailPanel
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={(c) => setSelectedContact(c)}
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/crm/contacts", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/crm/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const contacts = data?.contacts || [];

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
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
          <span className="text-xs text-muted-foreground whitespace-nowrap">{contacts.length} leads</span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-14 border-t border-border/50">
            <Building2 className="w-14 h-14 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-base font-medium">Nenhum lead encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">Adicione o primeiro CNPJ ou ajuste os filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border/50 bg-muted/30">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Regime</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Porte</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Score IA</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Produto</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {contacts.map((contact) => {
                  const s = STATUS_CONFIG[contact.status] || STATUS_CONFIG.prospect;
                  const isSelected = selected?.id === contact.id;
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => onSelect(contact)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{contact.razaoSocial || "—"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span className="font-mono">{contact.cnpj}</span>
                          {contact.cidade && <><span>·</span><MapPin className="w-3 h-3" />{contact.cidade}/{contact.uf}</>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-muted-foreground">{contact.regimeTributario?.replace("_", " ") || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="text-[10px]">{contact.porte || "—"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center"><ScoreBadge score={contact.aiScore} /></td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] border ${s.color}`}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {contact.aiRecommendedProduct
                          ? <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">{contact.aiRecommendedProduct}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
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
function ContactDetailPanel({ contact, onClose, onUpdate }: {
  contact: Contact;
  onClose: () => void;
  onUpdate: (c: Contact) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/contacts/${contact.id}/enrich`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Falha no enriquecimento"); }
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
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Qualificação falhou"); }
      return res.json();
    },
    onSuccess: (data) => {
      onUpdate(data.contact);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contact.id}/activities`] });
      toast({ title: `🤖 Score IA: ${data.qualification?.score}/100 — Tier ${data.qualification?.tier}` });
    },
    onError: (e: any) => toast({ title: "Erro na qualificação", description: e.message, variant: "destructive" }),
  });

  const { data: activitiesData } = useQuery<{ activities: Activity[] }>({
    queryKey: [`/api/crm/contacts/${contact.id}/activities`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts/${contact.id}/activities`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const activities = activitiesData?.activities || [];
  const status = STATUS_CONFIG[contact.status] || STATUS_CONFIG.prospect;
  const scoreDetails = contact.aiScoreDetails as any;

  return (
    <div className="w-[380px] flex-shrink-0 border-l border-border/50 bg-card/30 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none p-4 border-b border-border/50 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{contact.razaoSocial || "Empresa"}</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{contact.cnpj}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">

          {/* Score + Status */}
          <div className="flex gap-2">
            <div className="flex-1 bg-muted/40 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Score IA</div>
              <ScoreBadge score={contact.aiScore} />
              {scoreDetails?.tier && <div className="text-xs text-muted-foreground mt-0.5">Tier {scoreDetails.tier}</div>}
            </div>
            <div className="flex-1 bg-muted/40 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <Badge variant="outline" className={`text-[10px] border ${status.color}`}>{status.label}</Badge>
            </div>
            {contact.aiRecommendedProduct && (
              <div className="flex-1 bg-primary/10 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Produto</div>
                <span className="text-xs font-bold text-primary">{contact.aiRecommendedProduct}</span>
              </div>
            )}
          </div>

          {/* AI Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              disabled={enrichMutation.isPending}
              onClick={() => enrichMutation.mutate()}
            >
              {enrichMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
              Enriquecer
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs bg-primary"
              disabled={qualifyMutation.isPending}
              onClick={() => qualifyMutation.mutate()}
            >
              {qualifyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Bot className="w-3 h-3 mr-1.5" />}
              Qualificar IA
            </Button>
          </div>

          {/* AI reasoning */}
          {scoreDetails?.reasoning && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                <Bot className="w-3 h-3" /> Análise do Agente
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{scoreDetails.reasoning}</p>
              {scoreDetails.nextAction && (
                <div className="mt-2 pt-2 border-t border-border/50 text-xs text-primary font-medium">
                  ▶ {scoreDetails.nextAction}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Company info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</h4>
            {[
              { label: "Regime", value: contact.regimeTributario?.replace(/_/g, " ") },
              { label: "CNAE", value: contact.cnae },
              { label: "Porte", value: contact.porte },
              { label: "Faturamento", value: contact.faturamentoEstimado },
              { label: "Website", value: contact.website },
              { label: "Localização", value: contact.cidade && contact.uf ? `${contact.cidade}/${contact.uf}` : contact.uf },
              { label: "Endereço", value: contact.endereco },
              { label: "Telefone", value: contact.telefone },
              { label: "E-mail", value: contact.email },
              { label: "Decissor", value: contact.nomeDecissor },
              { label: "Sócios", value: Array.isArray(contact.socios) ? contact.socios.map((s:any)=>s.nome).join(", ") : undefined },
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

          <Separator />

          {/* Activity timeline */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Timeline</h4>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade registrada.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] || Clock;
                  return (
                    <div key={a.id} className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{a.subject || a.type}</div>
                        {a.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>}
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
        </div>
      </ScrollArea>
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: raw.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar contato");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      const enrichedMsg = data.enriched ? " Dados enriquecidos via EmpresAqui!" : "";
      toast({ title: "✅ Lead criado!" + enrichedMsg });
      setOpen(false);
      setCnpj("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Adicionar Lead via CNPJ</DialogTitle>
          <DialogDescription>
            O sistema busca automaticamente os dados no EmpresAqui (se configurado).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="cnpj" className="mb-2 block">CNPJ</Label>
          <Input
            id="cnpj"
            placeholder="00.000.000/0001-00"
            value={cnpj}
            onChange={(e) => setCnpj(formatCnpj(e.target.value))}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate(cnpj)}
            disabled={mutation.isPending || cnpj.replace(/\D/g,"").length < 14}
            className="w-full"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {mutation.isPending ? "Buscando..." : "Criar e Enriquecer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pipeline Kanban ──────────────────────────────────────────────────────────
const STAGE_DICT: Record<string, { label: string, color: string }> = {
  prospecting: { label: "Prospecção",   color: "bg-slate-500/20 text-slate-300" },
  discovery:   { label: "Descoberta",   color: "bg-blue-500/20 text-blue-300" },
  proposal:    { label: "Proposta",     color: "bg-amber-500/20 text-amber-300" },
  negotiation: { label: "Negociação",   color: "bg-orange-500/20 text-orange-300" },
  closing:     { label: "Fechamento",   color: "bg-purple-500/20 text-purple-300" },
  won:         { label: "Ganhos 🏆",   color: "bg-emerald-500/20 text-emerald-300" },
  lost:        { label: "Perdidos",     color: "bg-red-500/20 text-red-300" }
};

function PipelineKanbanView() {
  const { data, isLoading } = useQuery<{ pipeline: Record<string, any[]>; stages: string[]; meta: any; stats: any }>({
    queryKey: ["/api/crm/deals/pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/crm/deals/pipeline");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return (
    <div className="h-[50vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const pipeline = data?.pipeline || {};
  const stages = data?.stages || [];
  const totalDeals = Object.values(pipeline).flat().length;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-medium text-muted-foreground">{data?.meta?.name || "Pipeline"}</h3>
        <Badge variant="outline" className="text-xs font-mono">{totalDeals} oportunidades</Badge>
      </div>

      {totalDeals === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
          <Trophy className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          Nenhum deal criado ainda. Qualifique um lead para criar oportunidades.
        </div>
      )}

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4 min-w-max">
          {stages.map((stageId) => {
            const deals = pipeline[stageId] || [];
            const dict = STAGE_DICT[stageId] || { label: stageId.toUpperCase(), color: "bg-slate-500/20 text-slate-300" };
            return (
              <div key={stageId} className="w-[260px] flex-shrink-0 bg-card/40 rounded-xl border border-border/50">
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <Badge variant="outline" className={`border-0 text-xs font-medium ${dict.color}`}>
                    {dict.label}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    {deals.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {deals.length === 0 ? (
                    <div className="h-16 flex items-center justify-center border border-dashed border-border/30 rounded-lg">
                      <span className="text-[10px] text-muted-foreground/40">Vazio</span>
                    </div>
                  ) : deals.map((deal: any) => (
                    <Card key={deal.id} className="cursor-pointer hover:border-primary/50 transition-colors shadow-none bg-background/50">
                      <CardContent className="p-3">
                        <p className="text-xs font-semibold truncate">{deal.title}</p>
                        <div className="flex justify-between items-center mt-1.5">
                          <Badge variant="secondary" className="text-[9px]">{deal.produto || "Mix"}</Badge>
                          {deal.value && <span className="text-xs font-medium text-primary">R$ {deal.value}</span>}
                        </div>
                        {deal.probability != null && (
                          <div className="mt-2">
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${deal.probability}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground">{deal.probability}% prob.</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
