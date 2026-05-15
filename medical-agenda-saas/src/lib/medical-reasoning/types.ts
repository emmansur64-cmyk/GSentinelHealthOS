export type MedicalReasoningSpecialty =
  | "general"
  | "internal_medicine"
  | "psychiatry"
  | "pediatrics"
  | "emergency";

export type MedicalReasoningSeverity = "low" | "moderate" | "urgent";

export type MedicalReasoningInput = {
  message: string;
  clinicalState?: string | null;
  hasRetrievalEvidence: boolean;
  hasPatientContext: boolean;
};

export type MedicalReasoningContext = {
  instruction: string;
  specialty: MedicalReasoningSpecialty;
  severity: MedicalReasoningSeverity;
  requiredSections: string[];
  specialtyGuidance: string[];
  emergencyEscalation: string | null;
  evidencePolicy: string;
  fallback: boolean;
  errors: string[];
};

