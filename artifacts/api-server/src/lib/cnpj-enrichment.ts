import {
  db,
  crmContactsTable,
  crmDealsTable,
  crmEnrichmentLogTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { callLLM } from "./llm-client.js";
import { getAgentById } from "./agents-data.js";
import logger from "./logger.js";

interface EnrichmentResult {
  score: number;
  classificacao: "HOT" | "WARM" | "COLD" | "FORA DO ICP";
  produtoRecomendado: string;
  creditoEstimado: string;
  dealCreated: boolean;
}

function parseEnrichmentOutput(
  output: string,
): Pick<
  EnrichmentResult,
  "score" | "classificacao" | "produtoRecomendado" | "creditoEstimado"
> {
  // Try to extract the JSON block appended at the end of the agent output
  const jsonMatch =
    output.match(/```json\s*([\s\S]*?)```/i) ||
    output.match(/\{[\s\S]*"score"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const raw = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
      return {
        score: Number(raw.score) || 0,
        classificacao: raw.classificacao ?? raw.classification ?? "COLD",
        produtoRecomendado: raw.produto_recomendado ?? raw.produto ?? "",
        creditoEstimado: raw.credito_estimado ?? raw.credito ?? "",
      };
    } catch {
      // fall through to regex parsing
    }
  }

  // Regex fallback: parse the formatted card from the agent output
  const scoreMatch = output.match(/score[:\s]+(\d{1,3})/i);
  const classMatch = output.match(/\b(HOT|WARM|COLD|FORA DO ICP)\b/i);
  const produtoMatch = output.match(/produto[:\s]+([A-Z]{2,5})/i);

  return {
    score: scoreMatch ? Math.min(100, Number(scoreMatch[1])) : 0,
    classificacao:
      (classMatch?.[1]?.toUpperCase() as EnrichmentResult["classificacao"]) ??
      "COLD",
    produtoRecomendado: produtoMatch?.[1] ?? "",
    creditoEstimado: "",
  };
}

/**
 * Runs diagnostico-cnpj-tax-group for a contact, updates aiScore/aiRecommendedProduct,
 * logs to crmEnrichmentLogTable, and auto-creates a deal if score >= 60.
 */
export async function enrichContact(
  contactId: number,
  userId: string,
): Promise<EnrichmentResult | null> {
  const agent = getAgentById("diagnostico-cnpj-tax-group");
  if (!agent) {
    logger.error("[Enrichment] diagnostico-cnpj-tax-group agent not found");
    return null;
  }

  const [contact] = await db
    .select()
    .from(crmContactsTable)
    .where(
      and(
        eq(crmContactsTable.id, contactId),
        eq(crmContactsTable.userId, userId),
      ),
    )
    .limit(1);

  if (!contact) {
    console.warn("[Enrichment] Contact not found:", contactId);
    return null;
  }

  // Build structured input for the agent
  const input = `
DADOS PARA DIAGNÓSTICO:
- CNPJ: ${contact.cnpj}
- Razão Social: ${contact.razaoSocial || "Não informado"}
- Nome Fantasia: ${contact.nomeFantasia || "Não informado"}
- Regime Tributário: ${contact.regimeTributario || "Não informado"}
- CNAE: ${contact.cnae || "Não informado"}
- Faturamento Estimado: ${contact.faturamentoEstimado || "Não informado"}
- Porte: ${contact.porte || "Não informado"}
- UF: ${contact.uf || "Não informado"}
- Status: ${contact.status}

Realize o diagnóstico completo e ao final inclua obrigatoriamente um bloco JSON no formato:
\`\`\`json
{
  "score": <número 0-100>,
  "classificacao": "<HOT|WARM|COLD|FORA DO ICP>",
  "produto_recomendado": "<AFD|REP|RTI|PPS|PSF>",
  "credito_estimado": "<valor estimado ou faixa>"
}
\`\`\`
`.trim();

  const llmResult = await callLLM(agent.systemPrompt, input);
  const parsed = parseEnrichmentOutput(llmResult.output);

  // Update contact with AI scoring results
  await db
    .update(crmContactsTable)
    .set({
      aiScore: parsed.score,
      aiScoreDetails: {
        classificacao: parsed.classificacao,
        creditoEstimado: parsed.creditoEstimado,
        rawOutput: llmResult.output.slice(0, 2000),
        enrichedAt: new Date().toISOString(),
      },
      aiRecommendedProduct: parsed.produtoRecomendado,
      lastEnrichedAt: new Date(),
    })
    .where(eq(crmContactsTable.id, contactId));

  // Log the enrichment
  await db
    .insert(crmEnrichmentLogTable)
    .values({
      contactId,
      source: "diagnostico-ia",
      rawData: {
        score: parsed.score,
        classificacao: parsed.classificacao,
        produtoRecomendado: parsed.produtoRecomendado,
      },
      fieldsUpdated: [
        "aiScore",
        "aiScoreDetails",
        "aiRecommendedProduct",
        "lastEnrichedAt",
      ],
    })
    .catch((err: Error) =>
      logger.error({ err }, "[Enrichment] Log insert failed"),
    );

  // Auto-create deal if score >= 60 and no active deal exists
  let dealCreated = false;
  if (parsed.score >= 60) {
    const existingDeals = await db
      .select({ id: crmDealsTable.id })
      .from(crmDealsTable)
      .where(
        and(
          eq(crmDealsTable.contactId, contactId),
          eq(crmDealsTable.userId, userId),
        ),
      )
      .limit(1);

    if (existingDeals.length === 0) {
      await db.insert(crmDealsTable).values({
        userId,
        contactId,
        title: `${contact.razaoSocial || contact.cnpj} — ${parsed.produtoRecomendado || "Oportunidade"}`,
        produto: parsed.produtoRecomendado || null,
        stage: "prospecting",
        probability: parsed.score >= 70 ? 40 : 20,
        value: "0",
      });
      dealCreated = true;
      logger.info(
        `[Enrichment] Auto-created deal for contact ${contactId} (score: ${parsed.score})`,
      );
    }
  }

  logger.info(
    `[Enrichment] Contact ${contactId} scored ${parsed.score} (${parsed.classificacao}), product: ${parsed.produtoRecomendado}`,
  );
  return { ...parsed, dealCreated };
}
