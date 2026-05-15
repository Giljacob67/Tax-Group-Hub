/**
 * LLM Diagnostics — stage-by-stage connection testing with actionable error reporting.
 *
 * Stages:
 *   1. auth      → Can we authenticate? (discovery / ping)
 *   2. models    → Can we list models? (discovery)
 *   3. chat      → Can we run a basic chat completion?
 *   4. json      → Can we use structured output / JSON mode?
 *   5. tools     → Can we use function calling?
 */

import { generateText, generateObject } from "ai";
import { discoverModels } from "./model-discovery.js";
import { callLLM } from "./llm-client.js";
import { decrypt } from "./crypto.js";

export type DiagnosticStage = "auth" | "models" | "chat" | "json" | "tools";

export interface Capabilities {
  tools?: boolean;
  json?: boolean;
  vision?: boolean;
  contextWindow?: number;
}

export interface DiagnosticResult {
  ok: boolean;
  stage: DiagnosticStage;
  status?: number;
  latencyMs: number;
  message: string;
  userMessage: string;
  howToFix?: string;
  technicalDetails?: string;
  capabilities?: Capabilities;
}

export interface ConnectionDiagnostics {
  connectionId: number;
  results: DiagnosticResult[];
  overall: "ok" | "warning" | "error";
}

function mapErrorToUserMessage(err: any, stage: DiagnosticStage, provider: string): { userMessage: string; howToFix?: string; status?: number } {
  const msg = (err?.message || String(err)).toLowerCase();
  const status = err?.status || err?.statusCode;

  // Auth / credential errors
  if (status === 401 || status === 403 || msg.includes("unauthorized") || msg.includes("invalid api key") || msg.includes("incorrect api key")) {
    return {
      userMessage: `Autenticação falhou para ${provider}. Sua chave API está incorreta, expirada ou não tem permissão para este recurso.`,
      howToFix: "Verifique se a chave API foi copiada corretamente. Para Google Gemini, confirme que o projeto Cloud tem a API Generative Language ativada. Para OpenAI, verifique se a chave pertence à organização correta.",
      status,
    };
  }

  // Not found
  if (status === 404 || msg.includes("not found") || msg.includes("model not found") || msg.includes("does not exist")) {
    return {
      userMessage: `Modelo ou endpoint não encontrado no ${provider}. O modelo pode ter sido descontinuado ou o endpoint/base URL está incorreto.`,
      howToFix: "Verifique se o modelo selecionado existe e está disponível. Para endpoints customizados, confirme a URL base (deve terminar em /v1 para compatíveis com OpenAI).",
      status,
    };
  }

  // Rate limit
  if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota")) {
    return {
      userMessage: `Limite de requisições atingido no ${provider}. Sua conta atingiu o rate limit ou a quota mensal.`,
      howToFix: "Aguarde alguns minutos e tente novamente. Para OpenAI, verifique o uso e os limites no dashboard da conta. Para Google, verifique a faturação do projeto Cloud.",
      status,
    };
  }

  // Server errors
  if (status === 500 || status === 502 || status === 503 || msg.includes("internal server error") || msg.includes("bad gateway") || msg.includes("service unavailable")) {
    return {
      userMessage: `O provedor ${provider} está temporariamente indisponível. Isso é um problema do lado deles, não da sua configuração.`,
      howToFix: "Aguarde alguns minutos e tente novamente. Verifique o status page do provedor (status.openai.com, status.anthropic.com, etc.).",
      status,
    };
  }

  // Timeout / network
  if (msg.includes("timeout") || msg.includes("abort") || msg.includes("etimedout") || msg.includes("econnrefused") || msg.includes("network")) {
    if (provider.toLowerCase().includes("ollama")) {
      return {
        userMessage: "Ollama não respondeu dentro do tempo limite. O serviço pode estar desligado ou inacessível.",
        howToFix: "Verifique se o Ollama está rodando localmente (ollama serve). Se estiver na nuvem (Vercel), URLs localhost não são acessíveis. Use um endpoint Ollama remoto com HTTPS.",
        status,
      };
    }
    return {
      userMessage: `Tempo de resposta esgotado ao conectar com ${provider}. Pode ser instabilidade de rede ou o endpoint está lento.`,
      howToFix: "Verifique sua conexão com a internet. Se for um endpoint customizado/local, confirme que ele está acessível e responde em menos de 30 segundos.",
      status,
    };
  }

  // CORS / frontend
  if (msg.includes("cors") || msg.includes("blocked") || msg.includes("cross-origin")) {
    return {
      userMessage: "Requisição bloqueada por política de CORS. O endpoint não permite chamadas diretas do navegador.",
      howToFix: "Isso geralmente indica que o endpoint está sendo chamado pelo frontend em vez do servidor. Nossa API roda no servidor, então isso não deveria acontecer. Se persistir, verifique se há um proxy/reverse-proxy mal configurado.",
      status,
    };
  }

  // JSON / Tools unsupported
  if (stage === "json" && (msg.includes("json") || msg.includes("structured"))) {
    return {
      userMessage: "Este modelo não suporta saída estruturada (JSON mode).",
      howToFix: "Selecione outro modelo que declare suporte a JSON (ex: GPT-4o, Claude 3.5, Gemini 1.5 Pro).",
      status,
    };
  }

  if (stage === "tools" && (msg.includes("tool") || msg.includes("function"))) {
    return {
      userMessage: "Este modelo não suporta function calling / tools.",
      howToFix: "Selecione outro modelo que declare suporte a tools (ex: GPT-4o, Claude 3.5, Gemini 1.5 Pro).",
      status,
    };
  }

  // Generic fallback
  return {
    userMessage: `Falha na etapa '${stage}' com ${provider}. ${err?.message || "Erro desconhecido."}`,
    howToFix: "Verifique os detalhes técnicos abaixo. Se o problema persistir, tente reconectar o provedor ou entre em contato com o suporte.",
    status,
  };
}

