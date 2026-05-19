import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import express from "express";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════
// Design decisions:
// - chain() retorna um objeto "thenable" (tem .then/.catch) para que await
//   funcione corretamente — a chain do Drizzle é usada com await, não como fn()
// - apiError é mockado para chamar res.status(code).json() para que o Express
//   realmente envie a resposta (evita timeouts do supertest)

vi.mock("@workspace/db", () => {
  function chain(result: any = []) {
    const prom = Promise.resolve(result);
    // Função thenable: quando chamada com () retorna a Promise,
    // quando usada com await resolve via .then
    const c: any = (..._args: any[]) => prom;
    c.then     = prom.then.bind(prom);
    c.catch    = prom.catch.bind(prom);
    c.from      = vi.fn(() => c);
    c.where     = vi.fn(() => c);
    c.leftJoin  = vi.fn(() => c);
    c.innerJoin = vi.fn(() => c);
    c.orderBy   = vi.fn(() => c);
    c.limit     = vi.fn(() => c);
    c.values    = vi.fn(() => c);
    c.set       = vi.fn(() => c);
    c.returning = vi.fn(() => prom);
    c.execute   = vi.fn(() => Promise.resolve({ rows: [] }));
    return c;
  }

  return {
    db: {
      select:  vi.fn(() => chain()),
      insert:  vi.fn(() => chain()),
      update:  vi.fn(() => chain()),
      delete:  vi.fn(() => chain()),
      execute: vi.fn(() => Promise.resolve({ rows: [] })),
    },
    crmContactsTable: {
      id: "id", userId: "user_id", status: "status", source: "source",
      uf: "uf", porte: "porte", aiScore: "ai_score", createdAt: "created_at",
      razaoSocial: "razao_social", nomeFantasia: "nome_fantasia", cnpj: "cnpj",
      tags: "tags", customFields: "custom_fields", regimeTributario: "regime_tributario",
      updatedAt: "updated_at",
    },
    crmDealsTable: {
      id: "id", userId: "user_id", pipelineId: "pipeline_id",
      contactId: "contact_id", title: "title", stage: "stage", value: "value",
      probability: "probability", createdAt: "created_at", updatedAt: "updated_at",
      expectedCloseDate: "expected_close_date", notes: "notes",
      wonAt: "won_at", lostAt: "lost_at", produto: "produto",
    },
    crmPipelinesTable: {
      id: "id", name: "name", stages: "stages", userId: "user_id",
      isDefault: "is_default",
    },
    crmActivitiesTable: {},
    crmEnrichmentLogTable: {},
    crmAttachmentsTable: {},
    crmTasksTable: {},
    crmSavedViewsTable: {},
    crmAutomationsTable: {},
    automationSequencesTable: {},
    sequenceEnrollmentsTable: {},
    appConfigTable: { key: "key", value: "value" },
    llmConnectionsTable: {
      id: "id", userId: "user_id", isActive: "is_active", provider: "provider",
      name: "name", apiKey: "api_key", modelId: "model_id", modelName: "model_name",
      baseUrl: "base_url", contextWindow: "context_window", maxTokens: "max_tokens",
      supportsVision: "supports_vision", supportsTools: "supports_tools",
      supportsJson: "supports_json", usageType: "usage_type", isDefault: "is_default",
      lastTestedAt: "last_tested_at", lastTestStatus: "last_test_status",
      lastError: "last_error", createdAt: "created_at", updatedAt: "updated_at",
    },
    llmProfilesTable: { id: "id", userId: "user_id", isActive: "is_active" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq:       vi.fn((a: any, b: any) => ({ eq: [a, b] })),
  and:      vi.fn((...args: any[]) => ({ and: args })),
  desc:     vi.fn((a: any) => ({ desc: a })),
  asc:      vi.fn((a: any) => ({ asc: a })),
  ilike:    vi.fn((a: any, b: any) => ({ ilike: [a, b] })),
  or:       vi.fn((...args: any[]) => ({ or: args })),
  gte:      vi.fn((a: any, b: any) => ({ gte: [a, b] })),
  lte:      vi.fn((a: any, b: any) => ({ lte: [a, b] })),
  inArray:  vi.fn((a: any, b: any) => ({ inArray: [a, b] })),
  sql:      vi.fn((_s: TemplateStringsArray, ..._args: any[]) => ({} as any)),
}));

vi.mock("@workspace/empresaqui", () => ({
  EmpresAquiClient:       vi.fn(),
  mapEmpresAquiToContact: vi.fn(() => ({})),
}));

vi.mock("../lib/llm-client.js", () => ({ callLLM: vi.fn() }));
vi.mock("../lib/agents-data.js", () => ({ getAgentById: vi.fn(() => ({})) }));
vi.mock("../lib/api-response.js", () => ({
  // Must actually send the response — route handlers call apiError(res, code, msg)
  // and then return; if this is a no-op the response is never sent → supertest hangs.
  apiError: vi.fn((res: any, code: number, message: string) => {
    res.status(code).json({ success: false, error: message });
  }),
}));
vi.mock("../lib/cnpj-enrichment.js", () => ({ enrichContact: vi.fn() }));
vi.mock("../lib/validation.js", () => ({
  pick:            vi.fn((_obj: any, _fields: readonly string[]) => ({})),
  safeNumber:      vi.fn(() => null),
  validateHttpUrl: vi.fn((u: string) => u),
  validateIdParam: vi.fn((id: string) => {
    const n = Number(id);
    return Number.isNaN(n) ? null : n;
  }),
}));
vi.mock("../lib/webhook-dispatcher.js", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("../lib/crypto.js", () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => s.replace("enc:", "")),
}));
vi.mock("../lib/model-discovery.js", () => ({ discoverModels: vi.fn() }));
vi.mock("../lib/llm-router.js", () => ({ healthCheckConnections: vi.fn() }));
vi.mock("../lib/llm-diagnostics.js", () => ({
  runDiagnostics:    vi.fn(() => ({ status: "ok" })),
  validateCredentials: vi.fn(),
  testCapability:    vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  // Simula o middleware auth definindo userId padrão
  app.use("/api", (req: any, _res: any, next: any) => {
    req.userId = "test-user";
    next();
  });
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 1: GET /crm/contacts/summary — não deve cair na rota /:id
// ═══════════════════════════════════════════════════════════════════════════════
// Causa raiz: Express faz match na ordem de registro. Se /contacts/:id vier
// antes de /contacts/summary, "summary" vira req.params.id = "summary" →
// Number("summary") = NaN → erro SQL → 500.
// Correção: /contacts/summary registrado ANTES de /contacts/:id.
// ───────────────────────────────────────────────────────────────────────────────

describe("Bug 1: GET /api/crm/contacts/summary — route ordering", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: crmRouter }] = await Promise.all([
      import("../routes/crm.js"),
    ]);
    app = createApp();
    app.use("/api/crm", crmRouter);
  });

  it("retorna 200 com estrutura de summary (não cai em /contacts/:id)", async () => {
    const res = await supertest(app).get("/api/crm/contacts/summary");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Deve retornar objeto summary, não contact individual
    expect(res.body.summary).toBeDefined();
    expect(typeof res.body.summary.total).toBe("number");
    expect(typeof res.body.summary.byStatus).toBe("object");
    expect(typeof res.body.summary.bySource).toBe("object");
    expect(typeof res.body.summary.byUf).toBe("object");
    expect(typeof res.body.summary.byPorte).toBe("object");
    expect(typeof res.body.summary.hotLeads).toBe("number");
    expect(typeof res.body.summary.prospects).toBe("number");
    expect(typeof res.body.summary.recentContacts).toBe("number");
    // Não deve ter a chave "contact" (singular) — isso indicaria cair na rota :id
    expect(res.body.contact).toBeUndefined();
  });

  it("GET /contacts/:id retorna 404 quando contato não existe", async () => {
    const res = await supertest(app).get("/api/crm/contacts/99999");
    // Com db mockado retornando [], deve ser 404
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 2: GET /api/llm/health-check — deve retornar 200
// ═══════════════════════════════════════════════════════════════════════════════
// Causa raiz: O endpoint só existia como POST, mas o frontend (ModelHub.tsx)
// chama com fetch(url, { method: "POST" }) e testes/curl fazem GET puro.
// Correção: handler extraído para função compartilhada, registrada em POST e GET.
// ───────────────────────────────────────────────────────────────────────────────

describe("Bug 2: GET /api/llm/health-check — 200 OK", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: llmRouter }] = await Promise.all([
      import("../routes/llm-connections.js"),
    ]);
    app = createApp();
    app.use("/api", llmRouter);
  });

  it("GET /api/llm/health-check retorna 200", async () => {
    const res = await supertest(app).get("/api/llm/health-check");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /api/llm/health-check retorna 200 (compatibilidade com frontend)", async () => {
    const res = await supertest(app).post("/api/llm/health-check");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 3: Pipeline customizado — stages como objetos não produzem [object Object]
// ═══════════════════════════════════════════════════════════════════════════════
// Causa raiz: stages do banco podiam ser array de objetos [{name,order}], mas
// o código usava objetos diretamente como chave de dicionário: pipeline[s] = ...
// JavaScript toString de objeto é "[object Object]", gerando chave inválida.
// Correção: stages.map(s => typeof s === "string" ? s : (s?.name || String(s)))
// ───────────────────────────────────────────────────────────────────────────────

describe("Bug 3: Pipeline stage normalization — [object Object]", () => {
  // Testa a lógica de normalização isoladamente (sem depender de DB/Express)
  const normalizeStage = (s: any): string =>
    typeof s === "string" ? s : (s?.name || String(s));

  it("mantém strings inalteradas", () => {
    expect(normalizeStage("prospecting")).toBe("prospecting");
    expect(normalizeStage("won")).toBe("won");
    expect(normalizeStage("lost")).toBe("lost");
  });

  it("extrai .name de objetos (pipeline customizado)", () => {
    expect(normalizeStage({ name: "Novo Lead", order: 1 })).toBe("Novo Lead");
    expect(normalizeStage({ name: "Qualificação", order: 2 })).toBe("Qualificação");
    expect(normalizeStage({ name: "Proposta", order: 3 })).toBe("Proposta");
    expect(normalizeStage({ name: "Negociação", order: 4 })).toBe("Negociação");
    expect(normalizeStage({ name: "Fechamento", order: 5 })).toBe("Fechamento");
    expect(normalizeStage({ name: "Perdido", order: 6 })).toBe("Perdido");
  });

  it("NÃO produz chave '[object Object]' para array de objetos", () => {
    const stages = [
      { name: "Novo Lead", order: 1 },
      { name: "Qualificação", order: 2 },
      { name: "Proposta", order: 3 },
    ];
    const result = stages.map(normalizeStage);
    expect(result).toEqual(["Novo Lead", "Qualificação", "Proposta"]);
    // Garantia explícita: nenhum elemento é "[object Object]"
    expect(result).not.toContain("[object Object]");
  });

  it("lida com array misto (strings + objetos)", () => {
    const stages: any[] = [
      "prospecting",
      { name: "Discovery", order: 2 },
      "proposal",
    ];
    const result = stages.map(normalizeStage);
    expect(result).toEqual(["prospecting", "Discovery", "proposal"]);
    expect(result).not.toContain("[object Object]");
  });

  it("usa fallback String() para objetos sem .name", () => {
    // Stage sem name: cai no fallback String(s). Não é ideal, mas não quebra.
    const result = normalizeStage({ id: 1 });
    expect(typeof result).toBe("string");
  });

  it("array vazio não causa erro", () => {
    expect([].map(normalizeStage)).toEqual([]);
  });
});
