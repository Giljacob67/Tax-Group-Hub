import { Router, type IRouter } from "express";
import {
  db,
  deliverablesTable,
  deliverableSectionsTable,
  deliverableSourcesTable,
  deliverableVersionsTable,
  crmContactsTable,
  crmDealsTable,
  crmActivitiesTable,
  knowledgeDocumentsTable,
  knowledgeChunksTable,
  usageLogsTable,
} from "@workspace/db";
import { eq, desc, and, sql, asc, count } from "drizzle-orm";
import { z } from "zod/v4";
import { apiError } from "../lib/api-response.js";
import { validateIdParam } from "../lib/validation.js";
import { isRealUser } from "../middlewares/auth.js";
import { callLLM } from "../lib/llm-client.js";
import { generateEmbeddings } from "../lib/llm-client.js";
import { getConfigValue } from "./settings.js";
import logger from "../lib/logger.js";

const router: IRouter = Router();

// ─── Section definitions per deliverable type ─────────────────────────────────

const SECTION_SCHEMAS: Record<string, Array<{ key: string; title: string }>> = {
  diagnostico: [
    { key: "context", title: "Contexto da Empresa" },
    { key: "signals", title: "Sinais de Oportunidade" },
    { key: "hypotheses", title: "Hipóteses Tributárias" },
    { key: "sources", title: "Documentos e Fontes Considerados" },
    { key: "risks", title: "Riscos e Premissas" },
    { key: "next_steps", title: "Próximos Passos" },
    { key: "recommendation", title: "Recomendação Tax Group" },
  ],
  proposta: [
    { key: "intro", title: "Introdução" },
    { key: "diagnosis", title: "Diagnóstico Resumido" },
    { key: "scope", title: "Escopo Sugerido" },
    { key: "product", title: "Produto Recomendado" },
    { key: "benefits", title: "Benefícios Esperados" },
    { key: "methodology", title: "Metodologia" },
    { key: "timeline", title: "Cronograma" },
    { key: "responsibilities", title: "Responsabilidades" },
    { key: "premises", title: "Premissas" },
    { key: "next_steps", title: "Próximos Passos" },
  ],
  resumo_oportunidade: [
    { key: "company", title: "Empresa" },
    { key: "segment", title: "Segmento" },
    { key: "product", title: "Produto Sugerido" },
    { key: "potential", title: "Potencial Estimado" },
    { key: "score", title: "Score IA" },
    { key: "objections", title: "Objeções Prováveis" },
    { key: "approach", title: "Abordagem Recomendada" },
  ],
  followup: [
    { key: "context", title: "Contexto" },
    { key: "message", title: "Mensagem Sugerida" },
    { key: "next_action", title: "Próxima Ação" },
    { key: "tone", title: "Tom e Estilo" },
    { key: "channel", title: "Canal Recomendado" },
  ],
  roteiro_reuniao: [
    { key: "objective", title: "Objetivo da Reunião" },
    { key: "questions", title: "Perguntas-chave" },
    { key: "agenda", title: "Pauta" },
    { key: "data_needed", title: "Dados Necessários" },
    { key: "objections", title: "Objeções Prováveis" },
    { key: "closing", title: "Fechamento Sugerido" },
  ],
};

const TYPE_NAMES: Record<string, string> = {
  diagnostico: "Diagnóstico Executivo Tributário",
  proposta: "Proposta Comercial",
  resumo_oportunidade: "Resumo de Oportunidade",
  followup: "Follow-up Comercial",
  roteiro_reuniao: "Roteiro de Reunião",
};

const PRODUCT_NAMES: Record<string, string> = {
  RTI: "RTI – Reforma Tributária Inteligente (LC 214/25)",
  AFD: "AFD – Auditoria Fiscal Digital (PIS/COFINS/ICMS)",
  REP: "REP – Recuperação de Encargos Previdenciários",
  reforma_tributaria: "Reforma Tributária",
  comercial: "Comercial Geral",
  outro: "Outro",
};

