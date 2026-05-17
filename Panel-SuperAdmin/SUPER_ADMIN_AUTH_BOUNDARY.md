# SUPER ADMIN AUTH BOUNDARY

Date: 2026-05-17
Scope: `Panel-SuperAdmin` identity boundary vs commercial/client auth flows

## 1) Auditoría: ¿Panel-SuperAdmin dependía de credenciales compartidas?
Resultado: **No en el flujo principal de login del panel**.
- El login del panel valida contra `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD_HASH` (y/o credencial rotada en `.runtime/super-admin-credentials.json`).
- No consulta tabla de usuarios de clínicas para autenticarse.

## 2) Confirmación: ¿Qué login usa actualmente?
- Endpoint: `Panel-SuperAdmin/src/app/api/auth/login/route.ts`
- Mecanismo: `validateSuperAdminCredentials()` en `src/lib/super-admin-credentials.ts`
- Emite JWT con `SUPER_ADMIN_JWT_SECRET`.

## 3) Separación completa de autenticación
Aplicado:
- Token/cookie namespace propio del panel.
- Secret JWT propio del panel.
- Credencial bootstrap propia por env del panel.
- Sin dependencia de login de clínicas para autenticarse al panel.

## 4) Forzar SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD_HASH propios
Aplicado:
- `SUPER_ADMIN_PASSWORD_HASH` requerido para bootstrap auth.
- `SUPER_ADMIN_PASSWORD` plano rechazado por defecto.
- Fallback plano solo con flag de transición explícito y desactivado por defecto:
  - `SUPER_ADMIN_ALLOW_PLAIN_PASSWORD_FALLBACK=false`.

## 5) Cookie propia
Aplicado:
- Cookie de sesión panel: `super_admin_session`.
- Eliminado uso de `sa_token` en auth middleware y librería auth del panel.

## 6) JWT secret propio
Aplicado:
- Se mantiene `SUPER_ADMIN_JWT_SECRET` como secreto exclusivo del panel.
- Fail closed si no está configurado.

## 7) Evitar lectura de usuarios/clientes/tenant para autenticarte
Aplicado:
- El login del panel no usa repositorio de usuarios de clínicas ni tenants para autenticación.
- Las rutas de tenants son de gobernanza, no de autenticación.

## 8) Asegurar acceso owner/developer
Aplicado operacionalmente:
- Único bootstrap por `SUPER_ADMIN_EMAIL` + hash correspondiente.
- Sin matching contra usuarios comerciales.
- Recomendación obligatoria: usar email owner exclusivo y no reutilizable en base comercial.

## 9) Prueba: credenciales de clientes NO funcionan en Panel-SuperAdmin
Evidencia (test automatizado):
- `tests/security-hardening.test.ts` -> `client-like credentials do not authenticate in super-admin panel` => PASS.

## 10) Prueba: credenciales SuperAdmin NO funcionan en paneles cliente
Evidencia técnica y de boundary (test de fuente):
- `tests/source-guards.test.ts` verifica que el panel cliente usa cookie `auth_token` y no `super_admin_session` => PASS.
- `medical-agenda-saas/src/app/api/auth/login/route.ts` excluye `super_admin` en query de login y devuelve `403` para cualquier intento (`"El acceso super admin solo esta permitido en Panel-SuperAdmin"`).
- `medical-agenda-saas/tests/super-admin/commercial-login-boundary.test.ts` valida este boundary => PASS.

Nota:
- Esta prueba es de aislamiento de mecanismo/sesión y de namespaces de auth.
- No se ejecutó login E2E contra entorno productivo (prohibido por política de este trabajo).

## 11) Boundary documentado
Boundary final:
- `Panel-SuperAdmin`:
  - Cookie: `super_admin_session`
  - JWT secret: `SUPER_ADMIN_JWT_SECRET`
  - Credenciales: `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD_HASH`
  - Login: ruta propia `/api/auth/login` del panel
- `medical-agenda-saas` (clientes):
  - Cookie: `auth_token`
  - Flujo de auth distinto (`server-auth`, usuarios/tenant del sistema comercial)
  - No usa cookie `super_admin_session`

## Confirmación final
Sí: `Panel-SuperAdmin` queda con identidad administrativa propia y separada del sistema comercial/cliente.
- No comparte cookie/sesión con paneles cliente.
- No depende del login de clínicas para entrar al panel superadmin.
- No autentica usando credenciales tenant/clientes.
