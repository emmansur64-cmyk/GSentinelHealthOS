# METABRAIN DOCKERIGNORE AUDIT — 12 de mayo 2026

## Contexto

- **Archivo auditado:** `MetaBrain/.dockerignore`
- **Commits previos:** `d4023af` (gitignore), `491379e` (untrack artifacts)
- **Stage actual:** vacío
- **Build pipeline activo:** `docker-compose.yml` — brain usa `context: .` + `docker/brain.Dockerfile`

---

## 1. Diff Exacto Auditado

```diff
--- a/MetaBrain/.dockerignore
+++ b/MetaBrain/.dockerignore
@@ -2,9 +2,14 @@
 .gitignore
 .venv
 .pytest_cache
+**/__pycache__
+**/*.pyc
 node_modules
 dist
 .vscode
+*.tsbuildinfo
+MetaBrain/src
+src

 # Large runtime/data folders not needed for build context
 data
```

**Estadística:** 5 inserciones, 0 eliminaciones (1 file changed, 5 insertions(+))

**Advertencia de git:** `LF will be replaced by CRLF` — line endings Windows/Linux. Cosmético, no funcional.

---

## 2. Patrones Agregados / Removidos

### Agregados

| # | Patrón | Tipo | Clasificación |
|---|--------|------|---------------|
| 1 | `**/__pycache__` | Build artifact (Python cache) | ✅ GO |
| 2 | `**/*.pyc` | Build artifact (Python compiled) | ✅ GO |
| 3 | `*.tsbuildinfo` | Build artifact (TypeScript cache) | ✅ GO |
| 4 | `MetaBrain/src` | Código fuente TypeScript (NestJS) | ⚠️ CAUTION — ver análisis |
| 5 | `src` | Código fuente TypeScript (NestJS) | ⚠️ CAUTION — ver análisis |

### Removidos

**Ninguno.** El diff es exclusivamente aditivo.

---

## 3. Análisis Individual de Patrones

### Patrón 1: `**/__pycache__`
- **Tipo:** Python bytecode cache directories, profundidad arbitraria
- **Impacto en build context:** Excluye `MetaBrain/cerebro_ai_med/__pycache__/`, `MetaBrain/metabrain/__pycache__/`, etc.
- **¿Necesario en imagen?:** No. Python regenera `__pycache__` en runtime automáticamente.
- **Clasificación:** ✅ **GO** — Reduce tamaño de imagen, sin efecto funcional.

### Patrón 2: `**/*.pyc`
- **Tipo:** Archivos Python compilados (bytecode)
- **Impacto:** Excluye todos los `.pyc` en cualquier subdirectorio
- **¿Necesario en imagen?:** No. Se regeneran en primer import.
- **Clasificación:** ✅ **GO** — Estándar en Dockerfiles Python productivos.

### Patrón 3: `*.tsbuildinfo`
- **Tipo:** Caché de compilación incremental TypeScript
- **Impacto:** Excluye `MetaBrain/tsconfig.tsbuildinfo` (~2.1MB)
- **¿Necesario en imagen?:** No. Solo útil en desarrollo local para builds incrementales.
- **Clasificación:** ✅ **GO** — Reduce imagen en 2.1MB sin impacto funcional.

### Patrón 4: `MetaBrain/src`
- **¿Existe el path?:** `MetaBrain/src/` → `Test-Path: True`
- **Contenido:** Código TypeScript/NestJS (`.ts`, `.spec.ts`) — subdirectorios `ai/`, `brain/`, `ml/`, `medical-assistant/`, `memory/`, `action-engine/`, etc.
- **¿Contiene código Python?:** `Get-ChildItem -Filter *.py → vacío` — **No contiene Python.**
- **¿Importado por brain runtime?:** `brain.Dockerfile` corre `CMD ["python", "brain/main.py"]`. El runtime Python NO importa TypeScript.
- **Efecto cuando `context=MetaBrain/`:** El patrón `MetaBrain/src` dentro de `MetaBrain/.dockerignore` con `context=MetaBrain/` intentaría excluir `MetaBrain/MetaBrain/src` → **path inexistente → sin efecto práctico.**
- **Efecto cuando `context=.`:** Docker usa `root .dockerignore`, no este archivo. Sin efecto.
- **Clasificación:** ⚠️ **CAUTION** — Patrón con semántica confusa pero sin efecto dañino real. No rompe nada. Advertencia: si se migra a `context=MetaBrain/`, el patrón no matchea (requeriría solo `src`).