async function runStageAuth(
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const result = await discoverModels(provider, apiKey, baseUrl);
    const latencyMs = Date.now() - start;

    if (!result.success) {
      const mapped = mapErrorToUserMessage({ message: result.error, statusCode: undefined }, "auth", provider);
      return {
        ok: false,
        stage: "auth",
        latencyMs,
        message: result.error || "Falha na autenticação",
        userMessage: mapped.userMessage,
        howToFix: mapped.howToFix,
        technicalDetails: result.error,
      };
    }

    return {
      ok: true,
      stage: "auth",
      latencyMs,
      message: `Autenticação OK. ${result.models.length} modelos disponíveis.`,
      userMessage: "Credenciais válidas. Conseguimos acessar o provedor.",
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const mapped = mapErrorToUserMessage(err, "auth", provider);
    return {
      ok: false,
      stage: "auth",
      status: mapped.status,
      latencyMs,
      message: err?.message || "Erro de autenticação",
      userMessage: mapped.userMessage,
      howToFix: mapped.howToFix,
      technicalDetails: err?.stack || String(err),
    };
  }
}

async function runStageModels(
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const result = await discoverModels(provider, apiKey, baseUrl);
    const latencyMs = Date.now() - start;

    if (!result.success || result.models.length === 0) {
      return {
        ok: false,
        stage: "models",
        latencyMs,
        message: result.error || "Nenhum modelo encontrado",
        userMessage: "Não foi possível listar os modelos disponíveis. A autenticação funcionou, mas a listagem falhou.",
        howToFix: "Para Ollama, verifique se há modelos baixados (ollama list). Para endpoints customizados, confirme que /v1/models está implementado.",
        technicalDetails: result.error,
      };
    }

    return {
      ok: true,
      stage: "models",
      latencyMs,
      message: `${result.models.length} modelos descobertos`,
      userMessage: "Listagem de modelos funcionou corretamente.",
      capabilities: {
        vision: result.models.some((m) => m.supportsVision),
        tools: result.models.some((m) => m.supportsTools),
        json: result.models.some((m) => m.supportsJson),
      },
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const mapped = mapErrorToUserMessage(err, "models", provider);
    return {
      ok: false,
      stage: "models",
      status: mapped.status,
      latencyMs,
      message: err?.message || "Erro ao listar modelos",
      userMessage: mapped.userMessage,
      howToFix: mapped.howToFix,
      technicalDetails: err?.stack || String(err),
    };
  }
}

