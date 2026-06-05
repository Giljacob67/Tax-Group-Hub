/**
 * CRM Phase 3 — Qualificação IA estruturada
 *
 * Constrói o prompt para o LLM, recebe a resposta e a normaliza
 * em um QualificationResult com campos estruturados.
 *
 * Diretrizes de negócio:
 * - A IA pode qualificar, organizar, sugerir próximos passos e sinalizar oportunidade.
 * - A IA NÃO pode emitir conclusão tributária definitiva.
 * - A IA NÃO pode substituir análise técnica da Matriz.
 * - Toda saída deve diferenciar fato / inferência / hipótese.
 */

import {
  QUALIFICATION_TIERS,
  type QualificationTier,
  type QualificationResult,
  type InsightItem,
  TEMPERATURA_SUGERIDA,
  type TemperaturaSugerida,
  MATURIDADE_NIVEIS,
  type MaturidadeNivel,
  URGENCIA_NIVEIS,
  type UrgenciaNivel,
  RISCO_NIVEIS,
  type RiscoNivel,
} from "@workspace/db/crm-constants";

export type ContactForQualification = {
  id: number;
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  regimeTributario: string | null;
  cnae: string | null;
  porte: string | null;
  uf: string | null;
  cidade: string | null;
  faturamentoEstimado: string | null;
  setor: string | null;
  segmento: string | null;
  temperatura: string | null;
  produtoInteresse: string | null;
  origemLead: string | null;
  status: string;
  observacoes: string | null;
  tags: string[] | null;
};

export const SYSTEM_INSTRUCTIONS = `Voce e o Agente de Qualificacao Comercial da Tax Group.
Seu papel e classificar o potencial COMERCIAL do lead. Voce NAO deve emitir conclusao tributaria definitiva nem substituir analise tecnica da Matriz.

DIRETRIZES:
- Sempre diferencie: FATO (dado explicito), INFERENCIA (deduzido do contexto), HIPOTESE (palpite que precisa validacao).
- Se a informacao for insuficiente, sinalize em confidence e explique.
- Quando a recomendacao depender de validacao da Matriz, marque alerta_matriz=true e depende_validacao_matriz=true.
- Seja conservador: melhor "media" confianca do que confianca alta em dado faltante.

SAIDA OBRIGATORIA (JSON puro, sem markdown, sem texto antes/depois):
{
  "score": 0-100,
  "tier": "A" | "B" | "C" | "D",
  "temperatura_sugerida": "frio" | "morno" | "quente" | "burning",
  "setor_inferido": "string|null",
  "segmento_inferido": "string|null",
  "potencial_comercial": "string|null (ex: R$ 20-50k / mensal)",
  "produto_recomendado": "string|null (AFD|RTI|REP|reforma_tributaria|consultoria|diagnostico|outro|null)",
  "sinais_oportunidade": ["string"],
  "dores_percebidas": ["string"],
  "maturidade": "baixa" | "media" | "alta",
  "urgencia": "baixa" | "media" | "alta" | "imediata",
  "risco": "baixo" | "medio" | "alto",
  "proximo_passo": "texto curto com a proxima acao",
  "observacoes_reuniao": ["string"],
  "alerta_matriz": boolean,
  "depende_validacao_matriz": boolean,
  "confidence": 0-100,
  "facts": [{"tipo":"fato","texto":"...","confianca":"alta"}],
  "inferences": [{"tipo":"inferencia","texto":"...","confianca":"media"}],
  "hypotheses": [{"tipo":"hipotese","texto":"...","confianca":"baixa"}],
  "reasoning": "resumo executivo em 2-3 paragrafos"
}

REGRAS DE SCORING (0-100):
- Regime Lucro Real: +30
- Faturamento > R$50M: +25
- Faturamento R$10-50M: +15
- Setor aderente (transporte, industria, agro): +15
- Decisor acessivel: +10
- CNAE especifico e ativo: +5
- Sem historico de revisao: +5
- Temperatura ja quente/burning: +10
- Multiplicadores de penalidade: Simples/MEI (-10), porte micro (-5), sem faturamento (-15).

TIERS:
- A: 70-100 (prioridade 24h)
- B: 40-69 (qualificar mais)
- C: 10-39 (nurturing)
- D: <10 (fora do ICP)`;

