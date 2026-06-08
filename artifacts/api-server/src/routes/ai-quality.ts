import { Router, type IRouter } from "express";
import {
  db,
  aiResponseFeedbackTable,
  aiTestCasesTable,
  aiTestRunsTable,
  usageLogsTable,
  messagesTable,
  knowledgeDocumentsTable,
  knowledgeChunksTable,
} from "@workspace/db";
import { eq, desc, count, avg, and, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { apiError } from "../lib/api-response.js";
import { validateIdParam } from "../lib/validation.js";
import { isRealUser } from "../middlewares/auth.js";
import { generateEmbeddings, callLLM } from "../lib/llm-client.js";
import { getAgentById } from "../lib/agents-data.js";
import { getConfigValue } from "./settings.js";

const router: IRouter = Router();

const feedbackSchema = z.object({
  messageId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  agentId: z.string().min(1),
  rating: z.literal(1).or(z.literal(-1)),
  reason: z.string().optional(),
  comment: z.string().max(1000).optional(),
});

const testCaseSchema = z.object({
  name: z.string().min(1).max(200),
  agentId: z.string().min(1),
  question: z.string().min(1),
  expectedAnswer: z.string().optional(),
  expectedSources: z.array(z.string()).optional(),
  criteria: z.string().optional(),
});

// POST /api/ai-quality/feedback
router.post("/ai-quality/feedback", async (req, res) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 400, "Invalid feedback payload");

    const { messageId, conversationId, agentId, rating, reason, comment } =
      parsed.data;
    const userId = req.userId;

    const [saved] = await db
      .insert(aiResponseFeedbackTable)
      .values({
        messageId,
        conversationId,
        agentId,
        userId: userId || null,
        rating,
        reason: reason || null,
        comment: comment || null,
      })
      .returning();

    res.json({ ok: true, id: saved.id });
  } catch (err) {
    console.error("[ai-quality] feedback error:", err);
    apiError(res, 500, "Internal server error");
  }
});

// GET /api/ai-quality/summary
router.get("/ai-quality/summary", async (req, res) => {
  try {
    const userId = req.userId;

    const [usageSummary] = await db
      .select({
        totalRequests: count(usageLogsTable.id),
        totalTokens: sql<number>`COALESCE(SUM(${usageLogsTable.totalTokens}), 0)`,
        avgLatency: avg(usageLogsTable.latencyMs),
        successCount: sql<number>`SUM(CASE WHEN ${usageLogsTable.success} THEN 1 ELSE 0 END)`,
      })
      .from(usageLogsTable)
      .where(
        isRealUser(userId) ? eq(usageLogsTable.userId, userId) : sql`TRUE`,
      );

    const [feedbackSummary] = await db
      .select({
        totalFeedback: count(aiResponseFeedbackTable.id),
        positiveCount: sql<number>`SUM(CASE WHEN ${aiResponseFeedbackTable.rating} = 1 THEN 1 ELSE 0 END)`,
        negativeCount: sql<number>`SUM(CASE WHEN ${aiResponseFeedbackTable.rating} = -1 THEN 1 ELSE 0 END)`,
      })
      .from(aiResponseFeedbackTable)
      .where(
        isRealUser(userId)
          ? eq(aiResponseFeedbackTable.userId, userId)
          : sql`TRUE`,
      );

    const totalFeedback = Number(feedbackSummary.totalFeedback) || 0;
    const positive = Number(feedbackSummary.positiveCount) || 0;
    const satisfactionRate =
      totalFeedback > 0 ? Math.round((positive / totalFeedback) * 100) : null;

    const totalRequests = Number(usageSummary.totalRequests) || 0;
    const successCount = Number(usageSummary.successCount) || 0;
    const successRate =
      totalRequests > 0
        ? Math.round((successCount / totalRequests) * 100)
        : 100;

    res.json({
      totalRequests,
      totalTokens: Number(usageSummary.totalTokens) || 0,
      avgLatencyMs: usageSummary.avgLatency
        ? Math.round(Number(usageSummary.avgLatency))
        : null,
      successRate,
      totalFeedback,
      satisfactionRate,
      positiveFeedback: positive,
      negativeFeedback: Number(feedbackSummary.negativeCount) || 0,
    });
  } catch (err) {
    console.error("[ai-quality] summary error:", err);
    apiError(res, 500, "Internal server error");
  }
});

