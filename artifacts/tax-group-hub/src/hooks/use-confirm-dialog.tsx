import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

export function useConfirmDialog() {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions>({
    title: "",
    description: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
    variant: "default",
  });
  const callbackRef = React.useRef<(() => void) | null>(null);

  const requestConfirm = React.useCallback(
    (opts: ConfirmOptions, onConfirm: () => void) => {
      setOptions({
        confirmLabel: "Confirmar",
        cancelLabel: "Cancelar",
        variant: "default",
        ...opts,
      });
      callbackRef.current = onConfirm;
      setOpen(true);
    },
    [],
  );

  const handleConfirm = React.useCallback(() => {
    setOpen(false);
    callbackRef.current?.();
    callbackRef.current = null;
  }, []);

  const handleCancel = React.useCallback(() => {
    setOpen(false);
    callbackRef.current = null;
  }, []);

  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description && (
            <AlertDialogDescription>
              {options.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {options.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={
              options.variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {options.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [requestConfirm, dialog] as const;
}
