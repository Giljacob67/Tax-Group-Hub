import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import express from "express";

vi.mock("@workspace/db", () => {
  function chain(result: any = []) {
    const prom = Promise.resolve(result);
    const c: any = (..._args: any[]) => prom;
    c.then = prom.then.bind(prom);
    c.catch = prom.catch.bind(prom);
    c.from = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.leftJoin = vi.fn(() => c);
    c.innerJoin = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.values = vi.fn(() => c);
    c.set = vi.fn(() => c);
    c.returning = vi.fn(() => prom);
    c.execute = vi.fn(() => Promise.resolve({ rows: [] }));
    return c;
  }
  return {
    db: {
      select: vi.fn(() => chain()),
      insert: vi.fn(() => chain()),
      update: vi.fn(() => chain()),
      delete: vi.fn(() => chain()),
      execute: vi.fn(() => Promise.resolve({ rows: [] })),
    },
    crmContactsTable: { id: "id", userId: "user_id", status: "status" },
    crmDealsTable: { id: "id", userId: "user_id", stage: "stage" },
    crmActivitiesTable: {},
    crmEnrichmentLogTable: {},
    crmPipelinesTable: {},
    crmAttachmentsTable: {},
    crmTasksTable: {},
    crmSavedViewsTable: {},
    crmAutomationsTable: {},
    automationSequencesTable: {},
    sequenceEnrollmentsTable: {},
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
  SYSTEM_VIEWS: [
    {
      id: "sv_todos",
      name: "Todos",
      emoji: "📋",
      category: "operacional",
      filters: {},
      description: "Todos",
    },
  ],
}));

vi.mock("../middlewares/auth.js", () => ({
  requireUserId: (req: any) => req.userId || "test-user",
}));

vi.mock("../lib/api-response.js", () => ({
  apiError: (res: any, code: number, message: string) =>
    res.status(code).json({ error: message }),
}));

vi.mock("../lib/validation.js", () => ({
  pick: (obj: any, keys: readonly string[]) => {
    const result: any = {};
    for (const k of keys) if (k in obj) result[k] = obj[k];
    return result;
  },
  safeNumber: (v: any) => {
    const n = Number(v);
    return isNaN(n) ? null : n;
  },
  validateHttpUrl: (u: string) => u,
}));

vi.mock("../lib/cnpj-enrichment.js", () => ({
  enrichContact: vi.fn(),
}));

vi.mock("../lib/webhook-dispatcher.js", () => ({
  dispatchWebhook: vi.fn(),
}));

vi.mock("@workspace/hubspot", () => ({
  HubSpotClient: vi.fn(),
}));

vi.mock("../lib/hubspot-sync.js", () => ({
  pushContactToHubSpot: vi.fn(),
  pushDealToHubSpot: vi.fn(),
  pushActivityToHubSpot: vi.fn(),
  pushTaskToHubSpot: vi.fn(),
}));

vi.mock("@workspace/empresaqui", () => ({
  EmpresAquiClient: vi.fn(),
  mapEmpresAquiToContact: vi.fn(),
}));

vi.mock("../lib/llm-client.js", () => ({
  callLLM: vi.fn(),
}));

vi.mock("../lib/agents-data.js", () => ({
  getAgentById: vi.fn(),
}));

vi.mock("../lib/crypto.js", () => ({
  decrypt: vi.fn(),
}));

import crmRouter from "../routes/crm.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/crm", crmRouter);
  return app;
}

describe("CRM Phase 2 — Bulk Actions", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
  });

  it("POST /contacts/bulk-update-temperature returns 400 without ids", async () => {
    const res = await supertest(app)
      .post("/api/crm/contacts/bulk-update-temperature")
      .send({ temperatura: "quente" });
    expect(res.status).toBe(400);
  });

  it("POST /contacts/bulk-update-temperature returns 400 without temperatura", async () => {
    const res = await supertest(app)
      .post("/api/crm/contacts/bulk-update-temperature")
      .send({ ids: [1, 2, 3] });
    expect(res.status).toBe(400);
  });

  it("POST /contacts/bulk-assign returns 400 without ids", async () => {
    const res = await supertest(app)
      .post("/api/crm/contacts/bulk-assign")
      .send({ responsavelUnidade: "João" });
    expect(res.status).toBe(400);
  });

  it("POST /contacts/bulk-update-followup returns 400 without ids", async () => {
    const res = await supertest(app)
      .post("/api/crm/contacts/bulk-update-followup")
      .send({ proximoFollowup: "2026-06-15" });
    expect(res.status).toBe(400);
  });
});

describe("CRM Phase 2 — Distinct Values", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
  });

  it("GET /contacts/distinct-values returns 400 for invalid field", async () => {
    const res = await supertest(app).get(
      "/api/crm/contacts/distinct-values?field=invalidField",
    );
    expect(res.status).toBe(400);
  });

  it("GET /contacts/distinct-values returns 200 for valid field", async () => {
    const res = await supertest(app).get(
      "/api/crm/contacts/distinct-values?field=setor",
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.values)).toBe(true);
  });
});

describe("CRM Phase 2 — Operational Summary", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
  });

  it("GET /operational-summary returns 200 with summary", async () => {
    const res = await supertest(app).get("/api/crm/operational-summary");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(typeof res.body.summary.followupVencidos).toBe("number");
    expect(typeof res.body.summary.leadsQuentes).toBe("number");
  });
});
