import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { knowledgeDocumentsTable, knowledgeChunksTable } from "@workspace/db";
import { eq, and, or, sql, count, desc, lt } from "drizzle-orm";
import { generateEmbeddings } from "../lib/llm-client.js";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import { validateIdParam } from "../lib/validation.js";
import { apiError } from "../lib/api-response.js";
import { safeCompare } from "../middlewares/auth.js";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { get } from "@vercel/blob";

const router: IRouter = Router();

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

    console.log(
      `[Knowledge] Doc ${docId} (${filename}) OK — ${chunks.length} chunks`,
    );
  } catch (err) {
    const msg = (err as Error).message || String(err);
    console.error(`[Knowledge] Doc ${docId} failed:`, msg);
    await db
      .update(knowledgeDocumentsTable)
      .set({ status: "error", errorLog: msg })
      .where(eq(knowledgeDocumentsTable.id, docId))
      .catch(() => {});
  }
}

// ── GET /knowledge/health ────────────────────────────────────────────────────

router.get("/knowledge/health", async (req, res) => {
  try {
    const userId = req.userId;
    const userFilter =
      userId && userId !== "default" && userId !== "dev-user"
        ? eq(knowledgeDocumentsTable.userId, userId)
        : undefined;

    const [stats] = await db
      .select({
        total: count(),
        indexed: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'processed')`,
        pending: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} in ('pending', 'processing'))`,
        errors: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'error')`,
        totalChunks: sql<number>`coalesce(sum(${knowledgeDocumentsTable.chunkCount}), 0)`,
      })
      .from(knowledgeDocumentsTable)
      .where(userFilter);

    const [lastDoc] = await db
      .select({ createdAt: knowledgeDocumentsTable.createdAt })
      .from(knowledgeDocumentsTable)
      .where(userFilter)
      .orderBy(desc(knowledgeDocumentsTable.createdAt))
      .limit(1);

    const origins = await db
      .select({
        origin: knowledgeDocumentsTable.origin,
        cnt: count(),
      })
      .from(knowledgeDocumentsTable)
      .where(userFilter)
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
    console.error("Knowledge health error:", err);
    apiError(res, 500, "Failed to get knowledge health");
  }
});

// ── GET /knowledge ───────────────────────────────────────────────────────────

router.get("/knowledge", async (req, res) => {
  try {
    const { agentId } = req.query;
    const userId = req.userId;
    const userFilter =
      userId && userId !== "default" && userId !== "dev-user"
        ? eq(knowledgeDocumentsTable.userId, userId)
        : undefined;

    let documents;
    if (agentId && typeof agentId === "string") {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(
          userFilter
            ? and(eq(knowledgeDocumentsTable.agentId, agentId), userFilter)
            : eq(knowledgeDocumentsTable.agentId, agentId),
        )
        .orderBy(desc(knowledgeDocumentsTable.createdAt));
    } else {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(userFilter)
        .orderBy(desc(knowledgeDocumentsTable.createdAt));
    }

    res.json({ documents: documents.map(mapDoc) });
  } catch (err) {
    console.error("Knowledge list error:", err);
    apiError(res, 500, "Failed to list documents");
  }
});

// ── POST /knowledge/upload ───────────────────────────────────────────────────

// ── POST /knowledge/upload-token ──────────────────────────────────────────────
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
    console.error("[UploadToken] error:", err);
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
      console.warn(`[downloadBlob] SDK get() falhou: ${sdkErr.message}`);
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
      filename,
      mimetype,
      agentId,
      category,
      product,
      origin,
      tags,
    } = req.body ?? {};

    if (!blobUrl || typeof blobUrl !== "string") {
      apiError(res, 400, "Campo blobUrl obrigatório.");
      return;
    }
    if (!filename || typeof filename !== "string") {
      apiError(res, 400, "Campo filename obrigatório.");
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

    // Download file from Blob to get size
    console.log("[Upload] downloading from Blob:", blobUrl);
    let buffer: Buffer;
    try {
      buffer = await withTimeout(
        downloadBlob(blobUrl),
        15000,
        "Download do Blob",
      );
    } catch (e: any) {
      console.error("[Upload] download error:", e.message);
      apiError(res, 500, "Falha ao baixar arquivo do storage.");
      return;
    }

    const fileSize = buffer.length;
    console.log("[Upload] received:", filename, fileSize, "bytes");

    const SYNC_THRESHOLD = 2 * 1024 * 1024; // 2 MB
    const isSmall = fileSize < SYNC_THRESHOLD;

    console.log("[Upload] inserting DB record...");
    const [doc] = await db
      .insert(knowledgeDocumentsTable)
      .values({
        filename,
        fileType: mimeType,
        fileSize,
        extractedContent: null,
        storageKey: `blob-${Date.now()}-${filename}`,
        agentId: agentId || "global",
        userId: userId || null,
        status: isSmall ? "processing" : "pending",
        processed: false,
        category: category || null,
        product: product || null,
        origin: origin || "upload",
        tags: parsedTags.length > 0 ? parsedTags : null,
        blobUrl,
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
        console.log(`[Upload] doc ${doc.id} processado sincronamente`);
        res.status(200).json({
          success: true,
          message: "Documento processado com sucesso.",
          document: mapDoc(updatedDoc ?? doc),
        });
        return;
      } catch (procErr: any) {
        const msg = procErr?.message || String(procErr);
        console.error(
          `[Upload] doc ${doc.id} falha no processamento rápido:`,
          msg,
        );
        await db
          .update(knowledgeDocumentsTable)
          .set({ status: "pending", errorLog: msg })
          .where(eq(knowledgeDocumentsTable.id, doc.id))
          .catch(() => {});
      }
    }

    console.log(`[Upload] 200 → doc ${doc.id} enfileirado`);
    res.status(200).json({
      success: true,
      message: "Documento recebido e enfileirado para processamento.",
      document: mapDoc(doc),
    });
  } catch (err) {
    console.error("[Upload] error:", err);
    apiError(res, 500, "Falha no upload do documento");
  }
});

// ── GET /knowledge/sources ───────────────────────────────────────────────────

router.get("/knowledge/sources", async (req, res) => {
  try {
    const userId = req.userId;
    const userFilter =
      userId && userId !== "default" && userId !== "dev-user"
        ? eq(knowledgeDocumentsTable.userId, userId)
        : undefined;

    const origins = await db
      .select({
        origin: knowledgeDocumentsTable.origin,
        total: count(),
        indexed: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'processed')`,
        errors: sql<number>`count(*) filter (where ${knowledgeDocumentsTable.status} = 'error')`,
      })
      .from(knowledgeDocumentsTable)
      .where(userFilter)
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
    console.error("Knowledge sources error:", err);
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
      const userId = req.userId;

      const similarity = sql<number>`1 - (${knowledgeChunksTable.embedding} <=> ${JSON.stringify(queryEmbedding)})`;

      const filters = [
        agentId ? eq(knowledgeDocumentsTable.agentId, agentId) : sql`TRUE`,
        userId && userId !== "default" && userId !== "dev-user"
          ? eq(knowledgeDocumentsTable.userId, userId)
          : sql`TRUE`,
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
      console.error("Vector search error:", embErr);
      // Fallback: text search if embeddings unavailable
      const userFilter =
        req.userId && req.userId !== "default" && req.userId !== "dev-user"
          ? eq(knowledgeDocumentsTable.userId, req.userId)
          : undefined;

      const docs = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(
          and(
            userFilter,
            sql`${knowledgeDocumentsTable.extractedContent} ilike ${"%" + query + "%"}`,
          ),
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
    console.error("Knowledge search error:", err);
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

    const userId = req.userId;

    const [doc] = await db
      .select({
        id: knowledgeDocumentsTable.id,
        filename: knowledgeDocumentsTable.filename,
      })
      .from(knowledgeDocumentsTable)
      .where(
        userId && userId !== "default" && userId !== "dev-user" && userId !== "service"
          ? and(eq(knowledgeDocumentsTable.id, id), eq(knowledgeDocumentsTable.userId, userId))
          : eq(knowledgeDocumentsTable.id, id),
      );

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
    console.error("Knowledge chunks error:", err);
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

    const userId = req.userId;

    const [doc] = await db
      .select()
      .from(knowledgeDocumentsTable)
      .where(
        userId && userId !== "default" && userId !== "dev-user" && userId !== "service"
          ? and(eq(knowledgeDocumentsTable.id, id), eq(knowledgeDocumentsTable.userId, userId))
          : eq(knowledgeDocumentsTable.id, id),
      );

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
    console.error("Knowledge reindex error:", err);
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

    const userId = req.userId;
    if (userId && userId !== "default" && userId !== "dev-user") {
      const [doc] = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(
          and(
            eq(knowledgeDocumentsTable.id, id),
            eq(knowledgeDocumentsTable.userId, userId),
          ),
        );
      if (!doc) {
        apiError(res, 404, "Documento não encontrado ou acesso negado");
        return;
      }
    }

    await db
      .delete(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Knowledge delete error:", err);
    apiError(res, 500, "Falha ao excluir documento");
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

    console.log(`[Cron KB] ${pending.length} documento(s) para processar`);

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
          console.error(
            `[Cron KB] Doc ${doc.id} falha ao baixar do Blob:`,
            e.message,
          );
        }
      } else if (doc.fileData) {
        try {
          buffer = Buffer.from(doc.fileData, "base64");
        } catch (e: any) {
          console.error(
            `[Cron KB] Doc ${doc.id} fileData inválido:`,
            e.message,
          );
        }
      }

      if (!buffer) {
        console.log(`[Cron KB] Doc ${doc.id} sem arquivo disponível — pulando`);
        await db
          .update(knowledgeDocumentsTable)
          .set({
            status: "error",
            errorLog:
              "Arquivo original não encontrado (sem Blob URL nem base64).",
          })
          .where(eq(knowledgeDocumentsTable.id, doc.id));
        failed++;
        continue;
      }

      try {
        await processDocumentAsync(doc.id, buffer, doc.fileType, doc.filename);
        processed++;
      } catch (err: any) {
        console.error(
          `[Cron KB] Doc ${doc.id} falha no processamento:`,
          err.message,
        );
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
    console.error("[Cron KB] Erro no process-queue:", err);
    apiError(res, 500, "Falha no processamento da fila");
  }
}

router.get("/knowledge/process-queue", handleProcessQueue);
router.post("/knowledge/process-queue", handleProcessQueue);

export default router;
