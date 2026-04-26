"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type DSDropdownItem = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type DSDropdownProps = {
  label?: string;
  value?: string;
  placeholder?: string;
  items: DSDropdownItem[];
  onValueChange: (value: string) => void;
  className?: string;
};

export function DSDropdown({ label, value, placeholder = "Seleccionar", items, onValueChange, className }: DSDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedItem = items.find((item) => item.value === value);

  return (
    <div className={cn("space-y-1.5", className)} ref={rootRef}>
      {label ? <label className="text-sm font-medium text-slate-700">{label}</label> : null}
      <div className="relative">
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm transition hover:border-slate-400"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span className={selectedItem ? "text-slate-900" : "text-slate-400"}>{selectedItem?.label ?? placeholder}</span>
          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open ? "rotate-180" : "")} />
        </button>

        {open ? (
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)] animate-in fade-in-0 zoom-in-95 duration-150">
            {items.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={item.disabled}
                className={cn(
                  "w-full rounded px-2 py-2 text-left text-sm transition-colors",
                  item.value === value ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50",
                  item.disabled ? "cursor-not-allowed opacity-45" : "",
                )}
                onClick={() => {
                  if (item.disabled) return;
                  onValueChange(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
