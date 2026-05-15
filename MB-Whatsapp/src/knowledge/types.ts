export interface MedicalNormalizedDocument {
  title: string;
  abstract: string;
  source: 'pubmed' | 'who' | 'cdc' | 'clinicaltrials' | 'guideline';
  url: string;
  date: string;
  keywords: string[];
  externalId?: string;
  country?: string;
}

export interface RetrievedMedicalDocument {
  id: string;
  title: string;
  abstract: string;
  source: string;
  url: string;
  date: string;
  keywords: string[];
  similarity: number;
  sourcePriority: number;
}

export interface MedicalCitation {
  source: string;
  url: string;
  title: string;
  date: string;
}

export interface MedicalAnswer {
  answer: string;
  citations: MedicalCitation[];
  role: 'PATIENT' | 'DOCTOR';
  confidence: number;
  clarificationRequired?: boolean;
  imaging?: {
    findings: string;
    probability: number;
    notes: string;
    assisted: true;
    provider: string;
  };
}
