# FRONTEND CACHE PERMISSION FIX

## Causa raiz exacta

`gs_frontend` corria como usuario no-root:

```text
uid=999(nextjs) gid=999(nodejs)
```

Pero los paths copiados desde el stage builder quedaban propiedad de `root`:

```text
root:root 755 /app
root:root 755 /app/.next
/app/.next/cache no existia
```

Next intentaba crear/escribir:

```text
/app/.next/cache
```

Como `/app/.next` era `root:root 755`, `nextjs` no tenia permisos de escritura. Eso producia:

```text
EACCES: permission denied, mkdir '/app/.next/cache'
```

## Healthcheck

El healthcheck del servicio `frontend` usa:

```yaml
node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

Tambien se detecto que Next estaba anunciando:

```text
Local: http://<container-hostname>:3000
```

y `fetch('http://localhost:3000/')` desde el contenedor devolvia:

```text
ECONNREFUSED
```

Por eso el contenedor quedaba unhealthy aunque la app estuviera parcialmente funcional por el puerto publicado.

## Cambios aplicados

Archivo modificado:

- `medical-agenda-saas/Dockerfile`

Cambios:

```dockerfile
ENV HOSTNAME=0.0.0.0
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next /app/public /app/prisma
```

Esto mantiene runtime non-root (`nextjs`) y evita correr Next como root.

## Permisos encontrados despues

Dentro de `gs_frontend`:

```text
uid=999(nextjs) gid=999(nodejs)
root:root 755 /app
nextjs:nodejs 755 /app/.next
nextjs:nodejs 755 /app/.next/cache
CACHE_WRITE_OK
```

## Validaciones ejecutadas

Reconstruccion controlada:

```powershell
docker compose build frontend
docker compose up -d --no-deps --force-recreate frontend
```

Validaciones:

```text
docker inspect gs_frontend -> healthy failing=0
docker compose ps frontend -> Up ... (healthy)
touch /app/.next/cache/.permission-test -> OK
fetch('http://localhost:3000/') -> 200
```

No aparecieron logs recientes de:

- `EACCES`
- `permission denied`
- `/app/.next/cache`

Validaciones de no regresion:

- `npm run typecheck`: OK.
- `npm run build`: OK.
- Groq desde `gs_frontend` `/models`: 200.
- Brain desde `gs_frontend` `/orchestrate`: 200.

## Riesgos pendientes

- `npm run build` conserva un warning preexistente de Turbopack/NFT en `next.config.ts`; no esta relacionado con permisos de cache.
- Si en el futuro se agregan bind mounts sobre `/app` o `/app/.next`, pueden volver a cambiar ownership/permisos.

## Estado final

`gs_frontend` queda healthy, Next puede escribir cache interna y el runtime sigue usando usuario no-root.

FRONTEND CACHE PERMISSIONS VALIDADO
