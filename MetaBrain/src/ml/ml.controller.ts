import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { MlCoreModelLoader } from '../ml-core/model.loader';
import { OnlineLearningService } from './online-learning.service';
import { OnlineBufferService } from './online-buffer.service';

@Controller('api/ml')
export class MlController {
  constructor(
    private readonly modelLoader: MlCoreModelLoader,
    private readonly onlineLearningService: OnlineLearningService,
    private readonly onlineBufferService: OnlineBufferService,
  ) {}

  @Post('reload-model')
  @HttpCode(200)
  async reloadModel(): Promise<{ reloaded: boolean; version: string; loadedAt: string | null }> {
    const reloaded = await this.modelLoader.reloadModel();
    const runtime = this.modelLoader.getRuntimeVersion();
    return {
      reloaded,
      version: runtime.pipelineVersion,
      loadedAt: runtime.loadedAt,
    };
  }

  @Post('online-learning/trigger')
  @HttpCode(202)
  async triggerOnlineLearning(): Promise<{ status: string; message: string }> {
    return this.onlineLearningService.triggerManualRetrain();
  }

  @Get('online-learning/status')
  @HttpCode(200)
  getOnlineLearningStatus(): {
    isRetrainingInProgress: boolean;
    lastRetrainingTime: Date | null;
  } {
    return this.onlineLearningService.getStatus();
  }

  @Post('online-feedback/outcome')
  @HttpCode(202)
  async registerOutcome(body: {
    incidentId: string;
    realOutcome: 'success' | 'failure' | 'blocked' | 'simulated';
    executed: boolean;
    error?: string;
    actionActual?: string;
  }): Promise<{ status: string }> {
    await this.onlineBufferService.registerOutcome(
      body.incidentId,
      body.realOutcome,
      body.executed,
      body.error,
      body.actionActual,
    );
    return { status: 'ok' };
  }
}
