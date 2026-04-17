import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import Papa from "papaparse";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkImportDialog({ open, onOpenChange, onSuccess }: BulkImportDialogProps) {
  const { toast } = useToast();
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [parsedData, setParsedData] = useState<{ cnpj: string }[]>([]);
  const [importResults, setImportResults] = useState<{ created: number; duplicates: number; errors: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParsedData([]);
    setImportResults(null);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        // Find the column that looks mostly like CNPJs or just flatten everything and extract 14-digit numbers
        const extractCnpjs = (data: string[][]) => {
          const cnpjs = new Set<string>();
          data.forEach(row => {
            row.forEach(cell => {
              if (typeof cell !== "string") return;
              const clean = cell.replace(/\D/g, "");
              if (clean.length === 14) {
                cnpjs.add(clean);
              }
            });
          });
          return Array.from(cnpjs);
        };

        const cnpjs = extractCnpjs(results.data as string[][]);
        
        setIsParsing(false);
        if (cnpjs.length === 0) {
          toast({
            title: "Nenhum CNPJ encontrado",
            description: "Não conseguimos achar números de 14 dígitos válidos no seu arquivo.",
            variant: "destructive"
          });
          return;
        }

        setParsedData(cnpjs.map(cnpj => ({ cnpj })));
      },
      error: (error) => {
        setIsParsing(false);
        toast({ title: "Erro na leitura", description: error.message, variant: "destructive" });
      }
    });

    // Reset input
    e.target.value = '';
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);
    setImportResults(null);

    const CHUNK_SIZE = 10;
    const allCnpjs = parsedData.map(d => d.cnpj);
    let totalCreated = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;

    try {
      for (let i = 0; i < allCnpjs.length; i += CHUNK_SIZE) {
        const chunk = allCnpjs.slice(i, i + CHUNK_SIZE);
        const req = await fetch("/api/crm/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpjs: chunk })
        });
        const res = await req.json();
        if (res.success && res.summary) {
          totalCreated += res.summary.created || 0;
          totalDuplicates += res.summary.duplicates || 0;
          totalErrors += res.summary.errors || 0;
        }
      }

      setImportResults({
        created: totalCreated,
        duplicates: totalDuplicates,
        errors: totalErrors
      });

      toast({
        title: "Importação concluída!",
        description: `${totalCreated} leads inseridos com sucesso.`
      });

      if (onSuccess) onSuccess();

    } catch (err: any) {
      toast({
        title: "Falha na importação",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) {
        setParsedData([]);
        setImportResults(null);
      }
    }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Importação em Lote de Leads</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV ou Excel. Nós encontraremos automaticamente todos os CNPJs e faremos o enriquecimento na base do EmpresAqui.
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
                  {isParsing ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <UploadCloud className="w-6 h-6 text-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Clique ou arraste seu arquivo aqui</p>
                  <p className="text-xs text-muted-foreground mt-1">Extensões suportadas: .csv</p>
                </div>
              </div>
            </div>
          )}

          {parsedData.length > 0 && !importResults && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-primary">Pronto para importar</h4>
                  <p className="text-xs text-primary/80 mt-1">
                    Encontramos <strong>{parsedData.length}</strong> CNPJs válidos no seu arquivo. Eles serão adicionados e enriquecidos sequencialmente. Isso pode levar alguns minutos.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setParsedData([])} disabled={isImporting}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleImport} disabled={isImporting}>
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isImporting ? "Importando..." : "Iniciar Importação"}
                </Button>
              </div>
            </div>
          )}

          {importResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                  <div className="text-2xl font-semibold text-emerald-500 mb-1">{importResults.created}</div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Criados</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                  <div className="text-2xl font-semibold text-amber-500 mb-1">{importResults.duplicates}</div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Duplicados</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center border border-border/50">
                  <div className="text-2xl font-semibold text-rose-500 mb-1">{importResults.errors}</div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Erros</div>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-500 font-medium">Tudo finalizado! Os leads já estão disponíveis na sua base.</p>
              </div>

              <Button className="w-full mt-4" onClick={() => onOpenChange(false)}>
                Ver Painel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
