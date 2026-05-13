import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  crmContactsTable, crmDealsTable, crmActivitiesTable,
  crmEnrichmentLogTable, crmPipelinesTable, crmAttachmentsTable,
  crmTasksTable, crmSavedViewsTable, crmAutomationsTable,
  automationSequencesTable, sequenceEnrollmentsTable,
} from "@workspace/db";
import { eq, and, desc, asc, ilike, or, gte, lte, inArray, sql } from "drizzle-orm";
import { EmpresAquiClient, mapEmpresAquiToContact } from "@workspace/empresaqui";
import { callLLM } from "../lib/llm-client.js";
import { getAgentById } from "../lib/agents-data.js";
import { apiError } from "../lib/api-response.js";
import { enrichContact } from "../lib/cnpj-enrichment.js";
import { pick, safeNumber, validateHttpUrl } from "../lib/validation.js";

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────
async function getEmpresAquiToken(): Promise<string | null> {
  return process.env.EMPRESAQUI_API_KEY || null;
}

// ─── Automation Engine ────────────────────────────────────────────────────────
async function evaluateAutomations(
  userId: string,
  contactId: number,
  triggerType: string,
  currentValue: any,
  dealId?: number,
) {
  try {
    const automations = await db.select().from(crmAutomationsTable)
      .where(and(
        eq(crmAutomationsTable.userId, userId),
        eq(crmAutomationsTable.isActive, true),
        eq(crmAutomationsTable.triggerType, triggerType),
      ));

    for (const auto of automations) {
      let shouldTrigger = false;

      if (triggerType === "status_changed" && auto.triggerValue === currentValue) {
        shouldTrigger = true;
      } else if (triggerType === "score_above" && typeof currentValue === "number" && currentValue >= Number(auto.triggerValue)) {
        shouldTrigger = true;
      } else if (triggerType === "score_below" && typeof currentValue === "number" && currentValue <= Number(auto.triggerValue)) {
        shouldTrigger = true;
      } else if (triggerType === "deal_stage_changed" && auto.triggerValue === currentValue) {
        shouldTrigger = true;
      }

      if (!shouldTrigger) continue;

      if (auto.actionType === "create_task" && auto.actionPayload) {
        const payload = auto.actionPayload as any;
        await db.insert(crmTasksTable).values({
          userId,
          contactId,
          dealId: dealId ?? null,
          title: payload.title || `Tarefa Automática: ${auto.name}`,
          type: payload.type || "call",
          priority: payload.priority || "high",
          status: "pending",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

      } else if (auto.actionType === "log_activity") {
        await db.insert(crmActivitiesTable).values({
          userId,
          contactId,
          dealId: dealId ?? null,
          type: "ai_generated",
          subject: "Ação Automática Executada",
          content: `Automação '${auto.name}' disparada (${triggerType} = ${currentValue}).`,
        });

      } else if (auto.actionType === "enroll_sequence" && auto.actionPayload) {
        const payload = auto.actionPayload as { sequenceId?: number };
        const seqId = Number(payload.sequenceId);
        if (!seqId || isNaN(seqId)) continue;

        // Verifica se já há enrollment ativo para evitar duplicatas
        const [existing] = await db
          .select({ id: sequenceEnrollmentsTable.id })
          .from(sequenceEnrollmentsTable)
          .where(and(
            eq(sequenceEnrollmentsTable.contactId, contactId),
            eq(sequenceEnrollmentsTable.sequenceId, seqId),
            eq(sequenceEnrollmentsTable.status, "active"),
          ))
          .limit(1);

        if (existing) continue; // já está ativo, não duplica

        const [seq] = await db
          .select()
          .from(automationSequencesTable)
          .where(and(eq(automationSequencesTable.id, seqId), eq(automationSequencesTable.isActive, true)))
          .limit(1);

        if (!seq?.steps?.length) continue;

        const firstStep = (seq.steps as Array<{ day: number }>)[0];
        const nextSendAt = new Date(Date.now() + firstStep.day * 24 * 60 * 60 * 1000);

        await db.insert(sequenceEnrollmentsTable).values({
          sequenceId: seqId,
          contactId,
          userId,
          currentStep: 0,
          nextSendAt,
          status: "active",
        });

        await db.insert(crmActivitiesTable).values({
          userId,
          contactId,
          dealId: dealId ?? null,
          type: "ai_generated",
          subject: `Enrolado em sequência: ${seq.name}`,
          content: `Automação '${auto.name}' enrolou este contato na sequência "${seq.name}" (${seq.steps.length} etapas).`,
        });

        console.log(`[Automations] Contact ${contactId} enrolled in sequence ${seqId} by automation ${auto.id}`);

      } else if (auto.actionType === "send_whatsapp" && auto.actionPayload) {
        // Registra intent — o envio real requer canal configurado, loga atividade para sinalizar
        const payload = auto.actionPayload as { messageTemplate?: string };
        await db.insert(crmActivitiesTable).values({
          userId,
          contactId,
          dealId: dealId ?? null,
          type: "whatsapp",
          subject: "WhatsApp automático pendente",
          content: payload.messageTemplate || `Automação '${auto.name}': enviar mensagem WhatsApp.`,
        });
      }
    }
  } catch (error) {
    console.error("[Automations] evaluateAutomations error:", error);
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
    const scoreMinNum = safeNumber(scoreMin, { min: 0, max: 100 });
    const scoreMaxNum = safeNumber(scoreMax, { min: 0, max: 100 });
    if (scoreMinNum !== null) conditions.push(gte(crmContactsTable.aiScore, scoreMinNum));
    if (scoreMaxNum !== null) conditions.push(lte(crmContactsTable.aiScore, scoreMaxNum));
    
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
    apiError(res, 500, "Failed to list contacts");
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
    if (!contact) { apiError(res, 404, "Contact not found"); return; }
    res.json({ success: true, contact });
  } catch (err: any) {
    apiError(res, 500, "Failed to get contact");
  }
});

// ─── Contacts: Create ─────────────────────────────────────────────────────────
router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const data = req.body;
    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      apiError(res, 400, "CNPJ inválido. Informe 14 dígitos.");
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

    const allowedContactFields = ["razaoSocial","nomeFantasia","regimeTributario","cnae","faturamentoEstimado","porte","uf","cidade","endereco","cep","telefone","email","website","nomeDecissor","cargoDecissor","socios","tags","customFields","status","aiScore","aiScoreDetails","aiRecommendedProduct"] as const;
    const sanitizedData = pick(data, allowedContactFields);
    const [newContact] = await db
      .insert(crmContactsTable)
      .values({ ...enrichedFields, ...sanitizedData, cnpj: cleanCnpj, userId, source: enrichSource, lastEnrichedAt: enrichSource === "empresaqui" ? new Date() : null } as any)
      .returning();

    if (enrichSource === "empresaqui" && Object.keys(enrichedFields).length > 0) {
      await db.insert(crmEnrichmentLogTable).values({
        contactId: newContact.id, source: "empresaqui", rawData: enrichedFields, fieldsUpdated: Object.keys(enrichedFields),
      }).catch(() => {});
    }

    res.status(201).json({ success: true, contact: newContact, enriched: enrichSource === "empresaqui" });

    // AI scoring in background — fire-and-forget
    setImmediate(() => {
      enrichContact(newContact.id, userId).catch((err: Error) =>
        console.error("[Enrichment] Background enrich failed for contact", newContact.id, err)
      );
    });
  } catch (err: any) {
    apiError(res, 400, "Failed to create contact");
  }
});

