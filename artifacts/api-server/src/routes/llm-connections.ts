import { Router, type IRouter } from "express";
import { db, llmConnectionsTable, llmProfilesTable, appConfigTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/crypto.js";
import { apiError } from "../lib/api-response.js";
import { isRealUser } from "../middlewares/auth.js";
import { discoverModels } from "../lib/model-discovery.js";
import { callLLM } from "../lib/llm-client.js";
import { healthCheckConnections } from "../lib/llm-router.js";

const router: IRouter = Router();

// ─── Helper: scoped query filter ──────────────────────────────────────────────
function scopeByUser(userId: string | undefined) {
  return isRealUser(userId) ? eq(llmConnectionsTable.userId, userId) : undefined;
}

// ─── GET /api/llm/providers — List supported providers with metadata ──────────
router.get("/llm/providers", (_req, res) => {
  res.json({
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        label: "OpenAI GPT",
        icon: "⬡",
        color: "text-emerald-400",
        ring: "ring-emerald-500/40",
        dot: "bg-emerald-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "OpenAI API Key",
        keyPlaceholder: "sk-...",
      },
      {
        id: "anthropic",
        name: "Anthropic",
        label: "Anthropic Claude",
        icon: "◈",
        color: "text-amber-400",
        ring: "ring-amber-500/40",
        dot: "bg-amber-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "Anthropic API Key",
        keyPlaceholder: "sk-ant-...",
      },
      {
        id: "google",
        name: "Google",
        label: "Google Gemini",
        icon: "✦",
        color: "text-blue-400",
        ring: "ring-blue-500/40",
        dot: "bg-blue-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "Gemini API Key",
        keyPlaceholder: "AIzaSy...",
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        label: "OpenRouter",
        icon: "⇌",
        color: "text-purple-400",
        ring: "ring-purple-500/40",
        dot: "bg-purple-400",
        supportsDiscovery: true,
        needsBaseUrl: false,
        keyLabel: "OpenRouter API Key",
        keyPlaceholder: "sk-or-...",
      },
      {
        id: "ollama",
        name: "Ollama",
        label: "Ollama Local",
        icon: "🦙",
        color: "text-sky-400",
        ring: "ring-sky-500/40",
        dot: "bg-sky-400",
        supportsDiscovery: true,
        needsBaseUrl: true,
        baseUrlPlaceholder: "http://localhost:11434",
        keyLabel: "Bearer Token (opcional)",
        keyPlaceholder: "Deixe em branco se não houver auth",
      },
      {
        id: "custom_openai",
        name: "Custom OpenAI",
        label: "OpenAI-Compatible",
        icon: "⚙",
        color: "text-gray-400",
        ring: "ring-gray-500/40",
        dot: "bg-gray-400",
        supportsDiscovery: true,
        needsBaseUrl: true,
        baseUrlPlaceholder: "https://api.exemplo.com/v1",
        keyLabel: "API Key",
        keyPlaceholder: "sk-...",
      },
    ],
  });
});

// ─── POST /api/llm/discover — Fetch available models from a provider ──────────
router.post("/llm/discover", async (req, res) => {
  try {
    const { provider, apiKey, baseUrl } = req.body as {
      provider: string;
      apiKey: string;
      baseUrl?: string;
    };
    if (!provider || !apiKey) {
      apiError(res, 400, "provider and apiKey are required");
      return;
    }
    const result = await discoverModels(provider, apiKey, baseUrl);
    res.json(result);
  } catch (err: any) {
    console.error("[LLM] discover error:", err);
    apiError(res, 500, "Discovery failed");
  }
});

// ─── GET /api/llm/connections — List all connections for user ─────────────────
router.get("/llm/connections", async (req, res) => {
  try {
    const userId = req.userId;
    const connections: typeof llmConnectionsTable.$inferSelect[] = await db
      .select()
      .from(llmConnectionsTable)
      .where(scopeByUser(userId))
      .orderBy(desc(llmConnectionsTable.createdAt));

    // Decrypt keys before sending? NO — never send API keys to frontend.
    // Strip sensitive fields.
    const safe = connections.map((c: typeof llmConnectionsTable.$inferSelect) => {
      const { apiKey: _, ...rest } = c;
      return { ...rest, hasKey: !!c.apiKey };
    });

    res.json({ success: true, connections: safe });
  } catch (err) {
    console.error("[LLM] list connections error:", err);
    apiError(res, 500, "Failed to list connections");
  }
});

