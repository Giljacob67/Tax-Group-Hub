import { Router, type IRouter } from "express";
import { db, usageLogsTable, conversationsTable, messagesTable } from "@workspace/db";
import { eq, sql, gte, and, desc } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /api/analytics/overview
 * High-level summary cards.
 */
router.get("/analytics/overview", async (req, res) => {
  try {
    const userId = req.userId;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const whereClause = userId && userId !== "default" && userId !== "dev-user" 
       ? and(eq(usageLogsTable.userId, userId), gte(usageLogsTable.createdAt, thirtyDaysAgo))
       : gte(usageLogsTable.createdAt, thirtyDaysAgo);

    // 1. Total Tokens
    const [tokenResult] = await db
      .select({ total: sql<number>`sum(${usageLogsTable.totalTokens})` })
      .from(usageLogsTable)
      .where(whereClause);

    // 2. Total Messages
    const [msgCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usageLogsTable)
      .where(whereClause);

    // 3. Active Agents
    const [agentCount] = await db
      .select({ count: sql<number>`count(distinct ${usageLogsTable.agentId})` })
      .from(usageLogsTable)
      .where(whereClause);

    res.json({
      totalTokens: Number(tokenResult?.total || 0),
      messageCount: Number(msgCount?.count || 0),
      activeAgents: Number(agentCount?.count || 0),
      period: "last_30_days"
    });
  } catch (err) {
    console.error("[Analytics] Error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

/**
 * GET /api/analytics/daily-usage
 * Data for trend charts.
 */
router.get("/analytics/daily-usage", async (req, res) => {
  try {
    const userId = req.userId;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const whereClause = userId && userId !== "default" && userId !== "dev-user"
      ? and(eq(usageLogsTable.userId, userId), gte(usageLogsTable.createdAt, sevenDaysAgo))
      : gte(usageLogsTable.createdAt, sevenDaysAgo);

    const usageByDay = await db
      .select({
        day: sql<string>`DATE(${usageLogsTable.createdAt})`,
        tokens: sql<number>`sum(${usageLogsTable.totalTokens})`,
        messages: sql<number>`count(*)`
      })
      .from(usageLogsTable)
      .where(whereClause)
      .groupBy(sql`DATE(${usageLogsTable.createdAt})`)
      .orderBy(sql`day`);

    res.json({ usageByDay });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily usage" });
  }
});

/**
 * GET /api/analytics/agents
 * Ranking of agent usage.
 */
router.get("/analytics/agents", async (req, res) => {
  try {
    const userId = req.userId;
    const whereClause = userId && userId !== "default" && userId !== "dev-user"
      ? eq(usageLogsTable.userId, userId)
      : undefined;

    const agentStats = await db
      .select({
        agentId: usageLogsTable.agentId,
        platform: usageLogsTable.platform,
        totalTokens: sql<number>`sum(${usageLogsTable.totalTokens})`,
        messageCount: sql<number>`count(*)`
      })
      .from(usageLogsTable)
      .where(whereClause)
      .groupBy(usageLogsTable.agentId, usageLogsTable.platform)
      .orderBy(desc(sql`sum(${usageLogsTable.totalTokens})`));

    res.json({ agentStats });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch agent stats" });
  }
});

export default router;
