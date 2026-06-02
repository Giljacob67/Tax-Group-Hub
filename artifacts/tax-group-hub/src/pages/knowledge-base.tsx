import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { put } from "@vercel/blob/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, UploadCloud, Trash2, Search, Loader2, File,
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw,
  ChevronDown, ChevronRight, Eye, Layers, Cpu, Copy,
  Zap, Activity, Settings2,
} from "lucide-react";
import {
  useListKnowledgeDocuments,
  useDeleteKnowledgeDocument,
  useGetKnowledgeHealth,
  useGetDocumentChunks,
  useReindexDocument,
  useSearchKnowledgeDedicated,
} from "@workspace/api-client-react";
import { getListKnowledgeDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeDoc {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  agentId: string;
  status: "pending" | "processing" | "processed" | "error";
  processed: boolean;
  hasContent: boolean;
  category: string | null;
  product: string | null;
  origin: string | null;
  tags: string[];
  chunkCount: number;
  retries: number;
  errorLog: string | null;
  embeddingModel: string | null;
  createdAt: string;
}

interface Chunk {
  id: string;
  index: number;
  content: string;
  tokens: number;
  hasEmbedding: boolean;
  createdAt: string;
}

interface SearchResult {
  documentId: string;
  chunkId: string | null;
  filename: string;
  content: string;
  score: number;
  category: string | null;
  product: string | null;
  origin: string | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Diagnóstico Tributário", "RTI", "AFD", "REP", "Reforma Tributária",
  "Propostas Comerciais", "Objeções Comerciais", "Cases", "Scripts de Prospecção",
  "Marketing", "Jurídico", "Operação Interna",
];

const PRODUCTS = ["RTI", "AFD", "REP", "Reforma Tributária", "Comercial", "Jurídico", "Marketing"];

const TABS = [
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "search",    label: "Busca Semântica", icon: Search },
  { id: "status",    label: "Status", icon: Activity },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "processed": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "processing": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "pending":   return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "error":     return "text-red-400 bg-red-400/10 border-red-400/20";
    default:          return "text-muted-foreground bg-muted/10 border-border";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "processed": return "Indexado";
    case "processing": return "Processando";
    case "pending":   return "Pendente";
    case "error":     return "Erro";
    default:          return status;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "processed": return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "processing": return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    case "pending":   return <Clock className="w-3.5 h-3.5" />;
    case "error":     return <XCircle className="w-3.5 h-3.5" />;
    default:          return null;
  }
}