// GET /api/ai-quality/runs?limit=&offset=
router.get("/ai-quality/runs", async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const rows = await db
      .select()
      .from(usageLogsTable)
      .where(isRealUser(userId) ? eq(usageLogsTable.userId, userId) : sql`TRUE`)
      .orderBy(desc(usageLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(usageLogsTable)
      .where(
        isRealUser(userId) ? eq(usageLogsTable.userId, userId) : sql`TRUE`,
      );

    res.json({ runs: rows, total: Number(total), limit, offset });
  } catch (err) {
    console.error("[ai-quality] runs error:", err);
    apiError(res, 500, "Internal server error");
  }
});

// GET /api/ai-quality/test-cases?agentId=
router.get("/ai-quality/test-cases", async (req, res) => {
  try {
    const userId = req.userId;
    const { agentId } = req.query;

    const conditions: any[] = [];
    if (agentId && typeof agentId === "string")
      conditions.push(eq(aiTestCasesTable.agentId, agentId));
    if (isRealUser(userId))
      conditions.push(eq(aiTestCasesTable.userId, userId));

    const rows = await db
      .select()
      .from(aiTestCasesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiTestCasesTable.createdAt));

    res.json({ testCases: rows });
  } catch (err) {
    console.error("[ai-quality] test-cases list error:", err);
    apiError(res, 500, "Internal server error");
  }
});

// POST /api/ai-quality/test-cases
router.post("/ai-quality/test-cases", async (req, res) => {
  try {
    const parsed = testCaseSchema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 400, "Invalid test case payload");

    const userId = req.userId;
    const {
      name,
      agentId,
      question,
      expectedAnswer,
      expectedSources,
      criteria,
    } = parsed.data;

    const [saved] = await db
      .insert(aiTestCasesTable)
      .values({
        name,
        agentId,
        userId: userId || null,
        question,
        expectedAnswer: expectedAnswer || null,
        expectedSources: expectedSources || null,
        criteria: criteria || null,
      })
      .returning();

    res.status(201).json({ testCase: saved });
  } catch (err) {
    console.error("[ai-quality] create test case error:", err);
    apiError(res, 500, "Internal server error");
  }
});

// DELETE /api/ai-quality/test-cases/:id
router.delete("/ai-quality/test-cases/:id", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");

    const userId = req.userId;
    if (isRealUser(userId)) {
      const [tc] = await db
        .select()
        .from(aiTestCasesTable)
        .where(and(eq(aiTestCasesTable.id, id), eq(aiTestCasesTable.userId, userId)));
      if (!tc) return apiError(res, 404, "Test case not found");
    }

    await db.delete(aiTestCasesTable).where(eq(aiTestCasesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[ai-quality] delete test case error:", err);
    apiError(res, 500, "Internal server error");
  }
});