// ─── Contacts: Update ─────────────────────────────────────────────────────────
router.put("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    
    // Check if status changed for automation
    const [oldContact] = await db.select({ status: crmContactsTable.status }).from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));

    const allowedContactFields = ["razaoSocial","nomeFantasia","regimeTributario","cnae","faturamentoEstimado","porte","uf","cidade","endereco","cep","telefone","email","website","nomeDecissor","cargoDecissor","socios","tags","customFields","status","aiScore","aiScoreDetails","aiRecommendedProduct"] as const;
    const [updated] = await db
      .update(crmContactsTable)
      .set({ ...pick(req.body, allowedContactFields), updatedAt: new Date() })
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)))
      .returning();
    
    if (!updated) { apiError(res, 404, "Contact not found"); return; }

    // Trigger automations if status changed
    if (oldContact && req.body.status && oldContact.status !== req.body.status) {
      await evaluateAutomations(userId, updated.id, "status_changed", updated.status);
    }

    res.json({ success: true, contact: updated });
  } catch (err: any) {
    apiError(res, 400, "Failed to update contact");
  }
});

// ─── Contacts: Delete ─────────────────────────────────────────────────────────
router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [existing] = await db.select({ id: crmContactsTable.id }).from(crmContactsTable).where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    if (!existing) { apiError(res, 404, "Contact not found"); return; }
    await db.delete(crmContactsTable).where(eq(crmContactsTable.id, existing.id));
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to delete contact");
  }
});

