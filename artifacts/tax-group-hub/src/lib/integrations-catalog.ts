export type IntegrationStatus = "connected" | "available" | "coming_soon" | "error";

export type IntegrationCategory =
  | "Comunicação"
  | "CRM & Comercial"
  | "Automação"
  | "Conteúdo & Design"
  | "Dados & Documentos"
  | "IA & Modelos";

export interface IntegrationCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  emoji: string;
  tags: string[];
  ctaLabel: string;
  badge?: string; // "Novo" | "Popular" | "Beta"
}

export interface AutomationRecipe {
  id: string;
  name: string;
  trigger: string;
  action: string;
  description: string;
  status: "active" | "inactive" | "coming_soon";
  emoji: string;
}

export interface WebhookEvent {
  id: string;
  name: string;
  description: string;
  examplePayload?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  integration: string;
  integrationEmoji: string;
  event: string;
  status: "success" | "error" | "pending";
  message: string;
  duration?: number; // ms
}

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  "Comunicação",
  "CRM & Comercial",
  "Automação",
  "Conteúdo & Design",
  "Dados & Documentos",
  "IA & Modelos",
];

export const INTEGRATIONS_CATALOG: IntegrationCatalogEntry[] = [
  // ── Comunicação ──────────────────────────────────────────────────────────
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Envie mensagens, receba leads e automatize conversas com a API oficial do WhatsApp Business.",
    category: "Comunicação",
    status: "connected",
    emoji: "💬",
    tags: ["mensagens", "leads", "automação"],
    ctaLabel: "Configurar",
    badge: "Popular",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Bot do Telegram para receber notificações, interagir com agentes e disparar fluxos automáticos.",
    category: "Comunicação",
    status: "connected",
    emoji: "✈️",
    tags: ["bot", "notificações", "agentes"],
    ctaLabel: "Configurar",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Leia e envie e-mails diretamente da plataforma. Dispare sequências de e-mail por eventos de CRM.",
    category: "Comunicação",
    status: "coming_soon",
    emoji: "📧",
    tags: ["email", "sequências", "crm"],
    ctaLabel: "Em breve",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Receba alertas de novos deals, tarefas vencidas e mudanças de estágio diretamente no Slack.",
    category: "Comunicação",
    status: "coming_soon",
    emoji: "🟣",
    tags: ["alertas", "notificações", "equipe"],
    ctaLabel: "Em breve",
  },
  // ── CRM & Comercial ───────────────────────────────────────────────────────
  {
    id: "empresaqui",
    name: "EmpresaQui",
    description: "Enriquecimento automático de dados empresariais via CNPJ. Conecte contatos a dados da Receita Federal.",
    category: "CRM & Comercial",
    status: "connected",
    emoji: "🏢",
    tags: ["cnpj", "enriquecimento", "receita federal"],
    ctaLabel: "Configurar",
    badge: "Popular",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sincronize contatos, deals e atividades bidirecionalmente com o HubSpot CRM.",
    category: "CRM & Comercial",
    status: "available",
    emoji: "🟠",
    tags: ["crm", "sync", "deals"],
    ctaLabel: "Conectar",
    badge: "Novo",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Exporte e importe negociações do Pipedrive. Mantenha pipelines sincronizados.",
    category: "CRM & Comercial",
    status: "coming_soon",
    emoji: "🔵",
    tags: ["pipeline", "negociações", "sync"],
    ctaLabel: "Em breve",
  },
  {
    id: "rdstation",
    name: "RD Station",
    description: "Capture leads do RD Station automaticamente e qualifique com IA antes de enviar ao time comercial.",
    category: "CRM & Comercial",
    status: "coming_soon",
    emoji: "🟢",
    tags: ["leads", "marketing", "qualificação"],
    ctaLabel: "Em breve",
    badge: "Novo",
  },
  // ── Automação ─────────────────────────────────────────────────────────────
  {
    id: "make",
    name: "Make (Integromat)",
    description: "Construa cenários visuais de automação que conectam o Tax Group Hub a qualquer app via Make.",
    category: "Automação",
    status: "available",
    emoji: "⚙️",
    tags: ["automação", "cenários", "no-code"],
    ctaLabel: "Conectar",
    badge: "Popular",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Conecte mais de 6.000 apps ao Tax Group Hub com zaps prontos para uso.",
    category: "Automação",
    status: "coming_soon",
    emoji: "⚡",
    tags: ["zaps", "conectores", "no-code"],
    ctaLabel: "Em breve",
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Workflows self-hosted de automação. Ideal para dados sensíveis e fluxos complexos.",
    category: "Automação",
    status: "coming_soon",
    emoji: "🔄",
    tags: ["self-hosted", "workflows", "dados"],
    ctaLabel: "Em breve",
  },
  {
    id: "power-automate",
    name: "Power Automate",
    description: "Integração com o ecossistema Microsoft via Power Automate para empresas que usam Microsoft 365.",
    category: "Automação",
    status: "coming_soon",
    emoji: "🔷",
    tags: ["microsoft", "m365", "enterprise"],
    ctaLabel: "Em breve",
  },
  // ── Conteúdo & Design ────────────────────────────────────────────────────
  {
    id: "canva",
    name: "Canva",
    description: "Abra templates profissionais pré-configurados para o contexto tributário: propostas, apresentações, posts.",
    category: "Conteúdo & Design",
    status: "connected",
    emoji: "🎨",
    tags: ["design", "templates", "apresentações"],
    ctaLabel: "Abrir Canva",
    badge: "Popular",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Salve documentos gerados, propostas e relatórios diretamente em pastas organizadas do Drive.",
    category: "Conteúdo & Design",
    status: "available",
    emoji: "📁",
    tags: ["documentos", "storage", "relatórios"],
    ctaLabel: "Conectar",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sincronize bases de conhecimento e documentação tributária com workspaces do Notion.",
    category: "Conteúdo & Design",
    status: "coming_soon",
    emoji: "📝",
    tags: ["wiki", "documentação", "knowledge"],
    ctaLabel: "Em breve",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Exporte assets e protótipos de relatórios diretamente do Figma para o fluxo de documentos.",
    category: "Conteúdo & Design",
    status: "coming_soon",
    emoji: "🖌️",
    tags: ["design", "assets", "protótipos"],
    ctaLabel: "Em breve",
  },
  // ── Dados & Documentos ───────────────────────────────────────────────────
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Exporte relatórios de CRM, analytics e dados financeiros para planilhas do Google Sheets.",
    category: "Dados & Documentos",
    status: "coming_soon",
    emoji: "📊",
    tags: ["planilhas", "relatórios", "exportação"],
    ctaLabel: "Em breve",
    badge: "Novo",
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Sincronize bases de dados de clientes e projetos com o Airtable para relatórios customizados.",
    category: "Dados & Documentos",
    status: "coming_soon",
    emoji: "🗃️",
    tags: ["banco de dados", "relatórios", "sync"],
    ctaLabel: "Em breve",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Faça backup automático de documentos fiscais e certidões no Dropbox Business.",
    category: "Dados & Documentos",
    status: "coming_soon",
    emoji: "📦",
    tags: ["backup", "documentos", "fiscais"],
    ctaLabel: "Em breve",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    description: "Integração com OneDrive para empresas no ecossistema Microsoft 365.",
    category: "Dados & Documentos",
    status: "coming_soon",
    emoji: "☁️",
    tags: ["microsoft", "storage", "documentos"],
    ctaLabel: "Em breve",
  },
  // ── IA & Modelos ─────────────────────────────────────────────────────────
  {
    id: "google-gemini",
    name: "Google Gemini",
    description: "Modelos Gemini Pro e Flash para geração de texto, análise de documentos e imagens.",
    category: "IA & Modelos",
    status: "connected",
    emoji: "✨",
    tags: ["llm", "visão", "documentos"],
    ctaLabel: "Configurar",
    badge: "Popular",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o e modelos da OpenAI para agentes conversacionais e análise tributária avançada.",
    category: "IA & Modelos",
    status: "available",
    emoji: "🤖",
    tags: ["gpt", "agentes", "análise"],
    ctaLabel: "Conectar",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.5 Sonnet e Opus para raciocínio complexo e geração de documentos jurídico-tributários.",
    category: "IA & Modelos",
    status: "available",
    emoji: "🧠",
    tags: ["claude", "raciocínio", "jurídico"],
    ctaLabel: "Conectar",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Inferência ultra-rápida via Groq Cloud com modelos Llama e Mixtral para respostas em tempo real.",
    category: "IA & Modelos",
    status: "available",
    emoji: "⚡",
    tags: ["fast", "llama", "mixtral"],
    ctaLabel: "Conectar",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Rode modelos locais com Ollama para máxima privacidade. Dados sensíveis nunca saem do servidor.",
    category: "IA & Modelos",
    status: "available",
    emoji: "🦙",
    tags: ["local", "privacidade", "self-hosted"],
    ctaLabel: "Conectar",
  },
];

