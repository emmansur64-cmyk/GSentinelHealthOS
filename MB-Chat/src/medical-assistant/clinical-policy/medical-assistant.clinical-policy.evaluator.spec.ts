import {
  ClinicalPolicy,
  ClinicalPolicyContext,
  evaluateClinicalPolicies,
} from './index';

describe('evaluateClinicalPolicies', () => {
  const baseContext: ClinicalPolicyContext = {
    requestId: 'req-1',
    stage: 'pre',
    query: 'consulta clinica',
    role: 'PATIENT',
    mode: 'clinical_support',
    channel: 'clinical_chat',
    modality: 'text',
  };

  it('politicas ejecutan en orden', () => {
    const order: string[] = [];
    const policies: ClinicalPolicy[] = [
      {
        name: 'PolicyA',
        evaluate: () => {
          order.push('PolicyA');
          return { policyName: 'PolicyA', triggered: true, severity: 'INFO' };
        },
      },
      {
        name: 'PolicyB',
        evaluate: () => {
          order.push('PolicyB');
          return { policyName: 'PolicyB', triggered: true, severity: 'WARNING' };
        },
      },
    ];

    const result = evaluateClinicalPolicies(baseContext, policies);

    expect(order).toEqual(['PolicyA', 'PolicyB']);
    expect(result.triggeredPolicies).toEqual(['PolicyA', 'PolicyB']);
    expect(result.severity).toBe('WARNING');
  });

  it('short-circuit funciona y frena politicas siguientes', () => {
    const order: string[] = [];
    const policies: ClinicalPolicy[] = [
      {
        name: 'FirstPolicy',
        evaluate: () => {
          order.push('FirstPolicy');
          return {
            policyName: 'FirstPolicy',
            triggered: true,
            severity: 'CRITICAL',
            shortCircuit: true,
            responseText: 'stop',
          };
        },
      },
      {
        name: 'NeverRuns',
        evaluate: () => {
          order.push('NeverRuns');
          return { policyName: 'NeverRuns', triggered: true, severity: 'INFO' };
        },
      },
    ];

    const result = evaluateClinicalPolicies(baseContext, policies);

    expect(order).toEqual(['FirstPolicy']);
    expect(result.decision).toBe('short_circuit');
    expect(result.responseText).toBe('stop');
    expect(result.triggeredPolicies).toEqual(['FirstPolicy']);
  });
});
