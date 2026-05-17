import { Injectable, Logger, ForbiddenException } from '@nestjs/common';

export interface AuditEvent {
  timestamp: string;
  source: string;
  action: string;
  attempt: Record<string, unknown>;
  blockReason: string;
}

/**
 * MedicalChatEventBoundary: EVENT PUBLISHING BOUNDARY
 *
 * ENFORCES:
 * - Medical Chat CANNOT autonomously publish incident events
 * - All publish attempts are LOGGED for audit
 * - Future escalation requires explicit authorization
 *
 * CONTEXT: Medical Chat was able to publish to RabbitMQ incident queue via:
 * - BrainService → EventProducer → RabbitMQ incident.main queue
 *
 * This allows Medical Chat to trigger core system workflows autonomously,
 * creating uncontrolled side effects in incident processing, ML, scheduling, etc.
 *
 * BOUNDARY: Block autonomous publishing. Allow only:
 * - Audit-only logging of attempts
 * - Explicit authorization for future escalations
 */
@Injectable()
export class MedicalChatEventBoundary {
  private readonly logger = new Logger(MedicalChatEventBoundary.name);
  private readonly auditLog: AuditEvent[] = [];

  /**
   * Blocked: Medical Chat cannot publish incident events autonomously
   */
  async publishIncidentEvent(payload: Record<string, unknown>): Promise<never> {
    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      source: 'medical-chat',
      action: 'publish_incident_event',
      attempt: payload,
      blockReason: 'AUTONOMOUS_EVENT_PUBLISHING_BLOCKED',
    };

    // Log boundary violation
    this.logger.error(
      '[SECURITY_BOUNDARY_VIOLATION] Medical Chat attempted autonomous event publishing',
      event
    );

    // Record for audit trail
    this.recordAuditEvent(event);

    // Throw to prevent caller
    throw new ForbiddenException(
      'Medical Chat is not authorized to publish incident events. ' +
      'This is a security boundary to prevent autonomous triggering of system workflows.',
    );
  }

  /**
   * Blocked: Medical Chat cannot publish decision events autonomously
   */
  async publishDecisionEvent(payload: Record<string, unknown>): Promise<never> {
    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      source: 'medical-chat',
      action: 'publish_decision_event',
      attempt: payload,
      blockReason: 'AUTONOMOUS_EVENT_PUBLISHING_BLOCKED',
    };

    this.logger.error(
      '[SECURITY_BOUNDARY_VIOLATION] Medical Chat attempted autonomous decision event publishing',
      event
    );

    this.recordAuditEvent(event);

    throw new ForbiddenException(
      'Medical Chat is not authorized to publish decision events. ' +
      'This is a security boundary to prevent autonomous system workflows.',
    );
  }

  /**
   * Blocked: Generic event publishing from Medical Chat
   */
  async publishEvent(topic: string, payload: Record<string, unknown>): Promise<never> {
    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      source: 'medical-chat',
      action: `publish_${topic}`,
      attempt: payload,
      blockReason: 'AUTONOMOUS_EVENT_PUBLISHING_BLOCKED',
    };

    this.logger.error(
      `[SECURITY_BOUNDARY_VIOLATION] Medical Chat attempted to publish ${topic} event`,
      event
    );

    this.recordAuditEvent(event);

    throw new ForbiddenException(
      `Medical Chat is not authorized to publish '${topic}' events. ` +
      'This is a security boundary to prevent autonomous system workflows.',
    );
  }

  /**
   * Audit-only: Logging boundary violations for compliance
   */
  private recordAuditEvent(event: AuditEvent): void {
    this.auditLog.push(event);

    // FUTURE: Emit to AuditService for compliance tracking
    // this.auditService.recordSecurityEvent({
    //   event: 'medical_chat_event_boundary_violation',
    //   severity: 'MEDIUM',
    //   details: event,
    // });
  }

  /**
   * Get audit log (for testing and forensics)
   */
  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log (for testing)
   */
  clearAuditLog(): void {
    this.auditLog.length = 0;
  }
}
