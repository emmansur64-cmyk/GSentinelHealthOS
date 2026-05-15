# TYPESCRIPT TOOLCHAIN VALIDATION

Fecha: 2026-05-09
Proyecto raiz: `E:\GSentinelHealthOS`
Sistema auditado: `E:\GSentinelHealthOS\medical-agenda-saas`
Entorno: LABORATORIO / DEV

## Resumen ejecutivo

La capacidad de typecheck fue restaurada sin cambiar arquitectura, sin tocar runtime clinico, sin tocar paneles, sin tocar auth, sin tocar WhatsApp, sin modificar compose y sin actualizar versiones.

Estado final:

- `tsc`: recuperado.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- `medical-web-retrieval`: compila y mantiene fallback.
- contenedores: no reiniciados, no reconstruidos.

Confirmacion:

FASE TOOLCHAIN TYPESCRIPT COMPLETA

## Causa raiz exacta

La causa de `tsc not found` local era ausencia completa de `node_modules` dentro de:

```text
E:\GSentinelHealthOS\medical-agenda-saas
```

Evidencia previa:

```text
Test-Path node_modules               -> False
Test-Path node_modules\typescript    -> False
Test-Path node_modules\.bin          -> False
npm ls typescript --depth=0          -> (empty)
```

No era un problema de `package.json`: `typescript` ya estaba declarado como `devDependency`.

No era un problema de lockfile: `package-lock.json` ya contenia `node_modules/typescript` con version `5.9.3`.

El contenedor `gs_frontend` no servia para validar typecheck porque es imagen runner/produccion:

```text
WorkingDir: /app
Cmd: ["node","server.js"]
node: v20.20.2
npm: 10.8.2
npm ls typescript --depth=0 -> (empty)
```

Esto explica `sh: 1: tsc: not found` dentro del contenedor: no trae devDependencies para typecheck.

## Package manager real

Package manager canonico:

```json
"packageManager": "npm@10.8.2"
```

Lockfile canonico:

```text
medical-agenda-saas/package-lock.json
```

No se detectaron lockfiles activos de pnpm, yarn o bun en `medical-agenda-saas`.

## Versiones auditadas

Version requerida por `package.json`:

```json
"engines": {
  "node": "20.x",
  "npm": "10.8.x"
}
```

Version local observada:

```text
node v24.11.1
npm 11.6.2
```

Version en contenedor `gs_frontend`:

```text
node v20.20.2
npm 10.8.2
```

Riesgo: el host local no coincide con engines. Aun asi, typecheck y build pasaron. Para reproducibilidad estricta, la validacion deberia ejecutarse con Node 20/npm 10.8.

## Configuracion TS/Next

Archivos encontrados:

- `medical-agenda-saas/tsconfig.json`
- `medical-agenda-saas/next.config.ts`

`tsconfig.json` relevante:

- `strict: true`
- `moduleResolution: "bundler"`
- alias `@/* -> ./src/*`
- include `**/*.ts`, `**/*.tsx`, `.next/types`, `.next/dev/types`
- exclude `node_modules`, `tests`, `backups`

Scripts relevantes:

```json
"typecheck": "tsc --noEmit",
"build": "next build"
```

Stack principal:

```text
next 16.2.2
react 19.2.4
react-dom 19.2.4
typescript 5.9.3
```

## Docker/compose auditado

Compose raiz:

- `frontend` usa build context `./medical-agenda-saas`.
- `frontend` usa `medical-agenda-saas/Dockerfile`.
- No hay volumen que monte `medical-agenda-saas` sobre `/app` en `gs_frontend`.
- No hay volumen de `node_modules` en `frontend`.

Dockerfile:

- stage `deps`: `npm ci --include=dev`
- stage `builder`: copia `node_modules` y ejecuta `npm run build`
- stage `runner`: copia standalone y ejecuta `node server.js`

Conclusion: es esperado que `runner` no exponga `tsc` como herramienta de desarrollo.