// ─── Contacts: Bulk Delete ────────────────────────────────────────────────────
// POST /api/crm/contacts/bulk-delete  body: { ids: number[] }
router.post("/contacts/bulk-delete", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      apiError(res, 400, "ids deve ser um array não vazio.");
      return;
    }
    await db.delete(crmContactsTable)
      .where(and(inArray(crmContactsTable.id, ids), eq(crmContactsTable.userId, userId)));
    res.json({ success: true, deleted: ids.length });
  } catch (err: any) {
    apiError(res, 500, "Bulk delete failed");
  }
});

// ─── Contacts: Bulk Status Update ────────────────────────────────────────────
// POST /api/crm/contacts/bulk-update-status  body: { ids: number[], status: string }
router.post("/contacts/bulk-update-status", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { ids, status } = req.body as { ids: number[]; status: string };
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      apiError(res, 400, "ids e status são obrigatórios.");
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
    apiError(res, 500, "Bulk update failed");
  }
});

// ─── Contacts: Bulk Tags ──────────────────────────────────────────────────────
// POST /api/crm/contacts/bulk-tags  body: { ids: number[], tag: string, action: "add" | "remove" }
router.post("/contacts/bulk-tags", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { ids, tag, action } = req.body as { ids: number[]; tag: string; action: "add" | "remove" };
    if (!Array.isArray(ids) || ids.length === 0 || !tag) {
      apiError(res, 400, "ids e tag são obrigatórios."); return;
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
    apiError(res, 500, "Bulk tags update failed");
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
    apiError(res, 500, "Failed to fetch tags");
  }
});

// ─── Contacts: Enrich via EmpresAqui ─────────────────────────────────────────
router.post("/contacts/:id/enrich", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    const token = await getEmpresAquiToken();
    if (!token) { apiError(res, 503, "EmpresAqui token not configured."); return; }

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
    apiError(res, 500, "Enrichment failed");
  }
});

// ─── Contacts: Import batch de CNPJs ─────────────────────────────────────────
router.post("/contacts/import", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { cnpjs } = req.body as { cnpjs: string[] };
    if (!Array.isArray(cnpjs) || cnpjs.length === 0) {
      apiError(res, 400, "Informe um array de CNPJs em 'cnpjs'.");
      return;
    }
    if (cnpjs.length > 50) { apiError(res, 400, "Máximo de 50 CNPJs por lote."); return; }

    const token = await getEmpresAquiToken();
    const results: { cnpj: string; status: string; contactId?: number }[] = [];

    for (const rawCnpj of cnpjs) {
      if (typeof rawCnpj !== "string") { results.push({ cnpj: String(rawCnpj), status: "error" }); continue; }
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
    apiError(res, 500, "Import failed");
  }
});

// ─── Contacts: Qualify via IA ────────────────────────────────────────────────
router.post("/contacts/:id/qualify", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    const agent = getAgentById("qualificacao-leads-tax-group") || getAgentById("coordenador-geral-tax-group");
    if (!agent) { apiError(res, 500, "Qualification agent not found"); return; }

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
    apiError(res, 500, "Qualification failed");
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
    apiError(res, 500, "Failed to fetch pipeline");
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
    apiError(res, 500, "Failed to list deals");
  }
});

router.post("/deals", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const allowedDealFields = ["contactId","pipelineId","title","produto","stage","value","probability","expectedCloseDate","customFields","lostReason","wonAt","lostAt","assignedTo","notes","conversationId"] as const;
    const [deal] = await db.insert(crmDealsTable).values({ ...pick(req.body, allowedDealFields), userId } as any).returning();
    res.status(201).json({ success: true, deal });
  } catch (err: any) {
    apiError(res, 400, "Failed to create deal");
  }
});

