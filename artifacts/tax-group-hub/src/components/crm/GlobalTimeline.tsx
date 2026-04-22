import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, PhoneCall, AtSign, MessageSquare, Calendar, StickyNote, Activity, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CompanyAvatar } from "./CompanyAvatar";

const ACTIVITY_ICONS: Record<string, any> = {
  call: PhoneCall,
  email: AtSign,
  whatsapp: MessageSquare,
  meeting: Calendar,
  note: StickyNote,
  ai_generated: Activity,
};

type GlobalActivity = {
  id: number;
  contactId: number;
  type: string;
  subject: string | null;
  content: string | null;
  createdAt: string;
  contactName: string;
  contactCnpj: string;
};

export default function GlobalTimeline() {
  const { data, isLoading } = useQuery<{ activities: GlobalActivity[] }>({
    queryKey: ["/api/crm/activities"],
    queryFn: async () => {
      const r = await fetch("/api/crm/activities");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const activities = data?.activities || [];

  return (
    <Card className="border-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Timeline Global
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Atividades recentes em todos os contatos e negócios.
        </p>
      </CardHeader>
      <CardContent className="p-4 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">Nenhuma atividade recente.</p>
            <p className="text-xs text-muted-foreground">Suas atividades aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {activities.map((a, i) => {
                const Icon = ACTIVITY_ICONS[a.type] || Clock;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-3 relative group"
                  >
                    {/* Linha conectora */}
                    {i !== activities.length - 1 && (
                      <div className="absolute left-4 top-8 bottom-[-16px] w-px bg-border/50 group-hover:bg-primary/20 transition-colors" />
                    )}

                    {/* Ícone */}
                    <div className="relative z-10 w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border-2 border-background shadow-sm">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 bg-card border border-border/40 rounded-xl p-3 shadow-sm hover:border-primary/30 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <CompanyAvatar name={a.contactName} className="w-4 h-4 rounded-full text-[8px]" />
                          <span className="text-xs font-semibold">{a.contactName}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-foreground/90">{a.subject || a.type}</div>
                      {a.content && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {a.content}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
