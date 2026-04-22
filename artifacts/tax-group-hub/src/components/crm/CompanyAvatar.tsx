export function CompanyAvatar({ name, size = "md", className }: { name: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const colors = [
    "from-blue-600 to-blue-400", "from-emerald-600 to-emerald-400",
    "from-purple-600 to-purple-400", "from-amber-600 to-amber-400",
    "from-pink-600 to-pink-400", "from-cyan-600 to-cyan-400",
  ];
  const color = colors[(name || "").charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
  
  return (
    <div className={`${sz} rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 font-bold text-white shadow-sm ${className || ""}`}>
      {initials}
    </div>
  );
}
