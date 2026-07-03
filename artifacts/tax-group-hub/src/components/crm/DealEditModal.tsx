import { useState } from "react";
import {
  Building2,
  Calendar,
  DollarSign,
  Layers,
  Loader2,
  Percent,
  Save,
  Trash2,
} from "lucide-react";
import {
  useDeleteCrmDeal,
  useUpdateCrmDeal,
} from "@workspace/api-client-react";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  MATRIX_STATUSES,
  MATRIX_STATUS_LABELS,
  ORIGEM_LEAD_OPTIONS,
  PROPOSTA_STATUS,
  PROPOSTA_STATUS_LABELS,
} from "@workspace/db/crm-constants";
import { Can } from "@/components/can";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Deal = {
  id: number;
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
  statusProposta: string | null;
  motivoPerda: string | null;
  dataEnvioMatriz: string | null;
  prazoRetornoMatriz: string | null;
  dataRetornoMatriz: string | null;
  retornoMatriz: string | null;
  documentosEnviados: string[] | null;
  responsavelEnvioMatriz: string | null;
  pendenciasMatriz: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
};

type Props = {
  deal: Deal;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onOpenContact?: (term: string) => void;
};

export default function DealEditModal({
  deal,
  onClose,
  onSaved,
  onDeleted,
  onOpenContact,
}: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value || "");
  const [probability, setProbability] = useState(deal.probability ?? 0);
  const [stage, setStage] = useState(deal.stage);
  const [notes, setNotes] = useState(deal.notes || "");
  const [produto, setProduto] = useState(deal.produto || "");
  const [expectedClose, setExpectedClose] = useState(
    deal.expectedCloseDate
      ? new Date(deal.expectedCloseDate).toISOString().slice(0, 10)
      : "",
  );
  const [origem, setOrigem] = useState(deal.origem || "");
  const [resumoDiagnosticoComercial, setResumoDiagnosticoComercial] = useState(
    deal.resumoDiagnosticoComercial || "",
  );
  const [briefingMatriz, setBriefingMatriz] = useState(
    deal.briefingMatriz || "",
  );
  const [statusMatriz, setStatusMatriz] = useState(
    deal.statusMatriz || "nao_enviado",
  );
  const [observacoesNegociacao, setObservacoesNegociacao] = useState(
    deal.observacoesNegociacao || "",
  );
  const [motivoPerda, setMotivoPerda] = useState(deal.motivoPerda || "");
  const [statusProposta, setStatusProposta] = useState(
    deal.statusProposta || "",
  );
  const [dataEnvioMatriz, setDataEnvioMatriz] = useState(
    deal.dataEnvioMatriz
      ? new Date(deal.dataEnvioMatriz).toISOString().slice(0, 10)
      : "",
  );
  const [prazoRetornoMatriz, setPrazoRetornoMatriz] = useState(
    deal.prazoRetornoMatriz
      ? new Date(deal.prazoRetornoMatriz).toISOString().slice(0, 10)
      : "",
  );
  const [dataRetornoMatriz, setDataRetornoMatriz] = useState(
    deal.dataRetornoMatriz
      ? new Date(deal.dataRetornoMatriz).toISOString().slice(0, 10)
      : "",
  );
  const [retornoMatriz, setRetornoMatriz] = useState(deal.retornoMatriz || "");
  const [documentosEnviados, setDocumentosEnviados] = useState(
    (deal.documentosEnviados || []).join(", "),
  );
  const [responsavelEnvioMatriz, setResponsavelEnvioMatriz] = useState(
    deal.responsavelEnvioMatriz || "",
  );
  const [pendenciasMatriz, setPendenciasMatriz] = useState(
    deal.pendenciasMatriz || "",
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveMutation = useUpdateCrmDeal({
    mutation: {
      onSuccess: () => {
        toast({ title: "Negócio atualizado." });
        onSaved();
      },
      onError: (error: any) =>
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        }),
    },
  });

  const deleteMutation = useDeleteCrmDeal({
    mutation: {
      onSuccess: () => {
        toast({ title: "Negócio removido." });
        onDeleted();
      },
      onError: () =>
        toast({ title: "Erro ao remover", variant: "destructive" }),
    },
  });

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" /> Editar Oportunidade
        </DialogTitle>
        {(deal.razaoSocial || deal.cnpj) && (
          <DialogDescription className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {onOpenContact ? (
              <button
                type="button"
                className="text-left text-primary hover:underline"
                title="Abrir ficha do contato"
                onClick={() => {
                  onClose();
                  onOpenContact(deal.cnpj || deal.razaoSocial || "");
                }}
              >
                {deal.razaoSocial || deal.cnpj}
              </button>
            ) : (
              deal.razaoSocial || deal.cnpj
            )}
          </DialogDescription>
        )}
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Título</Label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" /> Valor (R$)
            </Label>
            <Input
              type="number"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="0"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <Input
              value={produto}
              onChange={(event) => setProduto(event.target.value)}
              placeholder="Ex: RTI, AFD..."
              className="text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Percent className="h-3 w-3" /> Probabilidade: {probability}%
          </Label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={probability}
            onChange={(event) => setProbability(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer rounded-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground/60">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {DEAL_STAGE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> Fechamento Previsto
            </Label>
            <Input
              type="date"
              value={expectedClose}
              onChange={(event) => setExpectedClose(event.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {ORIGEM_LEAD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Status Matriz
            </Label>
            <Select value={statusMatriz} onValueChange={setStatusMatriz}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATRIX_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {MATRIX_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/40 pt-2">
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Operação · Matriz & Proposta
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Status da Proposta
              </Label>
              <Select
                value={statusProposta || "_none"}
                onValueChange={(nextValue) =>
                  setStatusProposta(nextValue === "_none" ? "" : nextValue)
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Nenhum —</SelectItem>
                  {PROPOSTA_STATUS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {PROPOSTA_STATUS_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Responsável Envio Matriz
              </Label>
              <Input
                value={responsavelEnvioMatriz}
                onChange={(event) =>
                  setResponsavelEnvioMatriz(event.target.value)
                }
                placeholder="Nome ou matrícula"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {[
            "enviado",
            "aguardando",
            "pendencia_documental",
            "retorno_recebido",
            "proposta_liberada",
          ].includes(statusMatriz) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Data de Envio p/ Matriz
                  </Label>
                  <Input
                    type="date"
                    value={dataEnvioMatriz}
                    onChange={(event) =>
                      setDataEnvioMatriz(event.target.value)
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Prazo Retorno Matriz
                  </Label>
                  <Input
                    type="date"
                    value={prazoRetornoMatriz}
                    onChange={(event) =>
                      setPrazoRetornoMatriz(event.target.value)
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Documentos Enviados (separados por vírgula)
                </Label>
                <Input
                  value={documentosEnviados}
                  onChange={(event) =>
                    setDocumentosEnviados(event.target.value)
                  }
                  placeholder="Ex: CNH, contrato social, balancete 2024"
                  className="h-9 text-sm"
                />
              </div>
            </>
          )}

          {["retorno_recebido", "proposta_liberada"].includes(statusMatriz) && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Data do Retorno da Matriz
                </Label>
                <Input
                  type="date"
                  value={dataRetornoMatriz}
                  onChange={(event) =>
                    setDataRetornoMatriz(event.target.value)
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Observações do Retorno
                </Label>
                <Textarea
                  value={retornoMatriz}
                  onChange={(event) => setRetornoMatriz(event.target.value)}
                  placeholder="Resumo do que a Matriz retornou..."
                  className="min-h-[60px] resize-none text-sm"
                />
              </div>
            </>
          )}

          {statusMatriz === "pendencia_documental" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Pendências da Matriz
              </Label>
              <Textarea
                value={pendenciasMatriz}
                onChange={(event) => setPendenciasMatriz(event.target.value)}
                placeholder="O que está pendente com a Matriz..."
                className="min-h-[60px] resize-none text-sm"
              />
            </div>
          )}

          {stage === "perdido" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Motivo da Perda
              </Label>
              <Textarea
                value={motivoPerda}
                onChange={(event) => setMotivoPerda(event.target.value)}
                placeholder="Por que o deal foi perdido?"
                className="min-h-[60px] resize-none text-sm"
              />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Resumo Diagnóstico Comercial
          </Label>
          <Textarea
            value={resumoDiagnosticoComercial}
            onChange={(event) =>
              setResumoDiagnosticoComercial(event.target.value)
            }
            placeholder="Resumo do diagnóstico..."
            className="min-h-[60px] resize-none text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Briefing Matriz
          </Label>
          <Textarea
            value={briefingMatriz}
            onChange={(event) => setBriefingMatriz(event.target.value)}
            placeholder="Briefing para a matriz..."
            className="min-h-[60px] resize-none text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Observações de Negociação
          </Label>
          <Textarea
            value={observacoesNegociacao}
            onChange={(event) => setObservacoesNegociacao(event.target.value)}
            placeholder="Observações..."
            className="min-h-[60px] resize-none text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Notas</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Contexto, próximos passos..."
            className="min-h-[80px] resize-none text-sm"
          />
        </div>
      </div>

      <DialogFooter className="flex items-center gap-2">
        {showDeleteConfirm ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate({ id: deal.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirmar exclusão
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Can permission="canEditAll">
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir deal
              </Button>
            </Can>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Can permission="canEditPipeline">
              <Button
                size="sm"
                onClick={() => {
                  const docs = documentosEnviados
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);

                  saveMutation.mutate({
                    id: deal.id,
                    data: {
                      title,
                      value: value || undefined,
                      probability,
                      stage,
                      notes,
                      produto,
                      expectedCloseDate: expectedClose
                        ? new Date(expectedClose).toISOString()
                        : undefined,
                      origem: origem || undefined,
                      resumoDiagnosticoComercial:
                        resumoDiagnosticoComercial || undefined,
                      briefingMatriz: briefingMatriz || undefined,
                      statusMatriz: statusMatriz || undefined,
                      observacoesNegociacao: observacoesNegociacao || undefined,
                      statusProposta: statusProposta || undefined,
                      motivoPerda: motivoPerda || undefined,
                      dataEnvioMatriz: dataEnvioMatriz
                        ? new Date(dataEnvioMatriz).toISOString()
                        : undefined,
                      prazoRetornoMatriz: prazoRetornoMatriz
                        ? new Date(prazoRetornoMatriz).toISOString()
                        : undefined,
                      dataRetornoMatriz: dataRetornoMatriz
                        ? new Date(dataRetornoMatriz).toISOString()
                        : undefined,
                      retornoMatriz: retornoMatriz || undefined,
                      documentosEnviados: docs.length > 0 ? docs : undefined,
                      responsavelEnvioMatriz:
                        responsavelEnvioMatriz || undefined,
                      pendenciasMatriz: pendenciasMatriz || undefined,
                    } as any,
                  });
                }}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Salvar
              </Button>
            </Can>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
