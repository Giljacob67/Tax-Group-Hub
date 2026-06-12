import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { knowledgeDocumentsTable, knowledgeChunksTable } from "@workspace/db";
import { eq, and, or, sql, count, desc, lt, inArray, isNotNull } from "drizzle-orm";
import { generateEmbeddings } from "../lib/llm-client.js";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import { validateIdParam } from "../lib/validation.js";
import { apiError } from "../lib/api-response.js";
import { safeCompare } from "../middlewares/auth.js";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { get } from "@vercel/blob";
import logger from "../lib/logger.js";
import { getAgentById } from "../lib/agents-data.js";

const router: IRouter = Router();

// Map category/product → agentId for auto-assignment
const CATEGORY_PRODUCT_AGENT_MAP: Record<string, Record<string, string>> = {
  operacional: {
    afp: "analise-tributaria-tax-group",
    rep: "analise-tributaria-tax-group",
    rti: "analise-tributaria-tax-group",
    fds: "analise-tributaria-tax-group",
    pps: "analise-tributaria-tax-group",
    psf: "analise-tributaria-tax-group",
    default: "analise-tributaria-tax-group",
  },
  pipeline: {
    afp: "gestao-pipeline-tax-group",
    rep: "gestao-pipeline-tax-group",
    rti: "gestao-pipeline-tax-group",
    fds: "gestao-pipeline-tax-group",
    pps: "gestao-pipeline-tax-group",
    psf: "gestao-pipeline-tax-group",
    default: "gestao-pipeline-tax-group",
  },
  matriz: {
    afp: "estrategista-deals-tax-group",
    rep: "estrategista-deals-tax-group",
    rti: "estrategista-deals-tax-group",
    fds: "estrategista-deals-tax-group",
    pps: "estrategista-deals-tax-group",
    psf: "estrategista-deals-tax-group",
    default: "estrategista-deals-tax-group",
  },
  followup: {
    afp: "followup-tax-group",
    rep: "followup-tax-group",
    rti: "followup-tax-group",
    fds: "followup-tax-group",
    pps: "followup-tax-group",
    psf: "followup-tax-group",
    default: "followup-tax-group",
  },
  segmento: {
    afp: "diagnostico-cnpj-tax-group",
    rep: "diagnostico-cnpj-tax-group",
    rti: "diagnostico-cnpj-tax-group",
    fds: "diagnostico-cnpj-tax-group",
    pps: "diagnostico-cnpj-tax-group",
    psf: "diagnostico-cnpj-tax-group",
    default: "diagnostico-cnpj-tax-group",
  },
};

function resolveAgentId(
  category: string | null | undefined,
  product: string | null | undefined,
): string {
  const cat = (category || "").toLowerCase().trim();
  const prod = (product || "").toLowerCase().trim();

  if (cat && CATEGORY_PRODUCT_AGENT_MAP[cat]) {
    const map = CATEGORY_PRODUCT_AGENT_MAP[cat];
    if (prod && map[prod]) return map[prod];
    return map.default || "global";
  }

  // Try matching product only
  if (prod) {
    for (const [catKey, prodMap] of Object.entries(CATEGORY_PRODUCT_AGENT_MAP)) {
      if (prodMap[prod]) return prodMap[prod];
    }
  }

  return "global";
}

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream",
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".md"];

const BLOB_RW_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  context: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout: ${context} excedeu ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

export async function extractTextContent(
  buffer: Buffer,
  fileType: string,
  filename: string,
): Promise<string> {
  const lower = (fileType + filename).toLowerCase();
  if (lower.includes("pdf")) {
    return withTimeout(
      new Promise<string>((resolve, reject) => {
        const parser = new (PDFParser as any)(null, 1);
        parser.on("pdfParser_dataReady", () => {
          try {
            const raw: string = parser.getRawTextContent();
            resolve(raw.replace(/\r\n/g, "\n").trim());
          } catch (e) {
            reject(new Error(`PDF parse error: ${e}`));
          }
        });
        parser.on("pdfParser_dataError", (err: any) =>
          reject(new Error(`PDF data error: ${err?.message || err}`)),
        );
        try {
          parser.parseBuffer(buffer);
        } catch (e) {
          reject(new Error(`PDF parseBuffer error: ${e}`));
        }
      }),
      15000,
      "Extração de texto do PDF",
    );
  }
  if (
    lower.includes("docx") ||
    lower.includes("word") ||
    lower.includes("officedocument")
  ) {
    const result = await withTimeout(
      mammoth.extractRawText({ buffer }),
      15000,
      "Extração de texto do DOCX",
    );
    return result.value || "";
  }
  if (
    lower.includes("markdown") ||
    lower.includes("text") ||
    filename.endsWith(".md") ||
    filename.endsWith(".txt")
  ) {
    return buffer.toString("utf-8");
  }
  return "";
}

