import * as React from "react";

import { cn } from "../utils/cn";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary: "bg-[#2563EB] text-white hover:bg-[#1D4ED8]",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "bg-[#EF4444] text-white hover:bg-[#DC2626]",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      disabled,
      fullWidth = false,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variantClassMap[variant],
          sizeClassMap[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <span>{loadingText ?? "Cargando..."}</span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
