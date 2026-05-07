/**
 * Seed script — cria as sequências de automação iniciais no banco.
 * Uso: DATABASE_URL="..." npx tsx scripts/seed-sequences.ts
 *
 * As sequências são criadas com userId = "system" para ficarem disponíveis
 * globalmente. Ajuste o userId para o seu tenant se necessário.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/src/schema/index.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL não configurada");

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

const { automationSequencesTable } = schema;

// ─── Sequência 1: Onboarding HOT lead (score >= 70) ──────────────────────────
// Trigger: manual ou via CRM automation quando score_above 70
// Cadência: D0 → D2 → D5 → D10 → D15
const seq1 = {
  userId: "system",
  name: "Onboarding HOT Lead — Score 70+",
  trigger: "score_above" as const,
  triggerValue: "70",
  isActive: true,
  steps: [
    {
      day: 0,
      channel: "whatsapp" as const,
      agentId: "prospeccao-tax-group",
      inputTemplate:
        "Crie uma mensagem de primeiro contato via WhatsApp para {{contact_name}} ({{razao_social}}). " +
        "Esta empresa tem alto potencial para o produto {{product}}. " +
        "Seja consultivo, mencione uma oportunidade fiscal específica ao setor, máximo 3 parágrafos curtos. " +
        "Não use linguagem de vendas agressiva.",
    },
    {
      day: 2,
      channel: "whatsapp" as const,
      agentId: "coach-descoberta-tax-group",
      inputTemplate:
        "Crie um segundo toque WhatsApp para {{contact_name}} da {{razao_social}}. " +
        "É o D+2, ainda sem resposta. Compartilhe um dado ou case de sucesso relevante para o setor deles (UF: {{uf}}). " +
        "Termine com uma pergunta aberta que convide à conversa. Máximo 2 parágrafos.",
    },
    {
      day: 5,
      channel: "whatsapp" as const,
      agentId: "objecoes-tax-group",
      inputTemplate:
        "Crie uma mensagem de follow-up para {{contact_name}} da {{razao_social}} — D+5 sem resposta. " +
        "Aborde de forma indireta a objeção mais comum do setor deles sobre {{product}}. " +
        "Seja breve e direto. Ofereça um diagnóstico gratuito de 15 minutos.",
    },
    {
      day: 10,
      channel: "whatsapp" as const,
      agentId: "followup-tax-group",
      inputTemplate:
        "Crie uma mensagem de follow-up D+10 para {{contact_name}} da {{razao_social}}. " +
        "Mencione uma novidade recente sobre Reforma Tributária ou recuperação de créditos que impacta empresas como a deles. " +
        "Posicione isso como informação útil, não como venda. 1 parágrafo.",
    },
    {
      day: 15,
      channel: "whatsapp" as const,
      agentId: "estrategista-deals-tax-group",
      inputTemplate:
        "Última mensagem da sequência para {{contact_name}} da {{razao_social}} — D+15. " +
        "Tom de encerramento gentil: informe que você não vai continuar incomodando, " +
        "mas que a oportunidade de {{product}} continua disponível se mudarem de ideia. " +
        "Deixe a porta aberta. Máximo 2 frases.",
    },
  ],
};

// ─── Sequência 2: Nurturing WARM lead (score 40–69) ──────────────────────────
// Trigger: manual — para leads que ainda não estão maduros
// Cadência: D0 → D7 → D21 → D45
const seq2 = {
  userId: "system",
  name: "Nurturing WARM Lead — Educação e Valor",
  trigger: "manual" as const,
  triggerValue: null,
  isActive: true,
  steps: [
    {
      day: 0,
      channel: "whatsapp" as const,
      agentId: "prospeccao-tax-group",
      inputTemplate:
        "Crie uma mensagem de apresentação para {{contact_name}} da {{razao_social}} em {{uf}}. " +
        "Este é um lead WARM — não force a venda. Apresente o Tax Group e um benefício relevante " +
        "para o regime tributário deles ({{regime}}). Convide para receber conteúdos exclusivos.",
    },
    {
      day: 7,
      channel: "whatsapp" as const,
      agentId: "email-marketing-tax-group",
      inputTemplate:
        "Crie um conteúdo educativo curto em formato WhatsApp para {{contact_name}} da {{razao_social}}. " +
        "Tema: oportunidades de recuperação de créditos tributários para empresas do regime {{regime}}. " +
        "Inclua 1 dado numérico concreto (ex: % médio de crédito recuperado). Termine com CTA suave.",
    },
    {
      day: 21,
      channel: "whatsapp" as const,
      agentId: "reformatributaria-insight",
      inputTemplate:
        "Crie uma mensagem sobre impacto da Reforma Tributária para {{contact_name}} da {{razao_social}}. " +
        "Foque no que muda especificamente para empresas do porte e setor deles. " +
        "Posicione o Tax Group como parceiro para navegar essa mudança. 2-3 parágrafos curtos.",
    },
    {
      day: 45,
      channel: "whatsapp" as const,
      agentId: "coach-descoberta-tax-group",
      inputTemplate:
        "Mensagem de reaquecimento para {{contact_name}} da {{razao_social}} — faz 45 dias desde o primeiro contato. " +
        "Pergunte se houve alguma mudança na empresa (crescimento, nova operação, auditoria). " +
        "Ofereça uma conversa de 20 minutos sem compromisso para revisar o cenário tributário deles.",
    },
  ],
};

// ─── Sequência 3: Pós-proposta enviada ───────────────────────────────────────
// Trigger: deal_stage_changed para 'proposal'
// Cadência: D1 → D3 → D7
const seq3 = {
  userId: "system",
  name: "Pós-Proposta — Aceleração de Fechamento",
  trigger: "deal_stage_changed" as const,
  triggerValue: "proposal",
  isActive: true,
  steps: [
    {
      day: 1,
      channel: "whatsapp" as const,
      agentId: "followup-tax-group",
      inputTemplate:
        "Crie uma mensagem de follow-up D+1 após envio de proposta para {{contact_name}} da {{razao_social}}. " +
        "Confirme o recebimento, destaque o ponto mais relevante da proposta para o perfil deles ({{product}}). " +
        "Pergunte se ficou alguma dúvida. Tom tranquilo e profissional.",
    },
    {
      day: 3,
      channel: "whatsapp" as const,
      agentId: "objecoes-tax-group",
      inputTemplate:
        "Crie mensagem D+3 pós-proposta para {{contact_name}} da {{razao_social}}. " +
        "Antecipe a objeção mais comum sobre {{product}} (custo, tempo, complexidade). " +
        "Responda com um argumento de valor concreto e ofereça uma conversa curta para esclarecer.",
    },
    {
      day: 7,
      channel: "whatsapp" as const,
      agentId: "estrategista-deals-tax-group",
      inputTemplate:
        "Mensagem D+7 pós-proposta para {{contact_name}} da {{razao_social}}. " +
        "Crie urgência legítima: mencione prazo fiscal relevante ou janela de oportunidade que está se fechando. " +
        "Ofereça agendar uma call de decisão de 15 minutos. Tom direto mas sem pressão.",
    },
  ],
};

async function main() {
  console.log("🌱 Criando sequências de automação...\n");

  for (const seq of [seq1, seq2, seq3]) {
    try {
      const [inserted] = await db
        .insert(automationSequencesTable)
        .values({
          userId: seq.userId,
          name: seq.name,
          trigger: seq.trigger,
          triggerValue: seq.triggerValue,
          isActive: seq.isActive,
          steps: seq.steps,
        })
        .returning({ id: automationSequencesTable.id, name: automationSequencesTable.name });

      console.log(`✅ [${inserted.id}] ${inserted.name}`);
    } catch (err: any) {
      console.error(`❌ Falha ao criar "${seq.name}":`, err.message);
    }
  }

  console.log("\n✅ Seed concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed falhou:", err);
  process.exit(1);
});
