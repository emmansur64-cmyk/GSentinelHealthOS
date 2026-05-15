import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AgendaApiDryRunClient } from './agenda-api-dry-run.client';
import { AgendaApiHttpDryRunClient } from './agenda-api-http-dry-run.client';
import { AGENDA_IMPORT_CONTRACT_VERSION } from './agenda-api-client';
import {
  AgendaApiPayloadPreview,
  AgendaApiScheduleImportPayload,
  ImportPreviewResponse,
  ImportPreviewRow,
  NormalizedScheduleRow,
  RawImportRow,
  UploadedAdministrativeFile,
} from './import-preview.types';
import { ScheduleImportParserService } from './schedule-import-parser.service';

const VALID_DAYS: Record<string, string> = {
  monday: 'monday',
  lunes: 'monday',
  tuesday: 'tuesday',
  martes: 'tuesday',
  wednesday: 'wednesday',
  miercoles: 'wednesday',
  'miércoles': 'wednesday',
  thursday: 'thursday',
  jueves: 'thursday',
  friday: 'friday',
  viernes: 'friday',
  saturday: 'saturday',
  sabado: 'saturday',
  'sábado': 'saturday',
  sunday: 'sunday',
  domingo: 'sunday',
};

const FORBIDDEN_DOMAIN_RE = /\b(whatsapp|triage|diagnostico|diagnóstico|diagnosis|clinical|clinico|clínico|imaging|radiology|dicom|rmn|tac|rx)\b/i;

@Injectable()
export class ScheduleImportPreviewService {
  constructor(
    private readonly parser: ScheduleImportParserService,
    private readonly agendaApiClient: AgendaApiDryRunClient | AgendaApiHttpDryRunClient = new AgendaApiHttpDryRunClient(),
  ) {}

  async preview(file: UploadedAdministrativeFile, tenantId: string): Promise<ImportPreviewResponse> {
    const normalizedTenantId = this.requireTenantId(tenantId);
    const rows = await this.parser.parse(file);
    const previewRows = rows.map((row) => this.validateRow(row, normalizedTenantId));
    this.markDuplicates(previewRows);
    this.markOverlaps(previewRows);
    this.attachRowIdempotencyKeys(previewRows, normalizedTenantId);

    const validRows = previewRows.filter((row) => row.status === 'valid');
    const warningCount = previewRows.reduce((count, row) => count + row.warnings.length, 0);
    const batchId = this.createBatchId(file);
    const agendaApiPayloadPreview = validRows.map((row) => this.toAgendaPayload(row));
    const batchIdempotencyKey = this.createBatchIdempotencyKey(normalizedTenantId, previewRows);
    const agendaPayload: AgendaApiScheduleImportPayload = {
      contractVersion: AGENDA_IMPORT_CONTRACT_VERSION,
      tenantId: normalizedTenantId,
      batchId,
      batchIdempotencyKey,
      rows: agendaApiPayloadPreview,
    };
    const agendaDryRun = await this.agendaApiClient.previewScheduleImport(agendaPayload);

    return {
      batchId,
      status: 'preview_only',
      summary: {
        totalRows: previewRows.length,
        validRows: validRows.length,
        invalidRows: previewRows.filter((row) => row.status === 'invalid').length,
        warnings: warningCount,
        duplicates: previewRows.filter((row) => row.errors.includes('duplicate_exact_row')).length,
        overlaps: previewRows.filter((row) => row.errors.includes('overlap_same_doctor_day_location')).length,
      },
      rows: previewRows,
      agendaApiPayloadPreview,
      agendaDryRun: {
        ...agendaDryRun,
        rejectedPayloadRows: previewRows.length - agendaApiPayloadPreview.length,
      },
      applyEnabled: false,
    };
  }

  private validateRow(row: RawImportRow, tenantId: string): ImportPreviewRow {
    const values = row.values;
    const normalized: Partial<NormalizedScheduleRow> = {
      doctorName: this.normalizeText(values.doctorName),
      specialty: this.normalizeText(values.specialty),
      location: this.normalizeText(values.location),
      dayOfWeek: this.normalizeDay(values.dayOfWeek),
      startTime: this.normalizeTime(values.startTime),
      endTime: this.normalizeTime(values.endTime),
      tenantId,
    };

    const errors: string[] = [];
    const warnings: string[] = [];

    if (row.empty) warnings.push('empty_row_ignored');
    if (row.unknownColumns.length > 0) warnings.push(`unknown_columns:${row.unknownColumns.join('|')}`);
    if (!normalized.doctorName) errors.push('doctor_required');
    if (!normalized.specialty) errors.push('specialty_required');
    if (!normalized.location) errors.push('location_required');
    if (!values.dayOfWeek) errors.push('day_required');
    if (values.dayOfWeek && !normalized.dayOfWeek) errors.push('day_invalid');
    if (!values.startTime) errors.push('start_time_required');
    if (!values.endTime) errors.push('end_time_required');
    if (values.startTime && !normalized.startTime) errors.push('start_time_invalid_format');
    if (values.endTime && !normalized.endTime) errors.push('end_time_invalid_format');

    const startMinutes = normalized.startTime ? this.timeToMinutes(normalized.startTime) : null;
    const endMinutes = normalized.endTime ? this.timeToMinutes(normalized.endTime) : null;
    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      errors.push('start_time_must_be_before_end_time');
    }

