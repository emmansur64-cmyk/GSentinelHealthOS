# GITHUB SSH UPLOAD VALIDATION REPORT

Fecha: 2026-05-17
Proyecto: `E:\GSentinelHealthOS`

## Resumen

Se ejecutaron validaciones tecnicas sin deploy, sin migraciones y sin tocar base real.

## Validaciones ejecutadas

### Git seguridad de stage
- `git diff --cached --name-only` ejecutado.
- `git diff --cached --check` ejecutado.
  - Hallazgos: trailing whitespace / blank line EOF en multiples archivos Markdown/TS.
  - Resultado: advertencias de formato, no bloqueo funcional.
- Scan defensivo de staged diff por patrones sensibles ejecutado.
  - Hallazgos: coincidencias de placeholders/env keys y textos de docs.
  - No se detectaron secretos hardcodeados nuevos en `docker-compose.yml` staged (usa variables `${...}`).

### Node / TS

#### MB-Chat
- `npm run lint` -> **FAIL**
  - Motivo: ESLint v9 requiere `eslint.config.*` (config no migrada).
- `npm run test` -> **FAIL parcial**
  - Resultado: 20 suites pass, 4 fail.
  - Principales fallas:
    - contratos de constructor desactualizados en specs (`BrainService`, `EventProducer`, `PersistenceService`)
    - timeout en `medical-assistant.controller.spec.ts`
- `npm run build` -> **PASS**

#### Panel-SuperAdmin
- `npm run lint` -> **PASS**
- `npm run test` -> **PASS** (16/16)
- `npm run build` -> **PASS**

#### medical-agenda-saas
- `npm run lint` -> **PASS con warnings** (0 errores, 53 warnings)
- `npm run build` -> **PASS**
  - Warning de Turbopack/NFT trace en `next.config.ts` (no bloqueante)

### Python
- `python -m compileall .` -> **PASS** (con `SyntaxWarning` no bloqueante en script de tests)
- `pytest -q` -> comando no disponible en PATH
- `python -m pytest -q` -> **FAIL** en recoleccion
  - Motivo: dependencias faltantes en entorno actual (`fastapi`, `redis`, `sqlalchemy`, `httpx`, `pytest_asyncio`, etc.)

### Docker
- `docker compose config` -> **PASS tecnico** (config resuelta)
- Riesgo detectado: el comando expandio valores sensibles del entorno local en salida de consola.
  - Accion: no se stageo esa salida ni se genero archivo con secretos.

## Conclusión de validación

- Validación de build principal: **OK** en `MB-Chat`, `Panel-SuperAdmin`, `medical-agenda-saas`.
- Estado de tests: **mixto** (fallas conocidas en MB-Chat y dependencias Python ausentes en este entorno).
- Seguridad de stage: **aceptable** para commit selectivo actual, con exclusión explícita de dataset sensible `MB-Chat/data/medical-chat-learning.jsonl`.
