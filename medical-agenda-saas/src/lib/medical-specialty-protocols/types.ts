export type MedicalSpecialtyId =
  | "cardiology"
  | "psychiatry"
  | "pediatrics"
  | "neurology"
  | "endocrinology"
  | "general_medicine"
  | "emergency"
  | "psychology";

export type MedicalProtocolRiskLevel = "routine" | "caution" | "high";

export type MedicalSpecialtyProtocolInput = {
  message: string;
  clinicalState?: string | null;
  hasRetrievalEvidence: boolean;
  hasRuntimeContext: boolean;
};

export type MedicalSpecialtyProtocolDefinition = {
  id: MedicalSpecialtyId;
  label: string;
  tone: string;
  reasoningStyle: string;
  protocolFocus: string[];
  redFlags: string[];
  evidenceUse: string;
  structureHints: string[];
  patterns: RegExp[];
};

export type MedicalSpecialtyProtocolContext = {
  instruction: string;
  specialty: MedicalSpecialtyId;
  label: string;
  riskLevel: MedicalProtocolRiskLevel;
  tone: string;
  reasoningStyle: string;
  protocolFocus: string[];
  redFlags: string[];
  evidencePolicy: string;
  structureHints: string[];
  riskModifiers: string[];
  emergencyModifiers: string[];
  compatibility: {
    retrieval: "available" | "not_available";
    runtimeContext: "available" | "not_available";
  };
  fallback: boolean;
  errors: string[];
};
