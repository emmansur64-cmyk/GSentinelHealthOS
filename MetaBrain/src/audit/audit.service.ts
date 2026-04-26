import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AuditRecord,
  BrainDecision,
  ExecutionResult,
  IncidentPayload,
  ProcessAuditRecord,
} from '../common/types/brain.types';
import { AuditEntity } from './audit.entity';
import { PersistenceService } from '../persistence/persistence.service';

const MAX_AUDIT_ENTRIES = 2000;

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);
  private readonly logs: AuditEntity[] = [];

  constructor(private readonly persistenceService: PersistenceService) {}

  async onModuleInit(): Promise<void> {
    try {
      const records = await this.persistenceService.getRecentAudits(MAX_AUDIT_ENTRIES);
      this.logs.push(...records);
      this.logger.log(`[Audit] Loaded ${this.logs.length} audit records from database`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Audit] Could not load audit log from database: ${msg} -- starting fresh`);
    }
  }

  register(input: IncidentPayload, decision: BrainDecision, result: ExecutionResult): AuditEntity {
    const record: AuditRecord = {
      incidentId: input.id,
      source: input.source,
      decision,
      result,
      createdAt: new Date().toISOString(),
    };

    const entity = new AuditEntity(record);
    this.append(entity);
    return entity;
  }

  logProcess(record: Omit<ProcessAuditRecord, 'createdAt'>): AuditEntity {
    const entity = new AuditEntity({
      ...record,
      createdAt: new Date().toISOString(),
    });

    this.append(entity);
    return entity;
  }

  findAll(): AuditEntity[] {
    return this.logs;
  }

  private append(entity: AuditEntity): void {
    this.logs.push(entity);
    if (this.logs.length > MAX_AUDIT_ENTRIES) {
      this.logs.shift();
    }
    this.persistenceService.fireAndForget(
      this.persistenceService.saveAudit(entity),
      `saveAudit incidentId=${entity.incidentId}`,
    );
  }
}

