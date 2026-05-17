export type MedicalWebSourceType =
  | "organism"
  | "science"
  | "university_hospital"
  | "mental_health"
  | "medication";

export type MedicalWebRetrievalMode = "allowlist" | "open";

export type MedicalWebRetrievalConfig = {
  enabled: boolean;
  mode: MedicalWebRetrievalMode;
  timeoutMs: number;
  maxSources: number;
};

export type MedicalWebRetrievalInput = {
  tenantId: string;
  doctorUserId: string;
  conversationId: string;
  message: string;
  clinicalState?: string | null;
};

export type MedicalWebAllowedSource = {
  domain: string;
  type: MedicalWebSourceType;
  label: string;
  searchUrl: (query: string) => string;
};

export type MedicalWebRejectedSource = {
  url: string;
  reason: string;
};

export type MedicalWebRawDocument = {
  source: MedicalWebAllowedSource;
  url: string;
  fetchedAt: string;
  rawText: string;
};

export type MedicalWebEvidenceFragment = {
  source: string;
  sourceType: MedicalWebSourceType;
  title: string;
  url: string;
  date: string | null;
  fragment: string;
  confidence: "medium" | "high";
};

export type MedicalWebRetrievalResult = {
  used: boolean;
  query: string;
  activatedBy: string[];
  sourcesConsulted: string[];
  sourcesRejected: MedicalWebRejectedSource[];
  evidence: MedicalWebEvidenceFragment[];
  fallback: boolean;
  error?: string;
};

export type MedicalWebRetrievalContext = {
  instruction: string;
  query: string;
  sources: MedicalWebEvidenceFragment[];
};