    if (Object.values(values).some((value) => FORBIDDEN_DOMAIN_RE.test(value))) {
      errors.push('forbidden_domain_content');
    }

    const status = errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid';
    return {
      rowNumber: row.rowNumber,
      status,
      doctorName: values.doctorName ?? '',
      specialty: values.specialty ?? '',
      location: values.location ?? '',
      dayOfWeek: values.dayOfWeek ?? '',
      startTime: values.startTime ?? '',
      endTime: values.endTime ?? '',
      errors,
      warnings,
      normalized,
    };
  }

  private markDuplicates(rows: ImportPreviewRow[]): void {
    const seen = new Map<string, ImportPreviewRow[]>();
    for (const row of rows) {
      if (row.errors.length > 0 || row.warnings.includes('empty_row_ignored')) continue;
      const key = this.rowKey(row);
      const bucket = seen.get(key) ?? [];
      bucket.push(row);
      seen.set(key, bucket);
    }

    for (const bucket of seen.values()) {
      if (bucket.length <= 1) continue;
      for (const row of bucket) this.invalidate(row, 'duplicate_exact_row');
    }
  }

  private markOverlaps(rows: ImportPreviewRow[]): void {
    const candidates = rows.filter((row) => row.errors.length === 0);
    for (let left = 0; left < candidates.length; left++) {
      for (let right = left + 1; right < candidates.length; right++) {
        const a = candidates[left];
        const b = candidates[right];
        if (!this.sameScheduleScope(a, b)) continue;
        if (this.rangesOverlap(a.normalized.startTime!, a.normalized.endTime!, b.normalized.startTime!, b.normalized.endTime!)) {
          this.invalidate(a, 'overlap_same_doctor_day_location');
          this.invalidate(b, 'overlap_same_doctor_day_location');
        }
      }
    }
  }

  private invalidate(row: ImportPreviewRow, reason: string): void {
    if (!row.errors.includes(reason)) row.errors.push(reason);
    row.status = 'invalid';
  }

  private sameScheduleScope(a: ImportPreviewRow, b: ImportPreviewRow): boolean {
    return (
      a.normalized.doctorName === b.normalized.doctorName &&
      a.normalized.dayOfWeek === b.normalized.dayOfWeek &&
      a.normalized.location === b.normalized.location
    );
  }

  private rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return this.timeToMinutes(aStart) < this.timeToMinutes(bEnd) && this.timeToMinutes(bStart) < this.timeToMinutes(aEnd);
  }

  private rowKey(row: ImportPreviewRow): string {
    return [
      row.normalized.doctorName,
      row.normalized.specialty,
      row.normalized.location,
      row.normalized.dayOfWeek,
      row.normalized.startTime,
      row.normalized.endTime,
    ].join('|');
  }

  private attachRowIdempotencyKeys(rows: ImportPreviewRow[], tenantId: string): void {
    for (const row of rows) {
      if (row.status !== 'valid') continue;
      const rowIdempotencyKey = this.createRowIdempotencyKey(row, tenantId);
      row.rowIdempotencyKey = rowIdempotencyKey;
      row.normalized.rowIdempotencyKey = rowIdempotencyKey;
    }
  }

  private toAgendaPayload(row: ImportPreviewRow): AgendaApiPayloadPreview {
    const normalized = row.normalized as NormalizedScheduleRow;
    return {
      tenantId: normalized.tenantId,
      doctorName: normalized.doctorName,
      specialty: normalized.specialty,
      location: normalized.location,
      dayOfWeek: normalized.dayOfWeek,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      rowNumber: row.rowNumber,
      rowIdempotencyKey: normalized.rowIdempotencyKey,
    };
  }

  private createRowIdempotencyKey(row: ImportPreviewRow, tenantId: string): string {
    const normalized = row.normalized;
    return this.stableHash([
      AGENDA_IMPORT_CONTRACT_VERSION,
      tenantId,
      normalized.doctorName,
      normalized.specialty,
      normalized.location,
      normalized.dayOfWeek,
      normalized.startTime,
      normalized.endTime,
      row.rowNumber,
    ]);
  }

  private createBatchIdempotencyKey(tenantId: string, rows: ImportPreviewRow[]): string {
    return this.stableHash([
      AGENDA_IMPORT_CONTRACT_VERSION,
      tenantId,
      rows.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status,
        errors: row.errors,
        rowIdempotencyKey: row.rowIdempotencyKey ?? null,
      })),
    ]);
  }

  private stableHash(parts: unknown[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  private requireTenantId(tenantId: string): string {
    const normalizedTenantId = String(tenantId ?? '').trim();
    if (!normalizedTenantId) {
      throw new BadRequestException('tenantId requerido.');
    }
    return normalizedTenantId;
  }

  private normalizeText(value: string | undefined): string {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
  }

  private normalizeDay(value: string | undefined): string {
    const key = String(value ?? '').trim().toLowerCase();
    return VALID_DAYS[key] ?? '';
  }

  private normalizeTime(value: string | undefined): string {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? '').trim());
    return match ? `${match[1]}:${match[2]}` : '';
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private createBatchId(file: UploadedAdministrativeFile): string {
    const hash = createHash('sha256').update(file.buffer).digest('hex').slice(0, 12);
    return `preview_${hash}_${randomUUID()}`;
  }
}
