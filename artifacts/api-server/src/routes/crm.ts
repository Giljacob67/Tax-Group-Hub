import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { crmContactsTable, crmDealsTable, crmActivitiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/crm/contacts - Listagem
router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const contacts = await db
      .select()
      .from(crmContactsTable)
      .where(eq(crmContactsTable.userId, req.userId || "system"));
    res.json({ success: true, contacts });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list contacts", message: err.message });
  }
});

// POST /api/crm/contacts - Criar Contato
router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const [newContact] = await db
      .insert(crmContactsTable)
      .values({
        ...data,
        userId: req.userId || "system",
      })
      .returning();
    res.status(201).json({ success: true, contact: newContact });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create contact", message: err.message });
  }
});

// GET /api/crm/deals/pipeline - Kanban view
router.get("/deals/pipeline", async (req: Request, res: Response) => {
  try {
    const deals = await db
      .select()
      .from(crmDealsTable)
      .where(eq(crmDealsTable.userId, req.userId || "system"));

    // Grouping
    const pipeline = {
      prospecting: deals.filter((d) => d.stage === "prospecting"),
      discovery: deals.filter((d) => d.stage === "discovery"),
      proposal: deals.filter((d) => d.stage === "proposal"),
      negotiation: deals.filter((d) => d.stage === "negotiation"),
      closing: deals.filter((d) => d.stage === "closing"),
      won: deals.filter((d) => d.stage === "won"),
      lost: deals.filter((d) => d.stage === "lost"),
    };

    res.json({ success: true, pipeline });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch pipeline", message: err.message });
  }
});

export default router;
