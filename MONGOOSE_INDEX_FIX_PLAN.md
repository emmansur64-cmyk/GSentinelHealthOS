# Mongoose Index Fix Plan

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Archivo exacto

`MetaBrain/src/persistence/schemas/online-training-buffer.schema.ts`

## Cambio exacto

Cambiar:

```ts
@Prop({ required: true, index: true })
incidentId!: string;
```

por:

```ts
@Prop({ required: true })
incidentId!: string;
```

Mantener:

```ts
OnlineTrainingBufferSchema.index({ incidentId: 1 });
```

## Por que es seguro

- El indice `{ incidentId: 1 }` sigue definido en el schema.
- No cambia nombre de campo.
- No cambia tipo de campo.
- No cambia coleccion.
- No cambia queries.
- No borra indices reales en Mongo.
- No ejecuta `syncIndexes`, `dropIndex` ni migraciones.

## Impacto esperado

- Desaparece el warning duplicado para `{ incidentId: 1 }`.
- Se preserva el comportamiento funcional de consultas por `incidentId`.
- Runtime y build permanecen estables.

## Rollback

Rollback de codigo:

```ts
@Prop({ required: true, index: true })
incidentId!: string;
```

No requiere rollback de base de datos porque no se realizan operaciones DB destructivas.