const GUARDRAIL_SYSTEM = `
GUARDRAILS OBRIGATÓRIOS:
1. Nunca apresente recuperação tributária como garantida. Use termos como "potencial", "estimativa", "hipótese".
2. Diferencie hipótese de conclusão. Use [PREMISSA] para marcar suposições.
3. Não cite artigos de lei sem citar a fonte da base de conhecimento.
4. Se não houver base suficiente, indique explicitamente "baixa confiança nesta seção".
5. Nunca invente números de recuperação ou prazos sem embasamento documental.
6. Indique que qualquer diagnóstico final depende de análise técnica e documental completa.
7. Não afirme resultado tributário como garantido. A Tax Group é responsável pela análise final.
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCompanyContext(
  contact: typeof crmContactsTable.$inferSelect,
): string {
  const parts: string[] = [];
  if (contact.razaoSocial) parts.push(`Empresa: ${contact.razaoSocial}`);
  if (contact.cnpj) parts.push(`CNPJ: ${contact.cnpj}`);
  if (contact.regimeTributario)
    parts.push(`Regime Tributário: ${contact.regimeTributario}`);
  if (contact.cnae) parts.push(`CNAE: ${contact.cnae}`);
  if (contact.faturamentoEstimado)
    parts.push(`Faturamento Estimado: ${contact.faturamentoEstimado}`);
  if (contact.porte) parts.push(`Porte: ${contact.porte}`);
  if (contact.uf) parts.push(`UF: ${contact.uf}`);
  if (contact.cidade) parts.push(`Cidade: ${contact.cidade}`);
  if (contact.aiScore) parts.push(`Score IA: ${contact.aiScore}/100`);
  if (contact.aiRecommendedProduct)
    parts.push(`Produto Recomendado: ${contact.aiRecommendedProduct}`);
  if (contact.status) parts.push(`Status CRM: ${contact.status}`);
  if (contact.nomeDecissor)
    parts.push(
      `Decissor: ${contact.nomeDecissor} (${contact.cargoDecissor || "cargo não informado"})`,
    );
  return parts.join("\n");
}

async function fetchRAGContext(
  query: string,
  userId?: string,
): Promise<{
  chunks: Array<{ filename: string; content: string; score: number }>;
}> {
  try {
    const {
      embeddings: [queryEmbedding],
    } = await generateEmbeddings([query]);
    const similarity = sql<number>`1 - (${knowledgeChunksTable.embedding} <=> ${JSON.stringify(queryEmbedding)})`;
    const results = await db
      .select({
        content: knowledgeChunksTable.content,
        score: similarity,
        filename: knowledgeDocumentsTable.filename,
      })
      .from(knowledgeChunksTable)
      .innerJoin(
        knowledgeDocumentsTable,
        eq(knowledgeChunksTable.documentId, knowledgeDocumentsTable.id),
      )
      .where(
        isRealUser(userId)
          ? eq(knowledgeDocumentsTable.userId, userId)
          : sql`TRUE`,
      )
      .orderBy(desc(similarity))
      .limit(6);

    return { chunks: results.filter((r) => r.score > 0.25) };
  } catch {
    return { chunks: [] };
  }
}

function buildGenerationPrompt(
  type: string,
  product: string,
  companyCtx: string,
  ragCtx: string,
  sections: Array<{ key: string; title: string }>,
): string {
  return `Você é um especialista tributário da Tax Group gerando um "${TYPE_NAMES[type] || type}".

EMPRESA:
${companyCtx}

PRODUTO FOCO: ${PRODUCT_NAMES[product] || product}

BASE DE CONHECIMENTO RELEVANTE:
${ragCtx || "Nenhum documento relevante encontrado. Use seu conhecimento geral com cautela."}

${GUARDRAIL_SYSTEM}

Gere cada uma das seções abaixo com conteúdo profissional em Markdown.
Retorne APENAS um JSON válido (sem markdown code block) neste formato:
{
  "sections": [
    { "key": "...", "title": "...", "content": "..." }
  ],
  "confidenceLevel": "high|medium|low|none",
  "guardrailWarnings": ["lista de alertas se houver"]
}

SEÇÕES PARA GERAR:
${sections.map((s) => `- ${s.key}: ${s.title}`).join("\n")}

