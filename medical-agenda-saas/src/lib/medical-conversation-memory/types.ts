export type MedicalConversationMemoryConfig = {
  enabled: boolean;
  maxExchanges: number;
  maxSummaryChars: number;
  ttlHours: number;
  maxMedicationMentions: number;
  maxHypotheses: number;
  maxDecisions: number;
};

export type MedicalConversationMemoryExchange = {
  id: string;
  doctorMessage: string;
  assistantResponse: string;
  action: string;
  source: string;
  createdAt: string;
};

export type MedicalConversationMemoryInput = {
  tenantId: string;
  doctorUserId: string;
  conversationId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  currentMessage: string;
  exchanges: MedicalConversationMemoryExchange[];
};

export type MedicalConversationMemory = {
  instruction: string;
  generatedAt: string;
  enabled: boolean;
  fallback: boolean;
  scope: {
    tenantId: string;
    doctorUserId: string;
    conversationId: string;
    patientId: string | null;
    appointmentId: string | null;
  };
  policy: {
    ttlHours: number;
    maxExchanges: number;
    maxSummaryChars: number;
    sourceExchangeCount: number;
  };
  summary: string;
  recentDecisions: string[];
  medicationMentions: string[];
  hypotheses: string[];
  specialtyContext: string | null;
  activeConversation: boolean;
  expiresAt: string;
  errors: string[];
};

