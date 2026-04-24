import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  crmContactsTable, crmDealsTable, crmActivitiesTable,
  crmEnrichmentLogTable, crmPipelinesTable, crmAttachmentsTable,
  crmTasksTable, crmSavedViewsTable, crmAutomationsTable,
} from "@workspace/db";
import { eq, and, desc, asc, ilike, or, gte, lte, inArray, sql } from "drizzle-orm";
import { EmpresAquiClient, mapEmpresAquiToContact } from "@workspace/empresaqui";
import { callLLM } from "../lib/llm-client.js";
import { getAgentById } from "../lib/agents-data.js";

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────
async function getEmpresAquiToken(): Promise<string | null> {
  return process.env.EMPRESAQUI_API_KEY || null;
}

// ─── Automation Engine ────────────────────────────────────────────────────────
async function evaluateAutomations(userId: string, contactId: number, triggerType: string, currentValue: any) {
  try {
    // Busca automações ativas do usuário para este gatilho
    const automations = await db.select().from(crmAutomationsTable)
      .where(and(
        eq(crmAutomationsTable.userId, userId),
        eq(crmAutomationsTable.isActive, true),
        eq(crmAutomationsTable.triggerType, triggerType)
      ));

    for (const auto of automations) {
      let shouldTrigger = false;

      // Avalia a condição
      if (triggerType === "status_changed" && auto.triggerValue === currentValue) {
        shouldTrigger = true;
      } else if (triggerType === "score_above" && typeof currentValue === "number" && currentValue >= Number(auto.triggerValue)) {
        shouldTrigger = true;
      } else if (triggerType === "score_below" && typeof currentValue === "number" && currentValue <= Number(auto.triggerValue)) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        // Executa a ação
        if (auto.actionType === "create_task" && auto.actionPayload) {
          const payload = auto.actionPayload as any;
          await db.insert(crmTasksTable).values({
            userId,
            contactId,
            title: payload.title || `Tarefa Automática: ${auto.name}`,
            type: payload.type || "call",
            priority: payload.priority || "high",
            status: "pending",
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +1 dia
          });
        } else if (auto.actionType === "log_activity") {
          await db.insert(crmActivitiesTable).values({
            userId,
            contactId,
            type: "ai_generated",
            subject: "Ação Automática Executada",
            content: `A automação '${auto.name}' foi disparada (Gatilho: ${triggerType} = ${currentValue}).`,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error evaluating automations:", error);
  }
}

// ─── Contacts: List ───────────────────────────────────────────────────────────
// GET /api/crm/contacts?search=&status=&regime=&porte=&uf=&scoreMin=&scoreMax=&sort=&sortDir=&tag=
router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { search, status, regime, porte, uf, scoreMin, scoreMax, sort, sortDir, tag } =
      req.query as Record<string, string>;

    const conditions: any[] = [eq(crmContactsTable.userId, userId)];

    if (search) {
      conditions.push(
        or(
          ilike(crmContactsTable.razaoSocial, `%${search}%`),
          ilike(crmContactsTable.cnpj, `%${search}%`),
          ilike(crmContactsTable.nomeFantasia, `%${search}%`)
        )
      );
    }
    if (status)   conditions.push(eq(crmContactsTable.status, status));
    if (regime)   conditions.push(eq(crmContactsTable.regimeTributario, regime));
    if (porte)    conditions.push(eq(crmContactsTable.porte, porte));
    if (uf)       conditions.push(ilike(crmContactsTable.uf, `%${uf}%`));
    if (scoreMin) conditions.push(gte(crmContactsTable.aiScore, Number(scoreMin)));
    if (scoreMax) conditions.push(lte(crmContactsTable.aiScore, Number(scoreMax)));
    
    // Filtro por tag (lista)
    if (tag) {
      const sqlFrag = sql`${crmContactsTable.tags} @> ${JSON.stringify([tag])}::jsonb`;
      conditions.push(sqlFrag);
    }

    const isAsc = sortDir !== "desc";
    let orderByCol: any = desc(crmContactsTable.createdAt); // default
    if (sort === "razaoSocial") orderByCol = isAsc ? asc(crmContactsTable.razaoSocial)  : desc(crmContactsTable.razaoSocial);
    else if (sort === "aiScore")    orderByCol = isAsc ? asc(crmContactsTable.aiScore)      : desc(crmContactsTable.aiScore);
    else if (sort === "status")     orderByCol = isAsc ? asc(crmContactsTable.status)       : desc(crmContactsTable.status);
    else if (sort === "createdAt")  orderByCol = isAsc ? asc(crmContactsTable.createdAt)    : desc(crmContactsTable.createdAt);

    const contacts = await db
      .select()
      .from(crmContactsTable)
      .where(and(...conditions))
      .orderBy(orderByCol);

    res.json({ success: true, contacts, total: contacts.length });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list contacts", message: err.message });
  }
});

// ─── Contacts: Get by ID ──────────────────────────────────────────────────────
router.get("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [contact] = await db
      .select()
      .from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
    res.json({ success: true, contact });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get contact", message: err.message });
  }
});

