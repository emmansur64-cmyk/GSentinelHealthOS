import { randomUUID } from "node:crypto";

export function createTraceId(prefix = "trace"): string {
  return `${prefix}_${randomUUID()}`;
}

export function createCorrelationId(prefix = "corr"): string {
  return `${prefix}_${randomUUID()}`;
}
