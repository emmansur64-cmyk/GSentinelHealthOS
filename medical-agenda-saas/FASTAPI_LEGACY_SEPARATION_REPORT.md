# FASTAPI LEGACY SEPARATION REPORT

Fecha local: 2026-05-12

Scope de este reporte: separacion documental. No se corrigio `gs_api`.

## Conclusion

`gs_api` / FastAPI legacy **NO es backend canonico de Agenda**.

Agenda canonica vive en:
- `E:\GSentinelHealthOS\medical-agenda-saas`
- Next.js
- Prisma
- DB `gsentinel_saas`

FastAPI legacy usa:
- servicio `gs_api`
- DB `gsentinel`
- SQLAlchemy/Alembic fuera de `medical-agenda-saas`

## doctors vs doctor_profiles

Agenda canonica:
- modelo correcto: `doctor_profiles`
- FK de appointment: `appointments.doctor_id -> doctor_profiles.user_id`
- tabla `doctors` no es necesaria ni esperada.

FastAPI legacy:
- endpoints observados intentan operar con un modelo distinto.
- evidencia previa: error `relation "doctors" does not exist`.
- evidencia actual: error `patients.date_of_birth does not exist`.

## gsentinel vs gsentinel_saas

| Stack | DB | Estado |
|---|---|---|
| Next/Prisma Agenda | `gsentinel_saas` | canonico para Agenda |
| FastAPI legacy | `gsentinel` | externo/legacy, no canonico |

## Por que genera confusion operacional

1. Ambos servicios estan vivos.
2. Ambos hablan con PostgreSQL.
3. Ambos tienen conceptos `patients` y `appointments`.
4. Los schemas no son equivalentes.
5. Los errores 500 de `gs_api` parecen errores de Agenda, pero no pertenecen al backend canonico del panel.

## Riesgos de mezclar stacks

- Turnos creados en una DB no aparecen en la otra.
- Pacientes duplicados.
- Tenant isolation inconsistente.
- WhatsApp resolviendo cuenta en una tabla distinta.
- Debug operacional falso.
- Migraciones cruzadas peligrosas.
- Riesgo de borrar o modificar datos del stack equivocado.

## Regla operativa recomendada

Hasta nueva decision formal:
- No usar `gs_api` como fuente de verdad de Agenda.
- No usar DB `gsentinel` como DB de Agenda.
- No buscar tabla `doctors` para Agenda canonica.
- No corregir FastAPI dentro de tareas de Agenda Next/Prisma.

