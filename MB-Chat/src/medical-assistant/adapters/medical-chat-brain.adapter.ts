import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { IncidentPayload, IncidentResult } from '../../common/types/brain.types';

/**
 * MedicalChatBrainAdapter: BOUNDARY ENFORCEMENT
 *
 * Medical Chat MUST NOT autonomously invoke incident processing.
 * This adapter enforces a read-only boundary where:
 * - processIncident() is BLOCKED (throws ForbiddenException)
 * - All attempts are LOGGED for audit trail
 * - Future escalation requires explicit authorization
 *
 * CONTEXT: Brain.processIncident() is core system ML decision engine.
 * Medical Chat is a patient-facing chat service.
 * Allowing autonomous incident processing = lateral movement to core.
 */
@Injectable()
export class MedicalChatBrainAdapter {
  private readonly logger = new Logger(MedicalChatBrainAdapter.name);

  /**
   * Blocked: Medical Chat cannot invoke incident processing autonomously.
   * Violation logged as SECURITY_BOUNDARY_VIOLATION for audit.
   */
  async processIncident(input: IncidentPayload): Promise<IncidentResult> {
    const attempt = {
      timestamp: new Date().toISOString(),
      source: input.source,
      message: input.message?.slice(0, 100),
      metadata: input.metadata,
    };

    // Log boundary violation attempt
    this.logger.error(
      '[SECURITY_BOUNDARY_VIOLATION] Medical Chat attempted autonomous incident processing',
      {
        attempt,
        blockReason: 'LATERAL_MOVEMENT_BLOCKED',
      }
    );

    // Audit trail for compliance
    this.recordBoundaryViolation(attempt);

    // Throw to prevent caller from proceeding
    throw new ForbiddenException(
      'Medical Chat is not authorized to invoke incident processing. ' +
      'This is a security boundary to prevent lateral movement to core Brain services.',
    );
  }

  /**
   * Audit-only: Log the boundary violation for forensics.
   * In production, this could emit to AuditService or SIEM.
   */
  private recordBoundaryViolation(attempt: Record<string, unknown>): void {
    // FUTURE: Emit to AuditService for compliance tracking
    // this.auditService.recordSecurityEvent({
    //   event: 'medical_chat_brain_boundary_violation',
    //   severity: 'MEDIUM',
    //   attempt,
    // });
  }
}
