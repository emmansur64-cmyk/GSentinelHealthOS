# GLOBAL WORKTREE INVENTORY — 12 de mayo 2026

## Resumen Ejecutivo
- **Archivos Modificados (Tracked):** 70
- **Archivos Untracked:** 200+
- **Archivos Deleted:** 1 (scripts/build-dashboard-ui-optimized.ps1)
- **Estado Comprometido:** SUCIO — cambios sin clasificar previos al commit de runtime integration

## GRUPO 1: TRACKED MODIFIED (70 archivos)

### 1.1 MetaBrain / Infrastructure
- `MetaBrain/.dockerignore`
- `MetaBrain/cerebro_ai_med/__pycache__/*.pyc` (6 archivos)
- `MetaBrain/cerebro_ai_med/models/artifacts/metadata.json`
- `MetaBrain/cerebro_ai_med/models/ml_model.py`
- `MetaBrain/cerebro_ai_med/models/registry.py`
- `MetaBrain/metabrain/__pycache__/*.pyc` (2 archivos)
- `MetaBrain/services/__pycache__/*.pyc`
- `MetaBrain/services/inference_service/requirements.txt`
- `MetaBrain/services/nlg_service/__pycache__/*.pyc` (4 archivos)
- `MetaBrain/services/nlg_service/app/engine.py`
- `MetaBrain/services/nlg_service/requirements.txt`
- `MetaBrain/services/shared/__pycache__/*.pyc`
- `MetaBrain/tsconfig.tsbuildinfo`

### 1.2 API Core / Config / Security
- `api/app/core/config.py` (cambios benignos: timeout, pool_size, jwt claims, samesite)
- `api/app/core/security.py`
- `api/app/exceptions/handlers.py`
- `shared/security/secrets.py` (nuevas funciones: sha256_hex, normalize_phone, hash_phone)
- `api/app/models/models.py`

### 1.3 API Endpoints (11 archivos)
- `api/app/api/v1/endpoints/admin.py`
- `api/app/api/v1/endpoints/auth.py`
- `api/app/api/v1/endpoints/buffer_slots.py`
- `api/app/api/v1/endpoints/doctors.py`
- `api/app/api/v1/endpoints/health.py`
- `api/app/api/v1/endpoints/meta.py`
- `api/app/api/v1/endpoints/patients.py`
- `api/app/api/v1/endpoints/realtime.py`
- `api/app/api/v1/endpoints/time_slots_simple.py`
- `api/app/api/v1/endpoints/webhooks_google_calendar.py`

### 1.4 API Services / Dependencies
- `api/app/dependencies/db.py`
- `api/app/dependencies/tenant.py`
- `api/app/services/appointment_service.py`
- `api/app/services/patient_service.py`
- `api/app/services/shadow_profile_service.py`

### 1.5 Migrations / Alembic
- `alembic/versions/20260401_0001_users_outbox.py`
- `alembic/versions/20260401_0002_bot_knowledge_base.py`
- `alembic/versions/20260402_0005_slot_based_appointments.py`
- `alembic/versions/20260402_0006_appointment_priorities.py`

### 1.6 Infrastructure / Docker / Deployment
- `.env.example` (CRÍTICO: placeholders sin secretos reales)
- `broker/redis.conf` (CRÍTICO: no verificado)
- `create_seed_users.py`
- `deploy_vps.ps1`
- `docker-compose.yml` (RIESGO DETECTADO: REDIS_PASSWORD en environment variable)
- `docker/api.Dockerfile`
- `docker/brain.Dockerfile`
- `docker/decision-service.Dockerfile`
- `docker/dialogue-engine.Dockerfile`
- `docker/gateway.Dockerfile`
- `docker/inference-service.Dockerfile`
- `docker/nlg-service.Dockerfile`
- `docker/redis.Dockerfile`

