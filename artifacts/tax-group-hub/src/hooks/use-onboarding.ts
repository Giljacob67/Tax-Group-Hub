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
      "Seu centro de comando inteligente para prospecção, CRM e automação tributária. Vamos fazer um tour rápido.",
  },
  {
    id: "nav",
    title: "Navegação",
    description:
      "Acesse todas as áreas do hub: Command Center, CRM, Agentes, Automações, Base de Conhecimento e Configurações.",
    target: '[data-tour="sidebar"]',
    placement: "right",
  },
  {
    id: "dashboard",
    title: "Command Center",
    description:
      "Visualize métricas em tempo real, atividade semanal e acesse seus agentes de IA com um clique.",
    target: '[data-tour="dashboard"]',
    placement: "bottom",
  },
  {
    id: "crm",
    title: "CRM Inteligente",
    description:
      "Gerencie leads, deals, tarefas e pipelines. Qualificação automática por IA e enriquecimento de dados.",
    target: '[data-tour="crm"]',
    placement: "bottom",
  },
  {
    id: "chat",
    title: "Chat com Agentes",
    description:
      "Converse com agentes especializados em prospecção, marketing e gestão. Eles têm acesso à sua base de conhecimento.",
    target: '[data-tour="chat"]',
    placement: "bottom",
  },
  {
    id: "settings",
    title: "Configurações",
    description:
      "Conecte modelos LLM (OpenAI, Anthropic, Google, Ollama), configure WhatsApp e personalize sua marca.",
    target: '[data-tour="settings"]',
    placement: "top",
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
