import { EMERGENCY_SIGNALS } from '../clinical-policy.constants';
import { ClinicalPolicy, ClinicalPolicyContext, ClinicalPolicyResult } from '../clinical-policy.types';

export class EmergencyPolicy implements ClinicalPolicy {
  readonly name = 'EmergencyPolicy';

  evaluate(context: ClinicalPolicyContext): ClinicalPolicyResult {
    if (context.stage !== 'pre') {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    const lowered = context.query.toLowerCase();
    const hasEmergencySignal = EMERGENCY_SIGNALS.some((signal) => lowered.includes(signal));

    if (!hasEmergencySignal) {
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
        'Posible emergencia detectada. Busca atencion medica de urgencia de inmediato o llama al servicio de emergencias local ahora.',
      warnings: [
        'Respuesta abreviada por seguridad clinica.',
        'No continuar autoevaluacion en chat ante posible emergencia.',
      ],
    };
  }
}
