import * as React from "react";

import { cn } from "../utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ id, label, helperText, error, className, containerClassName, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
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
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={cn(
            "h-10 w-full rounded-md border px-3 text-sm text-slate-900 placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30",
            hasError ? "border-[#EF4444]" : "border-slate-300",
            className,
          )}
          {...props}
        />

        {hasError ? (
          <p id={errorId} className="text-xs text-[#EF4444]">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
