"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary: "bg-[#2563EB] text-white shadow-sm hover:bg-[#1D4ED8]",
        secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
        danger: "bg-[#EF4444] text-white shadow-sm hover:bg-[#DC2626]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export type DSButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    loadingText?: string;
    disabled?: boolean;
  };

export const DSButton = React.forwardRef<HTMLButtonElement, DSButtonProps>(
  ({ className, children, variant, size, fullWidth, loading = false, loadingText, disabled, ...props }, ref) => {
    const isDisabled = Boolean(disabled || loading);

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{loadingText ?? "Cargando..."}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

DSButton.displayName = "DSButton";
