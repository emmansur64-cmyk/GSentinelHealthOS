# Mongoose Duplicate Index Final

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Causa raiz

El modelo `OnlineTrainingBuffer` declaraba el indice simple `{ incidentId: 1 }` dos veces:

- `@Prop({ required: true, index: true })`
- `OnlineTrainingBufferSchema.index({ incidentId: 1 })`

Esto corresponde al Caso A: campo con `index: true` y `schema.index(...)` duplicado.

## Fix aplicado

Archivo:

- `MetaBrain/src/persistence/schemas/online-training-buffer.schema.ts`

Cambio:

- Se elimino `index: true` de `incidentId`.
- Se conservo `OnlineTrainingBufferSchema.index({ incidentId: 1 })`.

## Validaciones

- `npx tsc --noEmit --incremental false --project tsconfig.json`: OK.
- `npm run build`: OK.
- Tests focales Jest: OK, 4 suites, 6 tests.
- Inspeccion de schema: `incidentIdIndexes= 1`.
- Warning `Duplicate schema index` no reaparecio en los tests focales.
- Warnings restantes observados en tests: whitelist/rate-limit/RULES_FALLBACK; no corresponden a Mongoose ni indices.
- No se levanto runtime persistente ni se contacto Mongo productivo.

## Rollback

Rollback de codigo:

```ts
@Prop({ required: true, index: true })
incidentId!: string;
```

No hay rollback de DB porque no se tocaron indices fisicos.

## Riesgos abiertos

- No se consulto Mongo real ni se ejecuto `syncIndexes`.
- Si existen indices fisicos en entornos remotos, este fix no los altera.
- Validacion de startup real con runtime lab puede hacerse en una fase separada si se autoriza.

## Readiness

Fix minimo aplicado y validado localmente. Listo para revision de diff limitado y commit selectivo posterior.
