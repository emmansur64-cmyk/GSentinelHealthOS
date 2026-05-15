import { DEFAULT_POLICY_FLAGS } from './clinical-policy.constants';
import {
  ClinicalPolicy,
  ClinicalPolicyContext,
  ClinicalPolicyEvaluationResult,
  ClinicalPolicyFlags,
} from './clinical-policy.types';
import { maxSeverity } from './clinical-policy.utils';
import { DiagnosticBoundaryPolicy } from './policies/diagnostic-boundary.policy';
import { EmergencyPolicy } from './policies/emergency.policy';
import { MinimumDataPolicy } from './policies/minimum-data.policy';
import { ProfessionalModePolicy } from './policies/professional-mode.policy';
import { SafeFallbackPolicy } from './policies/safe-fallback.policy';

export const DEFAULT_CLINICAL_POLICIES: ClinicalPolicy[] = [
  new ProfessionalModePolicy(),
  new EmergencyPolicy(),
  new DiagnosticBoundaryPolicy(),
  new MinimumDataPolicy(),
  new SafeFallbackPolicy(),
];

export function evaluateClinicalPolicies(
  context: ClinicalPolicyContext,
  policies: ClinicalPolicy[] = DEFAULT_CLINICAL_POLICIES,
): ClinicalPolicyEvaluationResult {
  let severity: ClinicalPolicyEvaluationResult['severity'] = 'INFO';
  let responseText: string | undefined;
  let transformedText: string | undefined;
  const warnings: string[] = [];
  const triggeredPolicies: string[] = [];
  const flags: ClinicalPolicyFlags = { ...DEFAULT_POLICY_FLAGS };

  for (const policy of policies) {
    const result = policy.evaluate(context);

    if (!result.triggered) {
      continue;
    }

    triggeredPolicies.push(result.policyName);
    severity = maxSeverity(severity, result.severity);

    if (result.warnings && result.warnings.length > 0) {
      warnings.push(...result.warnings);
    }

    if (result.flags) {
      Object.assign(flags, result.flags);
    }

    if (result.transformedText) {
      transformedText = result.transformedText;
    }

    if (result.responseText) {
      responseText = result.responseText;
    }

    if (result.shortCircuit) {
      return {
        decision: 'short_circuit',
        severity,
        responseText,
        transformedText,
        warnings,
        triggeredPolicies,
        flags,
      };
    }
  }

  return {
    decision: 'continue',
    severity,
    responseText,
    transformedText,
    warnings,
    triggeredPolicies,
    flags,
  };
}
