import { motion } from "framer-motion";
import type { ServiceArea } from "@/lib/agro-content";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface AgroServiceCardProps {
  area: ServiceArea;
  index: number;
}

export function AgroServiceCard({ area, index }: AgroServiceCardProps) {
  const Icon = area.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Card className="h-full border-border/80 hover:border-primary/30 transition-colors hover:shadow-md">
        <CardHeader className="p-6">
          <div
            className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-primary/15"
            aria-hidden="true"
          >
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-sm font-bold leading-snug">
            {area.title}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed mt-2">
            {area.description}
          </CardDescription>
        </CardHeader>
      </Card>
    </motion.div>
  );
}