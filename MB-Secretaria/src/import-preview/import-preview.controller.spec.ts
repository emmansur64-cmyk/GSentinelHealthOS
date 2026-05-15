import { BadRequestException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImportPreviewController } from './import-preview.controller';
import { ScheduleImportParserService } from './schedule-import-parser.service';
import { ScheduleImportPreviewService } from './schedule-import-preview.service';

describe('ImportPreviewController', () => {
  let controller: ImportPreviewController;
  let auditDir: string;

  const adminApiKey = 'test-admin-key';
  const csv = 'doctorName,specialty,location,dayOfWeek,startTime,endTime\nDra Perez,Cardiologia,Sede,lunes,09:00,10:00';

  beforeEach(async () => {
    auditDir = await mkdtemp(join(tmpdir(), 'mb-secretaria-audit-'));
    process.env.MB_SECRETARIA_ADMIN_API_KEY = adminApiKey;
    process.env.MB_SECRETARIA_ALLOWED_ROLES = 'secretary,admin';
    process.env.MB_SECRETARIA_REQUIRED_SCOPE = 'schedule:import:preview';
    process.env.MB_SECRETARIA_AUDIT_ENABLED = 'true';
    process.env.MB_SECRETARIA_AUDIT_DIR = auditDir;
    process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED = 'false';

    controller = new ImportPreviewController(
      new ScheduleImportPreviewService(new ScheduleImportParserService()),
    );
  });

  afterEach(async () => {
    delete process.env.MB_SECRETARIA_ADMIN_API_KEY;
    delete process.env.MB_SECRETARIA_ALLOWED_ROLES;
    delete process.env.MB_SECRETARIA_REQUIRED_SCOPE;
    delete process.env.MB_SECRETARIA_AUDIT_ENABLED;
    delete process.env.MB_SECRETARIA_AUDIT_DIR;
    delete process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED;
    delete process.env.AGENDA_API_BASE_URL;
    delete process.env.AGENDA_API_ALLOWED_HOSTS;
    delete process.env.AGENDA_API_AUTH_TOKEN;
    await rm(auditDir, { recursive: true, force: true });
  });

  function file(content = csv) {
    const buffer = Buffer.from(content, 'utf8');
    return {
      originalname: 'horarios.csv',
      mimetype: 'text/csv',
      size: buffer.length,
      buffer,
    };
  }

  function validHeaders(overrides: Partial<Record<'tenantId' | 'apiKey' | 'role' | 'userId' | 'scope', string>> = {}) {
    return {
      tenantId: overrides.tenantId ?? 'tenant-a',
      apiKey: overrides.apiKey ?? adminApiKey,
      role: overrides.role ?? 'secretary',
      userId: overrides.userId ?? 'user-1',
      scope: overrides.scope ?? 'schedule:import:preview',
    };
  }

  async function callPreview(
    uploadedFile = file(),
    overrides: Partial<Record<'tenantId' | 'apiKey' | 'role' | 'userId' | 'scope', string>> = {},
  ) {
    const headers = validHeaders(overrides);
    return controller.preview(uploadedFile, headers.tenantId, headers.apiKey, headers.role, headers.userId, headers.scope);
  }

  async function auditEvents(): Promise<Record<string, unknown>[]> {
    const content = await readFile(join(auditDir, 'import-preview.audit.jsonl'), 'utf8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  it('rechaza request sin archivo', async () => {
    const headers = validHeaders();
    await expect(
      controller.preview(undefined, headers.tenantId, headers.apiKey, headers.role, headers.userId, headers.scope),
    ).rejects.toThrow(BadRequestException);
  });

  it('requiere tenant para preparar contrato futuro', async () => {
    await expect(callPreview(file(), { tenantId: '' })).rejects.toThrow(BadRequestException);
  });

  it('request valido con secretary pasa', async () => {
    const result = await callPreview(file(), { role: 'secretary' });

    expect(result.applyEnabled).toBe(false);
    expect(result.agendaDryRun.wouldSend).toBe(false);
    expect(result.agendaDryRun.applyBlocked).toBe(true);
  });

  it('request valido con admin pasa', async () => {
    const result = await callPreview(file(), { role: 'admin' });

    expect(result.status).toBe('preview_only');
    expect(result.summary.validRows).toBe(1);
  });

  it('sin API key falla', async () => {
    await expect(callPreview(file(), { apiKey: '' })).rejects.toThrow('x-admin-api-key requerido.');
  });

  it('API key invalida falla', async () => {
    await expect(callPreview(file(), { apiKey: 'wrong-key' })).rejects.toThrow('API key administrativa invalida.');
  });

  it('role invalido falla', async () => {
    await expect(callPreview(file(), { role: 'viewer' })).rejects.toThrow('Rol administrativo no autorizado.');
  });

  it('scope faltante falla', async () => {
    await expect(callPreview(file(), { scope: '' })).rejects.toThrow('x-user-scope requerido.');
  });

  it('scope invalido falla', async () => {
    await expect(callPreview(file(), { scope: 'schedule:read' })).rejects.toThrow('Scope administrativo no autorizado.');
  });

  it('user faltante falla', async () => {
    await expect(callPreview(file(), { userId: '' })).rejects.toThrow('x-user-id requerido.');
  });

  it('role clinico rechazado', async () => {
    await expect(callPreview(file(), { role: 'doctor_clinical' })).rejects.toThrow('Rol administrativo no autorizado.');
  });

  it('scope clinico rechazado', async () => {
    await expect(callPreview(file(), { scope: 'diagnosis schedule:import:preview' })).rejects.toThrow(
      'Scope administrativo no autorizado.',
    );
  });

  it('auditoria registra evento exitoso sanitizado', async () => {
    const result = await callPreview();
    const [event] = await auditEvents();

    expect(event).toMatchObject({
      eventType: 'secretaria.import.preview',
      tenantId: 'tenant-a',
      userId: 'user-1',
      userRole: 'secretary',
      scope: 'schedule:import:preview',
      batchId: result.batchId,
      batchIdempotencyKey: result.agendaDryRun.batchIdempotencyKey,
      security: {
        authPassed: true,
        roleAllowed: true,
        scopeAllowed: true,
      },
    });
    expect(event.agendaDryRun).toMatchObject({
      wouldSend: false,
      applyBlocked: true,
      validPayloadRows: 1,
      rejectedPayloadRows: 0,
    });
  });

  it('auditoria registra rechazo sanitizado', async () => {
    await expect(callPreview(file(), { apiKey: 'wrong-key' })).rejects.toThrow('API key administrativa invalida.');

    const [event] = await auditEvents();
    expect(event).toMatchObject({
      eventType: 'secretaria.import.preview.rejected',
      rejectionReason: 'invalid_api_key',
      security: {
        authPassed: false,
      },
    });
  });

  it('auditoria no guarda API key ni archivo completo', async () => {
    await callPreview();
    const rawAudit = await readFile(join(auditDir, 'import-preview.audit.jsonl'), 'utf8');

    expect(rawAudit).not.toContain(adminApiKey);
    expect(rawAudit).not.toContain('Dra Perez');
    expect(rawAudit).not.toContain(csv);
  });

  it('auditoria no guarda token de Agenda API', async () => {
    process.env.AGENDA_API_DRY_RUN_HTTP_ENABLED = 'true';
    process.env.AGENDA_API_BASE_URL = 'http://agenda.example.test';
    process.env.AGENDA_API_ALLOWED_HOSTS = 'localhost,127.0.0.1';
    process.env.AGENDA_API_AUTH_TOKEN = 'agenda-token-test';

    await callPreview();
    const rawAudit = await readFile(join(auditDir, 'import-preview.audit.jsonl'), 'utf8');

    expect(rawAudit).not.toContain('agenda-token-test');
  });
});
