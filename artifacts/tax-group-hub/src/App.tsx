import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import NotFound from "@/pages/not-found";

import { AppSidebar } from "./components/app-sidebar";
import { ErrorBoundary } from "./components/error-boundary";
import Dashboard from "./pages/dashboard";
import AgentChat from "./pages/agent-chat";
import KnowledgeBase from "./pages/knowledge-base";
import Integrations from "./pages/integrations";
import SettingsPage from "./pages/settings";
import { BrandingProvider } from "./contexts/BrandingContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Layout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style} defaultOpen={true}>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative w-full min-w-0">
          <div className="absolute top-4 left-4 z-50">
            <SidebarTrigger className="bg-background/80 backdrop-blur border border-border shadow-md hover:bg-muted/50 transition-colors" />
          </div>
          <main className="flex-1 overflow-hidden flex flex-col w-full h-full">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import CRMPage from "./pages/crm";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/crm">
        <Layout><CRMPage /></Layout>
      </Route>
      <Route path="/agent/:id">
        <Layout><AgentChat /></Layout>
      </Route>
      <Route path="/knowledge">
        <Layout><KnowledgeBase /></Layout>
      </Route>
      <Route path="/integrations">
        <Layout><Integrations /></Layout>
      </Route>
      <Route path="/settings">
        <Layout><SettingsPage /></Layout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Force dark mode on mount for the corporate aesthetic
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

  return (
    <ErrorBoundary>
      <BrandingProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </BrandingProvider>
    </ErrorBoundary>
  );
}

export default App;