export function buildQualificationPrompt(c: ContactForQualification): string {
  return `DADOS DO LEAD (use SOMENTE o que esta abaixo — nao invente):

- CNPJ: ${c.cnpj}
- Razao Social: ${c.razaoSocial || "Nao informado"}
- Nome Fantasia: ${c.nomeFantasia || "Nao informado"}
- Regime Tributario: ${c.regimeTributario || "Nao informado"}
- CNAE: ${c.cnae || "Nao informado"}
- Porte: ${c.porte || "Nao informado"}
- Faturamento Estimado: ${c.faturamentoEstimado || "Nao informado"}
- UF: ${c.uf || "Nao informada"}
- Cidade: ${c.cidade || "Nao informada"}
- Setor: ${c.setor || "Nao informado"}
- Segmento: ${c.segmento || "Nao informado"}
- Temperatura atual: ${c.temperatura || "Nao definida"}
- Produto de interesse: ${c.produtoInteresse || "Nao informado"}
- Origem do lead: ${c.origemLead || "Nao informada"}
- Status atual no CRM: ${c.status}
- Tags: ${c.tags?.join(", ") || "Nenhuma"}
- Observacoes: ${c.observacoes || "Nenhuma"}

Gere o JSON de qualificacao conforme schema.`;
}

export function parseQualificationResult(
  raw: any,
  fallbackReasoning: string,
): QualificationResult {
  const safe: QualificationResult = {
    score: 0,
    tier: "D",
    temperatura_sugerida: "frio",
    setor_inferido: null,
    segmento_inferido: null,
    potencial_comercial: null,
    produto_recomendado: null,
    sinais_oportunidade: [],
    dores_percebidas: [],
    maturidade: "baixa",
    urgencia: "baixa",
    risco: "alto",
    proximo_passo: "",
    observacoes_reuniao: [],
    alerta_matriz: false,
    depende_validacao_matriz: false,
    confidence: 0,
    facts: [],
    inferences: [],
    hypotheses: [],
    reasoning: fallbackReasoning,
  };

  if (!raw || typeof raw !== "object") return safe;

  // Score + tier
  const score = clampInt(raw.score, 0, 100, 0);
  safe.score = score;
  safe.tier = normalizeTier(raw.tier, score);
  safe.confidence = clampInt(raw.confidence, 0, 100, 50);

  // Enum fields
  safe.temperatura_sugerida = normalizeEnum<TemperaturaSugerida>(
    raw.temperatura_sugerida,
    TEMPERATURA_SUGERIDA,
    "frio",
  );
  safe.maturidade = normalizeEnum<MaturidadeNivel>(
    raw.maturidade,
    MATURIDADE_NIVEIS,
    "baixa",
  );
  safe.urgencia = normalizeEnum<UrgenciaNivel>(
    raw.urgencia,
    URGENCIA_NIVEIS,
    "baixa",
  );
  safe.risco = normalizeEnum<RiscoNivel>(raw.risco, RISCO_NIVEIS, "medio");

  // Free text fields
  safe.setor_inferido = asStringOrNull(raw.setor_inferido);
  safe.segmento_inferido = asStringOrNull(raw.segmento_inferido);
  safe.potencial_comercial = asStringOrNull(raw.potencial_comercial);
  safe.produto_recomendado = asStringOrNull(raw.produto_recomendado);
  safe.proximo_passo =
    typeof raw.proximo_passo === "string" ? raw.proximo_passo : "";
  safe.reasoning =
    typeof raw.reasoning === "string" ? raw.reasoning : fallbackReasoning;

  // Array fields
  safe.sinais_oportunidade = asStringArray(raw.sinais_oportunidade);
  safe.dores_percebidas = asStringArray(raw.dores_percebidas);
  safe.observacoes_reuniao = asStringArray(raw.observacoes_reuniao);

  // Boolean fields
  safe.alerta_matriz = raw.alerta_matriz === true;
  safe.depende_validacao_matriz = raw.depende_validacao_matriz === true;

  // Insight items
  safe.facts = asInsightArray(raw.facts, "fato");
  safe.inferences = asInsightArray(raw.inferences, "inferencia");
  safe.hypotheses = asInsightArray(raw.hypotheses, "hipotese");

  return safe;
}

function clampInt(v: any, min: number, max: number, def: number): number {
  const n = Math.floor(Number(v));
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function normalizeTier(v: any, score: number): QualificationTier {
  if (typeof v === "string") {
    const up = v.toUpperCase();
    if ((QUALIFICATION_TIERS as readonly string[]).includes(up))
      return up as QualificationTier;
  }
  if (score >= 70) return "A";
  if (score >= 40) return "B";
  if (score >= 10) return "C";
  return "D";
}

function normalizeEnum<T extends string>(
  v: any,
  allowed: readonly T[],
  def: T,
): T {
  if (typeof v === "string" && (allowed as readonly string[]).includes(v))
    return v as T;
  return def;
}

function asStringOrNull(v: any): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function asStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

function asInsightArray(
  v: any,
  expectedType: InsightItem["tipo"],
): InsightItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const texto = typeof x.texto === "string" ? x.texto.trim() : null;
      if (!texto) return null;
      const confianca = normalizeEnum<"baixa" | "media" | "alta">(
        x.confianca,
        ["baixa", "media", "alta"],
        "media",
      );
      return { tipo: expectedType, texto, confianca };
    })
    .filter(Boolean) as InsightItem[];
}