// ─── Contacts: Create ─────────────────────────────────────────────────────────
router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const data = req.body;
    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      res.status(400).json({ error: "CNPJ inválido. Informe 14 dígitos." });
      return;
    }
    const [existing] = await db
      .select()
      .from(crmContactsTable)
      .where(and(eq(crmContactsTable.cnpj, cleanCnpj), eq(crmContactsTable.userId, userId)));
    if (existing) {
      res.status(409).json({ error: "Este CNPJ já está cadastrado.", contact: existing });
      return;
    }

    let enrichedFields: any = {};
    let enrichSource = "manual";
    const token = await getEmpresAquiToken();
    if (token) {
      try {
        const client = new EmpresAquiClient(token);
        const empresaData = await client.getCompanyByCNPJ(cleanCnpj);
        enrichedFields = mapEmpresAquiToContact(empresaData);
        enrichSource = "empresaqui";
      } catch (enrichErr: any) {
        console.warn("[crm] EmpresAqui enrich failed:", enrichErr.message);
      }
    }

    const [newContact] = await db
      .insert(crmContactsTable)
      .values({ ...enrichedFields, ...data, cnpj: cleanCnpj, userId, source: enrichSource, lastEnrichedAt: enrichSource === "empresaqui" ? new Date() : null })
      .returning();

    if (enrichSource === "empresaqui" && Object.keys(enrichedFields).length > 0) {
      await db.insert(crmEnrichmentLogTable).values({
        contactId: newContact.id, source: "empresaqui", rawData: enrichedFields, fieldsUpdated: Object.keys(enrichedFields),
      }).catch(() => {});
    }

    res.status(201).json({ success: true, contact: newContact, enriched: enrichSource === "empresaqui" });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create contact", message: err.message });
  }
});

// ─── Contacts: Update ─────────────────────────────────────────────────────────
router.put("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    
    // Check if status changed for automation
    const [oldContact] = await db.select({ status: crmContactsTable.status }).from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));

    const [updated] = await db
      .update(crmContactsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)))
      .returning();
    
    if (!updated) { res.status(404).json({ error: "Contact not found" }); return; }

    // Trigger automations if status changed
    if (oldContact && req.body.status && oldContact.status !== req.body.status) {
      await evaluateAutomations(userId, updated.id, "status_changed", updated.status);
    }

    res.json({ success: true, contact: updated });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update contact", message: err.message });
  }
});

// ─── Contacts: Delete ─────────────────────────────────────────────────────────
router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    await db.delete(crmContactsTable).where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete contact", message: err.message });
  }
});

// ─── Contacts: Bulk Delete ────────────────────────────────────────────────────
// POST /api/crm/contacts/bulk-delete  body: { ids: number[] }
router.post("/contacts/bulk-delete", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids deve ser um array não vazio." });
      return;
    }
    await db.delete(crmContactsTable)
      .where(and(inArray(crmContactsTable.id, ids), eq(crmContactsTable.userId, userId)));
    res.json({ success: true, deleted: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: "Bulk delete failed", message: err.message });
  }
});

// ─── Contacts: Bulk Status Update ────────────────────────────────────────────
// POST /api/crm/contacts/bulk-update-status  body: { ids: number[], status: string }
router.post("/contacts/bulk-update-status", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { ids, status } = req.body as { ids: number[]; status: string };
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      res.status(400).json({ error: "ids e status são obrigatórios." });
      return;
    }
    await db.update(crmContactsTable)
      .set({ status, updatedAt: new Date() })
      .where(and(inArray(crmContactsTable.id, ids), eq(crmContactsTable.userId, userId)));
    
    // Trigger automations for all updated contacts
    for (const id of ids) {
      await evaluateAutomations(userId, id, "status_changed", status);
    }

    res.json({ success: true, updated: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: "Bulk update failed", message: err.message });
  }
});

// ─── Contacts: Bulk Tags ──────────────────────────────────────────────────────
// POST /api/crm/contacts/bulk-tags  body: { ids: number[], tag: string, action: "add" | "remove" }
router.post("/contacts/bulk-tags", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { ids, tag, action } = req.body as { ids: number[]; tag: string; action: "add" | "remove" };
    if (!Array.isArray(ids) || ids.length === 0 || !tag) {
      res.status(400).json({ error: "ids e tag são obrigatórios." }); return;
    }

    const contactsToUpdate = await db.select({ id: crmContactsTable.id, tags: crmContactsTable.tags })
      .from(crmContactsTable)
      .where(and(inArray(crmContactsTable.id, ids), eq(crmContactsTable.userId, userId)));

    for (const c of contactsToUpdate) {
      let currentTags = c.tags || [];
      if (action === "add" && !currentTags.includes(tag)) {
        currentTags = [...currentTags, tag];
      } else if (action === "remove") {
        currentTags = currentTags.filter(t => t !== tag);
      }
      await db.update(crmContactsTable).set({ tags: currentTags }).where(eq(crmContactsTable.id, c.id));
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Bulk tags update failed", message: err.message });
  }
});

