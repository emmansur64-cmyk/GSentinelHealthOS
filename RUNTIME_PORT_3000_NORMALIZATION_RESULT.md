# RUNTIME PORT 3000 NORMALIZATION RESULT

Fecha local: 2026-05-15
Scope: `E:\GSentinelHealthOS\medical-agenda-saas`

## Resultado Ejecutivo

Puerto 3000 normalizado para entorno local.

Runtime operativo unico:

```text
Docker gs_frontend production
Host binding: 127.0.0.1:3000 -> container 3000
Container: gs_frontend
Health: healthy
```

## Confirmacion De Puerto

`netstat -ano | findstr :3000`:

```text
TCP  127.0.0.1:3000  0.0.0.0:0  LISTENING  21416
```

No quedan listeners:

- `0.0.0.0:3000` de Node local
- `[::]:3000` de Node local
- `[::1]:3000` de Next dev

## Confirmacion De Next Dev

Busqueda de procesos `node.exe` con `medical-agenda-saas` y `next`:

```text
Sin resultados.
```

No queda Next dev local sirviendo puerto 3000.

## Confirmacion Docker

`docker inspect gs_frontend`:

```text
Name=/gs_frontend
Status=running
Health=healthy
Ports={"3000/tcp":[{"HostIp":"127.0.0.1","HostPort":"3000"}]}
```

Runtime interno:

```json
{"service":"gs_frontend","cwd":"/app","node":"v20.20.2","port":"3000","env":"production","secretariaKey":true,"secretariaModel":"meta-llama/llama-4-scout-17b-16e-instruct"}
```

## Health Checks Finales

`http://127.0.0.1:3000/api/health`:

```json
{"ok":true,"data":{"status":"ok","service":"medical-agenda-saas","tenant_fallback_mode":"permissive","metabrain":{"connected":true,"channel":"redis.brain:integration:events"}}}
```

`http://localhost:3000/api/health`:

```json
{"ok":true,"data":{"status":"ok","service":"medical-agenda-saas","tenant_fallback_mode":"permissive","metabrain":{"connected":true,"channel":"redis.brain:integration:events"}}}
```

`http://[::1]:3000/api/health`:

```text
Connection refused
```

Interpretacion:

- `127.0.0.1:3000` responde Docker.
- `localhost:3000` ya responde el mismo runtime Docker.
- IPv6 loopback no tiene Next dev escuchando, por lo tanto no hay doble respuesta.

## Regla Operacional

Para Docker local:

```text
Usar http://127.0.0.1:3000
```

Para desarrollo Next local:

```text
Usar otro puerto, por ejemplo 3001.
No levantar Next dev en 3000 mientras Docker publique 3000.
```

Comando recomendado si se necesita dev local:

```powershell
npm run dev -- --port 3001
```

O usar el script existente con puerto alternativo si aplica:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/dev-singleton.ps1 -Port 3001
```

## Restricciones Confirmadas

- No deploy.
- No produccion remota.
- No push.
- No DB.
- No migraciones.
- No borrado de codigo.
- No modificacion de contratos.
- No se toco MetaBrain.
- No se toco MB-Chat.
- No se toco MB-Whatsapp.
- No restart Docker.
- No restart `gs_frontend`.
- Solo se apago Next dev local correspondiente a PIDs `31456`/`23108`.
