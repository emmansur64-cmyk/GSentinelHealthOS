import {
  AgendaApiDryRunResult,
  AgendaApiScheduleImportPayload,
} from './import-preview.types';

export const AGENDA_IMPORT_CONTRACT_VERSION = 'mb-secretaria.schedule-import.v1';
export const AGENDA_APPLY_DISABLED_ERROR = 'Agenda apply is disabled in MB-Secretaria dry-run phase';

export interface AgendaApiClient {
  previewScheduleImport(payload: AgendaApiScheduleImportPayload): Promise<AgendaApiDryRunResult>;
  applyScheduleImport(payload: AgendaApiScheduleImportPayload): Promise<never>;
}
