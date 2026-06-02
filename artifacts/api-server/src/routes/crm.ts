import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  crmContactsTable, crmDealsTable, crmActivitiesTable,
  crmEnrichmentLogTable, crmPipelinesTable, crmAttachmentsTable,
  crmTasksTable, crmSavedViewsTable, crmAutomationsTable,
  automationSequencesTable, sequenceEnrollmentsTable,
  crmQualificationHistoryTable, crmAlertsTable, crmNextStepHistoryTable,
  appConfigTable,
} from "@workspace/db";
import { eq, and, desc, asc, ilike, or, gte, lte, inArray, sql, isNull } from "drizzle-orm";
import { EmpresAquiClient, mapEmpresAquiToContact } from "@workspace/empresaqui";
import { callLLM } from "../lib/llm-client.js";
import { getAgentById } from "../lib/agents-data.js";
import { apiError } from "../lib/api-response.js";
import { enrichContact } from "../lib/cnpj-enrichment.js";
import { pick, safeNumber, validateHttpUrl } from "../lib/validation.js";
import { dispatchWebhook } from "../lib/webhook-dispatcher.js";
import { requireUserId } from "../middlewares/auth.js";
import { decrypt } from "../lib/crypto.js";
import { HubSpotClient } from "@workspace/hubspot";
import { pushContactToHubSpot, pushDealToHubSpot, pushActivityToHubSpot, pushTaskToHubSpot } from "../lib/hubspot-sync.js";
import {
  DEFAULT_PIPELINE_ID, DEFAULT_PIPELINE_NAME, PIPELINE_TAX_GROUP_STAGES,
  LEGACY_CONTACT_STATUS_MAP, LEGACY_DEAL_STAGE_MAP, DEAL_STAGE_TO_CONTACT_STATUS,
  MATRIZ_BRIEFING_CHECKLIST, AUTOMATION_TRIGGER_LABELS, AUTOMATION_ACTION_LABELS,
} from "@workspace/db/crm-constants";
import { recommendNextStep } from "../lib/next-step-engine.js";
import { evaluateAlerts, getAlertMeta } from "../lib/alerts-engine.js";
import {
  buildQualificationPrompt, parseQualificationResult, SYSTEM_INSTRUCTIONS,
} from "../lib/qualification-engine.js";
import { calculatePriority } from "../lib/priority-engine.js";

const router = Router();

// ─── Integration Event Dispatcher ────────────────────────────────────────────
// Fire-and-forget: never blocks the API response, never throws to caller.
function fireIntegrationEvent(
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
): void {
  setImmediate(async () => {
    try {
      const rows = await db.select().from(appConfigTable).where(
        sql`${appConfigTable.key} LIKE 'integration:make:%'`
      );
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      const makeUrl = map["integration:make:webhook_url"];
      const makeEnabled = map["integration:make:enabled"] === "true";
      if (makeUrl && makeEnabled) {
        const secret = map["integration:make:secret"] ? decrypt(map["integration:make:secret"]) : undefined;
        await dispatchWebhook({
          targetUrl: makeUrl,
          eventType,
          payload,
          secret,
          userId,
          integrationKey: "make",
          integrationName: "Make.com",
        });
      }
    } catch (err) {
      console.error(`[Integration] fireIntegrationEvent(${eventType}) failed:`, err);
    }

    // HubSpot dispatch
    try {
      const hsRows = await db.select().from(appConfigTable).where(
        sql`${appConfigTable.key} LIKE 'integration:hubspot:%'`
      );
      const hsMap = Object.fromEntries(hsRows.map(r => [r.key, r.value]));
      const hsToken = hsMap["integration:hubspot:access_token"];
      const hsEnabled = hsMap["integration:hubspot:enabled"] === "true";
      const hsDirection = hsMap["integration:hubspot:sync_direction"] || "bidirectional";

      if (hsToken && hsEnabled && hsDirection !== "from_hubspot") {
        const token = decrypt(hsToken);
        const portalId = hsMap["integration:hubspot:portal_id"];
        const client = new HubSpotClient(token, portalId);
        await dispatchToHubSpot(client, eventType, payload, userId);
      }
    } catch (err) {
      console.error(`[Integration] HubSpot dispatch(${eventType}) failed:`, err);
    }
  });
}

