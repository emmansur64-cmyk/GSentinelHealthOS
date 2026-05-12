# Mongoose Duplicate Index Audit

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Warning exacto observado

Durante los tests focales de MetaBrain se observo:

`[MONGOOSE] Warning: Duplicate schema index on {"incidentId":1} found. This is often due to declaring an index using both "index: true" and "schema.index()". Please remove the duplicate index definition.`

## Modelo afectado

- Modelo: `OnlineTrainingBuffer`
- Schema: `OnlineTrainingBufferSchema`
- Archivo: `MetaBrain/src/persistence/schemas/online-training-buffer.schema.ts`
- Coleccion: `online_training_buffer`

## Indice afectado

- Campo: `incidentId`
- Indice duplicado: `{ incidentId: 1 }`

## Definicion A

En la propiedad de clase:

```ts
@Prop({ required: true, index: true })
incidentId!: string;
```

Esta declaracion genera un indice simple `{ incidentId: 1 }`.

## Definicion B

Despues de `SchemaFactory.createForClass`:

```ts
OnlineTrainingBufferSchema.index({ incidentId: 1 });
```

Esta declaracion agrega el mismo indice simple `{ incidentId: 1 }`.

## Evidencia

Busquedas ejecutadas:

- `rg "Duplicate schema index"`
- `rg "schema.index"`
- `rg "index: true"`
- `rg "unique: true"`

Hallazgos relevantes:

- `index: true` en `incidentId` y `usedInTraining`.
- `OnlineTrainingBufferSchema.index({ incidentId: 1 })`.
- `OnlineTrainingBufferSchema.index({ usedInTraining: 1, createdAt: -1 })`, que no duplica el indice simple de `usedInTraining` porque es compuesto.

## Impacto potencial

- Ruido operacional en tests/startup.
- Riesgo de confusion sobre el estado esperado de indices.
- Posible startup mas lento si la configuracion crea/verifica indices.
- Riesgo de drift documental si se mantiene una doble fuente de verdad.

## Runtime exposure

La duplicacion esta en definicion de schema Mongoose. No cambia datos ni queries en runtime, pero aparece al compilar el modelo y puede afectar observabilidad/startup.
