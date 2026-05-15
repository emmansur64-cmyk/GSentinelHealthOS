import { ClinicalPolicy, ClinicalPolicyContext, ClinicalPolicyResult } from '../clinical-policy.types';

export class ProfessionalModePolicy implements ClinicalPolicy {
  readonly name = 'ProfessionalModePolicy';

  evaluate(context: ClinicalPolicyContext): ClinicalPolicyResult {
    if (context.stage !== 'pre') {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    const isProfessionalActor = context.role === 'DOCTOR' || context.role === 'ADMIN';
    const isProfessionalMode = context.mode === 'doctor_professional';

    if (!isProfessionalActor || !isProfessionalMode) {
      return {
        policyName: this.name,
        triggered: false,
        severity: 'INFO',
      };
    }

    return {
      policyName: this.name,
      triggered: true,
      severity: 'INFO',
      flags: {
        skipPatientTriage: true,
        applyPatientFacingBoundaries: false,
      },
      warnings: ['Modo profesional: sin triage patient-facing automatico.'],
    };
  }
}
