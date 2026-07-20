import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Zap,
  BookOpen,
  Settings,
  MessageCircle,
  Crown,
  Briefcase,
  Megaphone,
  Settings2,
  ChevronRight,
  Loader2,
  Search,
  X,
  Bot,
  BarChart3,
  ShieldCheck,
  FileText,
  Sun,
  Moon,
  HelpCircle,
  Flame,
  Clock,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useListAgents,
  useListCrmContacts,
  useListCrmTasks,
} from "@workspace/api-client-react";
import { useState, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBranding } from "../contexts/BrandingContext";
import { useGetCrmMe } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, UserCog, Shield } from "lucide-react";
import { withBasePath } from "@/lib/utils";

const BLOCKS = [
  {
    id: "estrategia",
    label: "Estratégia e Inteligência",
    icon: Crown,
    color: "text-muted-foreground",
  },
  {
    id: "prospeccao",
    label: "Prospecção Comercial",
    icon: Briefcase,
    color: "text-muted-foreground",
  },
  {
    id: "marketing",
    label: "Agência Virtual de Marketing",
    icon: Megaphone,
    color: "text-muted-foreground",
  },
  {
    id: "gestao",
    label: "Gestão e Operação Interna",
    icon: Settings2,
    color: "text-muted-foreground",
  },
];

const NAV_GROUPS = [
  {
    id: "comercial",
    label: "Comercial",
    items: [
      {
        path: "/command-center",
        label: "Command Center",
        icon: LayoutDashboard,
        color: "text-primary",
      },
      {
        path: "/crm",
        label: "CRM & Pipeline",
        icon: Users,
        color: "text-muted-foreground",
      },
      {
        path: "/agent/coordenador-geral-tax-group",
        label: "Agentes",
        icon: Bot,
        color: "text-muted-foreground",
      },
      {
        path: "/automations",
        label: "Campanhas",
        icon: Zap,
        color: "text-muted-foreground",
      },
      {
        path: "/deliverables",
        label: "Entregáveis",
        icon: FileText,
        color: "text-muted-foreground",
      },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      {
        path: "/knowledge",
        label: "Base de Conhecimento",
        icon: BookOpen,
        color: "text-muted-foreground",
      },
      {
        path: "/analytics",
        label: "Métricas de IA",
        icon: BarChart3,
        color: "text-muted-foreground",
      },
      {
        path: "/ai-quality",
        label: "Qualidade IA",
        icon: ShieldCheck,
        color: "text-muted-foreground",
      },
      {
        path: "/integrations",
        label: "Integrações",
        icon: Settings2,
        color: "text-muted-foreground",
      },
    ],
  },
];

