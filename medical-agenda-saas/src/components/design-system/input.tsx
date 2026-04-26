"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type DSInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
};

export const DSInput = React.forwardRef<HTMLInputElement, DSInputProps>(
  ({ id, label, helperText, error, className, containerClassName, ...props }, ref) => {
    const inputId = id ?? React.useId();
    const hasError = Boolean(error);
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30",
            hasError ? "border-[#EF4444]" : "border-slate-300 hover:border-slate-400",
            className,
          )}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          {...props}
        />

        {hasError ? <p id={errorId} className="text-xs text-[#EF4444]">{error}</p> : null}
        {!hasError && helperText ? <p id={helperId} className="text-xs text-slate-500">{helperText}</p> : null}
      </div>
    );
  },
);

DSInput.displayName = "DSInput";
