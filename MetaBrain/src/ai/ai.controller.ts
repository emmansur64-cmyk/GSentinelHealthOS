import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { MedicalAnswer } from '../knowledge/types';
import { ApiKeyGuard } from '../ingress/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('medical-refine')
  @HttpCode(200)
  async medicalRefine(@Body() body: { input_text: string }): Promise<{ text: string }> {
    const refined = await this.aiService.refineMedicalText(body.input_text ?? '');
    return { text: refined };
  }

  @Post('medical-query')
  @HttpCode(200)
  async medicalQuery(@Body() body: {
    query: string;
    country?: string;
    topK?: number;
    imageBase64?: string;
    imageMimeType?: string;
    patientAge?: number;
    modalityHint?: string;
  }): Promise<MedicalAnswer> {
    const medical = await this.aiService.answerMedicalQuestion(
      body.query,
      body.country ?? 'US',
      body.topK ?? 6,
      body.imageBase64,
      body.imageMimeType,
      body.patientAge,
      body.modalityHint,
    );

    const refinedAnswer = await this.aiService.refineMedicalText(medical.answer);
    return { ...medical, answer: refinedAnswer };
  }
}
