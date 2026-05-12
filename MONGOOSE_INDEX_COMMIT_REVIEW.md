# Mongoose Index Commit Review

Fecha: 2026-05-12
Repositorio: `E:\GSentinelHealthOS`

## Objetivo

Revisar y commitear de forma selectiva solo el fix del warning Mongoose duplicate index para `OnlineTrainingBuffer`.

## Inventario worktree

Comandos ejecutados:

```powershell
git status --short
git diff --name-only
```

El worktree permanece sucio por cambios previos fuera de alcance. Entre las areas detectadas fuera de este commit hay:

- `.env.example`
- Docker y compose.
- Runtime integration.
- FastAPI / `api`.
- `medical-agenda-saas`.
- Python `__pycache__`.
- Alembic.
- Reportes de fases previas no relacionados.
- Archivos npm audit JSON.
- Scripts y tooling no relacionados.

## Archivos permitidos revisados

- `MetaBrain/src/persistence/schemas/online-training-buffer.schema.ts`
- `MONGOOSE_DUPLICATE_INDEX_AUDIT.md`
- `MONGOOSE_INDEX_DUPLICATION_CLASSIFICATION.md`
- `MONGOOSE_INDEX_FIX_PLAN.md`
- `MONGOOSE_INDEX_VALIDATION_REPORT.md`
- `MONGOOSE_INDEX_WORKTREE_REVIEW.md`
- `MONGOOSE_DUPLICATE_INDEX_FINAL.md`
- `MONGOOSE_INDEX_COMMIT_REVIEW.md`

## Revision de schema

Archivo: `MetaBrain/src/persistence/schemas/online-training-buffer.schema.ts`

Diff permitido:

```diff
-  @Prop({ required: true, index: true })
+  @Prop({ required: true })
   incidentId!: string;
```

Validaciones de contenido:

- `OnlineTrainingBufferSchema.index({ incidentId: 1 })` sigue presente.
- `@Schema({ timestamps: true, collection: 'online_training_buffer' })` no cambio.
- El tipo de `incidentId` sigue siendo `string`.
- No se agrego `unique`.
- No se cambiaron queries ni servicios.
- No se tocaron indices fisicos de Mongo.

## Revision de reportes

Los reportes permitidos documentan:

- Warning exacto.
- Modelo afectado.
- Indice afectado.
- Causa raiz.
- Fix minimo.
- Rollback de codigo.
- Validaciones.
- Worktree safety.

No contienen secretos, tokens, PHI ni datos productivos.

## Riesgo de mezcla

Riesgo: alto si se usara stage masivo, porque el worktree contiene muchos cambios previos ajenos.

Mitigacion:

- No usar `git add .`.
- No usar `git add -A`.
- No usar `git commit -a`.
- Stage exclusivamente por rutas permitidas.
- Verificar `git diff --cached --name-only` antes del commit.

## Validaciones pre-stage

Ejecutadas desde `MetaBrain`:

- `node -r ts-node/register ... OnlineTrainingBufferSchema.indexes()`: OK.
- Resultado schema: `incidentIdIndexes= 1`.
- `npx tsc --noEmit --incremental false --project tsconfig.json`: OK.
- `npm run build`: OK.
- `npx jest --config jest.config.ts --runTestsByPath src/persistence/persistence-sanitization.spec.ts src/common/utils/persistence-sanitizer.util.spec.ts src/execution/execution-denied-status.spec.ts src/ingress/api-key-guard.coverage.spec.ts --runInBand`: OK.

Resultado tests:

- 4 suites passed.
- 6 tests passed.
- No reaparecio `Duplicate schema index`.

Warnings observados:

- `ExecutionService` denied action whitelist.
- `BrainService` per-instance rate limit.
- `RULES_FALLBACK`.

Estos warnings son esperados por los tests focales y no estan relacionados con Mongoose ni indices.

## Decision

GO para stage selectivo de los archivos permitidos, sujeto a verificacion posterior con `git diff --cached --name-only`, `git diff --cached --stat` y `git diff --cached --check`.
