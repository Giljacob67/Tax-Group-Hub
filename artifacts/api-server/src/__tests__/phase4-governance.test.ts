import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import express from "express";

// ════════════════════════════════════════════════════════════════════════════════
// MOCKS
// ════════════════════════════════════════════════════════════════════════════════

vi.mock("@workspace/db", () => {
  function chain(result: any = []) {
    const prom = Promise.resolve(result);
    const c: any = (..._args: any[]) => prom;
    c.then     = prom.then.bind(prom);
    c.catch    = prom.catch.bind(prom);
    c.from      = vi.fn(() => c);
    c.where     = vi.fn(() => c);
    c.leftJoin  = vi.fn(() => chain([]));
    c.innerJoin = vi.fn(() => c);
    c.orderBy   = vi.fn(() => c);
    c.limit     = vi.fn(() => c);
    c.values    = vi.fn(() => c);
    c.set       = vi.fn(() => c);
    c.returning = vi.fn(() => prom);
    c.execute   = vi.fn(() => Promise.resolve({ rows: [] }));
    return c;
  }
  // All chains resolve to role data for loadUserRoles, and to [] for other awaits
  // (we only need the role data to pass; the handlers chain .limit() etc which return the same chain)
  return {
    db: {
      select:  vi.fn(() => chain([{ role: "coordenador" }])),
      insert:  vi.fn(() => chain()),
      update:  vi.fn(() => chain()),
      delete:  vi.fn(() => chain()),
      execute: vi.fn(() => Promise.resolve({ rows: [] })),
    },
    crmAuditLogTable: { id: "id", userId: "user_id", actorId: "actor_id", actorType: "actor_type", entityType: "entity_type", entityId: "entity_id", action: "action", fieldName: "field_name", oldValue: "old_value", newValue: "new_value", context: "context", createdAt: "created_at" },
    appUserRolesTable: { id: "id", userId: "user_id", role: "role", scope: "scope", isActive: "is_active" },
    crmContactsTable: { id: "id", userId: "user_id", status: "status", source: "source", cnpj: "cnpj", razaoSocial: "razao_social", responsavelUnidade: "responsavel_unidade", proximoFollowup: "proximo_followup", ultimaInteracao: "ultima_interacao", createdAt: "created_at" },
    crmDealsTable: { id: "id", userId: "user_id", contactId: "contact_id", stage: "stage", value: "value", probability: "probability", briefingMatriz: "briefing_matriz", statusMatriz: "status_matriz", dataEnvioMatriz: "data_envio_matriz", prazoRetornoMatriz: "prazo_retorno_matriz", dataRetornoMatriz: "data_retorno_matriz", motivoPerda: "motivo_perda", statusProposta: "status_proposta", updatedAt: "updated_at", createdAt: "created_at", wonAt: "won_at", assignedTo: "assigned_to" },
    crmTasksTable: { id: "id", userId: "user_id", status: "status", type: "type", dueDate: "due_date" },
    crmActivitiesTable: { id: "id", userId: "user_id", contactId: "contact_id", type: "type", subject: "subject", content: "content", agentId: "agent_id", createdAt: "created_at" },
    appConfigTable: {},
  };
});

vi.mock("@workspace/db/crm-constants", () => ({
  DEFAULT_PIPELINE_ID: "tax-group",
  DEFAULT_PIPELINE_NAME: "Tax Group",
  PIPELINE_TAX_GROUP_STAGES: [],
  LEGACY_CONTACT_STATUS_MAP: {},
  LEGACY_DEAL_STAGE_MAP: {},
  DEAL_STAGE_TO_CONTACT_STATUS: {},
  APP_ROLES: ["admin", "coordenador", "comercial", "marketing", "leitura"],
  APP_ROLE_LABELS: { admin: "Administrador" },
  DASHBOARD_PERIODS: ["7d", "30d", "all"],
  DASHBOARD_PERSONAS: ["executive", "coordenador", "operacional", "pos_venda"],
  QUALITY_SEVERITIES: {
    missing_cnpj: "critical",
    missing_razao_social: "critical",
    missing_contato: "critical",
    missing_setor: "warning",
    missing_regime_tributario: "warning",
    missing_decisor: "warning",
    no_responsavel: "warning",
    no_followup: "info",
    no_deal_qualificado: "info",
    matriz_no_briefing: "critical",
    proposta_no_status: "warning",
    perda_no_motivo: "info",
  },
}));

vi.mock("../middlewares/auth.js", () => ({
  requireUserId: (req: any) => req.userId || "test-user",
}));

vi.mock("../lib/api-response.js", () => ({
  apiError: (res: any, code: number, message: string) => res.status(code).json({ error: message }),
}));

vi.mock("../lib/validation.js", () => ({
  pick: (obj: any, keys: readonly string[]) => {
    const result: any = {};
    for (const k of keys) if (k in obj) result[k] = obj[k];
    return result;
  },
  safeNumber: () => null,
  validateHttpUrl: (u: string) => u,
}));

