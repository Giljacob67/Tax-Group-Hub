import { Link, useLocation } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Crown,
  FileText,
  Flame,
  Globe,
  Layers,
  Lightbulb,
  Megaphone,
  MessageSquare,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Zap,
  Compass,
  Crosshair,
  Handshake,
  Route,
  Sparkles,
  Cpu,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

function AnimatedDivider() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-px bg-gradient-to-r from-transparent via-border to-transparent origin-left"
      />
    </div>
  );
}

const VALUE_CARDS = [
  {
    icon: Target,
    title: "Empresas-alvo priorizadas",
    description:
      "Mapeamento de CNPJs, segmentos e regimes tributários com pontuação inteligente.",
  },
  {
    icon: Bot,
    title: "Agentes especializados por etapa",
    description:
      "Estratégia, prospecção, diagnóstico, marketing e gestão operacional automatizados.",
  },
  {
    icon: BarChart3,
    title: "Pipeline tributário orientado por dados",
    description:
      "Acompanhamento visual de oportunidades desde a descoberta até o contrato.",
  },
  {
    icon: BookOpen,
    title: "Base de conhecimento conectada",
    description:
      "Legislação, pareceres e modelos alimentam respostas precisas dos agentes.",
  },
  {
    icon: FileText,
    title: "Diagnósticos e propostas com rastreabilidade",
    description:
      "Cada etapa documentada, desde o primeiro contato até a proposta formal.",
  },
  {
    icon: ShieldCheck,
    title: "Execução comercial com método",
    description:
      "Campanhas, follow-up e automações que mantêm o pipeline sempre em movimento.",
  },
];

const JOURNEY_STEPS = [
  {
    step: 1,
    icon: Compass,
    title: "Mapear empresas-alvo",
    description:
      "Centralize CNPJs, segmentos, regimes e sinais de oportunidade tributária.",
  },
  {
    step: 2,
    icon: Lightbulb,
    title: "Priorizar com inteligência tributária",
    description:
      "Use score IA, contexto fiscal e potencial comercial para ordenar as melhores contas.",
  },
  {
    step: 3,
    icon: Rocket,
    title: "Acionar agentes especializados",
    description:
      "Distribua tarefas para agentes de prospecção, diagnóstico, proposta, marketing e follow-up.",
  },
  {
    step: 4,
    icon: Handshake,
    title: "Converter em contrato",
    description:
      "Acompanhe o pipeline até diagnóstico, proposta, negociação e fechamento.",
  },
];

const AGENT_BLOCKS = [
  {
    id: "estrategia",
    title: "Estratégia e Inteligência",
    icon: Crown,
    desc: "Orquestra campanhas, define prioridades e distribui tarefas estratégicas.",
  },
  {
    id: "prospeccao",
    title: "Prospecção Comercial",
    icon: Briefcase,
    desc: "Abordagem, qualificação, deals e follow-up comercial contínuo.",
  },
  {
    id: "diagnostico",
    title: "Diagnóstico Tributário",
    icon: Search,
    desc: "Análise fiscal profunda, identificação de créditos e oportunidades de economia.",
  },
  {
    id: "marketing",
    title: "Marketing e Conteúdo",
    icon: Megaphone,
    desc: "LinkedIn, e-mail, vídeo, WhatsApp e calendário editorial automatizado.",
  },
  {
    id: "gestao",
    title: "Gestão e Operação Interna",
    icon: Settings2,
    desc: "Pipeline, propostas, relatórios, treinamento e operação do escritório.",
  },
];

const FLOW_STEPS = [
  {
    icon: Building2,
    label: "Empresa-alvo",
    desc: "Mapeamento e enriquecimento",
  },
  { icon: TrendingUp, label: "Score IA", desc: "Priorização inteligente" },
  { icon: Search, label: "Diagnóstico", desc: "Análise tributária profunda" },
  { icon: FileText, label: "Proposta", desc: "Documentação e apresentação" },
  {
    icon: MessageSquare,
    label: "Follow-up",
    desc: "Nurturing e acompanhamento",
  },
  { icon: CheckCircle2, label: "Contrato", desc: "Fechamento e ativação" },
];

