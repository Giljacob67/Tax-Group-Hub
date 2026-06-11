import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "tgh-onboarding-completed";

export type TourStep = {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector
  placement?: "top" | "bottom" | "left" | "right";
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo ao Tax Group AI Hub",
    description:
      "Aqui você transforma listas de CNPJs em oportunidades tributárias qualificadas. O fluxo é simples: importar → qualificar com IA → trabalhar o pipeline.",
  },
  {
    id: "nav",
    title: "Navegação",
    description:
      "Tudo está na barra lateral: Command Center (visão geral), CRM (contatos e pipeline), Agentes IA e Automações. Use Cmd+K para navegar rápido.",
    target: '[data-tour="sidebar"]',
    placement: "right",
  },
  {
    id: "dashboard",
    title: "Command Center",
    description:
      "Sua visão geral: empresas no CRM, leads quentes, propostas e ações do dia. Cada cartão é clicável e leva direto à lista filtrada.",
    target: '[data-tour="dashboard"]',
    placement: "bottom",
  },
  {
    id: "step-import",
    title: "Passo 1 — Importar empresas",
    description:
      "No CRM, clique em “Importar” e suba sua lista de CNPJs (CSV ou Excel). O sistema enriquece os dados automaticamente.",
  },
  {
    id: "step-qualify",
    title: "Passo 2 — Qualificar com IA",
    description:
      "Selecione os contatos importados e clique em “Qualificar IA”. A IA pontua cada empresa (0-100) e cria oportunidades no pipeline para os níveis A, B e C.",
  },
  {
    id: "step-pipeline",
    title: "Passo 3 — Trabalhar o pipeline",
    description:
      "Na aba Pipeline do CRM, arraste as oportunidades pelas etapas. Use os agentes IA para diagnóstico, abordagem, objeções e follow-up. A aba “Hoje” mostra suas prioridades diárias.",
  },
];

export function useOnboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (!hasSeenTour) {
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasSeenTour]);

  const currentStep = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLast]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const finish = useCallback(() => {
    setIsOpen(false);
    setHasSeenTour(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const restart = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    stepIndex,
    currentStep,
    isFirst,
    isLast,
    hasSeenTour,
    next,
    prev,
    finish,
    restart,
  };
}
