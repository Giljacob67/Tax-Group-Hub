import { Wrench, Braces, Eye, Maximize2 } from "lucide-react";

interface CapabilityBadgeProps {
  type: "tools" | "json" | "vision" | "context";
  value?: string | number | boolean;
  className?: string;
}

const CONFIG = {
  tools: { icon: Wrench, label: "Tools", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  json: { icon: Braces, label: "JSON", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  vision: { icon: Eye, label: "Vision", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  context: { icon: Maximize2, label: "Contexto", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export function CapabilityBadge({ type, value, className = "" }: CapabilityBadgeProps) {
  const cfg = CONFIG[type];
  const Icon = cfg.icon;
  const showValue = value !== undefined && value !== false && value !== 0;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.color} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
      {showValue && <span className="opacity-70">· {value}</span>}
    </span>
  );
}
