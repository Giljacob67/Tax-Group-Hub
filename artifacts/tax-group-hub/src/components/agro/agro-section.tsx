import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AgroSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  alt?: boolean;
}

export function AgroSection({
  id,
  title,
  description,
  children,
  className,
  alt = false,
}: AgroSectionProps) {
  return (
    <section
      id={id}
      className={cn(alt && "agro-section-alt", className)}
      aria-labelledby={`${id}-heading`}
    >
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="mb-10 md:mb-12"
        >
          <h2
            id={`${id}-heading`}
            className="text-xl md:text-2xl font-bold tracking-tight text-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </motion.div>
        {children}
      </div>
    </section>
  );
}