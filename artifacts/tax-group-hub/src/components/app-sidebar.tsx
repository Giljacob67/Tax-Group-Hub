import { useLocation } from "wouter";
import {
  MessageSquare, Briefcase, Megaphone,
  Settings2, FileText, LayoutDashboard, ChevronRight,
  Image as ImageIcon, Loader2, Cog, Crown
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

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { data, isLoading } = useListAgents();

  return (
    <Sidebar variant="inset" className="border-r border-border/50 bg-background/50 backdrop-blur-xl">
      <SidebarHeader className="p-4 flex flex-row items-center space-x-3 mt-2">
        <div className="w-12 h-12 rounded-xl bg-[#107ec2]/15 ring-1 ring-[#107ec2]/30 flex items-center justify-center flex-shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}images/logo-x-branco.svg`}
            alt="Tax Group"
            className="w-8 h-8 object-contain"
          />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Tax Group</h1>
          <p className="text-xs text-[#107ec2] font-semibold tracking-widest uppercase">AI Hub</p>
        </div>
      </SidebarHeader>

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
        ) : (
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
