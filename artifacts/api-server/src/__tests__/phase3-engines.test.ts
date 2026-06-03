import { describe, it, expect } from "vitest";
import { recommendNextStep } from "../lib/next-step-engine.js";
import { evaluateAlerts } from "../lib/alerts-engine.js";
import { parseQualificationResult, buildQualificationPrompt } from "../lib/qualification-engine.js";
import { calculatePriority } from "../lib/priority-engine.js";

describe("next-step-engine", () => {
  it("recommends primeiro_contato for nao_iniciado with no activity", () => {
    const rec = recommendNextStep({
      contact: { status: "nao_iniciado", temperatura: null, proximoFollowup: null, ultimaInteracao: null, pendenciasCliente: null, responsavelUnidade: null },
      deal: null,
      hasProposal: false,
      hasOpenTasks: false,
    });
    expect(rec.action).toBe("primeiro_contato");
    expect(rec.priority).toBe("alta");
    expect(rec.taskTemplate).toBeTruthy();
  });

  it("recommends cobrar_retorno when matriz prazo is overdue", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const fiveDaysAgo = new Date("2026-06-10T12:00:00Z");
    const rec = recommendNextStep({
      contact: { status: "enviado_matriz", temperatura: "quente", proximoFollowup: null, ultimaInteracao: fiveDaysAgo, pendenciasCliente: null, responsavelUnidade: "João" },
      deal: { stage: "enviado_para_matriz", statusMatriz: "aguardando", statusProposta: null, briefingMatriz: "ok", dataEnvioMatriz: fiveDaysAgo, prazoRetornoMatriz: fiveDaysAgo },
      hasProposal: false,
      hasOpenTasks: false,
      now,
    });
    expect(rec.action).toBe("cobrar_retorno");
    expect(rec.priority).toBe("urgente");
  });

  it("recommends follow_up_proposta for proposta_enviada", () => {
    const rec = recommendNextStep({
      contact: { status: "proposta_enviada", temperatura: "quente", proximoFollowup: null, ultimaInteracao: new Date(), pendenciasCliente: null, responsavelUnidade: "João" },
      deal: { stage: "proposta_enviada", statusMatriz: "proposta_liberada", statusProposta: "proposta_enviada", briefingMatriz: null, dataEnvioMatriz: null, prazoRetornoMatriz: null },
      hasProposal: true,
      hasOpenTasks: false,
    });
    expect(rec.action).toBe("follow_up_proposta");
    expect(rec.priority).toBe("alta");
  });

  it("recommends reativar_lead_morno after 14 days no activity", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const twentyDaysAgo = new Date("2026-05-26T12:00:00Z");
    const rec = recommendNextStep({
      contact: { status: "em_abordagem", temperatura: "morno", proximoFollowup: null, ultimaInteracao: twentyDaysAgo, pendenciasCliente: null, responsavelUnidade: "João" },
      deal: null,
      hasProposal: false,
      hasOpenTasks: false,
      now,
    });
    expect(rec.action).toBe("reativar_lead_morno");
  });

  it("returns encaminhar_pos_venda for cliente status", () => {
    const rec = recommendNextStep({
      contact: { status: "cliente", temperatura: null, proximoFollowup: null, ultimaInteracao: new Date(), pendenciasCliente: null, responsavelUnidade: "João" },
      deal: { stage: "fechado_ganho", statusMatriz: "retorno_recebido", statusProposta: null, briefingMatriz: null, dataEnvioMatriz: null, prazoRetornoMatriz: null },
      hasProposal: false,
      hasOpenTasks: false,
    });
    expect(rec.action).toBe("encaminhar_pos_venda");
  });
});

describe("alerts-engine", () => {
  it("generates followup_vencido alert", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const alerts = evaluateAlerts(
      [{
        id: 1, status: "em_abordagem",
        proximoFollowup: new Date("2026-06-13T12:00:00Z"),
        ultimaInteracao: new Date("2026-06-10T12:00:00Z"),
        temperatura: "quente", responsavelUnidade: "João",
      }],
      [],
      now,
    );
    const followup = alerts.find(a => a.type === "followup_vencido");
    expect(followup).toBeTruthy();
    expect(followup!.context.diasAtraso).toBeGreaterThanOrEqual(2);
  });

  it("generates matriz_acima_prazo alert", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const alerts = evaluateAlerts(
      [{ id: 1, status: "enviado_matriz", proximoFollowup: null, ultimaInteracao: new Date(), temperatura: null, responsavelUnidade: null }],
      [{
        id: 10, contactId: 1, stage: "enviado_para_matriz", statusMatriz: "aguardando",
        statusProposta: null, dataEnvioMatriz: new Date("2026-06-01"), prazoRetornoMatriz: new Date("2026-06-10"),
        dataRetornoMatriz: null, updatedAt: new Date("2026-06-01"),
      }],
      now,
    );
    const matriz = alerts.find(a => a.type === "matriz_acima_prazo");
    expect(matriz).toBeTruthy();
  });

  it("does not generate alerts for finalized status", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const alerts = evaluateAlerts(
      [{ id: 1, status: "cliente", proximoFollowup: null, ultimaInteracao: new Date("2020-01-01"), temperatura: null, responsavelUnidade: null }],
      [],
      now,
    );
    expect(alerts).toHaveLength(0);
  });
});