// ─── POST /api/llm/connections — Create a new connection ──────────────────────
router.post("/llm/connections", async (req, res) => {
  try {
    const userId = req.userId;
    const body = req.body as {
      name?: string;
      provider?: string;
      baseUrl?: string;
      apiKey?: string;
      modelId?: string;
      modelName?: string;
      contextWindow?: number;
      maxTokens?: number;
      supportsVision?: boolean;
      supportsTools?: boolean;
      supportsJson?: boolean;
      priceInput?: string;
      priceOutput?: string;
      providerMetadata?: Record<string, unknown>;
      usageType?: string;
    };

    if (!body.provider || !body.apiKey || !body.modelId) {
      apiError(res, 400, "provider, apiKey and modelId are required");
      return;
    }

    const encryptedKey = encrypt(body.apiKey.trim());

    // If setting as default for this usageType, clear previous defaults
    if (body.usageType) {
      await db
        .update(llmConnectionsTable)
        .set({ isDefault: false })
        .where(
          and(
            eq(llmConnectionsTable.usageType, body.usageType),
            scopeByUser(userId) as any
          )
        );
    }

    const [conn] = await db
      .insert(llmConnectionsTable)
      .values({
        userId: isRealUser(userId) ? userId : null,
        name: body.name || `${body.provider} — ${body.modelId}`,
        provider: body.provider,
        baseUrl: body.baseUrl || null,
        apiKey: encryptedKey,
        modelId: body.modelId,
        modelName: body.modelName || body.modelId,
        contextWindow: body.contextWindow ?? null,
        maxTokens: body.maxTokens ?? null,
        supportsVision: body.supportsVision ?? false,
        supportsTools: body.supportsTools ?? false,
        supportsJson: body.supportsJson ?? false,
        priceInput: body.priceInput || null,
        priceOutput: body.priceOutput || null,
        providerMetadata: body.providerMetadata || null,
        usageType: body.usageType || "chat",
        isDefault: true, // first connection of a usageType becomes default
        isActive: true,
      })
      .returning();

    const { apiKey: _, ...safe } = conn;
    res.status(201).json({ success: true, connection: { ...safe, hasKey: true } });
  } catch (err) {
    console.error("[LLM] create connection error:", err);
    apiError(res, 500, "Failed to create connection");
  }
});

// ─── PUT /api/llm/connections/:id — Update a connection ───────────────────────
router.put("/llm/connections/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid connection id"); return; }

    const body = req.body as Partial<{
      name: string;
      baseUrl: string;
      apiKey: string;
      modelId: string;
      modelName: string;
      contextWindow: number;
      maxTokens: number;
      supportsVision: boolean;
      supportsTools: boolean;
      supportsJson: boolean;
      priceInput: string;
      priceOutput: string;
      providerMetadata: Record<string, unknown>;
      usageType: string;
      isActive: boolean;
    }>;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.baseUrl !== undefined) updateData.baseUrl = body.baseUrl || null;
    if (body.apiKey !== undefined) updateData.apiKey = encrypt(body.apiKey.trim());
    if (body.modelId !== undefined) updateData.modelId = body.modelId;
    if (body.modelName !== undefined) updateData.modelName = body.modelName;
    if (body.contextWindow !== undefined) updateData.contextWindow = body.contextWindow;
    if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
    if (body.supportsVision !== undefined) updateData.supportsVision = body.supportsVision;
    if (body.supportsTools !== undefined) updateData.supportsTools = body.supportsTools;
    if (body.supportsJson !== undefined) updateData.supportsJson = body.supportsJson;
    if (body.priceInput !== undefined) updateData.priceInput = body.priceInput || null;
    if (body.priceOutput !== undefined) updateData.priceOutput = body.priceOutput || null;
    if (body.providerMetadata !== undefined) updateData.providerMetadata = body.providerMetadata;
    if (body.usageType !== undefined) updateData.usageType = body.usageType;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const [updated] = await db
      .update(llmConnectionsTable)
      .set(updateData)
      .where(and(...conditions))
      .returning();

    if (!updated) { apiError(res, 404, "Connection not found"); return; }

    const { apiKey: _, ...safe } = updated;
    res.json({ success: true, connection: { ...safe, hasKey: true } });
  } catch (err) {
    console.error("[LLM] update connection error:", err);
    apiError(res, 500, "Failed to update connection");
  }
});

