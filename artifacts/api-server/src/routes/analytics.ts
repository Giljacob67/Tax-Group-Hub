import { Router, type IRouter } from "express";
import {
  db,
  usageLogsTable,
  conversationsTable,
  messagesTable,
  llmConnectionsTable,
} from "@workspace/db";
import { eq, sql, gte, and, desc, lte } from "drizzle-orm";
import { apiError } from "../lib/api-response.js";

const router: IRouter = Router();

function getDateRange(req: any) {
  const period = (req.query.period as string) || "30d";
  const now = new Date();
  const start = new Date();
  if (period === "7d") start.setDate(now.getDate() - 7);
  else if (period === "24h") start.setHours(now.getHours() - 24);
  else if (period === "90d") start.setDate(now.getDate() - 90);
  else start.setDate(now.getDate() - 30);
  return { start, end: now, period };
}

function scopeWhere(userId: string | undefined, start: Date) {
  return userId && userId !== "default" && userId !== "dev-user"
    ? and(
        eq(usageLogsTable.userId, userId),
        gte(usageLogsTable.createdAt, start),
      )
    : gte(usageLogsTable.createdAt, start);
}

/**
 * GET /api/analytics/overview
 */
router.get("/analytics/overview", async (req, res) => {
  try {
    const userId = req.userId;
    const { start } = getDateRange(req);
    const where = scopeWhere(userId, start);

    const [tokenResult] = await db
      .select({ total: sql<number>`sum(${usageLogsTable.totalTokens})` })
      .from(usageLogsTable)
      .where(where);
    const [msgCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usageLogsTable)
      .where(where);
    const [agentCount] = await db
      .select({ count: sql<number>`count(distinct ${usageLogsTable.agentId})` })
      .from(usageLogsTable)
      .where(where);
    const [costResult] = await db
      .select({ total: sql<number>`sum(${usageLogsTable.cost})` })
      .from(usageLogsTable)
      .where(where);
    const [latencyResult] = await db
      .select({ avg: sql<number>`avg(${usageLogsTable.latencyMs})` })
      .from(usageLogsTable)
      .where(where);

    res.json({
      totalTokens: Number(tokenResult?.total || 0),
      messageCount: Number(msgCount?.count || 0),
      activeAgents: Number(agentCount?.count || 0),
      totalCostCents: Number(costResult?.total || 0),
      avgLatencyMs: Math.round(Number(latencyResult?.avg || 0)),
      period: req.query.period || "30d",
    });
  } catch (err) {
    console.error("[Analytics] Error:", err);
    apiError(res, 500, "Failed to fetch analytics");
  }
});

/**
 * GET /api/analytics/daily-usage
 */
router.get("/analytics/daily-usage", async (req, res) => {
  try {
    const userId = req.userId;
    const { start } = getDateRange(req);
    const where = scopeWhere(userId, start);

    const usageByDay = await db
      .select({
        day: sql<string>`DATE(${usageLogsTable.createdAt})`,
        tokens: sql<number>`sum(${usageLogsTable.totalTokens})`,
        promptTokens: sql<number>`sum(${usageLogsTable.promptTokens})`,
        completionTokens: sql<number>`sum(${usageLogsTable.completionTokens})`,
        messages: sql<number>`count(*)`,
        cost: sql<number>`sum(${usageLogsTable.cost})`,
        avgLatency: sql<number>`avg(${usageLogsTable.latencyMs})`,
      })
      .from(usageLogsTable)
      .where(where)
      .groupBy(sql`DATE(${usageLogsTable.createdAt})`)
      .orderBy(sql`day`);

    res.json({ usageByDay });
  } catch (err) {
    apiError(res, 500, "Failed to fetch daily usage");
  }
});

/**
 * GET /api/analytics/agents
 */
