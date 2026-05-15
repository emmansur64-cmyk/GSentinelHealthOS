import { ClinicalSeverity } from './clinical-policy.types';

const severityRank: Record<ClinicalSeverity, number> = {
  INFO: 1,
  WARNING: 2,
  CRITICAL: 3,
};

export function maxSeverity(current: ClinicalSeverity, incoming: ClinicalSeverity): ClinicalSeverity {
  return severityRank[incoming] > severityRank[current] ? incoming : current;
}
