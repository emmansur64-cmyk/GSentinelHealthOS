# MB Physical Split Result

## 1. Diagnostico

La fase creo una separacion fisica inicial y reversible usando `MetaBrain` como base real. No se activo runtime nuevo, no se cambiaron callers globales y `MetaBrain` original quedo intacto.

La poda aplicada fue conservadora: guardas fail-closed, manifiestos de dominio y loaders de provider por dominio. No hubo borrado destructivo de logica legacy dentro de las copias.

## 2. Carpetas creadas

- `MB-Chat`
- `MB-Secretaria`
- `MB-Whatsapp`

Cada carpeta fue clonada desde `MetaBrain` con exclusiones controladas de artefactos generados:

- `node_modules`
- `dist`
- `__pycache__`
- `.pytest_cache`
- `.mypy_cache`
- `.ruff_cache`
- `.env`
- `*.pyc`
- `*.pyo`
- `tsconfig.tsbuildinfo`
- `npm-audit-after.json`
- `npm-audit-current.json`

Tamano post-copia:

| Carpeta | Archivos | Tamano aproximado |
|---|---:|---:|
| `MB-Chat` | 857 | 8.60 MB |
| `MB-Secretaria` | 857 | 8.60 MB |
| `MB-Whatsapp` | 857 | 8.60 MB |

## 3. Componentes conservados

- Brain Core compatibility.
- Contracts.
- Validators.
- Auth.
- Tenant.
- Logging/observabilidad.
- Providers base.
- Agenda API client compatibility.
- Modelos y datos livianos existentes en MetaBrain.

## 4. Componentes desactivados

Por guardas de dominio:

- `MB-Chat`: bloquea WhatsApp transport, WhatsApp booking, secretary ingestion, spreadsheet/document parsing, appointment writes y patient-facing triage automatico.
- `MB-Secretaria`: bloquea diagnosis, deep clinical reasoning, doctor modes, patient-facing chat y WhatsApp.
- `MB-Whatsapp`: bloquea diagnosis, deep clinical reasoning, secretary imports, spreadsheet ingestion y full clinical history access.

## 5. Componentes compartidos

Siguen conceptualmente compartidos y no fueron movidos todavia:

- `brain/contracts`
- `brain/integration/api_client.py`
- API de appointments/slots existente como autoridad de agenda
- Auth/tenant/logging legacy

## 6. Tests ejecutados

```text
$env:DEBUG='false'; .\.venv_runtime_lab\Scripts\python.exe -m pytest tests/unit/test_mb_physical_split_guards.py
Resultado: 6 passed, 174 warnings

python -m py_compile MB-Chat\domain\domain_guard.py MB-Chat\domain\provider_config.py MB-Secretaria\domain\domain_guard.py MB-Secretaria\domain\provider_config.py MB-Whatsapp\domain\domain_guard.py MB-Whatsapp\domain\provider_config.py tests\unit\test_mb_physical_split_guards.py
Resultado: OK

npx tsc --noEmit -p tsconfig.json
Directorio: MetaBrain
Resultado: OK

git diff --check -- MB-Chat MB-Secretaria MB-Whatsapp tests/unit/test_mb_physical_split_guards.py MB_PHYSICAL_SPLIT_PRECHECK.md METABRAIN_STRUCTURE_AUDIT.md MB_RESPONSIBILITY_MATRIX.md MB_PHYSICAL_DUPLICATION_AUDIT.md MB_DOMAIN_PRUNING_MAP.md MB_PROVIDER_ISOLATION_DESIGN.md
Resultado: OK
```

## 7. Validaciones defensivas

- `.env` reales en `MB-*`: no encontrados.
- Prisma directo nuevo en `MB-*`: no encontrado por `PrismaClient`, `@prisma/client`, `new Prisma`, `prisma.`.
- Imports cruzados detectados: existen referencias legacy a `MetaBrain.providers_py...` dentro de las copias. Quedan documentadas como riesgo antes de activar runtime directo desde `MB-*`.
- Secret scan: coincidencias corresponden a nombres de variables, placeholders, sanitizers, tests legacy o documentacion; no se detectaron secretos reales introducidos en los archivos nuevos.

## 8. Riesgos restantes

- `MB-*` aun contienen codigo legacy mixto copiado; las guardas iniciales reducen riesgo pero no reemplazan una poda por paquetes.
- `metabrain/config.py` y `services/nlg_service/app/reformulator.py` dentro de las copias todavia leen `GROQ_API_KEY` generico. Los nuevos loaders de dominio estan agregados, pero los entrypoints legacy no fueron conectados para evitar romper runtime.
- Los imports `MetaBrain.*` deben resolverse antes de ejecutar servicios directamente desde `MB-*`.
- `node_modules` no se copio; si se corren pruebas TS dentro de cada dominio, debera instalarse dependencia local o apuntarse a un workspace controlado.

## 9. Compatibilidad legacy

- No se cambio ningun caller productivo.
- No se movio `MetaBrain`.
- No se modifico `medical-agenda-saas`.
- No se elimino Prisma.
- No se cambio contrato publico.
- Agenda API sigue siendo la autoridad esperada para operaciones de turnos.

## 10. Proximo paso recomendado

Preparar commit selectivo solo de esta fase, excluyendo los reportes de auditoria de ramas preexistentes. Luego, en una fase separada, conectar entrypoints reales a los loaders/guardas de dominio y resolver imports `MetaBrain.*` hacia core compartido.

## 11. Stage selectivo recomendado

```powershell
git add MB_PHYSICAL_SPLIT_PRECHECK.md
git add METABRAIN_STRUCTURE_AUDIT.md
git add MB_RESPONSIBILITY_MATRIX.md
git add MB_PHYSICAL_DUPLICATION_AUDIT.md
git add MB_DOMAIN_PRUNING_MAP.md
git add MB_PROVIDER_ISOLATION_DESIGN.md
git add MB_PHYSICAL_SPLIT_RESULT.md
git add tests/unit/test_mb_physical_split_guards.py
git add MB-Chat
git add MB-Secretaria
git add MB-Whatsapp
```

Mensaje sugerido:

```text
refactor(metabrain): create physical modular domains from MetaBrain base
```

No stagear en ese commit:

- `GIT_BRANCH_RECOVERY_PLAN.md`
- `GIT_BRANCH_STRATEGY_PRECHECK.md`
- `GIT_BRANCH_STRATEGY_RESULT.md`
- `GIT_HISTORY_INTEGRITY_AUDIT.md`
- `GIT_REMOTE_BRANCH_AUDIT.md`
- `PR_TARGET_READINESS_AUDIT.md`

## 12. Confirmacion explicita

- NO deploy.
- NO restart.
- NO produccion.
- NO eliminacion de MetaBrain original.
- NO eliminacion Prisma.
- NO migracion masiva.
- NO creacion de runtime nuevo activo.
- NO commit automatico.
