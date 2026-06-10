import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, FileText, Send, AlertCircle } from "lucide-react";
import { useGetCrmContactBriefingChecklist, useListCrmDeals, useSendToMatriz } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface BriefingChecklistProps {
  contactId: number;
  dealId?: number;
  onSendToMatriz?: () => void;
}

export default function BriefingChecklist({
  contactId,
  dealId,
  onSendToMatriz,
}: BriefingChecklistProps) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  
  const { data, isLoading } = useGetCrmContactBriefingChecklist(contactId, {
    query: { enabled: !!contactId },
  } as any);

  // Buscar deals do contato para encontrar o deal ativo
  const { data: dealsData } = useListCrmDeals({ contactId } as any, {
    query: { enabled: !!contactId && !dealId },
  } as any);

  const sendToMatrizMutation = useSendToMatriz({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/deals/pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        setSending(false);
        onSendToMatriz?.();
      },
      onError: () => {
        setSending(false);
      },
    },
  });

  const handleSendToMatriz = async () => {
    if (!dealId && !dealsData?.deals?.length) return;
    
    const targetDealId = dealId || dealsData?.deals?.[0]?.id;
    if (!targetDealId) return;

    setSending(true);
    sendToMatrizMutation.mutate({ id: targetDealId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="w-3 h-3 animate-spin" /> Carregando checklist...
      </div>
    );
  }

  if (!data) return null;

  const checklist: any[] = data.checklist || [];
  const ready = data.ready;
  const completionPct = data.completionPct;
  const missing: string[] = data.missingRequired || [];
  
  // Verificar se já foi enviado para matriz
  const currentDeal = dealsData?.deals?.[0] as any;
  const alreadySent = currentDeal?.statusMatriz && 
    ["enviado", "aguardando", "retorno_recebido", "proposta_liberada"].includes(currentDeal.statusMatriz);

  return (
    <div className="rounded-lg border border-border/50 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">Briefing para Matriz</h4>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${
                ready ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {completionPct}%
          </span>
        </div>
      </div>

      {alreadySent ? (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20">
          <CheckCircle2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-blue-300 font-medium">
            Briefing enviado à Matriz em {currentDeal.dataEnvioMatriz ? new Date(currentDeal.dataEnvioMatriz).toLocaleDateString("pt-BR") : "data desconhecida"}
          </span>
        </div>
      ) : ready ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-300 font-medium">
              Pronto para enviar à Matriz. Todos os campos obrigatórios preenchidos.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleSendToMatriz}
            disabled={sending}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Enviar para Matriz
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-300">
            Faltam {missing.length} campo(s) obrigatório(s) antes de enviar à Matriz.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1">
        {checklist.map((item: any) => (
          <div key={item.id} className="flex items-center gap-2 text-xs">
            {item.present ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle
                className={`w-3 h-3 flex-shrink-0 ${item.required ? "text-red-400" : "text-muted-foreground/50"}`}
              />
            )}
            <span
              className={`flex-1 ${item.present ? "text-foreground" : item.required ? "text-muted-foreground" : "text-muted-foreground/60"}`}
            >
              {item.label}
              {item.required && !item.present && (
                <span className="text-red-400 ml-1">*</span>
              )}
            </span>
            {item.present && item.value && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {item.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
