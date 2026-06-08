import type { LucideIcon } from "lucide-react";
import {
  FileText,
  MapPin,
  Landmark,
  CreditCard,
  Leaf,
  Scale,
  Gavel,
  Building2,
  Search,
  ShieldAlert,
  Layers,
  FileCheck,
  RefreshCw,
  Users,
  Factory,
  Handshake,
  TrendingUp,
  Wheat,
  Eye,
  MessageSquare,
  Network,
  Link2,
} from "lucide-react";

export const AGRO_CONTACT_EMAIL = "agro@jgglegal.com.br";

export const agroContactMailto = `mailto:${AGRO_CONTACT_EMAIL}?subject=${encodeURIComponent("Contato Hub Agro")}`;

export const HERO = {
  title: "Estratégia jurídica para o agronegócio, do campo ao mercado.",
  subtitle:
    "Atuação integrada em contratos, regularização, estruturação patrimonial, sucessão, crédito rural, questões ambientais, tributárias e disputas envolvendo operações do agro.",
  primaryCta: "Falar com o time Agro",
  secondaryCta: "Ver áreas de atuação",
};

export const OVERVIEW = {
  title: "Visão geral",
  text: "O agronegócio exige decisões rápidas, contratos sólidos e segurança jurídica em toda a cadeia produtiva. O hub Agro reúne soluções jurídicas para produtores, grupos familiares, empresas rurais, cooperativas, tradings, investidores e operações agroindustriais.",
};

export type ServiceArea = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const SERVICE_AREAS: ServiceArea[] = [
  {
    title: "Contratos agrários e comerciais",
    description:
      "Estruturação, revisão e negociação de contratos de arrendamento, parceria, compra e venda e operações comerciais.",
    icon: FileText,
  },
  {
    title: "Regularização de imóveis rurais",
    description:
      "Suporte em titularidade, georreferenciamento, CAR, SIGEF e conformidade documental de propriedades.",
    icon: MapPin,
  },
  {
    title: "Planejamento patrimonial e sucessório",
    description:
      "Organização de patrimônio rural, governança familiar e transição entre gerações com segurança jurídica.",
    icon: Landmark,
  },
  {
    title: "Crédito rural, garantias e renegociação",
    description:
      "Análise de contratos de crédito, garantias reais, renegociações e estruturação de operações financeiras.",
    icon: CreditCard,
  },
  {
    title: "Ambiental, licenciamento e compliance rural",
    description:
      "Acompanhamento em licenciamentos, obrigações ambientais, passivos e conformidade regulatória no campo.",
    icon: Leaf,
  },
  {
    title: "Tributário aplicado ao agro",
    description:
      "Orientação em regimes, benefícios e obrigações fiscais específicas das operações do agronegócio.",
    icon: Scale,
  },
  {
    title: "Contencioso estratégico e disputas rurais",
    description:
      "Condução de litígios, mediação e estratégias preventivas em conflitos envolvendo propriedades e contratos.",
    icon: Gavel,
  },
  {
    title: "Operações societárias e reorganizações",
    description:
      "Constituição, reorganização e estruturação societária de empresas rurais, holdings e grupos agroindustriais.",
    icon: Building2,
  },
];

export type ProcessStep = {
  step: number;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const PROCESS_STEPS: ProcessStep[] = [
  {
    step: 1,
    title: "Diagnóstico jurídico e operacional",
    description:
      "Levantamento da situação atual da operação, documentos e objetivos de negócio.",
    icon: Search,
  },
  {
    step: 2,
    title: "Mapeamento de riscos",
    description:
      "Identificação de vulnerabilidades contratuais, regulatórias, patrimoniais e contenciosas.",
    icon: ShieldAlert,
  },
  {
    step: 3,
    title: "Estruturação da solução",
    description:
      "Definição do caminho jurídico mais adequado, com clareza de prazos, custos e impactos.",
    icon: Layers,
  },
  {
    step: 4,
    title: "Implementação documental e negocial",
    description:
      "Elaboração de instrumentos, negociação com contrapartes e formalização das decisões.",
    icon: FileCheck,
  },
  {
    step: 5,
    title: "Acompanhamento contínuo",
    description:
      "Monitoramento da operação, ajustes e suporte para novas etapas de crescimento.",
    icon: RefreshCw,
  },
];

export type Audience = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const AUDIENCES: Audience[] = [
  {
    title: "Produtores rurais",
    description:
      "Segurança jurídica para decisões de produção, contratos e patrimônio no campo.",
    icon: Wheat,
  },
  {
    title: "Famílias empresárias do agro",
    description:
      "Governança, sucessão e proteção patrimonial em operações familiares de longo prazo.",
    icon: Users,
  },
  {
    title: "Empresas agroindustriais",
    description:
      "Suporte em contratos, compliance e estruturas para operações industriais e logísticas.",
    icon: Factory,
  },
  {
    title: "Cooperativas",
    description:
      "Assessoria em relações com associados, contratos coletivos e conformidade regulatória.",
    icon: Handshake,
  },
  {
    title: "Investidores e fundos",
    description:
      "Due diligence, estruturação de aportes e proteção jurídica em operações de investimento.",
    icon: TrendingUp,
  },
  {
    title: "Tradings e compradores",
    description:
      "Contratos comerciais, gestão de riscos e suporte em operações de compra e venda de commodities.",
    icon: Building2,
  },
];

export type Differential = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const DIFFERENTIALS: Differential[] = [
  {
    title: "Visão integrada entre jurídico, negócio e patrimônio",
    description:
      "Decisões alinhadas à realidade operacional, não apenas à letra da norma.",
    icon: Eye,
  },
  {
    title: "Atuação preventiva e contenciosa",
    description:
      "Estruturação antecipada e condução estratégica quando o conflito é inevitável.",
    icon: ShieldAlert,
  },
  {
    title: "Experiência em estruturas complexas",
    description:
      "Operações com múltiplas propriedades, sócios, garantias e cadeias contratuais.",
    icon: Network,
  },
  {
    title: "Comunicação objetiva para tomada de decisão",
    description:
      "Informação clara, sem jargão excessivo, para quem precisa decidir com rapidez.",
    icon: MessageSquare,
  },
  {
    title: "Integração com a frente tributária quando necessário",
    description:
      "Articulação com o hub tributário em temas fiscais, mantendo cada frente com identidade e escopo próprios.",
    icon: Link2,
  },
];

export const FINAL_CTA = {
  title: "Construa segurança jurídica para a próxima etapa do seu negócio no agro.",
  text: "Converse com nosso time para avaliar riscos, oportunidades e caminhos práticos para sua operação.",
  button: "Falar com o time Agro",
};

export const NAV_LINKS = [
  { label: "Visão geral", href: "#visao-geral" },
  { label: "Áreas de atuação", href: "#areas-de-atuacao" },
  { label: "Como atuamos", href: "#como-atuamos" },
  { label: "Para quem é", href: "#para-quem" },
  { label: "Contato", href: "#contato" },
] as const;