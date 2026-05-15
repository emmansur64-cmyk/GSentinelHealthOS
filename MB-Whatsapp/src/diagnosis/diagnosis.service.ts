import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Injectable()
export class DiagnosisService {
  constructor(private readonly ai: AiService) {}

  async analyze(event: unknown): Promise<Record<string, unknown>> {
    const prompt = `Analyze this incident and return JSON:\n\n${JSON.stringify(event)}`;
    const result = await this.ai.analyze(prompt);
    return result as unknown as Record<string, unknown>;
  }
}
