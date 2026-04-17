import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  crmContactsTable, crmDealsTable, crmActivitiesTable,
  crmEnrichmentLogTable, crmPipelinesTable
} from "@workspace/db";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { EmpresAquiClient, mapEmpresAquiToContact } from "@workspace/empresaqui";
import { callLLM } from "../lib/llm-client.js";
import { getAgentById } from "../lib/agents-data.js";

const router = Router();

// ─── Helper: fetch EmpresAqui token from env ─────────────────────────────────
async function getEmpresAquiToken(): Promise<string | null> {
  return process.env.EMPRESAQUI_API_KEY || null;
}

// ─── Contacts: List ───────────────────────────────────────────────────────────
// GET /api/crm/contacts?search=&status=
router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { search, status } = req.query as Record<string, string>;

    let query = db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)).$dynamic();

    const contacts = await db
      .select()
      .from(crmContactsTable)
      .where(eq(crmContactsTable.userId, userId))
      .orderBy(desc(crmContactsTable.createdAt));

    // Filter in-memory for simplicity (table size expected to be small initially)
    const filtered = contacts.filter(c => {
      const matchesSearch = !search || 
        c.razaoSocial?.toLowerCase().includes(search.toLowerCase()) ||
        c.cnpj.includes(search) ||
        c.nomeFantasia?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !status || c.status === status;
      return matchesSearch && matchesStatus;
    });

    res.json({ success: true, contacts: filtered, total: filtered.length });
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
// POST /api/crm/contacts
// Body: { cnpj, razaoSocial?, ... } — auto-enriquece se token disponível
router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const data = req.body;

    const cleanCnpj = (data.cnpj || "").replace(/\D/g, "");
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      res.status(400).json({ error: "CNPJ inválido. Informe 14 dígitos." });
      return;
    }

    // Verificar duplicidade para o mesmo tenant
    const [existing] = await db
      .select()
      .from(crmContactsTable)
      .where(and(eq(crmContactsTable.cnpj, cleanCnpj), eq(crmContactsTable.userId, userId)));

    if (existing) {
      res.status(409).json({ error: "Este CNPJ já está cadastrado.", contact: existing });
      return;
    }

    // Tentar enriquecimento automático pelo EmpresAqui
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
      .values({
        ...enrichedFields,
        ...data,
        cnpj: cleanCnpj,
        userId,
        source: enrichSource,
        lastEnrichedAt: enrichSource === "empresaqui" ? new Date() : null,
      })
      .returning();

    // Log de enriquecimento se houve dados
    if (enrichSource === "empresaqui" && Object.keys(enrichedFields).length > 0) {
      await db.insert(crmEnrichmentLogTable).values({
        contactId: newContact.id,
        source: "empresaqui",
        rawData: enrichedFields,
        fieldsUpdated: Object.keys(enrichedFields),
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
    const [updated] = await db
      .update(crmContactsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Contact not found" }); return; }
    res.json({ success: true, contact: updated });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to update contact", message: err.message });
  }
});

// ─── Contacts: Delete ─────────────────────────────────────────────────────────
router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    await db
      .delete(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete contact", message: err.message });
  }
});

// ─── Contacts: Enrich via EmpresAqui ─────────────────────────────────────────
// POST /api/crm/contacts/:id/enrich
router.post("/contacts/:id/enrich", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [contact] = await db
      .select()
      .from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));

    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    const token = await getEmpresAquiToken();
    if (!token) {
      res.status(503).json({ error: "EmpresAqui token not configured. Add EMPRESAQUI_API_KEY." });
      return;
    }

    const client = new EmpresAquiClient(token);
    const empresaData = await client.getCompanyByCNPJ(contact.cnpj);
    const mapped = mapEmpresAquiToContact(empresaData);

    const [updated] = await db
      .update(crmContactsTable)
      .set({ ...mapped, source: "empresaqui", lastEnrichedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmContactsTable.id, contact.id))
      .returning();

    await db.insert(crmEnrichmentLogTable).values({
      contactId: contact.id,
      source: "empresaqui",
      rawData: empresaData as any,
      fieldsUpdated: Object.keys(mapped),
    }).catch(() => {});

    res.json({ success: true, contact: updated, fieldsUpdated: Object.keys(mapped) });
  } catch (err: any) {
    res.status(500).json({ error: "Enrichment failed", message: err.message });
  }
});

