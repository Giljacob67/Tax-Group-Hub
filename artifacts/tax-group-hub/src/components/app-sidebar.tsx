import { useLocation } from "wouter";
import {
  LayoutDashboard, Users, Zap, BookOpen, Settings,
  MessageCircle, Crown, Briefcase, Megaphone, Settings2,
  ChevronRight, Loader2, Search, X, PanelLeftClose
} from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBranding } from "../contexts/BrandingContext";

const BLOCKS = [
  { id: "estrategia",  label: "Estratégia e Inteligência", icon: Crown,     color: "text-amber-400" },
  { id: "prospeccao",  label: "Prospecção Comercial",       icon: Briefcase, color: "text-blue-400"  },
  { id: "marketing",   label: "Agência de Marketing",       icon: Megaphone, color: "text-purple-400"},
  { id: "gestao",      label: "Gestão Interna",             icon: Settings2, color: "text-emerald-400"},
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { data, isLoading } = useListAgents();
  const { branding } = useBranding();
  const { open } = useSidebar();
  const [search, setSearch] = useState("");

  const filteredAgents = search.trim()
    ? data?.agents?.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.description || "").toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const logoUrl = branding.logoStorageKey
    ? `/uploads/${branding.logoStorageKey}`
    : `${import.meta.env.BASE_URL}images/logo-x-branco.svg`;

  // Top-level navigation items with better icons
  const NAV_ITEMS = [
    { path: "/",            label: "Dashboard",       icon: LayoutDashboard, color: "text-sky-400"     },
    { path: "/crm",         label: "CRM e Pipeline",  icon: Users,           color: "text-blue-400"    },
    { path: "/integrations",label: "AI Integrations", icon: Zap,             color: "text-amber-400"   },
  ];

  const FOOTER_ITEMS = [
    { path: "/knowledge",   label: "Knowledge Base",  icon: BookOpen, color: "text-emerald-400" },
    { path: "/settings",    label: "Configurações",   icon: Settings, color: "text-muted-foreground" },
  ];

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-r border-border/50 bg-background/50 backdrop-blur-xl">

      {/* Header */}
      <SidebarHeader className="px-3 py-3 border-b border-border/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center flex-shrink-0">
              <img src={logoUrl} alt={branding.companyName} className="w-6 h-6 object-contain" />
            </div>
            {open && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight text-white truncate">{branding.companyName}</h2>
                <p className="text-[9px] text-primary font-bold tracking-[0.2em] uppercase opacity-70">AI Hub</p>
              </div>
            )}
          </div>
          {open && (
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="right">Recolher menu</TooltipContent>
            </Tooltip>
          )}
          {!open && (
            <div className="sr-only">
              <SidebarTrigger />
            </div>
          )}
        </div>

        {/* When collapsed, show expand icon as a button in the logo position */}
        {!open && (
          <div className="mt-1 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarHeader>

      {/* Search bar — only when expanded */}
      {open && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar agente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-muted/40 border border-border/40 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-foreground text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <SidebarContent className="px-2 py-2">
        {/* Top-level navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(item => (
                <SidebarMenuItem key={item.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={item.path === "/" ? location === "/" : location.startsWith(item.path)}
                        onClick={() => navigate(item.path)}
                        className="cursor-pointer font-medium"
                      >
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {!open && <TooltipContent side="right">{item.label}</TooltipContent>}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Agents grouped by block */}
        {open && (
          <>
            {isLoading ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : filteredAgents ? (
              <SidebarGroup className="mt-2">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Resultados ({filteredAgents.length})
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredAgents.map(agent => {
                      const isActive = location.startsWith(`/agent/${agent.id}`);
                      const block = BLOCKS.find(b => b.id === agent.block);
                      return (
                        <SidebarMenuItem key={agent.id}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => navigate(`/agent/${agent.id}`)}
                            className="cursor-pointer"
                          >
                            <MessageCircle className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="truncate flex-1 text-xs">{agent.name}</span>
                            {block && <span className={`text-[9px] ${block.color} flex-shrink-0`}>{block.label.split(" ")[0]}</span>}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                    {filteredAgents.length === 0 && (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum agente encontrado</div>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              BLOCKS.map(block => {
                const blockAgents = data?.agents?.filter(a => a.block === block.id) || [];
                if (blockAgents.length === 0) return null;
                return (
                  <SidebarGroup key={block.id} className="mt-1">
                    <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <block.icon className={`w-3 h-3 ${block.color}`} />
                      {block.label}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {blockAgents.map(agent => {
                          const isActive = location.startsWith(`/agent/${agent.id}`);
                          return (
                            <SidebarMenuItem key={agent.id}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => navigate(`/agent/${agent.id}`)}
                                className="cursor-pointer"
                              >
                                <MessageCircle className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                <span className="truncate flex-1 text-xs">{agent.name}</span>
                                {isActive && <ChevronRight className="w-3 h-3 opacity-50 flex-shrink-0" />}
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

        {/* When collapsed: show agent icons with tooltips */}
        {!open && (
          <SidebarGroup className="mt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                {(data?.agents || []).slice(0, 8).map(agent => {
                  const isActive = location.startsWith(`/agent/${agent.id}`);
                  const initial = (agent.name || "A")[0].toUpperCase();
                  return (
                    <SidebarMenuItem key={agent.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => navigate(`/agent/${agent.id}`)}
                            className="cursor-pointer justify-center"
                          >
                            <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                              {initial}
                            </span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">{agent.name}</TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="px-2 py-2 border-t border-border/30">
        <SidebarMenu>
          {FOOTER_ITEMS.map(item => (
            <SidebarMenuItem key={item.path}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    isActive={location === item.path}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
                    <span className="text-sm">{item.label}</span>
                  </SidebarMenuButton>
                </TooltipTrigger>
                {!open && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
