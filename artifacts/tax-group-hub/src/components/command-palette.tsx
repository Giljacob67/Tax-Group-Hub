import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Users,
  Bot,
  BookOpen,
  Settings,
  Zap,
  BarChart3,
  ShieldCheck,
  FileText,
  Settings2,
  LogOut,
  Sun,
  Moon,
  ArrowRight,
  Command,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useListAgents } from "@workspace/api-client-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
  group: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const { logout } = useAuth();
  const { data: agentsData } = useListAgents();

  const agents = agentsData?.agents ?? [];

  const items: CommandItem[] = useMemo(() => {
    const navItems: CommandItem[] = [
      {
        id: "command-center",
        label: "Command Center",
        description: "Dashboard principal",
        icon: LayoutDashboard,
        action: () => navigate("/command-center"),
        keywords: ["dashboard", "home", "centro", "comando"],
        group: "Navegação",
      },
      {
        id: "crm",
        label: "CRM & Pipeline",
        description: "Gerenciar contatos e negócios",
        icon: Users,
        action: () => navigate("/crm"),
        keywords: ["contatos", "pipeline", "leads", "empresas"],
        group: "Navegação",
      },
      {
        id: "agentes",
        label: "Agentes",
        description: "Conversar com agentes de IA",
        icon: Bot,
        action: () => navigate("/agent/coordenador-geral-tax-group"),
        keywords: ["chat", "ia", "agente", "coordenador"],
        group: "Navegação",
      },
      {
        id: "automations",
        label: "Campanhas",
        description: "Sequências e automações",
        icon: Zap,
        action: () => navigate("/automations"),
        keywords: ["sequencias", "automações", "campanhas", "broadcast"],
        group: "Navegação",
      },
      {
        id: "knowledge",
        label: "Base de Conhecimento",
        description: "Documentos e indexação",
        icon: BookOpen,
        action: () => navigate("/knowledge"),
        keywords: ["documentos", "base", "conhecimento", "indexação"],
        group: "Navegação",
      },
      {
        id: "analytics",
        label: "Analytics",
        description: "Métricas de uso de IA",
        icon: BarChart3,
        action: () => navigate("/analytics"),
        keywords: ["métricas", "analytics", "uso", "custo"],
        group: "Navegação",
      },
      {
        id: "ai-quality",
        label: "Qualidade IA",
        description: "Testes e monitoramento",
        icon: ShieldCheck,
        action: () => navigate("/ai-quality"),
        keywords: ["qualidade", "testes", "feedback"],
        group: "Navegação",
      },
      {
        id: "deliverables",
        label: "Entregáveis",
        description: "Diagnósticos e propostas",
        icon: FileText,
        action: () => navigate("/deliverables"),
        keywords: ["entregáveis", "propostas", "diagnósticos"],
        group: "Navegação",
      },
      {
        id: "integrations",
        label: "Integrações",
        description: "HubSpot, Make, webhooks",
        icon: Settings2,
        action: () => navigate("/integrations"),
        keywords: ["integrações", "hubspot", "make", "webhooks"],
        group: "Navegação",
      },
      {
        id: "settings",
        label: "Configurações",
        description: "IA, WhatsApp, identidade",
        icon: Settings,
        action: () => navigate("/settings"),
        keywords: ["configurações", "settings", "whatsapp", "identidade"],
        group: "Navegação",
      },
    ];

    const agentItems: CommandItem[] = agents.slice(0, 10).map((agent) => ({
      id: `agent-${agent.id}`,
      label: agent.name,
      description: agent.blockLabel || "Agente",
      icon: Bot,
      action: () => navigate(`/agent/${agent.id}`),
      keywords: [agent.name.toLowerCase(), agent.block?.toLowerCase()],
      group: "Agentes",
    }));

    const actionItems: CommandItem[] = [
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Modo claro" : "Modo escuro",
        description: "Alternar tema",
        icon: theme === "dark" ? Sun : Moon,
        action: () => toggleTheme(),
        keywords: ["tema", "theme", "claro", "escuro", "dark", "light"],
        group: "Ações",
      },
      {
        id: "logout",
        label: "Sair",
        description: "Encerrar sessão",
        icon: LogOut,
        action: () => logout(),
        keywords: ["sair", "logout", "encerrar"],
        group: "Ações",
      },
    ];

    return [...navItems, ...agentItems, ...actionItems];
  }, [agents, navigate, theme, toggleTheme, logout]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k?.includes(q)),
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [filtered]);

  const flatFiltered = useMemo(() => Object.values(grouped).flat(), [grouped]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.action();
      setIsOpen(false);
      setQuery("");
      setSelectedIndex(0);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        setSelectedIndex(0);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatFiltered[selectedIndex]) {
          handleSelect(flatFiltered[selectedIndex]);
        }
      }
    },
    [isOpen, flatFiltered, selectedIndex, handleSelect],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false);
          setQuery("");
          setSelectedIndex(0);
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Buscar páginas, agentes, ações..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto py-2">
            {flatFiltered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum resultado para "{query}"
              </div>
            ) : (
              Object.entries(grouped).map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupName}
                  </div>
                  {groupItems.map((item) => {
                    const idx = globalIndex++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <item.icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isSelected ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">↵</kbd>
              selecionar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">esc</kbd>
              fechar
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