### 1.7 Medical Agenda / Frontend
- `medical-agenda-saas/Dockerfile`
- `medical-agenda-saas/package.json`
- `medical-agenda-saas/prisma/seed.ts`
- `medical-agenda-saas/src/app/api/import/agenda/parse/route.ts`
- `medical-agenda-saas/src/app/api/super-admin/clinics/[id]/whatsapp/route.ts`
- `medical-agenda-saas/src/app/chat/doctor/route.ts`
- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/components/doctor-chat-hub.tsx`
- `medical-agenda-saas/src/components/doctor-dashboard.tsx`
- `medical-agenda-saas/src/components/pages/ImportAgenda.jsx`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- `medical-agenda-saas/tests/nlp/groq-doctor-chat.test.ts`

### 1.8 Shared / Scripts
- `scripts/e2e_setup_clinics.py`
- `shared/models/models.py`
- `shared/schemas/__init__.py`
- `whatsapp_gateway/services/account_resolver.py`

### 1.9 Deletados
- `scripts/build-dashboard-ui-optimized.ps1` (eliminado)

---

## GRUPO 2: UNTRACKED (200+ archivos)

### 2.1 Reportes Documentales (90+ .md)
- ARCHITECTURE_*.md (7 archivos)
- BRAIN_NETWORK_FIX.md
- CHAT_*.md (3 archivos)
- CLINICAL_CONFIDENCE_*.md (3 archivos)
- DOCKER_ANALYSIS.md
- DOCTOR_CONTEXT_IMPLEMENTATION.md
- ENVIRONMENT_GAP_REPORT.md
- EVENT_BUS_*.md (10 archivos)
- FINAL_*.md (10 archivos)
- FRONTEND_CACHE_PERMISSION_FIX.md
- GLOBAL_AI_FLAGS_REFERENCE.md
- GROQ_FRONTEND_ENV_FIX.md
- HUMAN_REVIEW_*.md (3 archivos)
- IMAGE_*.md (3 archivos)
- LAB_*.md (5 archivos)
- LOCALHOST_AUDIT_REPORT.md
- MAIN_PY_DIFF_AUDIT.md
- MEDICAL_*.md (7 archivos)
- MEMORY_*.md (3 archivos)
- METABRAIN_*.md (3 archivos)
- MONGOOSE_*.md (4 archivos)
- NODE_RUNTIME_ALIGNMENT.md
- NPM_AUDIT_COMMIT_RESULT.md
- OBSERVABILITY_*.md (3 archivos)
- PHASE_2_COMPATIBILITY_REPORT.md
- PRECANARY_COMMIT_RESULT.md
- PRODUCTION_SAFETY_*.md (3 archivos)
- PROVIDER_*.md (3 archivos)
- RATE_LIMIT_COMMIT_RESULT.md
- RUNTIME_*.md (20 archivos)
- TYPESCRIPT_TOOLCHAIN_VALIDATION.md
- UNTRACKED_RUNTIME_SECURITY_FILES_AUDIT.md

### 2.2 MetaBrain Nuevas Carpetas (Módulos Completos)
- `MetaBrain/audit/` (3 archivos)
- `MetaBrain/confidence/` (18 archivos)
- `MetaBrain/confidence_py/` (15 archivos)
- `MetaBrain/core/` (5 archivos)
- `MetaBrain/imaging/` (18 archivos)
- `MetaBrain/imaging_py/` (11 archivos)
- `MetaBrain/memory/` (10 archivos)
- `MetaBrain/memory_py/` (7 archivos)
- `MetaBrain/observability/` (22 archivos)
- `MetaBrain/observability_py/` (19 archivos)
- `MetaBrain/production-safety/` (14 archivos)
- `MetaBrain/production_safety_py/` (15 archivos)
- `MetaBrain/providers/` (40+ archivos)
- `MetaBrain/providers_py/` (15+ archivos)
- `MetaBrain/retrieval/` (3 archivos)
- `MetaBrain/review/` (18 archivos)
- `MetaBrain/review_py/` (13 archivos)
- `MetaBrain/risk/` (3 archivos)
- `MetaBrain/rules/` (3 archivos)
- `MetaBrain/npm-audit-*.json` (2 archivos)

### 2.3 Tests Nuevos (API)
- `api/tests/runtime_event_bus_concurrency.py`
- `api/tests/runtime_event_bus_stress.py`
- `api/tests/runtime_event_bus_ttl.py`
- `api/tests/runtime_latency_baseline.py`
- `api/tests/runtime_memory_baseline.py`
- `api/tests/runtime_multiworker_stress.py`
- `api/tests/test_runtime_integration.py`
- `api/tests/test_runtime_startup_lab.py`

### 2.4 Tests Nuevos (Medical Agenda)
- `medical-agenda-saas/tests/nlp/doctor-context.test.ts`
- `medical-agenda-saas/tests/nlp/medical-conversation-memory.test.ts`
- `medical-agenda-saas/tests/nlp/medical-reasoning.test.ts`
- `medical-agenda-saas/tests/nlp/medical-specialty-protocols.test.ts`

### 2.5 Nuevas Librerías (Medical Agenda)
- `medical-agenda-saas/src/lib/doctor-context/` (9 archivos)
- `medical-agenda-saas/src/lib/medical-conversation-memory/` (8 archivos)
- `medical-agenda-saas/src/lib/medical-reasoning/` (6 archivos)
- `medical-agenda-saas/src/lib/medical-runtime-context/` (10 archivos)
- `medical-agenda-saas/src/lib/medical-specialty-protocols/` (8 archivos)
- `medical-agenda-saas/src/lib/medical-web-retrieval/` (11 archivos)

### 2.6 Backups / Archivos Temporales
- `api/app/main.py.backup_20260512_151754` (CRÍTICO: no debe entrar en commits)
- `medical-agenda-saas/src/app/api/import/agenda/parse/route.ts.backup-before-full-replace`
- `medical-agenda-saas/src/app/api/import/agenda/parse/route.ts.backup-before-structured-header`

### 2.7 Configuración / Setup
- `.dockerignore`
- `medical-agenda-saas/.nvmrc`
- `docker-compose.runtime-lab.yml`
- `database/init-multiple-dbs.sql`

### 2.8 Datos de Testing (POSIBLE PHI)
- `test-import-full.txt` (CRÍTICO: potencial PHI)
- `test-import-full.txt.cleaned.txt` (CRÍTICO: potencial PHI)
- `test-import.txt` (CRÍTICO: potencial PHI)
- `test-import.txt.cleaned.txt` (CRÍTICO: potencial PHI)

### 2.9 Scripts Varios
- `scripts/run_api_lab_worker.py`
- `tools/expand-medical-sheet-slots.ps1`
- `tools/extract-medical-sheet-full.ps1`
- `tools/extract-medical-sheet-header.ps1`
- `tools/normalize-import-text.ps1`

### 2.10 Otros
- `-Pattern` (directorio no estándar)
- `shared/security/encrypted_types.py`
- `tests/unit/test_runtime_integration.py`

---

## Riesgos Preliminares Detectados

### RIESGO ALTO
1. **test-import*.txt**: Posible PHI/datos reales médicos
2. **docker-compose.yml**: REDIS_PASSWORD pasada en variable de entorno
3. **broker/redis.conf**: No verificado en diff (excluido por .gitignore)
4. **api/app/main.py.backup_20260512_151754**: Backup no debería ser tracked

### RIESGO MEDIO
1. **MetaBrain/** nuevas carpetas no commiteadas: 200+ archivos
2. **medical-agenda-saas/src/lib/medical-***: 40+ archivos nuevos sin commit
3. **Múltiples reportes documentales**: Falta claridad sobre qué se debe commitear

### RIESGO BAJO
1. **__pycache__/*.pyc**: Generados, no deberían estar tracked
2. **tsconfig.tsbuildinfo**: Generado, no debería estar tracked
3. **npm-audit*.json**: Reportes, no críticos

---

## Siguiente Paso
Clasificación por dominio y detección de mezclas peligrosas en WORKTREE_CLASSIFICATION_MATRIX.md
