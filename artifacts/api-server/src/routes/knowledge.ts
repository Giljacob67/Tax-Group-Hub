import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { knowledgeDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// List knowledge documents (optionally by agentId)
router.get("/knowledge", async (req, res) => {
  try {
    const { agentId } = req.query;

    let documents;
    if (agentId && typeof agentId === "string") {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .where(eq(knowledgeDocumentsTable.agentId, agentId))
        .orderBy(knowledgeDocumentsTable.createdAt);
    } else {
      documents = await db
        .select()
        .from(knowledgeDocumentsTable)
        .orderBy(knowledgeDocumentsTable.createdAt);
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
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Error listing knowledge documents:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Request presigned upload URL
router.post("/knowledge/upload-url", async (req, res) => {
  try {
    const { agentId, filename, fileType, fileSize } = req.body as {
      agentId?: string;
      filename?: string;
      fileType?: string;
      fileSize?: number;
    };

    if (!agentId || !filename || !fileType || !fileSize) {
      res.status(400).json({ error: "agentId, filename, fileType and fileSize are required" });
      return;
    }

    // Generate a unique storage key
    const storageKey = `knowledge/${agentId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // Create document record in DB
    const [doc] = await db
      .insert(knowledgeDocumentsTable)
      .values({
        agentId,
        filename,
        fileType,
        fileSize,
        storageKey,
        status: "pending",
      })
      .returning();

    // In production, this would generate a real presigned URL from GCS/S3
    // For now, we return a placeholder that indicates the document was registered
    const uploadUrl = `${process.env.APP_URL || ""}/api/knowledge/upload/${doc.id}`;

    res.json({
      uploadUrl,
      documentId: String(doc.id),
      storageKey,
    });
  } catch (err) {
    console.error("Error requesting upload URL:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark document as processed (called after upload)
router.post("/knowledge/upload/:documentId/complete", async (req, res) => {
  try {
    const documentId = Number(req.params.documentId);

    await db
      .update(knowledgeDocumentsTable)
      .set({ status: "processed", processed: true })
      .where(eq(knowledgeDocumentsTable.id, documentId));

    res.json({ success: true });
  } catch (err) {
    console.error("Error completing upload:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete knowledge document
router.delete("/knowledge/:documentId", async (req, res) => {
  try {
    const documentId = Number(req.params.documentId);
    if (isNaN(documentId)) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    await db
      .delete(knowledgeDocumentsTable)
      .where(eq(knowledgeDocumentsTable.id, documentId));

    res.json({ success: true, message: "Document deleted" });
  } catch (err) {
    console.error("Error deleting document:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
