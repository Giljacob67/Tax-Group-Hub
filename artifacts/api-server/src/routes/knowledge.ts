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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

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
        id: d.id,
        filename: d.filename,
        fileType: d.fileType,
        agentId: d.agentId,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    console.error("Knowledge list error:", err);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.post("/knowledge/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const { agentId } = req.body;

    // Extract text content
    const extractedContent = await extractTextContent(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );

    // Save to database
    const [doc] = await db
      .insert(knowledgeDocumentsTable)
      .values({
        filename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        extractedContent,
        agentId: agentId || null,
      })
      .returning();

    res.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        agentId: doc.agentId,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    console.error("Knowledge upload error:", err);
    res.status(500).json({ error: "Failed to upload document", message: (err as Error).message });
  }
});

router.delete("/knowledge/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Knowledge delete error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