router.put("/deals/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [oldDeal] = await db.select().from(crmDealsTable)
      .where(and(eq(crmDealsTable.id, Number(req.params.id)), eq(crmDealsTable.userId, userId)));
    if (!oldDeal) { apiError(res, 404, "Deal not found"); return; }

    const body = req.body;
    if (body.stage && body.stage !== oldDeal.stage) {
      if (body.stage === "won" && !body.wonAt) body.wonAt = new Date();
      if (body.stage === "lost" && !body.lostAt) body.lostAt = new Date();
    }

    const allowedDealFields = ["contactId","pipelineId","title","produto","stage","value","probability","expectedCloseDate","customFields","lostReason","wonAt","lostAt","assignedTo","notes","conversationId"] as const;
    const [deal] = await db.update(crmDealsTable)
      .set({ ...pick(body, allowedDealFields), updatedAt: new Date() })
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

        // Dispara automações de deal_stage_changed em background
        setImmediate(() => {
          evaluateAutomations(userId, deal.contactId, "deal_stage_changed", body.stage, deal.id)
            .catch(err => console.error("[Automations] deal_stage_changed error:", err));
        });
      } catch { /* non-fatal */ }
    }

    res.json({ success: true, deal });
  } catch (err: any) {
    apiError(res, 400, "Failed to update deal");
  }
});

router.delete("/deals/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [existing] = await db.select({ id: crmDealsTable.id }).from(crmDealsTable).where(and(eq(crmDealsTable.id, Number(req.params.id)), eq(crmDealsTable.userId, userId)));
    if (!existing) { apiError(res, 404, "Deal not found"); return; }
    await db.delete(crmDealsTable).where(eq(crmDealsTable.id, existing.id));
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to delete deal");
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
    apiError(res, 500, "Failed to list activities");
  }
});

router.post("/contacts/:id/activities", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const allowedActivityFields = ["dealId","type","direction","subject","content","scheduledAt","completedAt","agentId","conversationId"] as const;
    const [activity] = await db.insert(crmActivitiesTable)
      .values({ ...pick(req.body, allowedActivityFields), contactId: Number(req.params.id), userId } as any)
      .returning();
    res.status(201).json({ success: true, activity });
  } catch (err: any) {
    apiError(res, 400, "Failed to create activity");
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
    apiError(res, 500, "Failed to list attachments");
  }
});

router.post("/contacts/:id/attachments", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const contactId = Number(req.params.id);
    const [contact] = await db.select({ id: crmContactsTable.id }).from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, contactId), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    const { fileName, fileSize, mimeType, url, dealId } = req.body;
    if (!fileName || !mimeType || !url) {
      apiError(res, 400, "fileName, mimeType e url são obrigatórios.");
      return;
    }
    const safeUrl = validateHttpUrl(url);
    if (!safeUrl) {
      apiError(res, 400, "URL inválida. Apenas http/https são permitidos.");
      return;
    }

    const [attachment] = await db.insert(crmAttachmentsTable)
      .values({ userId, contactId, dealId: dealId ? Number(dealId) : null, fileName, fileSize, mimeType, url: safeUrl, uploadedBy: userId })
      .returning();

    await db.insert(crmActivitiesTable).values({
      contactId, dealId: dealId ? Number(dealId) : null, userId,
      type: "note", subject: `Arquivo anexado: ${fileName}`,
      content: `Arquivo ${mimeType} (${fileSize ? `${Math.round(fileSize / 1024)} KB` : "tamanho desconhecido"}) adicionado.`,
      completedAt: new Date(),
    }).catch(() => {});

    res.status(201).json({ success: true, attachment });
  } catch (err: any) {
    apiError(res, 400, "Failed to create attachment");
  }
});