async function runStageChat(
  provider: string,
  modelId: string,
  apiKey: string,
  baseUrl?: string,
  userId?: string
): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    // Map provider names for llm-client
    let resolvedProvider = provider;
    let customUrl = baseUrl;
    if (provider === "custom_openai") resolvedProvider = "openrouter";

    if (customUrl && /^(http:\/\/localhost|http:\/\/127\.)/i.test(customUrl) && process.env.VERCEL) {
      throw new Error("URLs localhost não são acessíveis quando o backend roda na nuvem.");
    }

    const result = await callLLM(
      "You are a connectivity test assistant. Reply with exactly: 'OK · <model-name>'",
      "Reply with exactly: 'OK · <your model name>'",
      { provider: resolvedProvider, model: modelId, customUrl, userId }
    );

    const latencyMs = Date.now() - start;
    const ok = result.output.toLowerCase().includes("ok");

    return {
      ok,
      stage: "chat",
      latencyMs,
      message: ok ? "Chat básico OK" : `Resposta inesperada: ${result.output.slice(0, 200)}`,
      userMessage: ok ? "O modelo respondeu corretamente a um prompt simples." : "O modelo respondeu, mas não no formato esperado. Isso pode indicar um modelo de embeddings ou incompleto.",
      howToFix: ok ? undefined : "Verifique se o modelo selecionado é um modelo de chat/conversação (não embedding ou completion-only).",
      technicalDetails: `Output: ${result.output.slice(0, 500)}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const mapped = mapErrorToUserMessage(err, "chat", provider);
    return {
      ok: false,
      stage: "chat",
      status: mapped.status,
      latencyMs,
      message: err?.message || "Erro no chat",
      userMessage: mapped.userMessage,
      howToFix: mapped.howToFix,
      technicalDetails: err?.stack || String(err),
    };
  }
}

async function runStageJson(
  provider: string,
  modelId: string,
  apiKey: string,
  baseUrl?: string,
  userId?: string
): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    let resolvedProvider = provider;
    let customUrl = baseUrl;
    if (provider === "custom_openai") resolvedProvider = "openrouter";

    if (customUrl && /^(http:\/\/localhost|http:\/\/127\.)/i.test(customUrl) && process.env.VERCEL) {
      throw new Error("URLs localhost não são acessíveis quando o backend roda na nuvem.");
    }

    // We use generateObject to test structured output capability
    const { model } = await (await import("./llm-client.js")).getLanguageModel(resolvedProvider, modelId, userId, customUrl);
    const { object } = await generateObject({
      model: model as any,
      schema: { type: "object", properties: { ok: { type: "boolean" }, model: { type: "string" } }, required: ["ok", "model"] } as any,
      prompt: "Return JSON with ok=true and your model name.",
      system: "You must output valid JSON only.",
    });

    const latencyMs = Date.now() - start;
    const ok = (object as any)?.ok === true;

    return {
      ok,
      stage: "json",
      latencyMs,
      message: ok ? "JSON mode OK" : "Resposta JSON inesperada",
      userMessage: ok ? "O modelo suporta saída estruturada (JSON mode)." : "O modelo não retornou JSON válido.",
      howToFix: ok ? undefined : "Este modelo pode não suportar JSON mode. Desative a opção 'JSON' para esta conexão.",
      technicalDetails: `Response: ${JSON.stringify(object).slice(0, 500)}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const mapped = mapErrorToUserMessage(err, "json", provider);
    return {
      ok: false,
      stage: "json",
      status: mapped.status,
      latencyMs,
      message: err?.message || "Erro no JSON mode",
      userMessage: mapped.userMessage,
      howToFix: mapped.howToFix || "Desative JSON mode para esta conexão se o modelo não declarar suporte.",
      technicalDetails: err?.stack || String(err),
    };
  }
}

