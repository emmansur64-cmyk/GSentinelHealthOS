import { AgendaApiDryRunClient } from './agenda-api-dry-run.client';
import {
  AGENDA_APPLY_DISABLED_ERROR,
  AGENDA_IMPORT_CONTRACT_VERSION,
} from './agenda-api-client';
import { AgendaApiScheduleImportPayload } from './import-preview.types';

function payload(): AgendaApiScheduleImportPayload {
  return {
    contractVersion: AGENDA_IMPORT_CONTRACT_VERSION,
    tenantId: 'tenant-admin-1',
    batchId: 'preview_test',
    batchIdempotencyKey: 'batch-key',
    rows: [
      {
        tenantId: 'tenant-admin-1',
        doctorName: 'Dra Perez',
        specialty: 'Cardiologia',
        location: 'Sede Norte',
        dayOfWeek: 'monday',
        startTime: '09:00',
        endTime: '12:00',
        rowNumber: 2,
        rowIdempotencyKey: 'row-key',
      },
    ],
  };
}

describe('AgendaApiDryRunClient', () => {
  const client = new AgendaApiDryRunClient();

  it('simula preview local sin envio real', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const result = await client.previewScheduleImport(payload());

    expect(result).toMatchObject({
      enabled: true,
      mode: 'local_contract_validation',
      wouldSend: false,
      applyBlocked: true,
      validPayloadRows: 1,
      rejectedPayloadRows: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('bloquea applyScheduleImport en fase dry-run', async () => {
    await expect(client.applyScheduleImport(payload())).rejects.toThrow(AGENDA_APPLY_DISABLED_ERROR);
  });
});