Regras de conteúdo:
- Conteúdo em Markdown profissional
- Use **negrito** para pontos-chave
- Use listas quando apropriado
- Seja específico com base no contexto da empresa
- Se a base de conhecimento não cobre uma seção, marque com [PREMISSA] e indique baixa confiança
- Mínimo 3-5 parágrafos substanciais por seção principal, 1-2 para seções de apoio
`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/deliverables
router.get("/deliverables", async (req, res) => {
  try {
    const userId = req.userId;
    const { status, type, contactId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const conditions: any[] = [];
    if (isRealUser(userId))
      conditions.push(eq(deliverablesTable.userId, userId));
    if (status && typeof status === "string")
      conditions.push(eq(deliverablesTable.status, status));
    if (type && typeof type === "string")
      conditions.push(eq(deliverablesTable.type, type));
    if (contactId)
      conditions.push(eq(deliverablesTable.contactId, Number(contactId)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: deliverablesTable.id,
          title: deliverablesTable.title,
          type: deliverablesTable.type,
          product: deliverablesTable.product,
          status: deliverablesTable.status,
          confidenceLevel: deliverablesTable.confidenceLevel,
          contactId: deliverablesTable.contactId,
          ragSourceCount: deliverablesTable.ragSourceCount,
          guardrailWarnings: deliverablesTable.guardrailWarnings,
          notes: deliverablesTable.notes,
          createdAt: deliverablesTable.createdAt,
          updatedAt: deliverablesTable.updatedAt,
          // Join company name
          companyName: crmContactsTable.razaoSocial,
          companyCnpj: crmContactsTable.cnpj,
        })
        .from(deliverablesTable)
        .leftJoin(
          crmContactsTable,
          eq(deliverablesTable.contactId, crmContactsTable.id),
        )
        .where(where)
        .orderBy(desc(deliverablesTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(deliverablesTable).where(where),
    ]);

    res.json({ deliverables: rows, total: Number(total), limit, offset });
  } catch (err) {
    logger.error({ err }, "[deliverables] list error");
    apiError(res, 500, "Internal server error");
  }
});

// POST /api/deliverables/generate — create + generate with LLM
router.post("/deliverables/generate", async (req, res) => {
  try {
    const schema = z.object({
      contactId: z.number().int().positive().optional(),
      dealId: z.number().int().positive().optional(),
      type: z.enum([
        "diagnostico",
        "proposta",
        "resumo_oportunidade",
        "followup",
        "roteiro_reuniao",
      ]),
      product: z.string().default("comercial"),
      title: z.string().min(1).max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return apiError(res, 400, "Invalid payload");

    const { contactId, dealId, type, product } = parsed.data;
    const userId = req.userId;

    // Load company context
    let contact: typeof crmContactsTable.$inferSelect | undefined;
    if (contactId) {
      const rows = await db
        .select()
        .from(crmContactsTable)
        .where(eq(crmContactsTable.id, contactId));
      contact = rows[0];
    }

    const companyCtx = contact
      ? buildCompanyContext(contact)
      : "Empresa não especificada.";
    const companyName =
      contact?.razaoSocial || contact?.nomeFantasia || "Empresa";

    // Fetch RAG context
    const ragQuery = `${TYPE_NAMES[type]} ${PRODUCT_NAMES[product] || product} ${companyCtx.slice(0, 200)}`;
    const { chunks } = await fetchRAGContext(ragQuery, userId || undefined);

    const ragCtx =
      chunks.length > 0
        ? chunks
            .map(
              (c) =>
                `[Fonte: ${c.filename} | Relevância: ${Math.round(c.score * 100)}%]\n${c.content}`,
            )
            .join("\n\n")
        : "";

    const sections = SECTION_SCHEMAS[type] || [];
    const prompt = buildGenerationPrompt(
      type,
      product,
      companyCtx,
      ragCtx,
      sections,
    );

    const activeProvider = await getConfigValue("ACTIVE_LLM_PROVIDER");
    const activeModel = await getConfigValue("ACTIVE_LLM_MODEL");
    const activeLlmUrl = await getConfigValue("ACTIVE_LLM_URL");

    const startMs = Date.now();
    const result = await callLLM(
      "Você é um especialista tributário da Tax Group. Retorne APENAS JSON válido, sem markdown fences.",
      prompt,
      {
        provider: activeProvider || undefined,
        model: activeModel || undefined,
        customUrl: activeLlmUrl || undefined,
      },
    );
    const latencyMs = Date.now() - startMs;

    // Parse LLM response
    let parsed2: any = null;
    try {
      const raw = result.output
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed2 = JSON.parse(raw);
    } catch {
      // LLM didn't return valid JSON — create placeholder sections
      parsed2 = {
        sections: sections.map((s) => ({
          key: s.key,
          title: s.title,
          content: `*Conteúdo não gerado corretamente. Regenere esta seção.*`,
        })),
        confidenceLevel: "none",
        guardrailWarnings: [
          "Resposta da IA não pôde ser parseada como JSON. Regenere o documento.",
        ],
      };
    }

    const confidence =
      parsed2.confidenceLevel ||
      (chunks.length > 2 ? "medium" : chunks.length > 0 ? "low" : "none");
    const generatedSections: Array<{
      key: string;
      title: string;
      content: string;
    }> = parsed2.sections || [];
    const warnings: string[] = parsed2.guardrailWarnings || [];

    const title =
      parsed.data.title ||
      `${TYPE_NAMES[type]} – ${companyName} (${new Date().toLocaleDateString("pt-BR")})`;

    // Insert deliverable
    const [deliverable] = await db
      .insert(deliverablesTable)
      .values({
        userId: userId || null,
        title,
        type,
        product,
        status: "draft",
        confidenceLevel: confidence,
        contactId: contactId || null,
        dealId: dealId || null,
        model: result.model,
        provider: result.provider,
        guardrailWarnings: warnings.length > 0 ? warnings : null,
        ragSourceCount: chunks.length,
      })
      .returning();

    // Insert sections
    const sectionDefs = sections.map((s, i) => {
      const generated = generatedSections.find((g) => g.key === s.key);
      return {
        deliverableId: deliverable.id,
        sectionKey: s.key,
        title: s.title,
        content: generated?.content || "*Seção não gerada. Use regenerar.*",
        order: i,
        confidenceLevel: chunks.length > 0 ? confidence : "none",
      };
    });
    const insertedSections = await db
      .insert(deliverableSectionsTable)
      .values(sectionDefs)
      .returning();

    // Insert sources
    if (chunks.length > 0) {
      await db.insert(deliverableSourcesTable).values(
        chunks.map((c) => ({
          deliverableId: deliverable.id,
          sectionKey: null,
          sourceTitle: c.filename,
          excerpt: c.content.slice(0, 500),
          similarityScore: Math.round(c.score * 100),
        })),
      );
    }

    // Save initial version
    await db.insert(deliverableVersionsTable).values({
      deliverableId: deliverable.id,
      version: 1,
      sectionsSnapshot: insertedSections.map((s) => ({
        key: s.sectionKey,
        title: s.title,
        content: s.content,
      })),
      changedBy: userId || "system",
      changeSummary: "Versão inicial gerada pela IA",
      model: result.model,
    });

    // Log to CRM timeline if contact specified
    if (contactId) {
      await db
        .insert(crmActivitiesTable)
        .values({
          contactId,
          dealId: dealId || null,
          userId: userId || "system",
          type: "ai_generated",
          direction: "outbound",
          subject: `Entregável gerado: ${title}`,
          content: `[Entregável ID #${deliverable.id}] Tipo: ${TYPE_NAMES[type]}. Produto: ${PRODUCT_NAMES[product] || product}. Fontes RAG: ${chunks.length}. Confiança: ${confidence}.`,
          agentId: "deliverable-generator",
          completedAt: new Date(),
        })
        .catch(() => {}); // non-fatal
    }

    // Log usage
    await db
      .insert(usageLogsTable)
      .values({
        userId: userId || null,
        agentId: "deliverable-generator",
        model: result.model,
        provider: result.provider,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.tokensUsed,
        latencyMs,
        usageType: "deliverable",
        platform: "web",
      })
      .catch(() => {});

    res.status(201).json({ deliverable, sections: insertedSections });
  } catch (err) {
    logger.error({ err }, "[deliverables] generate error");
    apiError(res, 500, "Internal server error");
  }
});

