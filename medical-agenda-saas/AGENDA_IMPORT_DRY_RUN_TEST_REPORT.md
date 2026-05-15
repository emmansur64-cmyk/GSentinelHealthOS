# Agenda Import Dry-Run Test Report

Fecha: 2026-05-15

## Tests focales

Comando:

```powershell
npm exec vitest run tests/schedule-import-dry-run.test.ts
```

Resultado:

- 1 archivo pasado.
- 14 tests pasados.

Cobertura de casos:

- Endpoint apagado por defecto rechaza.
- Sin `x-internal-api-key` rechaza.
- API key invalida rechaza.
- No se loguea la API key.
- Payload dry_run valido acepta.
- `apply=true` rechaza.
- `mode` distinto de `dry_run` rechaza.
- `tenantId` faltante rechaza.
- `batchIdempotencyKey` faltante rechaza.
- `rowIdempotencyKey` faltante rechaza la fila.
- `startTime >= endTime` rechaza la fila.
- Formato horario invalido rechaza la fila.
- `wouldWrite=false` siempre.
- Pruebas estaticas de no Prisma write, no raw SQL write y no creacion de turnos reales.

## Typecheck

Comando:

```powershell
npm run typecheck
```

Resultado: OK.

## Build

Comando:

```powershell
npm run build
```

Resultado: OK.

Nota: el build emitio 2 warnings preexistentes de Turbopack/NFT vinculados a trazas de `next.config.ts`, `src/lib/prisma.ts` y rutas existentes. No estan relacionados con el nuevo endpoint dry-run.

## Diff check

Comando:

```powershell
git diff --check -- medical-agenda-saas
```

Resultado: OK.
