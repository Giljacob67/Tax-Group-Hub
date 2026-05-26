import type { CrmContact, CrmDeal, CrmActivity, CrmTask } from "@workspace/db";
import type { HubSpotCompany, HubSpotContact, HubSpotDeal, HubSpotNote, HubSpotTask } from "./client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function safeNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toHubSpotDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function toTimeString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.getTime().toString();
}

function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Status Mapping ──────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  prospect: "Prospect",
  qualified: "Qualified",
  opportunity: "Opportunity",
  client: "Client",
  churned: "Churned",
  lost: "Lost",
};

const STATUS_REVERSE_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(STATUS_MAP)) {
  STATUS_REVERSE_MAP[v.toLowerCase()] = k;
}

function statusToHubSpot(status: string): string {
  return STATUS_MAP[status] ?? status;
}

function statusFromHubSpot(hsStatus: string | null | undefined): string {
  if (!hsStatus) return "prospect";
  return STATUS_REVERSE_MAP[hsStatus.toLowerCase()] ?? "prospect";
}

// ─── Priority Mapping ────────────────────────────────────────────────────────

const PRIORITY_TO_HUBSPOT: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "HIGH",
};

const PRIORITY_FROM_HUBSPOT: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
};

function priorityToHubSpot(priority: string): string {
  return PRIORITY_TO_HUBSPOT[priority] ?? "MEDIUM";
}

function priorityFromHubSpot(hsPriority: string | null | undefined): string {
  if (!hsPriority) return "medium";
  return PRIORITY_FROM_HUBSPOT[hsPriority.toLowerCase()] ?? "medium";
}

// ─── Task Status Mapping ─────────────────────────────────────────────────────

const TASK_STATUS_TO_HUBSPOT: Record<string, string> = {
  pending: "NOT_STARTED",
  done: "COMPLETED",
  snoozed: "DEFERRED",
  cancelled: "DEFERRED",
};

const TASK_STATUS_FROM_HUBSPOT: Record<string, string> = {
  not_started: "pending",
  completed: "done",
  deferred: "snoozed",
};

function taskStatusToHubSpot(status: string): string {
  return TASK_STATUS_TO_HUBSPOT[status] ?? "NOT_STARTED";
}

function taskStatusFromHubSpot(hsStatus: string | null | undefined): string {
  if (!hsStatus) return "pending";
  return TASK_STATUS_FROM_HUBSPOT[hsStatus.toLowerCase()] ?? "pending";
}

// ─── Task Type Mapping ───────────────────────────────────────────────────────

const TASK_TYPE_TO_HUBSPOT: Record<string, string> = {
  call: "CALL",
  email: "EMAIL",
  whatsapp: "EMAIL",
  meeting: "CALL",
  proposal: "TODO",
  note: "TODO",
};

function taskTypeToHubSpot(type: string): string {
  return TASK_TYPE_TO_HUBSPOT[type] ?? "TODO";
}

function taskTypeFromHubSpot(hsType: string | null | undefined): string {
  if (!hsType) return "note";
  const map: Record<string, string> = { call: "call", email: "email", todo: "note" };
  return map[hsType.toLowerCase()] ?? "note";
}

// ─── Activity → HubSpot Note ──────────────────────────────────────────────────

export type HubSpotCompanyInput = { properties: Record<string, string | number | null> };
export type HubSpotContactInput = { properties: Record<string, string | number | null> };
export type HubSpotDealInput = { properties: Record<string, string | number | null> };
export type HubSpotNoteInput = { properties: Record<string, string | number | null> };
export type HubSpotTaskInput = { properties: Record<string, string | number | null> };

export function mapContactToHubSpotCompany(contact: CrmContact): HubSpotCompanyInput {
  return {
    properties: {
      name: safeStr(contact.razaoSocial),
      nome_fantasia: safeStr(contact.nomeFantasia),
      cnpj: safeStr(contact.cnpj),
      regime_tributario: safeStr(contact.regimeTributario),
      cnae: safeStr(contact.cnae),
      porte: safeStr(contact.porte),
      annualrevenue: safeStr(contact.faturamentoEstimado),
      state: safeStr(contact.uf),
      city: safeStr(contact.cidade),
      address: safeStr(contact.endereco),
      zip: safeStr(contact.cep),
      phone: safeStr(contact.telefone),
      website: safeStr(contact.website),
      hs_lead_status: statusToHubSpot(contact.status),
      ai_score: contact.aiScore ?? null,
      ai_recommended_product: safeStr(contact.aiRecommendedProduct),
      source: safeStr(contact.source),
    },
  };
}

export function mapContactToHubSpotContactPerson(contact: CrmContact): HubSpotContactInput | null {
  const nome = safeStr(contact.nomeDecissor).trim();
  if (!nome && !contact.email) return null;

  const parts = nome.split(" ");
  const firstName = parts[0] || nome;
  const lastName = parts.slice(1).join(" ") || "(Contato)";

  return {
    properties: {
      firstname: firstName,
      lastname: lastName,
      email: safeStr(contact.email),
      phone: safeStr(contact.telefone),
      jobtitle: safeStr(contact.cargoDecissor),
    },
  };
}

export function mapDealToHubSpotDeal(deal: CrmDeal): HubSpotDealInput {
  return {
    properties: {
      dealname: deal.title,
      dealstage: deal.stage, // will be resolved to stage ID by caller
      amount: safeStr(deal.value) || "0",
      closedate: toHubSpotDate(deal.expectedCloseDate) ?? undefined,
      deal_probability: deal.probability ?? null,
      produto: safeStr(deal.produto),
    },
  };
}