// GET /api/deliverables/:id
router.get("/deliverables/:id", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");
    const userId = req.userId;

    const [deliverable] = await db
      .select({
        d: deliverablesTable,
        companyName: crmContactsTable.razaoSocial,
        companyCnpj: crmContactsTable.cnpj,
        companyRegime: crmContactsTable.regimeTributario,
        companyScore: crmContactsTable.aiScore,
      })
      .from(deliverablesTable)
      .leftJoin(
        crmContactsTable,
        eq(deliverablesTable.contactId, crmContactsTable.id),
      )
      .where(eq(deliverablesTable.id, id));

    if (!deliverable) return apiError(res, 404, "Deliverable not found");
    if (
      isRealUser(userId) &&
      deliverable.d.userId &&
      deliverable.d.userId !== userId
    ) {
      return apiError(res, 403, "Access denied");
    }

    const [sections, sources, versions] = await Promise.all([
      db
        .select()
        .from(deliverableSectionsTable)
        .where(eq(deliverableSectionsTable.deliverableId, id))
        .orderBy(asc(deliverableSectionsTable.order)),
      db
        .select()
        .from(deliverableSourcesTable)
        .where(eq(deliverableSourcesTable.deliverableId, id))
        .orderBy(desc(deliverableSourcesTable.similarityScore)),
      db
        .select()
        .from(deliverableVersionsTable)
        .where(eq(deliverableVersionsTable.deliverableId, id))
        .orderBy(desc(deliverableVersionsTable.version))
        .limit(20),
    ]);

    res.json({
      deliverable: {
        ...deliverable.d,
        companyName: deliverable.companyName,
        companyCnpj: deliverable.companyCnpj,
        companyRegime: deliverable.companyRegime,
        companyScore: deliverable.companyScore,
      },
      sections,
      sources,
      versions,
    });
  } catch (err) {
    logger.error({ err }, "[deliverables] get error");
    apiError(res, 500, "Internal server error");
  }
});

