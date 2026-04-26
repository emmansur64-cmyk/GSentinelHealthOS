import * as React from "react";

import { cn } from "../utils/cn";

export type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  delayMs?: number;
  className?: string;
};

export function Tooltip({ content, children, side = "top", delayMs = 120, className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  const show = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setOpen(true), delayMs);
  };

  const hide = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-xs text-white",
            side === "top" ? "-top-2 -translate-y-full" : "-bottom-2 translate-y-full",
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
