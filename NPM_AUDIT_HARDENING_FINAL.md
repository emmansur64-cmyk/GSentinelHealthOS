# NPM Audit Hardening Final

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Estado Ejecutivo

Mitigacion controlada completada sin `npm audit fix --force`, sin cambios major directos, sin deploy y sin tocar produccion.

## Arbol Vulnerable

Inventario inicial real:

- 23 vulnerabilidades totales.
- 1 critical.
- 6 high.
- 12 moderate.
- 4 low.

Rutas principales:

- `onnxruntime-web -> protobufjs`
- `@nestjs/platform-express -> multer`
- `@nestjs/config -> lodash`
- `@nestjs/cli -> glob/picomatch/ajv/webpack/tmp`
- `@nestjs/common -> file-type`
- `@nestjs/core` y paquetes Nest relacionados

## Clasificacion

- Runtime critico: `protobufjs`.
- Runtime alto: `multer`, `lodash`.
- Dev/build alto o bajo: `glob`, `picomatch`, `tmp`, `webpack`, `ajv`.
- Residual por major requerido: paquetes `@nestjs/*`, `@angular-devkit/*`, `file-type`.

## Mitigaciones Aplicadas

Se agregaron overrides minimos:

- `protobufjs@7.5.8`
- `@protobufjs/utf8@1.1.1`
- `lodash@4.18.1`
- `multer@2.1.1`
- `picomatch@4.0.4`
- `glob@10.5.0`
- `tmp@0.2.5`

Overrides descartados por seguridad del arbol:

- `ajv@8.20.0`: produjo `npm ls` invalid al forzarse bajo Angular devkit.
- `webpack@5.104.1`: bajo riesgo/dev-only y generaba ruido de lockfile/peer.

## Resultado Audit

Inventario posterior:

- 13 vulnerabilidades totales.
- 0 critical.
- 0 high.
- 12 moderate.
- 1 low.

La criticidad `protobufjs` fue eliminada.

## Validaciones

- `npx tsc --noEmit --incremental false --project tsconfig.json`: OK.
- Tests focales de auth guard, execution denied y sanitizacion/persistencia: OK, 4 suites, 6 tests.
- `npm run build`: OK.
- `npm audit --json`: residual no critico documentado.

## Runtime Impact

- No cambio de API publica.
- No cambio major de NestJS.
- No cambio major de TypeScript.
- No cambio en Python/FastAPI.
- No se ejecuto Docker, deploy, migraciones, retraining, cron ni providers externos.

## Residual Risk

Riesgo residual aceptado temporalmente:

- Moderate runtime por Nest/file-type/core que requiere upgrade Nest mayor o prueba dedicada.
- Moderate/low dev-only por Nest CLI/Angular devkit/Webpack.

## Rollback

Rollback seguro:

1. Revisar diff: `git diff -- MetaBrain/package.json MetaBrain/package-lock.json`.
2. Remover bloque `overrides` de `MetaBrain/package.json`.
3. Restaurar lockfile si se desea rollback completo: `git restore -- MetaBrain/package-lock.json`.
4. Ejecutar `npm install`.
5. Validar `npx tsc --noEmit --incremental false --project tsconfig.json`, tests focales y `npm run build`.

## Readiness

Estado listo para commit selectivo posterior. No se realizo commit automatico.
