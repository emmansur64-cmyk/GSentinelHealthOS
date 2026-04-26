"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type DSModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
  className?: string;
};

export function DSModal({
  open,
  onOpenChange,
  title,
  children,
  closeOnOverlayClick = true,
  className,
}: DSModalProps) {
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
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
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px] animate-in fade-in-0 duration-200"
        onClick={() => {
          if (closeOnOverlayClick) onOpenChange(false);
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.2)]",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-[18px] font-semibold text-slate-900">{title ?? "Modal"}</h3>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