// ─── Contacts: Get Tags (Lists) ───────────────────────────────────────────────
router.get("/tags", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const result = await db.execute(sql`
      SELECT DISTINCT unnest(tags) as tag 
      FROM ${crmContactsTable} 
      WHERE user_id = ${userId} AND tags IS NOT NULL
    `);
    const tags = result.rows.map((r: any) => r.tag).sort();
    res.json({ success: true, tags });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch tags", message: err.message });
  }
});

// ─── Contacts: Enrich via EmpresAqui ─────────────────────────────────────────
router.post("/contacts/:id/enrich", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    const token = await getEmpresAquiToken();
    if (!token) { res.status(503).json({ error: "EmpresAqui token not configured." }); return; }

    const client = new EmpresAquiClient(token);
    const empresaData = await client.getCompanyByCNPJ(contact.cnpj);
    const mapped = mapEmpresAquiToContact(empresaData);

    const [updated] = await db.update(crmContactsTable)
      .set({ ...mapped, source: "empresaqui", lastEnrichedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmContactsTable.id, contact.id))
      .returning();

    await db.insert(crmEnrichmentLogTable).values({
      contactId: contact.id, source: "empresaqui", rawData: empresaData as any, fieldsUpdated: Object.keys(mapped),
    }).catch(() => {});

    res.json({ success: true, contact: updated, fieldsUpdated: Object.keys(mapped) });
  } catch (err: any) {
    res.status(500).json({ error: "Enrichment failed", message: err.message });
  }
});

// ─── Contacts: Import batch de CNPJs ─────────────────────────────────────────
router.post("/contacts/import", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { cnpjs } = req.body as { cnpjs: string[] };
    if (!Array.isArray(cnpjs) || cnpjs.length === 0) {
      res.status(400).json({ error: "Informe um array de CNPJs em 'cnpjs'." });
      return;
    }
    if (cnpjs.length > 50) { res.status(400).json({ error: "Máximo de 50 CNPJs por lote." }); return; }

    const token = await getEmpresAquiToken();
    const results: { cnpj: string; status: string; contactId?: number }[] = [];

    for (const rawCnpj of cnpjs) {
      const cnpj = rawCnpj.replace(/\D/g, "");
      try {
        const [existing] = await db.select({ id: crmContactsTable.id }).from(crmContactsTable)
          .where(and(eq(crmContactsTable.cnpj, cnpj), eq(crmContactsTable.userId, userId)));
        if (existing) { results.push({ cnpj, status: "duplicate", contactId: existing.id }); continue; }

        let enrichedFields: any = {};
        if (token) {
          try {
            const client = new EmpresAquiClient(token);
            const data = await client.getCompanyByCNPJ(cnpj);
            enrichedFields = mapEmpresAquiToContact(data);
          } catch { /* skip */ }
        }

        const [newContact] = await db.insert(crmContactsTable)
          .values({ ...enrichedFields, cnpj, userId, source: token ? "empresaqui" : "import", lastEnrichedAt: token ? new Date() : null })
          .returning();
        results.push({ cnpj, status: "created", contactId: newContact.id });
      } catch {
        results.push({ cnpj, status: "error" });
      }
    }

    res.json({ success: true, results, summary: {
      created: results.filter(r => r.status === "created").length,
      duplicates: results.filter(r => r.status === "duplicate").length,
      errors: results.filter(r => r.status === "error").length,
    }});
  } catch (err: any) {
    res.status(500).json({ error: "Import failed", message: err.message });
  }
});

