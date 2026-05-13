# GENERATED ARTIFACTS UNTRACK COMMIT RESULT — 12 de mayo 2026

## 1. Commit Hash

```
491379e57... (HEAD -> GsentinelH)
```

- **Mensaje:** `chore(git): untrack generated artifacts`
- **Branch:** `GsentinelH`
- **Fecha:** Tue May 12 2026 -0300
- **Commit previo relacionado:** `d4023af` — `chore(gitignore): exclude generated runtime artifacts`

---

## 2. Archivos Desindexados (89 total)

### `__pycache__` / `.pyc` (88 archivos)

| Directorio | Archivos |
|---|---|
| `MetaBrain/cerebro_ai_med/__pycache__/` | `__init__`, `main` |
| `MetaBrain/cerebro_ai_med/api/__pycache__/` | `__init__`, `app`, `observability`, `rate_limit`, `routes`, `runtime`, `schemas`, `security`, `validators` |
| `MetaBrain/cerebro_ai_med/decision/__pycache__/` | `__init__`, `decision_engine`, `hybrid_decision` |
| `MetaBrain/cerebro_ai_med/memory/__pycache__/` | `__init__`, `schemas`, `store` |
| `MetaBrain/cerebro_ai_med/models/__pycache__/` | `__init__`, `ml_model`, `registry`, `schemas`, `service`, `train_models`, `training_data` |
| `MetaBrain/cerebro_ai_med/tests/__pycache__/` | `__init__`, 8 archivos de test `.pyc` |
| `MetaBrain/cerebro_ai_med/vision/__pycache__/` | `__init__`, `image_model`, `preprocessing` |
| `MetaBrain/metabrain/__pycache__/` | `cache`, `config`, `groq_client`, `logger`, `metrics`, `pipeline`, `prompt_loader` |
| `MetaBrain/scripts/__pycache__/` | `model_compare`, `model_registry`, `model_rollback`, `train_model` |
| `MetaBrain/services/__pycache__/` | `__init__` (cpython-312 y cpython-314) |
| `MetaBrain/services/api_gateway/__pycache__/` | `__init__`, `async_bus`, `clients`, `main`, `orchestrator` |
| `MetaBrain/services/decision_service/__pycache__/` | `__init__`, `main` |
| `MetaBrain/services/dialogue_engine/__pycache__/` | `__init__`, `main` |
| `MetaBrain/services/dialogue_engine/app/__pycache__/` | `__init__`, `engine`, `intent_classifier`, `main`, `policies`, `routes`, `schemas`, `state_manager` |
| `MetaBrain/services/nlg_service/__pycache__/` | `__init__` (×2), `engine`, `main` |
| `MetaBrain/services/nlg_service/app/__pycache__/` | `__init__` (×2), `engine`, `generator`, `lexicon`, `main`, `planner`, `reformulator` (×2), `routes`, `schemas`, `templates` |
| `MetaBrain/services/shared/__pycache__/` | `__init__`, `contracts` |

### TypeScript build cache (1 archivo)

| Archivo | Tamaño | Motivo |
|---|---|---|
| `MetaBrain/tsconfig.tsbuildinfo` | ~2.1MB | Caché de compilación TypeScript, regenerado automáticamente |

---

## 3. Confirmación de `git rm --cached`

```
[GsentinelH 491379e] chore(git): untrack generated artifacts
 89 files changed, 1 deletion(-)
 delete mode 100644 MetaBrain/cerebro_ai_med/__pycache__/__init__.cpython-314.pyc
 ...
 delete mode 100644 MetaBrain/tsconfig.tsbuildinfo
```

- **`delete mode`** confirma que git eliminó la entrada del índice (tracking)
- **NO se usó `rm`, `git clean`, ni `git reset --hard`**
- **Solo `git rm --cached` archivo por archivo construido desde `git ls-files`**

---

## 4. Confirmación de Archivos en Disco

| Archivo | `Test-Path` | Estado |
|---|---|---|
| `MetaBrain/cerebro_ai_med/__pycache__/__init__.cpython-314.pyc` | `True` | ✅ Presente en disco |
| `MetaBrain/tsconfig.tsbuildinfo` | `True` | ✅ Presente en disco |
| `MetaBrain/metabrain/__pycache__/config.cpython-314.pyc` | `True` | ✅ Presente en disco |

**Los 89 archivos siguen físicamente en el disco. Solo se eliminaron del índice de git.**

---

## 5. Validación de Stage Selectivo

```
git diff --cached --stat:
  89 files changed, 1 deletion(-)
```

**Verificación de mezclas (PowerShell):**
```
$bad = $stage | Where-Object { $_ -match "main\.py$|\.env|redis\.conf|alembic|\.dockerignore|migration" }
Resultado: OK - Sin mezclas. Solo artefactos generados en stage.
```

**`git status` post-commit filtrado por `pycache|\.pyc$|tsbuildinfo`:**
- Resultado: **vacío** — ningún artefacto de ese tipo aparece en el worktree modificado

---

## 6. Riesgos

| Riesgo | Nivel | Descripción |
|---|---|---|
| Artefactos en disco sin eliminar | BAJO | Los `.pyc` y `tsconfig.tsbuildinfo` siguen en disco. Esto es **intencional** — solo se desindexaron, no se borraron. Al correr Python o `tsc` se regenerarán automáticamente y ya no serán trackeados. |
| `MetaBrain/.dockerignore` modificado | BAJO-MEDIO | Sigue como `M` en git status. No fue incluido en este commit. Requiere evaluación separada. |
| ~70 archivos tracked modificados restantes | ALTO | Código runtime, API endpoints, alembic, docker aún en worktree sucio. Clasificación pendiente por commit separado. |
| IA clínica / medical features | ALTO (NO-GO) | Archivos como `ml_model.py`, `registry.py`, `engine.py` siguen modificados y **NO deben ser commiteados** hasta resolución de la auditoría clínica. |

---

## 7. Próximo Paso Seguro

**COMMIT 8 recomendado:** Evaluar `MetaBrain/.dockerignore`

```bash
# Revisar qué cambios tiene .dockerignore
git diff MetaBrain/.dockerignore

# Si solo tiene exclusiones de artefactos generados → stage y commit:
git add MetaBrain/.dockerignore
git commit -m "chore(dockerignore): exclude generated runtime artifacts"

# Si tiene cambios mixtos → no commitear todavía
```

**Luego:** Clasificar los ~70 archivos modificados restantes en commits por dominio:
- `fix(api): ...` — endpoints API
- `chore(docker): ...` — docker-compose / Dockerfiles
- `chore(config): ...` — config / env.example
- Los de IA clínica / MetaBrain clinical → **NO-GO hasta resolución de auditoría**

**PROHIBIDO hasta resolución:** `git add .`, push a producción, modificar código clínico.

---

## Estado del Log Actual (HEAD)

```
491379e (HEAD -> GsentinelH) chore(git): untrack generated artifacts
d4023af chore(gitignore): exclude generated runtime artifacts
93bdfde docs(runtime): add runtime integration commit report
772831f feat(runtime): integrate passive MetaBrain runtime middleware
b28fdab fix(mongoose): remove duplicate incidentId index definition
```

---
*Generado automáticamente — no commitear salvo instrucción posterior*
