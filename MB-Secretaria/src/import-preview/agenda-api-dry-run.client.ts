import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AGENDA_APPLY_DISABLED_ERROR,
  AgendaApiClient,
} from './agenda-api-client';
import {
  AgendaApiDryRunResult,
  AgendaApiScheduleImportPayload,
} from './import-preview.types';

@Injectable()
export class AgendaApiDryRunClient implements AgendaApiClient {
  async previewScheduleImport(payload: AgendaApiScheduleImportPayload): Promise<AgendaApiDryRunResult> {
    this.assertSerializable(payload);
    this.assertTenant(payload);

    return {
      enabled: true,
      mode: 'local_contract_validation',
      wouldSend: false,
      applyBlocked: true,
      batchIdempotencyKey: payload.batchIdempotencyKey,
      validPayloadRows: payload.rows.length,
      rejectedPayloadRows: 0,
    };
  }

  async applyScheduleImport(_payload: AgendaApiScheduleImportPayload): Promise<never> {
    throw new Error(AGENDA_APPLY_DISABLED_ERROR);
  }

  private assertSerializable(payload: AgendaApiScheduleImportPayload): void {
    try {
      JSON.stringify(payload);
    } catch {
      throw new BadRequestException('Agenda dry-run payload is not serializable.');
    }
  }

  private assertTenant(payload: AgendaApiScheduleImportPayload): void {
    if (!payload.tenantId || payload.tenantId.trim().length === 0) {
      throw new BadRequestException('tenantId requerido para Agenda dry-run.');
    }

    for (const row of payload.rows) {
      if (!row.tenantId || row.tenantId !== payload.tenantId) {
        throw new BadRequestException('tenantId invalido en fila Agenda dry-run.');
      }
    }
  }
}
