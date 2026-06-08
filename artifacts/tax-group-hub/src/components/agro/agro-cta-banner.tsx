import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINAL_CTA, agroContactMailto } from "@/lib/agro-content";

export function AgroCtaBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-8 md:p-12 text-center"
    >
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground max-w-2xl mx-auto">
        {FINAL_CTA.title}
      </h2>
      <p className="text-sm md:text-base text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
        {FINAL_CTA.text}
      </p>
      <div className="mt-8">
        <Button size="lg" asChild className="rounded-xl">
          <a href={agroContactMailto}>
            {FINAL_CTA.button}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </motion.div>
  );
}