function chunkText(text: string, chunkSize = 800, overlap = 200): string[] {
  if (!text.trim()) return [];
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    i += chunkSize - overlap;
  }
  return chunks;
}

function mapDoc(d: any) {
  return {
    id: String(d.id),
    filename: d.filename,
    fileType: d.fileType,
    fileSize: d.fileSize,
    agentId: d.agentId,
    status: d.status ?? "pending",
    processed: d.processed ?? false,
    hasContent: d.processed && !!d.extractedContent,
    category: d.category ?? null,
    product: d.product ?? null,
    origin: d.origin ?? "upload",
    tags: d.tags ?? [],
    chunkCount: d.chunkCount ?? 0,
    retries: d.retries ?? 0,
    errorLog: d.errorLog ?? null,
    embeddingModel: d.embeddingModel ?? null,
    createdAt:
      d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
  };
}

export async function processDocumentAsync(
  docId: number,
  buffer: Buffer,
  fileType: string,
  filename: string,
): Promise<void> {
  try {
    await db
      .update(knowledgeDocumentsTable)
      .set({
        status: "processing",
        retries: sql`${knowledgeDocumentsTable.retries} + 1`,
      })
      .where(eq(knowledgeDocumentsTable.id, docId));

    const extractedContent = await extractTextContent(
      buffer,
      fileType,
      filename,
    );

    await db
      .update(knowledgeDocumentsTable)
      .set({ extractedContent })
      .where(eq(knowledgeDocumentsTable.id, docId));

    const chunks = chunkText(extractedContent);
    let embeddingModel: string | null = null;
    let embeddingDim: number | null = null;

    if (chunks.length > 0) {
      const { embeddings, model, dim } = await generateEmbeddings(chunks);
      await db.insert(knowledgeChunksTable).values(
        chunks.map((chunk, i) => ({
          documentId: docId,
          content: chunk,
          embedding: embeddings[i],
          embeddingModel: model,
          embeddingDim: dim,
        })),
      );
      embeddingModel = model;
      embeddingDim = dim;
    }

    await db
      .update(knowledgeDocumentsTable)
      .set({
        status: "processed",
        processed: true,
        errorLog: null,
        chunkCount: chunks.length,
        embeddingModel,
      })
      .where(eq(knowledgeDocumentsTable.id, docId));

    logger.info(
      `[Knowledge] Doc ${docId} (${filename}) OK — ${chunks.length} chunks`,
    );
  } catch (err) {
    const msg = (err as Error).message || String(err);
    logger.error(`[Knowledge] Doc ${docId} failed: ${msg}`);
    await db
      .update(knowledgeDocumentsTable)
      .set({ status: "error", errorLog: msg })
      .where(eq(knowledgeDocumentsTable.id, docId))
      .catch(() => {});
  }
}

// Reconstrói chunks + embeddings a partir do extractedContent já salvo no
// banco — fallback para docs sem arquivo-fonte (sem blobUrl nem fileData),
// cujo texto foi extraído antes da falha de embedding. Retorna true em caso
// de sucesso; lança erro para o chamador contabilizar a falha.
export async function processDocumentFromContent(
  docId: number,
  content: string,
): Promise<void> {
  await db
    .update(knowledgeDocumentsTable)
    .set({
      status: "processing",
      retries: sql`${knowledgeDocumentsTable.retries} + 1`,
    })
    .where(eq(knowledgeDocumentsTable.id, docId));

  const chunks = chunkText(content);
  let embeddingModel: string | null = null;
  let embeddingDim: number | null = null;

  if (chunks.length > 0) {
    const { embeddings, model, dim } = await generateEmbeddings(chunks);
    await db.insert(knowledgeChunksTable).values(
      chunks.map((chunk, i) => ({
        documentId: docId,
        content: chunk,
        embedding: embeddings[i],
        embeddingModel: model,
        embeddingDim: dim,
      })),
    );
    embeddingModel = model;
    embeddingDim = dim;
  }

  await db
    .update(knowledgeDocumentsTable)
    .set({
      status: "processed",
      processed: true,
      errorLog: null,
      chunkCount: chunks.length,
      embeddingModel,
    })
    .where(eq(knowledgeDocumentsTable.id, docId));

  logger.info(
    `[Knowledge] Doc ${docId} reprocessado do extractedContent — ${chunks.length} chunks`,
  );
}

// ── GET /knowledge/health ────────────────────────────────────────────────────