// ─── DELETE /api/llm/connections/:id — Remove a connection ────────────────────
router.delete("/llm/connections/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid connection id"); return; }

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    await db.delete(llmConnectionsTable).where(and(...conditions));
    res.json({ success: true });
  } catch (err) {
    console.error("[LLM] delete connection error:", err);
    apiError(res, 500, "Failed to delete connection");
  }
});

// ─── POST /api/llm/connections/:id/test — Test a specific connection ──────────
router.post("/llm/connections/:id/test", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid connection id"); return; }

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const [conn] = await db
      .select()
      .from(llmConnectionsTable)
      .where(and(...conditions))
      .limit(1);

    if (!conn) { apiError(res, 404, "Connection not found"); return; }

    const apiKey = decrypt(conn.apiKey);
    const start = Date.now();

    try {
      // Map our provider names to llm-client provider names
      let provider = conn.provider;
      let customUrl = conn.baseUrl || undefined;
      if (provider === "custom_openai") provider = "openrouter"; // hack: custom_openai uses openai-sdk with custom baseURL

      const result = await callLLM(
        "You are a connectivity test assistant. Reply with exactly: 'OK · <model-name>'",
        "Reply with exactly: 'OK · <your model name>'",
        {
          provider,
          model: conn.modelId,
          customUrl,
          userId,
        }
      );

      const ok = result.output.toLowerCase().includes("ok");

      await db
        .update(llmConnectionsTable)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: ok ? "ok" : "error",
          lastError: ok ? null : `Unexpected response: ${result.output.slice(0, 200)}`,
        })
        .where(eq(llmConnectionsTable.id, id));

      res.json({
        success: true,
        ok,
        response: result.output,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
        executionTimeMs: Date.now() - start,
      });
    } catch (err: any) {
      await db
        .update(llmConnectionsTable)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: "error",
          lastError: err.message?.slice(0, 500) || "Unknown error",
        })
        .where(eq(llmConnectionsTable.id, id));

      res.json({ success: true, ok: false, error: err.message, executionTimeMs: Date.now() - start });
    }
  } catch (err) {
    console.error("[LLM] test connection error:", err);
    apiError(res, 500, "Failed to test connection");
  }
});

// ─── POST /api/llm/connections/:id/activate — Set as default for usageType ────
router.post("/llm/connections/:id/activate", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid connection id"); return; }

    const conditions = [eq(llmConnectionsTable.id, id)];
    const userScope = scopeByUser(userId);
    if (userScope) conditions.push(userScope);

    const [conn] = await db
      .select()
      .from(llmConnectionsTable)
      .where(and(...conditions))
      .limit(1);

    if (!conn) { apiError(res, 404, "Connection not found"); return; }

    // Clear previous default for this usageType
    const clearConditions = [
      eq(llmConnectionsTable.usageType, conn.usageType),
      eq(llmConnectionsTable.isDefault, true),
    ];
    if (userScope) clearConditions.push(userScope);

    await db
      .update(llmConnectionsTable)
      .set({ isDefault: false })
      .where(and(...clearConditions));

    // Set new default
    await db
      .update(llmConnectionsTable)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(llmConnectionsTable.id, id));

    res.json({ success: true, connectionId: id, usageType: conn.usageType });
  } catch (err) {
    console.error("[LLM] activate connection error:", err);
    apiError(res, 500, "Failed to activate connection");
  }
});

// ─── GET /api/llm/profiles — List profiles ────────────────────────────────────
router.get("/llm/profiles", async (req, res) => {
  try {
    const userId = req.userId;
    const profiles = await db
      .select()
      .from(llmProfilesTable)
      .where(isRealUser(userId) ? eq(llmProfilesTable.userId, userId) : undefined)
      .orderBy(desc(llmProfilesTable.createdAt));

    res.json({ success: true, profiles });
  } catch (err) {
    console.error("[LLM] list profiles error:", err);
    apiError(res, 500, "Failed to list profiles");
  }
});

