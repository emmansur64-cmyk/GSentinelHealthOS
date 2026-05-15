# MB Physical Duplication Audit

## Carpetas creadas

- `MB-Chat`
- `MB-Secretaria`
- `MB-Whatsapp`

## Origen

- Plantilla real: `MetaBrain`
- MetaBrain original: intacto, no eliminado, no movido.

## Estrategia de copia

Se uso copia fisica controlada desde `MetaBrain` a cada dominio. Para evitar triplicar artefactos generados y dependencias locales, se excluyeron:

- Directorios: `node_modules`, `dist`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`
- Archivos: `.env`, `*.pyc`, `*.pyo`, `tsconfig.tsbuildinfo`, `npm-audit-after.json`, `npm-audit-current.json`

Se conservaron:

- Codigo Python y TypeScript.
- Contratos.
- Providers.
- Scripts.
- Modelos y datos livianos existentes.
- `.env.example`.
- `package.json` y `package-lock.json`.

## Tamano y archivos

| Carpeta | Archivos | Tamano aproximado |
|---|---:|---:|
| `MetaBrain` | 28,167 | 533.15 MB |
| `MB-Chat` | 857 | 8.60 MB |
| `MB-Secretaria` | 857 | 8.60 MB |
| `MB-Whatsapp` | 857 | 8.60 MB |

## Validaciones post-copia

- `node_modules`: ausente en los tres dominios.
- `dist`: ausente en los tres dominios.
- `__pycache__`: ausente en raiz de los tres dominios.
- `.env` real: no copiado en ningun dominio.
- `.env.example`: conservado.

## Errores

- No se detectaron errores de robocopy.
- No existian carpetas destino antes de la copia.

## Riesgos

- Los dominios copian codigo legacy mixto; la poda inicial se aplica por guardas y manifiestos, no por borrado destructivo.
- Los imports que referencian `MetaBrain.*` quedan como deuda antes de activar runtime directo desde `MB-*`.
- `node_modules` debe restaurarse por instalacion local si se ejecutan tests TypeScript dentro de cada dominio.

## Rollback

- Como no se modifico MetaBrain original ni callers runtime, rollback fisico consiste en quitar las carpetas `MB-*` creadas en esta fase, previa validacion manual y sin tocar rama remota.
