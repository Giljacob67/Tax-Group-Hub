import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import NotFound from "@/pages/not-found";

import { AppSidebar } from "./components/app-sidebar";
import { ErrorBoundary } from "./components/error-boundary";
import { PageTransition } from "./components/page-transition";
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
          <main className="flex-1 overflow-hidden flex flex-col w-full h-full">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import CRMPage from "./pages/crm";
import AutomationsPage from "./pages/automations";

function AnimatedRoute({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      <PageTransition>{children}</PageTransition>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <AnimatedRoute><Dashboard /></AnimatedRoute>
      </Route>
      <Route path="/crm">
        <AnimatedRoute><CRMPage /></AnimatedRoute>
      </Route>
      <Route path="/agent/:id">
        <AnimatedRoute><AgentChat /></AnimatedRoute>
      </Route>
      <Route path="/knowledge">
        <AnimatedRoute><KnowledgeBase /></AnimatedRoute>
      </Route>
      <Route path="/automations">
        <AnimatedRoute><AutomationsPage /></AnimatedRoute>
      </Route>
      <Route path="/integrations">
        <AnimatedRoute><Integrations /></AnimatedRoute>
      </Route>
      <Route path="/settings">
        <AnimatedRoute><SettingsPage /></AnimatedRoute>
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