// ─── POST /api/llm/profiles — Create profile ──────────────────────────────────
router.post("/llm/profiles", async (req, res) => {
  try {
    const userId = req.userId;
    const body = req.body as {
      name: string;
      description?: string;
      chatConnectionId?: number;
      fastConnectionId?: number;
      reasoningConnectionId?: number;
      visionConnectionId?: number;
      embeddingConnectionId?: number;
      imageConnectionId?: number;
      transcriptionConnectionId?: number;
    };

    if (!body.name?.trim()) { apiError(res, 400, "name is required"); return; }

    // Clear previous default if this one is default
    const isDefault = true; // first profile becomes default
    await db
      .update(llmProfilesTable)
      .set({ isDefault: false })
      .where(isRealUser(userId) ? eq(llmProfilesTable.userId, userId) : undefined);

    const [profile] = await db
      .insert(llmProfilesTable)
      .values({
        userId: isRealUser(userId) ? userId : "system",
        name: body.name.trim(),
        description: body.description || null,
        chatConnectionId: body.chatConnectionId ?? null,
        fastConnectionId: body.fastConnectionId ?? null,
        reasoningConnectionId: body.reasoningConnectionId ?? null,
        visionConnectionId: body.visionConnectionId ?? null,
        embeddingConnectionId: body.embeddingConnectionId ?? null,
        imageConnectionId: body.imageConnectionId ?? null,
        transcriptionConnectionId: body.transcriptionConnectionId ?? null,
        isDefault,
      })
      .returning();

    res.status(201).json({ success: true, profile });
  } catch (err) {
    console.error("[LLM] create profile error:", err);
    apiError(res, 500, "Failed to create profile");
  }
});

// ─── PUT /api/llm/profiles/:id — Update profile ───────────────────────────────
router.put("/llm/profiles/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid profile id"); return; }

    const body = req.body as Partial<{
      name: string;
      description: string;
      chatConnectionId: number | null;
      fastConnectionId: number | null;
      reasoningConnectionId: number | null;
      visionConnectionId: number | null;
      embeddingConnectionId: number | null;
      imageConnectionId: number | null;
      transcriptionConnectionId: number | null;
      isDefault: boolean;
    }>;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.chatConnectionId !== undefined) updateData.chatConnectionId = body.chatConnectionId;
    if (body.fastConnectionId !== undefined) updateData.fastConnectionId = body.fastConnectionId;
    if (body.reasoningConnectionId !== undefined) updateData.reasoningConnectionId = body.reasoningConnectionId;
    if (body.visionConnectionId !== undefined) updateData.visionConnectionId = body.visionConnectionId;
    if (body.embeddingConnectionId !== undefined) updateData.embeddingConnectionId = body.embeddingConnectionId;
    if (body.imageConnectionId !== undefined) updateData.imageConnectionId = body.imageConnectionId;
    if (body.transcriptionConnectionId !== undefined) updateData.transcriptionConnectionId = body.transcriptionConnectionId;

    const conditions = [eq(llmProfilesTable.id, id)];
    if (isRealUser(userId)) conditions.push(eq(llmProfilesTable.userId, userId));

    const [updated] = await db
      .update(llmProfilesTable)
      .set(updateData)
      .where(and(...conditions))
      .returning();

    if (!updated) { apiError(res, 404, "Profile not found"); return; }

    // Handle isDefault separately to ensure only one default
    if (body.isDefault) {
      await db
        .update(llmProfilesTable)
        .set({ isDefault: false })
        .where(and(eq(llmProfilesTable.userId, updated.userId)));
      await db
        .update(llmProfilesTable)
        .set({ isDefault: true })
        .where(eq(llmProfilesTable.id, id));
    }

    res.json({ success: true, profile: updated });
  } catch (err) {
    console.error("[LLM] update profile error:", err);
    apiError(res, 500, "Failed to update profile");
  }
});