// ─── Contacts: Qualify via IA ────────────────────────────────────────────────
router.post("/contacts/:id/qualify", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    const agent = getAgentById("qualificacao-leads-tax-group") || getAgentById("coordenador-geral-tax-group");
    if (!agent) { res.status(500).json({ error: "Qualification agent not found" }); return; }

    const input = `
Qualifique este lead da Tax Group com base nas informações:
- CNPJ: ${contact.cnpj}
- Razão Social: ${contact.razaoSocial || "Desconhecida"}
- Regime Tributário: ${contact.regimeTributario || "Desconhecido"}
- CNAE: ${contact.cnae || "Desconhecido"}
- Porte: ${contact.porte || "Desconhecido"}
- Faturamento Estimado: ${contact.faturamentoEstimado || "Desconhecido"}
- UF: ${contact.uf || "Desconhecida"}

Retorne um JSON com: { score: 0-100, tier: "A"|"B"|"C"|"D", products: ["AFD","REP","RTI",...], reasoning: "...", nextAction: "..." }`;

    const result = await callLLM(agent.systemPrompt, input, {});
    let scoreData: any = {};
    try {
      const match = result.output.match(/\{[\s\S]*\}/);
      if (match) scoreData = JSON.parse(match[0]);
    } catch { scoreData = { score: 50, tier: "C", reasoning: result.output }; }

    const [updated] = await db.update(crmContactsTable)
      .set({
        aiScore: scoreData.score || null,
        aiScoreDetails: scoreData,
        aiRecommendedProduct: scoreData.products?.[0] || null,
        status: scoreData.tier === "A" || scoreData.tier === "B" ? "qualified" : contact.status,
        updatedAt: new Date(),
      })
      .where(eq(crmContactsTable.id, contact.id))
      .returning();

    // Trigger score automations
    if (updated.aiScore !== null) {
      // triggers > X
      await evaluateAutomations(userId, updated.id, "score_above", updated.aiScore);
      // triggers < X
      await evaluateAutomations(userId, updated.id, "score_below", updated.aiScore);
    }
    // Also trigger status if changed
    if (updated.status !== contact.status) {
      await evaluateAutomations(userId, updated.id, "status_changed", updated.status);
    }

    await db.insert(crmActivitiesTable).values({
      contactId: contact.id, userId, type: "ai_generated",
      subject: `Qualificação IA — Score ${scoreData.score}/100 (Tier ${scoreData.tier})`,
      content: result.output, completedAt: new Date(), agentId: agent.id,
    }).catch(() => {});

    let dealCreated = false;
    if (["A", "B", "C"].includes(scoreData.tier)) {
      const [existingDeal] = await db.select({ id: crmDealsTable.id }).from(crmDealsTable)
        .where(and(eq(crmDealsTable.contactId, contact.id), eq(crmDealsTable.userId, userId)));
      if (!existingDeal) {
        const stage = scoreData.tier === "A" ? "discovery" : "prospecting";
        const probability = scoreData.tier === "A" ? 40 : (scoreData.tier === "B" ? 20 : 10);
        await db.insert(crmDealsTable).values({
          contactId: contact.id, userId,
          title: `Oportunidade - ${contact.razaoSocial || contact.cnpj}`,
          value: "50000", stage, probability,
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }).catch(() => {});
        dealCreated = true;
      }
    }

    res.json({ success: true, contact: updated, qualification: scoreData, dealCreated });
  } catch (err: any) {
    res.status(500).json({ error: "Qualification failed", message: err.message });
  }
});

// ─── Deals: Pipeline Kanban ───────────────────────────────────────────────────
// GET /api/crm/deals/pipeline — inclui razaoSocial e cnpj do contato via LEFT JOIN
router.get("/deals/pipeline", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const pipelineIdParam = (req.query.pipelineId as string) || "default";

    let [pipelineMeta] = await db
      .select({ id: crmPipelinesTable.id, name: crmPipelinesTable.name, stages: crmPipelinesTable.stages })
      .from(crmPipelinesTable)
      .where(and(
        eq(crmPipelinesTable.userId, userId),
        eq(crmPipelinesTable.id, pipelineIdParam === "default" ? 0 : Number(pipelineIdParam))
      ))
      .limit(1);

    if (!pipelineMeta && pipelineIdParam === "default") {
      pipelineMeta = {
        id: 0,
        name: "Funil Comercial (Padrão)",
        stages: ["prospecting", "discovery", "proposal", "negotiation", "closing", "won", "lost"],
      };
    }

    const stages = pipelineMeta?.stages || ["prospecting", "discovery", "won", "lost"];

    // LEFT JOIN com contacts para ter razaoSocial e cnpj em cada deal
    const deals = await db
      .select({
        id:               crmDealsTable.id,
        contactId:        crmDealsTable.contactId,
        userId:           crmDealsTable.userId,
        pipelineId:       crmDealsTable.pipelineId,
        title:            crmDealsTable.title,
        produto:          crmDealsTable.produto,
        stage:            crmDealsTable.stage,
        value:            crmDealsTable.value,
        probability:      crmDealsTable.probability,
        expectedCloseDate:crmDealsTable.expectedCloseDate,
        notes:            crmDealsTable.notes,
        wonAt:            crmDealsTable.wonAt,
        lostAt:           crmDealsTable.lostAt,
        createdAt:        crmDealsTable.createdAt,
        updatedAt:        crmDealsTable.updatedAt,
        razaoSocial:      crmContactsTable.razaoSocial,
        cnpj:             crmContactsTable.cnpj,
      })
      .from(crmDealsTable)
      .leftJoin(crmContactsTable, eq(crmDealsTable.contactId, crmContactsTable.id))
      .where(and(eq(crmDealsTable.userId, userId), eq(crmDealsTable.pipelineId, pipelineIdParam)))
      .orderBy(desc(crmDealsTable.updatedAt));

    const pipeline: Record<string, any[]> = {};
    for (const s of stages) pipeline[s] = deals.filter((d: typeof deals[number]) => d.stage === s);

    const totalValue = deals
      .filter((d: typeof deals[number]) => !["lost"].includes(d.stage))
      .reduce((sum: number, d: typeof deals[number]) => sum + (parseFloat(d.value || "0") || 0), 0);

    res.json({ success: true, pipeline, stages, meta: pipelineMeta, stats: { total: deals.length, totalValue } });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch pipeline", message: err.message });
  }
});

