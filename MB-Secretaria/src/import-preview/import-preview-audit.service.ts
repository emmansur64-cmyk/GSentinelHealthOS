import { Injectable } from '@nestjs/common';
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AdminAccessContext, AdminAccessRejectionReason } from './admin-access.guard';
import { ImportPreviewResponse } from './import-preview.types';

export interface ImportPreviewRejectedAuditInput {
  reason: AdminAccessRejectionReason;
  tenantId?: string;
  userId?: string;
  userRole?: string;
  scope?: string;
}

@Injectable()
export class ImportPreviewAuditService {
  async recordSuccess(context: AdminAccessContext, preview: ImportPreviewResponse): Promise<void> {
    await this.append({
      eventId: randomUUID(),
      eventType: 'secretaria.import.preview',
      timestamp: new Date().toISOString(),
      tenantId: context.tenantId,
      userId: context.userId,
      userRole: context.userRole,
      scope: context.scope,
      batchId: preview.batchId,
      batchIdempotencyKey: preview.agendaDryRun.batchIdempotencyKey,
      summary: preview.summary,
      agendaDryRun: {
        wouldSend: preview.agendaDryRun.wouldSend,
        applyBlocked: preview.agendaDryRun.applyBlocked,
        validPayloadRows: preview.agendaDryRun.validPayloadRows,
        rejectedPayloadRows: preview.agendaDryRun.rejectedPayloadRows,
        remoteDryRunAttempted: preview.agendaDryRun.remoteDryRunAttempted ?? false,
        remoteDryRunSent: preview.agendaDryRun.remoteDryRunSent ?? false,
        remoteDryRunHost: preview.agendaDryRun.remoteDryRunHost,
        remoteDryRunPath: preview.agendaDryRun.remoteDryRunPath,
        remoteDryRunStatus: preview.agendaDryRun.remoteDryRunStatus,
        remoteDryRunErrorCode: preview.agendaDryRun.remoteDryRunErrorCode,
      },
      security: context.security,
    });
  }

  async recordRejected(input: ImportPreviewRejectedAuditInput): Promise<void> {
    await this.append({
      eventId: randomUUID(),
      eventType: 'secretaria.import.preview.rejected',
      timestamp: new Date().toISOString(),
      tenantId: this.redactMissing(input.tenantId),
      userId: this.redactMissing(input.userId),
      userRole: this.redactMissing(input.userRole),
      scope: this.redactMissing(input.scope),
      rejectionReason: input.reason,
      security: {
        authPassed: false,
        roleAllowed: input.reason !== 'invalid_role',
        scopeAllowed: input.reason !== 'missing_scope' && input.reason !== 'invalid_scope',
      },
    });
  }

  private async append(event: Record<string, unknown>): Promise<void> {
    if (!this.enabled()) return;
    const directory = this.auditDir();
    await mkdir(directory, { recursive: true });
    await appendFile(join(directory, 'import-preview.audit.jsonl'), `${JSON.stringify(event)}\n`, 'utf8');
  }

  private enabled(): boolean {
    return String(process.env.MB_SECRETARIA_AUDIT_ENABLED ?? 'true').toLowerCase() === 'true';
  }

  private auditDir(): string {
    return process.env.MB_SECRETARIA_AUDIT_DIR || './audit';
  }

  private redactMissing(value: string | undefined): string {
    const clean = String(value ?? '').trim();
    return clean || 'missing';
  }
}
