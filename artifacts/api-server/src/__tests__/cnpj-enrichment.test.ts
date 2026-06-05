import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
  crmContactsTable: {
    id: "id",
    userId: "user_id",
    cnpj: "cnpj",
    razaoSocial: "razao_social",
    nomeFantasia: "nome_fantasia",
    regimeTributario: "regime_tributario",
    cnae: "cnae",
    faturamentoEstimado: "faturamento_estimado",
    porte: "porte",
    uf: "uf",
    status: "status",
    aiScore: "ai_score",
    aiScoreDetails: "ai_score_details",
    aiRecommendedProduct: "ai_recommended_product",
    lastEnrichedAt: "last_enriched_at",
  },
  crmDealsTable: {
    id: "id",
    contactId: "contact_id",
    userId: "user_id",
    title: "title",
    produto: "produto",
    stage: "stage",
    probability: "probability",
    value: "value",
  },
  crmEnrichmentLogTable: {
    contactId: "contact_id",
    source: "source",
    rawData: "raw_data",
    fieldsUpdated: "fields_updated",
  },
}));

vi.mock("../lib/llm-client.js", () => ({
  callLLM: vi.fn(),
}));

vi.mock("../lib/agents-data.js", () => ({
  getAgentById: vi.fn(),
}));

import { enrichContact } from "../lib/cnpj-enrichment.js";
import { callLLM } from "../lib/llm-client.js";
import { getAgentById } from "../lib/agents-data.js";
import { db } from "@workspace/db";

function mockSelectChain(rows: any[]) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.where.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return chain;
}

function mockUpdateChain() {
  const chain: any = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  chain.update.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  return chain;
}

function mockInsertChain() {
  const chain: any = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  };
  chain.insert.mockReturnValue(chain);
  return chain;
}

const MOCK_AGENT = {
  id: "diagnostico-cnpj-tax-group",
  name: "Diagnostico CNPJ",
  slug: "diagnostico-cnpj-tax-group",
  systemPrompt: "You are a tax diagnostic agent.",
  description: "Test",
  block: "prospeccao" as const,
  blockLabel: "Prospeccao",
  icon: "X",
  suggestedPrompts: [],
  priority: 1,
  color: "#000",
};

const MOCK_CONTACT = {
  id: 42,
  userId: "user-1",
  cnpj: "12.345.678/0001-90",
  razaoSocial: "Empresa Teste",
  nomeFantasia: "Teste LTDA",
  regimeTributario: "Lucro Real",
  cnae: "6201-5/01",
  faturamentoEstimado: "R$ 1.000.000",
  porte: "Medio",
  uf: "SP",
  status: "lead",
};

const JSON_OUTPUT = (
  score: number,
  classif: string,
  produto: string,
  credito: string,
) =>
  `\`\`\`json\n{"score": ${score}, "classificacao": "${classif}", "produto_recomendado": "${produto}", "credito_estimado": "${credito}"}\n\`\`\``;

describe("enrichContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAgentById as any).mockReturnValue(MOCK_AGENT);
  });

  it("returns null when agent not found", async () => {
    (getAgentById as any).mockReturnValue(undefined);
    const result = await enrichContact(1, "u1");
    expect(result).toBeNull();
  });

  it("returns null when contact not found", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([]));
    const result = await enrichContact(999, "u1");
    expect(result).toBeNull();
  });

  it("parses JSON block and updates contact", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: JSON_OUTPUT(85, "HOT", "AFD", "R$ 150.000"),
      tokensUsed: 100,
      promptTokens: 50,
      completionTokens: 50,
      executionTimeMs: 200,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");

    expect(result).not.toBeNull();
    expect(result!.score).toBe(85);
    expect(result!.classificacao).toBe("HOT");
    expect(result!.produtoRecomendado).toBe("AFD");
    expect(result!.creditoEstimado).toBe("R$ 150.000");
    expect(result!.dealCreated).toBe(false);
    expect(db.update).toHaveBeenCalled();
  });

  it("parses regex fallback when no JSON block present", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: "Score: 72\nClassification: WARM\nProduto: AFD",
      tokensUsed: 80,
      promptTokens: 40,
      completionTokens: 40,
      executionTimeMs: 150,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");

    expect(result).not.toBeNull();
    expect(result!.score).toBe(72);
    expect(result!.classificacao).toBe("WARM");
  });

  it("auto-creates deal when score >= 60 and no existing deal", async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectChain([MOCK_CONTACT]))
      .mockReturnValueOnce(mockSelectChain([]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: JSON_OUTPUT(80, "HOT", "REP", "R$ 200k"),
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");

    expect(result!.dealCreated).toBe(true);
    expect(result!.score).toBe(80);
    expect(db.insert).toHaveBeenCalled();
  });

  it("does NOT create deal when score < 60", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: JSON_OUTPUT(30, "COLD", "", ""),
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");

    expect(result!.dealCreated).toBe(false);
    expect(result!.score).toBe(30);
    expect(result!.classificacao).toBe("COLD");
  });

  it("does NOT create deal when score >= 60 but existing deal exists", async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectChain([MOCK_CONTACT]))
      .mockReturnValueOnce(mockSelectChain([{ id: 1 }]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: JSON_OUTPUT(90, "HOT", "AFD", "R$ 300k"),
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");
    expect(result!.dealCreated).toBe(false);
  });

  it("handles classification key alias from LLM output", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output:
        '\u0060\u0060\u0060json\n{"score": 55, "classification": "WARM", "produto": "RTI", "credito": "R$ 50k"}\n\u0060\u0060\u0060',
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");
    expect(result!.classificacao).toBe("WARM");
    expect(result!.produtoRecomendado).toBe("RTI");
  });

  it("caps score at 100 when regex finds > 100", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: "Score: 150\nClassification: HOT",
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");
    expect(result!.score).toBe(100);
  });

  it("defaults score to 0 when nothing parseable", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: "I have no structured data to provide.",
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");
    expect(result!.score).toBe(0);
    expect(result!.classificacao).toBe("COLD");
  });

  it("sends correct input to LLM with contact data", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: JSON_OUTPUT(50, "WARM", "REP", ""),
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    await enrichContact(42, "user-1");

    const [, input] = (callLLM as any).mock.calls[0];
    expect(input).toContain("12.345.678/0001-90");
    expect(input).toContain("Empresa Teste");
    expect(input).toContain("Lucro Real");
    expect(input).toContain("6201-5/01");
  });

  it("handles FORA DO ICP classification", async () => {
    (db.select as any).mockReturnValue(mockSelectChain([MOCK_CONTACT]));
    (db.update as any).mockReturnValue(mockUpdateChain());
    (db.insert as any).mockReturnValue(mockInsertChain());

    (callLLM as any).mockResolvedValue({
      output: JSON_OUTPUT(10, "FORA DO ICP", "", ""),
      tokensUsed: 50,
      promptTokens: 25,
      completionTokens: 25,
      executionTimeMs: 100,
      model: "gpt-4o",
      provider: "OpenAI",
    });

    const result = await enrichContact(42, "user-1");
    expect(result!.classificacao).toBe("FORA DO ICP");
    expect(result!.dealCreated).toBe(false);
  });
});