router.delete("/contacts/:contactId/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [existing] = await db.select({ id: crmAttachmentsTable.id }).from(crmAttachmentsTable).where(and(
      eq(crmAttachmentsTable.id, Number(req.params.attachmentId)),
      eq(crmAttachmentsTable.contactId, Number(req.params.contactId)),
      eq(crmAttachmentsTable.userId, userId)
    ));
    if (!existing) { apiError(res, 404, "Attachment not found"); return; }
    await db.delete(crmAttachmentsTable).where(eq(crmAttachmentsTable.id, existing.id));
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to delete attachment");
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
    apiError(res, 500, "Failed to list tasks");
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const allowedTaskFields = ["contactId","dealId","title","description","type","priority","status","dueDate","reminderAt","assignedTo","completedAt","conversationId"] as const;
    const [task] = await db.insert(crmTasksTable)
      .values({ ...pick(req.body, allowedTaskFields), userId } as any)
      .returning();
    res.status(201).json({ success: true, task });
  } catch (err: any) {
    apiError(res, 400, "Failed to create task");
  }
});

router.put("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const body = req.body;
    if (body.status === "done" && !body.completedAt) body.completedAt = new Date();
    const allowedTaskFields = ["contactId","dealId","title","description","type","priority","status","dueDate","reminderAt","assignedTo","completedAt","conversationId"] as const;
    const [task] = await db.update(crmTasksTable)
      .set({ ...pick(body, allowedTaskFields), updatedAt: new Date() })
      .where(and(eq(crmTasksTable.id, Number(req.params.id)), eq(crmTasksTable.userId, userId)))
      .returning();
    if (!task) { apiError(res, 404, "Task not found"); return; }
    res.json({ success: true, task });
  } catch (err: any) {
    apiError(res, 400, "Failed to update task");
  }
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [existing] = await db.select({ id: crmTasksTable.id }).from(crmTasksTable).where(and(eq(crmTasksTable.id, Number(req.params.id)), eq(crmTasksTable.userId, userId)));
    if (!existing) { apiError(res, 404, "Task not found"); return; }
    await db.delete(crmTasksTable).where(eq(crmTasksTable.id, existing.id));
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to delete task");
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
    apiError(res, 500, "Failed to fetch global activities");
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
    apiError(res, 500, "Failed to list views");
  }
});

router.post("/views", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const allowedViewFields = ["name","emoji","filters","isDefault","sortField","sortDir"] as const;
    const [view] = await db.insert(crmSavedViewsTable)
      .values({ ...pick(req.body, allowedViewFields), userId } as any)
      .returning();
    res.status(201).json({ success: true, view });
  } catch (err: any) {
    apiError(res, 400, "Failed to create view");
  }
});

router.delete("/views/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [existing] = await db.select({ id: crmSavedViewsTable.id }).from(crmSavedViewsTable).where(and(eq(crmSavedViewsTable.id, Number(req.params.id)), eq(crmSavedViewsTable.userId, userId)));
    if (!existing) { apiError(res, 404, "View not found"); return; }
    await db.delete(crmSavedViewsTable).where(eq(crmSavedViewsTable.id, existing.id));
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to delete view");
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
    apiError(res, 500, "Analytics overview failed");
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
    apiError(res, 500, "Funnel analytics failed");
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
    apiError(res, 500, "Failed to list automations");
  }
});

router.post("/automations", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const allowedAutoFields = ["name","triggerType","triggerValue","actionType","actionPayload","isActive"] as const;
    const [auto] = await db.insert(crmAutomationsTable)
      .values({ ...pick(req.body, allowedAutoFields), userId } as any)
      .returning();
    res.status(201).json({ success: true, automation: auto });
  } catch (err: any) {
    apiError(res, 400, "Failed to create automation");
  }
});

router.put("/automations/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const allowedAutoFields = ["name","triggerType","triggerValue","actionType","actionPayload","isActive"] as const;
    const [auto] = await db.update(crmAutomationsTable)
      .set({ ...pick(req.body, allowedAutoFields), updatedAt: new Date() })
      .where(and(eq(crmAutomationsTable.id, Number(req.params.id)), eq(crmAutomationsTable.userId, userId)))
      .returning();
    if (!auto) { apiError(res, 404, "Automation not found"); return; }
    res.json({ success: true, automation: auto });
  } catch (err: any) {
    apiError(res, 400, "Failed to update automation");
  }
});

router.delete("/automations/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [existing] = await db.select({ id: crmAutomationsTable.id }).from(crmAutomationsTable).where(and(eq(crmAutomationsTable.id, Number(req.params.id)), eq(crmAutomationsTable.userId, userId)));
    if (!existing) { apiError(res, 404, "Automation not found"); return; }
    await db.delete(crmAutomationsTable).where(eq(crmAutomationsTable.id, existing.id));
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to delete automation");
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
    apiError(res, 500, "Failed to list pipelines");
  }
});

