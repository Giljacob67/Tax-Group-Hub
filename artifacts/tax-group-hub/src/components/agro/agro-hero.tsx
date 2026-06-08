import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO, agroContactMailto } from "@/lib/agro-content";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

export function AgroHero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="agro-hero-heading">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,hsl(155_42%_22%/0.07),transparent)]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_90%_80%,hsl(38_48%_52%/0.05),transparent)]" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 relative">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="max-w-3xl"
        >
          <motion.div variants={itemVariants} className="mb-5">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary/80">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              JGG Agro — Hub Jurídico
            </span>
          </motion.div>

          <motion.h1
            id="agro-hero-heading"
            variants={itemVariants}
            className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.15]"
          >
            {HERO.title}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-base md:text-lg text-muted-foreground mt-5 leading-relaxed max-w-2xl"
          >
            {HERO.subtitle}
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-8"
          >
            <Button size="lg" asChild className="rounded-xl shadow-md">
              <a href={agroContactMailto}>
                {HERO.primaryCta}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild className="rounded-xl">
              <a href="#areas-de-atuacao">
                {HERO.secondaryCta}
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}