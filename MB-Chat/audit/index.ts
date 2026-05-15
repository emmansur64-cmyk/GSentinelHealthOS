import type { ClinicalTraceContext, CurrentImplementationAdapter, SafeFallback } from "../core";

export type ClinicalAuditEvent = {
  eventType: string;
  entityType?: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  trace: ClinicalTraceContext;
};

export type ClinicalAuditLayer = {
  record(event: ClinicalAuditEvent): Promise<SafeFallback<{ recorded: boolean }>>;
};

export const CURRENT_AUDIT_ADAPTER: CurrentImplementationAdapter = {
  layer: "audit_layer",
  currentPaths: [
    "src/audit",
    "src/persistence",
    "medical-agenda-saas/src/lib/audit.ts",
    "medical-agenda-saas/src/lib/compliance/audit-log.ts",
  ],
  behaviorChanging: false,
  notes: ["Current audit storage remains fragmented; Fase 2 creates the formal boundary."],
};
