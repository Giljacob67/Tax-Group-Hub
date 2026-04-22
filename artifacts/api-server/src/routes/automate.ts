import { Router, type IRouter } from "express";
import { getAgentById } from "../lib/agents-data.js";
import { callLLM } from "../lib/llm-client.js";
import { db, pipelineExecutionsTable } from "@workspace/db";

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
      res.status(400).json({ error: "agentId is required" });
      return;
    }
    if (!input?.trim()) {
      res.status(400).json({ error: "input is required" });
      return;
    }

    const agent = getAgentById(agentId);
    if (!agent) {
      res.status(404).json({ error: `Agent '${agentId}' not found` });
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
    res.status(500).json({ error: "Execution failed", message: (err as Error).message });
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
      res.status(500).json({ error: "Reforma Tributária agent not found" });
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
    res.status(500).json({ error: "Trigger failed", message: (err as Error).message });
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
      res.status(400).json({ error: "steps array is required with at least 1 step" });
      return;
    }

    if (steps.length > 10) {
      res.status(400).json({ error: "Maximum 10 steps per pipeline" });
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
        res.status(404).json({ error: `Agent '${step.agentId}' not found at step ${i + 1}` });
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
    res.status(500).json({ error: "Pipeline failed", message: (err as Error).message });
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
      res.status(400).json({ error: "At least name or email is required" });
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
    res.status(500).json({ error: "Trigger failed", message: (err as Error).message });
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
      res.status(500).json({ error: "Calendário Editorial agent not found" });
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
    res.status(500).json({ error: "Trigger failed", message: (err as Error).message });
  }
});

// ─── Trigger: Daily Reforma Tributária insight ────────────────────────
// POST /api/automate/trigger/reforma-tributaria
// Auto-runs: Reforma Tributária agent
router.post("/automate/trigger/reforma-tributaria", async (_req, res) => {
  try {
    const agent = getAgentById("reformatributaria-insight");
    if (!agent) {
      res.status(500).json({ error: "Reforma Tributária agent not found" });
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
    res.status(500).json({ error: "Trigger failed", message: (err as Error).message });
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
      res.status(400).json({ error: "leads array is required" });
      return;
    }

    const agent = getAgentById("followup-tax-group");
    if (!agent) {
      res.status(500).json({ error: "Follow-Up agent not found" });
      return;
    }

    const results = [];

    for (const lead of leads) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lead.lastContact).getTime()) / (1000 * 60 * 60 * 24)
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
    res.status(500).json({ error: "Trigger failed", message: (err as Error).message });
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
      res.status(400).json({ error: "topic is required" });
      return;
    }

    const channelLower = (channel || "linkedin").toLowerCase();
    const agentId = channelLower.includes("instagram") || channelLower.includes("reels")
      ? "conteudo-video-tax-group"
      : "conteudo-linkedin-tax-group";

    const agent = getAgentById(agentId);
    if (!agent) {
      res.status(500).json({ error: `Content agent '${agentId}' not found` });
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
    res.status(500).json({ error: "Trigger failed", message: (err as Error).message });
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

// callLLM is now imported from ../lib/llm-client.js

export default router;