// ─── Deals: CRUD ─────────────────────────────────────────────────────────────
router.get("/deals", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { stage, contactId } = req.query as Record<string, string>;
    const conditions: any[] = [eq(crmDealsTable.userId, userId)];
    if (stage) conditions.push(eq(crmDealsTable.stage, stage));
    if (contactId) conditions.push(eq(crmDealsTable.contactId, Number(contactId)));
    const deals = await db.select().from(crmDealsTable).where(and(...conditions)).orderBy(desc(crmDealsTable.updatedAt));
    res.json({ success: true, deals });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list deals", message: err.message });
  }
});

router.post("/deals", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [deal] = await db.insert(crmDealsTable).values({ ...req.body, userId }).returning();
    res.status(201).json({ success: true, deal });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create deal", message: err.message });
  }
});

router.put("/deals/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [oldDeal] = await db.select().from(crmDealsTable)
      .where(and(eq(crmDealsTable.id, Number(req.params.id)), eq(crmDealsTable.userId, userId)));
    if (!oldDeal) { res.status(404).json({ error: "Deal not found" }); return; }

    const body = req.body;
    if (body.stage && body.stage !== oldDeal.stage) {
      if (body.stage === "won" && !body.wonAt) body.wonAt = new Date();
      if (body.stage === "lost" && !body.lostAt) body.lostAt = new Date();
    }

    const [deal] = await db.update(crmDealsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(crmDealsTable.id, oldDeal.id))
      .returning();

    if (body.stage && body.stage !== oldDeal.stage) {
      try {
        const agnt = getAgentById("prospeccao-tax-group");
        let automationNote = "Avançou de etapa internamente.";
        if (body.stage === "won") automationNote = "Contrato e Setup Operacional prontos para envio. Disparar onboarding.";
        else if (body.stage === "proposal") automationNote = "Gerar e enviar Carta de Apresentação e PDF analítico tributário usando a Base de Conhecimento.";

        await db.insert(crmActivitiesTable).values({
          contactId: deal.contactId, dealId: deal.id, userId,
          type: "stage_change",
          subject: `Etapa movida para: ${body.stage.toUpperCase()}`,
          content: `Automação Acionada: ${automationNote}`,
          agentId: agnt ? agnt.id : null,
          completedAt: new Date(),
        }).catch(() => {});
      } catch { /* non-fatal */ }
    }

    res.json({ success: true, deal });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update deal", message: err.message });
  }
});

router.delete("/deals/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    await db.delete(crmDealsTable).where(and(eq(crmDealsTable.id, Number(req.params.id)), eq(crmDealsTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete deal", message: err.message });
  }
});

// ─── Activities ───────────────────────────────────────────────────────────────
router.get("/contacts/:id/activities", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const activities = await db.select().from(crmActivitiesTable)
      .where(and(eq(crmActivitiesTable.contactId, Number(req.params.id)), eq(crmActivitiesTable.userId, userId)))
      .orderBy(desc(crmActivitiesTable.createdAt));
    res.json({ success: true, activities });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list activities", message: err.message });
  }
});

router.post("/contacts/:id/activities", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [activity] = await db.insert(crmActivitiesTable)
      .values({ ...req.body, contactId: Number(req.params.id), userId })
      .returning();
    res.status(201).json({ success: true, activity });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create activity", message: err.message });
  }
});

// ─── Attachments ──────────────────────────────────────────────────────────────
router.get("/contacts/:id/attachments", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const attachments = await db.select().from(crmAttachmentsTable)
      .where(and(eq(crmAttachmentsTable.contactId, Number(req.params.id)), eq(crmAttachmentsTable.userId, userId)))
      .orderBy(desc(crmAttachmentsTable.createdAt));
    res.json({ success: true, attachments });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list attachments", message: err.message });
  }
});

