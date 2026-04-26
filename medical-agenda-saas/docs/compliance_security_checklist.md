# Compliance & Security Checklist (SaaS Medico Multi-Tenant)

## Tenant Isolation

- [x] Todas las entidades core incluyen `tenant_id`.
- [x] Migracion inicial con tenant por defecto para datos legacy.
- [x] Politicas RLS por tabla tenant-scoped.
- [x] Contexto runtime de tenant en sesión JWT.
- [x] Prisma aplica tenant scope en operaciones filtrables y escrituras.
- [ ] Revisar manualmente consultas SQL raw restantes para agregar `tenant_id` explicito cuando corresponda.

## Authentication & Authorization

- [x] JWT con `tenantId`, `role`, `sessionId`.
- [x] Validación de sesión activa/revocación.
- [x] Logout invalida sesión server-side.
- [x] Middleware global de rol con normalización (`doctor/medico`, `secretaria/recepcionista`).
- [x] Endpoints sensibles protegidos con auth + role checks.
- [x] Validación tenant activa por endpoint con `requireTenant`.

## Billing & Subscription

- [x] Tenant model con plan y límites.
- [x] Límite de médicos por plan en alta de médicos.
- [x] Límite mensual de turnos en creación de appointments.
- [x] Respuesta de negocio clara (`402`) al exceder límites.

## Auditability

- [x] Activity log tenant-aware.
- [x] Functional audit tenant-aware.
- [x] Registro de acciones críticas (create/update/delete, auth events).
- [ ] Agregar retención de logs y exportación segura para auditorías externas.

## API Security Hardening

- [x] Validación estricta de payloads con Zod.
- [x] Sanitización de strings en validadores.
- [x] Rate limiting de login.
- [x] /api/metrics protegido por auth + admin.
- [ ] Rate limit adicional para endpoints mutativos de alta frecuencia.

## Frontend Security

- [x] Sesión incorpora tenant_id.
- [x] Menú UI adaptado por rol.
- [x] Tenant requerido en login.
- [ ] Añadir pruebas E2E de autorización por rol y tenant.

## Deployment & Ops

- [x] Variables de entorno base documentadas.
- [x] Runbook de despliegue multi-tenant.
- [ ] TLS termination + WAF + rotation automática de secretos.
- [ ] Backups PITR y test de restore documentados.
