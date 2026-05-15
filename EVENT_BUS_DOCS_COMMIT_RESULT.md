# EVENT BUS DOCS COMMIT RESULT

**Fecha:** 2026-05-12  
**Branch:** GsentinelH  
**Auditor:** arquitecto senior — runtime event bus / observability hygiene  

---

## 1. Commit Hash

```
4efd159eb9698a5f0330fcd868be3373bc218696
```

Mensaje: `docs(event-bus): add runtime event bus audit reports`

---

## 2. Reportes Incluidos (12 archivos — todos GO)

| Archivo | Clasificación | Líneas |
|---|---|---|
| EVENT_BUS_AUDIT_REPORT.md | GO | 54 |
| EVENT_BUS_BOUNDED_DESIGN.md | GO | 57 |
| EVENT_BUS_CONCURRENCY_AUDIT.md | GO | 110 |
| EVENT_BUS_CONCURRENCY_BASELINE.md | GO | 46 |
| EVENT_BUS_CONCURRENCY_REPORT.md | GO | 70 |
| EVENT_BUS_CONCURRENCY_TTL_FINAL.md | GO | 54 |
| EVENT_BUS_CONCURRENCY_TTL_ROLLBACK.md | GO | 46 |
| EVENT_BUS_HARDENING_FINAL.md | GO | 71 |
| EVENT_BUS_MULTIPROCESS_LIMITATION.md | GO | 60 |
| EVENT_BUS_ROLLBACK_VALIDATION.md | GO | 39 |
| EVENT_BUS_STRESS_REPORT.md | GO | 42 |
| EVENT_BUS_TTL_POLICY.md | GO | 69 |

**Total:** 12 archivos / 718 inserciones

---

## 3. Scrubs Realizados

**Ninguno requerido.**

Grep defensivo ejecutado contra todos los candidatos con patrones:
- `password=`, `secret=`, `api_key=`, `bearer`, `eyJ`, `postgres://`, `redis://`
- `Authorization:`, `Cookie:`, `image_base64`, `PHI`, `patient_id`, `token=`, `SECRET_KEY`

Resultado: **12/12 CLEAN** — ningún hit real de seguridad.

**Falso positivo detectado y descartado:**
- `EVENT_BUS_CONCURRENCY_AUDIT.md` línea 91: `"dobles expiraciones contadas"` — la secuencia `dob` dentro de la palabra española `dobles` disparó el patrón DOB (date of birth). Contexto verificado: puramente técnico (conteo de dobles expiraciones TTL). **No PHI.**

---

## 4. Validaciones Ejecutadas

| Check | Resultado |
|---|---|
| `git diff --cached --name-only` | 12 archivos exactos EVENT_BUS_*.md |
| `git diff --cached --stat` | 718 inserciones, 0 eliminaciones |
| grep secretos/tokens | CLEAN |
| grep clínico/PHI | CLEAN (1 falso positivo descartado) |
| Sin código fuente | ✅ solo .md |
| Sin migraciones | ✅ |
| Sin architecture/final docs | ✅ |
| Sin MetaBrain clinical | ✅ |
| Sin imaging | ✅ |
| Sin docker-compose lab con creds | ✅ |
| `git add .` usado | ❌ NUNCA — stage selectivo archivo por archivo |
| Push ejecutado | ❌ NO |

---

## 5. Exclusiones

Los siguientes archivos fueron **explícitamente excluidos** por restricciones de seguridad:

### Clínico / MetaBrain / Imaging — NO-GO
- `CLINICAL_CONFIDENCE_*.md` (3 archivos)
- `HUMAN_REVIEW_*.md` (3 archivos)
- `IMAGE_*.md` (3 archivos)
- `MEDICAL_*.md` (6 archivos — AI, reasoning, memory, retrieval)
- `METABRAIN_*.md` (2 archivos)
- `BRAIN_NETWORK_FIX.md`
- `DOCTOR_CONTEXT_IMPLEMENTATION.md`
- `MEMORY_*.md` (3 archivos)
- `OBSERVABILITY_*.md` (3 archivos — pendiente auditoría próxima fase)
- `MetaBrain/` (directorios completos)

