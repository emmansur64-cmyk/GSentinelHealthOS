import { ClinicalPolicy, ClinicalPolicyContext, ClinicalPolicyResult } from '../clinical-policy.types';

export class SafeFallbackPolicy implements ClinicalPolicy {
  readonly name = 'SafeFallbackPolicy';

  evaluate(context: ClinicalPolicyContext): ClinicalPolicyResult {
    if (context.stage !== 'error') {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    return {
      policyName: this.name,
      triggered: true,
      severity: 'CRITICAL',
      shortCircuit: true,
      responseText:
        'No puedo generar una respuesta clinica segura en este momento. Recomiendo evaluacion profesional presencial para una orientacion adecuada.',
      warnings: [
        'Se activo respuesta segura por indisponibilidad temporal del proveedor.',
        'Si hay signos de alarma, acudir a urgencias.',
      ],
    };
  }
}
