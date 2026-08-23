# Phase 3 current limits

The files under `src/clinical_kernel/MOTORES` are preclinical structural code.
Contract fixtures are not clinical benchmarks and have no external clinical
review. CDR is the only currently implemented engine. It demonstrates the
common engine protocol, typed abstention, and provenance propagation from
upstream typed results. It does not contain a diagnostic model or validated
ranking method. The interrupted CRE, CEE, and CPIE implementations recorded in
the baseline commit were removed so that additional engines cannot precede the
governance gates in this change.

## Blocked before Phase 4

- complete and independently test all eleven engine contracts;
- obtain external clinical review of governed knowledge and benchmark cases;
- define scheduler budgets, timeouts, dependency blocking, and failure policy;
- measure determinism, latency, and ablation for each engine;
- keep engine isolation enforced by CI on every accepted change.

`UnifiedClinicalState`, adjudication, and `ClinicalDecision` remain out of scope.
