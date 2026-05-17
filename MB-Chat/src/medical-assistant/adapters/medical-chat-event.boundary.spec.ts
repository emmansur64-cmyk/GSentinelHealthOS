import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MedicalChatEventBoundary } from './medical-chat-event.boundary';

describe('MedicalChatEventBoundary — EVENT PUBLISHING BOUNDARY TESTS', () => {
  let boundary: MedicalChatEventBoundary;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedicalChatEventBoundary],
    }).compile();

    boundary = module.get<MedicalChatEventBoundary>(MedicalChatEventBoundary);
    boundary.clearAuditLog();
  });

  describe('publishIncidentEvent() — BLOCKED', () => {
    it('should throw ForbiddenException when Medical Chat attempts incident event publishing', async () => {
      const payload = {
        incident_id: 'test-incident',
        severity: 'MEDIUM',
        action: 'test_action',
      };

      await expect(boundary.publishIncidentEvent(payload)).rejects.toThrow(ForbiddenException);
    });

    it('should block with specific authorization error', async () => {
      try {
        await boundary.publishIncidentEvent({ test: 'data' });
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const message = (err as any).message;
        expect(message).toContain('not authorized');
        expect(message).toContain('incident events');
        expect(message).toContain('security boundary');
      }
    });

    it('should record attempt in audit log', async () => {
      const payload = { incident_id: 'test' };

      try {
        await boundary.publishIncidentEvent(payload);
      } catch {
        // Expected
      }

      const log = boundary.getAuditLog();
      expect(log.length).toBe(1);
      expect(log[0]).toMatchObject({
        source: 'medical-chat',
        action: 'publish_incident_event',
        blockReason: 'AUTONOMOUS_EVENT_PUBLISHING_BLOCKED',
      });
    });
  });

  describe('publishDecisionEvent() — BLOCKED', () => {
    it('should throw ForbiddenException when Medical Chat attempts decision event publishing', async () => {
      const payload = {
        decision_id: 'test-decision',
        action: 'test_action',
      };

      await expect(boundary.publishDecisionEvent(payload)).rejects.toThrow(ForbiddenException);
    });

    it('should block with specific authorization error', async () => {
      try {
        await boundary.publishDecisionEvent({ test: 'data' });
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const message = (err as any).message;
        expect(message).toContain('not authorized');
        expect(message).toContain('decision events');
        expect(message).toContain('security boundary');
      }
    });

    it('should record attempt in audit log', async () => {
      try {
        await boundary.publishDecisionEvent({ test: 'decision' });
      } catch {
        // Expected
      }

      const log = boundary.getAuditLog();
      expect(log.length).toBe(1);
      expect(log[0]).toMatchObject({
        source: 'medical-chat',
        action: 'publish_decision_event',
        blockReason: 'AUTONOMOUS_EVENT_PUBLISHING_BLOCKED',
      });
    });
  });

  describe('publishEvent() — BLOCKED', () => {
    it('should throw ForbiddenException for generic event publishing', async () => {
      await expect(boundary.publishEvent('medical_chat.query', { query: 'test' })).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should create audit entry with topic name', async () => {
      try {
        await boundary.publishEvent('custom_topic', { data: 'test' });
      } catch {
        // Expected
      }

      const log = boundary.getAuditLog();
      expect(log.length).toBe(1);
      expect(log[0].action).toContain('publish_custom_topic');
    });

    it('should include topic in error message', async () => {
      try {
        await boundary.publishEvent('incident_escalation', { data: 'test' });
        fail('Should have thrown');
      } catch (err) {
        const message = (err as any).message;
        expect(message).toContain('incident_escalation');
      }
    });
  });

  describe('Audit Log Management', () => {
    it('should accumulate audit entries', async () => {
      try {
        await boundary.publishIncidentEvent({ id: '1' });
      } catch {
        // Expected
      }

      try {
        await boundary.publishDecisionEvent({ id: '2' });
      } catch {
        // Expected
      }

      try {
        await boundary.publishEvent('test_event', { id: '3' });
      } catch {
        // Expected
      }

      const log = boundary.getAuditLog();
      expect(log.length).toBe(3);
    });

    it('should include timestamp in audit entries', async () => {
      try {
        await boundary.publishIncidentEvent({ test: 'data' });
      } catch {
        // Expected
      }

      const log = boundary.getAuditLog();
      expect(log[0]).toHaveProperty('timestamp');
      const timestamp = new Date(log[0].timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should allow clearing audit log for testing', async () => {
      try {
        await boundary.publishIncidentEvent({ test: 'data' });
      } catch {
        // Expected
      }

      const logBefore = boundary.getAuditLog();
      expect(logBefore.length).toBeGreaterThan(0);

      boundary.clearAuditLog();

      const logAfter = boundary.getAuditLog();
      expect(logAfter.length).toBe(0);
    });
  });
});
