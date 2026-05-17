import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MedicalChatLearningService } from './medical-chat-learning.service';
import { MedicalAssistantMode, MedicalAssistantRole } from '../medical-assistant.types';

describe('semantic-memory hybrid recall', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mb-semantic-memory-'));
    process.env.MEDICAL_CHAT_LEARNING_PATH = join(tempDir, 'learning.jsonl');
  });

  afterEach(() => {
    delete process.env.MEDICAL_CHAT_LEARNING_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reinicio conserva JSONL y la recuperacion trae patrones correctos', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Aprende marco seguro para ventilacion con guias oficiales',
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

    await service.recordAndTrain({
      request: {
        message: 'Aprende marco seguro para ventilacion con guias oficiales',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
        doctorPatientContext: { doctor_id: 'doc-1', tenant_id: 'tenant-1' },
      },
      query: 'Aprende marco seguro para ventilacion con guias oficiales',
      teacherAnswer: 'Priorizar objetivos ventilatorios, reevaluacion seriada y guias oficiales.',
      source: 'doctor_teaching',
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
      sessionId: 'vent-session',
      localAnswerAttempted: false,
      localAnswerConfidence: 0,
      groqFallbackUsed: false,
      semanticRecallHit: false,
    });

    const reloaded = new MedicalChatLearningService();
    reloaded.onModuleInit();

    const local = reloaded.attemptLocalAnswer({
      query: 'Necesito recordar el marco seguro para ventilacion mecanica',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      sessionId: 'vent-session',
      doctorPatientContext: { doctor_id: 'doc-1', tenant_id: 'tenant-1' },
    });

    expect(reloaded.getRecent(5)).toHaveLength(1);
    expect(local.used).toBe(true);
    expect(local.answer).toContain('Memoria clinica validada recuperada');
    expect(local.citations[0]?.url).toContain('sati.org.ar');
  });

  it('patrones globales solo se permiten cuando son seguros', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Patron seguro de escalado ante signos de alarma',
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

    const safeRecord = await service.recordAndTrain({
      request: {
        message: 'Patron seguro de escalado ante signos de alarma',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
        doctorPatientContext: { doctor_id: 'doc-1', tenant_id: 'tenant-1' },
      },
      query: 'Patron seguro de escalado ante signos de alarma',
      teacherAnswer: 'Escalar urgencias sin improvisar diagnostico definitivo.',
      source: 'official_source',
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
      sessionId: 'global-safe',
      localAnswerAttempted: false,
      localAnswerConfidence: 0,
      groqFallbackUsed: false,
      semanticRecallHit: false,
    });

    const unsafeRecord = await service.recordAndTrain({
      request: {
        message: 'Confirma diagnostico definitivo de mi paciente',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
        doctorPatientContext: { doctor_id: 'doc-1', tenant_id: 'tenant-1' },
      },
      query: 'Confirma diagnostico definitivo de mi paciente',
      teacherAnswer: 'Diagnostico definitivo confirmado.',
      source: 'groq_teacher',
      mode: 'doctor_professional',
      modality: 'text',
      citations: [],
      decision,
      outcome: 'fallback',
      sessionId: 'unsafe-global',
      localAnswerAttempted: true,
      localAnswerConfidence: 0.1,
      groqFallbackUsed: true,
      semanticRecallHit: false,
    });

    expect(safeRecord.reuseScope).toBe('global_safe');
    expect(unsafeRecord.reuseScope).toBe('none');
    expect(unsafeRecord.allowedForReuse).toBe(false);
  });
});