// PATCH /api/deliverables/:id
router.patch("/deliverables/:id", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");

    const userId = req.userId;
    const [existing] = await db
      .select({ userId: deliverablesTable.userId })
      .from(deliverablesTable)
      .where(eq(deliverablesTable.id, id));
    if (!existing) return apiError(res, 404, "Deliverable not found");
    if (isRealUser(userId) && existing.userId && existing.userId !== userId)
      return apiError(res, 403, "Access denied");

    const allowed = ["status", "title", "notes", "product"];
    const updates: Record<string, any> = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    const [updated] = await db
      .update(deliverablesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deliverablesTable.id, id))
      .returning();

    res.json({ deliverable: updated });
  } catch (err) {
    logger.error({ err }, "[deliverables] patch error");
    apiError(res, 500, "Internal server error");
  }
});

// PATCH /api/deliverables/:id/sections/:sectionId
router.patch("/deliverables/:id/sections/:sectionId", async (req, res) => {
  try {
    const deliverableId = validateIdParam(req.params.id);
    const sectionId = validateIdParam(req.params.sectionId);
    if (!deliverableId || !sectionId) return apiError(res, 400, "Invalid id");

    const userId = req.userId;
    const [existing] = await db
      .select({ userId: deliverablesTable.userId })
      .from(deliverablesTable)
      .where(eq(deliverablesTable.id, deliverableId));
    if (!existing) return apiError(res, 404, "Deliverable not found");
    if (isRealUser(userId) && existing.userId && existing.userId !== userId)
      return apiError(res, 403, "Access denied");

    const { content } = req.body;
    if (typeof content !== "string")
      return apiError(res, 400, "content required");

    const [updated] = await db
      .update(deliverableSectionsTable)
      .set({ content, updatedAt: new Date() })
      .where(
        and(
          eq(deliverableSectionsTable.id, sectionId),
          eq(deliverableSectionsTable.deliverableId, deliverableId),
        ),
      )
      .returning();

    // Update deliverable updatedAt
    await db
      .update(deliverablesTable)
      .set({ updatedAt: new Date() })
      .where(eq(deliverablesTable.id, deliverableId));

    res.json({ section: updated });
  } catch (err) {
    logger.error({ err }, "[deliverables] section patch error");
    apiError(res, 500, "Internal server error");
  }
});

