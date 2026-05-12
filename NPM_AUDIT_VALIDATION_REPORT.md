# NPM Audit Validation Report

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Vulnerabilidades Antes/Despues

| Momento | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Antes (`npm-audit-current.json`) | 1 | 6 | 12 | 4 | 23 |
| Despues (`npm-audit-after.json`) | 0 | 0 | 12 | 1 | 13 |

## Mitigaciones Aplicadas

Se agregaron overrides minimos en `MetaBrain/package.json` y se regenero `MetaBrain/package-lock.json`.

| Paquete | Antes | Despues | Resultado |
| --- | --- | --- | --- |
| `protobufjs` | 7.5.4 | 7.5.8 | Critica eliminada |
| `@protobufjs/utf8` | 1.1.0 | 1.1.1 | Moderada transitive eliminada |
| `multer` | 2.0.2 | 2.1.1 | Alta eliminada |
| `lodash` | 4.17.21 | 4.18.1 | Alta eliminada |
| `glob` | 10.4.5 | 10.5.0 | Alta eliminada |
| `picomatch` | 4.0.1 | 4.0.4 | Alta eliminada |
| `tmp` | 0.0.33 / 0.2.3 chain | 0.2.5 | Baja eliminada para `external-editor` |

## Validaciones Ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm audit --json > npm-audit-current.json` | Exit 1 esperado por vulnerabilidades; inventario creado |
| `npm ls protobufjs` / `npm ls multer` / `npm ls lodash` / `npm ls glob` / `npm ls picomatch` / `npm ls @nestjs/platform-express` / `npm ls @nestjs/cli` | Arbol vulnerable identificado |
| `npm install` | OK; lockfile regenerado con overrides finales |
| `npm audit --json > npm-audit-after.json` | Exit 1 esperado por residual; sin critical/high |
| `npm ls protobufjs @protobufjs/utf8 multer lodash glob picomatch tmp --depth=8` | OK para paquetes mitigados; muestra `chokidar@3.6.0 invalid` preexistente en rama CLI, sin advisory audit |
| `npx tsc --noEmit --incremental false --project tsconfig.json` | OK |
| `npx jest --config jest.config.ts --runTestsByPath src/ingress/api-key-guard.coverage.spec.ts src/execution/execution-denied-status.spec.ts src/common/utils/persistence-sanitizer.util.spec.ts src/persistence/persistence-sanitization.spec.ts --runInBand` | OK: 4 suites, 6 tests |
| `npm run build` | OK |

## Tests No Incluidos Como Go/No-Go

Se intento ejecutar tambien `src/ingress/incident.robustness.spec.ts` para cobertura HTTP/middleware. Fallo en compilacion por firmas antiguas de constructores y metodo `handle`, no por el cambio npm:

- `BrainService` espera mas argumentos que los provistos por el test.
- `EventProducer` requiere `RabbitBusService`.
- `IncidentController.handle` espera `payload` y `request`.

Este test queda como deuda preexistente de mantenimiento de test, no como regresion del upgrade.

## Warnings

- `npm install` mantiene warnings `ERESOLVE overriding peer dependency` sobre peers de `rxjs` y `ajv-keywords`; no bloquean install, build ni tests.
- `npm ls` muestra `chokidar@3.6.0 invalid` dentro de `@nestjs/cli`. Es dev/build y no aparece como vulnerabilidad audit vigente.
- Jest emite warnings Mongoose por indice duplicado `incidentId`; preexistente al cambio npm.

## Impacto Runtime

Runtime preservado:

- No se cambio major de NestJS.
- No se cambio major de TypeScript.
- No se agregaron dependencias nuevas directas.
- No se levanto servidor, Docker, cron, providers externos ni entrenamientos.
- Build Nest OK.