async function runStageTools(
  provider: string,
  modelId: string,
  apiKey: string,
  baseUrl?: string,
  userId?: string
): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    let resolvedProvider = provider;
    let customUrl = baseUrl;
    if (provider === "custom_openai") resolvedProvider = "openrouter";

    if (customUrl && /^(http:\/\/localhost|http:\/\/127\.)/i.test(customUrl) && process.env.VERCEL) {
      throw new Error("URLs localhost não são acessíveis quando o backend roda na nuvem.");
    }

    const { model } = await (await import("./llm-client.js")).getLanguageModel(resolvedProvider, modelId, userId, customUrl);

    const result = await generateText({
      model,
      system: "You have a tool 'ping' that returns 'pong'. Use it when asked.",
      prompt: "Call the ping tool.",
      tools: {
        ping: {
          description: "Returns pong",
          parameters: { type: "object", properties: {}, additionalProperties: false } as any,
        },
      } as any,
      maxOutputTokens: 100,
    });

    const latencyMs = Date.now() - start;
    const ok = result.toolCalls && result.toolCalls.length > 0;

    return {
      ok,
      stage: "tools",
      latencyMs,
      message: ok ? "Tools OK" : "O modelo não chamou a tool",
      userMessage: ok ? "O modelo suporta function calling (tools)." : "O modelo não chamou a tool de teste. Pode ser que não suporte function calling.",
      howToFix: ok ? undefined : "Desative 'Tools' para esta conexão se o modelo não declarar suporte a function calling.",
      technicalDetails: `Tool calls: ${JSON.stringify(result.toolCalls || []).slice(0, 500)}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const mapped = mapErrorToUserMessage(err, "tools", provider);
    return {
      ok: false,
      stage: "tools",
      status: mapped.status,
      latencyMs,
      message: err?.message || "Erro no tools",
      userMessage: mapped.userMessage,
      howToFix: mapped.howToFix || "Desative 'Tools' para esta conexão se o modelo não declarar suporte.",
      technicalDetails: err?.stack || String(err),
    };
  }
}

/**
 * Run full diagnostics on a connection.
 * Stops at first fatal failure (auth/models) but continues for optional stages.
 */
export async function runDiagnostics(
  connection: {
    id: number;
    provider: string;
    modelId: string;
    baseUrl: string | null;
    supportsJson?: boolean;
    supportsTools?: boolean;
    apiKey: string; // encrypted — caller must decrypt
  },
  userId?: string
): Promise<ConnectionDiagnostics> {
  const results: DiagnosticResult[] = [];

  // Stage 1: Auth (via discovery)
  const authResult = await runStageAuth(connection.provider, connection.apiKey, connection.baseUrl || undefined);
  results.push(authResult);
  if (!authResult.ok) {
    return { connectionId: connection.id, results, overall: "error" };
  }

  // Stage 2: Models (via discovery)
  const modelsResult = await runStageModels(connection.provider, connection.apiKey, connection.baseUrl || undefined);
  results.push(modelsResult);
  if (!modelsResult.ok) {
    return { connectionId: connection.id, results, overall: "error" };
  }

  // Stage 3: Chat
  const chatResult = await runStageChat(connection.provider, connection.modelId, connection.apiKey, connection.baseUrl || undefined, userId);
  results.push(chatResult);
  if (!chatResult.ok) {
    return { connectionId: connection.id, results, overall: "error" };
  }

  // Stage 4: JSON (only if model claims support)
  if (connection.supportsJson !== false) {
    const jsonResult = await runStageJson(connection.provider, connection.modelId, connection.apiKey, connection.baseUrl || undefined, userId);
    results.push(jsonResult);
  }

  // Stage 5: Tools (only if model claims support)
  if (connection.supportsTools !== false) {
    const toolsResult = await runStageTools(connection.provider, connection.modelId, connection.apiKey, connection.baseUrl || undefined, userId);
    results.push(toolsResult);
  }

  // Determine overall status
  const hasError = results.some((r) => !r.ok);
  const hasWarning = results.some((r) => r.ok && (r.stage === "json" || r.stage === "tools") && r.message.includes("inesperada"));

  return {
    connectionId: connection.id,
    results,
    overall: hasError ? "error" : hasWarning ? "warning" : "ok",
  };
}

/**
 * Validate credentials without saving.
 * Runs auth + models discovery only.
 */
export async function validateCredentials(
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<DiagnosticResult[]> {
  const authResult = await runStageAuth(provider, apiKey, baseUrl);
  if (!authResult.ok) return [authResult];

  const modelsResult = await runStageModels(provider, apiKey, baseUrl);
  return [authResult, modelsResult];
}

/**
 * Test a single capability.
 */
export async function testCapability(
  connection: {
    id: number;
    provider: string;
    modelId: string;
    baseUrl: string | null;
    apiKey: string;
  },
  capability: "chat" | "json" | "tools",
  userId?: string
): Promise<DiagnosticResult> {
  switch (capability) {
    case "chat":
      return runStageChat(connection.provider, connection.modelId, connection.apiKey, connection.baseUrl || undefined, userId);
    case "json":
      return runStageJson(connection.provider, connection.modelId, connection.apiKey, connection.baseUrl || undefined, userId);
    case "tools":
      return runStageTools(connection.provider, connection.modelId, connection.apiKey, connection.baseUrl || undefined, userId);
    default:
      return {
        ok: false,
        stage: capability as DiagnosticStage,
        latencyMs: 0,
        message: "Capability não suportada",
        userMessage: "Capability não suportada para teste.",
      };
  }
}