describe("qualification-engine", () => {
  it("parses valid JSON result", () => {
    const raw = {
      score: 75,
      tier: "A",
      temperatura_sugerida: "quente",
      setor_inferido: "agro",
      segmento_inferido: "cooperativas",
      potencial_comercial: "R$ 30-50k",
      produto_recomendado: "RTI",
      sinais_oportunidade: ["Lucro Real", "Faturamento > R$ 30M"],
      dores_percebidas: ["Revisão fiscal atrasada"],
      maturidade: "alta",
      urgencia: "alta",
      risco: "baixo",
      proximo_passo: "Agendar reunião de diagnóstico",
      observacoes_reuniao: ["Validar decisor"],
      alerta_matriz: true,
      depende_validacao_matriz: true,
      confidence: 80,
      facts: [{ tipo: "fato", texto: "Regime Lucro Real", confianca: "alta" }],
      inferences: [{ tipo: "inferencia", texto: "Boa capacidade financeira", confianca: "media" }],
      hypotheses: [{ tipo: "hipotese", texto: "Interesse em RTI", confianca: "baixa" }],
      reasoning: "Lead qualificado",
    };
    const result = parseQualificationResult(raw, "fallback");
    expect(result.score).toBe(75);
    expect(result.tier).toBe("A");
    expect(result.temperatura_sugerida).toBe("quente");
    expect(result.alerta_matriz).toBe(true);
    expect(result.facts).toHaveLength(1);
    expect(result.inferences).toHaveLength(1);
    expect(result.hypotheses).toHaveLength(1);
  });

  it("derives tier from score when missing", () => {
    const r = parseQualificationResult({ score: 50 }, "fb");
    expect(r.tier).toBe("B");
  });

  it("builds prompt with all fields", () => {
    const contact = {
      id: 1, cnpj: "12345678000190", razaoSocial: "Test", nomeFantasia: null,
      regimeTributario: "lucro_real", cnae: "0111", porte: "Médio",
      uf: "SP", cidade: "São Paulo", faturamentoEstimado: "R$ 30M",
      setor: "agro", segmento: "cooperativas", temperatura: "morno",
      produtoInteresse: "RTI", origemLead: "manual", status: "qualificado",
      observacoes: "teste", tags: ["tag1"],
    };
    const prompt = buildQualificationPrompt(contact);
    expect(prompt).toContain("12345678000190");
    expect(prompt).toContain("lucro_real");
    expect(prompt).toContain("cooperativas");
  });
});

describe("priority-engine", () => {
  it("returns high priority for hot lead with high AI score in negotiation", () => {
    const result = calculatePriority({
      aiScore: 85,
      temperatura: "quente",
      status: "em_negociacao",
      dealStage: "em_negociacao",
      statusMatriz: null,
      hasProposal: true,
      daysWithoutActivity: 1,
      daysSinceFollowupOverdue: 0,
      expectedCloseDays: 14,
      hasOpenTask: true,
      isUrgentMatrix: false,
    });
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(["alta", "critica"]).toContain(result.nivel);
  });

  it("returns low priority for cold lead with no activity", () => {
    const result = calculatePriority({
      aiScore: 20,
      temperatura: "frio",
      status: "nao_iniciado",
      dealStage: null,
      statusMatriz: null,
      hasProposal: false,
      daysWithoutActivity: 30,
      daysSinceFollowupOverdue: 0,
      expectedCloseDays: null,
      hasOpenTask: false,
      isUrgentMatrix: false,
    });
    expect(result.score).toBeLessThan(40);
    expect(result.nivel).toBe("baixa");
  });

  it("boosts priority when matrix is urgent", () => {
    const result = calculatePriority({
      aiScore: 50,
      temperatura: "morno",
      status: "enviado_matriz",
      dealStage: "enviado_para_matriz",
      statusMatriz: "aguardando",
      hasProposal: false,
      daysWithoutActivity: 5,
      daysSinceFollowupOverdue: 0,
      expectedCloseDays: null,
      hasOpenTask: false,
      isUrgentMatrix: true,
    });
    expect(result.reasons).toContain("Matriz acima do prazo");
  });
});
