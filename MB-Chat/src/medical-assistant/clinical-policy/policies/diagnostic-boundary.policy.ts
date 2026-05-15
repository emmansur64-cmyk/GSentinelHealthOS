import {
  DEFINITIVE_DIAGNOSIS_CONTENT_REGEX,
  DEFINITIVE_DIAGNOSIS_REQUEST_REGEX,
} from '../clinical-policy.constants';
import { ClinicalPolicy, ClinicalPolicyContext, ClinicalPolicyResult } from '../clinical-policy.types';

export class DiagnosticBoundaryPolicy implements ClinicalPolicy {
  readonly name = 'DiagnosticBoundaryPolicy';

  evaluate(context: ClinicalPolicyContext): ClinicalPolicyResult {
    if (context.role === 'DOCTOR' || context.role === 'ADMIN') {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    if (context.stage === 'pre') {
      const lowered = context.query.toLowerCase();
      if (!DEFINITIVE_DIAGNOSIS_REQUEST_REGEX.test(lowered)) {
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
          'No puedo confirmar un diagnostico definitivo por chat. Puedo darte orientacion general y los proximos pasos, pero necesitas evaluacion profesional para confirmar diagnostico.',
        warnings: ['Diagnostico definitivo limitado por seguridad clinica.'],
      };
    }

    if (context.stage === 'post') {
      const responseText = context.responseText ?? '';
      if (!DEFINITIVE_DIAGNOSIS_CONTENT_REGEX.test(responseText.toLowerCase())) {
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
        transformedText:
          'Orientacion general basada en informacion disponible. No sustituye una evaluacion medica presencial para confirmar diagnostico.',
      };
    }

    return {
      policyName: this.name,
      triggered: false,
      severity: 'INFO',
    };
  }
}
