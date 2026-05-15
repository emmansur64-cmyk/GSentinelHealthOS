import { AgendaApiDryRunClient } from './agenda-api-dry-run.client';
import { AgendaApiHttpDryRunClient } from './agenda-api-http-dry-run.client';
import { AGENDA_IMPORT_CONTRACT_VERSION } from './agenda-api-client';
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

function resetAgendaEnv(): void {
  delete process.env.AGENDA_API_BASE_URL;
  delete process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED;
  delete process.env.AGENDA_API_DRY_RUN_PATH;
  delete process.env.AGENDA_API_TIMEOUT_MS;
  delete process.env.AGENDA_API_ALLOWED_HOSTS;
  delete process.env.AGENDA_API_AUTH_HEADER;
  delete process.env.AGENDA_API_AUTH_TOKEN;
}

describe('AgendaApiHttpDryRunClient', () => {
  beforeEach(() => resetAgendaEnv());
  afterEach(() => resetAgendaEnv());

  it('HTTP dry-run desactivado por defecto no envia nada', async () => {
    const transport = jest.fn();
    const client = new AgendaApiHttpDryRunClient(new AgendaApiDryRunClient(), transport);

    const result = await client.previewScheduleImport(payload());

    expect(result.mode).toBe('local_contract_validation');
    expect(result.wouldSend).toBe(false);
    expect(result.applyBlocked).toBe(true);
    expect(transport).not.toHaveBeenCalled();
  });

  it('HTTP dry-run habilitado con host allowlisted envia solo dry-run', async () => {
    process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED = 'true';
    process.env.AGENDA_API_BASE_URL = 'http://localhost:3000';
    process.env.AGENDA_API_ALLOWED_HOSTS = 'localhost';
    process.env.AGENDA_API_AUTH_TOKEN = 'test-token';
    const transport = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const client = new AgendaApiHttpDryRunClient(new AgendaApiDryRunClient(), transport);

    const result = await client.previewScheduleImport(payload());
    const [url, init] = transport.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(url).toBe('http://localhost:3000/admin/schedule-import/dry-run');
    expect(init.method).toBe('POST');
    expect(body).toMatchObject({
      tenantId: 'tenant-admin-1',
      batchId: 'preview_test',
      batchIdempotencyKey: 'batch-key',
      mode: 'dry_run',
      apply: false,
      contractVersion: 'mb-secretaria-import-v1',
    });
    expect(String(init.body)).toContain('row-key');
    expect(String(init.body)).not.toMatch(/baseUrl|override/i);
    expect(result).toMatchObject({
      mode: 'remote_dry_run_contract_validation',
      wouldSend: true,
      applyBlocked: true,
      remoteDryRunAttempted: true,
      remoteDryRunSent: true,
      remoteDryRunHost: 'localhost',
      remoteDryRunPath: '/admin/schedule-import/dry-run',
      remoteDryRunStatus: 200,
    });
  });

  it('host no allowlisted rechaza envio', async () => {
    process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED = 'true';
    process.env.AGENDA_API_BASE_URL = 'http://agenda.example.test';
    process.env.AGENDA_API_ALLOWED_HOSTS = 'localhost,127.0.0.1';
    const transport = jest.fn();
    const client = new AgendaApiHttpDryRunClient(new AgendaApiDryRunClient(), transport);

    const result = await client.previewScheduleImport(payload());

    expect(transport).not.toHaveBeenCalled();
    expect(result.wouldSend).toBe(false);
    expect(result.remoteDryRunSent).toBe(false);
    expect(result.remoteDryRunErrorCode).toBe('host_not_allowlisted');
  });

  it('path con apply write o mutate se rechaza', async () => {
    process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED = 'true';
    process.env.AGENDA_API_BASE_URL = 'http://localhost:3000';
    process.env.AGENDA_API_DRY_RUN_PATH = '/admin/schedule-import/apply';
    const transport = jest.fn();
    const client = new AgendaApiHttpDryRunClient(new AgendaApiDryRunClient(), transport);

    const result = await client.previewScheduleImport(payload());

    expect(transport).not.toHaveBeenCalled();
    expect(result.remoteDryRunErrorCode).toBe('unsafe_dry_run_path');
  });

  it('timeout configurado se aplica al request', async () => {
    process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED = 'true';
    process.env.AGENDA_API_BASE_URL = 'http://localhost:3000';
    process.env.AGENDA_API_TIMEOUT_MS = '25';
    const transport = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal).toBeDefined();
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    const client = new AgendaApiHttpDryRunClient(new AgendaApiDryRunClient(), transport);

    const result = await client.previewScheduleImport(payload());

    expect(result.remoteDryRunStatus).toBe(200);
  });

  it('URL desde payload no puede overridear destino', async () => {
    process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED = 'true';
    process.env.AGENDA_API_BASE_URL = 'http://localhost:3000';
    const transport = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const client = new AgendaApiHttpDryRunClient(new AgendaApiDryRunClient(), transport);
    const maliciousPayload = {
      ...payload(),
      baseUrl: 'http://agenda.example.test/apply',
    } as AgendaApiScheduleImportPayload;

    await client.previewScheduleImport(maliciousPayload);

    const [url] = transport.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/admin/schedule-import/dry-run');
  });
});
