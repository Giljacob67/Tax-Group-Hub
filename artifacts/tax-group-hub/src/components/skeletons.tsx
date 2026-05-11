import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for a single metric card in the dashboard */
export function SkeletonMetric() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex flex-col gap-2">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <Skeleton className="w-16 h-7" />
      <Skeleton className="w-full h-3" />
    </div>
  );
}

/** Skeleton for the metrics grid (6 items) */
export function SkeletonMetricsGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonMetric key={i} />
      ))}
    </div>
  );
}

/** Skeleton for an agent block card */
export function SkeletonAgentBlock() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="w-32 h-4 rounded" />
        </div>
        <Skeleton className="w-8 h-5 rounded-full" />
      </div>
      <Skeleton className="w-full h-3 mb-4" />
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="w-full h-8 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the agent blocks grid */
export function SkeletonAgentBlocks() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonAgentBlock key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a chat message bubble */
export function SkeletonChatMessage({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className={`space-y-2 max-w-[80%] ${isUser ? "items-end flex flex-col" : ""}`}>
        <Skeleton className="w-24 h-3" />
        <Skeleton className="w-64 h-16 rounded-2xl" />
      </div>
    </div>
  );
}

/** Skeleton for the chat main area */
export function SkeletonChat() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-4">
      <SkeletonChatMessage />
      <SkeletonChatMessage isUser />
      <SkeletonChatMessage />
    </div>
  );
}

/** Skeleton for a conversation item in the sidebar */
export function SkeletonConversationItem() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Skeleton className="w-4 h-4 rounded-full" />
      <div className="flex-1 min-w-0 space-y-1">
        <Skeleton className="w-full h-3" />
        <Skeleton className="w-16 h-2" />
      </div>
    </div>
  );
}

/** Skeleton for the chat sidebar conversations list */
export function SkeletonChatSidebar() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonConversationItem key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a settings section / form */
export function SkeletonSettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Skeleton className="w-48 h-6" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-full h-10 rounded-lg" />
          </div>
        ))}
      </div>
      <Skeleton className="w-32 h-9 rounded-lg" />
    </div>
  );
}

/** Skeleton for a table row */
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border/30">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 rounded" style={{ width: `${20 + Math.random() * 40}%` }} />
      ))}
    </div>
  );
}

/** Skeleton for a generic list */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="w-full h-12 rounded-lg" />
      ))}
    </div>
  );
}