export function mapActivityToHubSpotNote(activity: CrmActivity): HubSpotNoteInput {
  const typePrefix: Record<string, string> = {
    call: "[Ligação] ",
    email: "[Email] ",
    whatsapp: "[WhatsApp] ",
    linkedin: "[LinkedIn] ",
    meeting: "[Reunião] ",
    ai_generated: "[IA] ",
    stage_change: "[Pipeline] ",
  };

  const prefix = typePrefix[activity.type] ?? "";
  const title = activity.subject ? `${prefix}${activity.subject}` : `${prefix}Atividade`;

  return {
    properties: {
      hs_note_body: activity.content ?? "",
      hs_body_preview: title,
      hs_timestamp: toTimeString(activity.completedAt ?? activity.createdAt),
    },
  };
}

export function mapTaskToHubSpotTask(task: CrmTask): HubSpotTaskInput {
  return {
    properties: {
      hs_task_subject: task.title,
      hs_task_body: task.description ?? "",
      hs_task_status: taskStatusToHubSpot(task.status),
      hs_task_priority: priorityToHubSpot(task.priority),
      hs_task_type: taskTypeToHubSpot(task.type),
      hs_timestamp: toTimeString(task.dueDate ?? task.createdAt),
    },
  };
}

// ─── HubSpot → Tax Group (Inbound Polling) ──────────────────────────────────

export function mapHubSpotCompanyToContact(
  company: HubSpotCompany,
  existing?: CrmContact,
): Partial<CrmContact> {
  const p = company.properties;
  const base: Partial<CrmContact> = {
    hubspotId: company.id,
    razaoSocial: safeStr(p.name) || existing?.razaoSocial,
    nomeFantasia: safeStr(p.nome_fantasia) || existing?.nomeFantasia,
    cnpj: safeStr(p.cnpj) || existing?.cnpj,
    regimeTributario: safeStr(p.regime_tributario) || existing?.regimeTributario,
    cnae: safeStr(p.cnae) || existing?.cnae,
    porte: safeStr(p.porte) || existing?.porte,
    faturamentoEstimado: safeStr(p.annualrevenue) || existing?.faturamentoEstimado,
    uf: safeStr(p.state) || existing?.uf,
    cidade: safeStr(p.city) || existing?.cidade,
    endereco: safeStr(p.address) || existing?.endereco,
    cep: safeStr(p.zip) || existing?.cep,
    telefone: safeStr(p.phone) || existing?.telefone,
    website: safeStr(p.website) || existing?.website,
    status: statusFromHubSpot(p.hs_lead_status) || existing?.status,
    source: safeStr(p.source) || existing?.source || "hubspot",
    updatedAt: new Date(company.updatedAt),
  };

  const aiScore = safeNum(p.ai_score);
  if (aiScore !== null) base.aiScore = aiScore;
  const recommended = safeStr(p.ai_recommended_product);
  if (recommended) base.aiRecommendedProduct = recommended;

  return base;
}

export function mapHubSpotDealToDeal(
  deal: HubSpotDeal,
  existing?: CrmDeal,
): Partial<CrmDeal> {
  const p = deal.properties;
  return {
    hubspotId: deal.id,
    title: safeStr(p.dealname) || existing?.title,
    stage: safeStr(p.dealstage) || existing?.stage,
    value: safeStr(p.amount) || existing?.value,
    probability: safeNum(p.deal_probability) ?? existing?.probability,
    expectedCloseDate: parseDate(p.closedate) ?? existing?.expectedCloseDate,
    produto: safeStr(p.produto) || existing?.produto,
    updatedAt: new Date(deal.updatedAt),
  };
}

export function mapHubSpotNoteToActivity(
  note: HubSpotNote,
): Partial<CrmActivity> {
  const p = note.properties;
  const body = p.hs_note_body ?? "";
  const preview = p.hs_body_preview ?? "";

  let type = "note";
  if (preview.startsWith("[Ligação]")) type = "call";
  else if (preview.startsWith("[Email]")) type = "email";
  else if (preview.startsWith("[WhatsApp]")) type = "whatsapp";
  else if (preview.startsWith("[LinkedIn]")) type = "linkedin";
  else if (preview.startsWith("[Reunião]")) type = "meeting";
  else if (preview.startsWith("[Pipeline]")) type = "stage_change";
  else if (preview.startsWith("[IA]")) type = "ai_generated";

  return {
    hubspotId: note.id,
    type,
    content: body,
    subject: preview,
    direction: "inbound",
    completedAt: parseDate(p.hs_timestamp) ?? new Date(),
    createdAt: new Date(note.createdAt),
  };
}

export function mapHubSpotTaskToTask(
  task: HubSpotTask,
): Partial<CrmTask> {
  const p = task.properties;
  return {
    hubspotId: task.id,
    title: safeStr(p.hs_task_subject),
    description: safeStr(p.hs_task_body),
    status: taskStatusFromHubSpot(p.hs_task_status),
    priority: priorityFromHubSpot(p.hs_task_priority),
    type: taskTypeFromHubSpot(p.hs_task_type),
    dueDate: parseDate(p.hs_timestamp) ?? new Date(),
    updatedAt: new Date(task.updatedAt),
  };
}