router.get("/knowledge/health", async (_req, res) => {
  try {
    // KB organizacional: documentos são compartilhados entre todos os usuários
    // autenticados. O userId do upload é mantido apenas como metadado de
    // auditoria — RAG, listagens e estatísticas enxergam a base inteira.
    const [stats] = await db
      .select({
        total: count(),
        indexed: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'processed')`,
        pending: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} in ('pending', 'processing'))`,
        errors: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'error')`,
        totalChunks: sql<number>`coalesce(sum(${knowledgeDocumentsTable.chunkCount}), 0)`,
      })
      .from(knowledgeDocumentsTable);

    const [lastDoc] = await db
      .select({ createdAt: knowledgeDocumentsTable.createdAt })
      .from(knowledgeDocumentsTable)
      .orderBy(desc(knowledgeDocumentsTable.createdAt))
      .limit(1);

    const origins = await db
      .select({
        origin: knowledgeDocumentsTable.origin,
        cnt: count(),
      })
      .from(knowledgeDocumentsTable)
      .groupBy(knowledgeDocumentsTable.origin);

    res.json({
      total: Number(stats?.total ?? 0),
      indexed: Number(stats?.indexed ?? 0),
      pending: Number(stats?.pending ?? 0),
      errors: Number(stats?.errors ?? 0),
      totalChunks: Number(stats?.totalChunks ?? 0),
      lastSync:
        lastDoc?.createdAt instanceof Date
          ? lastDoc.createdAt.toISOString()
          : (lastDoc?.createdAt ?? null),
      sources: origins.map((o) => ({
        origin: o.origin ?? "upload",
        count: Number(o.cnt),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Knowledge health error");
    apiError(res, 500, "Failed to get knowledge health");
  }
});

// ── GET /knowledge ───────────────────────────────────────────────────────────

router.get("/knowledge", async (req, res) => {
  try {
    const { agentId } = req.query;

    // KB organizacional: sem filtro por userId (ver comentário em /knowledge/health).
    let documents;
    if (agentId && typeof agentId === "string") {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(eq(knowledgeDocumentsTable.agentId, agentId))
        .orderBy(desc(knowledgeDocumentsTable.createdAt));
    } else {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .orderBy(desc(knowledgeDocumentsTable.createdAt));
    }

    res.json({ documents: documents.map(mapDoc) });
  } catch (err) {
    logger.error({ err }, "Knowledge list error");
    apiError(res, 500, "Failed to list documents");
  }
});

// ─── GET /knowledge/:id ────────────────────────────────────────────────────────
// Get individual document details with chunks
router.get("/knowledge/:id", async (req, res, next) => {
  // Guard: esta rota é registrada antes de GET /knowledge/sources e
  // GET /knowledge/process-queue — sem o fall-through, "sources" e
  // "process-queue" casavam como :id, Number(...) virava NaN e o handler
  // devolvia 500 (a aba Fontes quebrava e o cron da Vercel nunca rodava).
  if (!/^\d+$/.test(req.params.id)) {
    next();
    return;
  }
  try {
    const [doc] = await db
      .select()
      .from(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, Number(req.params.id)))
      .limit(1);

    if (!doc) {
      apiError(res, 404, "Document not found");
      return;
    }

    // Get chunks for this document
    const chunks = await db
      .select({
        id: knowledgeChunksTable.id,
        content: knowledgeChunksTable.content,
        embedding: knowledgeChunksTable.embedding,
      })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.documentId, doc.id))
      .orderBy(knowledgeChunksTable.id);

    res.json({
      success: true,
      document: {
        ...mapDoc(doc),
        chunks: chunks.map((c) => ({
          id: c.id,
          content: c.content,
          hasEmbedding: !!c.embedding,
        })),
      },
    });
  } catch (err) {
    logger.error({ err }, "Knowledge get error");
    apiError(res, 500, "Failed to get document");
  }
});

// ─── POST /knowledge/upload-token ──────────────────────────────────────────────
// Gera um client token para upload direto ao Vercel Blob.
// O arquivo vai do browser → Blob, sem passar pelo serverless function.

router.post("/knowledge/upload-token", async (req, res) => {
  try {
    if (!BLOB_RW_TOKEN) {
      apiError(res, 500, "BLOB_READ_WRITE_TOKEN não configurado no servidor.");
      return;
    }
    const { filename } = req.body ?? {};
    const safeName =
      typeof filename === "string" && filename.trim()
        ? filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_")
        : `file-${Date.now()}`;
    const pathname = `knowledge/${Date.now()}-${safeName}`;
    const token = await generateClientTokenFromReadWriteToken({
      token: BLOB_RW_TOKEN,
      pathname,
    });
    res.json({ token, pathname });
  } catch (err) {
    logger.error({ err }, "[UploadToken] error");
    apiError(res, 500, "Falha ao gerar token de upload");
  }
});

// ── POST /knowledge/upload ───────────────────────────────────────────────────
// Recebe a URL do Vercel Blob após o upload do cliente.
// Baixa o arquivo, processa (síncrono se < 2MB) ou enfileira.

async function downloadBlob(url: string): Promise<Buffer> {
  // Método 1: SDK get() com token (recomendado para blobs privados)
  // useCache: false evita resposta 304 (stream null) — sempre busca do origin
  if (BLOB_RW_TOKEN) {
    let urlOrPathname: string = url;
    try {
      const urlObj = new URL(url);
      urlOrPathname = urlObj.pathname.replace(/^\//, "");
    } catch {
      urlOrPathname = url;
    }
    try {
      const blobResult = await get(urlOrPathname, {
        access: "private",
        token: BLOB_RW_TOKEN,
        useCache: false,
      });
      if (blobResult?.statusCode === 200) {
        const chunks: Buffer[] = [];
        const reader = blobResult.stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(Buffer.from(value));
        }
        return Buffer.concat(chunks);
      }
    } catch (sdkErr: any) {
      logger.warn(`[downloadBlob] SDK get() falhou: ${sdkErr.message}`);
    }
  }

  // Método 2: Fetch com Authorization header (fallback autenticado para blob privado)
  const headers: Record<string, string> = BLOB_RW_TOKEN
    ? { Authorization: `Bearer ${BLOB_RW_TOKEN}` }
    : {};
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Falha ao baixar do Blob: ${response.status} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

router.post("/knowledge/upload", async (req, res) => {
  try {
    const {
      blobUrl,
      fileData,
      filename,
      mimetype,
      agentId,
      category,
      product,
      origin,
      tags,
    } = req.body ?? {};

    if (!filename || typeof filename !== "string") {
      apiError(res, 400, "Campo filename obrigatório.");
      return;
    }

    if (!blobUrl && !fileData) {
      apiError(res, 400, "Campo blobUrl ou fileData obrigatório.");
      return;
    }

    const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
    const mimeType: string = mimetype || "application/octet-stream";
    const mimeOk = ALLOWED_MIME_TYPES.includes(mimeType);
    const extOk = ALLOWED_EXTENSIONS.includes(ext);
    if (!mimeOk && !extOk) {
      apiError(
        res,
        400,
        `Tipo não permitido. Aceitos: ${ALLOWED_EXTENSIONS.join(", ")}`,
      );
      return;
    }

    const userId = req.userId;
    const parsedTags = tags
      ? typeof tags === "string"
        ? tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : tags
      : [];

    let buffer: Buffer;
    let effectiveBlobUrl: string | null = blobUrl || null;

    if (fileData && typeof fileData === "string") {
      logger.info({ filename }, "[Upload] decoding base64 fileData");
      try {
        buffer = Buffer.from(fileData, "base64");
      } catch (e: any) {
        logger.error({ err: e }, "[Upload] base64 decode error");
        apiError(res, 400, "Falha ao decodificar fileData base64.");
        return;
      }
    } else if (blobUrl) {
      logger.info({ blobUrl }, "[Upload] downloading from Blob");
      try {
        buffer = await withTimeout(
          downloadBlob(blobUrl),
          15000,
          "Download do Blob",
        );
      } catch (e: any) {
        logger.error({ err: e }, "[Upload] download error");
        apiError(res, 500, "Falha ao baixar arquivo do storage.");
        return;
      }
    } else {
      apiError(res, 400, "Campo blobUrl ou fileData obrigatório.");
      return;
    }

    const fileSize = buffer.length;
    logger.info({ filename, fileSize }, "[Upload] received");

    const SYNC_THRESHOLD = 2 * 1024 * 1024; // 2 MB
    const isSmall = fileSize < SYNC_THRESHOLD;

    logger.info("[Upload] inserting DB record...");
    const [doc] = await db
      .insert(knowledgeDocumentsTable)
      .values({
        filename,
        fileType: mimeType,
        fileSize,
        extractedContent: null,
        storageKey: `blob-${Date.now()}-${filename}`,
        agentId: agentId || resolveAgentId(category, product),
        userId: userId || null,
        status: isSmall ? "processing" : "pending",
        processed: false,
        category: category || null,
        product: product || null,
        origin: origin || "upload",
        tags: parsedTags.length > 0 ? parsedTags : null,
        blobUrl: effectiveBlobUrl,
        // Persistir o base64 quando não há Blob URL — sem isso, docs cujo
        // processamento inline falha ficam órfãos irrecuperáveis (causa dos
        // 47 órfãos da era text-embedding-005). Limite de 4 MB para não
        // inflar a tabela; acima disso o cliente deve usar Vercel Blob.
        fileData:
          !effectiveBlobUrl && fileData && fileSize < 4 * 1024 * 1024
            ? fileData
            : null,
      })
      .returning();

    if (isSmall) {
      try {
        await withTimeout(
          processDocumentAsync(doc.id, buffer, mimeType, filename),
          25000,
          `Processamento rápido do documento ${doc.id}`,
        );
        const [updatedDoc] = await db
          .select()
          .from(knowledgeDocumentsTable)
          .where(eq(knowledgeDocumentsTable.id, doc.id));
        logger.info(`[Upload] doc ${doc.id} processado sincronamente`);
        res.status(200).json({
          success: true,
          message: "Documento processado com sucesso.",
          document: mapDoc(updatedDoc ?? doc),
        });
        return;
      } catch (procErr: any) {
        const msg = procErr?.message || String(procErr);
        logger.error(`[Upload] doc ${doc.id} falha no processamento rápido: ${msg}`);
        await db
          .update(knowledgeDocumentsTable)
          .set({ status: "pending", errorLog: msg })
          .where(eq(knowledgeDocumentsTable.id, doc.id))
          .catch(() => {});
      }
    }

    logger.info(`[Upload] 200 → doc ${doc.id} enfileirado`);
    res.status(200).json({
      success: true,
      message: "Documento recebido e enfileirado para processamento.",
      document: mapDoc(doc),
    });
  } catch (err) {
    logger.error({ err }, "[Upload] error");
    apiError(res, 500, "Falha no upload do documento");
  }
});

// ── GET /knowledge/sources ───────────────────────────────────────────────────

router.get("/knowledge/sources", async (_req, res) => {
  try {
    const origins = await db
      .select({
        origin: knowledgeDocumentsTable.origin,
        total: count(),
        indexed: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'processed')`,
        errors: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'error')`,
      })
      .from(knowledgeDocumentsTable)
      .groupBy(knowledgeDocumentsTable.origin);

    const sources = [
      {
        id: "upload",
        label: "Upload Manual",
        status: "active",
        icon: "upload",
      },
      { id: "drive", label: "Google Drive", status: "planned", icon: "drive" },
      {
        id: "internal",
        label: "Base Interna",
        status: "planned",
        icon: "database",
      },
      { id: "system", label: "Sistema", status: "active", icon: "cpu" },
    ].map((s) => {
      const stats = origins.find((o) => (o.origin ?? "upload") === s.id);
      return {
        ...s,
        total: Number(stats?.total ?? 0),
        indexed: Number(stats?.indexed ?? 0),
        errors: Number(stats?.errors ?? 0),
      };
    });

    res.json({ sources });
  } catch (err) {
    logger.error({ err }, "Knowledge sources error");
    apiError(res, 500, "Failed to get sources");
  }
});

// ── POST /knowledge/search ───────────────────────────────────────────────────

router.post("/knowledge/search", async (req, res) => {
  try {
    const { query, agentId, limit, category, product } = req.body as {
      query?: string;
      agentId?: string;
      limit?: number;
      category?: string;
      product?: string;
    };

    if (!query?.trim()) {
      apiError(res, 400, "query é obrigatório");
      return;
    }

    try {
      const {
        embeddings: [queryEmbedding],
      } = await generateEmbeddings([query]);

      const similarity = sql<number>`1 - (${knowledgeChunksTable.embedding} <=> ${JSON.stringify(queryEmbedding)})`;

      const filters = [
        agentId ? eq(knowledgeDocumentsTable.agentId, agentId) : sql`TRUE`,
        category ? eq(knowledgeDocumentsTable.category, category) : sql`TRUE`,
        product ? eq(knowledgeDocumentsTable.product, product) : sql`TRUE`,
      ];

      const results = await db
        .select({
          documentId: knowledgeChunksTable.documentId,
          chunkId: knowledgeChunksTable.id,
          content: knowledgeChunksTable.content,
          score: similarity,
          filename: knowledgeDocumentsTable.filename,
          category: knowledgeDocumentsTable.category,
          product: knowledgeDocumentsTable.product,
          origin: knowledgeDocumentsTable.origin,
          createdAt: knowledgeDocumentsTable.createdAt,
        })
        .from(knowledgeChunksTable)
        .innerJoin(
          knowledgeDocumentsTable,
          eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id),
        )
        .where(and(...filters))
        .orderBy(desc(similarity))
        .limit(limit || 8);

      res.json({
        query,
        results: results
          .filter((r) => r.score > 0.25)
          .map((r) => ({
            ...r,
            documentId: String(r.documentId),
            chunkId: String(r.chunkId),
            score: Math.round(r.score * 1000) / 1000,
            createdAt:
              r.createdAt instanceof Date
                ? r.createdAt.toISOString()
                : r.createdAt,
          })),
      });
    } catch (embErr) {
      logger.error({ err: embErr }, "Vector search error");
      // Fallback: text search if embeddings unavailable
      const docs = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(
          sql`${knowledgeDocumentsTable.extractedContent} ilike ${"%" + query + "%"}`,
        )
        .limit(limit || 5);

      res.json({
        query,
        fallback: true,
        embeddingError:
          "Embeddings indisponíveis — busca textual usada como fallback.",
        results: docs.map((d) => ({
          documentId: String(d.id),
          chunkId: null,
          filename: d.filename,
          content: d.extractedContent?.slice(0, 400) ?? "",
          score: 0.5,
          category: d.category,
          product: d.product,
          origin: d.origin,
          createdAt:
            d.createdAt instanceof Date
              ? d.createdAt.toISOString()
              : d.createdAt,
        })),
      });
    }
  } catch (err) {
    logger.error({ err }, "Knowledge search error");
    apiError(res, 500, "Falha na busca");
  }
});

// ── GET /knowledge/:id/chunks ────────────────────────────────────────────────

router.get("/knowledge/:id/chunks", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (id === null) {
      apiError(res, 400, "ID inválido");
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const pageSize = Math.min(
      50,
      parseInt(String(req.query.pageSize ?? "20"), 10),
    );
    const offset = (page - 1) * pageSize;

    const [doc] = await db
      .select({
        id: knowledgeDocumentsTable.id,
        filename: knowledgeDocumentsTable.filename,
      })
      .from(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, id));

    if (!doc) {
      apiError(res, 404, "Documento não encontrado");
      return;
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.documentId, id));

    const chunks = await db
      .select({
        id: knowledgeChunksTable.id,
        content: knowledgeChunksTable.content,
        createdAt: knowledgeChunksTable.createdAt,
      })
      .from(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.documentId, id))
      .orderBy(knowledgeChunksTable.id)
      .limit(pageSize)
      .offset(offset);

    res.json({
      documentId: String(id),
      filename: doc.filename,
      total: Number(total),
      page,
      pageSize,
      chunks: chunks.map((c, i) => ({
        id: String(c.id),
        index: offset + i + 1,
        content: c.content,
        tokens: Math.ceil(c.content.split(/\s+/).length * 1.3),
        hasEmbedding: true,
        createdAt:
          c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Knowledge chunks error");
    apiError(res, 500, "Falha ao carregar chunks");
  }
});

// ── POST /knowledge/:id/reindex ──────────────────────────────────────────────

router.post("/knowledge/:id/reindex", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (id === null) {
      apiError(res, 400, "ID inválido");
      return;
    }

    const [doc] = await db
      .select()
      .from(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, id));

    if (!doc) {
      apiError(res, 404, "Documento não encontrado");
      return;
    }

    // Delete existing chunks
    await db
      .delete(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.documentId, id));

    // Mark as pending
    await db
      .update(knowledgeDocumentsTable)
      .set({
        status: "pending",
        processed: false,
        chunkCount: 0,
        errorLog: null,
      })
      .where(eq(knowledgeDocumentsTable.id, id));

    res.json({ success: true, message: "Reindexação iniciada." });

    // Processamento assíncrono após resposta — cron job ou próxima execução vai pegar
    // Não processamos aqui para não estourar timeout da request
  } catch (err) {
    logger.error({ err }, "Knowledge reindex error");
    apiError(res, 500, "Falha ao reindexar");
  }
});

// ── DELETE /knowledge/:id ────────────────────────────────────────────────────

router.delete("/knowledge/:id", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (id === null) {
      apiError(res, 400, "ID inválido");
      return;
    }

    const [doc] = await db
      .select({ id: knowledgeDocumentsTable.id })
      .from(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, id));
    if (!doc) {
      apiError(res, 404, "Documento não encontrado");
      return;
    }

    await db
      .delete(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Knowledge delete error");
    apiError(res, 500, "Falha ao excluir documento");
  }
});

// ── PATCH /knowledge/:id (Move to agent) ──────────────────────────────────────
router.patch("/knowledge/:id", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (id === null) {
      apiError(res, 400, "ID inválido");
      return;
    }

    const { agentId, category, product } = req.body ?? {};

    const [existing] = await db
      .select()
      .from(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, id));

    if (!existing) {
      apiError(res, 404, "Documento não encontrado");
      return;
    }

    const newAgentId =
      agentId ||
      (category || product
        ? resolveAgentId(
            category || existing.category,
            product || existing.product,
          )
        : existing.agentId);

    // Validate agent exists
    if (newAgentId !== "global" && !getAgentById(newAgentId)) {
      apiError(res, 400, `Agente inválido: ${newAgentId}`);
      return;
    }

    const updates: Record<string, any> = { agentId: newAgentId };
    if (category !== undefined) updates.category = category;
    if (product !== undefined) updates.product = product;

    const [updated] = await db
      .update(knowledgeDocumentsTable)
      .set(updates)
      .where(eq(knowledgeDocumentsTable.id, id))
      .returning();

    logger.info(
      { docId: id, agentId: newAgentId },
      "[Knowledge] moved to agent",
    );

    res.json({
      success: true,
      document: mapDoc(updated ?? existing),
    });
  } catch (err) {
    logger.error({ err }, "Knowledge move error");
    apiError(res, 500, "Falha ao mover documento");
  }
});

// ── GET + POST /knowledge/process-queue (Cron Job) ───────────────────────────
// Vercel Cron: diário (0 8 * * *) — limitado a 1x/dia no plano Hobby.
// GET: Vercel Cron (Authorization: Bearer CRON_SECRET handled by auth middleware → userId="system")
// POST: Make.com or manual trigger (x-cron-secret header)
// Processa documentos pendentes um por um para evitar timeout de 60s.

async function handleProcessQueue(req: any, res: any) {
  // Vercel Cron passes through auth middleware with userId="system" via Bearer CRON_SECRET.
  // For x-cron-secret callers (Make.com etc), validate manually.
  const xCronSecret = req.headers["x-cron-secret"];
  const hasCronSecret = !!process.env.CRON_SECRET;
  if (hasCronSecret && req.userId !== "system") {
    if (!xCronSecret || typeof xCronSecret !== "string" || !safeCompare(xCronSecret, process.env.CRON_SECRET!)) {
      apiError(res, 403, "Invalid or missing cron secret");
      return;
    }
  } else if (!hasCronSecret) {
    // Fallback: exigir autenticação normal quando CRON_SECRET não configurado
    const userId = req.userId;
    if (!userId || userId === "system") {
      apiError(res, 403, "Authentication required for process-queue");
      return;
    }
  }

  try {
    // Buscar documentos pendentes ou com erro (retry até 3x)
    const pending = await db
      .select()
      .from(knowledgeDocumentsTable)
      .where(
        or(
          eq(knowledgeDocumentsTable.status, "pending"),
          and(
            eq(knowledgeDocumentsTable.status, "error"),
            lt(knowledgeDocumentsTable.retries, 3),
          ),
        ),
      )
      .orderBy(knowledgeDocumentsTable.createdAt)
      .limit(5);

    logger.info(`[Cron KB] ${pending.length} documento(s) para processar`);

    let processed = 0;
    let failed = 0;

    for (const doc of pending) {
      let buffer: Buffer | null = null;

      // Prefer blobUrl (Vercel Blob) over fileData (legacy base64)
      if (doc.blobUrl) {
        try {
          buffer = await withTimeout(
            downloadBlob(doc.blobUrl),
            15000,
            `Download Blob doc ${doc.id}`,
          );
        } catch (e: any) {
          logger.error(`[Cron KB] Doc ${doc.id} falha ao baixar do Blob: ${e.message}`);
        }
      } else if (doc.fileData) {
        try {
          buffer = Buffer.from(doc.fileData, "base64");
        } catch (e: any) {
          logger.error(`[Cron KB] Doc ${doc.id} fileData inválido: ${e.message}`);
        }
      }

      if (!buffer) {
        // Fallback: reconstruir do extractedContent salvo antes da falha.
        if (doc.extractedContent) {
          try {
            await db
              .delete(knowledgeChunksTable)
              .where(eq(knowledgeChunksTable.documentId, doc.id));
            await processDocumentFromContent(doc.id, doc.extractedContent);
            processed++;
          } catch (err: any) {
            logger.error(
              `[Cron KB] Doc ${doc.id} falha no reprocesso por conteúdo: ${err.message}`,
            );
            await db
              .update(knowledgeDocumentsTable)
              .set({ status: "error", errorLog: err.message })
              .where(eq(knowledgeDocumentsTable.id, doc.id))
              .catch(() => {});
            failed++;
          }
          continue;
        }
        logger.info(`[Cron KB] Doc ${doc.id} sem arquivo disponível — pulando`);
        await db
          .update(knowledgeDocumentsTable)
          .set({
            status: "error",
            // retries+1: sem isso, docs irrecuperáveis (retries=0 < 3) ocupam
            // o lote de 5 do cron indefinidamente e travam a fila.
            retries: sql`${knowledgeDocumentsTable.retries} + 1`,
            errorLog:
              "Arquivo original não encontrado (sem Blob URL, base64 nem conteúdo extraído). Reenvie o documento.",
          })
          .where(eq(knowledgeDocumentsTable.id, doc.id));
        failed++;
        continue;
      }

      try {
        await processDocumentAsync(doc.id, buffer, doc.fileType, doc.filename);
        processed++;
      } catch (err: any) {
        logger.error(`[Cron KB] Doc ${doc.id} falha no processamento: ${err.message}`);
        failed++;
      }
    }

    res.json({
      success: true,
      processed,
      failed,
      remaining: Math.max(0, pending.length - processed - failed),
    });
  } catch (err) {
    logger.error({ err }, "[Cron KB] Erro no process-queue");
    apiError(res, 500, "Falha no processamento da fila");
  }
}

router.get("/knowledge/process-queue", handleProcessQueue);
router.post("/knowledge/process-queue", handleProcessQueue);

// ── POST /knowledge/reprocess-all ────────────────────────────────────────────
// Reseta documentos órfãos (status=error ou nunca processados) para "pending"
// com retries=0, e processa um lote inline. Body opcional: { ids: number[] }
// para restringir a documentos específicos. Chamar repetidamente até
// remaining=0 (cada chamada processa até 5 docs para caber no timeout da
// Vercel). Os demais são drenados pelo cron de process-queue.

router.post("/knowledge/reprocess-all", async (req, res) => {
  const userId = req.userId;
  if (!userId || userId === "system") {
    apiError(res, 403, "Authentication required");
    return;
  }

  try {
    const ids: number[] | undefined = Array.isArray(req.body?.ids)
      ? req.body.ids
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n > 0)
      : undefined;

    // Só reseta docs RECUPERÁVEIS (com alguma fonte: Blob, base64 ou texto
    // extraído). Irrecuperáveis permanecem em error e exigem reenvio —
    // ressuscitá-los travaria o lote de 5 com os mesmos docs mortos.
    const recoverable = or(
      isNotNull(knowledgeDocumentsTable.blobUrl),
      isNotNull(knowledgeDocumentsTable.fileData),
      // extractedContent vazio ('') não é recuperável — em produção, 27 docs
      // com '' passavam no isNotNull e queimavam o lote em loop.
      sql`coalesce(length(${knowledgeDocumentsTable.extractedContent}), 0) > 0`,
    );
    const orphanFilter = and(
      or(
        eq(knowledgeDocumentsTable.status, "error"),
        eq(knowledgeDocumentsTable.processed, false),
      ),
      recoverable,
    );
    const where =
      ids && ids.length > 0
        ? and(inArray(knowledgeDocumentsTable.id, ids), orphanFilter)
        : orphanFilter;

    // 1. Reset: volta para a fila com contador de retries zerado.
    const resetDocs = await db
      .update(knowledgeDocumentsTable)
      .set({ status: "pending", retries: 0, errorLog: null })
      .where(where)
      .returning({ id: knowledgeDocumentsTable.id });

    // 2. Processa um lote inline (mesma lógica do process-queue).
    const batch = await db
      .select()
      .from(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.status, "pending"))
      .orderBy(knowledgeDocumentsTable.createdAt)
      .limit(5);

    let processed = 0;
    let failed = 0;

    for (const doc of batch) {
      let buffer: Buffer | null = null;
      if (doc.blobUrl) {
        try {
          buffer = await withTimeout(
            downloadBlob(doc.blobUrl),
            15000,
            `Download Blob doc ${doc.id}`,
          );
        } catch (e: any) {
          logger.error(
            `[Reprocess KB] Doc ${doc.id} falha ao baixar do Blob: ${e.message}`,
          );
        }
      } else if (doc.fileData) {
        try {
          buffer = Buffer.from(doc.fileData, "base64");
        } catch {
          /* fileData inválido — tratado abaixo */
        }
      }

      if (!buffer) {
        // Fallback: reconstruir do extractedContent salvo antes da falha.
        if (doc.extractedContent) {
          try {
            await db
              .delete(knowledgeChunksTable)
              .where(eq(knowledgeChunksTable.documentId, doc.id));
            await processDocumentFromContent(doc.id, doc.extractedContent);
            processed++;
          } catch (err: any) {
            logger.error(
              `[Reprocess KB] Doc ${doc.id} falha no reprocesso por conteúdo: ${err.message}`,
            );
            await db
              .update(knowledgeDocumentsTable)
              .set({ status: "error", errorLog: err.message })
              .where(eq(knowledgeDocumentsTable.id, doc.id))
              .catch(() => {});
            failed++;
          }
          continue;
        }
        await db
          .update(knowledgeDocumentsTable)
          .set({
            status: "error",
            retries: sql`${knowledgeDocumentsTable.retries} + 1`,
            errorLog:
              "Arquivo original não encontrado (sem Blob URL, base64 nem conteúdo extraído). Reenvie o documento.",
          })
          .where(eq(knowledgeDocumentsTable.id, doc.id));
        failed++;
        continue;
      }

      try {
        // Remove chunks antigos antes de re-embeddar (evita duplicação).
        await db
          .delete(knowledgeChunksTable)
          .where(eq(knowledgeChunksTable.documentId, doc.id));
        await processDocumentAsync(doc.id, buffer, doc.fileType, doc.filename);
        processed++;
      } catch (err: any) {
        logger.error(
          `[Reprocess KB] Doc ${doc.id} falha no processamento: ${err.message}`,
        );
        failed++;
      }
    }

    res.json({
      success: true,
      reset: resetDocs.length,
      processed,
      failed,
      remaining: Math.max(0, resetDocs.length - processed - failed),
    });
  } catch (err) {
    logger.error({ err }, "[Reprocess KB] Erro no reprocess-all");
    apiError(res, 500, "Falha ao reprocessar documentos");
  }
});

export default router;