function FileIcon({ type }: { type: string }) {
  if (type.includes("pdf"))
    return <FileText className="w-4 h-4 text-red-400" />;
  if (type.includes("word") || type.includes("docx") || type.includes("document"))
    return <FileText className="w-4 h-4 text-primary/70" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function friendlyError(log: string | null): { cause: string; action: string } {
  if (!log) return { cause: "Erro desconhecido.", action: "Tente reindexar." };
  const l = log.toLowerCase();
  if (l.includes("embedding") || l.includes("api key") || l.includes("provider"))
    return { cause: "Provedor de embeddings não configurado.", action: "Configure uma chave de API em Configurações → Central de Modelos." };
  if (l.includes("pdf") || l.includes("parse") || l.includes("extract"))
    return { cause: "PDF sem texto extraível ou corrompido.", action: "PDFs escaneados precisam de OCR. Tente exportar como texto." };
  if (l.includes("mammoth") || l.includes("docx"))
    return { cause: "Falha ao ler arquivo Word.", action: "Converta para PDF ou TXT e faça novo upload." };
  if (l.includes("size") || l.includes("limit"))
    return { cause: "Arquivo grande demais.", action: "Limite: 50MB. Divida o documento." };
  if (l.includes("not found") || l.includes("enoent"))
    return { cause: "Arquivo não encontrado no servidor.", action: "Faça novo upload." };
  return { cause: log.slice(0, 120), action: "Tente reindexar ou faça novo upload." };
}

// ─── UploadPanel ─────────────────────────────────────────────────────────────

function UploadPanel({ onUploadDone }: { onUploadDone: () => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ name: string; done: number; total: number } | null>(null);
  const [category, setCategory] = useState("");
  const [product, setProduct] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    let success = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ name: file.name, done: i, total: files.length });
      try {
        const tokenRes = await fetch("/api/knowledge/upload-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        const tokenData = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenData.token || !tokenData.pathname) {
          throw new Error(tokenData.error || "Falha ao obter token de upload");
        }

        const blobResult = await put(tokenData.pathname, file, {
          access: "private",
          token: tokenData.token,
        });

        const r = await fetch("/api/knowledge/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: blobResult.url,
            filename: file.name,
            mimetype: file.type || "application/octet-stream",
            agentId: "global",
            origin: "upload",
            ...(category ? { category } : {}),
            ...(product ? { product } : {}),
          }),
        });
        const result = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((result as any).error || `HTTP ${r.status}`);
        success++;
      } catch (e: any) {
        toast({ title: `Erro: ${file.name}`, description: e.message ?? "Falha no upload", variant: "destructive" });
      }
    }

    setProgress(null);
    setUploading(false);
    if (success) {
      toast({
        title: `${success} arquivo(s) enviado(s)`,
        description: files.length > 1
          ? "Serão indexados em até 5 minutos."
          : "Será indexado em instantes.",
      });
      onUploadDone();
    }
  }, [category, product, onUploadDone, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxSize: 50 * 1024 * 1024,
    disabled: uploading,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          uploading
            ? "border-primary/30 bg-primary/5 cursor-wait"
            : isDragActive
            ? "border-primary bg-primary/5 cursor-copy"
            : "border-border/60 hover:border-primary/40 hover:bg-card/50 cursor-pointer"
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-12 h-12 mx-auto bg-card border border-border/50 rounded-full flex items-center justify-center mb-3">
          {uploading
            ? <Loader2 className="w-6 h-6 text-primary animate-spin" />
            : <UploadCloud className={`w-6 h-6 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
          }
        </div>
        {uploading && progress ? (
          <div className="space-y-1">
            <p className="font-semibold text-sm text-primary">Enviando {progress.name}…</p>
            <p className="text-xs text-muted-foreground">
              {progress.done + 1} de {progress.total} arquivo(s)
            </p>
          </div>
        ) : (
          <>
            <p className="font-semibold text-sm">
              {isDragActive ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT, MD — até 50MB por arquivo</p>
          </>
        )}
      </div>

      <button
        onClick={() => setShowOptions(!showOptions)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Metadados opcionais
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptions ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">— Selecionar —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Produto</label>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">— Selecionar —</option>
                  {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── DocumentsTable ───────────────────────────────────────────────────────────

function DocumentsTable({
  docs,
  onDelete,
  onReindex,
  onViewChunks,
  reindexing,
}: {
  docs: KnowledgeDoc[];
  onDelete: (id: string) => void;
  onReindex: (id: string) => void;
  onViewChunks: (doc: KnowledgeDoc) => void;
  reindexing: Set<string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!docs.length) {
    return (
      <div className="text-center py-16 bg-card/30 rounded-xl border border-border/50">
        <UploadCloud className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="font-medium text-muted-foreground">Nenhum documento ainda</h3>
        <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto mt-1">
          Adicione documentos tributários, propostas e materiais comerciais para que os agentes respondam com fontes confiáveis.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-card/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Documento</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Categoria</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Chunks</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Data</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <>
              <tr
                key={doc.id}
                className={`border-b border-border/30 hover:bg-card/50 transition-colors cursor-pointer ${expandedId === doc.id ? "bg-card/30" : ""}`}
                onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-background border border-border/50 rounded-lg shrink-0">
                      <FileIcon type={doc.fileType} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate max-w-[200px]" title={doc.filename}>{doc.filename}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-transform ${expandedId === doc.id ? "rotate-90" : ""}`} />
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {doc.category && <Badge variant="outline" className="text-xs">{doc.category}</Badge>}
                    {doc.product && <Badge variant="outline" className="text-xs border-primary/30 text-primary">{doc.product}</Badge>}
                    {!doc.category && !doc.product && <span className="text-xs text-muted-foreground/50">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${statusColor(doc.status)}`}>
                    <StatusIcon status={doc.status} />
                    {statusLabel(doc.status)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-muted-foreground tabular-nums">{doc.chunkCount > 0 ? doc.chunkCount : "—"}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                  {(() => { try { return format(new Date(doc.createdAt), "dd/MM/yy"); } catch { return "—"; } })()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {doc.chunkCount > 0 && (
                      <button
                        onClick={() => onViewChunks(doc)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        title="Ver chunks indexados"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onReindex(doc.id)}
                      disabled={reindexing.has(doc.id)}
                      className="p-1.5 text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all disabled:opacity-40"
                      title="Reindexar documento"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reindexing.has(doc.id) ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={() => onDelete(doc.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                      title="Excluir documento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>

              <AnimatePresence>
                {expandedId === doc.id && (
                  <tr key={`${doc.id}-exp`}>
                    <td colSpan={6} className="bg-card/20 px-6 py-4">
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="space-y-3"
                      >
                        {doc.status === "error" && doc.errorLog && (() => {
                          const { cause, action } = friendlyError(doc.errorLog);
                          return (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-2">
                              <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                <XCircle className="w-4 h-4" /> Falha no processamento
                              </div>
                              <p className="text-sm"><span className="text-muted-foreground">Causa:</span> {cause}</p>
                              <p className="text-sm"><span className="text-muted-foreground">Ação:</span> {action}</p>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(doc.errorLog!); }}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Copiar log técnico
                              </button>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-muted-foreground">Tipo</p><p className="font-medium mt-0.5">{doc.fileType}</p></div>
                          <div><p className="text-muted-foreground">Tamanho</p><p className="font-medium mt-0.5">{formatBytes(doc.fileSize)}</p></div>
                          <div><p className="text-muted-foreground">Chunks</p><p className="font-medium mt-0.5">{doc.chunkCount || "0"}</p></div>
                          <div><p className="text-muted-foreground">Modelo</p><p className="font-medium mt-0.5">{doc.embeddingModel || "—"}</p></div>
                          {doc.retries > 0 && (
                            <div><p className="text-muted-foreground">Tentativas</p><p className="font-medium mt-0.5">{doc.retries}</p></div>
                          )}
                          {doc.tags?.length > 0 && (
                            <div className="col-span-2">
                              <p className="text-muted-foreground">Tags</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {doc.tags.map((t) => (
                                  <span key={t} className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SemanticSearchTab ────────────────────────────────────────────────────────

function SemanticSearchTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [product, setProduct] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [fallback, setFallback] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchMutation = useSearchKnowledgeDedicated();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearched(true);
    try {
      const data = await searchMutation.mutateAsync({
        data: { query, limit: 8, ...(category ? { category } : {}), ...(product ? { product } : {}) },
      });
      setResults((data.results ?? []) as unknown as SearchResult[]);
      setFallback(false);
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
      setResults([]);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ex: Como funciona o RAT no RTI?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending || !query.trim()}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Buscar
          </button>
        </div>
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-muted-foreground flex-1"
          >
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-muted-foreground flex-1"
          >
            <option value="">Todos os produtos</option>
            {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </form>

      {fallback && (
        <div className="flex items-start gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400">
            Embeddings indisponíveis — busca textual usada como fallback.
            Configure um provedor de embeddings em Configurações → Central de Modelos.
          </p>
        </div>
      )}

      {searched && !searchMutation.isPending && !results.length && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhum resultado para &quot;{query}&quot;.
          {!fallback && " Verifique se há documentos indexados."}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{results.length} resultado(s) para &quot;{query}&quot;</p>
          {results.map((r, i) => (
            <motion.div
              key={r.chunkId ?? `${r.documentId}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border/50 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{r.filename}</span>
                  {r.category && <Badge variant="outline" className="text-xs shrink-0">{r.category}</Badge>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-mono font-bold text-primary">{Math.round(r.score * 100)}%</span>
                  <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(r.score * 100)}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{r.content}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {(() => { try { return format(new Date(r.createdAt), "dd/MM/yy"); } catch { return "—"; } })()}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(r.content)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!searched && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Teste a busca semântica nos documentos indexados.</p>
          <p className="text-xs mt-1 opacity-70">Use perguntas naturais como os agentes fariam.</p>
        </div>
      )}
    </div>
  );
}

