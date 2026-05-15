# AGENDA LAB BUILD BLOCKER

Fecha local: 2026-05-12

## Comando

`npm run build`

## Resultado inicial

FAIL por TypeScript en `src/chat/chat.service.ts`.

Error exacto relevante:

`Property 'phone' is missing in type '{ name: string; id: string; notes: string | null; }' but required in type '{ id: string; name: string; phone: string; notes?: string | null | undefined; }'.`

Ubicacion:

- `src/chat/chat.service.ts:537`
- `sharedContext.patient` se pasaba a `callGroqDoctorChat(...)` sin `phone`.

## Causa

`resolveClinicalContext()` seleccionaba `id`, `name` y `notes` desde Prisma, pero el contrato de `MetaBrainDecisionInput` en `src/lib/metabrain.ts` exige `patient.phone`.

## Fix minimo aplicado

Archivo:

- `src/chat/chat.service.ts`

Cambio:

- Se agrego `phone: true` al `select` de `prisma.patient.findFirst`.

Linea aproximada:

- `src/chat/chat.service.ts:153`

No se cambio logica funcional de chat, no se refactorizo y no se tocaron modulos externos adicionales para este bloqueo.

## Validacion

- `npx tsc --noEmit`: PASS
- `npm run build`: PASS

Warnings no bloqueantes:

- Turbopack/NFT warning en `next.config.ts` por trazado amplio desde `src/lib/prisma.ts` y rutas de schedule/import. No impidio build.