## Cambios minimos aplicados

Se ejecuto:

```powershell
npm ci --include=dev --ignore-scripts
```

Motivo:

- `node_modules` no existia.
- `package-lock.json` ya estaba presente.
- `typescript` ya estaba declarado.
- `npm ci` restaura exactamente lo declarado en lockfile.
- `--ignore-scripts` evita efectos colaterales de postinstall durante la primera restauracion.

Luego se ejecuto:

```powershell
npm run prisma:generate
```

Motivo:

- El primer `npm run typecheck` ya encontraba `tsc`, pero fallaba porque `@prisma/client` no tenia tipos generados (`PrismaClient`, `Role`, `AppointmentStatus`, etc.).
- `prisma generate` genero cliente Prisma local desde `prisma/schema.prisma`.

Archivos versionados modificados por esta fase:

- Ninguno.

No se modifico:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `docker-compose.yml`
- Dockerfile
- codigo clinico
- medical-web-retrieval
- paneles
- auth
- WhatsApp
- MetaBrain

## Validaciones ejecutadas

### TypeScript disponible

```powershell
.\node_modules\.bin\tsc.cmd -v
```

Resultado:

```text
Version 5.9.3
```

### Typecheck

```powershell
npm run typecheck
```

Resultado:

```text
tsc --noEmit
OK
```

### Next build

```powershell
npm run build
```

Resultado:

```text
Compiled successfully
Finished TypeScript
Generated static pages 62/62
OK
```

Warnings no bloqueantes:

- Turbopack reporto `Encountered unexpected file in NFT list`.
- Import trace apunta a `src/lib/prisma.ts` desde `src/app/api/public/register-clinic/route.ts`.
- No se corrigio porque no bloquea build y no forma parte del objetivo de toolchain.

### Lint focal

```powershell
npx eslint src/lib/medical-web-retrieval src/chat/chat.service.ts src/lib/groq-doctor-chat.ts
```

Resultado:

```text
OK
```

### Retrieval OFF

Resultado:

```text
RETRIEVAL_OFF_OK
```

### Retrieval ON mock

Resultado:

```json
{
  "used": true,
  "fallback": false,
  "evidence": 2
}
```

### Timeout/fallback

Resultado:

```json
{
  "used": false,
  "fallback": true,
  "error": "no_evidence_fragments",
  "reason": "AbortError"
}
```

## Estado runtime

No se reiniciaron contenedores.

Estado observado:

```text
gs_frontend  Up 3 hours (unhealthy)  gsentinelhealthos-frontend
```

El estado `unhealthy` ya estaba presente antes de esta fase de reparacion local. Esta fase no modifico ni reinicio el contenedor.

## Riesgos pendientes

1. Host local fuera de engines:
   - requerido: Node 20.x / npm 10.8.x
   - observado: Node 24.11.1 / npm 11.6.2

2. `npm ci` reporto vulnerabilidades:
   - 7 moderate
   - 6 high
   - 1 critical

   No se ejecuto `npm audit fix` por restriccion explicita.

3. Build pasa con warnings NFT de Turbopack. No bloquea, pero conviene auditar luego `src/lib/prisma.ts` y rutas que lo importan.

4. El contenedor runner no tiene `tsc`. Eso es normal para produccion, pero typecheck debe ejecutarse localmente, en stage `builder` o en un contenedor dev/CI con devDependencies.

## Estado final

- Causa raiz: `node_modules` local ausente; Prisma Client no generado tras restaurar dependencias con scripts ignorados.
- Correccion minima: `npm ci --include=dev --ignore-scripts` + `npm run prisma:generate`.
- TypeScript: OK.
- Typecheck: OK.
- Build Next: OK.
- medical-web-retrieval: OK.
- Fallback: OK.
- Runtime actual: preservado.

FASE TOOLCHAIN TYPESCRIPT COMPLETA