// ─── StatusTab ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = ["Recebido", "Extraído", "Chunks", "Embeddings", "Indexado"];

function docStageIndex(doc: KnowledgeDoc): number {
  if (doc.status === "error") return -1;
  if (doc.status === "pending") return 0;
  if (doc.status === "processing") return 2;
  if (doc.chunkCount > 0) return 4;
  if (doc.status === "processed") return 3;
  return 1;
}

function StatusTab({ docs, health, loadingDocs }: {
  docs: KnowledgeDoc[];
  health: { total: number; indexed: number; pending: number; errors: number; totalChunks: number; lastSync?: string | null } | undefined;
  loadingDocs: boolean;
}) {
  const hasProcessing = docs.some((d) => d.status === "pending" || d.status === "processing");

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: health?.total ?? docs.length, color: "text-foreground" },
          { label: "Indexados", value: health?.indexed ?? 0, color: "text-emerald-400" },
          { label: "Pendentes", value: health?.pending ?? 0, color: "text-amber-400" },
          { label: "Com erro", value: health?.errors ?? 0, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Chunk count + last sync */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums">{health?.totalChunks ?? 0}</div>
            <div className="text-xs text-muted-foreground">Chunks indexados</div>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-background border border-border/50 rounded-lg shrink-0">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">
              {health?.lastSync
                ? formatDistanceToNow(new Date(health.lastSync), { locale: ptBR, addSuffix: true })
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Última sincronização</div>
          </div>
        </div>
      </div>

      {/* Embedding model */}
      <div className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3">
        <div className="p-2 bg-background border border-border/50 rounded-lg shrink-0">
          <Cpu className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Modelo de embeddings</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {docs.find((d) => d.embeddingModel)?.embeddingModel ?? "Google text-embedding / gemini-embedding-001"}
            {" · "}
            Chunk 800 palavras · Overlap 200 · Similaridade ≥ 0.25
          </div>
        </div>
      </div>

      {/* Processing notice */}
      {hasProcessing && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">Documentos sendo processados</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A indexação ocorre a cada 5 minutos. Pequenos arquivos processam imediatamente.
            </p>
          </div>
        </div>
      )}

      {/* Pipeline by document */}
      {docs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pipeline por documento</h3>
          {loadingDocs ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-16 bg-card/50 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            docs.map((doc) => {
              const stage = docStageIndex(doc);
              return (
                <div key={doc.id} className="bg-card border border-border/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon type={doc.fileType} />
                      <span className="text-sm font-medium truncate max-w-[200px]">{doc.filename}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 shrink-0 ${statusColor(doc.status)}`}>
                      <StatusIcon status={doc.status} />
                      {statusLabel(doc.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {PIPELINE_STAGES.map((s, idx) => {
                      const done = stage >= idx;
                      return (
                        <div key={s} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full h-1.5 rounded-full transition-colors ${
                            stage === -1 && idx > 0 ? "bg-red-400/30" : done ? "bg-primary" : "bg-border/50"
                          }`} />
                          <span className={`text-[10px] text-center hidden lg:block leading-tight ${done ? "text-primary/70" : "text-muted-foreground/40"}`}>
                            {s}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── ChunksModal ──────────────────────────────────────────────────────────────

function ChunksModal({ doc, onClose }: { doc: KnowledgeDoc; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: chunksData, isLoading: loading } = useGetDocumentChunks(
    doc.id,
    { page, pageSize },
  );

  const chunks: Chunk[] = (chunksData?.chunks ?? []) as unknown as Chunk[];
  const total = chunksData?.total ?? 0;
  const pages = Math.ceil(total / pageSize);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Chunks — {doc.filename}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-3">{total} chunk(s) indexados</p>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-card/50 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {chunks.map((c) => (
              <div key={c.id} className="bg-card border border-border/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">#{c.index}</span>
                  <div className="flex items-center gap-3">
                    <span>~{c.tokens} tokens</span>
                    {c.hasEmbedding && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> embedding
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5">{c.content}</p>
              </div>
            ))}
            {pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40 hover:border-primary transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs text-muted-foreground">{page} / {pages}</span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs px-3 py-1.5 bg-card border border-border rounded-lg disabled:opacity-40 hover:border-primary transition-colors"
                >
                  Próximo
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  usePageTitle("Base de Conhecimento");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>("documents");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [chunksDoc, setChunksDoc] = useState<KnowledgeDoc | null>(null);
  const [reindexing, setReindexing] = useState<Set<string>>(new Set());
  const { data: docsData, isLoading: isLoadingDocs } = useListKnowledgeDocuments(undefined, {
    query: {
      refetchInterval: (data: any) => {
        const hasPending = data?.documents?.some(
          (d: any) => d.status === "pending" || d.status === "processing",
        );
        return hasPending ? 5000 : false;
      },
    } as any,
  });

  const docs: KnowledgeDoc[] = (docsData?.documents ?? []) as unknown as KnowledgeDoc[];
  const deleteMutation = useDeleteKnowledgeDocument();
  const reindexMutation = useReindexDocument();

  const docsSummaryKey = docs.map((d) => `${d.id}:${d.status}`).join(",");

  const { data: health } = useGetKnowledgeHealth({
    query: {
      refetchInterval: docs.some((d) => d.status === "pending" || d.status === "processing") ? 5000 : false,
    } as any,
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ documentId: deleteTarget });
      queryClient.invalidateQueries({ queryKey: getListKnowledgeDocumentsQueryKey() });
      toast({ title: "Documento excluído" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleReindex = async (id: string) => {
    setReindexing((prev) => new Set(prev).add(id));
    try {
      await reindexMutation.mutateAsync({ documentId: id });
      toast({ title: "Reindexação iniciada", description: "Será processado em até 5 minutos." });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: getListKnowledgeDocumentsQueryKey() }), 1500);
    } catch (e: any) {
      toast({ title: "Erro ao reindexar", description: e.message, variant: "destructive" });
    }
    setReindexing((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const invalidateDocs = () =>
    queryClient.invalidateQueries({ queryKey: getListKnowledgeDocumentsQueryKey() });

  return (
    <div className="flex-1 overflow-y-auto bg-background h-full">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Base de Conhecimento</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Documentos tributários, propostas e materiais que orientam as respostas dos agentes.
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-border/50">
          <div className="flex gap-1 -mb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            {activeTab === "documents" && (
              <div className="space-y-5">
                <UploadPanel onUploadDone={invalidateDocs} />
                {isLoadingDocs ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-card/50 rounded-xl animate-pulse" />)}
                  </div>
                ) : (
                  <DocumentsTable
                    docs={docs}
                    onDelete={setDeleteTarget}
                    onReindex={handleReindex}
                    onViewChunks={setChunksDoc}
                    reindexing={reindexing}
                  />
                )}
              </div>
            )}

            {activeTab === "search" && <SemanticSearchTab />}

            {activeTab === "status" && (
              <StatusTab docs={docs} health={health} loadingDocs={isLoadingDocs} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento e todos os seus chunks serão removidos permanentemente da base de conhecimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {chunksDoc && <ChunksModal doc={chunksDoc} onClose={() => setChunksDoc(null)} />}
    </div>
  );
}
