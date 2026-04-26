import { AuditRecord, ProcessAuditRecord } from '../common/types/brain.types';

type AuditEntityInput =
  | AuditRecord
  | (Omit<ProcessAuditRecord, 'createdAt'> & {
      createdAt: string;
      decision?: AuditRecord['decision'];
      result?: AuditRecord['result'];
    });

export class AuditEntity {
  incidentId: string;
  source: string;
  decision?: AuditRecord['decision'];
  result?: AuditRecord['result'];
  status?: ProcessAuditRecord['status'];
  diagnosisCode?: ProcessAuditRecord['diagnosisCode'];
  decisionAction?: ProcessAuditRecord['decisionAction'];
  actionType?: ProcessAuditRecord['actionType'];
  prediction?: ProcessAuditRecord['prediction'];
  realOutcome?: ProcessAuditRecord['realOutcome'];
  error?: ProcessAuditRecord['error'];
  createdAt: string;

  constructor(data: AuditEntityInput) {
    const processData = data as Partial<ProcessAuditRecord>;

    this.incidentId = data.incidentId;
    this.source = data.source;
    this.decision = data.decision;
    this.result = data.result;
    this.status = processData.status;
    this.diagnosisCode = processData.diagnosisCode;
    this.decisionAction = processData.decisionAction;
    this.actionType = processData.actionType;
    this.prediction = processData.prediction;
    this.realOutcome = processData.realOutcome;
    this.error = processData.error;
    this.createdAt = data.createdAt;
  }
}
