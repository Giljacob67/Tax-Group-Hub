import { Router, type IRouter } from "express";
import { getAgentById } from "../lib/agents-data.js";
import { callLLM } from "../lib/llm-client.js";
import {
  db,
  pipelineExecutionsTable,
  crmContactsTable,
  crmActivitiesTable,
  channelConfigsTable,
  automationSequencesTable,
  sequenceEnrollmentsTable,
} from "@workspace/db";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { apiError } from "../lib/api-response.js";
import { enrichContact } from "../lib/cnpj-enrichment.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

const router: IRouter = Router();

// ─── Execute a single agent ───────────────────────────────────────────
// POST /api/automate/execute
// Body: { agentId, input, context?, variables?, toolIds? }
// Use case: Make/n8n sends input, receives agent output
router.post("/automate/execute", async (req, res) => {
  try {
    const { agentId, input, context, variables, toolIds } = req.body as {
      agentId?: string;
      input?: string;
      context?: Record<string, unknown>;
      variables?: Record<string, string>;
      toolIds?: any[];
    };

    if (!agentId?.trim()) {
      apiError(res, 400, "agentId is required");
      return;
    }
    if (!input?.trim()) {
      apiError(res, 400, "input is required");
      return;
    }

    const agent = getAgentById(agentId);
    if (!agent) {
      apiError(res, 404, `Agent '${agentId}' not found`);
      return;
    }

    // Build the prompt with variable substitution
    let systemPrompt = agent.systemPrompt;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        systemPrompt = systemPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      }
    }

    // Call LLM with optional tools
    const result = await callLLM(systemPrompt, input, { toolIds: toolIds as any });

    res.json({
      success: true,
      agentId,
      agentName: agent.name,
      output: result.output,
      tokensUsed: result.tokensUsed,
      executionTimeMs: result.executionTimeMs,
      provider: result.provider,
      model: result.model,
      toolCalls: result.toolCalls,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Execute error:", err);
    apiError(res, 500, "Execution failed");
  }
});

// ... (skipping pipe with // ...) ...