export const AUTOMATION_RECIPES: AutomationRecipe[] = [
  {
    id: "new-contact-whatsapp",
    name: "Boas-vindas automáticas",
    trigger: "Novo contato criado",
    action: "Enviar mensagem WhatsApp",
    description: "Quando um novo contato é adicionado ao CRM, envia mensagem de boas-vindas personalizada via WhatsApp.",
    status: "active",
    emoji: "👋",
  },
  {
    id: "score-above-70",
    name: "Score alto → Proposta",
    trigger: "Score IA ≥ 70",
    action: "Criar tarefa de proposta",
    description: "Quando o score IA de um contato ultrapassa 70, cria automaticamente uma tarefa para enviar proposta.",
    status: "active",
    emoji: "🎯",
  },
  {
    id: "deal-won-drive",
    name: "Deal ganho → Drive",
    trigger: "Deal movido para 'Ganho'",
    action: "Criar pasta no Drive",
    description: "Ao fechar um deal, cria automaticamente uma pasta de cliente organizada no Google Drive.",
    status: "coming_soon",
    emoji: "🏆",
  },
  {
    id: "stage-change-notify",
    name: "Mudança de estágio",
    trigger: "Stage do deal alterado",
    action: "Notificar no Telegram",
    description: "Envia notificação ao grupo de vendas no Telegram quando um deal muda de estágio.",
    status: "inactive",
    emoji: "🔔",
  },
  {
    id: "task-overdue",
    name: "Tarefa vencida",
    trigger: "Tarefa atrasada há 1 dia",
    action: "Criar nova tarefa de follow-up",
    description: "Gera automaticamente uma tarefa de follow-up para tarefas que passaram da data sem conclusão.",
    status: "active",
    emoji: "⏰",
  },
  {
    id: "new-lead-qualify",
    name: "Lead novo → Qualificação IA",
    trigger: "Contato importado via webhook",
    action: "Executar score de IA",
    description: "Quando um lead chega via webhook (site, formulário), aciona imediatamente o score de qualificação por IA.",
    status: "coming_soon",
    emoji: "🤖",
  },
];

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  { id: "contact.created", name: "contact.created", description: "Novo contato adicionado ao CRM" },
  { id: "contact.updated", name: "contact.updated", description: "Dados de contato atualizados" },
  { id: "contact.scored", name: "contact.scored", description: "Score IA calculado ou recalculado" },
  { id: "deal.created", name: "deal.created", description: "Novo deal criado" },
  { id: "deal.stage_changed", name: "deal.stage_changed", description: "Deal mudou de estágio no pipeline" },
  { id: "deal.won", name: "deal.won", description: "Deal marcado como ganho" },
  { id: "deal.lost", name: "deal.lost", description: "Deal marcado como perdido" },
  { id: "task.created", name: "task.created", description: "Nova tarefa criada" },
  { id: "task.completed", name: "task.completed", description: "Tarefa concluída" },
  { id: "message.received", name: "message.received", description: "Mensagem recebida via WhatsApp/Telegram" },
];