// POST /api/deliverables/:id/sections/:sectionId/regenerate
router.post(
  "/deliverables/:id/sections/:sectionId/regenerate",
  async (req, res) => {
    try {
      const deliverableId = validateIdParam(req.params.id);
      const sectionId = validateIdParam(req.params.sectionId);
      if (!deliverableId || !sectionId) return apiError(res, 400, "Invalid id");
      const userId = req.userId;

      const [[deliverable], [section]] = await Promise.all([
        db
          .select()
          .from(deliverablesTable)
          .where(eq(deliverablesTable.id, deliverableId)),
        db
          .select()
          .from(deliverableSectionsTable)
          .where(eq(deliverableSectionsTable.id, sectionId)),
      ]);
      if (!deliverable || !section) return apiError(res, 404, "Not found");
      if (
        isRealUser(userId) &&
        deliverable.userId &&
        deliverable.userId !== userId
      )
        return apiError(res, 403, "Access denied");

      let contact: typeof crmContactsTable.$inferSelect | undefined;
      if (deliverable.contactId) {
        const rows = await db
          .select()
          .from(crmContactsTable)
          .where(eq(crmContactsTable.id, deliverable.contactId));
        contact = rows[0];
      }
      const companyCtx = contact ? buildCompanyContext(contact) : "";

      const { chunks } = await fetchRAGContext(
        `${section.title} ${PRODUCT_NAMES[deliverable.product || ""] || deliverable.product || ""} ${companyCtx.slice(0, 200)}`,
        userId || undefined,
      );
      const ragCtx = chunks
        .map((c) => `[Fonte: ${c.filename}]\n${c.content}`)
        .join("\n\n");

      const sectionPrompt = `Gere apenas a seção "${section.title}" para um ${TYPE_NAMES[deliverable.type] || deliverable.type}.

EMPRESA:
${companyCtx || "Não especificada."}

PRODUTO: ${PRODUCT_NAMES[deliverable.product || ""] || deliverable.product || "Geral"}

BASE DE CONHECIMENTO:
${ragCtx || "Nenhuma fonte encontrada. Use conhecimento geral com cautela e marque como [PREMISSA]."}

${GUARDRAIL_SYSTEM}

Retorne APENAS o conteúdo Markdown da seção, sem título, sem JSON.`;

      const activeProvider = await getConfigValue("ACTIVE_LLM_PROVIDER");
      const activeModel = await getConfigValue("ACTIVE_LLM_MODEL");
      const activeLlmUrl = await getConfigValue("ACTIVE_LLM_URL");

      const result = await callLLM(
        "Você é um especialista tributário da Tax Group. Escreva conteúdo profissional em Markdown.",
        sectionPrompt,
        {
          provider: activeProvider || undefined,
          model: activeModel || undefined,
          customUrl: activeLlmUrl || undefined,
        },
      );

      const newConfidence =
        chunks.length > 2 ? "high" : chunks.length > 0 ? "medium" : "low";
      const [updated] = await db
        .update(deliverableSectionsTable)
        .set({
          content: result.output,
          confidenceLevel: newConfidence,
          updatedAt: new Date(),
        })
        .where(eq(deliverableSectionsTable.id, sectionId))
        .returning();

      await db
        .update(deliverablesTable)
        .set({ updatedAt: new Date() })
        .where(eq(deliverablesTable.id, deliverableId));

      res.json({ section: updated, ragSources: chunks.map((c) => c.filename) });
    } catch (err) {
      logger.error({ err }, "[deliverables] regenerate section error");
      apiError(res, 500, "Internal server error");
    }
  },
);

// POST /api/deliverables/:id/approve — save version + change status
router.post("/deliverables/:id/approve", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");
    const userId = req.userId;
    const { changeSummary } = req.body;

    const sections = await db
      .select()
      .from(deliverableSectionsTable)
      .where(eq(deliverableSectionsTable.deliverableId, id))
      .orderBy(asc(deliverableSectionsTable.order));

    // Get latest version number
    const [latest] = await db
      .select({ v: deliverableVersionsTable.version })
      .from(deliverableVersionsTable)
      .where(eq(deliverableVersionsTable.deliverableId, id))
      .orderBy(desc(deliverableVersionsTable.version))
      .limit(1);

    const nextVersion = (latest?.v || 0) + 1;

    const [deliverable] = await db
      .select()
      .from(deliverablesTable)
      .where(eq(deliverablesTable.id, id));

    await db.insert(deliverableVersionsTable).values({
      deliverableId: id,
      version: nextVersion,
      sectionsSnapshot: sections.map((s) => ({
        key: s.sectionKey,
        title: s.title,
        content: s.content,
      })),
      changedBy: userId || "human",
      changeSummary: changeSummary || `v${nextVersion} – aprovado para revisão`,
      model: deliverable?.model || undefined,
    });

    const [updated] = await db
      .update(deliverablesTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(deliverablesTable.id, id))
      .returning();

    res.json({ deliverable: updated, version: nextVersion });
  } catch (err) {
    logger.error({ err }, "[deliverables] approve error");
    apiError(res, 500, "Internal server error");
  }
});

