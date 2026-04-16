import { Router, type IRouter } from "express";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAgentById } from "../lib/agents-data.js";
import { callLLM } from "../lib/llm-client.js";

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

interface CoordinatorReview {
  response: string;
  conversationId: string;
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

    const systemPrompt = context
      ? `${agent.systemPrompt}\n\nCONTEXTO ADICIONAL DA CAMPANHA:\n${context}`
      : agent.systemPrompt;

    let assistantContent: string;
    try {
      const result = await callLLM(systemPrompt, task.task);
      assistantContent = result.output || "Sem resposta do agente.";
    } catch {
      assistantContent = `**Modo Demo** — Configure GEMINI_API_KEY ou OLLAMA_URL para executar este agente.\n\n**Tarefa recebida:** ${task.task}`;
    }

    // Save assistant response
    await db
      .insert(messagesTable)
      .values({ conversationId: conv.id, role: "assistant", content: assistantContent });

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

async function runCoordinatorReview(
  tasks: OrchestrationTask[],
  results: OrchestrationResult[]
): Promise<CoordinatorReview> {
  const coordinator = getAgentById("coordenador-geral-tax-group");
  if (!coordinator) return { response: "", conversationId: "" };

  const successfulResults = results.filter((r) => r.success);
  if (successfulResults.length === 0) return { response: "", conversationId: "" };

  // Build the review prompt — truncate each output to keep input manageable
  const MAX_OUTPUT_CHARS = 500;
  const tasksAndOutputs = successfulResults
    .map((r) => {
      const originalTask = tasks.find((t) => t.agentId === r.agentId);
      const truncatedResponse = r.response.length > MAX_OUTPUT_CHARS
        ? r.response.substring(0, MAX_OUTPUT_CHARS) + "\n... [output truncado para análise]"
        : r.response;
      return `## ${r.icon} Agente: ${r.agentName}\n**Tarefa:** ${originalTask?.task || ""}\n\n**Output:**\n${truncatedResponse}`;
    })
    .join("\n\n---\n\n");

  const reviewPrompt = `Você acaba de orquestrar ${successfulResults.length} agentes especialistas em paralelo. Analise os outputs abaixo e forneça um parecer executivo consolidado.

${tasksAndOutputs}

---

PARECER EXECUTIVO SOLICITADO — responda de forma estruturada e direta:

**1. ✅ Coerência Estratégica**
Os outputs estão alinhados entre si? A mensagem é consistente em todos os canais?

**2. ⚠️ Gaps e Pontos de Atenção**
O que ficou faltando, precisa de revisão ou pode causar problema se usado assim?

**3. 🏆 Destaques**
O que foi excepcionalmente bem executado e pode ser usado diretamente?

**4. 🎯 Próximos Passos Recomendados**
Liste 3 a 5 ações concretas e priorizadas para avançar com este material.

Seja específico, cite os agentes pelo nome quando necessário, e foque em orientação prática.`;

  try {
    // Create a conversation for the coordinator review
    const [conv] = await db
      .insert(conversationsTable)
      .values({
        agentId: "coordenador-geral-tax-group",
        title: `🎖️ Supervisão: análise de ${successfulResults.length} agentes`,
      })
      .returning();

    await db.insert(messagesTable).values({
      conversationId: conv.id,
      role: "user",
      content: reviewPrompt,
    });

    let reviewContent: string;

    // Use a focused supervisor system prompt instead of the full coordinator
    // system prompt (which is ~3000 chars and wastes output token budget)
    const supervisorSystemPrompt = `Você é o Coordenador Geral da Tax Group Maringá — consultoria tributária premium com 250+ escritórios e R$14 bilhões em créditos recuperados. Seu papel agora é revisar o trabalho dos agentes especialistas e emitir um parecer executivo objetivo. Responda SEMPRE em português brasileiro. Seja direto, específico e orientado a ação.`;

    try {
      const result = await callLLM(supervisorSystemPrompt, reviewPrompt);
      console.log(`[Coordinator review] tokens=${result.tokensUsed} duration=${result.executionTimeMs}ms`);
      reviewContent = result.output || "Sem parecer disponível.";
    } catch {
      reviewContent = `**Modo Demo** — Configure GEMINI_API_KEY ou OLLAMA_URL para ativar a supervisão do Coordenador.`;
    }

    await db.insert(messagesTable).values({
      conversationId: conv.id,
      role: "assistant",
      content: reviewContent,
    });

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conv.id));

    return { response: reviewContent, conversationId: String(conv.id) };
  } catch (err) {
    console.error("Coordinator review error:", err);
    return { response: "", conversationId: "" };
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

    // Step 1: Execute all agent tasks in parallel
    const results = await Promise.all(
      tasks.map((task) => executeAgentTask(task, context))
    );

    // Step 2: Coordinator reviews all outputs and gives final assessment
    const coordinatorReview = await runCoordinatorReview(tasks, results);

    res.json({ results, coordinatorReview });
  } catch (err) {
    console.error("Orchestration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
