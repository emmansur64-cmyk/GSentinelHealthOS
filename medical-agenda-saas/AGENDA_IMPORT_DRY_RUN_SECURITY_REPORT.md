# Agenda Import Dry-Run Security Report

Fecha: 2026-05-15

## Guard interno

- Feature flag: `AGENDA_IMPORT_DRY_RUN_ENABLED`.
- Default cerrado: si el valor no es exactamente `true`, responde 404.
- Header requerido: `x-internal-api-key`.
- Se valida contra `AGENDA_IMPORT_DRY_RUN_API_KEY`.
- Si la key falta o no coincide, responde 401.

## Variables

Agregadas a `.env.example`:

```env
AGENDA_IMPORT_DRY_RUN_ENABLED=false
AGENDA_IMPORT_DRY_RUN_API_KEY=
AGENDA_IMPORT_DRY_RUN_MAX_ROWS=500
```

## Protecciones de datos

- No se loguea el payload.
- No se loguea la API key esperada ni recibida.
- No se guardan archivos.
- No se guardan filas completas.
- No se consulta DB.
- No se escribe DB.

## Mutacion

- No hay Prisma import en la implementacion.
- No hay Prisma write.
- No hay raw SQL.
- No hay creacion de turnos reales.
- No hay ruta apply/write/mutate.
