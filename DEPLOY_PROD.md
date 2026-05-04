# Deploy Productivo Seguro

Este documento define el flujo oficial de deploy en produccion para GSentinelHealthOS.

## Script oficial

Archivo: [scripts/deploy-prod-safe.sh](scripts/deploy-prod-safe.sh)
Wrapper raiz: [deploy-prod-safe.sh](deploy-prod-safe.sh)

Caracteristicas:
- set -euo pipefail
- Validaciones previas estrictas
- Backup obligatorio antes de tocar runtime
- Pull controlado con ff-only
- Build real de Node/Next (si aplica)
- Prisma migrate deploy (nunca migrate dev)
- Deploy Docker con compose config previo
- Validacion post deploy
- Rollback automatico al commit anterior si falla
- Logs en deploy-logs/
- Sanitizacion de logs para ocultar secretos y credenciales
- Confirmacion interactiva (o AUTO_CONFIRM=1)

## Flujo esperado

PC/VS Code -> git push -> GitHub -> VM -> deploy seguro en VM.

## Comandos en VM

1. Entrar al repo:

```bash
cd ~/GSentinelHealthOS
```

2. Dar permisos de ejecucion (solo la primera vez):

```bash
chmod +x scripts/deploy-prod-safe.sh
chmod +x deploy-prod-safe.sh
```

3. Ejecutar con confirmacion interactiva:

```bash
./scripts/deploy-prod-safe.sh
```

4. Ejecutar sin prompt (automatizado):

```bash
AUTO_CONFIRM=1 ./deploy-prod-safe.sh
```

5. Forzar rama esperada o compose especifico:

```bash
EXPECTED_BRANCH=main COMPOSE_FILE=docker-compose.yml AUTO_CONFIRM=1 ./deploy-prod-safe.sh
```

Comando exacto recomendado de deploy:

```bash
AUTO_CONFIRM=1 COMPOSE_FILE=docker-compose.yml ./deploy-prod-safe.sh
```

## Orden estricto que aplica el script

1. Validaciones previas:
- Rama actual esperada
- Worktree limpio (sin cambios locales)
- Remote origin por SSH
- Espacio en disco
- Docker activo
- .env/.env.production y env_file declarados
- Compose productivo detectable y valido

2. Backup:
- Crea backup con timestamp en /opt/backups/gsentinelhealthos/YYYYMMDD_HHMMSS
- Guarda estado Git (commit, branch, remotes)
- Copia .env, .env.production, docker-compose*.yml
- Copia prisma/schema.prisma y migrations (si existen)
- Realiza pg_dump si el compose usa db/postgres y esta corriendo
- Aplica permisos restrictivos: directorios 700, archivos sensibles 600

3. Actualizacion controlada:
- git fetch --prune
- Muestra commits pendientes
- git pull --ff-only solo si hay cambios
- Si falla, aborta sin reiniciar servicios

4. Build y dependencias:
- Detecta proyecto Node productivo (medical-agenda-saas, y root si aplica)
- Instala segun lockfile:
  - npm ci
  - pnpm install --frozen-lockfile
  - yarn install --frozen-lockfile
- Ejecuta build real si existe script build
- Si falla build, aborta sin tocar contenedores

5. Migraciones:
- Detecta Prisma
- Ejecuta npx prisma migrate deploy --schema ...
- Nunca usa prisma migrate dev

6. Docker deploy:
- docker compose config
- docker compose up -d --build
- Sin down -v, sin prune agresivo, sin borrar volumenes

7. Validacion posterior:
- docker compose ps
- logs recientes de servicios criticos (salida saneada)
- health checks HTTP locales comunes
- verifica que servicios de web/workers/redis/postgres (si existen en compose) esten arriba

## Criterios PASS/FAIL

PASS:
- El script completa todas las fases sin errores.
- docker compose ps muestra servicios criticos arriba.
- Al menos un health HTTP responde correctamente.
- No hay rollback activado.

FAIL:
- Falla validacion previa, install, build, migracion o compose.
- Falla verificacion de servicios criticos.
- Se activa rollback por error posterior al pull/deploy.

## Como validar health y logs

Health local:

```bash
curl -fsS http://127.0.0.1:8000/api/health || true
curl -fsS http://127.0.0.1:8002/health || true
```

Estado y logs:

```bash
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs --tail=80 api brain gateway frontend
```

Log de deploy:

```bash
ls -1t deploy-logs | head -n 3
tail -n 120 deploy-logs/<archivo_log>
```

## Que hacer si falla

1. No reintentar en bucle sin revisar causa.
2. Revisar el log de deploy en deploy-logs.
3. Confirmar estado final con docker compose ps.
4. Si hubo rollback, verificar commit actual con git rev-parse --short HEAD.
5. Corregir causa raiz (env, dependencias, migracion, build) y volver a ejecutar.

## Verificar permisos de backup

```bash
stat -c "%a %n" /opt/backups/gsentinelhealthos
LATEST_BACKUP="$(ls -1dt /opt/backups/gsentinelhealthos/* | head -n1)"
stat -c "%a %n" "$LATEST_BACKUP"
find "$LATEST_BACKUP" -maxdepth 2 -type f | xargs -r stat -c "%a %n" | head -n 20
```

Esperado:
- /opt/backups/gsentinelhealthos con permiso 700
- carpeta backup timestamp con permiso 700
- .env/.env.production, dump SQL y archivos de estado con permiso 600

## Rollback

Si falla una fase despues del pull/deploy:
- El script guarda auditoria previa al reset en deploy-logs/rollback-audit-*.log
- El script valida que el commit objetivo exista antes del reset
- El script ejecuta rollback con git reset --hard <commit_previo> solo si el repo estaba limpio al inicio
- Revalida compose
- Si el runtime ya fue tocado, relanza servicios con docker compose up -d --build usando la version anterior
- Si el runtime no fue tocado, no reinicia servicios (evita reinicio innecesario de Redis/Postgres)
- Deja trazabilidad en deploy-logs

Nota:
- El script no imprime secretos.
- El rollback de base de datos no se aplica automaticamente para evitar perdida de datos; se deja el dump generado para recuperacion controlada si hiciera falta.
