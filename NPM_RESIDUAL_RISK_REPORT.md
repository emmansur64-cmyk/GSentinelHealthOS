# NPM Residual Risk Report

Fecha: 2026-05-12
Proyecto: `MetaBrain`

## Resumen Residual

Despues de la mitigacion quedan 13 vulnerabilidades:

- Critical: 0
- High: 0
- Moderate: 12
- Low: 1

## Riesgos Restantes

| Paquete | Severidad | Exposicion real | Motivo de no actualizar | Mitigacion temporal | Recomendacion futura |
| --- | --- | --- | --- | --- | --- |
| `@nestjs/common` | Moderate | Runtime NestJS | La cadena incluye `file-type`; fix seguro requiere evaluacion de salto mayor transitive o Nest mayor | No aceptar archivos no confiables hacia parsers de tipo de archivo sin validacion adicional | Upgrade controlado Nest 11/paquetes compatibles en rama separada |
| `file-type` | Moderate | Runtime indirecto por `@nestjs/common` | Version segura requiere salto major transitive `>=21.3.2`; no se fuerza bajo Nest 10 | Mantener limites de payload y evitar parsing de archivos no confiables | Prueba dedicada de override o upgrade Nest |
| `@nestjs/core` | Moderate | Runtime NestJS | Fix audit recomendado es Nest 11; cambio major prohibido | Mantener auth guards y no exponer metadata/errores innecesarios | Plan de migracion Nest 11 con regresion completa |
| `@nestjs/platform-express` | Moderate | Runtime HTTP | `multer` high fue mitigado, pero advisory padre queda via `@nestjs/core` | Mantener endpoints sensibles protegidos y payload limits | Upgrade Nest 11 controlado |
| `@nestjs/mongoose` | Moderate | Runtime DB integration | Fix via major 11 | Limitar inputs persistidos y mantener sanitizacion | Upgrade Nest ecosystem completo |
| `@nestjs/testing` | Moderate | Dev/test | No runtime | No instalar dev deps en imagen runtime si aplica | Upgrade test tooling junto con Nest |
| `@nestjs/cli` | Moderate | Dev/build | Fix via major 11; cambio major prohibido | No usar CLI contra entradas remotas no confiables | Upgrade CLI en rama separada |
| `@nestjs/schematics` | Moderate | Dev/build | Fix via major | No ejecutar schematics sobre plantillas no confiables | Upgrade CLI/schematics |
| `@angular-devkit/core` | Moderate | Dev/build | `ajv` override fue descartado por arbol npm invalido | No procesar schemas no confiables en build | Upgrade tooling mayor |
| `@angular-devkit/schematics` | Moderate | Dev/build | Fix via tooling mayor | Dev-only | Upgrade tooling mayor |
| `@angular-devkit/schematics-cli` | Moderate | Dev/build | Fix via tooling mayor | Dev-only | Upgrade tooling mayor |
| `ajv` | Moderate | Dev/build validation | Override directo produjo `npm ls` invalid; se priorizo coherencia | No usar `$data` con schemas no confiables en tooling | Upgrade Angular devkit/Nest CLI |
| `webpack` | Low | Dev/build; build-time SSRF si `buildHttp`/allowedUris se usa con entradas no confiables | Override descartado por bajo riesgo y ruido de lockfile | No habilitar `buildHttp` con URLs no confiables | Upgrade Nest CLI/Webpack en ciclo de tooling |

## Riesgo Critico protobufjs

El riesgo critico fue mitigado:

- `protobufjs` paso a `7.5.8`.
- `@protobufjs/utf8` paso a `1.1.1`.
- `npm audit` post-upgrade no reporta critical ni high.

## Aceptacion Temporal

El residual se acepta temporalmente porque resolverlo por audit automatico requiere cambios major de Nest/CLI o overrides que degradan coherencia del arbol. Se recomienda abrir una rama separada para migracion de Nest/tooling con matriz de regresion completa.
