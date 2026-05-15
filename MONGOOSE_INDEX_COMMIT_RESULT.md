# Mongoose Index Commit Result

Fecha: 2026-05-12
Repositorio: `E:\GSentinelHealthOS`

## Commit

- Hash: `b28fdab`
- Mensaje: `fix(mongoose): remove duplicate incidentId index definition`

## Modelo afectado

- Modelo: `OnlineTrainingBuffer`
- Schema: `OnlineTrainingBufferSchema`
- Archivo: `MetaBrain/src/persistence/schemas/online-training-buffer.schema.ts`
- Coleccion: `online_training_buffer`

## Indice afectado

- Indice: `{ incidentId: 1 }`

## Fix aplicado

Se elimino la definicion redundante:

```ts
@Prop({ required: true, index: true })
```

Quedo:

```ts
@Prop({ required: true })
```

Se preservo:

```ts
OnlineTrainingBufferSchema.index({ incidentId: 1 });
```

## Validaciones

- `node -r ts-node/register ... OnlineTrainingBufferSchema.indexes()`: OK.
- Resultado schema: `incidentIdIndexes= 1`.
- `npx tsc --noEmit --incremental false --project tsconfig.json`: OK.
- `npm run build`: OK.
- Tests focales Jest: OK, 4 suites, 6 tests.
- `git diff --cached --name-only`: solo archivos permitidos antes del commit.
- `git diff --cached --stat`: 8 archivos, 480 inserciones, 1 eliminacion.
- `git diff --cached --check`: OK.

Warnings observados en tests:

- `ExecutionService` denied action whitelist.
- `BrainService` per-instance rate limit.
- `RULES_FALLBACK`.

No corresponden a Mongoose ni indices.

## Post-commit check

- `git log -1 --oneline`: `b28fdab fix(mongoose): remove duplicate incidentId index definition`.
- `git show --name-only --stat --oneline HEAD`: solo incluyo los 8 archivos permitidos.
- Produccion no tocada.
- No se hizo push.
- No se ejecuto `syncIndexes`, `dropIndex`, `dropDatabase` ni operacion destructiva de Mongo.

## Estado final

Commit selectivo completado. El worktree conserva cambios previos fuera de alcance y este reporte post-commit queda como artefacto generado despues del commit.