### Architecture / Final Docs — pendiente fase posterior
- `FINAL_*.md` (8 archivos)
- `ARCHITECTURE_*.md` (2 archivos)
- `AUDITORÍA_GLOBAL_COMPLETADA.md`

### Runtime Docs — pendiente auditoría próxima fase
- `RUNTIME_*.md` (~20 archivos — requieren auditoría separada)

### Código fuente — NUNCA incluir
- Todos los `M` (modificados): api/, MetaBrain/, medical-agenda-saas/, alembic/, shared/

### Archivos sensibles explícitos
- `.env.example` (modificado — contiene estructura de secrets)
- `CWindowsTempgs_api_env.txt` (nombre sospechoso — excluido)
- `docker-compose.runtime-lab.yml` (potenciales creds lab)
- `WORKTREE_SECRET_AUDIT.md` (pendiente revisión separada)
- `PRE_DEPLOY_SECURITY_AUDIT.md` (pendiente revisión separada)

---

## 6. Riesgos Restantes

| Riesgo | Nivel | Descripción |
|---|---|---|
| Archivos modificados no commiteados | MEDIO | ~55 archivos `M` en código fuente — requieren auditoría independiente antes de cualquier stage |
| `CWindowsTempgs_api_env.txt` untracked | ALTO | Nombre sugiere volcado de env Windows — requiere inspección manual y eliminación segura |
| `WORKTREE_SECRET_AUDIT.md` | MEDIO | Podría contener referencias a secretos reales en worktree — auditar antes de incluir |
| `RUNTIME_PHI_LEAKAGE_CHECK.md` | MEDIO | Nombre indica análisis de PHI — revisar contenido antes de incluir |
| Worktree `??` masivos sin clasificar | MEDIO | ~100 archivos untracked documentales pendientes de auditoría |
| LF→CRLF warnings en 5 archivos | BAJO | Solo normalización de line endings — no impacta seguridad ni funcionalidad |

---

## 7. Worktree Restante

**Archivos no commiteados que permanecen en worktree:**

- ~55 archivos `M` (código fuente modificado — NO tocar hasta auditoría)
- ~100+ archivos `??` (documentación sin trackear — pendiente clasificación por fases)
- 1 archivo `D` (scripts/build-dashboard-ui-optimized.ps1 — eliminado localmente)

**Directorios sensibles sin trackear:**
- `MetaBrain/audit/`, `MetaBrain/confidence/`, `MetaBrain/imaging/`, `MetaBrain/memory/`, `MetaBrain/observability/`, `MetaBrain/production-safety/`, `MetaBrain/providers/`, `MetaBrain/retrieval/`, `MetaBrain/review/`, `MetaBrain/risk/`, `MetaBrain/rules/`
- `docs/runtime-evidence/`
- `.claude/`
- `-Pattern`

---

## 8. Próximo Paso Seguro

### Prioridad inmediata:
1. **Auditar `CWindowsTempgs_api_env.txt`** — inspeccionar y eliminar si contiene credenciales reales
2. **Auditar `WORKTREE_SECRET_AUDIT.md`** — puede referenciar secretos de worktree

### Siguiente commit candidato:
```
docs(runtime): add runtime observability and validation reports
```
Candidatos: `RUNTIME_*.md` (~20 archivos) — requieren grep defensivo completo antes de stage.

### Fases documentales pendientes:
- **Fase runtime/observability**: `RUNTIME_*.md`, `OBSERVABILITY_*.md`
- **Fase architecture** (última): `FINAL_*.md`, `ARCHITECTURE_*.md`
- **NUNCA**: código fuente, migraciones, MetaBrain clinical, imaging

### Restricciones que se mantienen:
- NO push hasta autorización explícita
- NO `git add .` en ninguna circunstancia
- NO incluir archivos `M` de código fuente
- NO incluir MetaBrain clinical/imaging en ninguna fase

---

*Reporte generado post-commit — NO incluido en el commit `4efd159`.*  
*Para incluir en próximo commit docs: requiere instrucción explícita.*
