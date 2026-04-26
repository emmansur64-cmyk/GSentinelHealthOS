import * as React from "react";

import { cn } from "../utils/cn";

export type ModalProps = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  closeOnOverlayClick?: boolean;
  className?: string;
};

export function Modal({
  open,
  title,
  children,
  onOpenChange,
  closeOnOverlayClick = true,
  className,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-slate-900/45"
        onClick={() => {
          if (closeOnOverlayClick) {
            onOpenChange(false);
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn("relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl", className)}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">{title ?? "Modal"}</h3>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