export const DEMO_LOGS: LogEntry[] = [
  {
    id: "log-1",
    timestamp: "2026-05-14T10:42:00Z",
    integration: "WhatsApp Business",
    integrationEmoji: "💬",
    event: "message.sent",
    status: "success",
    message: "Mensagem enviada para +55 11 99999-0001",
    duration: 342,
  },
  {
    id: "log-2",
    timestamp: "2026-05-14T10:38:00Z",
    integration: "EmpresaQui",
    integrationEmoji: "🏢",
    event: "contact.enriched",
    status: "success",
    message: "CNPJ 12.345.678/0001-99 enriquecido com 14 campos",
    duration: 1240,
  },
  {
    id: "log-3",
    timestamp: "2026-05-14T10:15:00Z",
    integration: "Google Gemini",
    integrationEmoji: "✨",
    event: "image.generated",
    status: "success",
    message: "Imagem LinkedIn Post gerada (1024×1024)",
    duration: 4100,
  },
  {
    id: "log-4",
    timestamp: "2026-05-14T09:55:00Z",
    integration: "Telegram",
    integrationEmoji: "✈️",
    event: "notification.sent",
    status: "error",
    message: "Token de bot inválido ou expirado",
    duration: 120,
  },
  {
    id: "log-5",
    timestamp: "2026-05-14T09:30:00Z",
    integration: "Canva",
    integrationEmoji: "🎨",
    event: "link.generated",
    status: "success",
    message: "Link de edição de Apresentação gerado",
    duration: 280,
  },
  {
    id: "log-6",
    timestamp: "2026-05-14T09:10:00Z",
    integration: "WhatsApp Business",
    integrationEmoji: "💬",
    event: "webhook.received",
    status: "success",
    message: "Webhook recebido: novo lead de formulário do site",
    duration: 89,
  },
];

export const IMAGE_PRESETS = [
  { id: "linkedin_post", label: "Post LinkedIn", width: 1200, height: 628, style: "professional" },
  { id: "apresentacao", label: "Apresentação", width: 1280, height: 720, style: "corporate" },
  { id: "banner_site", label: "Banner Site", width: 1920, height: 600, style: "modern" },
  { id: "post_instagram", label: "Post Instagram", width: 1080, height: 1080, style: "creative" },
  { id: "capa_relatorio", label: "Capa Relatório", width: 1240, height: 1754, style: "formal" },
  { id: "personalizado", label: "Personalizado", width: 1024, height: 1024, style: "corporate" },
] as const;

export const CANVA_TEMPLATES = [
  { id: "presentation", label: "Apresentação", emoji: "📊", description: "Slides profissionais para clientes" },
  { id: "proposal", label: "Proposta Comercial", emoji: "📋", description: "Proposta tributária estruturada" },
  { id: "social_post", label: "Post Tributário", emoji: "📱", description: "Post sobre legislação e tributos" },
  { id: "report", label: "Relatório", emoji: "📈", description: "Relatório de compliance tributário" },
  { id: "flyer", label: "Panfleto", emoji: "📄", description: "Material de divulgação de serviços" },
  { id: "document", label: "Documento", emoji: "📝", description: "Documento tributário formal" },
] as const;
