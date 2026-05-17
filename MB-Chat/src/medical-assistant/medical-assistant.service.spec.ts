import { Logger } from '@nestjs/common';
import { MedicalAssistantService } from './medical-assistant.service';
import { AiService } from '../ai/ai.service';
import { MedicalAssistantMode, MedicalAssistantRole } from './medical-assistant.types';
import { MedicalChatLearningService } from './learning/medical-chat-learning.service';
import { MedicalRuntimeToolsService } from './tools/medical-runtime-tools.service';
import { MedicalChatBrainAdapter } from './adapters/medical-chat-brain.adapter';
import { ProviderPhiNotAllowedError } from '../ai/assert-groq-phi-guard';

const activeDoctorPatientContext = {
  doctor_id: 'doc-1',
  patient_id: 'pat-1',
  tenant_id: 'tenant-1',
  encounter_id: 'enc-1',
};

describe('MedicalAssistantService', () => {
  let service: MedicalAssistantService;

  const aiServiceMock = {
    classifyMedicalRole: jest.fn(() => ({
      role: 'PATIENT' as const,
      confidence: 0.92,
      signals: {
        technicalScore: 0,
        colloquialScore: 1,
        structureScore: 0,
      },
    })),
    answerMedicalQuestion: jest.fn(async () => ({
      answer: 'Respuesta de apoyo',
      citations: [],
      role: 'PATIENT' as const,
      confidence: 0.92,
    })),
    refineMedicalText: jest.fn(async (text: string) => text),
    normalizeMedicalTextForOutput: jest.fn((text: string) => text),
    getSystemLearningSeed: jest.fn(() => ''),
  } as unknown as AiService;

  const brainBoundaryMock = {
    processIncident: jest.fn(async () => {
      throw new Error('Medical Chat not authorized for incident processing');
    }),
  } as unknown as MedicalChatBrainAdapter;

  const runtimeToolsServiceMock = {
    buildContext: jest.fn(async () => ({
      generatedAt: '2026-05-15T12:00:00.000Z',
      timezone: 'America/Argentina/Buenos_Aires',
      currentTimeText: 'viernes, 15 de mayo de 2026, 09:00:00 ART',
      officialSources: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'Sociedad Argentina de Terapia Intensiva (SATI) - Guias y consensos',
          date: 'current',
        },
      ],
      officialSourceEvidence: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'Sociedad Argentina de Terapia Intensiva (SATI) - Guias y consensos',
          excerpt: 'Guias y consensos elaborados por miembros de la sociedad cientifica.',
        },
      ],
      allowedDomains: ['sati.org.ar'],
      notes: ['Internet controlado'],
    })),
  } as unknown as MedicalRuntimeToolsService;

  const medicalChatLearningServiceMock = {
    decide: jest.fn(() => ({
      action: 'answer_with_official_sources',
      confidence: 0.9,
      allowed: true,
      execution: 'dry_run',
      reason: 'test',
    })),
    getSessionMemorySummary: jest.fn(() => ''),
    attemptLocalAnswer: jest.fn(() => ({
      used: false,
      confidence: 0.2,
      citations: [],
      matchedRecordIds: [],
    })),
    recordAndTrain: jest.fn(async () => ({
      id: 'medlearn-test',
      recordedAt: '2026-05-15T12:00:00.000Z',
    })),
  } as unknown as MedicalChatLearningService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(medicalChatLearningServiceMock, 'attemptLocalAnswer').mockReturnValue({
      used: false,
      confidence: 0.2,
      citations: [],
      matchedRecordIds: [],
    });
    jest.spyOn(medicalChatLearningServiceMock, 'recordAndTrain').mockResolvedValue({
      id: 'medlearn-test',
      recordedAt: '2026-05-15T12:00:00.000Z',
    } as never);
    service = new MedicalAssistantService(
      aiServiceMock,
      runtimeToolsServiceMock,
      medicalChatLearningServiceMock,
      brainBoundaryMock,
    );
  });

  it('emergencia corta razonamiento y deriva', async () => {
    const answerMedicalQuestionSpy = jest.spyOn(aiServiceMock, 'answerMedicalQuestion');

    const result = await service.handleMedicalChatMessage({
      message: 'Tengo dolor de pecho intenso y no puedo respirar',
      role: MedicalAssistantRole.PATIENT,
      mode: MedicalAssistantMode.CLINICAL_SUPPORT,
    });

    expect(result.response.text.toLowerCase()).toContain('urgencia');
    expect(answerMedicalQuestionSpy).not.toHaveBeenCalled();
  });

  it('doctor_professional no ejecuta triage paciente', async () => {
    jest.spyOn(aiServiceMock, 'classifyMedicalRole').mockReturnValue({
      role: 'DOCTOR',
      confidence: 0.99,
      signals: {
        technicalScore: 2,
        colloquialScore: 0,
        structureScore: 1,
      },
    });
    const processIncidentSpy = jest.spyOn(brainBoundaryMock, 'processIncident');

    const result = await service.handleMedicalChatMessage({
      message: 'Paciente con fiebre 39C y leucocitosis, sugerir diferencial',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
    });

    expect(result.role).toBe('DOCTOR');
    expect(result.guidance.languageStyle).toBe('technical');
    expect(processIncidentSpy).not.toHaveBeenCalled();
  });

  it('activa protocolo de transferencia critica UCI con salida push + SBAR + XAI', async () => {
    jest.spyOn(aiServiceMock, 'classifyMedicalRole').mockReturnValue({
      role: 'DOCTOR',
      confidence: 0.98,
      signals: {
        technicalScore: 2,
        colloquialScore: 0,
        structureScore: 1,
      },
    });
    jest.spyOn(aiServiceMock, 'answerMedicalQuestion').mockResolvedValue({
      answer:
        'Transferencia critica a UCI por cirrosis descompensada con PBE y lesion renal aguda. Requiere pase formal.',
      citations: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'SATI - Guias de cuidado critico',
          date: 'current',
        },
        {
          source: 'paper',
          url: 'https://pubmed.ncbi.nlm.nih.gov/123456/',
          title: 'Albumin in SBP and kidney protection',
          date: '2020',
        },
      ],
      role: 'DOCTOR' as const,
      confidence: 0.93,
    } as any);

    const result = await service.handleMedicalChatMessage({
      message:
        'Paciente con cirrosis + PBE + lesion renal aguda, activar transferencia critica a UCI con handoff.',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
    });

    expect(result.transferProtocol?.activated).toBe(true);
    expect(result.transferProtocol?.phase).toBe('icu_critical_transfer');
    expect(result.transferProtocol?.pushAlert.toLowerCase()).toContain('alerta critica');
    expect(result.transferProtocol?.sbarReport).toContain('S (Situation)');
    expect(result.transferProtocol?.xaiValidation.supportingGuidelines.length).toBeGreaterThan(0);
    expect(result.transferProtocol?.xaiValidation.supportingPapers.length).toBeGreaterThan(0);
  });

  it('inyecta herramientas controladas al flujo medico', async () => {
    const toolsSpy = jest.spyOn(runtimeToolsServiceMock, 'buildContext');
    const answerMedicalQuestionSpy = jest.spyOn(aiServiceMock, 'answerMedicalQuestion');

    const result = await service.handleMedicalChatMessage({
      message: 'Paciente con shock septico en UTI, sugerir enfoque inicial',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      country: 'AR',
      doctorPatientContext: activeDoctorPatientContext,
    });

    expect(toolsSpy).toHaveBeenCalledWith(
      'Paciente con shock septico en UTI, sugerir enfoque inicial',
      'AR',
    );
    expect(answerMedicalQuestionSpy).toHaveBeenCalledWith(
      'Paciente con shock septico en UTI, sugerir enfoque inicial',
      'AR',
      6,
      undefined,
      undefined,
      undefined,
      undefined,
      'DOCTOR',
      expect.objectContaining({
        timezone: 'America/Argentina/Buenos_Aires',
        allowedDomains: ['sati.org.ar'],
      }),
      undefined,
      expect.any(String),
    );
    expect(result.guidance.warnings).toContain(
      'Herramientas activas: hora real, clima operativo y fuentes oficiales controladas.',
    );
  });

  it('registra aprendizaje clinico controlado sin ejecutar acciones', async () => {
    const decideSpy = jest.spyOn(medicalChatLearningServiceMock, 'decide');
    const recordSpy = jest.spyOn(medicalChatLearningServiceMock, 'recordAndTrain');

    const result = await service.handleMedicalChatMessage({
      message: 'Aprende que para shock septico se debe priorizar guias oficiales y contexto local',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      country: 'AR',
      doctorPatientContext: activeDoctorPatientContext,
    });

    expect(decideSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'doctor_professional',
      role: MedicalAssistantRole.DOCTOR,
    }));
    expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'simulated',
      query: 'Aprende que para shock septico se debe priorizar guias oficiales y contexto local',
      source: 'groq_teacher',
      groqFallbackUsed: true,
    }));
    expect(result.learning).toEqual({
      enabled: true,
      action: 'answer_with_official_sources',
      confidence: 0.9,
      mode: 'controlled_dry_run',
    });
  });

  it('error de provider devuelve fallback seguro', async () => {
    jest.spyOn(aiServiceMock, 'answerMedicalQuestion').mockRejectedValue(new Error('ProviderUnavailable'));

    const result = await service.handleMedicalChatMessage({
      message: 'Dolor abdominal de 2 dias',
      role: MedicalAssistantRole.PATIENT,
      mode: MedicalAssistantMode.CLINICAL_SUPPORT,
    });

    expect(result.response.text.toLowerCase()).toContain('no puedo generar una respuesta clinica segura');
    expect(result.response.citations).toEqual([]);
  });

  it('localAnswerConfidence baja fuerza fallback a Groq', async () => {
    const localAttemptSpy = jest.spyOn(medicalChatLearningServiceMock, 'attemptLocalAnswer');
    const answerMedicalQuestionSpy = jest.spyOn(aiServiceMock, 'answerMedicalQuestion');

    await service.handleMedicalChatMessage({
      message: 'Paciente con sepsis, sugerir marco general con guias',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
    });

    expect(localAttemptSpy).toHaveBeenCalled();
    expect(answerMedicalQuestionSpy).toHaveBeenCalled();
  });

  it('respuesta local validada evita fallback a Groq', async () => {
    jest.spyOn(medicalChatLearningServiceMock, 'attemptLocalAnswer').mockReturnValue({
      used: true,
      confidence: 0.91,
      answer: 'Memoria clinica validada recuperada para soporte local:\n- Priorizar guias oficiales y reevaluacion seriada.',
      citations: [
        {
          source: 'guideline',
          url: 'https://www.sati.org.ar/guias/',
          title: 'SATI',
          date: 'current',
        },
      ],
      matchedRecordIds: ['rec-1'],
    });
    const answerMedicalQuestionSpy = jest.spyOn(aiServiceMock, 'answerMedicalQuestion');

    const result = await service.handleMedicalChatMessage({
      message: 'Recordame el marco seguro para sepsis con guias',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
    });

    expect(answerMedicalQuestionSpy).not.toHaveBeenCalled();
    expect(result.response.text).toContain('Memoria clinica validada recuperada');
  });

  it('bloqueo PHI en provider devuelve fallback seguro sin exponer datos', async () => {
    jest
      .spyOn(aiServiceMock, 'answerMedicalQuestion')
      .mockRejectedValue(new ProviderPhiNotAllowedError());

    const result = await service.handleMedicalChatMessage({
      message: 'Mi paciente Juan Perez DNI 12345678 tiene dolor toracico',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
    });

    expect(result.response.text.toLowerCase()).toContain('no puedo generar una respuesta clinica segura');
    expect(result.response.citations).toEqual([]);
  });

  it('minimum data solicita contexto clinico minimo', async () => {
    const answerMedicalQuestionSpy = jest.spyOn(aiServiceMock, 'answerMedicalQuestion');

    const result = await service.handleMedicalChatMessage({
      message: 'me siento mal',
      role: MedicalAssistantRole.PATIENT,
      mode: MedicalAssistantMode.CLINICAL_SUPPORT,
    });

    expect(result.response.text.toLowerCase()).toContain('datos minimos');
    expect(answerMedicalQuestionSpy).not.toHaveBeenCalled();
  });

  it('diagnostico definitivo queda bloqueado en patient-facing', async () => {
    const answerMedicalQuestionSpy = jest.spyOn(aiServiceMock, 'answerMedicalQuestion');

    const result = await service.handleMedicalChatMessage({
      message: 'dime un diagnostico definitivo',
      role: MedicalAssistantRole.PATIENT,
      mode: MedicalAssistantMode.CLINICAL_SUPPORT,
    });

    expect(result.response.text.toLowerCase()).toContain('no puedo confirmar un diagnostico definitivo');
    expect(answerMedicalQuestionSpy).not.toHaveBeenCalled();
  });

  it('no loguea message completo', async () => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.handleMedicalChatMessage({
      message: 'Texto sensible del paciente: dolor abdominal con antecedentes privados',
      role: MedicalAssistantRole.PATIENT,
      mode: MedicalAssistantMode.CLINICAL_SUPPORT,
    });

    const serializedLogs = loggerSpy.mock.calls.map((call) => String(call[0])).join(' ');
    expect(serializedLogs).not.toContain('Texto sensible del paciente');
    expect(serializedLogs).toContain('requestId');

    loggerSpy.mockRestore();
  });

  it('doctor sin doctorPatientContext funciona en modo libre', async () => {
    const result = await service.handleMedicalChatMessage({
      message: 'Evaluar esquema antibiotico en internacion',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
    });

    expect(result.role).toBe('DOCTOR');
    expect(result.response.text.toLowerCase()).not.toContain('doctorpatientcontext is required');
  });

  it('paciente de otro tenant devuelve fallback por PATIENT_CONTEXT_ACCESS_DENIED', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await service.handleMedicalChatMessage({
      message: 'Analizar riesgo tromboembolico',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
      activePatientClinicalHistory: {
        doctor_id: 'doc-1',
        patient_id: 'pat-1',
        tenant_id: 'tenant-2',
        encounter_id: 'enc-1',
        clinical_summary: 'Resumen clinico corto y sanitizado.',
        is_sanitized: true,
      },
    });

    expect(result.response.text.toLowerCase()).toContain('no puedo generar una respuesta clinica segura');
    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
    expect(logs).toContain('PATIENT_CONTEXT_ACCESS_DENIED');
    loggerErrorSpy.mockRestore();
  });

  it('paciente sin encounter activo devuelve fallback por PATIENT_CONTEXT_ACCESS_DENIED', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await service.handleMedicalChatMessage({
      message: 'Ajustar fluidoterapia inicial',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
      activePatientClinicalHistory: {
        doctor_id: 'doc-1',
        patient_id: 'pat-1',
        tenant_id: 'tenant-1',
        encounter_id: 'enc-2',
        clinical_summary: 'Resumen clinico corto y sanitizado.',
        is_sanitized: true,
      },
    });

    expect(result.response.text.toLowerCase()).toContain('no puedo generar una respuesta clinica segura');
    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
    expect(logs).toContain('PATIENT_CONTEXT_ACCESS_DENIED');
    loggerErrorSpy.mockRestore();
  });

  it('historial completo no sanitizado devuelve fallback por PROVIDER_PHI_NOT_ALLOWED', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await service.handleMedicalChatMessage({
      message: 'Evaluar riesgo cardiovascular',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: activeDoctorPatientContext,
      activePatientClinicalHistory: {
        doctor_id: 'doc-1',
        patient_id: 'pat-1',
        tenant_id: 'tenant-1',
        encounter_id: 'enc-1',
        clinical_summary: 'Historia completa de Juan Perez DNI 12345678 con datos identificables.',
        is_sanitized: false,
      },
    });

    expect(result.response.text.toLowerCase()).toContain('no puedo generar una respuesta clinica segura');
    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
    expect(logs).toContain('PROVIDER_PHI_NOT_ALLOWED');
    loggerErrorSpy.mockRestore();
  });

  it('contexto doctor sin patient_id funciona para chat libre', async () => {
    const result = await service.handleMedicalChatMessage({
      message: 'Interpretar gasometria arterial',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: {
        doctor_id: 'doc-1',
        tenant_id: 'tenant-1',
      } as any,
    });

    expect(result.role).toBe('DOCTOR');
    expect(result.response.text.toLowerCase()).not.toContain('patient_id is required');
  });

  it('doctor_id ausente devuelve fallback por INVALID_DOCTOR_PATIENT_CONTEXT', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await service.handleMedicalChatMessage({
      message: 'Evaluar infeccion respiratoria baja',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      doctorPatientContext: {
        patient_id: 'pat-1',
        tenant_id: 'tenant-1',
        encounter_id: 'enc-1',
      } as any,
    });

    expect(result.response.text.toLowerCase()).toContain('no puedo generar una respuesta clinica segura');
    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
    expect(logs).toContain('INVALID_DOCTOR_PATIENT_CONTEXT');
    loggerErrorSpy.mockRestore();
  });
});