vi.mock("../lib/cnpj-enrichment.js", () => ({ enrichContact: vi.fn() }));
vi.mock("../lib/webhook-dispatcher.js", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("@workspace/hubspot", () => ({ HubSpotClient: vi.fn() }));
vi.mock("../lib/hubspot-sync.js", () => ({
  pushContactToHubSpot: vi.fn(), pushDealToHubSpot: vi.fn(),
  pushActivityToHubSpot: vi.fn(), pushTaskToHubSpot: vi.fn(),
}));
vi.mock("@workspace/empresaqui", () => ({
  EmpresAquiClient: vi.fn(), mapEmpresAquiToContact: vi.fn(),
}));
vi.mock("../lib/llm-client.js", () => ({ callLLM: vi.fn() }));
vi.mock("../lib/agents-data.js", () => ({ getAgentById: vi.fn() }));
vi.mock("../lib/crypto.js", () => ({ decrypt: vi.fn() }));
vi.mock("../lib/rbac.js", () => ({
  buildUserContext: vi.fn(async (req: any) => ({
    userId: req.userId || "test-user",
    roles: ["coordenador"],
    permissions: {
      canViewAll: true, canEditAll: true, canManageUsers: false, canManageSettings: false,
      canEditPipeline: true, canEditStatus: true, canCreateLists: true, canDeleteLists: true,
      canEditSystemViews: false, canExport: true, canTriggerIA: true, canManageAutomations: true,
      canViewDashboards: true, canViewAudit: true, canEditProposals: true,
    },
    authMethod: req.authMethod || "jwt",
  })),
  requirePermission: vi.fn(() => {}),
}));

import crmRouter from "../routes/crm.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = "test-user";
    req.authMethod = "jwt";
    next();
  });
  app.use("/api/crm", crmRouter);
  return app;
}

// ════════════════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════════════════

describe("Phase 4 — User Context (me)", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it("GET /me returns user context", async () => {
    const res = await supertest(app).get("/api/crm/me");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toHaveProperty("userId");
    expect(res.body.user).toHaveProperty("roles");
    expect(res.body.user).toHaveProperty("permissions");
  });
});

describe("Phase 4 — Dashboards", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it("GET /dashboards/executive?period=30d returns executive data", async () => {
    const res = await supertest(app).get("/api/crm/dashboards/executive?period=30d");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.persona).toBe("executive");
    expect(res.body.period).toBe("30d");
    expect(res.body.data).toHaveProperty("leads");
    expect(res.body.data).toHaveProperty("pipeline");
    expect(res.body.data).toHaveProperty("matriz");
  });

  it("GET /dashboards/coordenador returns coordinator data", async () => {
    const res = await supertest(app).get("/api/crm/dashboards/coordenador");
    expect(res.status).toBe(200);
    expect(res.body.persona).toBe("coordenador");
    expect(res.body.data).toHaveProperty("responsibles");
    expect(res.body.data).toHaveProperty("hotLeads");
  });

  it("GET /dashboards/operacional returns operational data", async () => {
    const res = await supertest(app).get("/api/crm/dashboards/operacional");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("today");
    expect(res.body.data).toHaveProperty("byStatus");
  });

  it("GET /dashboards/pos_venda returns pos-venda data", async () => {
    const res = await supertest(app).get("/api/crm/dashboards/pos_venda");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalClientes");
    expect(res.body.data).toHaveProperty("expansionCandidates");
  });

  it("GET /dashboards/invalid returns 400", async () => {
    const res = await supertest(app).get("/api/crm/dashboards/invalid");
    expect(res.status).toBe(400);
  });
});

describe("Phase 4 — Queues", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it("GET /queues/no_responsible returns contacts without responsible", async () => {
    const res = await supertest(app).get("/api/crm/queues/no_responsible");
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("no_responsible");
    expect(Array.isArray(res.body.contacts)).toBe(true);
  });

  it("GET /queues/matriz_waiting returns deals waiting on Matriz", async () => {
    const res = await supertest(app).get("/api/crm/queues/matriz_waiting");
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("matriz_waiting");
    expect(Array.isArray(res.body.deals)).toBe(true);
  });

  it("GET /queues/invalid returns 400", async () => {
    const res = await supertest(app).get("/api/crm/queues/invalid_type");
    expect(res.status).toBe(400);
  });
});

describe("Phase 4 — Data Quality", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it("GET /quality/health returns health metrics", async () => {
    const res = await supertest(app).get("/api/crm/quality/health");
    if (res.status !== 200) console.error("HEALTH ERROR:", res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalContacts");
    expect(res.body).toHaveProperty("completenessPct");
    expect(res.body).toHaveProperty("criticalIssues");
  });

  it("GET /quality/issues returns issues list", async () => {
    const res = await supertest(app).get("/api/crm/quality/issues");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it("GET /quality/duplicates returns duplicate candidates", async () => {
    const res = await supertest(app).get("/api/crm/quality/duplicates");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.duplicates)).toBe(true);
  });
});

describe("Phase 4 — Audit Log", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it("GET /audit-log returns entries", async () => {
    const res = await supertest(app).get("/api/crm/audit-log");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});

describe("Phase 4 — Roles Management", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it("GET /roles returns available roles", async () => {
    const res = await supertest(app).get("/api/crm/roles");
    expect(res.status).toBe(200);
    expect(res.body.roles).toContain("admin");
    expect(res.body.roles).toContain("comercial");
  });
});

describe("Phase 4 — Governance Recent", () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it("GET /governance/recent returns combined entries", async () => {
    const res = await supertest(app).get("/api/crm/governance/recent");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});