// GET /api/deliverables/:id/versions
router.get("/deliverables/:id/versions", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");

    const versions = await db
      .select()
      .from(deliverableVersionsTable)
      .where(eq(deliverableVersionsTable.deliverableId, id))
      .orderBy(desc(deliverableVersionsTable.version));

    res.json({ versions });
  } catch (err) {
    logger.error({ err }, "[deliverables] versions error");
    apiError(res, 500, "Internal server error");
  }
});

// GET /api/deliverables/:id/export — HTML download
router.get("/deliverables/:id/export", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");

    const [[deliverableRow], sections, sources] = await Promise.all([
      db
        .select({
          d: deliverablesTable,
          companyName: crmContactsTable.razaoSocial,
          companyCnpj: crmContactsTable.cnpj,
        })
        .from(deliverablesTable)
        .leftJoin(
          crmContactsTable,
          eq(deliverablesTable.contactId, crmContactsTable.id),
        )
        .where(eq(deliverablesTable.id, id)),
      db
        .select()
        .from(deliverableSectionsTable)
        .where(eq(deliverableSectionsTable.deliverableId, id))
        .orderBy(asc(deliverableSectionsTable.order)),
      db
        .select()
        .from(deliverableSourcesTable)
        .where(eq(deliverableSourcesTable.deliverableId, id))
        .orderBy(desc(deliverableSourcesTable.similarityScore)),
    ]);

    if (!deliverableRow) return apiError(res, 404, "Deliverable not found");
    const d = deliverableRow.d;

    // Convert markdown-like content to HTML (basic)
    const mdToHtml = (text: string) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>")
        .replace(/^(?!<[hul]|<\/[hul])(.+)$/gm, "<p>$1</p>");

    const confidenceBadge = (level: string) => {
      const map: Record<string, string> = {
        high: "background:#d1fae5;color:#065f46",
        medium: "background:#fef3c7;color:#92400e",
        low: "background:#fee2e2;color:#991b1b",
        none: "background:#f1f5f9;color:#475569",
      };
      const labels: Record<string, string> = {
        high: "Alta confiança",
        medium: "Média confiança",
        low: "Baixa confiança",
        none: "Sem contexto RAG",
      };
      return `<span style="font-size:11px;padding:2px 8px;border-radius:12px;${map[level] || map.none}">${labels[level] || level}</span>`;
    };

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${d.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; color: #1a1a2e; background: #fff; padding: 0; }
  .cover { background: linear-gradient(135deg, #07111F 0%, #0B1220 100%); color: white; padding: 60px 48px; min-height: 220px; }
  .cover h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; line-height: 1.3; }
  .cover .meta { font-size: 13px; opacity: 0.7; margin-top: 8px; }
  .cover .badge { display: inline-block; background: rgba(16,126,194,0.3); border: 1px solid rgba(16,126,194,0.5); color: #7ec8e3; font-size: 11px; padding: 3px 10px; border-radius: 12px; margin-right: 8px; }
  .content { max-width: 820px; margin: 0 auto; padding: 40px 48px 80px; }
  .section { margin-bottom: 40px; page-break-inside: avoid; }
  .section h2 { font-size: 18px; font-weight: 700; color: #107EC2; border-bottom: 2px solid #107EC2; padding-bottom: 8px; margin-bottom: 16px; }
  .section p { font-size: 14px; line-height: 1.8; margin-bottom: 12px; color: #2d2d44; }
  .section ul { margin-left: 24px; margin-bottom: 12px; }
  .section li { font-size: 14px; line-height: 1.8; margin-bottom: 4px; color: #2d2d44; }
  .section strong { color: #1a1a2e; }
  .sources { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 40px; }
  .sources h3 { font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .source-item { font-size: 12px; color: #64748b; padding: 6px 0; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
  .guardrails { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; }
  .guardrails p { font-size: 12px; color: #92400e; line-height: 1.6; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  @media print { .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="cover">
  <div style="font-size:12px;opacity:0.5;margin-bottom:20px;text-transform:uppercase;letter-spacing:0.1em">Tax Group – Entregável Comercial</div>
  <h1>${d.title}</h1>
  <div style="margin-top:16px">
    <span class="badge">${TYPE_NAMES[d.type] || d.type}</span>
    ${d.product ? `<span class="badge">${d.product}</span>` : ""}
    ${d.status !== "draft" ? `<span class="badge">${d.status.toUpperCase()}</span>` : ""}
  </div>
  ${deliverableRow.companyName ? `<div class="meta" style="margin-top:20px">Empresa: <strong style="opacity:1">${deliverableRow.companyName}</strong>${deliverableRow.companyCnpj ? ` | CNPJ: ${deliverableRow.companyCnpj}` : ""}</div>` : ""}
  <div class="meta">Gerado em: ${new Date(d.createdAt).toLocaleDateString("pt-BR")} | Modelo: ${d.model || "Tax Group AI"} | ${confidenceBadge(d.confidenceLevel)}</div>
</div>

<div class="content">
  ${
    d.guardrailWarnings && d.guardrailWarnings.length > 0
      ? `
  <div class="guardrails">
    <p><strong>⚠️ Alertas de Governança:</strong> ${d.guardrailWarnings.join(" | ")} Este documento é um rascunho gerado por IA e requer revisão técnica antes de qualquer uso.</p>
  </div>`
      : `
  <div class="guardrails">
    <p>⚠️ <strong>Aviso:</strong> Este documento é um rascunho gerado por IA com base nas informações disponíveis. Requer revisão técnica e validação documental antes de qualquer uso comercial ou tributário. A Tax Group é responsável pelo diagnóstico final.</p>
  </div>`
  }

  ${sections
    .map(
      (s) => `
  <div class="section">
    <h2>${s.title}</h2>
    ${mdToHtml(s.content)}
  </div>`,
    )
    .join("")}

  ${
    sources.length > 0
      ? `
  <div class="sources">
    <h3>Fontes da Base de Conhecimento (${sources.length})</h3>
    ${sources.map((s) => `<div class="source-item"><span>${s.sourceTitle}</span><span>${s.similarityScore ? `${s.similarityScore}% relevância` : ""}</span></div>`).join("")}
  </div>`
      : ""
  }

  <div class="footer">
    <p>Documento gerado pelo Tax Group Hub • ${new Date().toLocaleDateString("pt-BR")} • ID #${d.id}</p>
    <p style="margin-top:4px">Este documento é confidencial e destinado exclusivamente ao uso interno da Tax Group e seus clientes.</p>
  </div>
</div>
</body>
</html>`;

    // Update status to exported if approved
    if (d.status === "approved") {
      await db
        .update(deliverablesTable)
        .set({ status: "exported", updatedAt: new Date() })
        .where(eq(deliverablesTable.id, id));
    }

    const filename = `entregavel-${id}-${d.type}-${Date.now()}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err) {
    logger.error({ err }, "[deliverables] export error");
    apiError(res, 500, "Internal server error");
  }
});

// DELETE /api/deliverables/:id
router.delete("/deliverables/:id", async (req, res) => {
  try {
    const id = validateIdParam(req.params.id);
    if (!id) return apiError(res, 400, "Invalid id");

    const userId = req.userId;
    const [existing] = await db
      .select({ userId: deliverablesTable.userId })
      .from(deliverablesTable)
      .where(eq(deliverablesTable.id, id));
    if (!existing) return apiError(res, 404, "Deliverable not found");
    if (isRealUser(userId) && existing.userId && existing.userId !== userId)
      return apiError(res, 403, "Access denied");

    const [deleted] = await db
      .delete(deliverablesTable)
      .where(eq(deliverablesTable.id, id))
      .returning();
    if (!deleted) {
      apiError(res, 404, "Deliverable not found");
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[deliverables] delete error");
    apiError(res, 500, "Internal server error");
  }
});

export default router;
