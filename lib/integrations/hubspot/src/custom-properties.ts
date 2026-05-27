import type { HubSpotClient } from "./client.js";

interface CustomPropertyDef {
  objectType: "companies" | "deals";
  name: string;
  label: string;
  type: "string" | "number" | "enumeration";
  fieldType: "text" | "number" | "select" | "date";
  description: string;
  options?: Array<{ label: string; value: string }>;
  unique?: boolean;
}

const COMPANY_PROPERTIES: CustomPropertyDef[] = [
  {
    objectType: "companies",
    name: "nome_fantasia",
    label: "Nome Fantasia",
    type: "string",
    fieldType: "text",
    description: "Trade name / brand name of the company",
  },
  {
    objectType: "companies",
    name: "cnpj",
    label: "CNPJ",
    type: "string",
    fieldType: "text",
    description: "Brazilian CNPJ number (14 digits, unique per company)",
    unique: true,
  },
  {
    objectType: "companies",
    name: "regime_tributario",
    label: "Regime Tributário",
    type: "enumeration",
    fieldType: "select",
    description: "Tax regime classification",
    options: [
      { label: "Lucro Real", value: "lucro_real" },
      { label: "Lucro Presumido", value: "lucro_presumido" },
      { label: "Simples Nacional", value: "simples" },
      { label: "MEI", value: "mei" },
    ],
  },
  {
    objectType: "companies",
    name: "cnae",
    label: "CNAE",
    type: "string",
    fieldType: "text",
    description: "Primary CNAE activity code",
  },
  {
    objectType: "companies",
    name: "porte",
    label: "Porte da Empresa",
    type: "enumeration",
    fieldType: "select",
    description: "Company size classification",
    options: [
      { label: "ME", value: "ME" },
      { label: "EPP", value: "EPP" },
      { label: "Médio", value: "Medio" },
      { label: "Grande", value: "Grande" },
      { label: "Demais", value: "Demais" },
    ],
  },
  {
    objectType: "companies",
    name: "state",
    label: "UF",
    type: "string",
    fieldType: "text",
    description: "State (UF) abbreviation",
  },
  {
    objectType: "companies",
    name: "hs_lead_status",
    label: "Status do Lead",
    type: "enumeration",
    fieldType: "select",
    description: "Lead lifecycle status",
    options: [
      { label: "Prospect", value: "Prospect" },
      { label: "Qualified", value: "Qualified" },
      { label: "Opportunity", value: "Opportunity" },
      { label: "Client", value: "Client" },
      { label: "Churned", value: "Churned" },
      { label: "Lost", value: "Lost" },
    ],
  },
  {
    objectType: "companies",
    name: "ai_score",
    label: "AI Score",
    type: "number",
    fieldType: "number",
    description: "AI qualification score (0-100)",
  },
  {
    objectType: "companies",
    name: "ai_recommended_product",
    label: "Produto Recomendado",
    type: "enumeration",
    fieldType: "select",
    description: "Product recommended by AI diagnostic",
    options: [
      { label: "AFD", value: "AFD" },
      { label: "REP", value: "REP" },
      { label: "RTI", value: "RTI" },
      { label: "PPS", value: "PPS" },
      { label: "PSF", value: "PSF" },
    ],
  },
  {
    objectType: "companies",
    name: "source",
    label: "Origem",
    type: "enumeration",
    fieldType: "select",
    description: "Lead source / origin",
    options: [
      { label: "Manual", value: "manual" },
      { label: "EmpresaQui", value: "empresaqui" },
      { label: "Webhook", value: "webhook" },
      { label: "Import CSV", value: "import" },
      { label: "HubSpot", value: "hubspot" },
    ],
  },
];

const DEAL_PROPERTIES: CustomPropertyDef[] = [
  {
    objectType: "deals",
    name: "produto",
    label: "Produto",
    type: "enumeration",
    fieldType: "select",
    description: "Product associated with the deal",
    options: [
      { label: "AFD", value: "AFD" },
      { label: "REP", value: "REP" },
      { label: "RTI", value: "RTI" },
    ],
  },
  {
    objectType: "deals",
    name: "deal_probability",
    label: "Probabilidade (%)",
    type: "number",
    fieldType: "number",
    description: "Win probability percentage (0-100)",
  },
];

export async function ensureCustomProperties(client: HubSpotClient): Promise<{ created: string[]; existing: string[]; errors: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  const errors: string[] = [];

  // Ensure property groups exist first
  try { await client.createPropertyGroup("companies", "tax_group_hub", "Tax Group Hub"); }
  catch (err) { /* group may already exist */ }
  try { await client.createPropertyGroup("deals", "tax_group_hub", "Tax Group Hub"); }
  catch (err) { /* group may already exist */ }

  async function ensure(def: CustomPropertyDef): Promise<void> {
    try {
      const existingProps = await client.getCustomProperties(def.objectType);
      const found = existingProps.results.find((p) => p.name === def.name);
      if (found) {
        existing.push(`${def.objectType}.${def.name}`);
        return;
      }

      await client.createCustomProperty(def.objectType, {
        name: def.name,
        label: def.label,
        type: def.type,
        fieldType: def.fieldType,
        description: def.description,
        options: def.options,
        hasUniqueValue: def.unique ?? false,
        groupName: "tax_group_hub",
      });
      created.push(`${def.objectType}.${def.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${def.objectType}.${def.name}: ${msg}`);
    }
  }

  for (const def of COMPANY_PROPERTIES) await ensure(def);
  for (const def of DEAL_PROPERTIES) await ensure(def);

  return { created, existing, errors };
}
