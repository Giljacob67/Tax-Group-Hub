import { Suspense, lazy, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeContext, type Theme } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import LandingPage from "./pages/landing";

import { AppSidebar } from "./components/app-sidebar";
import { ErrorBoundary } from "./components/error-boundary";
import { PageTransition } from "./components/page-transition";
import { BrandingProvider } from "./contexts/BrandingContext";
import { OnboardingTour } from "./components/onboarding-tour";
import { ProtectedRoute } from "./components/protected-route";
import { useOnboarding, TOUR_STEPS } from "./hooks/use-onboarding";

const Dashboard = lazy(() => import("./pages/dashboard"));
const CRMPage = lazy(() => import("./pages/crm"));
const AgentChat = lazy(() => import("./pages/agent-chat"));
const KnowledgeBase = lazy(() => import("./pages/knowledge-base"));
const AutomationsPage = lazy(() => import("./pages/automations"));
const Integrations = lazy(() => import("./pages/integrations"));
const SettingsPage = lazy(() => import("./pages/settings"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const AiQualityPage = lazy(() => import("./pages/ai-quality"));
const DeliverablesPage = lazy(() => import("./pages/deliverables"));
const UserManagementPage = lazy(() => import("./pages/user-management"));
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password"));
const TwoFactorPage = lazy(() => import("./pages/two-factor"));
const AuditLogsPage = lazy(() => import("./pages/audit-logs"));
const LoginPage = lazy(() => import("./pages/login"));
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Pular para o conteúdo principal
      </a>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative w-full min-w-0">
          <div className="md:hidden p-2 border-b border-border/50 flex items-center gap-2 bg-background">
            <SidebarTrigger />
            <span className="text-sm font-medium text-foreground">Menu</span>
          </div>
          <main id="main-content" className="flex-1 overflow-hidden flex flex-col w-full h-full">
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

      <Route path="/login">
        <Suspense fallback={<PageLoader />}>
          <LoginPage />
        </Suspense>
      </Route>
      <Route path="/forgot-password">
        <Suspense fallback={<PageLoader />}>
          <ForgotPasswordPage />
        </Suspense>
      </Route>
      <Route path="/reset-password">
        <Suspense fallback={<PageLoader />}>
          <ResetPasswordPage />
        </Suspense>
      </Route>
      <Route path="/2fa">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <TwoFactorPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/audit-logs">
        <AnimatedRoute>
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<PageLoader />}>
              <AuditLogsPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/command-center">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/crm">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CRMPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/agent/:id">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AgentChat />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/knowledge">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <KnowledgeBase />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/automations">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AutomationsPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/integrations">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Integrations />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/settings">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <SettingsPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/ai-quality">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AiQualityPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/deliverables">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <DeliverablesPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/analytics">
        <AnimatedRoute>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AnalyticsPage />
            </Suspense>
          </ProtectedRoute>
        </AnimatedRoute>
      </Route>
      <Route path="/users">
        <AnimatedRoute>
          <ProtectedRoute requireAdmin>
            <Suspense fallback={<PageLoader />}>
              <UserManagementPage />
            </Suspense>
          </ProtectedRoute>
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
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as Theme) ?? "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={{ theme, toggle }}>
        <BrandingProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TooltipProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </AuthProvider>
          </QueryClientProvider>
        </BrandingProvider>
      </ThemeContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
