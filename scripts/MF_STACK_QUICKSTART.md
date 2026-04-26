# MF Stack Quickstart

Script unico para orquestar host + remote dashboard con health checks.

## Script

- `scripts/orchestrate_mf_stack.ps1`

## Comandos

### Start

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\orchestrate_mf_stack.ps1 -Action start
```

### Status

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\orchestrate_mf_stack.ps1 -Action status
```

### Stop

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\orchestrate_mf_stack.ps1 -Action stop
```

### Restart

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\orchestrate_mf_stack.ps1 -Action restart
```

## Parametros utiles

- `-HostPort 5174`
- `-RemotePort 5001`
- `-ApiPort 8000`
- `-TimeoutSeconds 60`
- `-Force` (solo para `stop`/`restart`)

## Health checks incluidos

- Remote entry: `http://localhost:<RemotePort>/assets/remoteEntry.js`
- Host shell: `http://localhost:<HostPort>/`

## Nota

El script usa `npm --prefix` para evitar fallos por cwd incorrecto al ejecutar desde la raiz del repo.