// ─── DELETE /api/llm/profiles/:id — Remove profile ────────────────────────────
router.delete("/llm/profiles/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid profile id"); return; }

    const conditions = [eq(llmProfilesTable.id, id)];
    if (isRealUser(userId)) conditions.push(eq(llmProfilesTable.userId, userId));

    await db.delete(llmProfilesTable).where(and(...conditions));
    res.json({ success: true });
  } catch (err) {
    console.error("[LLM] delete profile error:", err);
    apiError(res, 500, "Failed to delete profile");
  }
});

// ─── POST /api/llm/profiles/:id/activate — Set as active profile ──────────────
router.post("/llm/profiles/:id/activate", async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (isNaN(id)) { apiError(res, 400, "Invalid profile id"); return; }

    const conditions = [eq(llmProfilesTable.id, id)];
    if (isRealUser(userId)) conditions.push(eq(llmProfilesTable.userId, userId));

    const [profile] = await db
      .select()
      .from(llmProfilesTable)
      .where(and(...conditions))
      .limit(1);

    if (!profile) { apiError(res, 404, "Profile not found"); return; }

    await db
      .update(llmProfilesTable)
      .set({ isActive: false })
      .where(eq(llmProfilesTable.userId, profile.userId));

    await db
      .update(llmProfilesTable)
      .set({ isActive: true })
      .where(eq(llmProfilesTable.id, id));

    res.json({ success: true, profileId: id });
  } catch (err) {
    console.error("[LLM] activate profile error:", err);
    apiError(res, 500, "Failed to activate profile");
  }
});

// ─── GET /api/llm/active-profile — Get current active profile with resolved connections
router.get("/llm/active-profile", async (req, res) => {
  try {
    const userId = req.userId;
    const conditions = isRealUser(userId)
      ? and(eq(llmProfilesTable.userId, userId), eq(llmProfilesTable.isActive, true))
      : eq(llmProfilesTable.isActive, true);

    const [profile] = await db
      .select()
      .from(llmProfilesTable)
      .where(conditions)
      .limit(1);

    if (!profile) {
      res.json({ success: true, profile: null });
      return;
    }

    // Resolve connections
    const connIds = [
      profile.chatConnectionId,
      profile.fastConnectionId,
      profile.reasoningConnectionId,
      profile.visionConnectionId,
      profile.embeddingConnectionId,
      profile.imageConnectionId,
      profile.transcriptionConnectionId,
    ].filter(Boolean) as number[];

    const resolved: typeof llmConnectionsTable.$inferSelect[] = connIds.length
      ? await db.select().from(llmConnectionsTable).where(inArray(llmConnectionsTable.id, connIds))
      : [];
    const connMap = new Map(resolved.map((c: typeof llmConnectionsTable.$inferSelect) => [c.id, c]));

    const stripKey = (c: typeof llmConnectionsTable.$inferSelect) => {
      const { apiKey: _, ...rest } = c;
      return rest;
    };

    res.json({
      success: true,
      profile: {
        ...profile,
        chatConnection: profile.chatConnectionId ? stripKey(connMap.get(profile.chatConnectionId)!) : null,
        fastConnection: profile.fastConnectionId ? stripKey(connMap.get(profile.fastConnectionId)!) : null,
        reasoningConnection: profile.reasoningConnectionId ? stripKey(connMap.get(profile.reasoningConnectionId)!) : null,
        visionConnection: profile.visionConnectionId ? stripKey(connMap.get(profile.visionConnectionId)!) : null,
        embeddingConnection: profile.embeddingConnectionId ? stripKey(connMap.get(profile.embeddingConnectionId)!) : null,
        imageConnection: profile.imageConnectionId ? stripKey(connMap.get(profile.imageConnectionId)!) : null,
        transcriptionConnection: profile.transcriptionConnectionId ? stripKey(connMap.get(profile.transcriptionConnectionId)!) : null,
      },
    });
  } catch (err) {
    console.error("[LLM] active profile error:", err);
    apiError(res, 500, "Failed to get active profile");
  }
});

// ─── POST /api/llm/health-check — Run health checks on all active connections ─
router.post("/llm/health-check", async (req, res) => {
  try {
    const userId = req.userId;
    const results = await healthCheckConnections(isRealUser(userId) ? userId : undefined);
    res.json({ success: true, results });
  } catch (err) {
    console.error("[LLM] health-check error:", err);
    apiError(res, 500, "Health check failed");
  }
});

export default router;
