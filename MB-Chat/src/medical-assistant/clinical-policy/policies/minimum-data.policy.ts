import {
  MINIMUM_DATA_DURATION_REGEX,
  MINIMUM_DATA_SYMPTOM_REGEX,
} from '../clinical-policy.constants';
import { ClinicalPolicy, ClinicalPolicyContext, ClinicalPolicyResult } from '../clinical-policy.types';

export class MinimumDataPolicy implements ClinicalPolicy {
  readonly name = 'MinimumDataPolicy';

  evaluate(context: ClinicalPolicyContext): ClinicalPolicyResult {
    if (context.stage !== 'pre') {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    if (context.role === 'DOCTOR' || context.role === 'ADMIN') {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    const lowered = context.query.toLowerCase();
    const isShort = lowered.length < 10;
    const hasSymptoms = MINIMUM_DATA_SYMPTOM_REGEX.test(lowered);
    const hasDuration = MINIMUM_DATA_DURATION_REGEX.test(lowered);

    if (!isShort && hasSymptoms && hasDuration) {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    return {
      policyName: this.name,
      triggered: true,
      severity: 'WARNING',
      shortCircuit: true,
      responseText:
        'Para orientarte sin asumir un diagnostico definitivo, necesito datos minimos: edad, sintomas principales, tiempo de evolucion y signos de alarma presentes.',
      warnings: ['Informacion insuficiente para orientar con seguridad clinica.'],
    };
  }
}
