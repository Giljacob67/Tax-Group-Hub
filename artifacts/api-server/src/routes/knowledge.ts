import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { knowledgeDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import multer from "multer";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

async function extractTextContent(buffer: Buffer, fileType: string, filename: string): Promise<string> {
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

router.get("/knowledge", async (req, res) => {
  try {
    const { agentId } = req.query;
    let documents;
    if (agentId && typeof agentId === "string") {
      documents = await db.select().from(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.agentId, agentId)).orderBy(knowledgeDocumentsTable.createdAt);
    } else {
      documents = await db.select().from(knowledgeDocumentsTable).orderBy(knowledgeDocumentsTable.createdAt);
    }
    res.json({
      documents: documents.map((d) => ({
        id: String(d.id),
        agentId: d.agentId,
        filename: d.filename,
        fileType: d.fileType,
        fileSize: d.fileSize,
        storageKey: d.storageKey,
        status: d.status,
        hasContent: !!d.extractedContent,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Error listing knowledge documents:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/knowledge/upload", upload.single("file"), async (req, res) => {
  try {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    const agentId = req.body?.agentId || "global";

    if (!file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    let extractedContent = "";
    try {
      extractedContent = await extractTextContent(file.buffer, file.mimetype, file.originalname);
    } catch (extractErr) {
      console.error("Text extraction error:", extractErr);
    }

    const storageKey = `knowledge/${agentId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const [doc] = await db
      .insert(knowledgeDocumentsTable)
      .values({
        agentId,
        filename: file.originalname,
        fileType: file.mimetype || "application/octet-stream",
        fileSize: file.size,
        storageKey,
        extractedContent: extractedContent || null,
        status: extractedContent ? "processed" : "pending",
        processed: !!extractedContent,
      })
      .returning();

    res.status(201).json({
      id: String(doc.id),
      agentId: doc.agentId,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      storageKey: doc.storageKey,
      status: doc.status,
      hasContent: !!doc.extractedContent,
      contentPreview: extractedContent ? extractedContent.substring(0, 200) + "..." : null,
      createdAt: doc.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Error uploading knowledge document:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/knowledge/upload-url", async (req, res) => {
  try {
    const { agentId, filename, fileType, fileSize } = req.body as {
      agentId?: string; filename?: string; fileType?: string; fileSize?: number;
    };
    if (!agentId || !filename || !fileType || !fileSize) {
      res.status(400).json({ error: "agentId, filename, fileType and fileSize are required" });
      return;
    }
    const storageKey = `knowledge/${agentId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const [doc] = await db
      .insert(knowledgeDocumentsTable)
      .values({ agentId, filename, fileType, fileSize, storageKey, status: "pending" })
      .returning();
    const uploadUrl = `${process.env.APP_URL || ""}/api/knowledge/upload/${doc.id}`;
    res.json({ uploadUrl, documentId: String(doc.id), storageKey });
  } catch (err) {
    console.error("Error requesting upload URL:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/knowledge/:documentId", async (req, res) => {
  try {
    const documentId = Number(req.params.documentId);
    if (isNaN(documentId)) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    await db.delete(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, documentId));
    res.json({ success: true, message: "Document deleted" });
  } catch (err) {
    console.error("Error deleting document:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
