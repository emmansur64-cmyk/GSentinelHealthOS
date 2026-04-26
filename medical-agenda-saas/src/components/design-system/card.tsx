"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type DSCardProps = React.HTMLAttributes<HTMLDivElement> & {
  softShadow?: boolean;
};

export function DSCard({ className, softShadow = true, ...props }: DSCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white",
        softShadow ? "shadow-[0_2px_8px_rgba(15,23,42,0.08)]" : "",
        className,
      )}
      {...props}
    />
  );
}

export function DSCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-slate-100 px-4 py-3", className)} {...props} />;
}

export function DSCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[18px] font-semibold text-slate-900", className)} {...props} />;
}

export function DSCardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-slate-500", className)} {...props} />;
}

export function DSCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
