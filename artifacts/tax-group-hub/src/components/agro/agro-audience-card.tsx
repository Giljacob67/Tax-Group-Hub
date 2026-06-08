import { motion } from "framer-motion";
import type { Audience } from "@/lib/agro-content";

interface AgroAudienceCardProps {
  audience: Audience;
  index: number;
}

export function AgroAudienceCard({ audience, index }: AgroAudienceCardProps) {
  const Icon = audience.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="rounded-xl border border-border bg-card p-5 md:p-6 hover:border-primary/25 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-lg bg-accent/12 flex items-center justify-center ring-1 ring-accent/20 shrink-0"
          aria-hidden="true"
        >
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{audience.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">
            {audience.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}