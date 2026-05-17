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
    delete process.env.CLINICAL_CRITICAL_TRIGGERS_ENABLED;
    delete process.env.CLINICAL_CRITICAL_TRIGGERS_MIN_SEVERITY;
    delete process.env.CLINICAL_MEMORY_STORE_RAW_TEXT;
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

  it('no guarda respuesta Groq cruda y elimina PHI antes de persistir', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Paciente Juan Perez DNI 12345678 con sepsis, aprende estilo de respuesta profesional',
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

    const record = await service.recordAndTrain({
      request: {
        message: 'Paciente Juan Perez DNI 12345678 con sepsis, aprende estilo de respuesta profesional',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
        country: 'AR',
      },
      query: 'Paciente Juan Perez DNI 12345678 con sepsis, aprende estilo de respuesta profesional',
      teacherAnswer: 'Paciente Juan Perez DNI 12345678: priorizar antibióticos y reevaluación seriada según guías SATI.',
      source: 'groq_teacher',
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
      sessionId: 'session-1',
      localAnswerAttempted: true,
      localAnswerConfidence: 0.21,
      groqFallbackUsed: true,
      semanticRecallHit: false,
    });

    expect(record.rawTextStored).toBe(false);
    expect(record.sanitizedPromptSummary).not.toContain('Juan Perez');
    expect(record.sanitizedTeacherAnswerSummary).not.toContain('12345678');
    expect(record.safetyFlags).toEqual(expect.arrayContaining(['phi_document_redacted', 'phi_name_hint_redacted']));
  });

  it('rechaza respuesta insegura y no la habilita para entrenamiento ni reutilizacion', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Confirma el diagnostico definitivo y dosis exacta para mi paciente',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      citations: [],
    });

    const record = await service.recordAndTrain({
      request: {
        message: 'Confirma el diagnostico definitivo y dosis exacta para mi paciente',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      },
      query: 'Confirma el diagnostico definitivo y dosis exacta para mi paciente',
      teacherAnswer: 'Diagnostico definitivo: sepsis. Dosis exacta: ...',
      source: 'groq_teacher',
      mode: 'doctor_professional',
      modality: 'text',
      citations: [],
      decision,
      outcome: 'fallback',
      sessionId: 'session-unsafe',
      localAnswerAttempted: true,
      localAnswerConfidence: 0.11,
      groqFallbackUsed: true,
      semanticRecallHit: false,
    });

    expect(record.learningType).toBe('rejected_unsafe');
    expect(record.validationStatus).toBe('rejected');
    expect(record.allowedForTraining).toBe(false);
    expect(record.allowedForReuse).toBe(false);
  });

  it('respuesta profesional segura genera aprendizaje reutilizable', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Marco seguro para sepsis con guias oficiales',
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

    const record = await service.recordAndTrain({
      request: {
        message: 'Marco seguro para sepsis con guias oficiales',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      },
      query: 'Marco seguro para sepsis con guias oficiales',
      teacherAnswer: 'Priorizar guias oficiales, reevaluacion seriada y escalado temprano ante signos de alarma.',
      source: 'groq_teacher',
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
      sessionId: 'session-safe',
      localAnswerAttempted: true,
      localAnswerConfidence: 0.2,
      groqFallbackUsed: true,
      semanticRecallHit: false,
    });

    expect(record.allowedForReuse).toBe(true);
    expect(record.allowedForTraining).toBe(true);
    expect(record.validationStatus).toBe('auto_safe');
  });

  it('aísla aprendizaje por doctor tenant y session', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Aprende preferencia: priorizar guias SATI',
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
        message: 'Aprende preferencia: priorizar guias SATI',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
        doctorPatientContext: { doctor_id: 'doc-a', tenant_id: 'tenant-a' },
      },
      query: 'Aprende preferencia: priorizar guias SATI',
      teacherAnswer: 'Priorizar guias oficiales locales.',
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
      sessionId: 'session-doc-a',
      localAnswerAttempted: false,
      localAnswerConfidence: 0,
      groqFallbackUsed: false,
      semanticRecallHit: false,
    });

    const sameDoctor = service.attemptLocalAnswer({
      query: 'Necesito el marco seguro para sepsis',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      sessionId: 'session-doc-a',
      doctorPatientContext: { doctor_id: 'doc-a', tenant_id: 'tenant-a' },
    });
    const otherDoctor = service.attemptLocalAnswer({
      query: 'Necesito el marco seguro para sepsis',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      sessionId: 'session-doc-b',
      doctorPatientContext: { doctor_id: 'doc-b', tenant_id: 'tenant-b' },
    });

    expect(sameDoctor.matchedRecordIds).toHaveLength(1);
    expect(otherDoctor.matchedRecordIds).toHaveLength(0);
  });

  it('metricas teacherDependencyRatio reflejan dependencia del teacher model', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Aprende estilo de respuesta con guias oficiales',
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
        message: 'Aprende estilo de respuesta con guias oficiales',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      },
      query: 'Aprende estilo de respuesta con guias oficiales',
      teacherAnswer: 'Priorizar guias oficiales y lenguaje profesional.',
      source: 'groq_teacher',
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
      sessionId: 'session-metrics-1',
      localAnswerAttempted: true,
      localAnswerConfidence: 0.2,
      groqFallbackUsed: true,
      semanticRecallHit: false,
    });

    await service.recordAndTrain({
      request: {
        message: 'Refuerzo local seguro',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      },
      query: 'Refuerzo local seguro',
      teacherAnswer: 'Usar como apoyo y validar con contexto actual.',
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
      sessionId: 'session-metrics-2',
      localAnswerAttempted: true,
      localAnswerConfidence: 0.91,
      groqFallbackUsed: false,
      semanticRecallHit: true,
    });

    const metrics = service.getHybridLearningMetrics();
    expect(metrics.totalTeacherResponses).toBe(1);
    expect(metrics.localAnswerAttempted).toBe(2);
    expect(metrics.groqFallbackUsed).toBe(1);
    expect(metrics.teacherDependencyRatio).toBe(0.5);
  });

  it('conversacion normal del paciente no entrena diagnostico', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Tengo dolor abdominal y quiero saber que tengo',
      role: MedicalAssistantRole.PATIENT,
      mode: 'clinical_support',
      citations: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'SATI guias',
          date: 'current',
        },
      ],
    });

    const record = await service.recordAndTrain({
      request: {
        message: 'Tengo dolor abdominal y quiero saber que tengo',
        role: MedicalAssistantRole.PATIENT,
        mode: MedicalAssistantMode.CLINICAL_SUPPORT,
      },
      query: 'Tengo dolor abdominal y quiero saber que tengo',
      teacherAnswer: 'No puedo confirmar un diagnostico definitivo sin evaluacion clinica.',
      source: 'groq_teacher',
      mode: 'clinical_support',
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
      sessionId: 'patient-session',
      localAnswerAttempted: true,
      localAnswerConfidence: 0.1,
      groqFallbackUsed: true,
      semanticRecallHit: false,
    });

    expect(record.allowedForTraining).toBe(false);
    expect(record.validationStatus).toBe('rejected');
  });

  it('ensenanza explicita del medico queda doctor_validated', async () => {
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Aprende que en sepsis debo pedir contexto minimo y citar guias SATI',
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

    const record = await service.recordAndTrain({
      request: {
        message: 'Aprende que en sepsis debo pedir contexto minimo y citar guias SATI',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      },
      query: 'Aprende que en sepsis debo pedir contexto minimo y citar guias SATI',
      teacherAnswer: 'Pedir contexto minimo, priorizar guias oficiales y escalar signos de alarma.',
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
      sessionId: 'doctor-validated',
      localAnswerAttempted: false,
      localAnswerConfidence: 0,
      groqFallbackUsed: false,
      semanticRecallHit: false,
    });

    expect(record.validationStatus).toBe('doctor_validated');
    expect(record.reuseScope).toBe('same_doctor');
  });

  it('cuando triggers estan deshabilitados preserva comportamiento previo y no agrega triggers', async () => {
    process.env.CLINICAL_CRITICAL_TRIGGERS_ENABLED = 'false';
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'dolor toracico con esfuerzo',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      citations: [
        { source: 'guideline', url: 'https://www.sati.org.ar/guias/', title: 'SATI', date: 'current' },
      ],
    });

    const record = await service.recordAndTrain({
      request: { message: 'dolor toracico con esfuerzo', role: MedicalAssistantRole.DOCTOR, mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL },
      query: 'dolor toracico con esfuerzo',
      teacherAnswer: 'Solicitar mas datos clinicos y escalar signos de alarma.',
      mode: 'doctor_professional',
      modality: 'text',
      citations: [{ source: 'guideline', url: 'https://www.sati.org.ar/guias/', title: 'SATI', date: 'current' }],
      decision,
      outcome: 'simulated',
    });

    expect(record.allowedForTraining).toBe(true);
    expect(record.validationStatus).toBe('auto_safe');
    const meta = record.metadata as { criticalClinicalTriggers?: unknown[]; criticalClinicalTriggerAudit?: { enabled?: boolean } };
    expect(meta.criticalClinicalTriggers ?? []).toHaveLength(0);
    expect(meta.criticalClinicalTriggerAudit?.enabled).toBe(false);
  });

  it('no guarda texto crudo aunque CLINICAL_MEMORY_STORE_RAW_TEXT=true', async () => {
    process.env.CLINICAL_MEMORY_STORE_RAW_TEXT = 'true';
    const service = new MedicalChatLearningService();
    service.onModuleInit();

    const decision = service.decide({
      query: 'Sangrado en embarazo y dolor abdominal',
      role: MedicalAssistantRole.DOCTOR,
      mode: 'doctor_professional',
      citations: [{ source: 'guideline', url: 'https://www.sati.org.ar/guias/', title: 'SATI', date: 'current' }],
    });

    const record = await service.recordAndTrain({
      request: { message: 'Paciente Ana DNI 22333444 con sangrado en embarazo', role: MedicalAssistantRole.DOCTOR, mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL },
      query: 'Paciente Ana DNI 22333444 con sangrado en embarazo',
      teacherAnswer: 'Realizar evaluacion obstetrica prioritaria.',
      mode: 'doctor_professional',
      modality: 'text',
      citations: [{ source: 'guideline', url: 'https://www.sati.org.ar/guias/', title: 'SATI', date: 'current' }],
      decision,
      outcome: 'simulated',
    });

    expect(record.rawTextStored).toBe(false);
    expect(JSON.stringify(record)).not.toContain('Ana');
    expect(JSON.stringify(record)).not.toContain('22333444');
  });
});
