import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  FileText, UploadCloud, Trash2, Shield, Search,
  Database, Loader2, File, FileImage, FileVideo, CheckCircle2
} from "lucide-react";
import {
  useListKnowledgeDocuments,
  useDeleteKnowledgeDocument,
  useSearchKnowledge
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListKnowledgeDocumentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function KnowledgeBase() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{documentId: string; filename: string; score: number; content?: string}>>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: docsData, isLoading: isLoadingDocs } = useListKnowledgeDocuments(undefined, {
    query: {
      refetchInterval: (data: any) => {
        const hasPending = data?.documents?.some((doc: any) => doc.status === "pending" || !doc.processed);
        return hasPending ? 5000 : false;
      }
    } as any
  });
  const deleteMutation = useDeleteKnowledgeDocument();
  const searchMutation = useSearchKnowledge();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setIsUploading(true);
    const errors: string[] = [];
    try {
      for (const file of acceptedFiles) {
        // Pre-validate size (50MB)
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          errors.push(`${file.name}: excede 50MB`);
          continue;
        }

        setUploadProgress((prev) => ({ ...prev, [file.name]: "Enviando..." }));
        const formData = new FormData();
        formData.append("file", file);
        formData.append("agentId", "global");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        try {
          const res = await fetch("/api/knowledge/upload", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            let msg = `Erro ${res.status}`;
            try {
              const errData = await res.json();
              msg = errData.error || msg;
            } catch { /* ignore parse error */ }
            errors.push(`${file.name}: ${msg}`);
            setUploadProgress((prev) => ({ ...prev, [file.name]: "Falhou" }));
            continue;
          }

          const data = await res.json();
          setUploadProgress((prev) => ({ ...prev, [file.name]: "Enviado ✓" }));
          toast({
            title: `${file.name} enviado`,
            description: data.document?.status === "pending"
              ? "Documento recebido. Processamento em andamento."
              : "Conteúdo extraído e indexado para RAG.",
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === "AbortError") {
            errors.push(`${file.name}: timeout (demorou mais de 60s)`);
          } else {
            errors.push(`${file.name}: ${fetchErr.message || "Falha na conexão"}`);
          }
          setUploadProgress((prev) => ({ ...prev, [file.name]: "Falhou" }));
        }
      }
      queryClient.invalidateQueries({ queryKey: getListKnowledgeDocumentsQueryKey() });
    } catch (err) {
      console.error("[Knowledge] upload failed:", err);
    } finally {
      setIsUploading(false);
      if (errors.length > 0) {
        toast({
          title: errors.length === 1 ? "Erro no upload" : `${errors.length} arquivos não foram enviados`,
          description: errors.join("; ").slice(0, 200),
          variant: "destructive",
        });
      }
      // clear progress after a delay
      setTimeout(() => setUploadProgress({}), 4000);
    }
  }, [queryClient, toast]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/x-markdown': ['.md'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ documentId: deleteTarget });
      queryClient.invalidateQueries({ queryKey: getListKnowledgeDocumentsQueryKey() });
      toast({ title: "Documento excluído" });
    } catch (err) {
      console.error("[Knowledge] delete failed:", err);
      toast({ title: "Erro ao excluir documento", variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await searchMutation.mutateAsync({ data: { query: searchQuery, limit: 5 } });
      setSearchResults(res.results || []);
      toast({ title: `${res.results?.length || 0} resultado(s) para "${searchQuery}"` });
    } catch (err) {
      console.error("[Knowledge] search failed:", err);
      toast({ title: "Erro na busca", variant: "destructive" });
      setSearchResults([]);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <FileImage className="w-8 h-8 text-primary" />;
    if (type.includes('video')) return <FileVideo className="w-8 h-8 text-primary" />;
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-muted-foreground" />;
    return <File className="w-8 h-8 text-muted-foreground" />;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Base de Conhecimento</h1>
            <p className="text-muted-foreground mt-1">Gerencie documentos usados pelos agentes para RAG (Retrieval-Augmented Generation).</p>
          </div>
          <form onSubmit={handleSearch} className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Busca semântica nos documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </form>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Resultados da busca</h2>
              <button onClick={() => setSearchResults([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Limpar</button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {searchResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.filename}</div>
                    {r.content && <div className="text-xs text-muted-foreground truncate">{r.content}</div>}
                  </div>
                  <span className="text-xs font-mono text-primary ml-3 shrink-0">{Math.round((r.score || 0) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border/60 hover:border-primary/50 hover:bg-card/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 mx-auto bg-card rounded-full flex items-center justify-center mb-4 shadow-sm border border-border/50">
            {isUploading ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />}
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {isDragActive ? "Solte os arquivos aqui..." : "Arraste e solte ou clique para enviar"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Suporta PDF, Word (.docx), Markdown e TXT até 50MB. O conteúdo textual é extraído automaticamente para uso em RAG.
          </p>
          {fileRejections.length > 0 && (
            <div className="mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 max-w-md mx-auto">
              {fileRejections.map(({ file, errors }) => (
                <div key={file.name}>
                  <strong>{file.name}</strong>: {errors.map(e => e.message).join(", ")}
                </div>
              ))}
            </div>
          )}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-3 space-y-1 max-w-md mx-auto">
              {Object.entries(uploadProgress).map(([name, status]) => (
                <div key={name} className="flex items-center justify-between text-xs bg-card rounded px-3 py-1.5 border border-border/50">
                  <span className="truncate max-w-[200px]" title={name}>{name}</span>
                  <span className={status === "Falhou" ? "text-destructive font-medium" : "text-primary font-medium"}>{status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-primary" /> Documentos Indexados
          </h2>
          {isLoadingDocs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i: number) => (
                <div key={i} className="bg-card/50 border border-border/50 rounded-xl p-5 h-28 animate-pulse flex items-start space-x-3">
                   <div className="w-10 h-10 bg-muted/40 rounded-lg" />
                   <div className="flex-1 space-y-2">
                     <div className="h-4 bg-muted/40 rounded w-3/4" />
                     <div className="h-3 bg-muted/30 rounded w-1/2" />
                   </div>
                </div>
              ))}
            </div>
          ) : docsData?.documents?.length === 0 ? (
            <div className="text-center py-16 bg-card/30 rounded-xl border border-border/50">
              <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">Base de conhecimento vazia</h3>
              <p className="text-muted-foreground max-w-md mx-auto">Envie legislação tributária, pareceres, modelos de contrato e normas para que os agentes respondam com precisão jurídica.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docsData?.documents?.map((doc: any, i: number) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  key={doc.id}
                  className="bg-card border border-border/50 hover:border-primary/30 rounded-xl p-5 group transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 overflow-hidden">
                      <div className="p-2 bg-background rounded-lg border border-border/50 flex-shrink-0">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-semibold text-sm truncate text-foreground" title={doc.filename}>{doc.filename}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                            doc.hasContent || doc.status === "processed"
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted/10 text-muted-foreground'
                          }`}>
                            {doc.hasContent || doc.status === "processed" ? (
                              <><CheckCircle2 className="w-2.5 h-2.5" /> Indexado</>
                            ) : doc.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Enviado em {format(new Date(doc.createdAt), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(doc.id)}
                      disabled={deleteMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O documento será removido da base de conhecimento dos agentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
