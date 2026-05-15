import { Logger } from '@nestjs/common';
import { MedicalAssistantService } from './medical-assistant.service';
import { AiService } from '../ai/ai.service';
import { BrainService } from '../brain/brain.service';
import { MedicalAssistantMode, MedicalAssistantRole } from './medical-assistant.types';

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
  } as unknown as AiService;

  const brainServiceMock = {
    processIncident: jest.fn(async () => ({
      status: 'SIMULATED',
      action: 'NO_OP',
      reason: 'test',
    })),
  } as unknown as BrainService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicalAssistantService(aiServiceMock, brainServiceMock);
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
    const processIncidentSpy = jest.spyOn(brainServiceMock, 'processIncident');

    const result = await service.handleMedicalChatMessage({
      message: 'Paciente con fiebre 39C y leucocitosis, sugerir diferencial',
      role: MedicalAssistantRole.DOCTOR,
      mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
    });

    expect(result.role).toBe('DOCTOR');
    expect(result.guidance.languageStyle).toBe('technical');
    expect(processIncidentSpy).not.toHaveBeenCalled();
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
});
