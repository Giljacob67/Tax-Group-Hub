import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, ShieldCheck, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clearApiSession, loadApiSession, saveApiSession, type ApiAuthMode } from "@workspace/api-client-react";

const MODE_LABELS: Record<ApiAuthMode, string> = {
  bearer: "JWT / Bearer",
  "api-key": "API Key",
};

export function AuthSessionCard() {
  const { toast } = useToast();
  const [mode, setMode] = useState<ApiAuthMode>("bearer");
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = loadApiSession();
    if (session) {
      setMode(session.mode);
      setToken(session.token);
    }
    setLoaded(true);
  }, []);

  const hasSession = token.trim().length > 0;

  const handleSave = () => {
    const nextToken = token.trim();
    if (!nextToken) {
      toast({
        title: "Credencial vazia",
        description: "Informe um JWT ou API key antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    saveApiSession({
      mode,
      token: nextToken,
      savedAt: new Date().toISOString(),
    });

    toast({
      title: "Sessão salva",
      description: `Requests para /api passam a usar ${MODE_LABELS[mode]}.`,
    });
    setLoaded(true);
  };

  const handleClear = () => {
    clearApiSession();
    setToken("");
    setMode("bearer");
    toast({
      title: "Sessão removida",
      description: "O frontend volta a operar sem credenciais persistidas.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Sessão de API</h2>
          <p className="text-xs text-muted-foreground">
            Credenciais gravadas localmente no navegador e aplicadas automaticamente em requests para `/api/*`.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase">Tipo</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ApiAuthMode)}
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
          >
            <option value="bearer">JWT / Bearer</option>
            <option value="api-key">API Key</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase">Credencial</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole aqui o JWT ou a API key"
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          {loaded && hasSession ? (
            <span>
              Sessão ativa com <span className="text-foreground font-medium">{MODE_LABELS[mode]}</span>
            </span>
          ) : (
            <span>Nenhuma sessão persistida neste navegador.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Save className="w-4 h-4" />
            Salvar sessão
          </button>
        </div>
      </div>
    </motion.div>
  );
}

