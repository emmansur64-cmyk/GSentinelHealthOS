import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const moduleRoot = join(__dirname, '..');

function read(relativePath: string): string {
  return readFileSync(join(moduleRoot, relativePath), 'utf8');
}

describe('MB-Secretaria domain separation', () => {
  it('no monta endpoints o modulos WhatsApp en runtime Nest', () => {
    const appModule = read('src/app.module.ts');

    expect(appModule).not.toMatch(/MedicalAssistantModule|whatsapp|webhook/i);
    expect(existsSync(join(moduleRoot, 'src/medical-assistant'))).toBe(false);
  });

  it('no contiene Prisma, SQL directo ni apply real de Agenda API en runtime', () => {
    const runtimeFiles = [
      'src/app.module.ts',
      'src/import-preview/import-preview.controller.ts',
      'src/import-preview/admin-access.guard.ts',
      'src/import-preview/agenda-api-client.ts',
      'src/import-preview/agenda-api-dry-run.client.ts',
      'src/import-preview/agenda-api-http-dry-run.client.ts',
      'src/import-preview/import-preview-audit.service.ts',
      'src/import-preview/schedule-import-preview.service.ts',
      'src/import-preview/schedule-import-parser.service.ts',
    ].map(read);

    for (const content of runtimeFiles) {
      expect(content).not.toMatch(/PrismaClient|new Prisma|prisma\.|INSERT INTO|UPDATE .* SET|DELETE FROM/i);
      expect(content).not.toMatch(/fetch\(|axios|agendaApi\.apply|createAppointment/i);
      expect(content).not.toMatch(/\/appointments|\/apply|\/write|\/mutate/i);
    }

    expect(read('src/import-preview/agenda-api-client.ts')).toMatch(
      /Agenda apply is disabled in MB-Secretaria dry-run phase/,
    );
  });

  it('no monta modulos clinicos, imaging, triage o inferencia', () => {
    const appModule = read('src/app.module.ts');

    expect(appModule).not.toMatch(/AiModule|BrainModule|MlModule|MlServiceModule|KnowledgeModule/i);
    expect(appModule).not.toMatch(/diagnosis|imaging|triage|inference/i);
  });

  it('no conserva clientes WhatsApp ni scripts de webhook dentro del modulo', () => {
    expect(existsSync(join(moduleRoot, 'scripts/test_webhook.ps1'))).toBe(false);
    expect(existsSync(join(moduleRoot, 'scripts/start-ngrok.ps1'))).toBe(false);
  });

  it('no declara secretos WhatsApp en .env.example', () => {
    const envExample = read('.env.example');

    expect(envExample).not.toMatch(/WHATSAPP_|webhook/i);
  });
});
