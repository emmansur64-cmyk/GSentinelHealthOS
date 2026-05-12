# NPM Audit Risk Classification

Fecha: 2026-05-12
Alcance: `MetaBrain` npm dependencies, sin deploy, sin produccion, sin proveedores externos.

## Resumen

`npm audit --json` reporto 23 vulnerabilidades actuales:

- Criticas: 1
- Altas: 6
- Moderadas: 12
- Bajas: 4

La cifra actual difiere del conteo previo esperado de 22 por advisories vigentes al momento de la ejecucion. No se asumio el conteo historico: se uso el arbol real local.

## A. Criticas Runtime

| Paquete | Severidad | Ruta | Exploit path | Exposicion real | Reachable | Mitigacion |
| --- | --- | --- | --- | --- | --- | --- |
| `protobufjs` | Critical | `onnxruntime-web -> protobufjs@7.5.4` | RCE por parsing/procesamiento vulnerable en libreria de protobuf | Runtime porque `onnxruntime-web` esta en `dependencies`; uso efectivo depende de ejecucion de inferencia web/ONNX | Potencialmente reachable por pipeline IA/ML | Override minimo a `protobufjs@7.5.8` y `@protobufjs/utf8@1.1.1` |

## B. Altas Runtime

| Paquete | Severidad | Ruta | Exploit path | Exposicion real | Reachable | Mitigacion |
| --- | --- | --- | --- | --- | --- | --- |
| `multer` | High | `@nestjs/platform-express -> multer@2.0.2` | Riesgo en multipart/request parsing | Runtime HTTP NestJS | Reachable si endpoints aceptan multipart/file upload o middleware lo procesa | Override acotado dentro de `@nestjs/platform-express` a `multer@2.1.1` |
| `lodash` | High | `@nestjs/config -> lodash@4.17.21`; tambien tooling CLI | Riesgos de prototype pollution/DoS segun advisory vigente | Runtime por `@nestjs/config` | Reachable en configuracion/normalizacion si procesa objetos controlables | Override a `lodash@4.18.1` sin cambiar major de `@nestjs/config` |

## C. Solo Dev/Build

| Paquete | Severidad | Ruta | Exposicion real | Mitigacion |
| --- | --- | --- | --- | --- |
| `@nestjs/cli` | High | direct devDependency | Tooling local/build, no runtime de `start` | No subir a major 11; mitigar transitivos compatibles |
| `glob` | High | `@nestjs/cli -> glob@10.4.5` | Dev/build | Override a `glob@10.5.0` |
| `picomatch` | High | `@nestjs/cli -> @angular-devkit/core -> picomatch@4.0.1` | Dev/build pattern matching | Override a `picomatch@4.0.4` bajo `@angular-devkit/core` |
| `ajv` | Moderate | `@nestjs/cli -> @angular-devkit/core -> ajv@8.17.1` | Dev/build validation | Override a `ajv@8.20.0` bajo `@angular-devkit/core` |
| `tmp` | Low | `@nestjs/cli -> inquirer -> external-editor -> tmp@0.2.3` | Dev CLI/editor temp files | Override a `tmp@0.2.5` bajo `external-editor` |
| `webpack` | Low | `@nestjs/cli -> webpack@5.97.1` | Build tooling | Override a `webpack@5.104.1` bajo `@nestjs/cli` |

## D. No Mitigables Sin Mayor Riesgo En Este Ciclo

| Paquete | Severidad | Ruta | Motivo de no upgrade inmediato | Riesgo residual |
| --- | --- | --- | --- | --- |
| `@nestjs/common` | Moderate | direct runtime | Advisory recomienda versiones fuera del rango actual o fix via dependencias transitivas; cambiar major Nest esta prohibido | Runtime residual a documentar |
| `@nestjs/core` | Moderate | direct runtime | Fix disponible via Nest 11; prohibido cambiar major Nest | Runtime residual a documentar |
| `@nestjs/platform-express` | High | direct runtime | Audit recomienda Nest 11; se mitiga `multer` por override, no framework major | Residual de advisory del paquete padre hasta upgrade planificado |
| `@nestjs/mongoose` | Moderate | direct runtime | Fix via major 11; prohibido | Residual runtime si advisory aplica a uso real |
| `@nestjs/config` | Moderate | direct runtime | Fix via major 4; se mitiga `lodash` por override | Residual del paquete padre hasta evaluar upgrade mayor |
| `file-type` | Moderate | `@nestjs/common -> file-type@20.4.1` | Version segura `>=21.3.2` implica salto major transitive bajo Nest runtime | Residual aceptado temporalmente, requiere prueba dedicada o upgrade Nest controlado |
| `@nestjs/testing`, `@nestjs/schematics`, `@angular-devkit/schematics*` | Moderate | dev/test tooling | Fix mayor Nest tooling; no runtime | Residual dev-only |
| `inquirer`, `external-editor` | Low | dev CLI | Solo tooling; se intenta mitigar `tmp`, no se cambia cadena completa | Residual dev-only si advisory persiste |

## Decision

Se procede con overrides minimos sobre transitivos compatibles por semver cuando reducen exposicion sin cambiar contratos, API Nest, TypeScript major ni pipeline. Se documenta residual que requiere upgrade mayor de Nest/tooling o evaluacion separada.
