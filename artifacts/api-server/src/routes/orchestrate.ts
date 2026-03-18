import { Router, type IRouter } from "express";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAgentById } from "../lib/agents-data.js";
import OpenAI from "openai";
import { getEffectiveOllamaUrl, getEffectiveOllamaModel } from "./settings.js";

const router: IRouter = Router();

interface OrchestrationTask {
  agentId: string;
  task: string;
}

interface OrchestrationResult {
  agentId: string;
  agentName: string;
  icon: string;
  response: string;
  conversationId: string;
  success: boolean;
  error?: string;
}

async function getLLMConfig() {
  const { url: ollamaUrl } = await getEffectiveOllamaUrl();
  const ollamaModel = await getEffectiveOllamaModel();

  if (ollamaUrl) {
    const baseURL = ollamaUrl.endsWith("/v1") ? ollamaUrl : `${ollamaUrl.replace(/\/+$/, "")}/v1`;
    return {
      client: new OpenAI({ baseURL, apiKey: "ollama", defaultHeaders: { "ngrok-skip-browser-warning": "true" } }),
      model: ollamaModel,
      provider: "Ollama",
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      client: new OpenAI({
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey: geminiKey,
      }),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-04-17",
      provider: "Gemini",
    };
  }

  return null;
}

async function executeAgentTask(task: OrchestrationTask, context?: string): Promise<OrchestrationResult> {
  const agent = getAgentById(task.agentId);
  if (!agent) {
    return {
      agentId: task.agentId,
      agentName: task.agentId,
      icon: "🤖",
      response: "",
      conversationId: "",
      success: false,
      error: `Agente '${task.agentId}' não encontrado`,
    };
  }

  try {
    // Create conversation for this orchestrated task
    const [conv] = await db
      .insert(conversationsTable)
      .values({
        agentId: task.agentId,
        title: `🤖 Orquestrado: ${task.task.substring(0, 60)}${task.task.length > 60 ? "..." : ""}`,
      })
      .returning();

    // Save user message
    await db.insert(messagesTable).values({
      conversationId: conv.id,
      role: "user",
      content: task.task,
    });

    const llmConfig = await getLLMConfig();
    let assistantContent: string;

    if (llmConfig) {
      const systemPrompt = context
        ? `${agent.systemPrompt}\n\nCONTEXTO ADICIONAL DA CAMPANHA:\n${context}`
        : agent.systemPrompt;

      const completion = await llmConfig.client.chat.completions.create({
        model: llmConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: task.task },
        ],
        max_tokens: 2000,
      });
      assistantContent = completion.choices[0]?.message?.content || "Sem resposta do agente.";
    } else {
      assistantContent = `**Modo Demo** — Configure GEMINI_API_KEY ou OLLAMA_URL para executar este agente.\n\n**Tarefa recebida:** ${task.task}`;
    }

    // Save assistant response
    const [assistantMsg] = await db
      .insert(messagesTable)
      .values({ conversationId: conv.id, role: "assistant", content: assistantContent })
      .returning();

    void assistantMsg;

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conv.id));

    return {
      agentId: task.agentId,
      agentName: agent.name,
      icon: agent.icon,
      response: assistantContent,
      conversationId: String(conv.id),
      success: true,
    };
  } catch (err) {
    console.error(`Orchestration error for agent ${task.agentId}:`, err);
    return {
      agentId: task.agentId,
      agentName: agent?.name || task.agentId,
      icon: agent?.icon || "🤖",
      response: "",
      conversationId: "",
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

router.post("/orchestrate", async (req, res) => {
  try {
    const { tasks, context } = req.body as { tasks?: OrchestrationTask[]; context?: string };

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      res.status(400).json({ error: "tasks array is required" });
      return;
    }

    if (tasks.length > 8) {
      res.status(400).json({ error: "Maximum 8 tasks per orchestration" });
      return;
    }

    // Execute all agent tasks in parallel
    const results = await Promise.all(
      tasks.map((task) => executeAgentTask(task, context))
    );

    res.json({ results });
  } catch (err) {
    console.error("Orchestration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
