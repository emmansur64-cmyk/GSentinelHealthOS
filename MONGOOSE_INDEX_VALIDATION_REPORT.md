# Mongoose Index Validation Report

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Warning antes

Antes del fix, Jest mostraba:

`[MONGOOSE] Warning: Duplicate schema index on {"incidentId":1} found. This is often due to declaring an index using both "index: true" and "schema.index()". Please remove the duplicate index definition.`

## Warning despues

Despues del fix, la inspeccion directa del schema y los tests focales ya no mostraron `Duplicate schema index`.

## Validacion de schema

Comando ejecutado:

```powershell
node -r ts-node/register -e 'const { OnlineTrainingBufferSchema } = require("./src/persistence/schemas/online-training-buffer.schema"); const indexes = OnlineTrainingBufferSchema.indexes(); console.log(JSON.stringify(indexes)); console.log("incidentIdIndexes=", indexes.filter(([fields]) => fields.incidentId === 1 && Object.keys(fields).length === 1).length);'
```

Resultado:

- `incidentIdIndexes= 1`
- El indice simple `{ incidentId: 1 }` sigue existiendo una sola vez.
- El indice compuesto `{ usedInTraining: 1, createdAt: -1 }` se preserva.
- Comando reejecutado el 2026-05-12 desde `MetaBrain`: OK.

## Startup status

No se levanto runtime lab ni servidor persistente para evitar tocar entornos fuera de alcance. La validacion segura de startup/model compile se cubrio con:

- Import del schema via `ts-node/register`.
- Compilacion TypeScript.
- Build Nest.
- Tests focales que cargan servicios y schemas de persistencia.

## Build status

- `npx tsc --noEmit --incremental false --project tsconfig.json`: OK.
- `npm run build`: OK.
- Validaciones reejecutadas el 2026-05-12: OK.

## Tests status

Comando:

```powershell
npx jest --config jest.config.ts --runTestsByPath src/persistence/persistence-sanitization.spec.ts src/common/utils/persistence-sanitizer.util.spec.ts src/execution/execution-denied-status.spec.ts src/ingress/api-key-guard.coverage.spec.ts --runInBand
```

Resultado:

- 4 test suites passed.
- 6 tests passed.
- Sin warning `Duplicate schema index`.
- Warnings observados durante tests: `ExecutionService` whitelist, `BrainService` rate-limit per-instance y `RULES_FALLBACK`; no estan relacionados con Mongoose ni indices.

## Riesgos residuales

- No se verificaron indices fisicos contra Mongo real porque esta fase prohibe cambios destructivos y produccion no debe tocarse.
- Si produccion ya tiene indices fisicos creados, este fix no los borra ni los recrea.
- `usedInTraining` conserva indice simple y compuesto; no hay warning observado para ese campo.
