# HUMAN REVIEW VALIDATION

## Estado anterior

FASE 2 habia dejado `MetaBrain/review` como contrato liviano y sin `ClinicalReviewQueue` real. No existia una capa Python paralela `MetaBrain/review_py`.

No se encontro enforcement de revision humana conectado al runtime actual. Las referencias existentes a riesgo/confianza pertenecen a flujos operativos de MetaBrain y no fueron modificadas.

## Estado nuevo

Se creo una capa formal de Human Review paralela y no invasiva:

- `MetaBrain/review`: contratos TypeScript, queue in-memory, status, decision, escalation, audit, confidence gate, blocking recommendation, routing y flags.
- `MetaBrain/review_py`: espejo Python no destructivo para runtime Python futuro.

La capa no esta conectada a endpoints, proveedores, reglas clinicas, respuestas al usuario ni base de datos.

## Queue status

`InMemoryClinicalReviewQueue` soporta:

- `enqueue`
- `get`
- `list`
- `updateStatus` / `update_status`
- `applyDecision` / `apply_decision`
- `auditEvents` / `audit_events`

La queue es local en memoria y solo sirve como contrato controlado. No persiste casos reales ni procesa PHI automaticamente.

## Confidence gating

La capa evalua de forma defensiva:

- baja confianza,
- alta incertidumbre,
- modalidad imagen,
- modalidad multimodal,
- riesgo alto o critico,
- conflicto entre providers,
- riesgo de alucinacion.

Con `HUMAN_REVIEW_ENABLED=false`, no aplica enforcement. La respuesta del gate conserva `would_require_review` para shadow analysis futuro.

## Escalation flow

El modelo de escalamiento soporta:

- `none`
- `routine`
- `urgent`
- `specialist`
- `blocked`

Los casos criticos, con target specialty o con riesgo de alucinacion pueden marcar escalamiento, pero no bloquean el runtime actual.

## Blocking flow

`evaluateReviewBlocking` / `evaluate_review_blocking` puede recomendar bloqueo o override humano, pero solo ejecutaria bloqueo si en el futuro se activa:

- `HUMAN_REVIEW_ENABLED=true`
- `HUMAN_REVIEW_BLOCKING_ENABLED=true`

Ambas flags permanecen documentadas como apagadas por defecto.

## Flags documentados

- `HUMAN_REVIEW_ENABLED=false`
- `HUMAN_REVIEW_SHADOW_MODE=true`
- `HUMAN_REVIEW_BLOCKING_ENABLED=false`
- `HUMAN_REVIEW_IMAGE_REQUIRED=true`
- `HUMAN_REVIEW_LOW_CONFIDENCE_REQUIRED=true`
- `HUMAN_REVIEW_MULTIMODAL_REQUIRED=true`
- `HUMAN_REVIEW_HIGH_RISK_REQUIRED=true`
- `HUMAN_OVERRIDE_ENABLED=false`

No se modificaron archivos `.env`.

## Archivos creados

- `MetaBrain/review/types.ts`
- `MetaBrain/review/review-queue.ts`
- `MetaBrain/review/review-status.ts`
- `MetaBrain/review/review-decision.ts`
- `MetaBrain/review/review-escalation.ts`
- `MetaBrain/review/review-audit.ts`
- `MetaBrain/review/review-confidence-gate.ts`
- `MetaBrain/review/review-policy.ts`
- `MetaBrain/review/review-flags.ts`
- `MetaBrain/review/review-risk.ts`
- `MetaBrain/review/review-routing.ts`
- `MetaBrain/review/review-reasons.ts`
- `MetaBrain/review/review-blocking.ts`
- `MetaBrain/review_py/*`

## Archivos modificados

- `MetaBrain/review/index.ts`: paso de contrato minimo de Fase 2 a export controlado de la capa Fase 6.
- `MetaBrain/review/README.md`: documentacion de alcance, flags y rollback.

## Validaciones ejecutadas

- `rg` sobre `MetaBrain` para revisar referencias existentes a review/risk/confidence/escalation.
- `python -m compileall MetaBrain\review_py` OK.
- Typecheck focal TS con `tsc --noEmit` sobre `MetaBrain\review` y `MetaBrain\core` OK.
- `npm run build` en `MetaBrain` OK.
- `git diff --name-only -- MetaBrain\review MetaBrain\review_py HUMAN_REVIEW_VALIDATION.md HUMAN_REVIEW_SAFETY_MODEL.md HUMAN_REVIEW_ROLLBACK_PLAN.md` ejecutado. No mostro salida porque los archivos de Fase 6 estan sin trackear.
- `git status --short -- ...` ejecutado y mostro los archivos nuevos/no trackeados de Fase 6.

## Riesgos pendientes

- La queue actual no persiste en DB; eso es intencional para no tocar runtime ni migraciones.
- No existe UI de revision humana.
- No existe integracion con providers ni respuestas reales.
- Si se conecta en fases futuras, se requiere modelo de datos persistente, control de acceso, auditoria durable y pruebas clinicas.

## Rollback

La capa no esta conectada al runtime. Rollback seguro:

1. Mantener flags apagados.
2. Eliminar `MetaBrain/review_py`.
3. Revertir `MetaBrain/review` a su estado previo o eliminar archivos nuevos.
4. Eliminar documentos Fase 6.

No requiere migraciones ni reinicios.