export default function LandingPage() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 80]);
  const { branding } = useBranding();
  const logoUrl = branding.logoStorageKey
    ? `/uploads/${branding.logoStorageKey}`
    : `${import.meta.env.BASE_URL}images/logo-x-branco.svg`;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
              <img
                src={logoUrl}
                alt={branding.companyName}
                className="w-5 h-5 object-contain"
              />
            </div>
            <span className="font-bold text-sm tracking-tight">
              {branding.companyName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/?demo=1">
              <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
                Modo demo
              </button>
            </Link>
            <Link href="/command-center">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                Entrar no Command Center <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,hsl(200_76%_41%/0.08),transparent)]"
          style={{ y: heroY }}
        />
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 relative">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="max-w-3xl"
          >
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-2 mb-5"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">
                Plataforma operacional da Tax Group
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.15]"
            >
              Inteligência tributária operacional para transformar dados em
              oportunidades, diagnósticos e contratos.
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-base md:text-lg text-muted-foreground mt-5 leading-relaxed max-w-2xl"
            >
              O Tax Group Command Center conecta CRM, agentes de IA, automações
              e base de conhecimento para priorizar empresas, acionar
              especialistas e conduzir o pipeline comercial com método.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-8"
            >
              <Link href="/command-center">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/10">
                  <Target className="w-4 h-4" />
                  Entrar no Command Center
                </button>
              </Link>
              <Link href="/?demo=1">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted transition-colors">
                  <Sparkles className="w-4 h-4" />
                  Iniciar modo demo
                </button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <AnimatedDivider />
      {/* ── Cards de Valor ── */}
      <section>
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              O que o Command Center entrega
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Uma operação comercial tributária integrada, da prospecção ao
              contrato.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {VALUE_CARDS.map((card) => (
              <motion.div
                key={card.title}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-primary/20">
                  <card.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">
                  {card.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <AnimatedDivider />
      {/* ── Como o hub gera valor ── */}
      <section className="bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-3">
              <Route className="w-4 h-4 text-primary" />
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                Como o hub gera valor
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Da empresa-alvo ao contrato: quatro etapas que transformam dados
              em receita tributária.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {JOURNEY_STEPS.map((s, idx) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="relative"
              >
                <div className="rounded-xl border border-border bg-card p-5 h-full hover:border-primary/30 transition-colors hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                      <s.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-[11px] font-bold text-primary/70 uppercase tracking-wider">
                      Passo {s.step}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1.5">
                    {s.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>
                {idx < JOURNEY_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px bg-border" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <AnimatedDivider />
      {/* ── Fluxo da operação ── */}
      <section>
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Fluxo da operação
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Cada etapa do funil comercial tributário, com rastreabilidade e
              automação.
            </p>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-3 lg:gap-0">
            {FLOW_STEPS.map((step, idx) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: idx * 0.06 }}
                whileHover={{ scale: 1.01 }}
                className="flex-1 flex items-center gap-3"
              >
                <div className="flex-1 rounded-xl border border-border bg-card p-4 flex items-center gap-3 hover:border-primary/30 transition-colors hover:shadow-lg hover:shadow-primary/5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
                    <step.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {step.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {step.desc}
                    </div>
                  </div>
                </div>
                {idx < FLOW_STEPS.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center px-1">
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <AnimatedDivider />
      {/* ── Agentes especializados ── */}
      <section className="bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Agentes especializados
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Capacidades organizadas por função, cada uma com objetivo claro e
              domínio específico.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
          >
            {AGENT_BLOCKS.map((block) => (
              <motion.div
                key={block.id}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-primary/20">
                  <block.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">
                  {block.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {block.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <AnimatedDivider />
      {/* ── CTA Final ── */}
      <section>
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5 ring-1 ring-primary/20">
              <Rocket className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Pronto para operar com inteligência tributária?
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mt-3 leading-relaxed">
              Acesse o Command Center para visualizar oportunidades, acionar
              agentes e acompanhar o pipeline comercial da Tax Group.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-8">
              <Link href="/command-center">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/10">
                  <Target className="w-4 h-4" />
                  Entrar no Command Center
                </button>
              </Link>
              <Link href="/?demo=1">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted transition-colors">
                  <Sparkles className="w-4 h-4" />
                  Iniciar modo demo
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <AnimatedDivider />
      {/* ── Rodapé ── */}
      <footer className="bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center">
              <img
                src={logoUrl}
                alt={branding.companyName}
                className="w-3.5 h-3.5 object-contain"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {branding.companyName} — Plataforma operacional interna.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              Ambiente autorizado
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3" />
              Command Center
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
