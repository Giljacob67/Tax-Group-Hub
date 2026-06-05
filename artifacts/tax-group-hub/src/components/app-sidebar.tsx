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
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useListAgents } from "@workspace/api-client-react";
import { useState } from "react";
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

const NAV_ITEMS = [
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
    path: "/knowledge",
    label: "Base de Conhecimento",
    icon: BookOpen,
    color: "text-muted-foreground",
  },
  {
    path: "/analytics",
    label: "Analytics",
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
    path: "/deliverables",
    label: "Entregáveis",
    icon: FileText,
    color: "text-muted-foreground",
  },
  {
    path: "/integrations",
    label: "Integrações",
    icon: Settings2,
    color: "text-muted-foreground",
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
  const isAdmin = userData?.user?.roles?.some((r: any) => r.role === "admin" && r.isActive) ?? false;

  const logoUrl = branding.logoStorageKey
    ? `/uploads/${branding.logoStorageKey}`
    : `${import.meta.env.BASE_URL}images/logo-x-branco.svg`;

  const filteredAgents = search.trim()
    ? data?.agents?.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          (a.description || "").toLowerCase().includes(search.toLowerCase()),
      )
    : null;

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
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
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
                        <span className="font-medium">{item.label}</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {!open && (
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
                            → <button onClick={() => navigate("/agent/diagnostico-cnpj")} className="text-primary hover:underline">Diagnóstico CNPJ</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Vou fazer o primeiro contato</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/prospeccao-comercial")} className="text-primary hover:underline">Prospecção Comercial</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Cliente fez uma objeção</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/reversao-objecoes")} className="text-primary hover:underline">Reversão de Objeções</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Cliente não respondeu</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/follow-up")} className="text-primary hover:underline">Follow-Up</button>
                          </div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <strong className="text-foreground">Preciso preparar uma reunião</strong>
                          <div className="text-muted-foreground mt-0.5">
                            → <button onClick={() => navigate("/agent/roteiro-reuniao")} className="text-primary hover:underline">Roteiro de Reunião</button>
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
