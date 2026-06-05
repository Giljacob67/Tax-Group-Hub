import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import express from "express";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

const mockAgents = [
  {
    id: "coordenador-geral-tax-group",
    name: "Coordenador Geral",
    slug: "coordenador-geral-tax-group",
    description: "Orquestrador estratégico.",
    block: "estrategia",
    blockLabel: "Estratégia e Inteligência",
    icon: "🎖️",
    priority: 0,
    color: "#D97706",
    systemPrompt: "secret-prompt-123",
    suggestedPrompts: ["prompt 1"],
  },
  {
    id: "diagnostico-cnpj-tax-group",
    name: "Diagnóstico CNPJ",
    slug: "diagnostico-cnpj-tax-group",
    description: "Pré-qualificação automática de leads.",
    block: "prospeccao",
    blockLabel: "Prospecção e Operação Comercial",
    icon: "🔎",
    priority: 0,
    color: "#1E40AF",
    systemPrompt: "secret-prompt-456",
    suggestedPrompts: ["prompt 2"],
  },
];

vi.mock("../lib/agents-data.js", () => ({
  AGENTS: mockAgents,
  getAgentById: vi.fn(
    (id: string) => mockAgents.find((a) => a.id === id) ?? null,
  ),
}));

vi.mock("../lib/api-response.js", () => ({
  apiError: vi.fn((res: any, code: number, message: string) => {
    res.status(code).json({ success: false, error: message });
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Routes: /api/agents", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [{ default: agentsRouter }] = await Promise.all([
      import("../routes/agents.js"),
    ]);
    app = createApp();
    app.use("/api", agentsRouter);
  });

  // ── GET /api/agents ───────────────────────────────────────────────────────

  it("GET /api/agents returns list of agents without systemPrompt", async () => {
    const res = await supertest(app).get("/api/agents");
    expect(res.status).toBe(200);
    expect(res.body.agents).toBeInstanceOf(Array);
    expect(res.body.agents).toHaveLength(2);

    // systemPrompt must be stripped for security
    for (const agent of res.body.agents) {
      expect(agent.systemPrompt).toBeUndefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
    }
  });

  // ── GET /api/agents/:agentId ──────────────────────────────────────────────

  it("GET /api/agents/:agentId returns agent with systemPrompt", async () => {
    const res = await supertest(app).get(
      "/api/agents/coordenador-geral-tax-group",
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("coordenador-geral-tax-group");
    expect(res.body.name).toBe("Coordenador Geral");
    expect(res.body.systemPrompt).toBe("secret-prompt-123");
  });

  it("GET /api/agents/:agentId returns 404 for unknown agent", async () => {
    const res = await supertest(app).get("/api/agents/nonexistent-agent");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ── GET /api/agents/search ────────────────────────────────────────────────

  it("GET /api/agents/search?q=coordenador filters by name", async () => {
    const res = await supertest(app).get("/api/agents/search?q=coordenador");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.agents[0].id).toBe("coordenador-geral-tax-group");
  });

  it("GET /api/agents/search?block=prospeccao filters by block", async () => {
    const res = await supertest(app).get("/api/agents/search?block=prospeccao");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.agents[0].block).toBe("prospeccao");
  });

  it("GET /api/agents/search without q or block returns 400", async () => {
    const res = await supertest(app).get("/api/agents/search");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
