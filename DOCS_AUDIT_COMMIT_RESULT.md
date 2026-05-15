# DOCS AUDIT COMMIT RESULT

## 1. Commit hash
`ad84dd6` — `docs(audit): add runtime and compatibility audit reports`  
Branch: `GsentinelH`  
Fecha: 2026-05-12

## 2. Reportes incluidos (21 archivos)

| Archivo | Dominio | Relación con commit cerrado |
|---|---|---|
| `API_SAFE_ENDPOINTS_COMMIT_RESULT.md` | API safe endpoints | 282626d |
| `AUTH_HEALTH_REALTIME_COMPAT_FIX_REPORT.md` | Auth compatibility | 9081351 |
| `AUTH_IMPACT_HEALTH_REALTIME_AUDIT.md` | Auth compatibility audit | 9081351 |
| `COMPOSE_RUNTIME_LOCK_REPORT.md` | Docker/runtime lock | 3d58875 |
| `DOCKER_CONFIG_COMMIT_RESULT.md` | Docker/config hardening | 3d58875 |
| `GENERATED_ARTIFACTS_UNTRACK_COMMIT_RESULT.md` | Git hygiene artifacts | 491379e |
| `GITIGNORE_COMMIT_RESULT.md` | Git hygiene .gitignore | d4023af |
| `LOCALHOST_AUDIT_REPORT.md` | Runtime localhost audit | general |
| `MAIN_PY_DIFF_AUDIT.md` | API main.py diff | 282626d |
| `METABRAIN_DOCKERIGNORE_AUDIT.md` | Dockerignore hygiene | 984a1b3 |
| `METABRAIN_DOCKERIGNORE_COMMIT_RESULT.md` | Dockerignore commit | 984a1b3 |
| `PHASE_2_COMPATIBILITY_REPORT.md` | Compatibility phase 2 | general |
| `PRECANARY_COMMIT_RESULT.md` | Precanary state | general |
| `RATE_LIMIT_COMMIT_RESULT.md` | Rate limit hardening | general |
| `REMAINING_WORKTREE_DOMAIN_CLASSIFICATION.md` | Worktree classification | general |
| `RUNTIME_HARDENING_REPORT.md` | Runtime hardening | general |
| `SAFE_TAGGING_PLAN_AUDIT.md` | Tagging plan | general |
| `SELECTIVE_COMMIT_ROADMAP.md` | Commit roadmap | general |
| `UNTRACKED_RUNTIME_SECURITY_FILES_AUDIT.md` | Security files audit | general |
| `WORKTREE_CLASSIFICATION_MATRIX.md` | Domain classification | general |
| `WORKTREE_GLOBAL_REVIEW_FINAL.md` | Global worktree review | general |

## 3. Exclusiones (NO incluidas en este commit)

### Excluidas por dominio clínico/imaging:
- `CLINICAL_CONFIDENCE_*.md`, `CLINICAL_CONFIDENCE_SAFETY_MODEL.md`, `CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md`
- `HUMAN_REVIEW_*.md`, `IMAGE_*.md`, `MEDICAL_*.md`
- `MetaBrain/audit/`, `MetaBrain/confidence/`, `MetaBrain/imaging/`, etc.
- `MEMORY_LAYER_VALIDATION.md`, `MEMORY_ROLLBACK_PLAN.md`, `MEMORY_SECURITY_MODEL.md`
- `MEDICAL_AI_WEB_RETRIEVAL_AUDIT.md`, `MEDICAL_CONVERSATION_MEMORY_IMPLEMENTATION.md`
- `OBSERVABILITY_*.md`, `PRODUCTION_SAFETY_*.md`, `PROVIDER_*.md`

### Excluidas por ser código fuente (no documentación):
- `api/tests/`, `tests/unit/test_runtime_integration.py`
- `shared/security/encrypted_types.py`
- `medical-agenda-saas/src/lib/*` (código TS clínico)
- `scripts/run_api_lab_worker.py`
- `tools/*.ps1`

### Excluidas por migrations (riesgo de PHI):
- `alembic/versions/20260508_0025_*.py` ... `0029_*.py`
- `database/init-multiple-dbs.sql`

### Excluidas por credenciales/riesgo lab:
- `docker-compose.runtime-lab.yml` (credenciales lab inline)
- `C:...\gs_api_env.txt` (artefacto de entorno)
- `.claude/` (configuración local)
- `-Pattern` (artefacto)

### Excluidas por requerir auditoría adicional:
- `EVENT_BUS_*.md` (dominio aún no validado completamente)
- `FINAL_*.md` (necesitan scrub de PHI)
- `CHAT_*.md`, `DOCTOR_CONTEXT_*.md` (features clínicas)
- `LAB_*.md` (configuración lab con posibles credenciales)
- `docs/runtime-evidence/` (evidencias que pueden contener dumps)
- `medical-agenda-saas/*.md` (docs frontend, pendiente auditoría)

## 4. Validaciones realizadas

- `grep_search` sobre secretos: `password=`, `secret=`, `api_key=`, `bearer eyJ`, `-----BEGIN`, `postgres://.*:.*@`, `redis://.*:.*@` → sin hits en los 21 archivos.
- Verificación de PHI/PII: menciones solo contextuales de política, sin datos reales.
- Verificación de código fuente: ningún `.py`, `.ts`, `.yml` con credenciales incluido.
- Stage limpio: solo 21 `.md` en raíz del repositorio.
- `git diff --cached --name-only` validado: solo archivos esperados.
- Exclusión de `docker-compose.runtime-lab.yml` confirmada (credenciales lab inline).
- `METABRAIN_DOCKERIGNORE_*.md` revisados: solo documentan hygiene del dockerignore, sin código clínico.

## 5. Riesgos restantes
- **Bajo:** Los reportes contienen referencias a rutas de archivos locales (e.g. `E:\GSentinelHealthOS\...`); no representan riesgo de seguridad pero pueden ser ruido en historial.
- **Bajo:** Algunos reportes mencionan hashes de commits anteriores; no son secretos pero vinculan historia Git.
- **Sin riesgo:** Ningún secreto real, PHI, ni credencial en los 21 reportes.

## 6. Worktree restante (~160 archivos untracked)

Categorías principales pendientes:
- **Documentos clínicos** (MetaBrain, imaging, clinical confidence, memory, human review) — NO-GO hasta auditoría clínica
- **Event Bus** (~11 reportes) — pendiente validación de dominio
- **Frontend docs** (`medical-agenda-saas/*.md`) — pendiente scrub
- **Lab docs** (`LAB_*.md`) — pendiente verificación de credenciales lab
- **Final docs** (`FINAL_*.md`) — pendiente scrub PHI
- **Código fuente untracked** (api/tests, shared/security, tools, scripts) — requiere commit técnico dedicado
- **Migrations** (5 alembic scripts) — requiere commit de migrations con validación
- **Artefactos** (`-Pattern`, `gs_api_env.txt`, `.claude/`) — ignorar o limpiar

## 7. Próximo paso seguro
1. **Event Bus docs** — auditar y crear commit `docs(event-bus): add event bus audit reports`.
2. **Final/Architecture docs** — scrub de PHI y crear commit `docs(arch): add architecture and final readiness docs`.
3. **Lab docs** — verificar credenciales inline antes de commitear.
4. **Migrations** — crear commit dedicado `chore(migrations): add pending schema migrations` con revisión de PHI.
5. **Código fuente untracked** (api/tests, shared/security) — clasificar y crear commits técnicos por dominio.
