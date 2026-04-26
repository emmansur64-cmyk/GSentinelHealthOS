"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("DSTabs components must be used inside DSTabs");
  return context;
}

export type DSTabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function DSTabs({ value, onValueChange, children, className }: DSTabsProps) {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function DSTabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-md bg-slate-100 p-1", className)} role="tablist" {...props} />;
}

export type DSTabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function DSTabsTrigger({ value, className, children, ...props }: DSTabsTriggerProps) {
  const { value: currentValue, setValue } = useTabsContext();
  const selected = currentValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        "rounded px-3 py-1.5 text-sm font-medium transition-colors",
        selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
        className,
      )}
      onClick={() => setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export type DSTabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export function DSTabsContent({ value, className, children, ...props }: DSTabsContentProps) {
  const { value: currentValue } = useTabsContext();
  if (currentValue !== value) return null;

  return (
    <div role="tabpanel" className={cn("mt-3", className)} {...props}>
      {children}
    </div>
  );
}
