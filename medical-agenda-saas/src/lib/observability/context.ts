import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

export type ObservabilityContext = {
  traceId: string;
  messageId?: string;
  userPhone?: string;
  intent?: string;
};

const store = new AsyncLocalStorage<ObservabilityContext>();

export function createTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function runWithObservabilityContext<T>(
  context: Partial<ObservabilityContext>,
  fn: () => T,
): T {
  const parent = store.getStore();
  const merged: ObservabilityContext = {
    traceId: context.traceId ?? parent?.traceId ?? createTraceId(),
    messageId: context.messageId ?? parent?.messageId,
    userPhone: context.userPhone ?? parent?.userPhone,
    intent: context.intent ?? parent?.intent,
  };

  return store.run(merged, fn);
}

export function getObservabilityContext(): ObservabilityContext | undefined {
  return store.getStore();
}

export function enrichObservabilityContext(context: Partial<ObservabilityContext>): void {
  const current = store.getStore();
  if (!current) return;

  if (context.messageId !== undefined) current.messageId = context.messageId;
  if (context.userPhone !== undefined) current.userPhone = context.userPhone;
  if (context.intent !== undefined) current.intent = context.intent;
}
