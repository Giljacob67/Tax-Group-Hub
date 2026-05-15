import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TourStep } from "@/hooks/use-onboarding";

interface OnboardingTourProps {
  isOpen: boolean;
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
}

export function OnboardingTour({
  isOpen,
  step,
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onFinish,
}: OnboardingTourProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen) return;

    if (!step.target) {
      // Center modal for welcome step
      setPos({ top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 160 });
      return;
    }

    const targetEl = document.querySelector(step.target) as HTMLElement | null;
    if (!targetEl) {
      // Fallback to center if target not found
      setPos({ top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 160 });
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipW = tooltipEl?.offsetWidth ?? 320;
    const tooltipH = tooltipEl?.offsetHeight ?? 180;

    let top = rect.bottom + 12;
    let left = rect.left + rect.width / 2 - tooltipW / 2;

    if (step.placement === "top") {
      top = rect.top - tooltipH - 12;
    } else if (step.placement === "left") {
      left = rect.left - tooltipW - 12;
      top = rect.top + rect.height / 2 - tooltipH / 2;
    } else if (step.placement === "right") {
      left = rect.right + 12;
      top = rect.top + rect.height / 2 - tooltipH / 2;
    }

    // Clamp to viewport
    const padding = 16;
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipH - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipW - padding));

    setPos({ top, left });
  }, [isOpen, step, stepIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100]"
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={onFinish} />

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: 320,
            }}
            className="bg-background border border-border rounded-xl shadow-2xl p-5"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
              </div>
              <button
                onClick={onFinish}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {step.description}
            </p>

            <div className="flex items-center justify-between">
              {/* Step dots */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === stepIndex ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!isFirst && (
                  <Button variant="ghost" size="sm" onClick={onPrev} className="h-8 px-2">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <Button size="sm" onClick={onNext} className="h-8 gap-1">
                  {isLast ? "Concluir" : "Próximo"}
                  {!isLast && <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
