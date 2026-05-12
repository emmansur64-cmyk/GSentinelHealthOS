# NPM AUDIT DEPENDENCY MAP

Fecha: 2026-05-12

## Inventario

Comandos ejecutados en `MetaBrain`:

- `npm audit --json > npm-audit-current.json`
- `npm ls protobufjs`
- `npm ls multer`
- `npm ls lodash`
- `npm ls glob`
- `npm ls picomatch`
- `npm ls @nestjs/platform-express`
- `npm ls @nestjs/cli`

Resultado audit inicial observado en esta fase: 23 vulnerabilidades, 1 critical, 6 high, 12 moderate, 4 low.

Nota: el conteo difiere del reporte anterior de 22 porque el feed actual de `npm audit` agrego advisories nuevos para `protobufjs`/`@protobufjs/utf8`.

## Mapa de dependencias vulnerables

| Paquete | Severidad | Version actual | Version segura sugerida | Padre | Runtime/dev | Impacto runtime | Explotabilidad real | Prioridad |
|---|---:|---:|---:|---|---|---|---|---|
| `protobufjs` | critical/high/moderate | 7.5.4 | 7.5.8 | `onnxruntime-web@1.18.0` | runtime | ONNX web runtime dependency | Reachable si `onnxruntime-web` carga/procesa modelos protobuf; riesgo alto por RCE/codegen advisories | P1 |
| `@protobufjs/utf8` | moderate | 1.1.0 | 1.1.1 | `protobufjs` | runtime | UTF-8 decode helper | Reachable via `protobufjs` parsing | P1 |
| `multer` | high | 2.0.2 | 2.1.1 | `@nestjs/platform-express@10.4.22` | runtime | multipart upload handling | Reachable solo si se usan interceptors/file upload; no se detecto uso directo, pero dependency esta en server runtime | P2 |
| `lodash` | high/moderate | 4.17.21 | 4.18.1 | `@nestjs/config`, `@nestjs/cli`, `inquirer`, `node-emoji` | runtime + dev | Config/runtime loads lodash through `@nestjs/config` | Reachable si app usa vulnerable APIs indirectly; no se vio uso directo propio | P2 |
| `glob` | high | 10.4.5 | 10.5.0 | `@nestjs/cli` | dev/build | CLI/build tooling | No runtime server path; exploitable via malicious local CLI usage/patterns | P3 |
| `picomatch` | high/moderate | 4.0.1 | 4.0.4 | `@angular-devkit/core` via `@nestjs/cli` | dev/build | CLI/build tooling | No runtime server path | P3 |
| `ajv` | moderate | 8.12.0 / affected range | Not applied | `@angular-devkit/core` via `@nestjs/cli` | dev/build | CLI/build schema validation | No runtime server path; override was rejected because it produced an invalid npm tree | P4 residual |
| `webpack` | low | 5.97.1 | Not applied | `@nestjs/cli` | dev/build | build tooling | No runtime server path; override was rejected because it added lockfile/peer risk for a low dev-only issue | P4 residual |
| `tmp` | low | 0.2.3 | 0.2.5 | `external-editor` via `inquirer` | dev/build | interactive CLI dependency | No runtime server path | P4 |
| `file-type` | moderate | 20.4.1 | >=21.3.2 | `@nestjs/common@10.4.22` | runtime | Nest common utility dependency | Potential parser DoS if file type detection reached; safe fix requires transitive major override or Nest major | Residual |
| `@nestjs/common` | moderate | 10.4.22 | 11.1.19 per audit | direct | runtime | Nest framework | Fix requires Nest major; prohibited | Residual |
| `@nestjs/core` | moderate | 10.4.22 | 11.1.19 per audit | direct | runtime | Nest framework | Fix requires Nest major; prohibited | Residual |
| `@nestjs/platform-express` | high | 10.4.22 | 11.1.19 per audit | direct | runtime | HTTP adapter | Full advisory fix requires Nest major; `multer` can be mitigated separately | Residual partial |
| `@nestjs/mongoose` | moderate | 10.1.0 | 11.0.4 per audit | direct | runtime | Nest Mongo integration | Fix requires Nest major | Residual |
| `@nestjs/config` | moderate | 3.3.0 | 4.0.4 per audit | direct | runtime | Config module | Fix requires major; lodash mitigated separately | Residual partial |
| `@nestjs/testing` | moderate | 10.4.22 | 11.1.19 per audit | dev/test | dev/test | Test framework only | Fix requires Nest major | Residual |
| `@nestjs/cli` | high | 10.4.9 | 11.0.21 per audit | devDependency | dev/build | CLI/build only | Fix requires major; transitive mitigations applied where possible | Residual partial |
| `@nestjs/schematics` | moderate | 10.2.3 | 11.1.0 per audit | devDependency | dev/build | Codegen tooling | Fix requires major | Residual |
| `@angular-devkit/core` | moderate | 17.3.11 | via Nest CLI major | dev/build | CLI/build | Transitive dev tooling | `picomatch` mitigated; `ajv` left residual to avoid invalid npm tree | Residual partial |
| `@angular-devkit/schematics` | moderate | 17.3.11 | via Nest CLI major | dev/build | CLI/build | Codegen tooling | Parent remains until Nest CLI major | Residual |
| `@angular-devkit/schematics-cli` | moderate | 17.3.11 | via Nest CLI major | dev/build | CLI/build | Codegen tooling | Parent remains until Nest CLI major | Residual |
| `inquirer` | low | 8.2.6 / 9.2.15 | via Nest CLI major | dev/build | CLI/build | Interactive prompts | `tmp` mitigated where possible | Residual partial |
| `external-editor` | low | transitive | via Nest CLI major | dev/build | CLI/build | Interactive editor helper | `tmp` mitigated | Residual partial |

## Direct vs transitive

Direct runtime dependencies with audit entries:

- `@nestjs/common`
- `@nestjs/config`
- `@nestjs/core`
- `@nestjs/mongoose`
- `@nestjs/platform-express`

Direct dev dependencies with audit entries:

- `@nestjs/cli`
- `@nestjs/schematics`
- `@nestjs/testing`

Transitives selected for safe mitigation:

- `protobufjs`
- `@protobufjs/utf8`
- `multer`
- `lodash`
- `glob`
- `picomatch`
- `ajv`
- `webpack`
- `tmp`
