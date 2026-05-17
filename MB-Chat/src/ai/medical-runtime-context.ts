import { MedicalCitation } from '../knowledge/types';

export interface MedicalRuntimeToolContext {
  generatedAt: string;
  timezone: string;
  currentTimeText: string;
  weather?: {
    provider: string;
    location: string;
    temperatureC?: number;
    windKmh?: number;
    precipitationMm?: number;
    summary: string;
    url: string;
  };
  officialSources: MedicalCitation[];
  officialSourceEvidence: Array<{
    source: string;
    title: string;
    url: string;
    excerpt: string;
  }>;
  allowedDomains: string[];
  notes: string[];
}
