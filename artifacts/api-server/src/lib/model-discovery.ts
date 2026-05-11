/**
 * Model Discovery — dynamically fetch available models from each provider.
 */

export interface DiscoveredModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsJson?: boolean;
  priceInput?: string;
  priceOutput?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface DiscoveryResult {
  success: boolean;
  models: DiscoveredModel[];
  error?: string;
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────
export async function discoverOpenRouter(apiKey: string): Promise<DiscoveryResult> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://tax-group-hub.vercel.app", "X-Title": "Tax Group AI Hub" },
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, models: [], error: `OpenRouter ${res.status}: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const models = (data.data || []).map((m): DiscoveredModel => {
      const pricing = (m.pricing as Record<string, string>) || {};
      const arch = (m.architecture as Record<string, unknown>) || {};
      const modality = (arch.modality as string) || "";
      return {
        id: String(m.id),
        name: String(m.name || m.id),
        contextWindow: typeof m.context_length === "number" ? m.context_length : undefined,
        supportsVision: modality.includes("image"),
        supportsTools: String(m.description || "").toLowerCase().includes("tool") || String(m.id).includes("gpt-4") || String(m.id).includes("claude"),
        supportsJson: true,
        priceInput: pricing.prompt ? `$${(Number(pricing.prompt) * 1_000_000).toFixed(2)} / 1M tokens` : undefined,
        priceOutput: pricing.completion ? `$${(Number(pricing.completion) * 1_000_000).toFixed(2)} / 1M tokens` : undefined,
        providerMetadata: m,
      };
    });
    return { success: true, models };
  } catch (err: any) {
    return { success: false, models: [], error: err.message };
  }
}

// ─── Ollama ───────────────────────────────────────────────────────────────────
export async function discoverOllama(baseUrl: string): Promise<DiscoveryResult> {
  try {
    const url = baseUrl.replace(/\/+$/, "");
    // Handle URLs that already include /api (e.g. https://ollama.com/api)
    const tagsEndpoint = url.endsWith("/api") ? `${url}/tags` : `${url}/api/tags`;
    const res = await fetch(tagsEndpoint, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const hint = res.status === 404
        ? ` — Endpoint não encontrado: ${tagsEndpoint}`
        : "";
      return { success: false, models: [], error: `Ollama ${res.status}${hint}` };
    }
    const data = (await res.json()) as { models?: Array<{ name: string; size?: number; modified_at?: string; details?: Record<string, unknown> }> };
    const models = (data.models || []).map((m): DiscoveredModel => ({
      id: m.name,
      name: m.name,
      providerMetadata: { size: m.size, modifiedAt: m.modified_at, details: m.details },
      // Ollama models generally support vision if name contains 'vision' or 'llava'
      supportsVision: /vision|llava|bakllava/i.test(m.name),
      supportsTools: /llama3|mistral|qwen|phi3/i.test(m.name),
      supportsJson: /llama3|mistral|qwen|phi3/i.test(m.name),
    }));
    return { success: true, models };
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.message?.includes("abort")) {
      return { success: false, models: [], error: "Timeout: Ollama não respondeu em 8s." };
    }
    return { success: false, models: [], error: err.message };
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
export async function discoverOpenAI(apiKey: string): Promise<DiscoveryResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, models: [], error: `OpenAI ${res.status}: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { data?: Array<{ id: string; object: string; owned_by?: string; created?: number }> };
    // Filter to chat/completion models only
    const chatModels = (data.data || []).filter(
      (m) =>
        m.object === "model" &&
        (m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3") || m.id.startsWith("o4") || m.id.startsWith("text-embedding"))
    );

    const contextMap: Record<string, number> = {
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "gpt-4-turbo": 128000,
      "gpt-4": 8192,
      "gpt-3.5-turbo": 16385,
      "o1": 128000,
      "o3-mini": 200000,
      "o4-mini": 200000,
    };

    const models = chatModels.map((m): DiscoveredModel => {
      const id = m.id;
      const cw = Object.entries(contextMap).find(([k]) => id.includes(k))?.[1];
      return {
        id,
        name: id,
        contextWindow: cw,
        supportsVision: id.includes("4o") || id.includes("vision"),
        supportsTools: id.includes("gpt-4") || id.includes("o1") || id.includes("o3") || id.includes("o4"),
        supportsJson: id.includes("gpt-4") || id.includes("o1") || id.includes("o3") || id.includes("o4"),
        providerMetadata: { ownedBy: m.owned_by, created: m.created },
      };
    });

    return { success: true, models };
  } catch (err: any) {
    return { success: false, models: [], error: err.message };
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
export async function discoverAnthropic(apiKey: string): Promise<DiscoveryResult> {
  // Anthropic doesn't have a public /models endpoint yet (as of mid-2025).
  // We return a static list with known models and verify the key via a ping.
  try {
    const ping = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!ping.ok && ping.status !== 400) {
      const err = await ping.text();
      return { success: false, models: [], error: `Anthropic ${ping.status}: ${err.slice(0, 200)}` };
    }

    const models: DiscoveredModel[] = [
      { id: "claude-opus-4", name: "Claude Opus 4", contextWindow: 200000, supportsVision: true, supportsTools: true, supportsJson: true },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", contextWindow: 200000, supportsVision: true, supportsTools: true, supportsJson: true },
      { id: "claude-haiku-4", name: "Claude Haiku 4", contextWindow: 200000, supportsVision: true, supportsTools: true, supportsJson: true },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", contextWindow: 200000, supportsVision: true, supportsTools: true, supportsJson: true },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", contextWindow: 200000, supportsVision: true, supportsTools: true, supportsJson: true },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, supportsVision: false, supportsTools: true, supportsJson: true },
    ];
    return { success: true, models };
  } catch (err: any) {
    return { success: false, models: [], error: err.message };
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────────────
export async function discoverGoogle(apiKey: string): Promise<DiscoveryResult> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, models: [], error: `Google ${res.status}: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { models?: Array<{ name: string; displayName?: string; inputTokenLimit?: number; outputTokenLimit?: number; supportedGenerationMethods?: string[] }> };
    const models = (data.models || [])
      .filter((m) => m.name?.startsWith("models/gemini"))
      .map((m): DiscoveredModel => {
        const id = m.name.replace("models/", "");
        return {
          id,
          name: m.displayName || id,
          contextWindow: m.inputTokenLimit,
          maxTokens: m.outputTokenLimit,
          supportsVision: id.includes("vision") || id.includes("pro") || id.includes("flash"),
          supportsTools: (m.supportedGenerationMethods || []).includes("generateContent"),
          supportsJson: true,
          providerMetadata: { methods: m.supportedGenerationMethods },
        };
      });
    return { success: true, models };
  } catch (err: any) {
    return { success: false, models: [], error: err.message };
  }
}

// ─── Custom OpenAI-compatible ─────────────────────────────────────────────────
export async function discoverCustomOpenAI(baseUrl: string, apiKey?: string): Promise<DiscoveryResult> {
  try {
    const url = baseUrl.replace(/\/+$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch(`${url}/models`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { success: false, models: [], error: `Custom provider ${res.status}` };
    }
    const data = (await res.json()) as { data?: Array<{ id: string; object?: string }> };
    const models = (data.data || []).map((m): DiscoveredModel => ({
      id: m.id,
      name: m.id,
      supportsTools: true,
      supportsJson: true,
    }));
    return { success: true, models };
  } catch (err: any) {
    return { success: false, models: [], error: err.message };
  }
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────
export async function discoverModels(
  provider: string,
  apiKey: string,
  baseUrl?: string
): Promise<DiscoveryResult> {
  switch (provider) {
    case "openrouter":
      return discoverOpenRouter(apiKey);
    case "openai":
      return discoverOpenAI(apiKey);
    case "anthropic":
      return discoverAnthropic(apiKey);
    case "google":
      return discoverGoogle(apiKey);
    case "ollama":
      return discoverOllama(baseUrl || "http://localhost:11434");
    case "ollama_cloud":
      return discoverOllama(baseUrl || "https://ollama.com/api");
    case "custom_openai":
      return discoverCustomOpenAI(baseUrl || "", apiKey);
    default:
      return { success: false, models: [], error: `Provider '${provider}' not supported for discovery.` };
  }
}
