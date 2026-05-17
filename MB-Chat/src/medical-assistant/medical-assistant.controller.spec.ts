import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { MedicalAssistantController } from './medical-assistant.controller';
import { MedicalAssistantService } from './medical-assistant.service';
import { ApiKeyGuard } from '../ingress/guards/api-key.guard';
import { MedicalAssistantMode, MedicalAssistantRole } from './medical-assistant.types';

describe('MedicalAssistantController /api/assistant/chat', () => {
  let app: INestApplication;

  const medicalAssistantServiceMock: Pick<MedicalAssistantService, 'handleMedicalChatMessage'> = {
    handleMedicalChatMessage: jest.fn(async (body) => ({
      channel: body.channel ?? 'clinical_chat',
      role: 'PATIENT' as const,
      roleConfidence: 0.9,
      modality: 'text' as const,
      response: {
        text: 'ok',
        citations: [],
      },
      guidance: {
        languageStyle: 'simple' as const,
        warnings: [],
      },
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MedicalAssistantController],
      providers: [{ provide: MedicalAssistantService, useValue: medicalAssistantServiceMock }],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('payload valido responde', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        message: 'Tengo fiebre hace 2 dias',
        role: MedicalAssistantRole.PATIENT,
        mode: MedicalAssistantMode.CLINICAL_SUPPORT,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.response.text).toBe('ok');
      });
  });

  it('payload sin message devuelve 400', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        role: 'PATIENT',
        mode: MedicalAssistantMode.CLINICAL_SUPPORT,
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('Invalid chat request payload.');
      });
  });

  it('payload con role invalido devuelve 400', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        message: 'Dolor toracico',
        role: 'NURSE',
        mode: MedicalAssistantMode.CLINICAL_SUPPORT,
      })
      .expect(400);
  });

  it('payload gigante devuelve 400', async () => {
    const giantMessage = 'a'.repeat(5001);

    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        message: giantMessage,
        role: MedicalAssistantRole.PATIENT,
      })
      .expect(400);
  });

  it('acepta cliente legacy con query como alias de message', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        query: 'Tengo dolor de garganta hace 3 dias',
        role: MedicalAssistantRole.PATIENT,
        mode: MedicalAssistantMode.CLINICAL_SUPPORT,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.response.text).toBe('ok');
      });
  });

  it('doctor sin doctorPatientContext responde (chat libre)', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        message: 'Paciente con disnea y fiebre',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.response.text).toBe('ok');
      });
  });

  it('doctor con doctorPatientContext valido responde', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        message: 'Paciente con disnea y fiebre',
        role: MedicalAssistantRole.DOCTOR,
        mode: MedicalAssistantMode.DOCTOR_PROFESSIONAL,
        doctorPatientContext: {
          doctor_id: 'doc-1',
          patient_id: 'pat-1',
          tenant_id: 'tenant-1',
          encounter_id: 'enc-1',
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.response.text).toBe('ok');
      });
  });
});
