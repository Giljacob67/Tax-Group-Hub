export function CompanyAvatar({
  name,
  size = "md",
  className,
}: {
  name: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const colors = [
    "from-green-700 to-green-500",
    "from-teal-700 to-teal-500",
    "from-slate-600 to-slate-400",
    "from-stone-600 to-stone-400",
    "from-green-800 to-green-600",
    "from-cyan-800 to-cyan-600",
  ];
  const color = colors[(name || "").charCodeAt(0) % colors.length];
  const sz =
    size === "sm"
      ? "w-8 h-8 text-xs"
      : size === "lg"
        ? "w-14 h-14 text-xl"
        : "w-10 h-10 text-sm";

  return (
    <div
      className={`${sz} rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 font-bold text-white shadow-sm ${className || ""}`}
    >
      {initials}
    </div>
  );
}
