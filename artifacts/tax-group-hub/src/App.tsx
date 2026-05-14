import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import LandingPage from "./pages/landing";

import { AppSidebar } from "./components/app-sidebar";
import { ErrorBoundary } from "./components/error-boundary";
import { PageTransition } from "./components/page-transition";
import { BrandingProvider } from "./contexts/BrandingContext";
import { OnboardingTour } from "./components/onboarding-tour";
import { useOnboarding, TOUR_STEPS } from "./hooks/use-onboarding";

const Dashboard = lazy(() => import("./pages/dashboard"));
const CRMPage = lazy(() => import("./pages/crm"));
const AgentChat = lazy(() => import("./pages/agent-chat"));
const KnowledgeBase = lazy(() => import("./pages/knowledge-base"));
const AutomationsPage = lazy(() => import("./pages/automations"));
const Integrations = lazy(() => import("./pages/integrations"));
const SettingsPage = lazy(() => import("./pages/settings"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const NotFound = lazy(() => import("./pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground">Carregando...</span>
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  const tour = useOnboarding();

  return (
    <SidebarProvider style={style} defaultOpen={true}>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative w-full min-w-0">
          <div className="md:hidden p-2 border-b border-border/50 flex items-center gap-2 bg-background">
            <SidebarTrigger />
            <span className="text-sm font-medium text-foreground">Menu</span>
          </div>
          <main className="flex-1 overflow-hidden flex flex-col w-full h-full">
            {children}
          </main>
        </div>
      </div>
      <OnboardingTour
        isOpen={tour.isOpen}
        step={tour.currentStep}
        stepIndex={tour.stepIndex}
        totalSteps={TOUR_STEPS.length}
        isFirst={tour.isFirst}
        isLast={tour.isLast}
        onNext={tour.next}
        onPrev={tour.prev}
        onFinish={tour.finish}
      />
    </SidebarProvider>
  );
}

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
        <LandingPage />
      </Route>
      <Route path="/command-center">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route path="/crm">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <CRMPage />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route path="/agent/:id">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <AgentChat />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route path="/knowledge">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <KnowledgeBase />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route path="/automations">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <AutomationsPage />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route path="/integrations">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <Integrations />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route path="/settings">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <SettingsPage />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route path="/analytics">
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <AnalyticsPage />
          </Suspense>
        </AnimatedRoute>
      </Route>
      <Route>
        <AnimatedRoute>
          <Suspense fallback={<PageLoader />}>
            <NotFound />
          </Suspense>
        </AnimatedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  // Force dark mode on mount for the corporate aesthetic
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
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