// POST /api/crm/pipelines — create a new pipeline
router.post("/pipelines", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { name, stages, isDefault } = req.body as { name: string; stages: string[]; isDefault?: boolean };
    if (!name || !Array.isArray(stages) || stages.length === 0) {
      apiError(res, 400, "name e stages são obrigatórios."); return;
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
    apiError(res, 400, "Failed to create pipeline");
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
    if (!pipeline) { apiError(res, 404, "Pipeline not found"); return; }
    res.json({ success: true, pipeline });
  } catch (err: any) {
    apiError(res, 400, "Failed to update pipeline");
  }
});

// DELETE /api/crm/pipelines/:id — delete pipeline (not default)
router.delete("/pipelines/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [pipeline] = await db.select().from(crmPipelinesTable)
      .where(and(eq(crmPipelinesTable.id, Number(req.params.id)), eq(crmPipelinesTable.userId, userId)));
    if (!pipeline) { apiError(res, 404, "Pipeline not found"); return; }
    if (pipeline.isDefault) { apiError(res, 400, "Não é possível excluir o funil padrão."); return; }
    await db.delete(crmPipelinesTable)
      .where(and(eq(crmPipelinesTable.id, Number(req.params.id)), eq(crmPipelinesTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to delete pipeline");
  }
});

// ─── Segment Analytics ────────────────────────────────────────────────────────
// GET /api/crm/segments — returns contact/deal stats by business segment
router.get("/segments", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const contacts = await db.select().from(crmContactsTable)
      .where(eq(crmContactsTable.userId, userId));

    const deals = await db.select().from(crmDealsTable)
      .where(eq(crmDealsTable.userId, userId));

    function classifySegment(contact: typeof contacts[0]): string | null {
      const text = `${contact.cnae || ""} ${contact.tags?.join(" ") || ""} ${contact.razaoSocial || ""} ${contact.nomeFantasia || ""}`.toLowerCase();
      if (/agro|pecuária|agricultura|rural|grãos|lavoura|pastagem|avícola|suínocultura/.test(text)) return "agro";
      if (/indústria|fabrica|manufatura|produção|metalurgia|química|alimentícia|textil|plástico/.test(text)) return "industria";
      if (/atacado|atacadista|distribuidor|revenda|representação/.test(text)) return "atacado";
      if (/transporte|logística|armazenagem|carga|frete|expedição|mudança/.test(text)) return "logistica";
      return null;
    }

    const segments: Record<string, { label: string; contacts: number; deals: number; potentialValue: number; hotLeads: number }> = {
      agro:      { label: "Agro",       contacts: 0, deals: 0, potentialValue: 0, hotLeads: 0 },
      industria: { label: "Indústria",  contacts: 0, deals: 0, potentialValue: 0, hotLeads: 0 },
      atacado:   { label: "Atacado",    contacts: 0, deals: 0, potentialValue: 0, hotLeads: 0 },
      logistica: { label: "Logística",  contacts: 0, deals: 0, potentialValue: 0, hotLeads: 0 },
    };

    for (const c of contacts) {
      const seg = classifySegment(c);
      if (seg && segments[seg]) {
        segments[seg].contacts++;
        if ((c.aiScore ?? 0) >= 70) segments[seg].hotLeads++;
      }
    }

    for (const d of deals) {
      const contact = contacts.find(c => c.id === d.contactId);
      if (!contact) continue;
      const seg = classifySegment(contact);
      if (seg && segments[seg]) {
        segments[seg].deals++;
        const val = Number(d.value) || 0;
        segments[seg].potentialValue += val;
      }
    }

    res.json({
      segments: Object.entries(segments).map(([id, s]) => ({
        id,
        label: s.label,
        contacts: s.contacts,
        deals: s.deals,
        potentialValue: s.potentialValue,
        hotLeads: s.hotLeads,
      })).filter(s => s.contacts > 0),
    });
  } catch (err: any) {
    console.error("[CRM] segments error:", err);
    apiError(res, 500, "Failed to compute segments");
  }
});

export default router;