// ─── Trigger: Daily Reforma Tributária insight ────────────────────────
// POST /api/automate/trigger/reforma-tributaria
// Auto-runs: Reforma Tributária agent (enabled with Web Search tool)
router.post("/automate/trigger/reforma-tributaria", async (_req, res) => {
  try {
    const agent = getAgentById("reformatributaria-insight");
    if (!agent) {
      apiError(res, 500, "Reforma Tributária agent not found");
      return;
    }

    const input = "Gere um insight executivo sobre as últimas atualizações da Reforma Tributária (Lei Complementar 214/2025). Use a ferramenta de busca para verificar notícias e prazos de hoje. Foque em impacto prático para empresas de médio e grande porte. Inclua prazos, ações recomendadas e oportunidades.";

    const result = await callLLM(agent.systemPrompt, input, { toolIds: ["webSearch"] });

    res.json({
      success: true,
      trigger: "reforma-tributaria",
      output: result.output,
      toolUsed: "webSearch",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Reforma Tributária trigger error:", err);
    apiError(res, 500, "Trigger failed");
  }
});

// ─── Execute a pipeline of agents in sequence ─────────────────────────
// POST /api/automate/pipeline
// Body: { steps: [{ agentId, input, variables? }], sharedContext? }
// Use case: Prospeção → Qualificação → Follow-Up chain
router.post("/automate/pipeline", async (req, res) => {
  try {
    const { steps, sharedContext } = req.body as {
      steps?: Array<{ agentId: string; input: string; variables?: Record<string, string> }>;
      sharedContext?: Record<string, unknown>;
    };

    if (!steps?.length) {
      apiError(res, 400, "steps array is required with at least 1 step");
      return;
    }

    if (steps.length > 10) {
      apiError(res, 400, "Maximum 10 steps per pipeline");
      return;
    }

    const results: Array<{
      step: number;
      agentId: string;
      agentName: string;
      output: string;
      tokensUsed: number;
      executionTimeMs: number;
    }> = [];

    let previousOutput = "";

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const agent = getAgentById(step.agentId);
      if (!agent) {
        apiError(res, 404, `Agent '${step.agentId}' not found at step ${i + 1}`);
        return;
      }

      // Inject previous step output as context
      const contextInput = previousOutput
        ? `Resultado da etapa anterior:\n${previousOutput}\n\n---\n\nNova solicitação:\n${step.input}`
        : step.input;

      let systemPrompt = agent.systemPrompt;
      if (step.variables) {
        for (const [key, value] of Object.entries(step.variables)) {
          systemPrompt = systemPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
      }

      const result = await callLLM(systemPrompt, contextInput, sharedContext);
      previousOutput = result.output;

      results.push({
        step: i + 1,
        agentId: step.agentId,
        agentName: agent.name,
        output: result.output,
        tokensUsed: result.tokensUsed,
        executionTimeMs: result.executionTimeMs,
      });
    }

    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalTimeMs = results.reduce((sum, r) => sum + r.executionTimeMs, 0);

    // Persist pipeline execution (fire-and-forget — não bloqueia a resposta)
    db.insert(pipelineExecutionsTable).values({
      userId: req.userId ?? null,
      steps: results.map(r => ({
        agentId: r.agentId,
        input: steps[r.step - 1]?.input ?? "",
        output: r.output,
        tokensUsed: r.tokensUsed,
        timeMs: r.executionTimeMs,
        success: true,
      })),
      totalTokens,
      totalTimeMs,
      status: "completed",
    }).catch((err: any) => console.error("[pipeline] Failed to persist execution:", err));

    res.json({
      success: true,
      pipeline: results.length,
      totalTokens,
      totalTimeMs,
      results,
      finalOutput: results[results.length - 1]?.output || "",
    });
  } catch (err) {
    console.error("Pipeline error:", err);
    apiError(res, 500, "Pipeline failed");
  }
});

// ─── Trigger: New lead from site ──────────────────────────────────────
// POST /api/automate/trigger/new-lead
// Body: { name, email, phone, company, source, message }
// Auto-runs: Prospecção → Qualificação
router.post("/automate/trigger/new-lead", async (req, res) => {
  try {
    const { name, email, phone, company, source, message } = req.body as {
      name?: string; email?: string; phone?: string;
      company?: string; source?: string; message?: string;
    };

    if (!name?.trim() && !email?.trim()) {
      apiError(res, 400, "At least name or email is required");
      return;
    }

    const leadContext = `
NOVO LEAD RECEBIDO:
- Nome: ${name || "Não informado"}
- Email: ${email || "Não informado"}
- Telefone: ${phone || "Não informado"}
- Empresa: ${company || "Não informado"}
- Origem: ${source || "Site"}
- Mensagem: ${message || "Sem mensagem"}
`.trim();

    // Run pipeline: Prospecção → Qualificação
    const steps = [
      {
        agentId: "prospeccao-tax-group",
        input: `Analise este novo lead e gere um script de abordagem personalizado.\n\n${leadContext}`,
        variables: { lead_name: name || "Lead", lead_company: company || "Empresa" },
      },
      {
        agentId: "qualificacao-leads-tax-group",
        input: `Qualifique este lead com scoring BANT e classifique a prioridade.\n\n${leadContext}`,
      },
    ];

    const results = [];
    let previousOutput = "";

    for (const step of steps) {
      const agent = getAgentById(step.agentId);
      if (!agent) continue;

      const contextInput = previousOutput
        ? `Etapa anterior:\n${previousOutput}\n\n---\n\n${step.input}`
        : step.input;

      let systemPrompt = agent.systemPrompt;
      if (step.variables) {
        for (const [key, value] of Object.entries(step.variables)) {
          systemPrompt = systemPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
      }

      const result = await callLLM(systemPrompt, contextInput);
      previousOutput = result.output;

      results.push({
        agentId: step.agentId,
        agentName: agent?.name,
        output: result.output,
      });
    }

    res.json({
      success: true,
      trigger: "new-lead",
      lead: { name, email, phone, company, source },
      pipeline: results,
      finalOutput: results[results.length - 1]?.output || "",
    });
  } catch (err) {
    console.error("New lead trigger error:", err);
    apiError(res, 500, "Trigger failed");
  }
});

// ─── Trigger: Weekly editorial calendar ───────────────────────────────
// POST /api/automate/trigger/editorial-calendar
// Body: { week?, channels? }
// Auto-runs: Calendário Editorial agent
router.post("/automate/trigger/editorial-calendar", async (req, res) => {
  try {
    const { week, channels } = req.body as { week?: string; channels?: string[] };

    const now = new Date();
    const weekLabel = week || `Semana de ${now.toLocaleDateString("pt-BR")}`;
    const channelList = channels?.join(", ") || "LinkedIn, Email, WhatsApp, Instagram";

    const agent = getAgentById("calendario-editorial-tax-group");
    if (!agent) {
      apiError(res, 500, "Calendário Editorial agent not found");
      return;
    }

    const input = `Gere o calendário editorial para a ${weekLabel}. Canais: ${channelList}. Inclua temas, formatos e horários de publicação para cada dia da semana.`;

    const result = await callLLM(agent.systemPrompt, input);

    res.json({
      success: true,
      trigger: "editorial-calendar",
      week: weekLabel,
      channels: channelList,
      output: result.output,
    });
  } catch (err) {
    console.error("Editorial calendar trigger error:", err);
    apiError(res, 500, "Trigger failed");
  }
});

// ─── Trigger: Daily Reforma Tributária insight ────────────────────────
// POST /api/automate/trigger/reforma-tributaria
// Auto-runs: Reforma Tributária agent
router.post("/automate/trigger/reforma-tributaria", async (_req, res) => {
  try {
    const agent = getAgentById("reformatributaria-insight");
    if (!agent) {
      apiError(res, 500, "Reforma Tributária agent not found");
      return;
    }

    const input = "Gere um insight executivo sobre as últimas atualizações da Reforma Tributária (Lei Complementar 214/2025). Foque em impacto prático para empresas de médio e grande porte. Inclua prazos, ações recomendadas e oportunidades.";

    const result = await callLLM(agent.systemPrompt, input);

    res.json({
      success: true,
      trigger: "reforma-tributaria",
      output: result.output,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Reforma Tributária trigger error:", err);
    apiError(res, 500, "Trigger failed");
  }
});

// ─── Trigger: Follow-up check ─────────────────────────────────────────
// POST /api/automate/trigger/follow-up-check
// Body: { leads: [{ name, lastContact, status, notes }] }
// Auto-runs: Follow-Up agent for each stale lead
router.post("/automate/trigger/follow-up-check", async (req, res) => {
  try {
    const { leads } = req.body as {
      leads?: Array<{ name: string; lastContact: string; status: string; notes?: string }>;
    };

    if (!leads?.length) {
      apiError(res, 400, "leads array is required");
      return;
    }

    const agent = getAgentById("followup-tax-group");
    if (!agent) {
      apiError(res, 500, "Follow-Up agent not found");
      return;
    }

    const results = [];

    for (const lead of leads) {
      const lastContactDate = lead.lastContact ? new Date(lead.lastContact) : null;
      if (!lastContactDate || Number.isNaN(lastContactDate.getTime())) {
        continue;
      }
      const daysSince = Math.floor(
        (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const input = `
LEAD QUE PRECISA DE FOLLOW-UP:
- Nome: ${lead.name}
- Último contato: ${lead.lastContact} (${daysSince} dias atrás)
- Status: ${lead.status}
- Observações: ${lead.notes || "Nenhuma"}

Gere uma sequência de follow-up personalizada para este lead.
`.trim();

      const result = await callLLM(agent.systemPrompt, input);

      results.push({
        leadName: lead.name,
        daysSinceContact: daysSince,
        output: result.output,
      });
    }

    res.json({
      success: true,
      trigger: "follow-up-check",
      leadsProcessed: results.length,
      results,
    });
  } catch (err) {
    console.error("Follow-up check trigger error:", err);
    apiError(res, 500, "Trigger failed");
  }
});

// ─── Trigger: Site content request → LinkedIn/Instagram ───────────────
// POST /api/automate/trigger/content-request
// Body: { topic, channel, audience?, tone? }
// Auto-runs: LinkedIn or Instagram agent
router.post("/automate/trigger/content-request", async (req, res) => {
  try {
    const { topic, channel, audience, tone } = req.body as {
      topic?: string; channel?: string; audience?: string; tone?: string;
    };

    if (!topic?.trim()) {
      apiError(res, 400, "topic is required");
      return;
    }

    const channelLower = (channel || "linkedin").toLowerCase();
    const agentId = channelLower.includes("instagram") || channelLower.includes("reels")
      ? "conteudo-video-tax-group"
      : "conteudo-linkedin-tax-group";

    const agent = getAgentById(agentId);
    if (!agent) {
      apiError(res, 500, `Content agent '${agentId}' not found`);
      return;
    }

    const input = `
GERAR CONTEÚDO PUBLICÁVEL:
- Tema: ${topic}
- Canal: ${channel || "LinkedIn"}
- Público: ${audience || "Empresários e profissionais de tributário"}
- Tom: ${tone || "Profissional e acessível"}

Gere o conteúdo completo pronto para publicação.
`.trim();

    const result = await callLLM(agent.systemPrompt, input);

    res.json({
      success: true,
      trigger: "content-request",
      topic,
      channel: channel || "LinkedIn",
      agentUsed: agentId,
      output: result.output,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Content request trigger error:", err);
    apiError(res, 500, "Trigger failed");
  }
});

// ─── List available automations (for Make/n8n setup) ──────────────────
// GET /api/automate/triggers
router.get("/automate/triggers", (_req, res) => {
  res.json({
    triggers: [
      {
        id: "new-lead",
        name: "Novo Lead",
        method: "POST",
        path: "/api/automate/trigger/new-lead",
        description: "Recebe lead do site e executa Prospecção + Qualificação automaticamente",
        bodySchema: {
          name: "string (required)",
          email: "string (required)",
          phone: "string (optional)",
          company: "string (optional)",
          source: "string (optional)",
          message: "string (optional)",
        },
      },
      {
        id: "editorial-calendar",
        name: "Calendário Editorial Semanal",
        method: "POST",
        path: "/api/automate/trigger/editorial-calendar",
        description: "Gera calendário editorial para a semana em todos os canais",
        bodySchema: {
          week: "string (optional — default: current week)",
          channels: "string[] (optional — default: LinkedIn, Email, WhatsApp, Instagram)",
        },
      },
      {
        id: "reforma-tributaria",
        name: "Insight Reforma Tributária (Diário)",
        method: "POST",
        path: "/api/automate/trigger/reforma-tributaria",
        description: "Gera insight executivo sobre Reforma Tributária",
        bodySchema: {},
      },
      {
        id: "follow-up-check",
        name: "Verificação de Follow-Up",
        method: "POST",
        path: "/api/automate/trigger/follow-up-check",
        description: "Verifica leads sem contato recente e gera sequências de follow-up",
        bodySchema: {
          leads: "array of { name, lastContact, status, notes }",
        },
      },
      {
        id: "content-request",
        name: "Gerar Conteúdo para Redes",
        method: "POST",
        path: "/api/automate/trigger/content-request",
        description: "Gera conteúdo pronto para LinkedIn ou Instagram",
        bodySchema: {
          topic: "string (required)",
          channel: "string (optional — linkedin | instagram)",
          audience: "string (optional)",
          tone: "string (optional)",
        },
      },
    ],
    genericEndpoints: [
      {
        id: "execute",
        name: "Executar Agente",
        method: "POST",
        path: "/api/automate/execute",
        description: "Executa qualquer agente com input customizado",
      },
      {
        id: "pipeline",
        name: "Executar Pipeline",
        method: "POST",
        path: "/api/automate/pipeline",
        description: "Executa múltiplos agentes em sequência (máx 10)",
      },
    ],
  });
});

// ─── Broadcast: WhatsApp personalizado para lista segmentada do CRM ───
// POST /api/automate/broadcast-whatsapp
// Body: {
//   channelId: number,                         — ID do canal WhatsApp (channelConfigsTable)
//   filters: { minScore?, maxScore?, status?, tags? },
//   agentId: string,                            — agente que gera o conteúdo (ex: whatsapp-broadcast-tax-group)
//   inputTemplate: string,                      — template com {{contact_name}}, {{razao_social}}, {{product}}
// }
// IMPORTANTE: Só envia para contatos que tenham telefone cadastrado.
// Cada mensagem é gerada individualmente pelo agente para ser personalizada.
router.post("/automate/broadcast-whatsapp", async (req, res) => {
  try {
    const {
      channelId,
      filters = {},
      agentId,
      inputTemplate,
    } = req.body as {
      channelId?: number;
      filters?: { minScore?: number; maxScore?: number; status?: string[]; tags?: string[] };
      agentId?: string;
      inputTemplate?: string;
    };

    const userId = req.userId ?? "system";

    if (!channelId || isNaN(Number(channelId))) {
      apiError(res, 400, "channelId (number) is required");
      return;
    }
    if (!agentId?.trim()) {
      apiError(res, 400, "agentId is required");
      return;
    }
    if (!inputTemplate?.trim()) {
      apiError(res, 400, "inputTemplate is required");
      return;
    }

    const agent = getAgentById(agentId);
    if (!agent) {
      apiError(res, 404, `Agent '${agentId}' not found`);
      return;
    }

    // Load WhatsApp channel config
    const [channel] = await db
      .select()
      .from(channelConfigsTable)
      .where(and(eq(channelConfigsTable.id, Number(channelId)), eq(channelConfigsTable.platform, "whatsapp")))
      .limit(1);

    if (!channel) {
      apiError(res, 404, "WhatsApp channel not found");
      return;
    }

    const configData = channel.config as Record<string, unknown> | null;
    const accessToken = String(configData?.accessToken ?? "");
    const phoneNumberId = String(configData?.phoneNumberId ?? "");

    if (!accessToken || !phoneNumberId) {
      apiError(res, 422, "WhatsApp channel missing accessToken or phoneNumberId");
      return;
    }

    // Build contact query with filters
    const contactConditions = [eq(crmContactsTable.userId, userId)];
    if (filters.minScore !== undefined) {
      contactConditions.push(gte(crmContactsTable.aiScore, filters.minScore));
    }
    if (filters.maxScore !== undefined) {
      contactConditions.push(lte(crmContactsTable.aiScore, filters.maxScore));
    }
    if (filters.status?.length) {
      contactConditions.push(inArray(crmContactsTable.status, filters.status));
    }

    const contacts = await db.select().from(crmContactsTable).where(and(...contactConditions));

    // Only send to contacts with a phone number
    const eligible = contacts.filter((c: typeof contacts[number]) => c.telefone?.trim());

    if (eligible.length === 0) {
      res.json({ success: true, sent: 0, skipped: 0, failed: 0, message: "No eligible contacts with phone numbers" });
      return;
    }

    // Respond immediately — processing continues in background
    res.json({
      success: true,
      queued: eligible.length,
      message: `Processing broadcast for ${eligible.length} contacts`,
    });

    // Process each contact asynchronously
    setImmediate(async () => {
      let sent = 0;
      let failed = 0;

      for (const contact of eligible) {
        try {
          // Build personalized input
          const personalizedInput = inputTemplate
            .replace(/\{\{contact_name\}\}/g, contact.razaoSocial || contact.cnpj)
            .replace(/\{\{razao_social\}\}/g, contact.razaoSocial || "")
            .replace(/\{\{cnpj\}\}/g, contact.cnpj)
            .replace(/\{\{product\}\}/g, contact.aiRecommendedProduct || "")
            .replace(/\{\{uf\}\}/g, contact.uf || "")
            .replace(/\{\{regime\}\}/g, contact.regimeTributario || "");

          // Generate personalized message with agent
          const llmResult = await callLLM(agent.systemPrompt, personalizedInput);

          // Send via WhatsApp
          const phone = contact.telefone!.replace(/\D/g, "");
          await sendWhatsAppMessage(phone, llmResult.output, phoneNumberId, accessToken);

          // Log activity
          await db.insert(crmActivitiesTable).values({
            userId,
            contactId: contact.id,
            type: "whatsapp",
            direction: "outbound",
            subject: "Broadcast WhatsApp",
            content: llmResult.output,
            completedAt: new Date(),
            agentId,
          }).catch(() => {});

          sent++;
          console.log(`[Broadcast] Sent to contact ${contact.id} (${phone})`);
        } catch (err) {
          failed++;
          console.error(`[Broadcast] Failed for contact ${contact.id}:`, err);
        }
      }

      console.log(`[Broadcast] Done — sent: ${sent}, failed: ${failed}`);
    });
  } catch (err) {
    console.error("[Broadcast WhatsApp] error:", err);
    apiError(res, 500, "Broadcast failed");
  }
});

// ─── Sequences: list enrollments (optionally filtered by contactId) ─────
// GET /api/automate/enrollments?contactId=X&status=active
router.get("/automate/enrollments", async (req, res) => {
  try {
    const userId = req.userId ?? "system";
    const contactId = req.query.contactId ? Number(req.query.contactId) : null;
    const status = req.query.status as string | undefined;

    const conditions = [eq(sequenceEnrollmentsTable.userId, userId)];
    if (contactId && !isNaN(contactId)) conditions.push(eq(sequenceEnrollmentsTable.contactId, contactId));
    if (status) conditions.push(eq(sequenceEnrollmentsTable.status, status));

    const enrollments = await db
      .select({
        id: sequenceEnrollmentsTable.id,
        sequenceId: sequenceEnrollmentsTable.sequenceId,
        contactId: sequenceEnrollmentsTable.contactId,
        currentStep: sequenceEnrollmentsTable.currentStep,
        nextSendAt: sequenceEnrollmentsTable.nextSendAt,
        status: sequenceEnrollmentsTable.status,
        enrolledAt: sequenceEnrollmentsTable.enrolledAt,
        completedAt: sequenceEnrollmentsTable.completedAt,
        sequenceName: automationSequencesTable.name,
        sequenceTrigger: automationSequencesTable.trigger,
        totalSteps: automationSequencesTable.steps,
      })
      .from(sequenceEnrollmentsTable)
      .leftJoin(automationSequencesTable, eq(sequenceEnrollmentsTable.sequenceId, automationSequencesTable.id))
      .where(and(...conditions))
      .orderBy(sequenceEnrollmentsTable.enrolledAt);

    res.json({ success: true, enrollments });
  } catch (err) {
    console.error("[Enrollments] list error:", err);
    apiError(res, 500, "Failed to list enrollments");
  }
});

// ─── Sequences: CRUD ──────────────────────────────────────────────────
// GET  /api/automate/sequences
// POST /api/automate/sequences       body: { name, trigger, triggerValue?, steps[] }
// PUT  /api/automate/sequences/:id
// DELETE /api/automate/sequences/:id

router.get("/automate/sequences", async (req, res) => {
  try {
    const userId = req.userId ?? "system";
    const sequences = await db
      .select()
      .from(automationSequencesTable)
      .where(eq(automationSequencesTable.userId, userId))
      .orderBy(automationSequencesTable.createdAt);
    res.json({ success: true, sequences });
  } catch (err) {
    console.error("[Sequences] list error:", err);
    apiError(res, 500, "Failed to list sequences");
  }
});

router.post("/automate/sequences", async (req, res) => {
  try {
    const userId = req.userId ?? "system";
    const { name, trigger, triggerValue, steps, isActive } = req.body as {
      name?: string;
      trigger?: string;
      triggerValue?: string;
      steps?: unknown[];
      isActive?: boolean;
    };

    if (!name?.trim()) { apiError(res, 400, "name is required"); return; }
    if (!trigger?.trim()) { apiError(res, 400, "trigger is required"); return; }
    if (!Array.isArray(steps) || steps.length === 0) { apiError(res, 400, "steps[] is required"); return; }

    const [seq] = await db
      .insert(automationSequencesTable)
      .values({ userId, name, trigger, triggerValue: triggerValue ?? null, steps, isActive: isActive ?? true })
      .returning();

    res.status(201).json({ success: true, sequence: seq });
  } catch (err) {
    console.error("[Sequences] create error:", err);
    apiError(res, 500, "Failed to create sequence");
  }
});

router.put("/automate/sequences/:id", async (req, res) => {
  try {
    const userId = req.userId ?? "system";
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid sequence id"); return; }

    const { name, trigger, triggerValue, steps, isActive } = req.body as {
      name?: string; trigger?: string; triggerValue?: string; steps?: unknown[]; isActive?: boolean;
    };

    const [updated] = await db
      .update(automationSequencesTable)
      .set({ name, trigger, triggerValue, steps, isActive, updatedAt: new Date() })
      .where(and(eq(automationSequencesTable.id, id), eq(automationSequencesTable.userId, userId)))
      .returning();

    if (!updated) { apiError(res, 404, "Sequence not found"); return; }
    res.json({ success: true, sequence: updated });
  } catch (err) {
    console.error("[Sequences] update error:", err);
    apiError(res, 500, "Failed to update sequence");
  }
});

router.delete("/automate/sequences/:id", async (req, res) => {
  try {
    const userId = req.userId ?? "system";
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid sequence id"); return; }

    await db
      .delete(automationSequencesTable)
      .where(and(eq(automationSequencesTable.id, id), eq(automationSequencesTable.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    console.error("[Sequences] delete error:", err);
    apiError(res, 500, "Failed to delete sequence");
  }
});

// ─── Sequences: Enroll a contact ─────────────────────────────────────
// POST /api/automate/sequences/:id/enroll
// Body: { contactId: number }
router.post("/automate/sequences/:id/enroll", async (req, res) => {
  try {
    const userId = req.userId ?? "system";
    const seqId = Number(req.params.id);
    const { contactId } = req.body as { contactId?: number };

    if (isNaN(seqId)) { apiError(res, 400, "Invalid sequence id"); return; }
    if (!contactId || isNaN(Number(contactId))) { apiError(res, 400, "contactId is required"); return; }

    const [seq] = await db
      .select()
      .from(automationSequencesTable)
      .where(and(eq(automationSequencesTable.id, seqId), eq(automationSequencesTable.userId, userId)))
      .limit(1);

    if (!seq) { apiError(res, 404, "Sequence not found"); return; }
    if (!seq.steps?.length) { apiError(res, 422, "Sequence has no steps"); return; }

    // nextSendAt = now + first step's delay in days
    const firstStep = seq.steps[0];
    if (!firstStep || typeof firstStep.day !== "number") {
      apiError(res, 422, "Sequence first step is invalid");
      return;
    }
    const nextSendAt = new Date(Date.now() + firstStep.day * 24 * 60 * 60 * 1000);

    const [enrollment] = await db
      .insert(sequenceEnrollmentsTable)
      .values({ sequenceId: seqId, contactId: Number(contactId), userId, currentStep: 0, nextSendAt, status: "active" })
      .returning();

    res.status(201).json({ success: true, enrollment });
  } catch (err) {
    console.error("[Sequences] enroll error:", err);
    apiError(res, 500, "Failed to enroll contact");
  }
});

// ─── Sequences: Process due steps (called by Vercel Cron or Make) ────
// POST /api/automate/process-sequences
// Auth: CRON_SECRET header (internal) or regular userId auth
router.post("/automate/process-sequences", async (req, res) => {
  const cronSecret = req.headers["x-cron-secret"];
  const hasCronSecret = !!process.env.CRON_SECRET;
  if (hasCronSecret) {
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      apiError(res, 403, "Invalid or missing cron secret");
      return;
    }
  } else {
    // Fallback to regular auth when CRON_SECRET is not configured
    const userId = req.userId;
    if (!userId || userId === "system") {
      apiError(res, 403, "Authentication required");
      return;
    }
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    // Find all active enrollments with nextSendAt <= now
    const due = await db
      .select()
      .from(sequenceEnrollmentsTable)
      .where(and(eq(sequenceEnrollmentsTable.status, "active"), lte(sequenceEnrollmentsTable.nextSendAt, new Date())));

    for (const enrollment of due) {
      try {
        const [seq] = await db
          .select()
          .from(automationSequencesTable)
          .where(eq(automationSequencesTable.id, enrollment.sequenceId))
          .limit(1);

        if (!seq?.steps?.length) continue;

        const step = seq.steps[enrollment.currentStep];
        if (!step) {
          // All steps done — mark completed
          await db.update(sequenceEnrollmentsTable)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          continue;
        }

        const [contact] = await db
          .select()
          .from(crmContactsTable)
          .where(eq(crmContactsTable.id, enrollment.contactId))
          .limit(1);

        if (!contact) {
          await db.update(sequenceEnrollmentsTable)
            .set({ status: "cancelled" })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          continue;
        }

        // Build personalized input
        if (!step.inputTemplate || typeof step.inputTemplate !== "string") {
          console.error("[Sequences] step missing inputTemplate for enrollment", enrollment.id);
          failed++;
          continue;
        }
        const personalizedInput = step.inputTemplate
          .replace(/\{\{contact_name\}\}/g, contact.razaoSocial || contact.cnpj)
          .replace(/\{\{razao_social\}\}/g, contact.razaoSocial || "")
          .replace(/\{\{cnpj\}\}/g, contact.cnpj)
          .replace(/\{\{product\}\}/g, contact.aiRecommendedProduct || "")
          .replace(/\{\{uf\}\}/g, contact.uf || "");

        // Generate content with agent
        const agent = getAgentById(step.agentId);
        if (!agent) throw new Error(`Agent ${step.agentId} not found`);

        const llmResult = await callLLM(agent.systemPrompt, personalizedInput);

        // Send via appropriate channel
        if (step.channel === "whatsapp" && contact.telefone) {
          // Find any WhatsApp channel for this user
          const [waChannel] = await db
            .select()
            .from(channelConfigsTable)
            .where(and(eq(channelConfigsTable.userId, enrollment.userId), eq(channelConfigsTable.platform, "whatsapp")))
            .limit(1);

          if (waChannel) {
            const cfg = waChannel.config as Record<string, unknown> | null;
            const accessToken = String(cfg?.accessToken ?? "");
            const phoneNumberId = String(cfg?.phoneNumberId ?? "");
            if (accessToken && phoneNumberId) {
              const phone = contact.telefone.replace(/\D/g, "");
              await sendWhatsAppMessage(phone, llmResult.output, phoneNumberId, accessToken);
            }
          }
        }

        // Log activity regardless of channel
        await db.insert(crmActivitiesTable).values({
          userId: enrollment.userId,
          contactId: contact.id,
          type: step.channel === "whatsapp" ? "whatsapp" : "note",
          direction: "outbound",
          subject: `Sequência: ${seq.name} — Passo ${enrollment.currentStep + 1}`,
          content: llmResult.output,
          completedAt: new Date(),
          agentId: step.agentId,
        }).catch(() => {});

        // Advance to next step
        const nextStepIndex = enrollment.currentStep + 1;
        const nextStep = seq.steps[nextStepIndex];

        if (nextStep) {
          const nextSendAt = new Date(Date.now() + nextStep.day * 24 * 60 * 60 * 1000);
          await db.update(sequenceEnrollmentsTable)
            .set({ currentStep: nextStepIndex, nextSendAt })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
        } else {
          await db.update(sequenceEnrollmentsTable)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
        }

        sent++;
      } catch (stepErr) {
        failed++;
        console.error("[Sequences] step failed for enrollment", enrollment.id, stepErr);
      }

      processed++;
    }

    res.json({ success: true, processed, sent, failed, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Sequences] process-sequences error:", err);
    apiError(res, 500, "Failed to process sequences");
  }
});

// ─── Trigger: CNPJ enrichment for a CRM contact ───────────────────────
// POST /api/automate/trigger/enrich-cnpj
// Body: { contactId: number }
// Runs diagnostico-cnpj-tax-group, updates aiScore/aiRecommendedProduct,
// and auto-creates a deal if score >= 60.
router.post("/automate/trigger/enrich-cnpj", async (req, res) => {
  try {
    const { contactId } = req.body as { contactId?: number };
    const userId = req.userId ?? "system";

    const numericId = Number(contactId);
    if (!contactId || isNaN(numericId)) {
      apiError(res, 400, "contactId (number) is required");
      return;
    }

    const result = await enrichContact(numericId, userId);
    if (!result) {
      apiError(res, 404, "Contact not found or enrichment agent unavailable");
      return;
    }

    res.json({
      success: true,
      contactId: numericId,
      aiScore: result.score,
      classificacao: result.classificacao,
      aiRecommendedProduct: result.produtoRecomendado,
      creditoEstimado: result.creditoEstimado,
      dealCreated: result.dealCreated,
    });
  } catch (err) {
    console.error("[Enrich CNPJ] error:", err);
    apiError(res, 500, "Enrichment failed");
  }
});

export default router;
