import { Injectable } from '@nestjs/common';
import { OnlineTrainingBuffer } from '../persistence/schemas/online-training-buffer.schema';
import { PersistenceService } from '../persistence/persistence.service';

@Injectable()
export class OnlineBufferService {
  constructor(private readonly persistenceService: PersistenceService) {}

  async save(event: {
    incidentId: string;
    source: string;
    input: Record<string, unknown>;
    featureVector: number[];
    featureMap: Record<string, number>;
    featureNames: string[];
    actionPredicted: string;
    confidence: number;
    modelVersion: string;
  }): Promise<void> {
    await this.persistenceService.saveOnlineTrainingRecord(
      event.incidentId,
      event.source,
      event.input,
      event.featureMap,
      event.featureVector,
      event.featureNames,
      {
        modelAction: event.actionPredicted,
        modelConfidence: event.confidence,
        mlSource: 'ML',
        topFeatures: [],
      },
      event.actionPredicted,
      event.confidence,
      event.modelVersion,
    );
  }

  async getBatch(limit = 100): Promise<OnlineTrainingBuffer[]> {
    return this.persistenceService.getUntrainedBufferRecords(limit, true);
  }

  async registerOutcome(
    incidentId: string,
    realAction: 'success' | 'failure' | 'blocked' | 'simulated',
    executed: boolean,
    error?: string,
    actionActual?: string,
  ): Promise<void> {
    await this.persistenceService.updateOnlineTrainingOutcome(
      incidentId,
      realAction,
      executed,
      error,
    );
    if (actionActual) {
      await this.persistenceService.registerOnlineTrainingActualAction(
        incidentId,
        actionActual,
      );
    }
  }

  async clearProcessed(incidentIds: string[]): Promise<void> {
    await this.persistenceService.markBufferRecordsAsUsed(incidentIds);
  }
}
