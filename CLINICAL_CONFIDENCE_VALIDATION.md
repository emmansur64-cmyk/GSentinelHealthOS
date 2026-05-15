# CLINICAL CONFIDENCE VALIDATION

## Estado anterior

FASE 2 habia creado `MetaBrain/confidence` como namespace y contrato minimo. La confianza real seguia distribuida en:

- `MetaBrain/src/guard`
- `MetaBrain/src/brain/brain.service.ts`
- `MetaBrain/services/decision_service/app/rules.py`
- capas de imagen, memoria y providers creadas en fases previas

No existia un motor central de confianza clinica ni capa Python paralela `MetaBrain/confidence_py`.

## Estado nuevo

Se creo un Clinical Confidence Engine paralelo y no invasivo:

- `MetaBrain/confidence`: contratos TypeScript, scoring, uncertainty, evidence, provider consistency, multimodal conflict, hallucination risk, safe display, audit y flags.
- `MetaBrain/confidence_py`: espejo Python con contratos equivalentes para integracion futura.

La capa no esta conectada al runtime actual y no cambia comportamiento observable.

## Confidence architecture

El motor combina senales defensivas:

- completitud de evidencia,
- consistencia entre providers,
- incertidumbre,
- riesgo de hallucination,
- conflictos multimodales,
- restricciones de safe display.

El resultado es explicable y auditado por `trace_id`.

## Scoring model

El score usa ponderacion deterministica:

- evidencia: 40%
- consistencia provider: 35%
- baja incertidumbre: 25%

Se penaliza riesgo de hallucination alto o critico. No hay scoring aleatorio.

## Uncertainty model

La incertidumbre sube con:

- evidencia incompleta,
- baja consistencia provider,
- riesgo de hallucination alto o critico.

## Hallucination model

El riesgo se estima por:

- evidencia insuficiente,
- divergencia provider,
- conflictos multimodales,
- conflictos entre capas,
- claims sin soporte suficiente.

No interpreta diagnosticos ni contenido medico como especialista.

## Provider consistency

La capa detecta:

- outputs vacios,
- outputs malformados,
- errores/timeouts,
- divergencia textual resumida entre providers,
- dominante por mayor confidence declarada.

No llama providers reales.

## Multimodal conflict

La capa puede marcar:

- conflicto texto vs imagen,
- conflicto retrieval vs provider,
- conflicto memory vs provider,
- evidencia de imagen ausente en modalidad multimodal.

No realiza inferencia visual medica real.

## Safe display

La capa genera:

- `safe_to_display`,
- `display_restrictions`,
- recomendaciones de safe summary,
- recomendacion de human review.

Con defaults actuales, no bloquea respuestas reales.

## Flags documentados

- `CLINICAL_CONFIDENCE_ENABLED=false`
- `CLINICAL_CONFIDENCE_SHADOW_MODE=true`
- `CLINICAL_CONFIDENCE_BLOCKING_ENABLED=false`
- `CLINICAL_CONFIDENCE_MULTIMODAL_ENABLED=false`
- `CLINICAL_CONFIDENCE_PROVIDER_CONSISTENCY_ENABLED=true`
- `CLINICAL_CONFIDENCE_HALLUCINATION_CHECK_ENABLED=true`
- `CLINICAL_CONFIDENCE_SAFE_DISPLAY_ENABLED=false`
- `CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED=false`

No se modificaron archivos `.env`.

## Archivos creados

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
- `MetaBrain/confidence_py/*`

## Archivos modificados

- `MetaBrain/confidence/index.ts`
- `MetaBrain/confidence/README.md`

## Validaciones ejecutadas

- `rg` sobre `MetaBrain` para revisar referencias existentes a confidence/risk/uncertainty/hallucination/evidence/safe display.
- `python -m compileall MetaBrain\confidence_py` OK.
- Typecheck focal TS con `tsc --noEmit` sobre `MetaBrain\confidence` y `MetaBrain\core` OK.
- `npm run build` en `MetaBrain` OK.
- `git diff --name-only -- MetaBrain\confidence MetaBrain\confidence_py CLINICAL_CONFIDENCE_VALIDATION.md CLINICAL_CONFIDENCE_SAFETY_MODEL.md CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md` ejecutado. No mostro salida porque los archivos de Fase 7 estan sin trackear.
- `git status --short -- ...` ejecutado y mostro los archivos nuevos/no trackeados de Fase 7.

## Riesgos pendientes

- No hay persistencia durable de audit events.
- No hay integracion con runtime real.
- No hay enforcement real.
- Provider consistency usa resumen textual, no comparacion semantica vectorial.
- Multimodal conflict no realiza inferencia medica visual.

## Rollback

La capa esta aislada. Rollback:

1. Mantener flags apagados.
2. No importar `MetaBrain/confidence` ni `MetaBrain/confidence_py` desde runtime.
3. Revertir `MetaBrain/confidence/index.ts` y `README.md`.
4. Eliminar archivos nuevos de `MetaBrain/confidence` y `MetaBrain/confidence_py`.