### Patrón 5: `src`
- **Efecto cuando `context=MetaBrain/`:** Excluiría `MetaBrain/src/` (TypeScript NestJS) del build context.
- **¿Brain runtime necesita MetaBrain/src?:** **No** — ningún `COPY src` en `brain.Dockerfile`. El Dockerfile copia `MetaBrain/` completo, pero el entrypoint Python no usa código TS.
- **Efecto en production docker-compose:** `context: .` → usa `root .dockerignore` → `MetaBrain/src` ya aparece en root `.dockerignore`. Este patrón es **redundante y seguro.**
- **Clasificación:** ⚠️ **CAUTION-LOW** — Técnicamente correcto para `context=MetaBrain/`, redundante con root `.dockerignore` para producción. Sin riesgo.

---

## 4. Impacto en Build Context

### Contexto activo en producción

```yaml
# docker-compose.yml (activo)
brain:
  build:
    context: .                        # ← BUILD CONTEXT = ROOT
    dockerfile: docker/brain.Dockerfile
```

**Cuando `context: .`, Docker usa `root .dockerignore`, NO `MetaBrain/.dockerignore`.**

### Comparación root .dockerignore vs MetaBrain/.dockerignore tras el diff

| Patrón | Root `.dockerignore` | `MetaBrain/.dockerignore` (tras diff) |
|--------|----------------------|---------------------------------------|
| `**/__pycache__` | ✅ Ya presente | ✅ Ahora presente (redundante) |
| `**/*.pyc` | ✅ Ya presente | ✅ Ahora presente (redundante) |
| `*.tsbuildinfo` | ✅ Ya presente | ✅ Ahora presente (redundante) |
| `MetaBrain/src` | ✅ Ya presente | ✅ Ahora presente (CAUTION — distinto efecto por contexto) |
| `src` | ❌ No presente | ✅ Nuevo — solo activo si `context=MetaBrain/` |

**Conclusión crítica:** Las 5 líneas agregadas son **redundantes con el root `.dockerignore`** para la build de producción (`context: .`). Su valor real es para builds alternativos con `context=MetaBrain/`.

### ¿Puede romper build reproducible?
**No.** Solo se excluyen artefactos generados (`__pycache__`, `.pyc`, `.tsbuildinfo`) o código TypeScript no usado por el runtime Python.

### ¿Puede excluir archivos necesarios?
**No.** `brain.Dockerfile` no hace `COPY src`. El Python runtime no depende de `MetaBrain/src`.

### ¿Puede dejar entrar secretos?
**No.** El diff no toca ni elimina reglas de exclusión de `.env`, credentials ni certificados.

---

## 5. Impacto en Runtime

| Sistema | Impacto |
|---------|---------|
| Linux/Docker pre-canary | ✅ Sin cambios — root `.dockerignore` es el activo |
| MetaBrain runtime integration | ✅ Sin impacto — `COPY MetaBrain` no incluye `MetaBrain/src` (TypeScript) en runtime Python |
| imaging/model loading | ✅ Sin impacto — `MetaBrain/imaging/`, `MetaBrain/models/` no están excluidos |
| tests | ✅ Sin impacto — tests Python en `MetaBrain/cerebro_ai_med/tests/` no son excluidos (solo sus `__pycache__`) |

---

## 6. Auditoría de Secretos

