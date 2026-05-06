import { Router, type IRouter } from "express";
import { db, knowledgeDocumentsTable, embeddingCacheTable } from "@workspace/db";
import { eq, inArray, lt } from "drizzle-orm";
import fs from "node:fs";
import { processDocumentAsync } from "./knowledge.js";
import { apiError } from "../lib/api-response.js";

const router: IRouter = Router();

// POST /system/jobs/retry
// Admin/System endpoint to retry document processing for failed or stuck jobs
router.post("/system/jobs/retry", async (req, res) => {
  try {
    const { docIds } = req.body as { docIds?: number[] };
    const userId = req.userId;

    // Enforce admin/system level restriction here if needed
    // For now, allow retry on user's own docs or any doc if global admin.
    
    let query = db.select().from(knowledgeDocumentsTable).where(inArray(knowledgeDocumentsTable.status, ["error", "pending"]));
    
    if (docIds && docIds.length > 0) {
      query = query.where(inArray(knowledgeDocumentsTable.id, docIds));
    }
    
    // Strict tenancy: regular users can only retry their own jobs
    if (userId && userId !== "system" && userId !== "dev-user") {
      query = query.where(eq(knowledgeDocumentsTable.userId, userId));
    }

    const stuckDocs = await query;

    if (stuckDocs.length === 0) {
      res.json({ success: true, message: "No stuck or failed documents found to retry.", retriedCount: 0 });
      return;
    }

    let retriedCount = 0;
    const errors: Array<{ id: number; error: string; path?: string | null }> = [];

    for (const doc of stuckDocs) {
      try {
        if (!doc.storageKey || !fs.existsSync(doc.storageKey)) {
           errors.push({ id: doc.id, error: "Arquivo físico não encontrado no storageKey.", path: doc.storageKey });
           continue;
        }

        const fileBuffer = fs.readFileSync(doc.storageKey);
        
        // Fire and forget
        setImmediate(() => {
          processDocumentAsync(doc.id, fileBuffer, doc.fileType, doc.filename).catch((err: Error) => {
            console.error("[Knowledge] processDocumentAsync failed for doc", doc.id, err);
          });
        });

        retriedCount++;
      } catch (err) {
         errors.push({ id: doc.id, error: (err as Error).message });
      }
    }

    res.json({
      success: true,
      message: `${retriedCount} documents queued for retry.`,
      retriedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error("Jobs retry error:", err);
    apiError(res, 500, "Failed to trigger job retries");
  }
});

/**
 * DELETE /system/cache/embeddings
 * Prune embedding cache entries older than `days` (default 90).
 * Prevents unbounded table growth — safe to run anytime, embeddings are regenerated on demand.
 */
router.delete("/system/cache/embeddings", async (req, res) => {
  try {
    const days = Math.max(1, Number(req.query.days) || 90);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deleted = await db
      .delete(embeddingCacheTable)
      .where(lt(embeddingCacheTable.createdAt, cutoff))
      .returning({ id: embeddingCacheTable.id });

    res.json({ success: true, deleted: deleted.length, cutoffDate: cutoff.toISOString() });
  } catch (err) {
    console.error("Embedding cache purge error:", err);
    apiError(res, 500, "Failed to purge embedding cache");
  }
});

export default router;
