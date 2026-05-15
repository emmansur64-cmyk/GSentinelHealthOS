# HUMAN REVIEW ROLLBACK PLAN

## Estado de integracion

La capa Human Review de Fase 6 esta creada en paralelo y no esta conectada al runtime real.

No se modificaron:

- endpoints,
- contratos API,
- Docker,
- `.env`,
- base de datos,
- providers,
- reglas clinicas activas,
- flujos de chat o imagen.

## Flags

Mantener defaults:

- `HUMAN_REVIEW_ENABLED=false`
- `HUMAN_REVIEW_SHADOW_MODE=true`
- `HUMAN_REVIEW_BLOCKING_ENABLED=false`
- `HUMAN_OVERRIDE_ENABLED=false`

Con estas flags, no hay enforcement.

## Archivos nuevos

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
- `MetaBrain/review_py/`
- `HUMAN_REVIEW_VALIDATION.md`
- `HUMAN_REVIEW_SAFETY_MODEL.md`
- `HUMAN_REVIEW_ROLLBACK_PLAN.md`

## Archivos modificados

- `MetaBrain/review/index.ts`
- `MetaBrain/review/README.md`

## Rollback seguro

Opcion minima:

1. Dejar todas las flags apagadas.
2. No importar `MetaBrain/review` desde runtime.

Opcion completa:

1. Revertir `MetaBrain/review/index.ts`.
2. Revertir `MetaBrain/review/README.md`.
3. Eliminar archivos nuevos de `MetaBrain/review`.
4. Eliminar `MetaBrain/review_py`.
5. Eliminar documentos Fase 6.

## Comandos seguros de inspeccion

```powershell
git status --short
git diff --name-only
python -m compileall MetaBrain\review_py
```

## Advertencias

No activar bloqueo real ni override humano sin:

- persistencia durable,
- control de acceso,
- auditoria legal/clinica,
- aprobacion medica,
- pruebas end-to-end,
- plan de incident response.
