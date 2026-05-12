# NPM Safe Upgrade Plan

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Principios

- No usar `npm audit fix --force`.
- No cambiar major directo de NestJS ni TypeScript.
- No reemplazar framework ni runtime.
- Usar overrides transitive-only cuando el rango padre lo tolera o el cambio es patch/minor de bajo riesgo.
- Validar con audit, TypeScript, tests focales y build.

## Upgrades Propuestos

| Paquete | Current | Target | Metodo | Breaking risk | Runtime risk | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| `protobufjs` | 7.5.4 | 7.5.8 | `overrides` | Bajo: patch dentro de major 7 | Bajo/medio por uso ONNX | Remover override y restaurar lockfile |
| `@protobufjs/utf8` | 1.1.0 | 1.1.1 | `overrides` | Bajo: patch | Bajo | Remover override y restaurar lockfile |
| `multer` | 2.0.2 | 2.1.1 | override acotado a `@nestjs/platform-express` | Bajo/medio: minor de middleware HTTP | Medio: request parsing/multipart | Remover override y restaurar lockfile |
| `lodash` | 4.17.21 | 4.18.1 | `overrides` | Bajo/medio: patch/minor en lib comun | Medio por `@nestjs/config` | Remover override y restaurar lockfile |
| `glob` | 10.4.5 | 10.5.0 | override acotado a `@nestjs/cli` | Bajo: minor tooling | Nulo en runtime | Remover override y restaurar lockfile |
| `picomatch` | 4.0.1 | 4.0.4 | override acotado a `@angular-devkit/core` | Bajo: patch/minor tooling | Nulo en runtime | Remover override y restaurar lockfile |
| `ajv` | 8.12.0 / affected range | Not applied | Residual documentado | Override produjo arbol `npm ls` invalido | Nulo en runtime | Evaluar con upgrade mayor controlado de `@nestjs/cli` |
| `tmp` | 0.2.3 | 0.2.5 | override acotado a `external-editor` | Bajo: patch | Nulo en runtime | Remover override y restaurar lockfile |
| `webpack` | 5.97.1 | Not applied | Residual documentado | Override amplio para issue low/dev-only | Nulo en runtime directo | Evaluar con upgrade mayor controlado de `@nestjs/cli` |

## No Incluidos En Mitigacion Automatica

| Paquete | Motivo |
| --- | --- |
| `@nestjs/*` directos | Fix mayor recomendado; prohibido cambiar major Nest en este ciclo |
| `file-type` | Safe `>=21.3.2` es salto major transitive bajo `@nestjs/common`; requiere prueba dedicada |
| `@angular-devkit/schematics*` | Dev-only y fix via mayor tooling; se deja residual documentado |
| `ajv` | Dev-only bajo Angular devkit; override descartado por coherencia del arbol |
| `inquirer` | Dev-only; cadena completa requiere mayor tooling; se mitiga `tmp` donde es seguro |
| `webpack` | Dev-only bajo Nest CLI; override descartado por bajo riesgo y lockfile/peer risk |

## Tests Requeridos

- `npm audit --json` post-upgrade.
- `npx tsc --noEmit --incremental false --project tsconfig.json`.
- Jest focal de auth guards, execution denied y sanitizacion/persistencia.
- `npm run build`.

## Criterio Go/No-Go

Go si:

- `npm install` resuelve sin conflictos criticos.
- TypeScript OK.
- Tests focales OK.
- Build OK.
- No aparece cambio inesperado fuera de `package.json`, `package-lock.json`, `npm-audit-*.json` y reportes.

No-Go si:

- Rompe build/runtime tests.
- Introduce peer dependency conflict critico.
- Requiere upgrade major directo de Nest/TypeScript.
