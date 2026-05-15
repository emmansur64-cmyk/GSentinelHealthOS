# Node Runtime Alignment - medical-agenda-saas

Fecha: 2026-05-09
Entorno: LABORATORIO / DEV
Proyecto auditado: `E:\GSentinelHealthOS\medical-agenda-saas`

## Estado final

FASE NODE RUNTIME ALIGNMENT COMPLETA

El proyecto queda documentado y con pin local no invasivo para Node 20.x. No se cambio runtime de produccion, contenedores, dependencias, lockfile ni codigo clinico.

## Versiones detectadas

- Shell local actual:
  - `node -v`: `v24.11.1`
  - `npm -v`: `11.6.2`
  - `npx -v`: `11.6.2`
- `package.json`:
  - `engines.node`: `20.x`
  - `engines.npm`: `10.8.x`
  - `packageManager`: `npm@10.8.2`
- `package-lock.json`:
  - `lockfileVersion`: `3`
- Dependencias principales instaladas:
  - Next.js: `16.2.2`
  - TypeScript: `5.9.3`
  - Prisma CLI: `6.18.0`
  - `@prisma/client`: `6.18.0`
- Dockerfile del subproyecto:
  - `FROM node:20-bookworm-slim AS deps`
  - `FROM node:20-bookworm-slim AS builder`
  - `FROM node:20-bookworm-slim AS runner`
- Compose relevante:
  - `medical-agenda-saas/docker-compose.prod.yml` usa `build.context: .`, `dockerfile: Dockerfile`, targets `bootstrap` y `runner`.
  - `E:\GSentinelHealthOS\docker-compose.yml` tiene servicios `frontend` y `migrate-frontend` con `build.context: ./medical-agenda-saas` y `dockerfile: Dockerfile`.
  - No se modifico ningun compose.
- Version managers detectados antes del cambio:
  - `.nvmrc`: no existia
  - `.node-version`: no existia
  - `.tool-versions`: no existia
  - `.fnmrc`: no existia
  - Volta config: no detectada
  - `nvm`: no disponible en esta shell
  - `fnm`: no disponible en esta shell
  - `volta`: no disponible en esta shell
  - `asdf`: no disponible en esta shell
  - `corepack`: disponible, version `0.34.2`
  - `corepack npm --version`: `10.8.2`

## Riesgo de drift

El host local esta usando Node `v24.11.1` y npm `11.6.2`, mientras el proyecto declara Node `20.x` y npm `10.8.x`, y el runtime containerizado del subproyecto usa Node 20. Aunque `typecheck` y `build` pasaron previamente, el desarrollo local podia validar con un runtime distinto al esperado por CI/runtime.

## Mecanismo recomendado

Se respeto lo ya existente:

- `package.json` ya declara correctamente `engines`.
- `package.json` ya declara `packageManager: npm@10.8.2`.
- `package-lock.json` ya esta en lockfileVersion 3.
- Dockerfile ya usa Node 20.

La opcion minima elegida fue agregar `.nvmrc` con:

```text
20
```

Motivo: es reversible, no instala herramientas, no cambia dependencias, no toca lockfile, y es compatible con flujos habituales de `nvm` y `fnm`. El pin de npm se mantiene via `packageManager`/Corepack.

## Cambios aplicados

- Creado: `medical-agenda-saas/.nvmrc`
- Creado/actualizado: `NODE_RUNTIME_ALIGNMENT.md`

No se modifico:

- `package.json`
- `package-lock.json`
- `Dockerfile`
- `docker-compose.yml`
- `medical-agenda-saas/docker-compose.prod.yml`
- codigo clinico
- paneles
- WhatsApp pipeline
- MetaBrain runtime
- `node_modules`

No se ejecutaron:

- `npm audit fix`
- actualizaciones de dependencias
- reinstalacion completa
- reinicio de contenedores
- cambios de runtime global de Windows

## Validacion con Node 20

Node 20 no esta disponible en esta shell por `nvm`, `fnm`, `volta`, `asdf`, `nvs`, `nodist` ni por otra entrada `node.exe` en PATH. Por instruccion, no se instalo automaticamente.

Validacion ejecutada temporalmente con Node `v24.11.1` queda registrada como evidencia de no regresion local, pero no reemplaza la validacion final con Node 20.

## Comandos seguros para trabajar con Node 20

Opcion con fnm:

```powershell
cd E:\GSentinelHealthOS\medical-agenda-saas
fnm install 20
fnm use 20
corepack enable
corepack npm --version
npm run prisma:generate
npm run typecheck
npm run build
```

Opcion con nvm-windows:

```powershell
cd E:\GSentinelHealthOS\medical-agenda-saas
nvm install 20
nvm use 20
corepack enable
corepack npm --version
npm run prisma:generate
npm run typecheck
npm run build
```

Comprobacion esperada:

```powershell
node -v
npm -v
corepack npm --version
```

El objetivo es Node `20.x` y npm `10.8.x` para este proyecto.

## Validaciones ejecutadas

Pendiente de completar en Node 20 porque Node 20 no esta disponible localmente en esta shell.

Validaciones de no regresion ejecutadas con el runtime local actual:

- `npm run typecheck`
- `npm run build`
- pruebas focales de medical-web-retrieval:
  - retrieval OFF
  - retrieval ON mock
  - fallback

## Riesgos pendientes

- La shell local sigue usando Node `v24.11.1` / npm `11.6.2` hasta que el operador active Node 20 con un version manager.
- Conviene ejecutar nuevamente `npm run prisma:generate`, `npm run typecheck`, `npm run build` y las pruebas focales bajo Node 20 cuando este disponible.
- `corepack npm --version` resuelve `10.8.2`, pero bajo Node 24 no elimina el drift de runtime Node.