router.post("/contacts/:id/attachments", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const contactId = Number(req.params.id);
    const [contact] = await db.select({ id: crmContactsTable.id }).from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, contactId), eq(crmContactsTable.userId, userId)));
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    const { fileName, fileSize, mimeType, url, dealId } = req.body;
    if (!fileName || !mimeType || !url) {
      res.status(400).json({ error: "fileName, mimeType e url são obrigatórios." });
      return;
    }

    const [attachment] = await db.insert(crmAttachmentsTable)
      .values({ userId, contactId, dealId: dealId ? Number(dealId) : null, fileName, fileSize, mimeType, url, uploadedBy: userId })
      .returning();

    await db.insert(crmActivitiesTable).values({
      contactId, dealId: dealId ? Number(dealId) : null, userId,
      type: "note", subject: `Arquivo anexado: ${fileName}`,
      content: `Arquivo ${mimeType} (${fileSize ? `${Math.round(fileSize / 1024)} KB` : "tamanho desconhecido"}) adicionado.`,
      completedAt: new Date(),
    }).catch(() => {});

    res.status(201).json({ success: true, attachment });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create attachment", message: err.message });
  }
});

router.delete("/contacts/:contactId/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    await db.delete(crmAttachmentsTable).where(and(
      eq(crmAttachmentsTable.id, Number(req.params.attachmentId)),
      eq(crmAttachmentsTable.contactId, Number(req.params.contactId)),
      eq(crmAttachmentsTable.userId, userId)
    ));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete attachment", message: err.message });
  }
});

// ─── Tasks: CRUD ──────────────────────────────────────────────────────────────
// GET  /api/crm/tasks?contactId=&status=&priority=&dueToday=
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { contactId, status, priority, dueToday } = req.query as Record<string, string>;
    const conditions: any[] = [eq(crmTasksTable.userId, userId)];
    if (contactId) conditions.push(eq(crmTasksTable.contactId, Number(contactId)));
    if (status)    conditions.push(eq(crmTasksTable.status, status));
    if (priority)  conditions.push(eq(crmTasksTable.priority, priority));
    if (dueToday === "true") {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
      conditions.push(gte(crmTasksTable.dueDate, todayStart));
      conditions.push(lte(crmTasksTable.dueDate, todayEnd));
    }
    const tasks = await db.select().from(crmTasksTable)
      .where(and(...conditions))
      .orderBy(asc(crmTasksTable.dueDate));
    res.json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list tasks", message: err.message });
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [task] = await db.insert(crmTasksTable)
      .values({ ...req.body, userId })
      .returning();
    res.status(201).json({ success: true, task });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create task", message: err.message });
  }
});

router.put("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const body = req.body;
    if (body.status === "done" && !body.completedAt) body.completedAt = new Date();
    const [task] = await db.update(crmTasksTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(crmTasksTable.id, Number(req.params.id)), eq(crmTasksTable.userId, userId)))
      .returning();
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update task", message: err.message });
  }
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    await db.delete(crmTasksTable)
      .where(and(eq(crmTasksTable.id, Number(req.params.id)), eq(crmTasksTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete task", message: err.message });
  }
});

// ─── Activities: Global (Timeline Global) ───────────────────────────────────────
router.get("/activities", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    
    // Join with contacts to get company name
    const activities = await db.select({
      activity: crmActivitiesTable,
      contact: {
        razaoSocial: crmContactsTable.razaoSocial,
        cnpj: crmContactsTable.cnpj,
      }
    })
    .from(crmActivitiesTable)
    .innerJoin(crmContactsTable, eq(crmActivitiesTable.contactId, crmContactsTable.id))
    .where(eq(crmActivitiesTable.userId, userId))
    .orderBy(desc(crmActivitiesTable.createdAt))
    .limit(100);

    // Format the response to be a flat array for easier UI rendering
    const formatted = activities.map(row => ({
      ...row.activity,
      contactName: row.contact.razaoSocial || "—",
      contactCnpj: row.contact.cnpj
    }));

    res.json({ success: true, activities: formatted });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch global activities", message: err.message });
  }
});

// ─── Saved Views: CRUD ────────────────────────────────────────────────────────
router.get("/views", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const views = await db.select().from(crmSavedViewsTable)
      .where(eq(crmSavedViewsTable.userId, userId))
      .orderBy(asc(crmSavedViewsTable.createdAt));
    res.json({ success: true, views });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list views", message: err.message });
  }
});

router.post("/views", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [view] = await db.insert(crmSavedViewsTable)
      .values({ ...req.body, userId })
      .returning();
    res.status(201).json({ success: true, view });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create view", message: err.message });
  }
});

