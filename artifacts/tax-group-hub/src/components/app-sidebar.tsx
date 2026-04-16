import { useState } from "react";
import { useLocation } from "wouter";
import {
  MessageSquare, Briefcase, Megaphone,
  Settings2, FileText, LayoutDashboard, ChevronRight,
  Image as ImageIcon, Loader2, Cog, Crown, Search, X
} from "lucide-react";
import { useListAgents } from "@workspace/api-client-react";
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
} from "@/components/ui/sidebar";

const BLOCKS = [
  { id: "estrategia", label: "Estratégia e Inteligência", icon: Crown, color: "text-amber-400" },
  { id: "prospeccao", label: "Prospecção Comercial", icon: Briefcase, color: "text-blue-400" },
  { id: "marketing", label: "Agência de Marketing", icon: Megaphone, color: "text-purple-400" },
  { id: "gestao", label: "Gestão Interna", icon: Settings2, color: "text-emerald-400" },
];

import { useBranding } from "../contexts/BrandingContext";

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { data, isLoading } = useListAgents();
  const { branding, isLoading: brandingLoading } = useBranding();
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

  return (
    <Sidebar variant="inset" className="border-r border-border/50 bg-background/50 backdrop-blur-xl">
      <SidebarHeader className="p-4 flex flex-row items-center space-x-3 mt-2">
        <div className="w-12 h-12 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center flex-shrink-0 transition-all duration-500">
          <img
            src={logoUrl}
            alt={branding.companyName}
            className="w-8 h-8 object-contain"
          />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white transition-all duration-500">
            {branding.companyName}
          </h1>
          <p className="text-[10px] text-primary font-bold tracking-[0.2em] uppercase opacity-80">AI Hub</p>
        </div>
      </SidebarHeader>

      {/* Search bar */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-muted/50 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={location === "/"} 
                  onClick={() => navigate("/")} 
                  className="font-medium cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={location.startsWith("/crm")} 
                  onClick={() => navigate("/crm")} 
                  className="font-medium cursor-pointer"
                >
                  <Briefcase className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>CRM e Pipeline</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={location === "/integrations"} 
                  onClick={() => navigate("/integrations")} 
                  className="font-medium cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>AI Integrations</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filteredAgents ? (
          // Search results view
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Resultados ({filteredAgents.length})
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {filteredAgents.map((agent) => {
                  const isActive = location.startsWith(`/agent/${agent.id}`);
                  const block = BLOCKS.find(b => b.id === agent.block);
                  return (
                    <SidebarMenuItem key={agent.id}>
                      <SidebarMenuButton 
                        isActive={isActive}
                        onClick={() => navigate(`/agent/${agent.id}`)}
                        className={`group transition-all duration-200 cursor-pointer ${isActive ? 'bg-[#107ec2]/10 border-l-2 border-[#107ec2] text-white hover:bg-[#107ec2]/15' : 'hover:bg-white/5'}`}
                      >
                        <MessageSquare className={`w-4 h-4 mr-2 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                        <span className="truncate flex-1">{agent.name}</span>
                        {block && <span className={`text-[10px] ${block.color}`}>{block.label.split(" ")[0]}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {filteredAgents.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum agente encontrado
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          // Normal grouped view
          BLOCKS.map(block => {
            const blockAgents = data?.agents?.filter(a => a.block === block.id) || [];
            if (blockAgents.length === 0) return null;

            return (
              <SidebarGroup key={block.id} className="mt-4">
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center">
                  <block.icon className={`w-3.5 h-3.5 mr-2 ${block.color}`} />
                  {block.label}
                </SidebarGroupLabel>
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu>
                    {blockAgents.map((agent) => {
                      const isActive = location.startsWith(`/agent/${agent.id}`);
                      return (
                        <SidebarMenuItem key={agent.id}>
                          <SidebarMenuButton 
                            isActive={isActive}
                            onClick={() => navigate(`/agent/${agent.id}`)}
                            className={`group transition-all duration-200 cursor-pointer ${isActive ? 'bg-[#107ec2]/10 border-l-2 border-[#107ec2] text-white hover:bg-[#107ec2]/15' : 'hover:bg-white/5'}`}
                          >
                            <MessageSquare className={`w-4 h-4 mr-2 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                            <span className="truncate flex-1">{agent.name}</span>
                            {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
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
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              isActive={location === "/knowledge"} 
              onClick={() => navigate("/knowledge")} 
              className="cursor-pointer"
            >
              <FileText className="w-4 h-4 mr-2 text-emerald-400" />
              <span className="font-medium">Knowledge Base</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              isActive={location === "/settings"} 
              onClick={() => navigate("/settings")} 
              className="cursor-pointer"
            >
              <Cog className="w-4 h-4 mr-2 text-muted-foreground" />
              <span className="font-medium">Configurações</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