router.get("/analytics/agents", async (req, res) => {
  try {
    const userId = req.userId;
    const { start } = getDateRange(req);
    const where = scopeWhere(userId, start);

    const agentStats = await db
      .select({
        agentId: usageLogsTable.agentId,
        platform: usageLogsTable.platform,
        totalTokens: sql<number>`sum(${usageLogsTable.totalTokens})`,
        messageCount: sql<number>`count(*)`,
        cost: sql<number>`sum(${usageLogsTable.cost})`,
        avgLatency: sql<number>`avg(${usageLogsTable.latencyMs})`,
      })
      .from(usageLogsTable)
      .where(where)
      .groupBy(usageLogsTable.agentId, usageLogsTable.platform)
      .orderBy(desc(sql`sum(${usageLogsTable.totalTokens})`));

    res.json({ agentStats });
  } catch (err) {
    apiError(res, 500, "Failed to fetch agent stats");
  }
});

/**
 * GET /api/analytics/providers
 * Usage breakdown by provider.
 */
router.get("/analytics/providers", async (req, res) => {
  try {
    const userId = req.userId;
    const { start } = getDateRange(req);
    const where = scopeWhere(userId, start);

    const providerStats = await db
      .select({
        provider: usageLogsTable.provider,
        totalTokens: sql<number>`sum(${usageLogsTable.totalTokens})`,
        calls: sql<number>`count(*)`,
        cost: sql<number>`sum(${usageLogsTable.cost})`,
        avgLatency: sql<number>`avg(${usageLogsTable.latencyMs})`,
      })
      .from(usageLogsTable)
      .where(where)
      .groupBy(usageLogsTable.provider)
      .orderBy(desc(sql`sum(${usageLogsTable.totalTokens})`));

    res.json({ providerStats });
  } catch (err) {
    apiError(res, 500, "Failed to fetch provider stats");
  }
});

/**
 * GET /api/analytics/models
 * Usage breakdown by model.
 */
router.get("/analytics/models", async (req, res) => {
  try {
    const userId = req.userId;
    const { start } = getDateRange(req);
    const where = scopeWhere(userId, start);

    const modelStats = await db
      .select({
        model: usageLogsTable.model,
        provider: usageLogsTable.provider,
        totalTokens: sql<number>`sum(${usageLogsTable.totalTokens})`,
        calls: sql<number>`count(*)`,
        cost: sql<number>`sum(${usageLogsTable.cost})`,
        avgLatency: sql<number>`avg(${usageLogsTable.latencyMs})`,
      })
      .from(usageLogsTable)
      .where(where)
      .groupBy(usageLogsTable.model, usageLogsTable.provider)
      .orderBy(desc(sql`sum(${usageLogsTable.totalTokens})`));

    res.json({ modelStats });
  } catch (err) {
    apiError(res, 500, "Failed to fetch model stats");
  }
});

/**
 * GET /api/analytics/cost-trend
 * Daily cost for cost chart.
 */
router.get("/analytics/cost-trend", async (req, res) => {
  try {
    const userId = req.userId;
    const { start } = getDateRange(req);
    const where = scopeWhere(userId, start);

    const costByDay = await db
      .select({
        day: sql<string>`DATE(${usageLogsTable.createdAt})`,
        cost: sql<number>`sum(${usageLogsTable.cost})`,
      })
      .from(usageLogsTable)
      .where(where)
      .groupBy(sql`DATE(${usageLogsTable.createdAt})`)
      .orderBy(sql`day`);

    res.json({ costByDay });
  } catch (err) {
    apiError(res, 500, "Failed to fetch cost trend");
  }
});

/**
 * GET /api/analytics/recent-logs
 * Recent usage logs with details.
 */
router.get("/analytics/recent-logs", async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const where =
      userId && userId !== "default" && userId !== "dev-user"
        ? eq(usageLogsTable.userId, userId)
        : undefined;

    const logs = await db
      .select()
      .from(usageLogsTable)
      .where(where)
      .orderBy(desc(usageLogsTable.createdAt))
      .limit(limit);

    res.json({ logs });
  } catch (err) {
    apiError(res, 500, "Failed to fetch recent logs");
  }
});

export default router;
