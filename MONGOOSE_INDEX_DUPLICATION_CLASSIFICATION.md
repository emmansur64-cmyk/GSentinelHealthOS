# Mongoose Index Duplication Classification

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Clasificacion

Caso identificado: **CASO A**

Un campo esta definido con `index: true` y ademas el schema declara el mismo indice con `schema.index(...)`.

## Causa raiz

`OnlineTrainingBuffer.incidentId` declara:

```ts
@Prop({ required: true, index: true })
```

y el mismo archivo declara:

```ts
OnlineTrainingBufferSchema.index({ incidentId: 1 });
```

Ambas definiciones producen el mismo indice simple `{ incidentId: 1 }`.

## Casos descartados

- Caso B, plugin agrega indice: no hay evidencia de plugin que cree `{ incidentId: 1 }`.
- Caso C, modelo recompilado/hot reload: el warning apunta a indice duplicado dentro del schema, no a overwrite de modelo.
- Caso D, same schema loaded multiple times: no hay evidencia; el warning menciona definiciones de indice duplicadas.
- Caso E, compound index duplicado parcialmente: `usedInTraining` tiene indice simple y compuesto, pero el warning observado es `{"incidentId":1}`.
- Caso F, autoIndex + creacion manual: no se ejecuto operacion DB ni se detecto conflicto real de Mongo; es duplicacion logica de schema.

## Severidad real

- Severidad operacional: baja/media.
- Riesgo runtime: bajo.
- Riesgo DB: bajo si no se ejecutan operaciones destructivas.
- Riesgo produccion: bajo, pero el warning reduce senal operacional y puede ocultar problemas futuros.

## Fix recomendado

Eliminar una de las dos definiciones del indice simple. Para minimizar cambios y preservar el bloque explicito de indices del schema, se recomienda quitar `index: true` del `@Prop` de `incidentId` y conservar `OnlineTrainingBufferSchema.index({ incidentId: 1 })`.

Esto mantiene el indice funcional esperado sin cambiar queries, coleccion ni estructura de documentos.
