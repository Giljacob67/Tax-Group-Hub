import { describe, it, expect, vi } from "vitest";

// @workspace/db (index) lança no load se DATABASE_URL não existir. Importar
// crm.js puxa esse módulo, então o isolamos. A função sob teste é pura e não
// usa `db`. resolveDealStage vem de outro subpath (@workspace/db/legacy-migration,
// puro) e carrega de verdade — é exatamente a ponte que queremos exercitar.
vi.mock("@workspace/db", () => ({
  db: {},
  crmContactsTable: {},
  crmDealsTable: {},
  crmActivitiesTable: {},
  crmEnrichmentLogTable: {},
  crmPipelinesTable: {},
  crmAttachmentsTable: {},
  crmTasksTable: {},
  crmSavedViewsTable: {},
  crmAutomationsTable: {},
  automationSequencesTable: {},
  sequenceEnrollmentsTable: {},
  crmQualificationHistoryTable: {},
  crmAlertsTable: {},
  crmNextStepHistoryTable: {},
  crmAuditLogTable: {},
  appUserRolesTable: {},
  appConfigTable: {},
}));

import { groupDealsByStage } from "../routes/crm.js";
import { resolveDealStage } from "@workspace/db/legacy-migration";

// ═══════════════════════════════════════════════════════════════════════════════
// Regressão do Kanban vazio (funil "Lote 1 — 30 Contas Piloto", id=3)
//
// Causa-raiz real (confirmada em campo no Neon): o funil custom guarda `stages`
// como OBJETOS {key,name,...} no vocabulário de contact-status, e os 31 deals
// carregam a key crua ("em_abordagem"/"nao_iniciado"). O handler antigo (a)
// agrupava por `s.name` ("Em Abordagem") e (b) aplicava resolveDealStage cego,
// reescrevendo "em_abordagem" → "lead_novo" — chave que não existe no funil 3.
// Resultado: zero casamentos → board vazio enquanto /deals (sem filtro) funcionava.
// ═══════════════════════════════════════════════════════════════════════════════

const LOTE1_STAGES = [
  { key: "nao_iniciado", name: "Nao Iniciado", color: "#94A3B8", order: 1 },
  { key: "em_abordagem", name: "Em Abordagem", color: "#3B82F6", order: 2 },
  { key: "respondeu", name: "Respondeu", color: "#F59E0B", order: 3 },
  { key: "reuniao_agendada", name: "Reuniao Agendada", color: "#8B5CF6", order: 4 },
  { key: "qualificado", name: "Qualificado", color: "#10B981", order: 5 },
  { key: "sem_resposta", name: "Sem Resposta", color: "#EF4444", order: 6 },
  { key: "descartado", name: "Descartado", color: "#6B7280", order: 7 },
];

describe("groupDealsByStage — funil custom (object stages, vocab contact-status)", () => {
  it("agrupa deals pela KEY crua, não pelo name nem pela ponte de legado", () => {
    const deals = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        stage: "em_abordagem",
        value: "1000",
      })),
      { id: 31, stage: "nao_iniciado", value: "500" },
    ];

    const { pipeline, stagesOut } = groupDealsByStage(
      LOTE1_STAGES,
      deals,
      resolveDealStage,
    );

    // Os 31 deals aparecem nas colunas certas — não somem.
    expect(pipeline["em_abordagem"]).toHaveLength(30);
    expect(pipeline["nao_iniciado"]).toHaveLength(1);
    // Nada vazou para "lead_novo" (a ponte de legado NÃO disparou — match cru).
    expect(pipeline["lead_novo"]).toBeUndefined();
    // O stage do deal foi preservado (não reescrito).
    expect(pipeline["em_abordagem"][0].stage).toBe("em_abordagem");
    expect(pipeline["em_abordagem"][0].stageOriginal).toBeNull();
    // Nenhuma chave órfã anexada — tudo casou no vocabulário do funil.
    expect(stagesOut).toBe(LOTE1_STAGES);
  });

  it("colunas vazias do funil existem como buckets (zero deals, não ausentes)", () => {
    const { pipeline } = groupDealsByStage(LOTE1_STAGES, [], resolveDealStage);
    for (const s of LOTE1_STAGES) {
      expect(pipeline[s.key]).toEqual([]);
    }
  });
});

describe("groupDealsByStage — funil default (string stages) + ponte de legado", () => {
  const DEFAULT_STAGES = [
    "lead_novo",
    "qualificacao_comercial",
    "reuniao_agendada",
    "fechado_ganho",
  ];

  it("usa resolveDealStage como FALLBACK p/ valores de contact-status", () => {
    // No funil default não existe a key "nao_iniciado"; a ponte a leva p/ lead_novo.
    const deals = [
      { id: 1, stage: "nao_iniciado", value: "100" },
      { id: 2, stage: "lead_novo", value: "200" },
    ];
    const { pipeline } = groupDealsByStage(
      DEFAULT_STAGES,
      deals,
      resolveDealStage,
    );
    expect(pipeline["lead_novo"]).toHaveLength(2);
    expect(
      pipeline["lead_novo"].find((d: any) => d.id === 1).stageOriginal,
    ).toBe("nao_iniciado");
  });

  it("salvaguarda anti-perda: stage sem casamento vira bucket próprio em stagesOut", () => {
    const deals = [{ id: 1, stage: "etapa_inexistente", value: "0" }];
    const { pipeline, stagesOut } = groupDealsByStage(
      DEFAULT_STAGES,
      deals,
      resolveDealStage,
    );
    expect(pipeline["etapa_inexistente"]).toHaveLength(1);
    expect(stagesOut).toContain("etapa_inexistente");
  });
});