// ─── Contacts: Import batch de CNPJs ─────────────────────────────────────────
// POST /api/crm/contacts/import
// Body: { cnpjs: string[] }
router.post("/contacts/import", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { cnpjs } = req.body as { cnpjs: string[] };
    if (!Array.isArray(cnpjs) || cnpjs.length === 0) {
      res.status(400).json({ error: "Informe um array de CNPJs em 'cnpjs'." });
      return;
    }
    if (cnpjs.length > 50) {
      res.status(400).json({ error: "Máximo de 50 CNPJs por lote." });
      return;
    }

    const token = await getEmpresAquiToken();
    const results: { cnpj: string; status: string; contactId?: number }[] = [];

    for (const rawCnpj of cnpjs) {
      const cnpj = rawCnpj.replace(/\D/g, "");
      try {
        const [existing] = await db
          .select({ id: crmContactsTable.id })
          .from(crmContactsTable)
          .where(and(eq(crmContactsTable.cnpj, cnpj), eq(crmContactsTable.userId, userId)));
        if (existing) {
          results.push({ cnpj, status: "duplicate", contactId: existing.id });
          continue;
        }

        let enrichedFields: any = {};
        if (token) {
          try {
            const client = new EmpresAquiClient(token);
            const data = await client.getCompanyByCNPJ(cnpj);
            enrichedFields = mapEmpresAquiToContact(data);
          } catch { /* silently skip enrichment */ }
        }

        const [newContact] = await db
          .insert(crmContactsTable)
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
// POST /api/crm/contacts/:id/qualify
router.post("/contacts/:id/qualify", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const [contact] = await db
      .select()
      .from(crmContactsTable)
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
    
    // Parse response JSON
    let scoreData: any = {};
    try {
      const match = result.output.match(/\{[\s\S]*\}/);
      if (match) scoreData = JSON.parse(match[0]);
    } catch { scoreData = { score: 50, tier: "C", reasoning: result.output }; }

    const [updated] = await db
      .update(crmContactsTable)
      .set({
        aiScore: scoreData.score || null,
        aiScoreDetails: scoreData,
        aiRecommendedProduct: scoreData.products?.[0] || null,
        status: scoreData.tier === "A" || scoreData.tier === "B" ? "qualified" : contact.status,
        updatedAt: new Date(),
      })
      .where(eq(crmContactsTable.id, contact.id))
      .returning();

    // Salvar atividade de qualificação na timeline
    await db.insert(crmActivitiesTable).values({
      contactId: contact.id,
      userId,
      type: "ai_generated",
      subject: `Qualificação IA — Score ${scoreData.score}/100 (Tier ${scoreData.tier})`,
      content: result.output,
      completedAt: new Date(),
      agentId: agent.id,
    }).catch(() => {});

    // Auto-create a Deal in Kanban if it doesn't exist and Tier is A/B/C
    let dealCreated = false;
    if (["A", "B", "C"].includes(scoreData.tier)) {
      const [existingDeal] = await db
        .select({ id: crmDealsTable.id })
        .from(crmDealsTable)
        .where(and(eq(crmDealsTable.contactId, contact.id), eq(crmDealsTable.userId, userId)));
      
      if (!existingDeal) {
        const stage = scoreData.tier === "A" ? "discovery" : "prospecting";
        const probability = scoreData.tier === "A" ? 40 : (scoreData.tier === "B" ? 20 : 10);
        
        await db.insert(crmDealsTable).values({
          contactId: contact.id,
          userId,
          title: `Oportunidade - ${contact.razaoSocial || contact.cnpj}`,
          value: "50000", // Valor simbólico inicial
          stage,
          probability,
          products: scoreData.products || [],
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
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
router.get("/deals/pipeline", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const pipelineIdParam = (req.query.pipelineId as string) || "default";

    // Grab or initialize the pipeline dynamically
    let [pipelineMeta] = await db
      .select({ id: crmPipelinesTable.id, name: crmPipelinesTable.name, stages: crmPipelinesTable.stages })
      .from(crmPipelinesTable)
      .where(and(eq(crmPipelinesTable.userId, userId), eq(crmPipelinesTable.id, pipelineIdParam === "default" ? 0 : Number(pipelineIdParam))))
      .limit(1);

    if (!pipelineMeta && pipelineIdParam === "default") {
      const defaultStages = ["prospecting", "discovery", "proposal", "negotiation", "closing", "won", "lost"];
      pipelineMeta = { id: 0, name: "Funil Comercial (Padrão)", stages: defaultStages };
      // Opcional: Inserir no banco pra uso futuro, mas pode ser resolvido dinamicamente.
    }

    const stages = pipelineMeta?.stages || ["prospecting", "discovery", "won", "lost"];

    const deals = await db
      .select()
      .from(crmDealsTable)
      .where(
        and(
          eq(crmDealsTable.userId, userId),
          eq(crmDealsTable.pipelineId, pipelineIdParam)
        )
      )
      .orderBy(desc(crmDealsTable.updatedAt));

    const pipeline: Record<string, any[]> = {};
    for (const s of stages) pipeline[s] = deals.filter(d => d.stage === s);

    const totalValue = deals
      .filter(d => !["lost"].includes(d.stage))
      .reduce((sum, d) => sum + (parseFloat(d.value || "0") || 0), 0);

    res.json({ success: true, pipeline, stages, meta: pipelineMeta, stats: { total: deals.length, totalValue } });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch pipeline", message: err.message });
  }
});

// ─── Deals: CRUD ─────────────────────────────────────────────────────────────
router.get("/deals", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { stage } = req.query as Record<string, string>;
    const all = await db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)).orderBy(desc(crmDealsTable.updatedAt));
    const deals = stage ? all.filter(d => d.stage === stage) : all;
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
    const [oldDeal] = await db.select().from(crmDealsTable).where(and(eq(crmDealsTable.id, Number(req.params.id)), eq(crmDealsTable.userId, userId)));
    if (!oldDeal) { res.status(404).json({ error: "Deal not found" }); return; }

    const body = req.body;
    // Auto-timestamp on stage moves
    if (body.stage && body.stage !== oldDeal.stage) {
      if (body.stage === "won" && !body.wonAt) body.wonAt = new Date();
      if (body.stage === "lost" && !body.lostAt) body.lostAt = new Date();
    }

    const [deal] = await db
      .update(crmDealsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(crmDealsTable.id, oldDeal.id))
      .returning();

    // ─── Automations (Triggers) ───
    if (body.stage && body.stage !== oldDeal.stage) {
      try {
        const agnt = getAgentById("prospeccao-tax-group");
        let automationNote = "Avançou de etapa internamente.";
        
        if (body.stage === "won") {
          automationNote = "Contrato e Setup Operacional prontos para envio. Disparar onboarding.";
        } else if (body.stage === "proposal") {
          automationNote = "Gerar e enviar Carta de Apresentação e PDF analítico tributário usando a Base de Conhecimento.";
        }

        await db.insert(crmActivitiesTable).values({
          contactId: deal.contactId,
          dealId: deal.id,
          userId,
          type: "stage_change",
          subject: `Etapa movida para: ${body.stage.toUpperCase()}`,
          content: `Automação Acionada: ${automationNote}`,
          agentId: agnt ? agnt.id : null,
          completedAt: new Date(),
        }).catch(() => {});
      } catch (err) {}
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

// ─── Activities: List & Create ────────────────────────────────────────────────
router.get("/contacts/:id/activities", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const activities = await db
      .select()
      .from(crmActivitiesTable)
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
    const [activity] = await db
      .insert(crmActivitiesTable)
      .values({ ...req.body, contactId: Number(req.params.id), userId })
      .returning();
    res.status(201).json({ success: true, activity });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to create activity", message: err.message });
  }
});

export default router;
