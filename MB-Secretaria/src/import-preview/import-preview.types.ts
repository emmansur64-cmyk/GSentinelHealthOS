export type ImportPreviewStatus = 'valid' | 'invalid' | 'warning';
export type SupportedImportFormat = 'csv' | 'xlsx';

export interface UploadedAdministrativeFile {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface RawImportRow {
  rowNumber: number;
  values: Record<string, string>;
  unknownColumns: string[];
  empty: boolean;
}

export interface NormalizedScheduleRow {
  doctorName: string;
  specialty: string;
  location: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  tenantId: string;
  rowIdempotencyKey: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  status: ImportPreviewStatus;
  doctorName: string;
  specialty: string;
  location: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  errors: string[];
  warnings: string[];
  normalized: Partial<NormalizedScheduleRow>;
  rowIdempotencyKey?: string;
}

export interface AgendaApiPayloadPreview {
  tenantId: string;
  doctorName: string;
  specialty: string;
  location: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  rowNumber: number;
  rowIdempotencyKey: string;
}

export interface AgendaApiScheduleImportPayload {
  contractVersion: string;
  tenantId: string;
  batchId: string;
  batchIdempotencyKey: string;
  rows: AgendaApiPayloadPreview[];
}

export interface AgendaApiDryRunResult {
  enabled: true;
  mode: 'local_contract_validation' | 'remote_dry_run_contract_validation';
  wouldSend: boolean;
  applyBlocked: true;
  batchIdempotencyKey: string;
  validPayloadRows: number;
  rejectedPayloadRows: number;
  remoteDryRunAttempted?: boolean;
  remoteDryRunSent?: boolean;
  remoteDryRunHost?: string;
  remoteDryRunPath?: string;
  remoteDryRunStatus?: number;
  remoteDryRunErrorCode?: string;
}

export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: number;
  duplicates: number;
  overlaps: number;
}

export interface ImportPreviewResponse {
  batchId: string;
  status: 'preview_only';
  summary: ImportPreviewSummary;
  rows: ImportPreviewRow[];
  agendaApiPayloadPreview: AgendaApiPayloadPreview[];
  agendaDryRun: AgendaApiDryRunResult;
  applyEnabled: false;
}
