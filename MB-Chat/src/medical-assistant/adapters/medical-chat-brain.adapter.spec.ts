import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MedicalChatBrainAdapter } from './medical-chat-brain.adapter';
import { IncidentPayload } from '../../common/types/brain.types';

describe('MedicalChatBrainAdapter — SECURITY BOUNDARY TESTS', () => {
  let adapter: MedicalChatBrainAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedicalChatBrainAdapter],
    }).compile();

    adapter = module.get<MedicalChatBrainAdapter>(MedicalChatBrainAdapter);
  });

  describe('processIncident() — BLOCKED', () => {
    it('should throw ForbiddenException when Medical Chat attempts incident processing', async () => {
      const incident: IncidentPayload = {
        id: 'test-incident',
        source: 'clinical-chat-medical-assistant',
        message: 'User query test',
        timestamp: new Date().toISOString(),
        metadata: {
          dryRun: true,
          channel: 'clinical_chat',
          role: 'PATIENT',
          modality: 'text',
          domain: 'medical_assistant',
        },
      };

      await expect(adapter.processIncident(incident)).rejects.toThrow(ForbiddenException);
    });

    it('should reject with specific boundary error message', async () => {
      const incident: IncidentPayload = {
        id: 'test-incident-2',
        source: 'clinical-chat-medical-assistant',
        message: 'Another test',
        timestamp: new Date().toISOString(),
        metadata: {
          dryRun: true,
          channel: 'test',
          role: 'DOCTOR',
          modality: 'text',
          domain: 'medical_assistant',
        },
      };

      try {
        await adapter.processIncident(incident);
        fail('Should have thrown ForbiddenException');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const message = (err as any).message;
        expect(message).toContain('not authorized');
        expect(message).toContain('security boundary');
        expect(message).toContain('lateral movement');
      }
    });

    it('should log security boundary violations', async () => {
      const spyLog = jest.spyOn(adapter['logger'], 'error');

      const incident: IncidentPayload = {
        id: 'test-log',
        source: 'clinical-chat-medical-assistant',
        message: 'Test log violation',
        timestamp: new Date().toISOString(),
        metadata: { dryRun: true },
      };

      try {
        await adapter.processIncident(incident);
      } catch {
        // Expected to throw
      }

      expect(spyLog).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY_BOUNDARY_VIOLATION'),
        expect.objectContaining({
          blockReason: 'LATERAL_MOVEMENT_BLOCKED',
        })
      );

      spyLog.mockRestore();
    });
  });
});
