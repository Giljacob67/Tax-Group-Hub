import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Flame,
  Inbox,
  ListChecks,
  Loader2,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react";
import { useGetCrmQueue } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type QueueType =
  | "my_accounts"
  | "my_deals"
  | "team"
  | "no_responsible"
  | "matriz_waiting"
  | "matriz_overdue"
  | "no_followup"
  | "hot_leads"
  | "needs_attention";

const QUEUES: {
  value: QueueType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    value: "my_accounts",
    label: "Minhas contas",
    icon: User,
    description: "Contas atribuídas a você",
  },
  {
    value: "my_deals",
    label: "Meus negócios",
    icon: ListChecks,
    description: "Negócios atribuídos a você",
  },
  {
    value: "team",
    label: "Carteira da equipe",
    icon: Users,
    description: "Toda a carteira",
  },
  {
    value: "no_responsible",
    label: "Sem responsável",
    icon: User,
    description: "Contatos sem dono",
  },
  {
    value: "matriz_waiting",
    label: "Aguardando Matriz",
    icon: Inbox,
    description: "Enviados, sem retorno",
  },
  {
    value: "matriz_overdue",
    label: "Matriz atrasada",
    icon: AlertCircle,
    description: "Acima do prazo",
  },
  {
    value: "no_followup",
    label: "Sem follow-up",
    icon: Calendar,
    description: "Sem próximo contato",
  },
  {
    value: "hot_leads",
    label: "Leads quentes",
    icon: Flame,
    description: "Quentes / burning",
  },
  {
    value: "needs_attention",
    label: "Precisam atenção",
    icon: AlertCircle,
    description: "Qualificados s/ deal, follow-up vencido ou inativos",
  },
];

type QueueContact = {
  id: number;
  razaoSocial?: string | null;
  cnpj?: string | null;
  status?: string;
  responsavelUnidade?: string | null;
  proximoFollowup?: string | null;
  _attentionReason?: string;
  dealCount?: number;
};

type QueueDeal = {
  id: number;
  contactId: number;
  stage?: string;
  value?: string | number;
  statusMatriz?: string;
  dataEnvioMatriz?: string;
  dataRetornoMatriz?: string;
  prazoRetornoMatriz?: string;
};

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function isOverdue(d?: string | null): boolean {
  if (!d) return false;
  return new Date(d).getTime() < Date.now();
}

export default function QueuesPanel() {
  const [active, setActive] = useState<QueueType>("needs_attention");
  const [search, setSearch] = useState("");
  const [limit] = useState(100);

  const queueQuery = useGetCrmQueue(
    active,
    { limit },
    {
      query: {
        queryKey: ["/api/crm/queues", active, limit],
        refetchOnWindowFocus: false,
      },
    },
  );

  const data = queueQuery.data as any;
  const contacts: QueueContact[] = data?.contacts ?? [];
  const deals: QueueDeal[] = data?.deals ?? [];
  const total: number = data?.total ?? 0;

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.razaoSocial?.toLowerCase().includes(q) ||
        c.cnpj?.toLowerCase().includes(q) ||
        c.responsavelUnidade?.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" /> Filas Operacionais
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Vistas pré-filtradas para a rotina do comercial. Clique em uma fila
            para ver os itens.
          </p>
        </div>
        {total > 0 && (
          <Badge variant="secondary" className="text-xs">
            {total} item{total !== 1 ? "s" : ""}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        <div className="px-4 pt-3 pb-2 border-b border-border/40 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            {QUEUES.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.value}
                  onClick={() => setActive(q.value)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                    active === q.value
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                  }`}
                  title={q.description}
                >
                  <Icon className="w-3 h-3" />
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pt-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por razão social, CNPJ ou responsável…"
            className="h-8 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {queueQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
            </div>
          ) : contacts.length === 0 && deals.length === 0 ? (
            <div className="text-center py-14">
              <ListChecks className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Fila vazia</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {QUEUES.find((q) => q.value === active)?.description}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((c) => {
                const followupOverdue = isOverdue(c.proximoFollowup);
                return (
                  <div
                    key={`c-${c.id}`}
                    className="p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground truncate">
                            {c.razaoSocial || c.cnpj || `Contato #${c.id}`}
                          </h4>
                          {c.status && (
                            <Badge variant="outline" className="text-[10px]">
                              {c.status}
                            </Badge>
                          )}
                          {c.dealCount !== undefined && c.dealCount > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {c.dealCount} negócio
                              {c.dealCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                          {c.cnpj && (
                            <span className="font-mono">{c.cnpj}</span>
                          )}
                          {c.responsavelUnidade && (
                            <span className="flex items-center gap-1">
                              <User className="w-2.5 h-2.5" />{" "}
                              {c.responsavelUnidade}
                            </span>
                          )}
                          {c.proximoFollowup && (
                            <span
                              className={`flex items-center gap-1 ${followupOverdue ? "text-red-400" : ""}`}
                            >
                              <Calendar className="w-2.5 h-2.5" />{" "}
                              {formatDate(c.proximoFollowup)}
                              {followupOverdue && " · vencido"}
                            </span>
                          )}
                          {c._attentionReason && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-amber-400 border-amber-500/30"
                            >
                              {c._attentionReason}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {deals.map((d) => {
                const matrizLate =
                  d.prazoRetornoMatriz &&
                  !d.dataRetornoMatriz &&
                  isOverdue(d.prazoRetornoMatriz);
                return (
                  <div
                    key={`d-${d.id}`}
                    className="p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground">
                            Negócio #{d.id}
                          </h4>
                          {d.stage && (
                            <Badge variant="outline" className="text-[10px]">
                              {d.stage}
                            </Badge>
                          )}
                          {d.statusMatriz && (
                            <Badge variant="secondary" className="text-[10px]">
                              {d.statusMatriz}
                            </Badge>
                          )}
                          {matrizLate && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-red-400 border-red-500/30"
                            >
                              Matriz atrasada
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                          {d.value && (
                            <span>
                              R$ {Number(d.value).toLocaleString("pt-BR")}
                            </span>
                          )}
                          {d.dataEnvioMatriz && (
                            <span>
                              Enviado: {formatDate(d.dataEnvioMatriz)}
                            </span>
                          )}
                          {d.prazoRetornoMatriz && (
                            <span className={matrizLate ? "text-red-400" : ""}>
                              Prazo: {formatDate(d.prazoRetornoMatriz)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
