import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { knowledgeDocumentsTable, knowledgeChunksTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { generateEmbeddings } from "../lib/llm-client.js";
import multer from "multer";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";
import { validateIdParam } from "../lib/validation.js";

const router: IRouter = Router();

// Whitelist: only allow document file types
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream", // fallback for .md files
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".md"];

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}`));
  }
}

import path from "node:path";
import fs from "node:fs";
import { apiError } from "../lib/api-response.js";

const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve("/tmp", "uploads")
  : path.resolve(process.cwd(), "uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  // Serverless environments may have read-only FS — uploads will use memory fallback
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter,
});

/**
 * Wrapper around multer middleware to handle errors gracefully
 * (e.g. LIMIT_FILE_SIZE, unsupported mime types) and return
 * structured JSON responses instead of crashing into the global handler.
 */
function handleMulterUpload(fieldName: string) {
  return (req: any, res: any, next: any) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return apiError(res, 413, "Arquivo excede o limite de 50MB.");
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return apiError(res, 400, "Campo de arquivo inesperado. Use o campo 'file'.");
        }
        if (err.message?.toLowerCase().includes("file type not allowed")) {
          return apiError(res, 415, "Tipo de arquivo não permitido. Aceitos: PDF, DOCX, DOC, TXT, MD.");
        }
        return apiError(res, 400, err.message || "Erro no upload do arquivo.");
      }
      next();
    });
  };
}

export async function extractTextContent(buffer: Buffer, fileType: string, filename: string): Promise<string> {
  const lower = (fileType + filename).toLowerCase();
  if (lower.includes("pdf")) {
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  if (lower.includes("docx") || lower.includes("word") || lower.includes("officedocument")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }
  if (lower.includes("markdown") || lower.includes("text") || filename.endsWith(".md") || filename.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }
  return "";
}

function chunkText(text: string, chunkSize: number = 800, overlap: number = 200): string[] {
  if (!text.trim()) return [];
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSize);
    chunks.push(chunkWords.join(" "));
    i += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Process a document in the background: extract text, chunk, embed, and store.
 * Updates the document status to 'processing' → 'processed' | 'error'.
 */
export async function processDocumentAsync(docId: number, buffer: Buffer, fileType: string, filename: string): Promise<void> {
  try {
    // Increment retries and mark as processing
    await db
      .update(knowledgeDocumentsTable)
      .set({ 
        status: "processing", 
        retries: sql`${knowledgeDocumentsTable.retries} + 1` 
      })
      .where(eq(knowledgeDocumentsTable.id, docId));

    const extractedContent = await extractTextContent(buffer, fileType, filename);

    // Update extracted content in DB
    await db
      .update(knowledgeDocumentsTable)
      .set({ extractedContent })
      .where(eq(knowledgeDocumentsTable.id, docId));

    const chunks = chunkText(extractedContent);
    if (chunks.length > 0) {
      const embeddings = await generateEmbeddings(chunks);
      const chunkValues = chunks.map((chunk, i) => ({
        documentId: docId,
        content: chunk,
        embedding: embeddings[i],
      }));
      await db.insert(knowledgeChunksTable).values(chunkValues);
    }

    // Mark as processed
    await db
      .update(knowledgeDocumentsTable)
      .set({ status: "processed", processed: true, errorLog: null })
      .where(eq(knowledgeDocumentsTable.id, docId));

    console.log(`[Knowledge] Document ${docId} (${filename}) processed successfully. ${chunks.length} chunks indexed.`);
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    console.error(`[Knowledge] Error processing document ${docId}:`, errorMsg);
    await db
      .update(knowledgeDocumentsTable)
      .set({ status: "error", errorLog: errorMsg })
      .where(eq(knowledgeDocumentsTable.id, docId))
      .catch(() => {});
  }
}

// GET /knowledge — List documents, filtered by agentId and/or userId
router.get("/knowledge", async (req, res) => {
  try {
    const { agentId } = req.query;
    const userId = req.userId; // injected by auth middleware

    let documents;
    if (agentId && typeof agentId === "string") {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(
          userId && userId !== "default" && userId !== "dev-user"
            ? and(eq(knowledgeDocumentsTable.agentId, agentId), eq(knowledgeDocumentsTable.userId, userId))
            : eq(knowledgeDocumentsTable.agentId, agentId),
        )
        .orderBy(knowledgeDocumentsTable.createdAt);
    } else {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(
          userId && userId !== "default" && userId !== "dev-user"
            ? eq(knowledgeDocumentsTable.userId, userId)
            : undefined,
        )
        .orderBy(knowledgeDocumentsTable.createdAt);
    }

    res.json({
      documents: documents.map((d: any) => ({
        id: String(d.id),
        filename: d.filename,
        fileType: d.fileType,
        fileSize: d.fileSize,
        agentId: d.agentId,
        status: d.status ?? "pending",
        processed: d.processed ?? false,
        hasContent: d.processed && !!d.extractedContent,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      })),
    });
  } catch (err) {
    console.error("Knowledge list error:", err);
    apiError(res, 500, "Failed to list documents");
  }
});

// POST /knowledge/upload — Accept file, return immediately, process in background
router.post("/knowledge/upload", handleMulterUpload("file"), async (req, res) => {
  try {
    if (!req.file) {
      apiError(res, 400, "No file provided");
      return;
    }

    const { agentId } = req.body;
    const userId = req.userId;

    // 1. Persist the document record immediately with status 'pending'
    const [doc] = await db
      .insert(knowledgeDocumentsTable)
      .values({
        filename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        extractedContent: null,
        storageKey: req.file.path || `local-memory-${Date.now()}-${req.file.originalname}`,
        agentId: agentId || "global",
        userId: userId || null,
        status: "pending",
        processed: false,
      })
      .returning();

    // 2. Return immediately to the client
    res.status(202).json({
      success: true,
      message: "Documento recebido. Processamento em andamento.",
      document: {
        id: String(doc.id),
        filename: doc.filename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        agentId: doc.agentId,
        status: "pending",
        processed: false,
        hasContent: false,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
      },
    });

    // 3. Process asynchronously (fire and forget)
    // If multer is configured for disk Storage, req.file.path exists. Otherwise fallback to buffer (memory)
    const filePath = req.file.path;
    const fileBuffer = filePath ? fs.readFileSync(filePath) : (req.file.buffer ? Buffer.from(req.file.buffer) : Buffer.alloc(0));
    const fileMime = req.file.mimetype;
    const fileName = req.file.originalname;
    
    setImmediate(() => {
      processDocumentAsync(doc.id, fileBuffer, fileMime, fileName).catch(() => {});
    });
  } catch (err) {
    console.error("Knowledge upload error:", err);
    apiError(res, 500, "Failed to upload document");
  }
});

// DELETE /knowledge/:id — Remove a document (scoped by userId if provided)
router.delete("/knowledge/:id", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    const userId = req.userId;

    if (id === null) {
      apiError(res, 400, "Invalid document id");
      return;
    }

    // If we have a real userId, ensure the user owns this document
    if (userId && userId !== "default" && userId !== "dev-user") {
      const [doc] = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(and(eq(knowledgeDocumentsTable.id, id), eq(knowledgeDocumentsTable.userId, userId)));
      if (!doc) {
        apiError(res, 404, "Document not found or access denied");
        return;
      }
    }

    await db.delete(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Knowledge delete error:", err);
    apiError(res, 500, "Failed to delete document");
  }
});

export default router;