| Elemento | Presente en diff | Clasificación |
|----------|-----------------|---------------|
| `.env` real | ❌ No | ✅ Seguro |
| credentials/tokens/API keys | ❌ No | ✅ Seguro |
| Certificados / .pem / .key | ❌ No | ✅ Seguro |
| PHI / datos clínicos | ❌ No | ✅ Seguro |
| Logs clínicos | ❌ No | ✅ Seguro |
| Patrones que **eliminan** reglas de secretos | ❌ No | ✅ Seguro |

**Estado de secretos: LIMPIO.**

---

## 7. Clasificación GO/CAUTION/NO-GO

### Por patrón

| Patrón | Estado | Justificación |
|--------|--------|---------------|
| `**/__pycache__` | ✅ GO | Artefacto generado, seguro excluir |
| `**/*.pyc` | ✅ GO | Artefacto generado, seguro excluir |
| `*.tsbuildinfo` | ✅ GO | Artefacto generado, seguro excluir |
| `MetaBrain/src` | ⚠️ CAUTION | Patrón con efecto nulo en context=MetaBrain/ (path inexistente). Inocuo pero semánticamente confuso. |
| `src` | ⚠️ CAUTION-LOW | Excluye TypeScript NestJS, no Python. Sin efecto en producción actual. |

### Archivo completo

**`MetaBrain/.dockerignore` estado: ✅ GO**

- Sin secretos.
- Sin código fuente Python excluido.
- Sin ruptura de build reproducible.
- Sin impacto en producción (root `.dockerignore` es el activo).
- Los patrones CAUTION son inofensivos en el contexto actual.

---

## 8. Recomendación de Commit

**Estado:** ✅ **GO para commit aislado**

```
chore(dockerignore): exclude MetaBrain generated artifacts
```

**Archivos a stagear:**
```bash
git add MetaBrain/.dockerignore
```

**Solo ese archivo. PROHIBIDO `git add .`**

**Justificación:** El diff es aditivo, sin riesgo de secretos, sin rotura de build, sin código fuente Python afectado. Los patrones son redundantes con el root `.dockerignore` (seguridad defensiva), lo que es una práctica válida para preparar builds alternativos.

**Nota CAUTION documentada:** Si en el futuro se migra a `context=MetaBrain/` en docker-compose, el patrón `MetaBrain/src` no tendrá efecto (requeriría solo `src` para ese contexto). El patrón `src` sí funcionaría. No es un problema bloqueante.

---

## 9. Rollback

Si el commit genera problemas:

```bash
# Revertir solo MetaBrain/.dockerignore al estado anterior al diff
git show HEAD~1:MetaBrain/.dockerignore > MetaBrain/.dockerignore
git add MetaBrain/.dockerignore
git commit -m "revert(dockerignore): rollback MetaBrain/.dockerignore to pre-audit state"
```

**Riesgo de rollback:** MÍNIMO. Los cambios son redundantes con root `.dockerignore`; revertir no afecta producción.

---

## 10. Próximo Paso Seguro

1. **Inmediato:** Si se decide incluir el commit de `.dockerignore`:
   ```bash
   git diff --cached --name-only  # verificar stage vacío
   git add MetaBrain/.dockerignore
   git diff --cached --name-only  # confirmar solo .dockerignore
   git commit -m "chore(dockerignore): exclude MetaBrain generated artifacts"
   ```

2. **Luego:** Clasificar los ~70 archivos restantes por dominio en commits separados:
   - `chore(docker):` — docker-compose.yml / Dockerfiles
   - `chore(config):` — config / .env.example
   - `fix(api):` — endpoints API (sin IA clínica)
   - MetaBrain clinical / IA → **NO-GO hasta resolución de auditoría**

3. **No hacer:** `git add .`, push hasta completar clasificación, tocar archivos de IA clínica.

---

*Generado automáticamente — no commitear salvo instrucción posterior*