router.delete("/views/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    await db.delete(crmSavedViewsTable)
      .where(and(eq(crmSavedViewsTable.id, Number(req.params.id)), eq(crmSavedViewsTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete view", message: err.message });
  }
});

// ─── Analytics: Overview KPIs ────────────────────────────────────────────────
// GET /api/crm/analytics/overview?period=
router.get("/analytics/overview", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const period = (req.query.period as string) || "this_month";

    const [contacts, deals, activities] = await Promise.all([
      db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
      db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
      db.select().from(crmActivitiesTable).where(eq(crmActivitiesTable.userId, userId)),
    ]);

    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date();

    switch (period) {
      case "7d": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7); break;
      case "30d": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30); break;
      case "90d": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90); break;
      case "this_month": startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "all": default: startDate = new Date(0); break;
    }

    // Filter by period
    const newLeadsInPeriod = contacts.filter(c => {
      const d = new Date(c.createdAt);
      return d >= startDate && d <= endDate;
    }).length;

    // Last period calculation for growth
    const periodDurationMs = endDate.getTime() - startDate.getTime();
    const lastPeriodStart = new Date(startDate.getTime() - periodDurationMs);
    const lastPeriodEnd = new Date(startDate.getTime());
    const newLeadsLastPeriod = contacts.filter(c => {
      const d = new Date(c.createdAt);
      return d >= lastPeriodStart && d < lastPeriodEnd;
    }).length;

    const activeDeals = deals.filter(d => !["lost"].includes(d.stage));
    const wonDeals = deals.filter(d => d.stage === "won");
    const wonInPeriod = wonDeals.filter(d => d.wonAt && new Date(d.wonAt) >= startDate && new Date(d.wonAt) <= endDate);

    const pipelineValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
    const weightedValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0) * ((d.probability || 0) / 100), 0);
    const wonValue = wonDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
    const wonValueInPeriod = wonInPeriod.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);

    const qualifiedCount = contacts.filter(c => ["qualified", "opportunity", "client"].includes(c.status)).length;
    const qualificationRate = contacts.length > 0 ? Math.round((qualifiedCount / contacts.length) * 100) : 0;

    const winRate = (deals.length > 0)
      ? Math.round((wonDeals.length / Math.max(1, wonDeals.length + deals.filter(d => d.stage === "lost").length)) * 100)
      : 0;

    const periodActivities = activities.filter(a => {
      const d = new Date(a.createdAt);
      return d >= startDate && d <= endDate;
    });

    const activitiesByType: Record<string, number> = {};
    for (const a of periodActivities) {
      const t = a.type || "note";
      activitiesByType[t] = (activitiesByType[t] || 0) + 1;
    }

    // Status distribution (all time)
    const statusDist: Record<string, number> = {};
    for (const c of contacts) {
      statusDist[c.status] = (statusDist[c.status] || 0) + 1;
    }

    // Regime distribution (all time)
    const regimeDist: Record<string, number> = {};
    for (const c of contacts) {
      const regime = c.regimeTributario || "desconhecido";
      regimeDist[regime] = (regimeDist[regime] || 0) + 1;
    }

    // New leads last 8 weeks
    const weeklyLeads: { week: string; leads: number; deals: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      weeklyLeads.push({
        week: weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        leads: contacts.filter(c => {
          const d = new Date(c.createdAt);
          return d >= weekStart && d < weekEnd;
        }).length,
        deals: deals.filter(d => {
          const created = new Date(d.createdAt);
          return created >= weekStart && created < weekEnd;
        }).length,
      });
    }

    res.json({
      success: true,
      kpis: {
        totalContacts: contacts.length,
        newLeadsInPeriod,
        newLeadsLastPeriod,
        leadsGrowth: newLeadsLastPeriod > 0
          ? Math.round(((newLeadsInPeriod - newLeadsLastPeriod) / newLeadsLastPeriod) * 100)
          : null,
        pipelineValue,
        weightedValue,
        wonValue,
        wonValueInPeriod,
        qualificationRate,
        winRate,
        activeDeals: activeDeals.length,
        activitiesInPeriod: periodActivities.length,
      },
      activitiesByType,
      statusDist,
      regimeDist,
      weeklyLeads,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Analytics overview failed", message: err.message });
  }
});

