import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import {
  useCreateCrmDeal,
  useListCrmContacts,
} from "@workspace/api-client-react";
import {
  DEFAULT_PIPELINE_ID,
  PIPELINE_STAGE_LABELS,
} from "@workspace/db/crm-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Props = {
  stage: string;
  stageLabel?: string;
  onDone: () => void;
};

export default function QuickAddDealForm({
  stage,
  stageLabel,
  onDone,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contactId, setContactId] = useState("");
  const { data: contactsData } = useListCrmContacts();

  const contacts = contactsData?.contacts || [];
  const resolvedStageLabel =
    stageLabel ||
    PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS] ||
    stage;

  const mutation = useCreateCrmDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["/api/crm/deals/pipeline"],
        });
        toast({ title: `Deal criado em ${resolvedStageLabel}!` });
        onDone();
      },
      onError: (error: any) =>
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        }),
    },
  });

  return (
    <div className="mt-1 space-y-2 border-t border-border/50 p-2">
      <Input
        placeholder="Título da oportunidade"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="h-7 text-xs"
        autoFocus
      />
      {contacts.length > 1 && (
        <select
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
          className="w-full rounded border border-border/50 bg-muted/50 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">Selecionar contato...</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.razaoSocial || contact.cnpj}
            </option>
          ))}
        </select>
      )}
      <Input
        type="number"
        placeholder="Valor (R$)"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-7 text-xs"
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() =>
            mutation.mutate({
              data: {
                title: title || "Nova Oportunidade",
                stage,
                value: value || undefined,
                contactId: contactId ? Number(contactId) : contacts[0]?.id,
                probability: 20,
                pipelineId: DEFAULT_PIPELINE_ID,
              },
            })
          }
          disabled={mutation.isPending || contacts.length === 0}
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Criar"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onDone}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
