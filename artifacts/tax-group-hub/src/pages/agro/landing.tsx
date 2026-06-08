import { useEffect } from "react";
import { motion } from "framer-motion";
import { AgroHeader } from "@/components/agro/agro-header";
import { AgroHero } from "@/components/agro/agro-hero";
import { AgroSection } from "@/components/agro/agro-section";
import { AgroServiceCard } from "@/components/agro/agro-service-card";
import { AgroStepCard } from "@/components/agro/agro-step-card";
import { AgroAudienceCard } from "@/components/agro/agro-audience-card";
import { AgroDifferentials } from "@/components/agro/agro-differentials";
import { AgroCtaBanner } from "@/components/agro/agro-cta-banner";
import { AgroFooter } from "@/components/agro/agro-footer";
import {
  OVERVIEW,
  SERVICE_AREAS,
  PROCESS_STEPS,
  AUDIENCES,
} from "@/lib/agro-content";
import "@/components/agro/agro-theme.css";

function AgroDivider() {
  return (
    <div className="max-w-7xl mx-auto px-6" aria-hidden="true">
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="agro-divider origin-left"
      />
    </div>
  );
}

export default function AgroLandingPage() {
  useEffect(() => {
    document.title = "JGG Agro — Hub Jurídico";
    return () => {
      document.title = "Tax Group AI Hub";
    };
  }, []);

  return (
    <div className="agro-hub min-h-screen overflow-x-hidden">
      <a
        href="#visao-geral"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Pular para o conteúdo principal
      </a>

      <AgroHeader />

      <main id="main-content">
        <AgroHero />

        <AgroDivider />

        <AgroSection id="visao-geral" title={OVERVIEW.title}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4 }}
            className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl"
          >
            {OVERVIEW.text}
          </motion.p>
        </AgroSection>

        <AgroDivider />

        <AgroSection
          id="areas-de-atuacao"
          title="Áreas de atuação"
          description="Soluções jurídicas estruturadas para cada etapa da cadeia produtiva e das operações agroindustriais."
          alt
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {SERVICE_AREAS.map((area, index) => (
              <AgroServiceCard key={area.title} area={area} index={index} />
            ))}
          </div>
        </AgroSection>

        <AgroDivider />

        <AgroSection
          id="como-atuamos"
          title="Como atuamos"
          description="Metodologia clara, do diagnóstico ao acompanhamento contínuo da sua operação."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PROCESS_STEPS.map((step, index) => (
              <AgroStepCard key={step.step} step={step} index={index} />
            ))}
          </div>
        </AgroSection>

        <AgroDivider />

        <AgroSection
          id="para-quem"
          title="Para quem é"
          description="Atendimento jurídico estratégico para diferentes perfis de atuação no agronegócio."
          alt
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {AUDIENCES.map((audience, index) => (
              <AgroAudienceCard
                key={audience.title}
                audience={audience}
                index={index}
              />
            ))}
          </div>
        </AgroSection>

        <AgroDivider />

        <AgroSection
          id="diferenciais"
          title="Diferenciais"
          description="Por que o hub Agro é uma frente jurídica à parte — com integração pontual ao tributário quando necessário."
        >
          <AgroDifferentials />
        </AgroSection>

        <AgroDivider />

        <AgroSection id="contato" title="Contato">
          <AgroCtaBanner />
        </AgroSection>
      </main>

      <AgroFooter />
    </div>
  );
}