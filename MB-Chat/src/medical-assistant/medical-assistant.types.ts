import { MedicalCitation } from '../knowledge/types';
import { MedicalUserRole } from '../ai/classification.service';
import { IncidentResult } from '../common/types/brain.types';
import { MedicalImagingResult } from '../ai/medical-imaging.service';

export interface MedicalAssistantRequest {
  query?: string;
  country?: string;
  topK?: number;
  imageBase64?: string;
  imageMimeType?: string;
  patientAge?: number;
  modalityHint?: string;
  userTypeHint?: string;
  channel?: string;
}

export interface MedicalAssistantResponse {
  channel: string;
  role: MedicalUserRole;
  roleConfidence: number;
  modality: 'text' | 'image' | 'multimodal';
  response: {
    text: string;
    citations: MedicalCitation[];
  };
  guidance: {
    languageStyle: 'simple' | 'technical';
    warnings: string[];
  };
  imaging?: MedicalImagingResult;
  metabrain?: {
    status: IncidentResult['status'];
    action: string;
    reason: string;
    dryRun: boolean;
  };
}