async function dispatchToHubSpot(
  client: HubSpotClient,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  try {
    switch (eventType) {
      case "lead.created":
      case "contact.updated":
      case "lead.qualified": {
        const contactId = payload.contactId as number;
        if (!contactId) return;
        const [contact] = await db.select().from(crmContactsTable)
          .where(eq(crmContactsTable.id, contactId)).limit(1);
        if (contact) await pushContactToHubSpot(client, contact, userId ?? "system");
        break;
      }
      case "deal.created":
      case "deal.stage_changed":
      case "deal.won":
      case "deal.lost": {
        const dealId = payload.dealId as number;
        if (!dealId) return;
        const [deal] = await db.select().from(crmDealsTable)
          .where(eq(crmDealsTable.id, dealId)).limit(1);
        if (!deal) return;
        const [dealContact] = await db.select().from(crmContactsTable)
          .where(eq(crmContactsTable.id, deal.contactId)).limit(1);
        await pushDealToHubSpot(client, deal, dealContact, userId ?? "system");
        break;
      }
      case "activity.created": {
        const activityId = payload.activityId as number;
        const contactId = payload.contactId as number;
        if (!activityId || !contactId) return;
        const [contact] = await db.select({ hubspotId: crmContactsTable.hubspotId })
          .from(crmContactsTable).where(eq(crmContactsTable.id, contactId)).limit(1);
        if (!contact?.hubspotId) return;
        const [activity] = await db.select().from(crmActivitiesTable)
          .where(eq(crmActivitiesTable.id, activityId)).limit(1);
        if (activity) {
          await pushActivityToHubSpot(client, activity, contact.hubspotId, activity.dealId
            ? (await db.select({ hubspotId: crmDealsTable.hubspotId }).from(crmDealsTable).where(eq(crmDealsTable.id, activity.dealId)).limit(1))[0]?.hubspotId
            : null, userId);
        }
        break;
      }
      case "task.created":
      case "task.updated": {
        const taskId = payload.taskId as number;
        const contactId = payload.contactId as number;
        if (!taskId || !contactId) return;
        const [contact] = await db.select({ hubspotId: crmContactsTable.hubspotId })
          .from(crmContactsTable).where(eq(crmContactsTable.id, contactId)).limit(1);
        if (!contact?.hubspotId) return;
        const [task] = await db.select().from(crmTasksTable)
          .where(eq(crmTasksTable.id, taskId)).limit(1);
        if (task) {
          const dealHubspotId = task.dealId
            ? (await db.select({ hubspotId: crmDealsTable.hubspotId }).from(crmDealsTable).where(eq(crmDealsTable.id, task.dealId)).limit(1))[0]?.hubspotId
            : null;
          await pushTaskToHubSpot(client, task, contact.hubspotId, dealHubspotId, userId);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[Integration] dispatchToHubSpot(${eventType}) error:`, err);
  }
}

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
          source: "automation",
          sourceRef: `automation:${auto.id}:${triggerType}`,
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

      } else if (auto.actionType === "add_tag" && auto.actionPayload) {
        // Add a tag to the contact
        const payload = auto.actionPayload as { tag?: string };
        if (!payload.tag) continue;
        const [contact] = await db.select({ tags: crmContactsTable.tags })
          .from(crmContactsTable)
          .where(eq(crmContactsTable.id, contactId))
          .limit(1);
        if (!contact) continue;
        const currentTags = contact.tags || [];
        if (!currentTags.includes(payload.tag)) {
          await db.update(crmContactsTable)
            .set({ tags: [...currentTags, payload.tag], updatedAt: new Date() })
            .where(eq(crmContactsTable.id, contactId));
        }

      } else if (auto.actionType === "set_priority" && auto.actionPayload) {
        const payload = auto.actionPayload as { priority?: string };
        if (!payload.priority) continue;
        await db.update(crmContactsTable)
          .set({ prioridadeComercial: payload.priority, updatedAt: new Date() })
          .where(eq(crmContactsTable.id, contactId));

      } else if (auto.actionType === "set_assignee" && auto.actionPayload) {
        const payload = auto.actionPayload as { responsavelUnidade?: string };
        await db.update(crmContactsTable)
          .set({ responsavelUnidade: payload.responsavelUnidade || null, updatedAt: new Date() })
          .where(eq(crmContactsTable.id, contactId));

      } else if (auto.actionType === "create_alert") {
        // Create a persistent alert
        const payload = (auto.actionPayload || {}) as { type?: string; severity?: string; title?: string; description?: string };
        const alertType = payload.type || "followup_vencido";
        const meta = getAlertMeta(alertType as any);
        await db.insert(crmAlertsTable).values({
          userId,
          contactId,
          dealId: dealId ?? null,
          type: alertType,
          severity: payload.severity || meta.severity,
          title: payload.title || `Automação: ${auto.name}`,
          description: payload.description || `Disparada por ${triggerType} = ${currentValue}.`,
          context: { automationId: auto.id, triggerType, currentValue },
          isResolved: false,
        });
      }
    }
  } catch (error) {
    console.error("[Automations] evaluateAutomations error:", error);
  }
}

// ─── Automation Engine — Event-based triggers ────────────────────────────────
// These are evaluated on demand (e.g., during alerts/refresh or scheduled job).
// Returns the number of automations that fired.
async function evaluateEventAutomations(
  userId: string,
  triggerType: "followup_vencido" | "sem_atividade_7d" | "sem_atividade_14d"
    | "matriz_enviado" | "matriz_aguardando" | "matriz_pendencia"
    | "proposta_pronta" | "proposta_enviada" | "proposta_sem_retorno_7d",
  context: { contactId?: number; dealId?: number },
): Promise<number> {
  try {
    const automations = await db.select().from(crmAutomationsTable)
      .where(and(
        eq(crmAutomationsTable.userId, userId),
        eq(crmAutomationsTable.isActive, true),
        eq(crmAutomationsTable.triggerType, triggerType),
      ));
    if (automations.length === 0) return 0;

    let fired = 0;
    for (const auto of automations) {
      const contactId = context.contactId;
      if (!contactId) continue;
      fired++;
      // For event triggers, use the generic flow with triggerValue = "*"
      if (auto.actionType === "create_task" && auto.actionPayload) {
        const payload = auto.actionPayload as any;
        await db.insert(crmTasksTable).values({
          userId, contactId, dealId: context.dealId ?? null,
          title: payload.title || `Tarefa: ${auto.name}`,
          type: payload.type || "call",
          priority: payload.priority || "high",
          status: "pending",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          source: "automation",
          sourceRef: `automation:${auto.id}:${triggerType}`,
        });
      } else if (auto.actionType === "log_activity") {
        await db.insert(crmActivitiesTable).values({
          userId, contactId, dealId: context.dealId ?? null,
          type: "ai_generated",
          subject: `Automação: ${auto.name}`,
          content: `Disparada por evento '${triggerType}'.`,
        });
      } else if (auto.actionType === "create_alert") {
        const payload = (auto.actionPayload || {}) as { type?: string; severity?: string; title?: string; description?: string };
        const alertType = payload.type || "followup_vencido";
        const meta = getAlertMeta(alertType as any);
        await db.insert(crmAlertsTable).values({
          userId, contactId, dealId: context.dealId ?? null,
          type: alertType,
          severity: payload.severity || meta.severity,
          title: payload.title || `Automação: ${auto.name}`,
          description: payload.description || `Disparada por evento '${triggerType}'.`,
          context: { automationId: auto.id, triggerType },
          isResolved: false,
        });
      }
    }
    return fired;
  } catch (err) {
    console.error("[Automations] evaluateEventAutomations error:", err);
    return 0;
  }
}

// ─── Contacts: List ───────────────────────────────────────────────────────────
// GET /api/crm/contacts — expanded filters for Phase 2 operational views
router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const {
      search, status, regime, porte, uf, cidade, scoreMin, scoreMax,
      sort, sortDir, tag, temperatura, setor, segmento, statusMatriz,
      origemLead, loteProspeccao, produtoInteresse, responsavelUnidade,
      followupVencido, semAtividadeDias,
    } = req.query as Record<string, string>;

    const conditions: any[] = [eq(crmContactsTable.userId, userId)];

    // Text search
    if (search) {
      conditions.push(
        or(
          ilike(crmContactsTable.razaoSocial, `%${search}%`),
          ilike(crmContactsTable.cnpj, `%${search}%`),
          ilike(crmContactsTable.nomeFantasia, `%${search}%`)
        )
      );
    }

    // Status & categorical filters
    if (status)          conditions.push(eq(crmContactsTable.status, status));
    if (regime)          conditions.push(eq(crmContactsTable.regimeTributario, regime));
    if (porte)           conditions.push(eq(crmContactsTable.porte, porte));
    if (uf)              conditions.push(ilike(crmContactsTable.uf, `%${uf}%`));
    if (cidade)          conditions.push(ilike(crmContactsTable.cidade, `%${cidade}%`));
    if (temperatura)     conditions.push(eq(crmContactsTable.temperatura, temperatura));
    if (setor)           conditions.push(eq(crmContactsTable.setor, setor));
    if (segmento)        conditions.push(eq(crmContactsTable.segmento, segmento));
    if (origemLead)      conditions.push(eq(crmContactsTable.origemLead, origemLead));
    if (loteProspeccao)  conditions.push(eq(crmContactsTable.loteProspeccao, loteProspeccao));
    if (produtoInteresse) conditions.push(eq(crmContactsTable.produtoInteresse, produtoInteresse));
    if (responsavelUnidade) conditions.push(eq(crmContactsTable.responsavelUnidade, responsavelUnidade));

    // Score range
    const scoreMinNum = safeNumber(scoreMin, { min: 0, max: 100 });
    const scoreMaxNum = safeNumber(scoreMax, { min: 0, max: 100 });
    if (scoreMinNum !== null) conditions.push(gte(crmContactsTable.aiScore, scoreMinNum));
    if (scoreMaxNum !== null) conditions.push(lte(crmContactsTable.aiScore, scoreMaxNum));

    // Tag (lista)
    if (tag) {
      conditions.push(sql`${crmContactsTable.tags} @> ${JSON.stringify([tag])}::jsonb`);
    }

    // Matrix status (via deal subquery)
    if (statusMatriz) {
      conditions.push(sql`${crmContactsTable.id} IN (
        SELECT contact_id FROM ${crmDealsTable} WHERE status_matriz = ${statusMatriz}
      )`);
    }

    // Follow-up vencido (proximo_followup < now AND not null)
    if (followupVencido === "true") {
      conditions.push(sql`${crmContactsTable.proximoFollowup} IS NOT NULL AND ${crmContactsTable.proximoFollowup} < NOW()`);
    }

    // Sem atividade há X dias (ultima_interacao older than X days)
    if (semAtividadeDias) {
      const days = parseInt(semAtividadeDias, 10);
      if (!isNaN(days) && days > 0) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        conditions.push(
          sql`(${crmContactsTable.ultimaInteracao} IS NULL OR ${crmContactsTable.ultimaInteracao} < ${cutoff})`
        );
      }
    }

    // Sorting
    const isAsc = sortDir !== "desc";
    let orderByCol: any = desc(crmContactsTable.createdAt);
    if (sort === "razaoSocial") orderByCol = isAsc ? asc(crmContactsTable.razaoSocial) : desc(crmContactsTable.razaoSocial);
    else if (sort === "aiScore")       orderByCol = isAsc ? asc(crmContactsTable.aiScore) : desc(crmContactsTable.aiScore);
    else if (sort === "status")        orderByCol = isAsc ? asc(crmContactsTable.status) : desc(crmContactsTable.status);
    else if (sort === "createdAt")     orderByCol = isAsc ? asc(crmContactsTable.createdAt) : desc(crmContactsTable.createdAt);
    else if (sort === "temperatura")   orderByCol = isAsc ? asc(crmContactsTable.temperatura) : desc(crmContactsTable.temperatura);
    else if (sort === "setor")         orderByCol = isAsc ? asc(crmContactsTable.setor) : desc(crmContactsTable.setor);
    else if (sort === "proximoFollowup") orderByCol = isAsc ? asc(crmContactsTable.proximoFollowup) : desc(crmContactsTable.proximoFollowup);

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

// ─── Contacts: Summary ────────────────────────────────────────────────────────
// GET /api/crm/contacts/summary — Aggregate contact statistics
// IMPORTANT: must be registered BEFORE /contacts/:id to avoid route conflict
router.get("/contacts/summary", async (req: Request, res: Response) => {
  try {
    const userId = req.userId || "system";
    const contacts = await db
      .select()
      .from(crmContactsTable)
      .where(eq(crmContactsTable.userId, userId));

    const total = contacts.length;
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byUf: Record<string, number> = {};
    const byPorte: Record<string, number> = {};
    let hotLeads = 0;
    let prospects = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let recentContacts = 0;

    for (const c of contacts) {
      const status = c.status || "unknown";
      byStatus[status] = (byStatus[status] || 0) + 1;

      const source = c.source || "manual";
      bySource[source] = (bySource[source] || 0) + 1;

      if (c.uf) byUf[c.uf] = (byUf[c.uf] || 0) + 1;
      if (c.porte) byPorte[c.porte] = (byPorte[c.porte] || 0) + 1;

      if ((c.aiScore ?? 0) >= 70) hotLeads++;
      if (c.status === "prospect" || c.status === "new") prospects++;
      if (new Date(c.createdAt) >= sevenDaysAgo) recentContacts++;
    }

    res.json({
      success: true,
      summary: { total, byStatus, bySource, byUf, byPorte, hotLeads, prospects, recentContacts },
    });
  } catch (err: any) {
    apiError(res, 500, "Failed to get contacts summary");
  }
});

// ─── Contacts: Bulk Temperature Update ─────────────────────────────────────
// POST /api/crm/contacts/bulk-update-temperature  body: { ids: number[], temperatura: string }
router.post("/contacts/bulk-update-temperature", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { ids, temperatura } = req.body as { ids: number[]; temperatura: string };
    if (!Array.isArray(ids) || ids.length === 0 || !temperatura) {
      apiError(res, 400, "ids e temperatura são obrigatórios."); return;
    }
    await db.update(crmContactsTable)
      .set({ temperatura, updatedAt: new Date() })
      .where(and(inArray(crmContactsTable.id, ids), eq(crmContactsTable.userId, userId)));
    res.json({ success: true, updated: ids.length });
  } catch (err: any) {
    apiError(res, 500, "Bulk temperature update failed");
  }
});

// ─── Contacts: Bulk Assign ──────────────────────────────────────────────────
// POST /api/crm/contacts/bulk-assign  body: { ids: number[], responsavelUnidade: string }
router.post("/contacts/bulk-assign", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { ids, responsavelUnidade } = req.body as { ids: number[]; responsavelUnidade: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      apiError(res, 400, "ids é obrigatório."); return;
    }
    await db.update(crmContactsTable)
      .set({ responsavelUnidade: responsavelUnidade || null, updatedAt: new Date() })
      .where(and(inArray(crmContactsTable.id, ids), eq(crmContactsTable.userId, userId)));
    res.json({ success: true, updated: ids.length });
  } catch (err: any) {
    apiError(res, 500, "Bulk assign failed");
  }
});

// ─── Contacts: Bulk Follow-up Update ────────────────────────────────────────
// POST /api/crm/contacts/bulk-update-followup  body: { ids: number[], proximoFollowup: string | null }
router.post("/contacts/bulk-update-followup", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { ids, proximoFollowup } = req.body as { ids: number[]; proximoFollowup: string | null };
    if (!Array.isArray(ids) || ids.length === 0) {
      apiError(res, 400, "ids é obrigatório."); return;
    }
    const dateVal = proximoFollowup ? new Date(proximoFollowup) : null;
    await db.update(crmContactsTable)
      .set({ proximoFollowup: dateVal, updatedAt: new Date() })
      .where(and(inArray(crmContactsTable.id, ids), eq(crmContactsTable.userId, userId)));
    res.json({ success: true, updated: ids.length });
  } catch (err: any) {
    apiError(res, 500, "Bulk followup update failed");
  }
});

// ─── Contacts: Get Distinct Values (for filter dropdowns) ────────────────────
// GET /api/crm/contacts/distinct-values?field=setor
router.get("/contacts/distinct-values", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { field } = req.query as { field: string };
    const allowedFields = ["setor", "segmento", "origemLead", "loteProspeccao", "responsavelUnidade", "cidade", "uf"];
    if (!allowedFields.includes(field)) {
      apiError(res, 400, `Campo inválido. Permitidos: ${allowedFields.join(", ")}`); return;
    }
    const result = await db.execute(sql`
      SELECT DISTINCT ${sql.raw(`"${field}"`)} as value
      FROM ${crmContactsTable}
      WHERE user_id = ${userId} AND ${sql.raw(`"${field}"`)} IS NOT NULL AND ${sql.raw(`"${field}"`)} != ''
      ORDER BY ${sql.raw(`"${field}"`)}
    `);
    const values = result.rows.map((r: any) => r.value).filter(Boolean);
    res.json({ success: true, values });
  } catch (err: any) {
    apiError(res, 500, "Failed to fetch distinct values");
  }
});

// ─── Contacts: Get by ID ──────────────────────────────────────────────────────
router.get("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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

    const allowedContactFields = [
      "razaoSocial","nomeFantasia","regimeTributario","cnae","faturamentoEstimado","porte","uf","cidade","endereco","cep","telefone","email","website","nomeDecissor","cargoDecissor","socios","tags","customFields","status","aiScore","aiScoreDetails","aiRecommendedProduct",
      "origemLead","setor","segmento","temperatura","produtoInteresse","valorPotencial",
      "decisor","contatoDecissor","influenciadores",
      "loteProspeccao","responsavelUnidade",
      "observacoes",
    ] as const;
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

    // Background: enrich + integration event
    setImmediate(() => {
      enrichContact(newContact.id, userId).catch((err: Error) =>
        console.error("[Enrichment] Background enrich failed for contact", newContact.id, err)
      );
    });
    fireIntegrationEvent("lead.created", {
      contactId: newContact.id,
      cnpj: newContact.cnpj,
      razaoSocial: newContact.razaoSocial,
      status: newContact.status,
      source: newContact.source,
      uf: newContact.uf,
    }, userId);
  } catch (err: any) {
    apiError(res, 400, "Failed to create contact");
  }
});

// ─── Contacts: Update ─────────────────────────────────────────────────────────
router.put("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    
    // Check if status changed for automation
    const [oldContact] = await db.select({ status: crmContactsTable.status }).from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));

    const allowedContactFields = [
      "razaoSocial","nomeFantasia","regimeTributario","cnae","faturamentoEstimado","porte","uf","cidade","endereco","cep","telefone","email","website","nomeDecissor","cargoDecissor","socios","tags","customFields","status","aiScore","aiScoreDetails","aiRecommendedProduct",
      "origemLead","setor","segmento","temperatura","produtoInteresse","valorPotencial",
      "decisor","contatoDecissor","influenciadores",
      "loteProspeccao","responsavelUnidade",
      "observacoes",
    ] as const;
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

    // Re-evaluate next step (Phase 3)
    setImmediate(() => evaluateNextStepsForContact(userId, updated.id));

    res.json({ success: true, contact: updated });
    fireIntegrationEvent("contact.updated", {
      contactId: updated.id,
      cnpj: updated.cnpj,
      razaoSocial: updated.razaoSocial,
      status: updated.status,
    }, userId);
  } catch (err: any) {
    apiError(res, 400, "Failed to update contact");
  }
});

// ─── Contacts: Delete ─────────────────────────────────────────────────────────
router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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

// ─── Contacts: Qualify via IA (Phase 3 — Estruturada) ──────────────────────
router.post("/contacts/:id/qualify", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, Number(req.params.id)), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    const agent = getAgentById("qualificacao-leads-tax-group") || getAgentById("coordenador-geral-tax-group");
    if (!agent) { apiError(res, 500, "Qualification agent not found"); return; }

    const prompt = buildQualificationPrompt(contact as any);
    const result = await callLLM(`${agent.systemPrompt}\n\n${SYSTEM_INSTRUCTIONS}`, prompt, {});

    let rawJson: any = {};
    try {
      const match = result.output.match(/\{[\s\S]*\}/);
      if (match) rawJson = JSON.parse(match[0]);
    } catch { /* keep empty */ }

    const qualification = parseQualificationResult(rawJson, result.output);

    // Persist in history (immutable record)
    await db.insert(crmQualificationHistoryTable).values({
      userId,
      contactId: contact.id,
      score: qualification.score,
      tier: qualification.tier,
      confidence: qualification.confidence,
      result: qualification as any,
      agentId: agent.id,
    }).catch(() => {});

    // Apply key fields back to contact
    const newStatus = (qualification.tier === "A" || qualification.tier === "B")
      ? "qualificado"
      : contact.status;

    const [updated] = await db.update(crmContactsTable)
      .set({
        aiScore: qualification.score,
        aiScoreDetails: qualification as any,
        aiRecommendedProduct: qualification.produto_recomendado,
        status: newStatus,
        temperatura: contact.temperatura || qualification.temperatura_sugerida,
        setor: contact.setor || qualification.setor_inferido,
        segmento: contact.segmento || qualification.segmento_inferido,
        updatedAt: new Date(),
      })
      .where(eq(crmContactsTable.id, contact.id))
      .returning();

    // Trigger score automations
    if (updated.aiScore !== null) {
      await evaluateAutomations(userId, updated.id, "score_above", updated.aiScore);
      await evaluateAutomations(userId, updated.id, "score_below", updated.aiScore);
    }
    if (updated.status !== contact.status) {
      await evaluateAutomations(userId, updated.id, "status_changed", updated.status);
    }

    await db.insert(crmActivitiesTable).values({
      contactId: contact.id, userId, type: "ai_generated",
      subject: `Qualificação IA — Score ${qualification.score}/100 (Tier ${qualification.tier}, Conf. ${qualification.confidence}%)`,
      content: result.output, completedAt: new Date(), agentId: agent.id,
    }).catch(() => {});

    let dealCreated = false;
    if (["A", "B", "C"].includes(qualification.tier)) {
      const [existingDeal] = await db.select({ id: crmDealsTable.id }).from(crmDealsTable)
        .where(and(eq(crmDealsTable.contactId, contact.id), eq(crmDealsTable.userId, userId)));
      if (!existingDeal) {
        const stage = qualification.tier === "A" ? "diagnostico_comercial" : "qualificacao_comercial";
        const probability = qualification.tier === "A" ? 40 : (qualification.tier === "B" ? 20 : 10);
        await db.insert(crmDealsTable).values({
          contactId: contact.id, userId,
          title: `Oportunidade - ${contact.razaoSocial || contact.cnpj}`,
          value: "50000", stage, probability,
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }).catch(() => {});
        dealCreated = true;
      }
    }

    res.json({ success: true, contact: updated, qualification, dealCreated });

    if (updated.aiScore !== null && updated.aiScore >= 60) {
      fireIntegrationEvent("lead.qualified", {
        contactId: updated.id,
        cnpj: updated.cnpj,
        razaoSocial: updated.razaoSocial,
        score: updated.aiScore,
        tier: qualification.tier,
        recommendedProducts: qualification.produto_recomendado ? [qualification.produto_recomendado] : [],
        nextAction: qualification.proximo_passo,
        status: updated.status,
        dealCreated,
      }, userId);
    }
  } catch (err: any) {
    console.error("[crm] qualify failed:", err);
    apiError(res, 500, "Qualification failed");
  }
});

// ─── Contacts: Qualification History ────────────────────────────────────────
// GET /api/crm/contacts/:id/qualification-history
router.get("/contacts/:id/qualification-history", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const rows = await db.select()
      .from(crmQualificationHistoryTable)
      .where(and(
        eq(crmQualificationHistoryTable.contactId, Number(req.params.id)),
        eq(crmQualificationHistoryTable.userId, userId),
      ))
      .orderBy(desc(crmQualificationHistoryTable.createdAt))
      .limit(20);
    res.json({ success: true, history: rows });
  } catch (err: any) {
    apiError(res, 500, "Failed to fetch qualification history");
  }
});

// ─── Deals: Pipeline Kanban ───────────────────────────────────────────────────
// GET /api/crm/deals/pipeline — inclui razaoSocial e cnpj do contato via LEFT JOIN
router.get("/deals/pipeline", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
        name: DEFAULT_PIPELINE_NAME,
        stages: [...PIPELINE_TAX_GROUP_STAGES],
      };
    }

    const stages = pipelineMeta?.stages || [...PIPELINE_TAX_GROUP_STAGES];

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

    // Normalize stages: handle both string[] and object[] (e.g. [{name: "Novo Lead", order: 1}])
    const normalizedStages: string[] = stages.map((s: any) =>
      typeof s === "string" ? s : (s?.name || String(s))
    );

    const pipeline: Record<string, any[]> = {};
    for (const s of normalizedStages) pipeline[s] = deals.filter((d: typeof deals[number]) => d.stage === s);

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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
    const allowedDealFields = [
      "contactId","pipelineId","title","produto","stage","value","probability","expectedCloseDate","customFields","lostReason","wonAt","lostAt","assignedTo","notes","conversationId",
      "origem","resumoDiagnosticoComercial",
      "briefingMatriz","dataEnvioMatriz","responsavelEnvioMatriz","prazoRetornoMatriz",
      "statusMatriz","documentosEnviados",
      "statusProposta","observacoesNegociacao",
    ] as const;
    const [deal] = await db.insert(crmDealsTable).values({ ...pick(req.body, allowedDealFields), userId } as any).returning();
    res.status(201).json({ success: true, deal });
    fireIntegrationEvent("deal.created", {
      dealId: deal.id,
      contactId: deal.contactId,
      title: deal.title,
      stage: deal.stage,
      value: deal.value,
      produto: deal.produto,
    }, userId);
  } catch (err: any) {
    apiError(res, 400, "Failed to create deal");
  }
});

router.put("/deals/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const [oldDeal] = await db.select().from(crmDealsTable)
      .where(and(eq(crmDealsTable.id, Number(req.params.id)), eq(crmDealsTable.userId, userId)));
    if (!oldDeal) { apiError(res, 404, "Deal not found"); return; }

    const body = req.body;
    if (body.stage && body.stage !== oldDeal.stage) {
      if (body.stage === "won" && !body.wonAt) body.wonAt = new Date();
      if (body.stage === "lost" && !body.lostAt) body.lostAt = new Date();
    }

    const allowedDealFields = [
      "contactId","pipelineId","title","produto","stage","value","probability","expectedCloseDate","customFields","lostReason","wonAt","lostAt","assignedTo","notes","conversationId",
      "origem","resumoDiagnosticoComercial",
      "briefingMatriz","dataEnvioMatriz","responsavelEnvioMatriz","prazoRetornoMatriz",
      "statusMatriz","documentosEnviados",
      "statusProposta","observacoesNegociacao",
    ] as const;
    const [deal] = await db.update(crmDealsTable)
      .set({ ...pick(body, allowedDealFields), updatedAt: new Date() })
      .where(eq(crmDealsTable.id, oldDeal.id))
      .returning();

    // ── Status sync: deal stage → contact status ────────────────────────────────
    if (deal && body.stage && body.stage !== oldDeal.stage) {
      const newContactStatus = DEAL_STAGE_TO_CONTACT_STATUS[body.stage as keyof typeof DEAL_STAGE_TO_CONTACT_STATUS];
      if (newContactStatus) {
        const [currentContact] = await db.select({ status: crmContactsTable.status })
          .from(crmContactsTable)
          .where(eq(crmContactsTable.id, deal.contactId))
          .limit(1);

        // When "fechado_ganho" → always set to "cliente"
        // When "perdido" → set to "perdido" only if not already "cliente"
        const shouldUpdate =
          (body.stage === "fechado_ganho") ||
          (body.stage === "perdido" && currentContact?.status !== "cliente");

        if (shouldUpdate) {
          await db.update(crmContactsTable)
            .set({ status: newContactStatus, updatedAt: new Date() })
            .where(eq(crmContactsTable.id, deal.contactId));
        }
      }
    }

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

        // Integration event fan-out
        const stageEventType = body.stage === "won" ? "deal.won"
          : body.stage === "lost" ? "deal.lost"
          : "deal.stage_changed";
        fireIntegrationEvent(stageEventType, {
          dealId: deal.id,
          contactId: deal.contactId,
          title: deal.title,
          previousStage: oldDeal.stage,
          newStage: deal.stage,
          value: deal.value,
          produto: deal.produto,
          lostReason: deal.lostReason,
        }, userId);

        // Phase 3: trigger Matriz event automations
        if (deal.statusMatriz === "enviado" || deal.statusMatriz === "aguardando") {
          setImmediate(() => evaluateEventAutomations(userId, "matriz_aguardando", { contactId: deal.contactId, dealId: deal.id }));
        }
        if (deal.statusMatriz === "pendencia_documental") {
          setImmediate(() => evaluateEventAutomations(userId, "matriz_pendencia", { contactId: deal.contactId, dealId: deal.id }));
        }
        if (deal.statusProposta === "proposta_pronta") {
          setImmediate(() => evaluateEventAutomations(userId, "proposta_pronta", { contactId: deal.contactId, dealId: deal.id }));
        }
        if (deal.statusProposta === "proposta_enviada") {
          setImmediate(() => evaluateEventAutomations(userId, "proposta_enviada", { contactId: deal.contactId, dealId: deal.id }));
        }
      } catch { /* non-fatal */ }
    }

    // Phase 3: re-evaluate next step after any deal change
    setImmediate(() => evaluateNextStepsForContact(userId, deal.contactId));

    res.json({ success: true, deal });
  } catch (err: any) {
    apiError(res, 400, "Failed to update deal");
  }
});

router.delete("/deals/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
    const allowedActivityFields = ["dealId","type","direction","subject","content","scheduledAt","completedAt","agentId","conversationId"] as const;
    const [activity] = await db.insert(crmActivitiesTable)
      .values({ ...pick(req.body, allowedActivityFields), contactId: Number(req.params.id), userId } as any)
      .returning();
    res.status(201).json({ success: true, activity });
    fireIntegrationEvent("activity.created", {
      activityId: activity.id,
      contactId: Number(req.params.id),
      dealId: activity.dealId,
      type: activity.type,
    }, userId);
  } catch (err: any) {
    apiError(res, 400, "Failed to create activity");
  }
});

// ─── Attachments ──────────────────────────────────────────────────────────────
router.get("/contacts/:id/attachments", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
    const allowedTaskFields = ["contactId","dealId","title","description","type","priority","status","dueDate","reminderAt","assignedTo","completedAt","conversationId"] as const;
    const [task] = await db.insert(crmTasksTable)
      .values({ ...pick(req.body, allowedTaskFields), userId } as any)
      .returning();
    res.status(201).json({ success: true, task });
    if (task.contactId) {
      fireIntegrationEvent("task.created", {
        taskId: task.id,
        contactId: task.contactId,
        dealId: task.dealId,
        title: task.title,
      }, userId);
    }
  } catch (err: any) {
    apiError(res, 400, "Failed to create task");
  }
});

router.put("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const body = req.body;
    if (body.status === "done" && !body.completedAt) body.completedAt = new Date();
    const allowedTaskFields = ["contactId","dealId","title","description","type","priority","status","dueDate","reminderAt","assignedTo","completedAt","conversationId"] as const;
    const [task] = await db.update(crmTasksTable)
      .set({ ...pick(body, allowedTaskFields), updatedAt: new Date() })
      .where(and(eq(crmTasksTable.id, Number(req.params.id)), eq(crmTasksTable.userId, userId)))
      .returning();
    if (!task) { apiError(res, 404, "Task not found"); return; }
    res.json({ success: true, task });
    if (task.contactId) {
      fireIntegrationEvent("task.updated", {
        taskId: task.id,
        contactId: task.contactId,
        dealId: task.dealId,
        title: task.title,
        status: task.status,
      }, userId);
    }
  } catch (err: any) {
    apiError(res, 400, "Failed to update task");
  }
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
    
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
    const allowedViewFields = ["name","emoji","filters","isDefault","sortField","sortDir","type","isSystem","category"] as const;
    const [view] = await db.insert(crmSavedViewsTable)
      .values({ ...pick(req.body, allowedViewFields), userId } as any)
      .returning();
    res.status(201).json({ success: true, view });
  } catch (err: any) {
    apiError(res, 400, "Failed to create view");
  }
});

router.put("/views/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const allowedViewFields = ["name","emoji","filters","isDefault","sortField","sortDir","type","isSystem","category"] as const;
    const [view] = await db.update(crmSavedViewsTable)
      .set({ ...pick(req.body, allowedViewFields) })
      .where(and(eq(crmSavedViewsTable.id, Number(req.params.id)), eq(crmSavedViewsTable.userId, userId)))
      .returning();
    if (!view) { apiError(res, 404, "View not found"); return; }
    res.json({ success: true, view });
  } catch (err: any) {
    apiError(res, 400, "Failed to update view");
  }
});

// ─── Views: Seed System Views ────────────────────────────────────────────────
// POST /api/crm/views/seed-system — inserts missing system views for the user
router.post("/views/seed-system", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { SYSTEM_VIEWS } = await import("@workspace/db/crm-constants");

    // Get existing system view names for this user
    const existing = await db.select({ name: crmSavedViewsTable.name })
      .from(crmSavedViewsTable)
      .where(and(eq(crmSavedViewsTable.userId, userId), eq(crmSavedViewsTable.type, "system")));
    const existingNames = new Set(existing.map(v => v.name));

    const toInsert = SYSTEM_VIEWS
      .filter(sv => !existingNames.has(sv.name))
      .map(sv => ({
        userId,
        name: sv.name,
        emoji: sv.emoji,
        filters: sv.filters,
        type: "system" as const,
        isSystem: true,
        category: sv.category,
      }));

    if (toInsert.length > 0) {
      await db.insert(crmSavedViewsTable).values(toInsert);
    }

    // Return all views for user
    const views = await db.select().from(crmSavedViewsTable)
      .where(eq(crmSavedViewsTable.userId, userId))
      .orderBy(asc(crmSavedViewsTable.createdAt));

    res.json({ success: true, views, seeded: toInsert.length });
  } catch (err: any) {
    apiError(res, 500, "Failed to seed system views");
  }
});

router.delete("/views/:id", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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

    const stageOrder = [...PIPELINE_TAX_GROUP_STAGES];
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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
    const userId = requireUserId(req);
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

// ─── Operational Summary (TodayView) ────────────────────────────────────────
// GET /api/crm/operational-summary — returns counts for daily operations dashboard
router.get("/operational-summary", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Fetch contacts + deals + tasks in parallel
    const [contacts, deals, tasks] = await Promise.all([
      db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
      db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
      db.select().from(crmTasksTable).where(eq(crmTasksTable.userId, userId)),
    ]);

    // Follow-ups vencidos
    const followupVencidos = contacts.filter(c =>
      c.proximoFollowup && new Date(c.proximoFollowup) < now && c.status !== "cliente" && c.status !== "perdido"
    ).length;

    // Follow-ups de hoje
    const followupHoje = contacts.filter(c => {
      if (!c.proximoFollowup) return false;
      const d = new Date(c.proximoFollowup);
      return d >= todayStart && d <= todayEnd;
    }).length;

    // Reuniões de hoje (tasks de tipo meeting com dueDate hoje)
    const reunioesHoje = tasks.filter(t =>
      t.type === "meeting" && t.dueDate &&
      new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd &&
      t.status !== "done"
    ).length;

    // Tarefas vencidas
    const tarefasVencidas = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status === "pending"
    ).length;

    // Sem atividade 7 dias
    const semAtividade7d = contacts.filter(c => {
      if (c.status === "cliente" || c.status === "perdido" || c.status === "encerrado") return false;
      return !c.ultimaInteracao || new Date(c.ultimaInteracao) < sevenDaysAgo;
    }).length;

    // Sem atividade 14 dias
    const semAtividade14d = contacts.filter(c => {
      if (c.status === "cliente" || c.status === "perdido" || c.status === "encerrado") return false;
      return !c.ultimaInteracao || new Date(c.ultimaInteracao) < fourteenDaysAgo;
    }).length;

    // Aguardando Matriz
    const aguardandoMatriz = deals.filter(d =>
      d.statusMatriz === "aguardando" || d.statusMatriz === "enviado"
    ).length;

    // Pendência documental
    const pendenciaDocumental = deals.filter(d =>
      d.statusMatriz === "pendencia_documental"
    ).length;

    // Propostas abertas
    const propostasAbertas = deals.filter(d =>
      d.statusProposta === "proposta_enviada" || d.stage === "proposta_enviada"
    ).length;

    // Em negociação
    const emNegociacao = deals.filter(d =>
      d.stage === "em_negociacao"
    ).length;

    // Leads novos (últimas 24h)
    const leadsNovos24h = contacts.filter(c => {
      const created = new Date(c.createdAt);
      return (now.getTime() - created.getTime()) < 24 * 60 * 60 * 1000;
    }).length;

    // Leads quentes (score >= 70)
    const leadsQuentes = contacts.filter(c =>
      (c.aiScore ?? 0) >= 70 && c.status !== "cliente" && c.status !== "perdido"
    ).length;

    res.json({
      success: true,
      summary: {
        followupVencidos,
        followupHoje,
        reunioesHoje,
        tarefasVencidas,
        semAtividade7d,
        semAtividade14d,
        aguardandoMatriz,
        pendenciaDocumental,
        propostasAbertas,
        emNegociacao,
        leadsNovos24h,
        leadsQuentes,
        totalContatos: contacts.length,
        totalDeals: deals.length,
      },
    });
  } catch (err: any) {
    apiError(res, 500, "Failed to get operational summary");
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 3 — IA, AUTOMAÇÕES, ALERTAS
// ════════════════════════════════════════════════════════════════════════════════

// ─── Next Step Recommendation ────────────────────────────────────────────────
// GET /api/crm/contacts/:id/next-step
router.get("/contacts/:id/next-step", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const contactId = Number(req.params.id);
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, contactId), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    // Get primary deal (first one for this contact)
    const [deal] = await db.select().from(crmDealsTable)
      .where(and(eq(crmDealsTable.contactId, contactId), eq(crmDealsTable.userId, userId)))
      .orderBy(desc(crmDealsTable.updatedAt))
      .limit(1);

    const [hasOpenTask] = await db.select({ id: crmTasksTable.id }).from(crmTasksTable)
      .where(and(
        eq(crmTasksTable.contactId, contactId),
        eq(crmTasksTable.userId, userId),
        eq(crmTasksTable.status, "pending"),
      )).limit(1);

    const hasProposal = !!(deal && (
      deal.statusProposta === "proposta_enviada"
      || deal.statusProposta === "proposta_pronta"
      || deal.statusProposta === "proposta_apresentada"
      || deal.statusProposta === "em_negociacao"
      || deal.statusMatriz === "proposta_liberada"
    ));

    const rec = recommendNextStep({
      contact: {
        status: contact.status,
        temperatura: contact.temperatura,
        proximoFollowup: contact.proximoFollowup,
        ultimaInteracao: contact.ultimaInteracao,
        pendenciasCliente: contact.pendenciasCliente,
        responsavelUnidade: contact.responsavelUnidade,
      },
      deal: deal ? {
        stage: deal.stage,
        statusMatriz: deal.statusMatriz,
        statusProposta: deal.statusProposta,
        briefingMatriz: deal.briefingMatriz,
        dataEnvioMatriz: deal.dataEnvioMatriz,
        prazoRetornoMatriz: deal.prazoRetornoMatriz,
      } : null,
      hasProposal,
      hasOpenTasks: !!hasOpenTask,
    });

    res.json({ success: true, recommendation: rec, contactId });
  } catch (err: any) {
    apiError(res, 500, "Failed to compute next step");
  }
});

// ─── Next Step: Accept (cria tarefa a partir da recomendação) ────────────────
// POST /api/crm/contacts/:id/next-step/accept
router.post("/contacts/:id/next-step/accept", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const contactId = Number(req.params.id);
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, contactId), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    const [deal] = await db.select().from(crmDealsTable)
      .where(and(eq(crmDealsTable.contactId, contactId), eq(crmDealsTable.userId, userId)))
      .orderBy(desc(crmDealsTable.updatedAt))
      .limit(1);

    const [hasOpenTask] = await db.select({ id: crmTasksTable.id }).from(crmTasksTable)
      .where(and(
        eq(crmTasksTable.contactId, contactId),
        eq(crmTasksTable.userId, userId),
        eq(crmTasksTable.status, "pending"),
      )).limit(1);

    const hasProposal = !!(deal && (
      deal.statusProposta === "proposta_enviada"
      || deal.statusProposta === "proposta_pronta"
      || deal.statusProposta === "proposta_apresentada"
      || deal.statusProposta === "em_negociacao"
      || deal.statusMatriz === "proposta_liberada"
    ));

    const rec = recommendNextStep({
      contact: {
        status: contact.status,
        temperatura: contact.temperatura,
        proximoFollowup: contact.proximoFollowup,
        ultimaInteracao: contact.ultimaInteracao,
        pendenciasCliente: contact.pendenciasCliente,
        responsavelUnidade: contact.responsavelUnidade,
      },
      deal: deal ? {
        stage: deal.stage,
        statusMatriz: deal.statusMatriz,
        statusProposta: deal.statusProposta,
        briefingMatriz: deal.briefingMatriz,
        dataEnvioMatriz: deal.dataEnvioMatriz,
        prazoRetornoMatriz: deal.prazoRetornoMatriz,
      } : null,
      hasProposal,
      hasOpenTasks: !!hasOpenTask,
    });

    if (!rec.taskTemplate) {
      apiError(res, 400, "Esta recomendação não gera tarefa."); return;
    }

    const dueDate = new Date(Date.now() + rec.taskTemplate.dueInDays * 24 * 60 * 60 * 1000);
    const priorityMap: Record<string, string> = {
      baixa: "low", media: "medium", alta: "high", urgente: "urgent",
    };

    const [task] = await db.insert(crmTasksTable).values({
      userId,
      contactId,
      dealId: deal?.id ?? null,
      title: rec.taskTemplate.title,
      type: rec.taskTemplate.type,
      priority: priorityMap[rec.priority] || "medium",
      status: "pending",
      dueDate,
      source: "next_step",
      sourceRef: rec.action,
    }).returning();

    // Mark recommendation as accepted in history
    await db.insert(crmNextStepHistoryTable).values({
      userId, contactId, dealId: deal?.id ?? null,
      action: rec.action, reason: rec.reason, priority: rec.priority, accepted: true,
    });

    res.status(201).json({ success: true, task, recommendation: rec });
  } catch (err: any) {
    apiError(res, 500, "Failed to accept next step");
  }
});

// ─── Next Step: Ignore ────────────────────────────────────────────────────────
// POST /api/crm/contacts/:id/next-step/ignore
router.post("/contacts/:id/next-step/ignore", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const contactId = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    await db.insert(crmNextStepHistoryTable).values({
      userId, contactId,
      action: "sem_acao_no_momento",
      reason: reason || "Usuário ignorou a recomendação",
      priority: "baixa",
      accepted: false,
    });
    res.json({ success: true });
  } catch (err: any) {
    apiError(res, 500, "Failed to ignore next step");
  }
});

// ─── Alerts: List (with filtering) ───────────────────────────────────────────
// GET /api/crm/alerts?severity=&type=&includeResolved=false
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { severity, type, includeResolved } = req.query as Record<string, string>;
    const conditions: any[] = [eq(crmAlertsTable.userId, userId)];
    if (includeResolved !== "true") conditions.push(eq(crmAlertsTable.isResolved, false));
    if (severity) conditions.push(eq(crmAlertsTable.severity, severity));
    if (type) conditions.push(eq(crmAlertsTable.type, type));

    const alertsRaw = await db.select({
      alert: crmAlertsTable,
      contact: {
        id: crmContactsTable.id,
        razaoSocial: crmContactsTable.razaoSocial,
        cnpj: crmContactsTable.cnpj,
        status: crmContactsTable.status,
      },
    })
      .from(crmAlertsTable)
      .leftJoin(crmContactsTable, eq(crmAlertsTable.contactId, crmContactsTable.id))
      .where(and(...conditions))
      .orderBy(desc(crmAlertsTable.createdAt))
      .limit(200);

    const alerts = alertsRaw.map(r => ({
      ...r.alert,
      meta: r.alert.type ? getAlertMeta(r.alert.type as any) : null,
      contact: r.contact,
    }));

    res.json({ success: true, alerts, total: alerts.length });
  } catch (err: any) {
    apiError(res, 500, "Failed to list alerts");
  }
});

// ─── Alerts: Resolve ─────────────────────────────────────────────────────────
// POST /api/crm/alerts/:id/resolve
router.post("/alerts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const [updated] = await db.update(crmAlertsTable)
      .set({ isResolved: true, resolvedAt: new Date(), resolvedBy: userId })
      .where(and(eq(crmAlertsTable.id, Number(req.params.id)), eq(crmAlertsTable.userId, userId)))
      .returning();
    if (!updated) { apiError(res, 404, "Alert not found"); return; }
    res.json({ success: true, alert: updated });
  } catch (err: any) {
    apiError(res, 500, "Failed to resolve alert");
  }
});

// ─── Alerts: Convert to Task ─────────────────────────────────────────────────
// POST /api/crm/alerts/:id/convert-to-task
router.post("/alerts/:id/convert-to-task", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const [alert] = await db.select().from(crmAlertsTable)
      .where(and(eq(crmAlertsTable.id, Number(req.params.id)), eq(crmAlertsTable.userId, userId)));
    if (!alert) { apiError(res, 404, "Alert not found"); return; }

    const priorityMap: Record<string, string> = {
      info: "low", warning: "medium", critical: "high",
    };
    const [task] = await db.insert(crmTasksTable).values({
      userId,
      contactId: alert.contactId,
      dealId: alert.dealId,
      title: alert.title,
      description: alert.description,
      type: "note",
      priority: priorityMap[alert.severity] || "medium",
      status: "pending",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      source: "automation",
      sourceRef: `alert:${alert.id}:${alert.type}`,
    }).returning();

    // Mark alert as resolved
    await db.update(crmAlertsTable)
      .set({ isResolved: true, resolvedAt: new Date(), resolvedBy: userId })
      .where(eq(crmAlertsTable.id, alert.id));

    res.status(201).json({ success: true, task });
  } catch (err: any) {
    apiError(res, 500, "Failed to convert alert to task");
  }
});

// ─── Alerts: Refresh (re-evaluate and create new ones) ──────────────────────
// POST /api/crm/alerts/refresh
router.post("/alerts/refresh", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const [contacts, deals, existingAlerts] = await Promise.all([
      db.select().from(crmContactsTable).where(eq(crmContactsTable.userId, userId)),
      db.select().from(crmDealsTable).where(eq(crmDealsTable.userId, userId)),
      db.select().from(crmAlertsTable).where(and(
        eq(crmAlertsTable.userId, userId),
        eq(crmAlertsTable.isResolved, false),
      )),
    ]);

    const candidates = evaluateAlerts(contacts as any, deals as any);

    // Dedupe: only create alerts that don't already exist (by type + contactId + dealId)
    const existingKeys = new Set(existingAlerts.map(a =>
      `${a.type}:${a.contactId}:${a.dealId ?? ""}`));

    const toInsert = candidates
      .filter(c => !existingKeys.has(`${c.type}:${c.contactId}:${c.dealId ?? ""}`))
      .map(c => ({
        userId,
        contactId: c.contactId,
        dealId: c.dealId,
        type: c.type,
        severity: getAlertMeta(c.type).severity,
        title: c.title,
        description: c.description,
        context: c.context,
        isResolved: false,
      }));

    if (toInsert.length > 0) {
      await db.insert(crmAlertsTable).values(toInsert);
    }

    // Fire event-based automations for followup_vencido, sem_atividade, etc.
    const followupAlerts = candidates.filter(c => c.type === "followup_vencido");
    const semAtividade7d = candidates.filter(c => c.type === "sem_atividade_7d");
    const semAtividade14d = candidates.filter(c => c.type === "sem_atividade_14d");
    const matrizAlerts = candidates.filter(c => c.type === "matriz_acima_prazo");
    const pendenciaAlerts = candidates.filter(c => c.type === "pendencia_documental_parada");
    const propostaAlerts = candidates.filter(c => c.type === "proposta_sem_retorno");

    let automationsFired = 0;
    for (const a of followupAlerts) {
      if (a.contactId) automationsFired += await evaluateEventAutomations(userId, "followup_vencido", { contactId: a.contactId, dealId: a.dealId ?? undefined });
    }
    for (const a of semAtividade7d) {
      if (a.contactId) automationsFired += await evaluateEventAutomations(userId, "sem_atividade_7d", { contactId: a.contactId, dealId: a.dealId ?? undefined });
    }
    for (const a of semAtividade14d) {
      if (a.contactId) automationsFired += await evaluateEventAutomations(userId, "sem_atividade_14d", { contactId: a.contactId, dealId: a.dealId ?? undefined });
    }
    for (const a of matrizAlerts) {
      if (a.contactId) automationsFired += await evaluateEventAutomations(userId, "matriz_aguardando", { contactId: a.contactId, dealId: a.dealId ?? undefined });
    }
    for (const a of pendenciaAlerts) {
      if (a.contactId) automationsFired += await evaluateEventAutomations(userId, "matriz_pendencia", { contactId: a.contactId, dealId: a.dealId ?? undefined });
    }
    for (const a of propostaAlerts) {
      if (a.contactId) automationsFired += await evaluateEventAutomations(userId, "proposta_sem_retorno_7d", { contactId: a.contactId, dealId: a.dealId ?? undefined });
    }

    res.json({ success: true, created: toInsert.length, evaluated: candidates.length, automationsFired });
  } catch (err: any) {
    apiError(res, 500, "Failed to refresh alerts");
  }
});

// ─── Briefing Checklist (Matriz) ─────────────────────────────────────────────
// GET /api/crm/contacts/:id/briefing-checklist
router.get("/contacts/:id/briefing-checklist", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const contactId = Number(req.params.id);
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, contactId), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    // Check each field in the checklist
    const [latestDeal] = await db.select({ resumo: crmDealsTable.resumoDiagnosticoComercial })
      .from(crmDealsTable)
      .where(eq(crmDealsTable.contactId, contactId))
      .orderBy(desc(crmDealsTable.updatedAt))
      .limit(1);

    const checklist = MATRIZ_BRIEFING_CHECKLIST.map(item => {
      let value: any = null;
      let present = false;
      switch (item.id) {
        case "razao_social":     value = contact.razaoSocial; present = !!value; break;
        case "cnpj":             value = contact.cnpj; present = !!value; break;
        case "regime_tributario": value = contact.regimeTributario; present = !!value; break;
        case "porte":            value = contact.porte; present = !!value; break;
        case "setor":            value = contact.setor; present = !!value; break;
        case "produto_interesse": value = contact.produtoInteresse; present = !!value; break;
        case "faturamento_estimado": value = contact.faturamentoEstimado; present = !!value; break;
        case "decisor":          value = contact.nomeDecissor; present = !!value; break;
        case "contato_decisor":  value = contact.contatoDecisor; present = !!value; break;
        case "dor_comercial":    value = contact.dorComercialPercebida; present = !!value; break;
        case "resumo_diagnostico":
          value = latestDeal?.resumo;
          present = !!value;
          break;
        default: present = false;
      }
      return { ...item, present, value };
    });

    const required = checklist.filter(c => c.required);
    const missing = required.filter(c => !c.present);
    const ready = missing.length === 0;

    res.json({
      success: true,
      checklist,
      ready,
      missingRequired: missing.map(m => m.id),
      completionPct: Math.round(((required.length - missing.length) / Math.max(1, required.length)) * 100),
    });
  } catch (err: any) {
    apiError(res, 500, "Failed to compute briefing checklist");
  }
});

// ─── Priority: Recalculate ──────────────────────────────────────────────────
// POST /api/crm/contacts/:id/priority/recalculate
router.post("/contacts/:id/priority/recalculate", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const contactId = Number(req.params.id);
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, contactId), eq(crmContactsTable.userId, userId)));
    if (!contact) { apiError(res, 404, "Contact not found"); return; }

    const [deal] = await db.select().from(crmDealsTable)
      .where(and(eq(crmDealsTable.contactId, contactId), eq(crmDealsTable.userId, userId)))
      .orderBy(desc(crmDealsTable.updatedAt))
      .limit(1);

    const [hasOpenTask] = await db.select({ id: crmTasksTable.id }).from(crmTasksTable)
      .where(and(
        eq(crmTasksTable.contactId, contactId),
        eq(crmTasksTable.userId, userId),
        eq(crmTasksTable.status, "pending"),
      )).limit(1);

    const now = new Date();
    const daysWithoutActivity = contact.ultimaInteracao
      ? Math.floor((now.getTime() - new Date(contact.ultimaInteracao).getTime()) / (24 * 60 * 60 * 1000))
      : 999;
    const daysSinceFollowupOverdue = contact.proximoFollowup && new Date(contact.proximoFollowup) < now
      ? Math.floor((now.getTime() - new Date(contact.proximoFollowup).getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    const expectedCloseDays = deal?.expectedCloseDate
      ? Math.floor((new Date(deal.expectedCloseDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const isUrgentMatrix = !!(deal && (deal.statusMatriz === "enviado" || deal.statusMatriz === "aguardando")
      && deal.prazoRetornoMatriz && new Date(deal.prazoRetornoMatriz) < now);

    const result = calculatePriority({
      aiScore: contact.aiScore,
      temperatura: contact.temperatura,
      status: contact.status,
      dealStage: deal?.stage ?? null,
      statusMatriz: deal?.statusMatriz ?? null,
      hasProposal: !!(deal && (deal.statusProposta || deal.statusMatriz === "proposta_liberada")),
      daysWithoutActivity,
      daysSinceFollowupOverdue,
      expectedCloseDays,
      hasOpenTask: !!hasOpenTask,
      isUrgentMatrix,
    });

    // Persist
    await db.update(crmContactsTable)
      .set({ prioridadeComercial: result.nivel, updatedAt: new Date() })
      .where(eq(crmContactsTable.id, contactId));

    res.json({ success: true, ...result });
  } catch (err: any) {
    apiError(res, 500, "Failed to recalculate priority");
  }
});

// ─── Next Step: Re-evaluate for all contacts (used by automations) ──────────
async function evaluateNextStepsForContact(userId: string, contactId: number) {
  try {
    const [contact] = await db.select().from(crmContactsTable)
      .where(and(eq(crmContactsTable.id, contactId), eq(crmContactsTable.userId, userId)));
    if (!contact) return;

    const [deal] = await db.select().from(crmDealsTable)
      .where(and(eq(crmDealsTable.contactId, contactId), eq(crmDealsTable.userId, userId)))
      .orderBy(desc(crmDealsTable.updatedAt))
      .limit(1);

    const [hasOpenTask] = await db.select({ id: crmTasksTable.id }).from(crmTasksTable)
      .where(and(
        eq(crmTasksTable.contactId, contactId),
        eq(crmTasksTable.userId, userId),
        eq(crmTasksTable.status, "pending"),
      )).limit(1);

    const hasProposal = !!(deal && (
      deal.statusProposta === "proposta_enviada"
      || deal.statusProposta === "proposta_pronta"
      || deal.statusProposta === "proposta_apresentada"
      || deal.statusProposta === "em_negociacao"
      || deal.statusMatriz === "proposta_liberada"
    ));

    const rec = recommendNextStep({
      contact: {
        status: contact.status,
        temperatura: contact.temperatura,
        proximoFollowup: contact.proximoFollowup,
        ultimaInteracao: contact.ultimaInteracao,
        pendenciasCliente: contact.pendenciasCliente,
        responsavelUnidade: contact.responsavelUnidade,
      },
      deal: deal ? {
        stage: deal.stage,
        statusMatriz: deal.statusMatriz,
        statusProposta: deal.statusProposta,
        briefingMatriz: deal.briefingMatriz,
        dataEnvioMatriz: deal.dataEnvioMatriz,
        prazoRetornoMatriz: deal.prazoRetornoMatriz,
      } : null,
      hasProposal,
      hasOpenTasks: !!hasOpenTask,
    });

    // Persist on contact
    await db.update(crmContactsTable)
      .set({ proximoPassoRecomendado: rec as any, updatedAt: new Date() })
      .where(eq(crmContactsTable.id, contactId));
  } catch (err) {
    console.error("[next-step] re-evaluate failed:", err);
  }
}

// ─── Segment Analytics ────────────────────────────────────────────────────────
// GET /api/crm/segments — returns contact/deal stats by business segment
router.get("/segments", async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
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