// ─── Analytics: Pipeline Funnel ───────────────────────────────────────────────
// ─── Analytics: Pipeline Funnel ───────────────────────────────────────────────
// GET /api/crm/analytics/funnel?period=
router.get("/analytics/funnel", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const period = (req.query.period as string) || "all";

    let deals = await db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId));

    if (period !== "all") {
      const now = new Date();
      let startDate = new Date(0);
      let endDate = new Date();
      switch (period) {
        case "7d": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7); break;
        case "30d": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30); break;
        case "90d": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90); break;
        case "this_month": startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      }
      deals = deals.filter(d => {
        const dDate = new Date(d.createdAt);
        return dDate >= startDate && dDate <= endDate;
      });
    }

    const stageOrder = ["prospecting", "discovery", "proposal", "negotiation", "closing", "won", "lost"];
    const funnel = stageOrder.map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage);
      const value = stageDeals.reduce((s, d) => s + (parseFloat(d.value || "0") || 0), 0);
      return { stage, count: stageDeals.length, value };
    });

    // Average days per stage (from updatedAt - createdAt approximation)
    // More accurate would require stage-history, but this is a good proxy
    const now = new Date();
    const dealsWithAge = deals.map(d => ({
      stage: d.stage,
      agedays: Math.round((now.getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const avgDaysPerStage: Record<string, number> = {};
    for (const stage of stageOrder) {
      const stageDeal = dealsWithAge.filter(d => d.stage === stage);
      avgDaysPerStage[stage] = stageDeal.length > 0
        ? Math.round(stageDeal.reduce((s, d) => s + d.agedays, 0) / stageDeal.length)
        : 0;
    }

    res.json({ success: true, funnel, avgDaysPerStage });
  } catch (err: any) {
    res.status(500).json({ error: "Funnel analytics failed", message: err.message });
  }
});

// ─── Automations: CRUD ────────────────────────────────────────────────────────
router.get("/automations", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const automations = await db.select().from(crmAutomationsTable)
      .where(eq(crmAutomationsTable.userId, userId))
      .orderBy(desc(crmAutomationsTable.createdAt));
    res.json({ success: true, automations });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list automations", message: err.message });
  }
});

router.post("/automations", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [auto] = await db.insert(crmAutomationsTable)
      .values({ ...req.body, userId })
      .returning();
    res.status(201).json({ success: true, automation: auto });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create automation", message: err.message });
  }
});

router.put("/automations/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [auto] = await db.update(crmAutomationsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(crmAutomationsTable.id, Number(req.params.id)), eq(crmAutomationsTable.userId, userId)))
      .returning();
    if (!auto) { res.status(404).json({ error: "Automation not found" }); return; }
    res.json({ success: true, automation: auto });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update automation", message: err.message });
  }
});

router.delete("/automations/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    await db.delete(crmAutomationsTable)
      .where(and(eq(crmAutomationsTable.id, Number(req.params.id)), eq(crmAutomationsTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete automation", message: err.message });
  }
});

// ─── Pipelines: CRUD ──────────────────────────────────────────────────────────
// GET /api/crm/pipelines — list all pipelines for user
router.get("/pipelines", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const pipelines = await db.select().from(crmPipelinesTable)
      .where(eq(crmPipelinesTable.userId, userId))
      .orderBy(asc(crmPipelinesTable.createdAt));
    res.json({ success: true, pipelines });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list pipelines", message: err.message });
  }
});

// POST /api/crm/pipelines — create a new pipeline
router.post("/pipelines", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { name, stages, isDefault } = req.body as { name: string; stages: string[]; isDefault?: boolean };
    if (!name || !Array.isArray(stages) || stages.length === 0) {
      res.status(400).json({ error: "name e stages são obrigatórios." }); return;
    }
    // If new pipeline is set as default, unset others
    if (isDefault) {
      await db.update(crmPipelinesTable)
        .set({ isDefault: false })
        .where(eq(crmPipelinesTable.userId, userId));
    }
    const [pipeline] = await db.insert(crmPipelinesTable)
      .values({ userId, name, stages, isDefault: isDefault ?? false })
      .returning();
    res.status(201).json({ success: true, pipeline });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create pipeline", message: err.message });
  }
});

// PUT /api/crm/pipelines/:id — update pipeline name, stages, or isDefault
router.put("/pipelines/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { name, stages, isDefault } = req.body as { name?: string; stages?: string[]; isDefault?: boolean };
    if (isDefault) {
      await db.update(crmPipelinesTable)
        .set({ isDefault: false })
        .where(eq(crmPipelinesTable.userId, userId));
    }
    const [pipeline] = await db.update(crmPipelinesTable)
      .set({ ...(name && { name }), ...(stages && { stages }), ...(isDefault !== undefined && { isDefault }), updatedAt: new Date() })
      .where(and(eq(crmPipelinesTable.id, Number(req.params.id)), eq(crmPipelinesTable.userId, userId)))
      .returning();
    if (!pipeline) { res.status(404).json({ error: "Pipeline not found" }); return; }
    res.json({ success: true, pipeline });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update pipeline", message: err.message });
  }
});

// DELETE /api/crm/pipelines/:id — delete pipeline (not default)
router.delete("/pipelines/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [pipeline] = await db.select().from(crmPipelinesTable)
      .where(and(eq(crmPipelinesTable.id, Number(req.params.id)), eq(crmPipelinesTable.userId, userId)));
    if (!pipeline) { res.status(404).json({ error: "Pipeline not found" }); return; }
    if (pipeline.isDefault) { res.status(400).json({ error: "Não é possível excluir o funil padrão." }); return; }
    await db.delete(crmPipelinesTable)
      .where(and(eq(crmPipelinesTable.id, Number(req.params.id)), eq(crmPipelinesTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete pipeline", message: err.message });
  }
});

export default router;
