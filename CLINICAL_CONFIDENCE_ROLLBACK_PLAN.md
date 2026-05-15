# CLINICAL CONFIDENCE ROLLBACK PLAN

## Estado de integracion

La Fase 7 creo una capa paralela. No esta conectada al runtime real.

No se modificaron:

- endpoints,
- contratos API,
- Docker,
- `.env`,
- base de datos,
- providers,
- reglas clinicas activas,
- UI,
- runtime de chat.

## Flags

Mantener defaults:

- `CLINICAL_CONFIDENCE_ENABLED=false`
- `CLINICAL_CONFIDENCE_SHADOW_MODE=true`
- `CLINICAL_CONFIDENCE_BLOCKING_ENABLED=false`
- `CLINICAL_CONFIDENCE_SAFE_DISPLAY_ENABLED=false`
- `CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED=false`

Con esas flags, no hay enforcement.

## Archivos nuevos

- `MetaBrain/confidence/types.ts`
- `MetaBrain/confidence/confidence-engine.ts`
- `MetaBrain/confidence/confidence-score.ts`
- `MetaBrain/confidence/uncertainty-score.ts`
- `MetaBrain/confidence/evidence-evaluator.ts`
- `MetaBrain/confidence/provider-consistency.ts`
- `MetaBrain/confidence/multimodal-conflict.ts`
- `MetaBrain/confidence/hallucination-risk.ts`
- `MetaBrain/confidence/escalation-recommendation.ts`
- `MetaBrain/confidence/safe-display.ts`
- `MetaBrain/confidence/confidence-policy.ts`
- `MetaBrain/confidence/confidence-audit.ts`
- `MetaBrain/confidence/confidence-flags.ts`
- `MetaBrain/confidence/confidence-explainer.ts`
- `MetaBrain/confidence_py/`
- `CLINICAL_CONFIDENCE_VALIDATION.md`
- `CLINICAL_CONFIDENCE_SAFETY_MODEL.md`
- `CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md`

## Archivos modificados

- `MetaBrain/confidence/index.ts`
- `MetaBrain/confidence/README.md`

## Rollback seguro

Opcion minima:

1. Mantener flags apagados.
2. No importar la capa desde runtime.

Opcion completa:

1. Revertir `MetaBrain/confidence/index.ts`.
2. Revertir `MetaBrain/confidence/README.md`.
3. Eliminar los archivos nuevos de `MetaBrain/confidence`.
4. Eliminar `MetaBrain/confidence_py`.
5. Eliminar los documentos de Fase 7.

## Comandos seguros de inspeccion

```powershell
git status --short
git diff --name-only
python -m compileall MetaBrain\confidence_py
```

## Advertencias

No activar enforcement sin:

- revision clinica,
- auditoria durable,
- control de acceso,
- pruebas end-to-end,
- integracion con Human Review,
- plan de rollback operacional.
