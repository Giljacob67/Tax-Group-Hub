import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  UploadCloud,
  Trash2,
  Search,
  Database,
  Loader2,
  File,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  Cpu,
  HardDrive,
  FolderOpen,
  List,
  Network,
  Copy,
  ExternalLink,
  Settings,
  Zap,
} from "lucide-react";
import {
  useListKnowledgeDocuments,
  useDeleteKnowledgeDocument,
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
import { customFetch } from "@workspace/api-client-react";

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

interface HealthData {
  total: number;
  indexed: number;
  pending: number;
  errors: number;
  totalChunks: number;
  lastSync: string | null;
  sources: Array<{ origin: string; count: number }>;
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

interface Source {
  id: string;
  label: string;
  status: "active" | "planned";
  total: number;
  indexed: number;
  errors: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Diagnóstico Tributário",
  "RTI",
  "AFD",
  "REP",
  "Reforma Tributária",
  "Propostas Comerciais",
  "Objeções Comerciais",
  "Cases",
  "Scripts de Prospecção",
  "Marketing",
  "Jurídico",
  "Operação Interna",
];

const PRODUCTS = [
  "RTI",
  "AFD",
  "REP",
  "Reforma Tributária",
  "Comercial",
  "Jurídico",
  "Marketing",
];

const TABS = [
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "sources", label: "Fontes", icon: Network },
  { id: "indexing", label: "Indexação", icon: Layers },
  { id: "search", label: "Buscar na Base", icon: Search },
  { id: "logs", label: "Logs", icon: List },
  { id: "settings", label: "Configurações", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "processed":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "processing":
      return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "pending":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "error":
      return "text-red-400 bg-red-400/10 border-red-400/20";
    default:
      return "text-muted-foreground bg-muted/10 border-border";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "processed":
      return "Indexado";
    case "processing":
      return "Processando";
    case "pending":
      return "Pendente";
    case "error":
      return "Erro";
    default:
      return status;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "processed":
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "processing":
      return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    case "pending":
      return <Clock className="w-3.5 h-3.5" />;
    case "error":
      return <XCircle className="w-3.5 h-3.5" />;
    default:
      return null;
  }
}

function FileIcon({ type }: { type: string }) {
  if (type.includes("pdf"))
    return <FileText className="w-4 h-4 text-red-400" />;
  if (
    type.includes("word") ||
    type.includes("docx") ||
    type.includes("document")
  )
    return <FileText className="w-4 h-4 text-blue-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function OriginIcon({ origin }: { origin: string | null }) {
  switch (origin) {
    case "drive":
      return <HardDrive className="w-3.5 h-3.5 text-blue-400" />;
    case "internal":
      return <Database className="w-3.5 h-3.5 text-purple-400" />;
    case "system":
      return <Cpu className="w-3.5 h-3.5 text-muted-foreground" />;
    default:
      return <UploadCloud className="w-3.5 h-3.5 text-primary" />;
  }
}

function originLabel(origin: string | null) {
  switch (origin) {
    case "drive":
      return "Google Drive";
    case "internal":
      return "Base Interna";
    case "system":
      return "Sistema";
    default:
      return "Upload";
  }
}

function friendlyError(log: string | null): { cause: string; action: string } {
  if (!log) return { cause: "Erro desconhecido.", action: "Tente reindexar." };
  const l = log.toLowerCase();
  if (
    l.includes("embedding") ||
    l.includes("api key") ||
    l.includes("provider")
  )
    return {
      cause: "Provedor de embeddings não configurado.",
      action: "Configure uma chave de API na aba Configurações.",
    };
  if (l.includes("pdf") || l.includes("parse") || l.includes("extract"))
    return {
      cause: "PDF sem texto extraível ou corrompido.",
      action: "Verifique o arquivo. PDFs escaneados precisam de OCR.",
    };
  if (l.includes("mammoth") || l.includes("docx"))
    return {
      cause: "Falha ao ler arquivo Word.",
      action: "Converta para PDF ou TXT e tente novamente.",
    };
  if (l.includes("size") || l.includes("limit"))
    return {
      cause: "Arquivo grande demais.",
      action: "Limite: 50MB. Divida o documento.",
    };
  if (l.includes("not found") || l.includes("enoent"))
    return {
      cause: "Arquivo não encontrado no servidor.",
      action: "Faça novo upload.",
    };
  return {
    cause: log.slice(0, 120),
    action: "Tente reindexar ou faça novo upload.",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthCard({
  label,
  value,
  icon: Icon,
  color = "text-primary",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 flex items-start gap-3">
      <div
        className={`p-2 rounded-lg bg-background border border-border/50 shrink-0 ${color}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold tabular-nums leading-none">
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1 leading-tight">
          {label}
        </div>
      </div>
    </div>
  );
}

function UploadPanel({ onUploadDone }: { onUploadDone: () => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>(
    {},
  );
  const [category, setCategory] = useState("");
  const [product, setProduct] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6MB — aligned with backend limit

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      const errors: string[] = [];
      let success = 0;
      for (const file of files) {
        // Pre-validate size before base64 encoding
        if (file.size > MAX_UPLOAD_BYTES) {
          errors.push(`${file.name}: excede 6MB`);
          continue;
        }

        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: "Convertendo...",
        }));
        try {
          // Encode as base64 JSON — multipart streaming is unreliable on Vercel Lambda
          const arrayBuffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < uint8.length; i++)
            binary += String.fromCharCode(uint8[i]);
          const fileData = btoa(binary);

          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: "Enviando...",
          }));

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

          const r = await customFetch<{ success?: boolean; error?: string }>("/api/knowledge/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              fileData,
              filename: file.name,
              mimetype: file.type || "application/octet-stream",
              agentId: "global",
              origin: "upload",
              ...(category ? { category } : {}),
              ...(product ? { product } : {}),
            }),
          });
          clearTimeout(timeoutId);

          if (!r.success) {
            throw new Error(r.error || "Upload failed");
          }
          setUploadProgress((prev) => ({ ...prev, [file.name]: "Enviado ✓" }));
          success++;
        } catch (e: any) {
          const msg =
            e.name === "AbortError"
              ? "timeout (demorou mais de 60s)"
              : (e.message ?? "Falha no upload");
          errors.push(`${file.name}: ${msg}`);
          setUploadProgress((prev) => ({ ...prev, [file.name]: "Falhou" }));
        }
      }
      setUploading(false);
      if (success) {
        toast({
          title: `${success} arquivo(s) enviado(s)`,
          description: "Processamento em andamento.",
        });
        onUploadDone();
      }
      if (errors.length > 0) {
        toast({
          title:
            errors.length === 1
              ? "Erro no upload"
              : `${errors.length} arquivos não foram enviados`,
          description: errors.join("; ").slice(0, 200),
          variant: "destructive",
        });
      }
      setTimeout(() => setUploadProgress({}), 4000);
    },
    [category, product, onUploadDone, toast],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: {
        "application/pdf": [".pdf"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          [".docx"],
        "application/msword": [".doc"],
        "text/plain": [".txt"],
        "text/markdown": [".md"],
      },
      maxSize: MAX_UPLOAD_BYTES,
    });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border/60 hover:border-primary/40 hover:bg-card/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-12 h-12 mx-auto bg-card border border-border/50 rounded-full flex items-center justify-center mb-3">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <UploadCloud
              className={`w-6 h-6 ${isDragActive ? "text-primary" : "text-muted-foreground"}`}
            />
          )}
        </div>
        <p className="font-semibold text-sm">
          {isDragActive
            ? "Solte os arquivos aqui..."
            : "Arraste arquivos ou clique para selecionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOCX, TXT, MD — até 6MB
        </p>
        {fileRejections.length > 0 && (
          <div className="mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 max-w-md mx-auto">
            {fileRejections.map(({ file, errors }) => (
              <div key={file.name}>
                <strong>{file.name}</strong>:{" "}
                {errors.map((e) => e.message).join(", ")}
              </div>
            ))}
          </div>
        )}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mt-3 space-y-1 max-w-md mx-auto">
            {Object.entries(uploadProgress).map(([name, status]) => (
              <div
                key={name}
                className="flex items-center justify-between text-xs bg-card rounded px-3 py-1.5 border border-border/50"
              >
                <span className="truncate max-w-[200px]" title={name}>
                  {name}
                </span>
                <span
                  className={
                    status === "Falhou"
                      ? "text-destructive font-medium"
                      : "text-primary font-medium"
                  }
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowOptions(!showOptions)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        Metadados opcionais
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${showOptions ? "rotate-180" : ""}`}
        />
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
                <label className="text-xs text-muted-foreground mb-1 block">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">— Selecionar —</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Produto
                </label>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">— Selecionar —</option>
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
        <Database className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="font-medium">Base de conhecimento vazia</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
          Adicione documentos tributários, propostas, materiais comerciais ou
          bases internas para que os agentes respondam com fontes confiáveis.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <table className="w-full text-sm" aria-label="Lista de documentos da base de conhecimento">
        <caption className="sr-only">Lista de documentos da base de conhecimento</caption>
        <thead>
          <tr className="border-b border-border/50 bg-card/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
              Documento
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">
              Origem
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">
              Categoria / Produto
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">
              Chunks
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">
              Data
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <>
              <tr
                key={doc.id}
                className={`border-b border-border/30 hover:bg-card/50 transition-colors cursor-pointer ${expandedId === doc.id ? "bg-card/30" : ""}`}
                onClick={() =>
                  setExpandedId(expandedId === doc.id ? null : doc.id)
                }
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-background border border-border/50 rounded-lg shrink-0">
                      <FileIcon type={doc.fileType} />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="font-medium truncate max-w-[200px]"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(doc.fileSize)}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform ${expandedId === doc.id ? "rotate-90" : ""}`}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <OriginIcon origin={doc.origin} />
                    {originLabel(doc.origin)}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {doc.category && (
                      <Badge variant="outline" className="text-xs">
                        {doc.category}
                      </Badge>
                    )}
                    {doc.product && (
                      <Badge
                        variant="outline"
                        className="text-xs border-primary/30 text-primary"
                      >
                        {doc.product}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${statusColor(doc.status)}`}
                  >
                    <StatusIcon status={doc.status} />
                    {statusLabel(doc.status)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-muted-foreground tabular-nums">
                    {doc.chunkCount > 0 ? doc.chunkCount : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                  {format(new Date(doc.createdAt), "dd/MM/yy")}
                </td>
                <td className="px-4 py-3">
                  <div
                    className="flex items-center gap-1 justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doc.chunkCount > 0 && (
                      <button
                        onClick={() => onViewChunks(doc)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        title="Ver fragmentos"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onReindex(doc.id)}
                      disabled={reindexing.has(doc.id)}
                      className="p-1.5 text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all disabled:opacity-40"
                      title="Reindexar"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${reindexing.has(doc.id) ? "animate-spin" : ""}`}
                      />
                    </button>
                    <button
                      onClick={() => onDelete(doc.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                      title="Excluir"
                      aria-label="Excluir documento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
              <AnimatePresence>
                {expandedId === doc.id && (
                  <tr key={`${doc.id}-exp`}>
                    <td colSpan={7} className="bg-card/20 px-6 py-4">
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="space-y-3"
                      >
                        {doc.status === "error" &&
                          doc.errorLog &&
                          (() => {
                            const { cause, action } = friendlyError(
                              doc.errorLog,
                            );
                            return (
                              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                  <XCircle className="w-4 h-4" /> Falha no
                                  processamento
                                </div>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">
                                    Causa:
                                  </span>{" "}
                                  {cause}
                                </div>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">
                                    Ação:
                                  </span>{" "}
                                  {action}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(
                                      doc.errorLog!,
                                    );
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3" /> Copiar log
                                  técnico
                                </button>
                              </div>
                            );
                          })()}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <div className="text-muted-foreground">Tipo</div>
                            <div className="font-medium mt-0.5">
                              {doc.fileType}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Tamanho</div>
                            <div className="font-medium mt-0.5">
                              {formatBytes(doc.fileSize)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Chunks</div>
                            <div className="font-medium mt-0.5">
                              {doc.chunkCount || "0"}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Modelo</div>
                            <div className="font-medium mt-0.5">
                              {doc.embeddingModel || "—"}
                            </div>
                          </div>
                          {doc.retries > 0 && (
                            <div>
                              <div className="text-muted-foreground">
                                Tentativas
                              </div>
                              <div className="font-medium mt-0.5">
                                {doc.retries}
                              </div>
                            </div>
                          )}
                          {doc.tags?.length > 0 && (
                            <div className="col-span-2">
                              <div className="text-muted-foreground">Tags</div>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {doc.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded"
                                  >
                                    {t}
                                  </span>
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

function SourcesTab({
  sources,
  loading,
}: {
  sources: Source[];
  loading: boolean;
}) {
  const uploadSource = sources.find((s) => s.id === "upload");

  if (loading)
    return <div className="animate-pulse h-40 bg-card/30 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <UploadCloud className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Upload Manual</div>
              <div className="text-xs text-muted-foreground">
                PDF, DOCX, TXT, MD — até 50MB
              </div>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-medium">
            Ativo
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {uploadSource?.total ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-emerald-400">
              {uploadSource?.indexed ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">Indexados</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-red-400">
              {uploadSource?.errors ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background border border-border/50 rounded-lg">
              <HardDrive className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold">Google Drive</div>
              <div className="text-xs text-muted-foreground">
                Docs, Sheets, PDFs — sincronização automática
              </div>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 font-medium">
            Em preparação
          </span>
        </div>
        <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-medium text-amber-400">
                Integração em desenvolvimento
              </div>
              <div className="text-muted-foreground text-xs">
                Integração com Google Drive preparada para OAuth server-side
                seguro. Nenhum token será exposto no frontend. Sincronização via
                API server com mesma pipeline de embeddings.
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" />{" "}
            Arquitetura de sincronização planejada
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" /> OAuth
            2.0 server-side (sem exposição de token)
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" /> Suporte
            a Google Docs, Sheets e PDFs
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400/60" /> Sincronização
            agendada e on-demand (pendente)
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-400/60" /> Push
            notifications de alterações (pendente)
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-2 bg-muted/20 text-muted-foreground/50 rounded-lg text-sm cursor-not-allowed border border-border/30"
          >
            <HardDrive className="w-4 h-4" /> Conectar Google Drive
          </button>
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-2 bg-muted/20 text-muted-foreground/50 rounded-lg text-sm cursor-not-allowed border border-border/30"
          >
            <RefreshCw className="w-4 h-4" /> Sincronizar Agora
          </button>
        </div>
      </div>

      {[
        {
          label: "Base Interna",
          desc: "Conteúdo gerado pelo sistema",
          Icon: Database,
        },
        {
          label: "CRM & Propostas",
          desc: "Documentos vinculados a deals e contatos",
          Icon: FolderOpen,
        },
      ].map(({ label, desc, Icon }) => (
        <div
          key={label}
          className="bg-card/50 border border-border/30 rounded-xl p-5 opacity-60"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-background border border-border/50 rounded-lg">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold text-muted-foreground">
                  {label}
                </div>
                <div className="text-xs text-muted-foreground/60">{desc}</div>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted/10 text-muted-foreground border border-border/30 font-medium">
              Planejado
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function IndexingTab({ docs }: { docs: KnowledgeDoc[] }) {
  const pending = docs.filter(
    (d) => d.status === "pending" || d.status === "processing",
  );
  const indexed = docs.filter((d) => d.status === "processed");
  const errors = docs.filter((d) => d.status === "error");

  const STAGES = [
    "Recebimento",
    "Extração",
    "Chunking",
    "Embeddings",
    "Indexação",
    "Agentes",
  ];

  function docStage(doc: KnowledgeDoc): number {
    if (doc.status === "error") return -1;
    if (doc.status === "pending") return 0;
    if (doc.status === "processing") return 2;
    if (doc.chunkCount > 0) return 5;
    if (doc.status === "processed") return 3;
    return 1;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-400 tabular-nums">
            {pending.length}
          </div>
          <div className="text-sm font-medium mt-0.5">
            Aguardando / Processando
          </div>
        </div>
        <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {indexed.length}
          </div>
          <div className="text-sm font-medium mt-0.5">Indexados</div>
        </div>
        <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400 tabular-nums">
            {errors.length}
          </div>
          <div className="text-sm font-medium mt-0.5">Com Erro</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Pipeline por Documento
        </h3>
        {!docs.length && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Nenhum documento enviado ainda.
          </div>
        )}
        {docs.map((doc) => {
          const stage = docStage(doc);
          return (
            <div
              key={doc.id}
              className="bg-card border border-border/50 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileIcon type={doc.fileType} />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {doc.filename}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${statusColor(doc.status)}`}
                >
                  <StatusIcon status={doc.status} /> {statusLabel(doc.status)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {STAGES.map((s, idx) => {
                  const done = stage >= idx;
                  return (
                    <div
                      key={s}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className={`w-full h-1.5 rounded-full transition-colors ${
                          stage === -1 && idx > 0
                            ? "bg-red-400/30"
                            : done
                              ? "bg-primary"
                              : "bg-border/50"
                        }`}
                      />
                      <span
                        className={`text-[10px] text-center hidden lg:block leading-tight ${done ? "text-primary/70" : "text-muted-foreground/40"}`}
                      >
                        {s}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SemanticSearchTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [product, setProduct] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [fallback, setFallback] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const body: Record<string, unknown> = { query, limit: 8 };
      if (category) body.category = category;
      if (product) body.product = product;

      const data = await customFetch<{ results?: any[]; fallback?: boolean; error?: string }>("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResults(data.results ?? []);
      setFallback(!!data.fallback);
    } catch (e: any) {
      toast({
        title: "Erro na busca",
        description: e.message,
        variant: "destructive",
      });
      setResults([]);
    }
    setLoading(false);
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
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
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
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-muted-foreground flex-1"
          >
            <option value="">Todos os produtos</option>
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </form>

      {fallback && (
        <div className="flex items-start gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-400 text-xs">
            Embeddings indisponíveis — busca textual usada como fallback.
            Configure um provedor de embeddings para busca semântica real.
          </span>
        </div>
      )}

      {searched && !loading && !results.length && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhum resultado para "{query}".
          {!fallback && " Verifique se há documentos indexados."}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {results.length} resultado(s) para "{query}"
          </div>
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
                  <span className="text-sm font-medium truncate">
                    {r.filename}
                  </span>
                  {r.category && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {r.category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-mono font-bold text-primary">
                    {Math.round(r.score * 100)}%
                  </span>
                  <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.round(r.score * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {r.content}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <OriginIcon origin={r.origin} />
                  {originLabel(r.origin)}
                  <span>·</span>
                  <span>{format(new Date(r.createdAt), "dd/MM/yy")}</span>
                </div>
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
          <p className="text-sm">
            Teste a busca semântica nos documentos indexados.
          </p>
          <p className="text-xs mt-1">
            Use perguntas naturais como os agentes fariam.
          </p>
        </div>
      )}
    </div>
  );
}

function LogsTab({ docs }: { docs: KnowledgeDoc[] }) {
  const events = docs
    .flatMap((doc) => {
      const evts: Array<{
        doc: KnowledgeDoc;
        event: string;
        ts: string;
        status: string;
      }> = [
        { doc, event: "document.uploaded", ts: doc.createdAt, status: "ok" },
      ];
      if (doc.status === "processed") {
        if (doc.chunkCount > 0)
          evts.push({
            doc,
            event: "document.embedded",
            ts: doc.createdAt,
            status: "ok",
          });
        evts.push({
          doc,
          event: "document.indexed",
          ts: doc.createdAt,
          status: "ok",
        });
      }
      if (doc.status === "error")
        evts.push({
          doc,
          event: "document.failed",
          ts: doc.createdAt,
          status: "error",
        });
      if (doc.status === "processing")
        evts.push({
          doc,
          event: "document.processing",
          ts: doc.createdAt,
          status: "info",
        });
      return evts;
    })
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 100);

  if (!events.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <List className="w-8 h-8 mx-auto mb-3 opacity-30" />
        Nenhum evento registrado ainda.
      </div>
    );
  }

  const eventColor = (status: string) => {
    switch (status) {
      case "ok":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      case "info":
        return "text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  const eventLabel: Record<string, string> = {
    "document.uploaded": "Documento recebido",
    "document.indexed": "Indexação concluída",
    "document.embedded": "Embeddings gerados",
    "document.failed": "Falha no processamento",
    "document.processing": "Processando",
  };

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-card/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
              Data/Hora
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
              Evento
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">
              Documento
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">
              Detalhe
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr
              key={i}
              className="border-b border-border/30 hover:bg-card/30 transition-colors"
            >
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(e.ts), "dd/MM HH:mm")}
              </td>
              <td className="px-4 py-2.5">
                <span className={`text-xs font-mono ${eventColor(e.status)}`}>
                  {e.event}
                </span>
                <div className="text-xs text-muted-foreground">
                  {eventLabel[e.event] ?? e.event}
                </div>
              </td>
              <td className="px-4 py-2.5 hidden md:table-cell">
                <span className="text-xs truncate max-w-[180px] block">
                  {e.doc.filename}
                </span>
              </td>
              <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                {e.doc.status === "processed" &&
                  e.event === "document.indexed" &&
                  `${e.doc.chunkCount} fragmentos`}
                {e.doc.status === "error" && e.event === "document.failed" && (
                  <span className="text-red-400/80 truncate block max-w-[200px]">
                    {e.doc.errorLog?.slice(0, 80)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-5">
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <h3 className="font-semibold mb-1">Provedor de Embeddings</h3>
        <p className="text-sm text-muted-foreground mb-4">
          A Base de Conhecimento usa o mesmo provedor configurado na Central de
          Modelos IA.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 p-3 bg-background rounded-lg border border-border/50">
            <Cpu className="w-4 h-4 text-primary shrink-0" />
            <div>
              <div className="font-medium">Google text-embedding-005</div>
              <div className="text-xs text-muted-foreground">
                Dimensões: 768 · Recomendado para produção
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-background rounded-lg border border-border/50">
            <Database className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium text-muted-foreground">
                Ollama (nomic-embed-text)
              </div>
              <div className="text-xs text-muted-foreground">
                Fallback local · Configure URL do servidor Ollama
              </div>
            </div>
          </div>
        </div>
        <a
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
        >
          <ExternalLink className="w-3 h-3" /> Gerenciar chaves de API
        </a>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-5">
        <h3 className="font-semibold mb-3">Parâmetros de Indexação</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Tamanho do fragmento", "800 palavras"],
            ["Sobreposição (overlap)", "200 palavras"],
            ["Similaridade mínima", "0.25 (cosine)"],
            ["Resultados por busca", "8 fragmentos"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="p-3 bg-background rounded-lg border border-border/50"
            >
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="font-semibold tabular-nums mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-5">
        <h3 className="font-semibold mb-3">Segurança</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          {[
            "Uploads validados por tipo e extensão",
            "Limite de 50MB por arquivo",
            "Chaves de API não expostas no frontend",
            "Documentos escopados por usuário",
            "Logs sem exposição de conteúdo sensível",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />{" "}
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChunksModal({
  doc,
  onClose,
}: {
  doc: KnowledgeDoc;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    customFetch<{ chunks?: any[]; total?: number }>(`/api/knowledge/${doc.id}/chunks?page=${page}&pageSize=${pageSize}`)
      .then((d) => {
        setChunks(d.chunks ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {
        toast({ title: "Erro ao carregar chunks", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [doc.id, page]);

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
        <div className="text-xs text-muted-foreground mb-3">
          {total} chunk(s) indexados
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-card/50 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {chunks.map((c) => (
              <div
                key={c.id}
                className="bg-card border border-border/50 rounded-xl p-4 space-y-2"
              >
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
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5">
                  {c.content}
                </p>
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
                <span className="text-xs text-muted-foreground">
                  {page} / {pages}
                </span>
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
  const [health, setHealth] = useState<HealthData | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  const { data: docsData, isLoading: isLoadingDocs } =
    useListKnowledgeDocuments(undefined, {
      query: {
        refetchInterval: (data: any) => {
          const hasPending = data?.documents?.some(
            (d: any) => d.status === "pending" || d.status === "processing",
          );
          return hasPending ? 8000 : false;
        },
      } as any,
    });

  const docs: KnowledgeDoc[] = (docsData?.documents ??
    []) as unknown as KnowledgeDoc[];
  const deleteMutation = useDeleteKnowledgeDocument();

  // Stable key: only refetch health when count or status distribution changes
  const docsSummaryKey = docs.map((d) => `${d.id}:${d.status}`).join(",");

  useEffect(() => {
    customFetch<any>("/api/knowledge/health")
      .then((d) => setHealth(d))
      .catch(() => {
        toast({ title: "Erro ao carregar status da KB", variant: "destructive" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsSummaryKey]);

  // Stable key for sources: only re-fetch when count changes
  const docsCountKey = docs.length;

  useEffect(() => {
    if (activeTab !== "sources") return;
    setSourcesLoading(true);
    customFetch<{ sources?: any[] }>("/api/knowledge/sources")
      .then((d) => setSources(d.sources ?? []))
      .catch(() => {
        toast({ title: "Erro ao carregar fontes", variant: "destructive" });
      })
      .finally(() => setSourcesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, docsCountKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ documentId: deleteTarget });
      queryClient.invalidateQueries({
        queryKey: getListKnowledgeDocumentsQueryKey(),
      });
      toast({ title: "Documento excluído" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleReindex = async (id: string) => {
    setReindexing((prev) => new Set(prev).add(id));
    try {
      const d = await customFetch<{ message?: string; error?: string }>(`/api/knowledge/${id}/reindex`, { method: "POST" });
      toast({ title: "Reindexação iniciada", description: d.message });
      setTimeout(
        () =>
          queryClient.invalidateQueries({
            queryKey: getListKnowledgeDocumentsQueryKey(),
          }),
        1500,
      );
    } catch (e: any) {
      toast({
        title: "Erro ao reindexar",
        description: e.message,
        variant: "destructive",
      });
    }
    setReindexing((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  };

  const lastSyncDisplay = health?.lastSync
    ? formatDistanceToNow(new Date(health.lastSync), {
        locale: ptBR,
        addSuffix: true,
      })
    : "—";

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Base de Conhecimento
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Centralize documentos, propostas, materiais tributários e fontes
            internas para orientar os agentes da Tax Group.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <HealthCard
            label="Total"
            value={health?.total ?? (isLoadingDocs ? "…" : docs.length)}
            icon={FileText}
          />
          <HealthCard
            label="Indexados"
            value={health?.indexed ?? 0}
            icon={CheckCircle2}
            color="text-emerald-400"
          />
          <HealthCard
            label="Pendentes"
            value={health?.pending ?? 0}
            icon={Clock}
            color="text-amber-400"
          />
          <HealthCard
            label="Erros"
            value={health?.errors ?? 0}
            icon={XCircle}
            color="text-red-400"
          />
          <HealthCard
            label="Chunks"
            value={health?.totalChunks ?? 0}
            icon={Layers}
          />
          <HealthCard
            label="Última Sync"
            value={lastSyncDisplay}
            icon={RefreshCw}
            color="text-muted-foreground"
          />
        </div>

        <div className="border-b border-border/50">
          <div className="flex gap-1 -mb-px overflow-x-auto">
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

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "documents" && (
              <div className="space-y-5">
                <UploadPanel
                  onUploadDone={() =>
                    queryClient.invalidateQueries({
                      queryKey: getListKnowledgeDocumentsQueryKey(),
                    })
                  }
                />
                {isLoadingDocs ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-14 bg-card/50 rounded-xl animate-pulse"
                      />
                    ))}
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
            {activeTab === "sources" && (
              <SourcesTab sources={sources} loading={sourcesLoading} />
            )}
            {activeTab === "indexing" && <IndexingTab docs={docs} />}
            {activeTab === "search" && <SemanticSearchTab />}
            {activeTab === "logs" && <LogsTab docs={docs} />}
            {activeTab === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento e todos os seus fragmentos serão removidos da base de
              conhecimento. Esta ação não pode ser desfeita.
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

      {chunksDoc && (
        <ChunksModal doc={chunksDoc} onClose={() => setChunksDoc(null)} />
      )}
    </div>
  );
}
