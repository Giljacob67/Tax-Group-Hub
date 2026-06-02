import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, Loader2, Sparkles, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetCrmContactNextStep,
  useAcceptCrmContactNextStep,
  useIgnoreCrmContactNextStep,
} from "@workspace/api-client-react";

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  baixa:    { label: "Baixa",   color: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
  media:    { label: "Média",   color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  alta:     { label: "Alta",    color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  urgente:  { label: "Urgente", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  urgente_: { label: "Urgente", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

export default function NextStepCard({ contactId, compact = false }: { contactId: number; compact?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useGetCrmContactNextStep(contactId, {
    query: { enabled: !!contactId && !dismissed },
  } as any);

  const acceptMutation = useAcceptCrmContactNextStep({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/${contactId}/next-step`] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
        toast({ title: "Tarefa criada a partir da recomendação" });
        setDismissed(true);
      },
      onError: () => toast({ title: "Erro ao criar tarefa", variant: "destructive" }),
    },
  });

  const ignoreMutation = useIgnoreCrmContactNextStep({
    mutation: {
      onSuccess: () => {
        toast({ title: "Recomendação ignorada" });
        setDismissed(true);
      },
    },
  });

  if (dismissed) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="w-3 h-3 animate-spin" /> Calculando próximo passo...
      </div>
    );
  }
  if (!data?.recommendation) return null;

  const rec = data.recommendation as any;
  const prio = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.baixa;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/20 bg-primary/5">
        <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground truncate">{rec.label}</span>
            <Badge variant="outline" className={`text-[10px] ${prio.color}`}>{prio.label}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{rec.reason}</p>
        </div>
        {rec.taskTemplate && (
          <Button size="sm" variant="default" className="h-7 text-xs"
            onClick={() => acceptMutation.mutate({ id: contactId })}
            disabled={acceptMutation.isPending}>
            {acceptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">Próximo passo recomendado</span>
            <Badge variant="outline" className={`text-[10px] ${prio.color}`}>{prio.label}</Badge>
          </div>
          <p className="text-sm font-medium text-foreground mt-1.5">{rec.label}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rec.reason}</p>
        </div>
      </div>

      {rec.taskTemplate && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm" className="h-8 text-xs gap-1.5"
            onClick={() => acceptMutation.mutate({ id: contactId })}
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <ArrowRight className="w-3 h-3" />}
            Criar tarefa e seguir
          </Button>
          <Button
            variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => ignoreMutation.mutate({ id: contactId })}
            disabled={ignoreMutation.isPending}
          >
            <X className="w-3 h-3 mr-1" />
            Ignorar
          </Button>
        </div>
      )}
    </div>
  );
}