const FOOTER_ITEMS = [
  {
    path: "/settings",
    label: "Configurações",
    icon: Settings,
    color: "text-muted-foreground",
  },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { data, isLoading } = useListAgents();
  const { branding } = useBranding();
  const { open } = useSidebar();
  const [search, setSearch] = useState("");
  const { theme, toggle } = useTheme();
  const { data: userData } = useGetCrmMe();
  const { logout, user, isAdmin } = useAuth();

  // Notification data
  const { data: contactsData } = useListCrmContacts({ limit: 1000 }, {
    query: { staleTime: 60_000 },
  } as any);
  const { data: tasksData } = useListCrmTasks({ status: "pending" }, {
    query: { staleTime: 30_000 },
  } as any);

  const hotLeadsCount = useMemo(() => {
    const contacts = contactsData?.contacts ?? [];
    return contacts.filter((c: any) => (c.aiScore ?? 0) >= 70).length;
  }, [contactsData]);

  const overdueTasksCount = useMemo(() => {
    const tasks = tasksData?.tasks ?? [];
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) <= now).length;
  }, [tasksData]);

  const logoUrl = branding.logoStorageKey
    ? withBasePath(`/uploads/${branding.logoStorageKey}`)
    : withBasePath("/images/logo-x-branco.svg");

  const filteredAgents = useMemo(() => {
    if (!search.trim() || !data?.agents) return null;
    const lowerSearch = search.toLowerCase();
    return data.agents.filter(
      (a) =>
        a.name.toLowerCase().includes(lowerSearch) ||
        (a.description || "").toLowerCase().includes(lowerSearch),
    );
  }, [search, data?.agents]);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 bg-background/50 backdrop-blur-xl"
      data-tour="sidebar"
    >
      {/* ── Header ───────────────────────────── */}
      <SidebarHeader className="px-3 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-8 h-8 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center flex-shrink-0">
            <img
              src={logoUrl}
              alt={branding.companyName}
              className="w-5 h-5 object-contain"
            />
          </div>

          {/* Name — only when expanded */}
          {open && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-foreground truncate">
                {branding.companyName}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
                Centro de Comando
              </div>
            </div>
          )}

          {/* Toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger className="h-7 w-7 flex-shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="right">
              {open ? "Recolher" : "Expandir"} menu
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      {/* ── Search (expanded only) ─────────── */}
      {open && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar agente ou função..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-muted/40 border border-border/40 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
              aria-label="Buscar agente ou função"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content ───────────────────────── */}
      <SidebarContent className="px-2 py-2">
        {/* Main nav — grouped by role */}
        {NAV_GROUPS.map((group) => (
        <SidebarGroup key={group.id}>
          {open && (
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                // Calculate badge for specific items
                let badge = null;
                if (item.path === "/crm" && hotLeadsCount > 0) {
                  badge = { count: hotLeadsCount, icon: Flame, color: "text-orange-400" };
                } else if (item.path === "/automations" && overdueTasksCount > 0) {
                  badge = { count: overdueTasksCount, icon: Clock, color: "text-amber-400" };
                }

                return (
                  <SidebarMenuItem key={item.path}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={
                            item.path === "/command-center"
                              ? location === "/command-center"
                              : location.startsWith(item.path)
                          }
                          onClick={() => navigate(item.path)}
                          className="cursor-pointer"
                        >
                          <item.icon
                            className={`w-4 h-4 flex-shrink-0 ${item.color}`}
                          />
                          <span className="font-medium flex-1">{item.label}</span>
                          {badge && open && (
                            <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted/80 ${badge.color}`}>
                              <badge.icon className="w-2.5 h-2.5" />
                              {badge.count}
                            </span>
                          )}
                          {badge && !open && (
                            <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full bg-muted/80 flex items-center justify-center text-[9px] font-bold ${badge.color}`}>
                              {badge.count}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {!open && (
                        <TooltipContent side="right">
                          {item.label}
                          {badge && ` — ${badge.count} pendente(s)`}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        ))}

        {/* Agent list — only when expanded */}
        {open && (
          <>
            {/* Agent guide */}
            <SidebarGroup className="mt-2 mb-1">
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <HelpCircle className="w-3 h-3" />
                Qual agente usar?
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors">
                      Ver guia rápido
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 ml-2" align="start">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-primary" />
                        Qual agente usar?
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Acabei de receber um lead</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/diagnostico-cnpj-tax-group")} className="text-primary hover:underline">Diagnóstico CNPJ</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Vou fazer o primeiro contato</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/prospeccao-tax-group")} className="text-primary hover:underline">Prospecção Comercial</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Cliente fez uma objeção</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/objecoes-tax-group")} className="text-primary hover:underline">Reversão de Objeções</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Cliente não respondeu</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/followup-tax-group")} className="text-primary hover:underline">Follow-Up</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Preciso preparar uma reunião</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/roteiro-reuniao-tax-group")} className="text-primary hover:underline">Roteiro de Reunião</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </SidebarGroupContent>
            </SidebarGroup>

            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : filteredAgents ? (
              <SidebarGroup className="mt-2">
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Resultados ({filteredAgents.length})
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredAgents.map((agent) => {
                      const isActive = location.startsWith(
                        `/agent/${agent.id}`,
                      );
                      const block = BLOCKS.find((b) => b.id === agent.block);
                      return (
                        <SidebarMenuItem key={agent.id}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => navigate(`/agent/${agent.id}`)}
                            className="cursor-pointer"
                          >
                            <MessageCircle
                              className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                            />
                            <span className="truncate flex-1 text-xs">
                              {agent.name}
                            </span>
                            {block && (
                              <span
                                className={`text-[11px] flex-shrink-0 ${block.color}`}
                              >
                                {block.label}
                              </span>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                    {filteredAgents.length === 0 && (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        Nenhum agente encontrado
                      </div>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              BLOCKS.map((block) => {
                const blockAgents =
                  data?.agents?.filter((a) => a.block === block.id) || [];
                if (blockAgents.length === 0) return null;
                return (
                  <SidebarGroup key={block.id} className="mt-1">
                    <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <block.icon className={`w-3 h-3 ${block.color}`} />
                      {block.label}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {blockAgents.map((agent) => {
                          const isActive = location.startsWith(
                            `/agent/${agent.id}`,
                          );
                          return (
                            <SidebarMenuItem key={agent.id}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => navigate(`/agent/${agent.id}`)}
                                className="cursor-pointer"
                              >
                                <MessageCircle
                                  className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                                />
                                <span className="truncate flex-1 text-xs">
                                  {agent.name}
                                </span>
                                {isActive && (
                                  <ChevronRight className="w-3 h-3 opacity-50 flex-shrink-0" />
                                )}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                );
              })
            )}
          </>
        )}
      </SidebarContent>

      {/* ── Footer ───────────────────────── */}
      <SidebarFooter className="px-2 py-2 border-t border-border/30">
        <SidebarMenu>
          {FOOTER_ITEMS.map((item) => (
            <SidebarMenuItem key={item.path}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    isActive={location === item.path}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon
                      className={`w-4 h-4 flex-shrink-0 ${item.color}`}
                    />
                    <span className="text-sm">{item.label}</span>
                  </SidebarMenuButton>
                </TooltipTrigger>
                {!open && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>
          ))}

          {/* User info and logout */}
          {user && (
            <SidebarMenuItem>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate flex-1">{user.name}</span>
              </div>
            </SidebarMenuItem>
          )}

          {/* Admin: User management */}
          {isAdmin && (
            <>
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={location === "/users"}
                      onClick={() => navigate("/users")}
                      className="cursor-pointer"
                    >
                      <UserCog className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <span className="text-sm">Usuários</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  {!open && (
                    <TooltipContent side="right">Gerenciar usuários</TooltipContent>
                  )}
                </Tooltip>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={location === "/audit-logs"}
                      onClick={() => navigate("/audit-logs")}
                      className="cursor-pointer"
                    >
                      <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <span className="text-sm">Logs</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  {!open && (
                    <TooltipContent side="right">Logs de auditoria</TooltipContent>
                  )}
                </Tooltip>
              </SidebarMenuItem>
            </>
          )}

          {/* 2FA Settings */}
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton
                  isActive={location === "/2fa"}
                  onClick={() => navigate("/2fa")}
                  className="cursor-pointer"
                >
                  <Shield className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm">2FA</span>
                </SidebarMenuButton>
              </TooltipTrigger>
              {!open && (
                <TooltipContent side="right">Autenticação em dois fatores</TooltipContent>
              )}
            </Tooltip>
          </SidebarMenuItem>

          {/* Logout button */}
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton onClick={logout} className="cursor-pointer">
                  <LogOut className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm">Sair</span>
                </SidebarMenuButton>
              </TooltipTrigger>
              {!open && (
                <TooltipContent side="right">Sair do sistema</TooltipContent>
              )}
            </Tooltip>
          </SidebarMenuItem>

          {/* Theme toggle */}
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton onClick={toggle} className="cursor-pointer">
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <Moon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {theme === "dark" ? "Modo claro" : "Modo escuro"}
                  </span>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent side="right">
                {theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
