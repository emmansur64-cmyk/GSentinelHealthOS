import { MedicalCitation } from '../knowledge/types';
import { MedicalUserRole } from '../ai/classification.service';
import { IncidentResult } from '../common/types/brain.types';
import { MedicalImagingResult } from '../ai/medical-imaging.service';
import { XaiAuditConsoleReport, XaiExplainabilityMode } from '../diagnosis/diagnosis.types';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ValidateIf,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActivePatientClinicalHistory, DoctorPatientContext } from './doctor-patient-context.contract';

export enum MedicalAssistantRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

export enum MedicalAssistantMode {
  DOCTOR_PROFESSIONAL = 'doctor_professional',
  CLINICAL_SUPPORT = 'clinical_support',
}

export enum MedicalAssistantImageMimeType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export class DoctorPatientContextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  doctor_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  patient_id!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  tenant_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clinic_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  encounter_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  appointment_id?: string;
}

export class ActivePatientClinicalHistoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  doctor_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  patient_id!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  tenant_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clinic_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  encounter_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  appointment_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2500)
  clinical_summary!: string;

  @IsBoolean()
  is_sanitized!: boolean;
}

export class MedicalAssistantChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @ValidateIf((obj) => typeof obj.query !== 'string' || obj.query.trim().length === 0)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(4000)
  message?: string;

  // Legacy alias kept temporarily for backward compatibility.
  @IsOptional()
  @ValidateIf((obj) => obj.message === undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(4000)
  query?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  imageBase64?: string;

  @IsOptional()
  @IsEnum(MedicalAssistantImageMimeType)
  imageMimeType?: MedicalAssistantImageMimeType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  patientAge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modalityHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  userTypeHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  channel?: string;

  @IsOptional()
  @IsEnum(MedicalAssistantRole)
  role?: MedicalAssistantRole;

  @IsOptional()
  @IsEnum(MedicalAssistantMode)
  mode?: MedicalAssistantMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => DoctorPatientContextDto)
  doctorPatientContext?: DoctorPatientContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ActivePatientClinicalHistoryDto)
  activePatientClinicalHistory?: ActivePatientClinicalHistoryDto;

  @IsOptional()
  @IsEnum(XaiExplainabilityMode)
  xaiExplainabilityMode?: XaiExplainabilityMode;
}

export interface MedicalAssistantRequest {
  sessionId?: string;
  message: string;
  query?: string;
  country?: string;
  topK?: number;
  imageBase64?: string;
  imageMimeType?: string;
  patientAge?: number;
  modalityHint?: string;
  userTypeHint?: string;
  channel?: string;
  role?: MedicalAssistantRole;
  mode?: MedicalAssistantMode;
  doctorPatientContext?: DoctorPatientContext;
  activePatientClinicalHistory?: ActivePatientClinicalHistory;
  xaiExplainabilityMode?: XaiExplainabilityMode;
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
  learning?: {
    enabled: boolean;
    action: string;
    confidence: number;
    mode: 'controlled_dry_run';
  };
  transferProtocol?: {
    activated: boolean;
    phase: 'icu_critical_transfer';
    pushAlert: string;
    sbarReport: string;
    xaiValidation: {
      objective: string;
      supportingGuidelines: Array<{
        source: string;
        title: string;
        url: string;
      }>;
      supportingPapers: Array<{
        title: string;
        url: string;
      }>;
    };
    xaiAuditConsole?: XaiAuditConsoleReport;
    nextModule: string;
  };
}
