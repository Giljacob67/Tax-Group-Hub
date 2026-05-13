/**
 * Dados demonstrativos para modo de apresentação do Tax Group Command Center.
 * Nunca persistidos no backend. Usados apenas como fallback visual quando
 * APIs retornam listas vazias e ?demo=1 está ativo.
 */

export type DemoContact = {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  regimeTributario: string;
  cnae: string;
  porte: string;
  uf: string;
  cidade: string;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  website: string | null;
  nomeDecissor: string | null;
  faturamentoEstimado: string | null;
  socios: any[] | null;
  status: string;
  aiScore: number;
  aiScoreDetails: any;
  aiRecommendedProduct: string;
  source: string;
  lastEnrichedAt: string;
  createdAt: string;
};

export type DemoSegment = {
  id: string;
  label: string;
  contacts: number;
  deals: number;
  potentialValue: number;
  hotLeads: number;
};

export type DemoDeal = {
  id: number;
  contactId: number;
  title: string;
  produto: string;
  stage: string;
  value: string;
  probability: number;
  expectedCloseDate: string;
  notes: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
  razaoSocial: string;
  cnpj: string;
};

export type DemoTask = {
  id: number;
  contactId: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string;
  assignedTo: string | null;
  createdAt: string;
};

export const DEMO_CONTACTS: DemoContact[] = [
  {
    id: 101,
    cnpj: "12.345.678/0001-90",
    razaoSocial: "AgroVale Cooperativa Agrícola Ltda.",
    nomeFantasia: "AgroVale",
    regimeTributario: "lucro_real",
    cnae: "0111301",
    porte: "Grande",
    uf: "MG",
    cidade: "Uberlândia",
    endereco: "Rod. BR-050, Km 180",
    telefone: "(34) 3234-5600",
    email: "contato@agrovale.coop.br",
    website: "www.agrovale.coop.br",
    nomeDecissor: "Carlos Henrique Mendes",
    faturamentoEstimado: "480000000",
    socios: null,
    status: "opportunity",
    aiScore: 87,
    aiScoreDetails: {
      tier: "A",
      nextAction: "Agendar diagnóstico fiscal completo com ênfase em RTI e créditos do Leite",
      reasoning: "Cooperativa de grande porte com regime Lucro Real e alto volume de transações agrícolas. Potencial significativo para recuperação de créditos de PIS/COFINS e análise de benefícios do REIQ/Agro."
    },
    aiRecommendedProduct: "RTI",
    source: "demo",
    lastEnrichedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 102,
    cnpj: "23.456.789/0001-01",
    razaoSocial: "Indústria Orion Componentes S.A.",
    nomeFantasia: "Orion Componentes",
    regimeTributario: "lucro_real",
    cnae: "2930701",
    porte: "Grande",
    uf: "SP",
    cidade: "Sorocaba",
    endereco: "Av. Industrial, 4.200",
    telefone: "(15) 3234-7800",
    email: "fiscal@orioncomponentes.com.br",
    website: "www.orioncomponentes.com.br",
    nomeDecissor: "Ana Paula Ferreira",
    faturamentoEstimado: "890000000",
    socios: null,
    status: "qualified",
    aiScore: 81,
    aiScoreDetails: {
      tier: "A",
      nextAction: "Validar créditos acumulados e documentação para AFD",
      reasoning: "Indústria de médios e grandes componentes automotivos com regime Lucro Real. Histórico de exportações e operações com mercadorias sujeitas a diferentes alíquotas de IPI."
    },
    aiRecommendedProduct: "AFD",
    source: "demo",
    lastEnrichedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 103,
    cnpj: "34.567.890/0001-12",
    razaoSocial: "Distribuidora NorteSul Comércio Ltda.",
    nomeFantasia: "NorteSul Distribuidora",
    regimeTributario: "lucro_presumido",
    cnae: "4691500",
    porte: "Médio",
    uf: "PR",
    cidade: "Curitiba",
    endereco: "R. Comercial, 1.800",
    telefone: "(41) 3012-4500",
    email: "administrativo@nortesul.com.br",
    website: "www.nortesul.com.br",
    nomeDecissor: "Roberto Dias Lima",
    faturamentoEstimado: "120000000",
    socios: null,
    status: "opportunity",
    aiScore: 76,
    aiScoreDetails: {
      tier: "B",
      nextAction: "Enviar follow-up comercial com proposta de RTI",
      reasoning: "Distribuidora atacadista com operação interestadual frequente. Potencial para revisão de enquadramento tributário e recuperação de créditos de ICMS."
    },
    aiRecommendedProduct: "RTI",
    source: "demo",
    lastEnrichedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 104,
    cnpj: "45.678.901/0001-23",
    razaoSocial: "LogPrime Transportes e Logística S.A.",
    nomeFantasia: "LogPrime",
    regimeTributario: "lucro_real",
    cnae: "4930202",
    porte: "Grande",
    uf: "RJ",
    cidade: "Rio de Janeiro",
    endereco: "Av. Brasil, 35.000",
    telefone: "(21) 2671-8900",
    email: "contato@logprime.com.br",
    website: "www.logprime.com.br",
    nomeDecissor: "Fernanda Costa Oliveira",
    faturamentoEstimado: "650000000",
    socios: null,
    status: "prospect",
    aiScore: 69,
    aiScoreDetails: {
      tier: "B",
      nextAction: "Revisar regime tributário e mapear oportunidades de REP",
      reasoning: "Transportadora rodoviário de cargas com grande frota própria e regime Lucro Real. Operações com combustíveis, pneus e peças sujeitas a substituição tributária."
    },
    aiRecommendedProduct: "REP",
    source: "demo",
    lastEnrichedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 105,
    cnpj: "56.789.012/0001-34",
    razaoSocial: "Metalúrgica São Francisco Ltda.",
    nomeFantasia: "MetaSão",
    regimeTributario: "lucro_presumido",
    cnae: "2599399",
    porte: "Médio",
    uf: "RS",
    cidade: "Porto Alegre",
    endereco: "Av. Farrapos, 2.100",
    telefone: "(51) 3234-6700",
    email: "financeiro@metalsao.com.br",
    website: null,
    nomeDecissor: "Jorge Augusto Klein",
    faturamentoEstimado: "95000000",
    socios: null,
    status: "qualified",
    aiScore: 72,
    aiScoreDetails: {
      tier: "B",
      nextAction: "Apresentar diagnóstico de AFD com benchmarking do setor metalúrgico",
      reasoning: "Metalúrgica de médio porte com regime Lucro Presumido. Potencial de transição para Lucro Real com benefícios de RECINE e RECICLAGA."
    },
    aiRecommendedProduct: "AFD",
    source: "demo",
    lastEnrichedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: 106,
    cnpj: "67.890.123/0001-45",
    razaoSocial: "Cerealista Centro-Oeste S.A.",
    nomeFantasia: "Cereais CEO",
    regimeTributario: "lucro_real",
    cnae: "4623109",
    porte: "Grande",
    uf: "MT",
    cidade: "Rondonópolis",
    endereco: "BR-163, Km 450",
    telefone: "(66) 3411-2200",
    email: "diretoria@cereaisceo.com.br",
    website: "www.cereaisceo.com.br",
    nomeDecissor: "Mariana Souza Pinto",
    faturamentoEstimado: "320000000",
    socios: null,
    status: "opportunity",
    aiScore: 84,
    aiScoreDetails: {
      tier: "A",
      nextAction: "Montar proposta de RTI com análise de créditos do agronegócio",
      reasoning: "Grande cerealista com regime Lucro Real e operações de exportação. Alto potencial para recuperação de créditos presumidos do agronegócio e análise de REIQ."
    },
    aiRecommendedProduct: "RTI",
    source: "demo",
    lastEnrichedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

export const DEMO_SEGMENTS: DemoSegment[] = [
  { id: "agro", label: "Agronegócio", contacts: 2, deals: 3, potentialValue: 650_000_000, hotLeads: 2 },
  { id: "industria", label: "Indústria", contacts: 2, deals: 2, potentialValue: 890_000_000, hotLeads: 1 },
  { id: "atacado", label: "Atacado", contacts: 1, deals: 1, potentialValue: 120_000_000, hotLeads: 1 },
  { id: "logistica", label: "Logística", contacts: 1, deals: 1, potentialValue: 320_000_000, hotLeads: 1 },
];

export const DEMO_DEALS: DemoDeal[] = [
  {
    id: 201,
    contactId: 101,
    title: "RTI - AgroVale Cooperativa",
    produto: "RTI",
    stage: "proposal",
    value: "180000",
    probability: 60,
    expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    notes: "Proposta em elaboração. Aguardando documentação fiscal.",
    wonAt: null,
    lostAt: null,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    razaoSocial: "AgroVale Cooperativa Agrícola Ltda.",
    cnpj: "12.345.678/0001-90",
  },
  {
    id: 202,
    contactId: 102,
    title: "AFD - Orion Componentes",
    produto: "AFD",
    stage: "discovery",
    value: "240000",
    probability: 40,
    expectedCloseDate: new Date(Date.now() + 45 * 86400000).toISOString(),
    notes: "Diagnóstico inicial realizado. Alta complexidade operacional.",
    wonAt: null,
    lostAt: null,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    razaoSocial: "Indústria Orion Componentes S.A.",
    cnpj: "23.456.789/0001-01",
  },
  {
    id: 203,
    contactId: 103,
    title: "RTI - NorteSul Distribuidora",
    produto: "RTI",
    stage: "negotiation",
    value: "95000",
    probability: 75,
    expectedCloseDate: new Date(Date.now() + 15 * 86400000).toISOString(),
    notes: "Proposta enviada. Follow-up agendado para próxima semana.",
    wonAt: null,
    lostAt: null,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    razaoSocial: "Distribuidora NorteSul Comércio Ltda.",
    cnpj: "34.567.890/0001-12",
  },
  {
    id: 204,
    contactId: 104,
    title: "REP - LogPrime Transportes",
    produto: "REP",
    stage: "discovery",
    value: "130000",
    probability: 30,
    expectedCloseDate: new Date(Date.now() + 60 * 86400000).toISOString(),
    notes: "Primeiro contato realizado. Mapeando oportunidades de créditos de combustível.",
    wonAt: null,
    lostAt: null,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    razaoSocial: "LogPrime Transportes e Logística S.A.",
    cnpj: "45.678.901/0001-23",
  },
  {
    id: 205,
    contactId: 106,
    title: "RTI - Cerealista CEO",
    produto: "RTI",
    stage: "proposal",
    value: "210000",
    probability: 55,
    expectedCloseDate: new Date(Date.now() + 25 * 86400000).toISOString(),
    notes: "Análise de créditos do agronegócio em andamento. Potencial de RECINE.",
    wonAt: null,
    lostAt: null,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    razaoSocial: "Cerealista Centro-Oeste S.A.",
    cnpj: "67.890.123/0001-45",
  },
];

export const DEMO_TASKS: DemoTask[] = [
  {
    id: 301,
    contactId: 101,
    title: "Agendar diagnóstico fiscal - AgroVale",
    description: "Marcar reunião presencial com Carlos Henrique para apresentação do diagnóstico RTI.",
    status: "pending",
    priority: "high",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    assignedTo: "Analista Tributário",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 302,
    contactId: 102,
    title: "Validar documentação AFD - Orion",
    description: "Solicitar balancetes dos últimos 24 meses e DRE detalhada.",
    status: "pending",
    priority: "high",
    dueDate: new Date(Date.now() + 1 * 86400000).toISOString(),
    assignedTo: "Analista Tributário",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 303,
    contactId: 103,
    title: "Follow-up proposta NorteSul",
    description: "Ligar para Roberto Dias e confirmar recebimento da proposta de RTI.",
    status: "pending",
    priority: "medium",
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    assignedTo: "Comercial",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 304,
    contactId: 104,
    title: "Revisar regime tributário LogPrime",
    description: "Analisar possibilidade de transição para Lucro Presumido ou benefícios de REP.",
    status: "pending",
    priority: "medium",
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    assignedTo: "Consultor Sênior",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const DEMO_JOURNEY_STEPS = [
  {
    step: 1,
    title: "Mapear empresas-alvo",
    description: "Importe CNPJs ou conecte fontes de dados para identificar empresas com potencial tributário.",
  },
  {
    step: 2,
    title: "Priorizar com IA",
    description: "O motor de pontuação analisa regime, CNAE, faturamento e histórico para ranquear oportunidades.",
  },
  {
    step: 3,
    title: "Acionar agentes especializados",
    description: "Cada vertical tem agentes treinados para diagnóstico, proposta e follow-up comercial.",
  },
  {
    step: 4,
    title: "Converter em diagnóstico, proposta e contrato",
    description: "Pipeline comercial rastreia cada etapa até o fechamento, com automações de nurturing.",
  },
];

export const DEMO_CHAT_SUGGESTIONS = [
  "Priorize os leads com maior potencial para RTI no agronegócio.",
  "Monte uma abordagem comercial para uma indústria de Lucro Real em São Paulo.",
  "Crie um plano de follow-up para propostas de AFD abertas há mais de 7 dias.",
  "Analise a Cerealista CEO e sugira o próximo passo tributário considerando exportações.",
];

// Helpers
export function isDemoData(item: any): boolean {
  return item?.source === "demo" || (typeof item?.id === "number" && item.id >= 100 && item.id < 1000);
}
