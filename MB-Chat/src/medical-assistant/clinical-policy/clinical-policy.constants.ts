import { ClinicalPolicyFlags } from './clinical-policy.types';

export const EMERGENCY_SIGNALS: string[] = [
  'dolor de pecho',
  'no puedo respirar',
  'convulsion',
  'convulsión',
  'desmayo',
  'sangrado abundante',
  'suicid',
  'stroke',
  'acv',
  'infarto',
  'anaphyl',
];

export const MINIMUM_DATA_SYMPTOM_REGEX = /(dolor|fiebre|tos|mareo|nausea|náusea|vomito|vómito|lesion|lesión)/;

export const MINIMUM_DATA_DURATION_REGEX = /(hora|horas|dia|días|dias|semana|semanas)/;

export const DEFINITIVE_DIAGNOSIS_REQUEST_REGEX = /(diagnostico definitivo|diagnóstico definitivo|dime que tengo|confirmame el diagnostico|confírmame el diagnóstico)/;

export const DEFINITIVE_DIAGNOSIS_CONTENT_REGEX = /(diagnóstico definitivo|diagnostico definitivo|usted tiene|you have)/;

export const DEFAULT_POLICY_FLAGS: ClinicalPolicyFlags = {
  skipPatientTriage: false,
  applyPatientFacingBoundaries: true,
};
