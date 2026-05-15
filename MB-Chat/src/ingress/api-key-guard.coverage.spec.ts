import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AiController } from '../ai/ai.controller';
import { MlController } from '../ml/ml.controller';
import { MlServiceController } from '../ml-service/ml-service.controller';
import { MedicalAssistantController } from '../medical-assistant/medical-assistant.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

describe('operational controllers auth guard', () => {
  const controllers = [
    AiController,
    MlController,
    MlServiceController,
    MedicalAssistantController,
  ];

  it('protects sensitive operational controllers with ApiKeyGuard', () => {
    for (const controller of controllers) {
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
      expect(guards).toContain(ApiKeyGuard);
    }
  });
});
