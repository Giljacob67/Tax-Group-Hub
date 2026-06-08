import { motion } from "framer-motion";
import type { ProcessStep } from "@/lib/agro-content";

interface AgroStepCardProps {
  step: ProcessStep;
  index: number;
}

export function AgroStepCard({ step, index }: AgroStepCardProps) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="relative"
    >
      <div className="rounded-xl border border-border bg-card p-5 md:p-6 h-full hover:border-primary/25 transition-colors">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/15 shrink-0"
            aria-hidden="true"
          >
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-[11px] font-bold text-primary/70 uppercase tracking-wider">
            Etapa {step.step}
          </span>
        </div>
        <h3 className="text-sm font-bold text-foreground mb-2">{step.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}