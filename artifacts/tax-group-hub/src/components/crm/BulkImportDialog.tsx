import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/** Extrai CNPJs (14 dígitos) de qualquer célula. Células numéricas do Excel
 *  podem perder zeros à esquerda — completa até 14 quando plausível. */
function extractCnpjs(rows: unknown[][]): string[] {
  const cnpjs = new Set<string>();
  rows.forEach((row) => {
    row.forEach((cell) => {
      if (cell === null || cell === undefined) return;
      const isNumeric = typeof cell === "number";
      const clean = String(cell).replace(/\D/g, "");
      if (clean.length === 14) {
        cnpjs.add(clean);
      } else if (isNumeric && clean.length >= 12 && clean.length < 14) {
        cnpjs.add(clean.padStart(14, "0"));
      }
    });
  });
  return Array.from(cnpjs);
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: BulkImportDialogProps) {
  const { toast } = useToast();
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [parsedData, setParsedData] = useState<{ cnpj: string }[]>([]);
  const [importResults, setImportResults] = useState<{
    created: number;
    duplicates: number;
    errors: number;
  } | null>(null);
  const [createdIds, setCreatedIds] = useState<number[]>([]);
  const [enrichmentDisabled, setEnrichmentDisabled] = useState(false);

  // Qualificação em lote pós-importação
  const [isQualifying, setIsQualifying] = useState(false);
  const [qualifyProgress, setQualifyProgress] = useState(0);
  const [qualifyDone, setQualifyDone] = useState<{
    ok: number;
    failed: number;
  } | null>(null);

  const resetAll = () => {
    setParsedData([]);
    setImportResults(null);
    setCreatedIds([]);
    setEnrichmentDisabled(false);
    setIsQualifying(false);
    setQualifyProgress(0);
    setQualifyDone(null);
  };

  const finishParse = (cnpjs: string[]) => {
    setIsParsing(false);
    if (cnpjs.length === 0) {
      toast({
        title: "Nenhum CNPJ encontrado",
        description:
          "Não conseguimos achar números de 14 dígitos válidos no seu arquivo.",
        variant: "destructive",
      });
      return;
    }
    setParsedData(cnpjs.map((cnpj) => ({ cnpj })));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParsedData([]);
    setImportResults(null);

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    if (isExcel) {
      file
        .arrayBuffer()
        .then((buf) => {
          const wb = XLSX.read(buf, { type: "array" });
          const rows: unknown[][] = [];
          wb.SheetNames.forEach((name) => {
            const sheet = wb.Sheets[name];
            const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
              header: 1,
              raw: true,
            });
            rows.push(...data);
          });
          finishParse(extractCnpjs(rows));
        })
        .catch((error: Error) => {
          setIsParsing(false);
          toast({
            title: "Erro na leitura do Excel",
            description: error.message,
            variant: "destructive",
          });
        });
    } else {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          finishParse(extractCnpjs(results.data as unknown[][]));
        },
        error: (error) => {
          setIsParsing(false);
          toast({
            title: "Erro na leitura",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    }

    // Reset input
    e.target.value = "";
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);
    setImportResults(null);

    const CHUNK_SIZE = 10;
    const allCnpjs = parsedData.map((d) => d.cnpj);
    let totalCreated = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    const newIds: number[] = [];

    try {
      for (let i = 0; i < allCnpjs.length; i += CHUNK_SIZE) {
        const chunk = allCnpjs.slice(i, i + CHUNK_SIZE);
        const req = await fetch("/api/crm/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpjs: chunk }),
        });
        const res = await req.json();
        if (res.success && res.summary) {
          totalCreated += res.summary.created || 0;
          totalDuplicates += res.summary.duplicates || 0;
          totalErrors += res.summary.errors || 0;
          if (res.enrichment === "disabled") setEnrichmentDisabled(true);
          (res.results || []).forEach(
            (r: { status: string; contactId?: number }) => {
              if (r.status === "created" && r.contactId)
                newIds.push(r.contactId);
            },
          );
        }
      }

      setImportResults({
        created: totalCreated,
        duplicates: totalDuplicates,
        errors: totalErrors,
      });
      setCreatedIds(newIds);

      toast({
        title: "Importação concluída!",
        description: `${totalCreated} leads inseridos com sucesso.`,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast({
        title: "Falha na importação",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleQualifyAll = async () => {
    if (createdIds.length === 0) return;
    setIsQualifying(true);
    setQualifyProgress(0);
    let ok = 0;
    let failed = 0;

    for (let i = 0; i < createdIds.length; i++) {
      try {
        const req = await fetch(`/api/crm/contacts/${createdIds[i]}/qualify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (req.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
      setQualifyProgress(i + 1);
    }

    setIsQualifying(false);
    setQualifyDone({ ok, failed });
    toast({
      title: "Qualificação concluída",
      description: `${ok} leads qualificados pela IA${failed ? `, ${failed} falharam` : ""}.`,
    });
    if (onSuccess) onSuccess();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (isQualifying) return; // não fechar no meio da qualificação
        onOpenChange(val);
        if (!val) resetAll();
      }}
    >
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Importação em Lote de Leads</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV ou Excel. Nós encontraremos
            automaticamente todos os CNPJs e faremos o enriquecimento na base do
            EmpresAqui.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {!parsedData.length && !importResults && (
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/20 relative hover:bg-muted/40 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isParsing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {isParsing ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : (
                    <UploadCloud className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Clique ou arraste seu arquivo aqui
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Extensões suportadas: .csv, .xlsx, .xls
                  </p>
                </div>
              </div>
            </div>
          )}

          {parsedData.length > 0 && !importResults && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-primary">
                    Pronto para importar
                  </h4>
                  <p className="text-xs text-primary/80 mt-1">
                    Encontramos <strong>{parsedData.length}</strong> CNPJs
                    válidos no seu arquivo. Eles serão adicionados e
                    enriquecidos sequencialmente. Isso pode levar alguns
                    minutos.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setParsedData([])}
                  disabled={isImporting}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleImport}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isImporting ? "Importando..." : "Iniciar Importação"}
                </Button>
              </div>
            </div>
          )}

          {importResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                  <div className="text-2xl font-semibold text-emerald-500 mb-1">
                    {importResults.created}
                  </div>
                  <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                    Criados
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                  <div className="text-2xl font-semibold text-amber-500 mb-1">
                    {importResults.duplicates}
                  </div>
                  <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                    Duplicados
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                  <div className="text-2xl font-semibold text-rose-500 mb-1">
                    {importResults.errors}
                  </div>
                  <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                    Erros
                  </div>
                </div>
              </div>

              {enrichmentDisabled && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Token do EmpresAqui não configurado — os leads foram
                    importados sem enriquecimento de dados. Configure em
                    Integrações.
                  </p>
                </div>
              )}

              {isQualifying ? (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                    <p className="text-xs font-medium text-primary">
                      Qualificando leads com IA... {qualifyProgress}/
                      {createdIds.length}
                    </p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.round((qualifyProgress / createdIds.length) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : qualifyDone ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-500 font-medium">
                    {qualifyDone.ok} leads qualificados pela IA
                    {qualifyDone.failed
                      ? ` (${qualifyDone.failed} falharam)`
                      : ""}
                    . Veja os scores na aba Empresas.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-500 font-medium">
                    Tudo finalizado! Os leads já estão disponíveis na sua base.
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                {createdIds.length > 0 && !qualifyDone && (
                  <Button
                    className="flex-1"
                    onClick={handleQualifyAll}
                    disabled={isQualifying}
                  >
                    {isQualifying ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Qualificar todos com IA ({createdIds.length})
                  </Button>
                )}
                <Button
                  variant={
                    createdIds.length > 0 && !qualifyDone
                      ? "outline"
                      : "default"
                  }
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    resetAll();
                  }}
                  disabled={isQualifying}
                >
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