// POST /api/ai-quality/test-cases/:id/run
router.post("/ai-quality/test-cases/:id/run", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");

    const userId = req.userId;
    const [testCase] = await db
      .select()
      .from(aiTestCasesTable)
      .where(
        isRealUser(userId)
          ? and(eq(aiTestCasesTable.id, id), eq(aiTestCasesTable.userId, userId))
          : eq(aiTestCasesTable.id, id),
      );
    if (!testCase) return apiError(res, 404, "Test case not found");

    const agent = getAgentById(testCase.agentId);
    if (!agent)
      return apiError(res, 400, `Agent '${testCase.agentId}' not found`);

    const activeProviderDb = await getConfigValue("ACTIVE_LLM_PROVIDER");
    const activeLlmModel = await getConfigValue("ACTIVE_LLM_MODEL");
    const activeLlmUrl = await getConfigValue("ACTIVE_LLM_URL");

    // Insert a pending run
    const [run] = await db
      .insert(aiTestRunsTable)
      .values({
        testCaseId: id,
        model: activeLlmModel || "unknown",
        provider: activeProviderDb || "unknown",
        status: "running",
      })
      .returning();

    const startMs = Date.now();

    try {
      // RAG context
      let systemPrompt = agent.systemPrompt;
      let ragSources: string[] = [];

      try {
        const {
          embeddings: [queryEmbedding],
        } = await generateEmbeddings([testCase.question]);
        const similarity = sql<number>`1 - (${knowledgeChunksTable.embedding} <=> ${JSON.stringify(queryEmbedding)})`;
        const results = await db
          .select({
            content: knowledgeChunksTable.content,
            score: similarity,
            filename: knowledgeDocumentsTable.filename,
          })
          .from(knowledgeChunksTable)
          .innerJoin(
            knowledgeDocumentsTable,
            eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id),
          )
          .where(
            sql`${knowledgeDocumentsTable.agentId} = ${testCase.agentId} OR ${knowledgeDocumentsTable.agentId} = 'global'`,
          )
          .orderBy((t: any) => desc(t.score))
          .limit(5);

        const relevant = results.filter((r) => r.score > 0.3);
        if (relevant.length > 0) {
          systemPrompt += `\n\n--- CONTEXTO REFERÊNCIA ---\n${relevant.map((c) => `[Doc: ${c.filename}]\n${c.content}`).join("\n\n")}`;
          const seen = new Set<string>();
          for (const c of relevant) {
            if (!seen.has(c.filename)) {
              seen.add(c.filename);
              ragSources.push(c.filename);
            }
          }
        }
      } catch (ragErr) {
        console.error("[ai-quality] test run RAG error:", ragErr);
      }

      const result = await callLLM(systemPrompt, testCase.question, {
        provider: activeProviderDb || undefined,
        model: activeLlmModel || undefined,
        customUrl: activeLlmUrl || undefined,
      });

      const latencyMs = Date.now() - startMs;

      await db
        .update(aiTestRunsTable)
        .set({
          status: "passed",
          response: result.output,
          ragSources,
          latencyMs,
          tokensUsed: result.tokensUsed,
          model: result.model,
          provider: result.provider,
        })
        .where(eq(aiTestRunsTable.id, run.id));

      const [updated] = await db
        .select()
        .from(aiTestRunsTable)
        .where(eq(aiTestRunsTable.id, run.id));
      res.json({ run: updated });
    } catch (llmErr: any) {
      await db
        .update(aiTestRunsTable)
        .set({
          status: "error",
          notes: llmErr?.message || "LLM error",
          latencyMs: Date.now() - startMs,
        })
        .where(eq(aiTestRunsTable.id, run.id));

      const [updated] = await db
        .select()
        .from(aiTestRunsTable)
        .where(eq(aiTestRunsTable.id, run.id));
      res.json({ run: updated });
    }
  } catch (err) {
    console.error("[ai-quality] run test case error:", err);
    apiError(res, 500, "Internal server error");
  }
});

// GET /api/ai-quality/test-cases/:id/runs
router.get("/ai-quality/test-cases/:id/runs", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");

    const userId = req.userId;
    if (isRealUser(userId)) {
      const [tc] = await db
        .select()
        .from(aiTestCasesTable)
        .where(and(eq(aiTestCasesTable.id, id), eq(aiTestCasesTable.userId, userId)));
      if (!tc) return apiError(res, 404, "Test case not found");
    }

    const rows = await db
      .select()
      .from(aiTestRunsTable)
      .where(eq(aiTestRunsTable.testCaseId, id))
      .orderBy(desc(aiTestRunsTable.createdAt))
      .limit(50);

    res.json({ runs: rows });
  } catch (err) {
    console.error("[ai-quality] get runs error:", err);
    apiError(res, 500, "Internal server error");
  }
});

export default router;
