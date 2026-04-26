"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const badgeByStatus = {
  confirmed: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border border-rose-200 bg-rose-50 text-rose-700",
} as const;

export type DSBadgeStatus = keyof typeof badgeByStatus;

export type DSBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  status: DSBadgeStatus;
};

export function DSBadge({ status, className, children, ...props }: DSBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        badgeByStatus[status],
        className,
      )}
      {...props}
    >
      {children ?? status}
    </span>
  );
}
