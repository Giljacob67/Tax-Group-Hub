import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useCreateCrmContact } from "@workspace/api-client-react";
import {
  ORIGEM_LEAD_OPTIONS,
  PRODUTO_INTERESSE_OPTIONS,
  TEMPERATURA_OPTIONS,
} from "@workspace/db/crm-constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export default function AddLeadDialog() {
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
  const [valorPotencial, setValorPotencial] = useState("");
  const [responsavelUnidade, setResponsavelUnidade] = useState("");
  const [proximoFollowup, setProximoFollowup] = useState("");
  const [pendenciasCliente, setPendenciasCliente] = useState("");
  const [pendenciasUnidade, setPendenciasUnidade] = useState("");
  const [pendenciasMatriz, setPendenciasMatriz] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  function resetForm() {
    setCnpj("");
    setSetor("");
    setSegmento("");
    setTemperatura("");
    setProdutoInteresse("");
    setOrigemLead("");
    setDecisor("");
    setContatoDecisor("");
    setObservacoes("");
    setValorPotencial("");
    setResponsavelUnidade("");
    setProximoFollowup("");
    setPendenciasCliente("");
    setPendenciasUnidade("");
    setPendenciasMatriz("");
  }

  const mutation = useCreateCrmContact({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
        toast({
          title: "Lead criado." + (data.contact ? " Dados enriquecidos." : ""),
        });
        setOpen(false);
        resetForm();
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Lead via CNPJ</DialogTitle>
          <DialogDescription>
            Busca automaticamente os dados no EmpresAqui (se configurado).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              placeholder="00.000.000/0001-00"
              value={cnpj}
              onChange={(event) => setCnpj(formatCnpj(event.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Input
                value={setor}
                onChange={(event) => setSetor(event.target.value)}
                placeholder="Ex: Agronegócio"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Input
                value={segmento}
                onChange={(event) => setSegmento(event.target.value)}
                placeholder="Ex: Cooperativas"
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Temperatura</Label>
              <Select value={temperatura} onValueChange={setTemperatura}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {TEMPERATURA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produto de Interesse</Label>
              <Select
                value={produtoInteresse}
                onValueChange={setProdutoInteresse}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTO_INTERESSE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Origem do Lead</Label>
            <Select value={origemLead} onValueChange={setOrigemLead}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Decisor</Label>
              <Input
                value={decisor}
                onChange={(event) => setDecisor(event.target.value)}
                placeholder="Nome do decisor"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contato do Decisor</Label>
              <Input
                value={contatoDecisor}
                onChange={(event) => setContatoDecisor(event.target.value)}
                placeholder="E-mail ou telefone"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-border/40 pt-2">
            <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Operação · Pendências & Acompanhamento
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor Potencial (R$)</Label>
                <Input
                  type="number"
                  value={valorPotencial}
                  onChange={(event) => setValorPotencial(event.target.value)}
                  placeholder="0"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável Unidade</Label>
                <Input
                  value={responsavelUnidade}
                  onChange={(event) =>
                    setResponsavelUnidade(event.target.value)
                  }
                  placeholder="Nome do responsável"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Próximo Follow-up</Label>
              <Input
                type="date"
                value={proximoFollowup}
                onChange={(event) => setProximoFollowup(event.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pendências do Cliente</Label>
              <Textarea
                value={pendenciasCliente}
                onChange={(event) => setPendenciasCliente(event.target.value)}
                placeholder="O que o cliente precisa enviar/fornecer..."
                className="min-h-[50px] resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pendências da Unidade</Label>
              <Textarea
                value={pendenciasUnidade}
                onChange={(event) => setPendenciasUnidade(event.target.value)}
                placeholder="Pendências internas da unidade..."
                className="min-h-[50px] resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pendências da Matriz</Label>
              <Textarea
                value={pendenciasMatriz}
                onChange={(event) => setPendenciasMatriz(event.target.value)}
                placeholder="Pendências com a Matriz..."
                className="min-h-[50px] resize-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              placeholder="Anotações sobre o lead..."
              className="min-h-[60px] resize-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              mutation.mutate({
                data: {
                  cnpj: cnpj.replace(/\D/g, ""),
                  setor: setor || undefined,
                  segmento: segmento || undefined,
                  temperatura: temperatura || undefined,
                  produtoInteresse: produtoInteresse || undefined,
                  origemLead: origemLead || undefined,
                  nomeDecissor: decisor || undefined,
                  contatoDecisor: contatoDecisor || undefined,
                  observacoes: observacoes || undefined,
                  valorPotencial: valorPotencial || undefined,
                  responsavelUnidade: responsavelUnidade || undefined,
                  proximoFollowup: proximoFollowup
                    ? new Date(proximoFollowup).toISOString()
                    : undefined,
                  pendenciasCliente: pendenciasCliente || undefined,
                  pendenciasUnidade: pendenciasUnidade || undefined,
                  pendenciasMatriz: pendenciasMatriz || undefined,
                } as any,
              })
            }
            disabled={mutation.isPending || cnpj.replace(/\D/g, "").length < 14}
            className="w-full"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {mutation.isPending ? "Buscando..." : "Criar e Enriquecer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
