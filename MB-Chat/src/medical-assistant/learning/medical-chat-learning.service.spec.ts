import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MedicalChatLearningService } from './medical-chat-learning.service';
import { MedicalAssistantMode, MedicalAssistantRole } from '../medical-assistant.types';

describe('MedicalChatLearningService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mb-chat-learning-'));
    process.env.MEDICAL_CHAT_LEARNING_PATH = join(tempDir, 'learning.jsonl');
  });

  afterEach(() => {
    delete process.env.MEDICAL_CHAT_LEARNING_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('guarda aprendizaje controlado sin texto completo como query', () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Aprende que shock septico debe priorizar guias oficiales SATI',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      citations: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'SATI guias',
          date: 'current',
        },
      ],
    });

    const record = service.record({
      request: {
        message: 'Aprende que shock septico debe priorizar guias oficiales SATI',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
        country: 'AR',
      },
      query: 'Aprende que shock septico debe priorizar guias oficiales SATI',
      mode: 'doctor_professional',
      modality: 'text',
      citations: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'SATI guias',
          date: 'current',
        },
      ],
      decision,
      outcome: 'simulated',
    });

    expect(record.queryHash).toHaveLength(64);
    expect(record.concepts).toContain('shock');
    expect(record.explicitTeaching?.sanitizedText).toContain('shock septico');
    expect(JSON.stringify(record)).not.toContain('"query"');
    expect(record.decision.execution).toBe('dry_run');
  });

  it('genera pistas adaptativas de dominios clinicos a partir de historial', () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Aprende sepsis y ventilacion con guias oficiales',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      citations: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'SATI',
          date: 'current',
        },
      ],
    });

    service.record({
      request: {
        message: 'Aprende sepsis y ventilacion con guias oficiales',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      },
      query: 'Aprende sepsis y ventilacion con guias oficiales',
      mode: 'doctor_professional',
      modality: 'text',
      citations: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'SATI',
          date: 'current',
        },
      ],
      decision,
      outcome: 'simulated',
    });

    const hints = service.getAdaptiveSourceHints();
    expect(hints.some((domain) => domain.includes('sati.org.ar'))).toBe(true);
  });
});

