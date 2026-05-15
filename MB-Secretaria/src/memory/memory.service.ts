import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BrainDecision,
  ExecutionResult,
  IncidentPayload,
  MlPredictionTrace,
} from '../common/types/brain.types';
import { IncidentMemoryRecord } from './schemas/incidents.schema';
import { PersistenceService } from '../persistence/persistence.service';
import { sanitizeForPersistence } from '../common/utils/persistence-sanitizer.util';

@Injectable()
export class MemoryService implements OnModuleInit {
  private static readonly MAX_ENTRIES = 1000;

  private readonly logger = new Logger(MemoryService.name);
  private readonly incidents: IncidentMemoryRecord[] = [];

  constructor(private readonly persistenceService: PersistenceService) {}

  async onModuleInit(): Promise<void> {
    try {
      const records = await this.persistenceService.getRecentIncidents(MemoryService.MAX_ENTRIES);
      this.incidents.push(...records);
      this.logger.log(`[Memory] Loaded ${this.incidents.length} incident records from database`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Memory] Could not load incidents from database: ${msg} -- starting fresh`);
    }
  }

  rememberIncident(
    incident: IncidentPayload,
    decision: BrainDecision,
    result: ExecutionResult,
    metadata?: {
      prediction?: MlPredictionTrace;
      realOutcome?: 'success' | 'failure' | 'blocked' | 'simulated';
    },
  ): IncidentMemoryRecord {
    const record: IncidentMemoryRecord = {
      incident,
      decision,
      result,
      ...(metadata?.prediction ? { prediction: metadata.prediction } : {}),
      ...(metadata?.realOutcome ? { realOutcome: metadata.realOutcome } : {}),
      storedAt: new Date().toISOString(),
    };
    const sanitizedRecord = sanitizeForPersistence(record);

    this.incidents.push(sanitizedRecord);
    if (this.incidents.length > MemoryService.MAX_ENTRIES) {
      this.incidents.shift();
    }

    this.persistenceService.fireAndForget(
      this.persistenceService.saveIncident(sanitizedRecord),
      `saveIncident incidentId=${sanitizedRecord.incident.id}`,
    );
    this.persistenceService.fireAndForget(
      this.persistenceService.saveDecision(sanitizedRecord),
      `saveDecision incidentId=${sanitizedRecord.incident.id}`,
    );
    this.persistenceService.fireAndForget(
      this.persistenceService.saveFeatures(sanitizedRecord),
      `saveFeatures incidentId=${sanitizedRecord.incident.id}`,
    );

    return sanitizedRecord;
  }

  last(limit = 10): IncidentMemoryRecord[] {
    return this.incidents.slice(-limit);
  }
}
