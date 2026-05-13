# REMAINING_WORKTREE_DOMAIN_CLASSIFICATION

## 1. Resumen Ejecutivo
- Total de archivos pendientes: 525
- Tracked modificados: 60
- Untracked (reportes/codigo/backups): 465
- GO (A/B/C/D): 153
- CAUTION (E/F/L): 33
- NO-GO (G/H/I/J/K): 339
- PHI/secretos (I/J): 14

## 2. Total de Archivos Pendientes
- Pendientes exactos: 525
- Formula: tracked (60) + untracked (465)

## 3. Clasificacion Completa por Dominio
| Dominio | Definicion | Cantidad |
|---|---|---:|
| A | Docker/config GO | 18 |
| B | API endpoints GO | 7 |
| C | Tests GO | 13 |
| D | Docs seguras GO | 115 |
| E | Migrations CAUTION | 7 |
| F | Setup/seed CAUTION | 5 |
| G | MetaBrain clinical NO-GO | 271 |
| H | Medical features NO-GO | 53 |
| I | PHI/PII manual | 7 |
| J | Secrets/env manual | 7 |
| K | Temp/backups | 1 |
| L | Unknown | 21 |

## 4. Archivos NO-GO
- Dominio G: MetaBrain clinical/IA (excluir completo).
- Dominio H: medical features incompletas (excluir completo).
- Dominio I/J: PHI/PII o secretos/config sensible (manual review obligatorio).

## 5. Archivos CAUTION
- E: alembic/versions/* con plan de rollback y prueba upgrade/downgrade.
- F: seeds/setup/sql con validacion demo data y scrub credenciales.
- L: archivos no mapeados que requieren lectura puntual antes de decidir.

## 6. Bloques GO Prioritarios
1. Docker/config A (subset sin secretos).
2. API endpoints B (solo endpoints no acoplados a migrations/PHI).
3. Tests C (sin providers externos ni fixtures PHI).
4. Docs D (scrub secreto/PHI previo).

## 7. Riesgos Criticos
- Mezcla runtime + IA clinica (api/* con MetaBrain/* en mismo worktree).
- Mezcla API + migrations sin rollout coordinado.
- Mezcla config + secretos (.env.example, core/security, shared/security/secrets, redis.conf).
- Mezcla tests con potencial PHI en import/agenda y pacientes.

## 8. Orden Recomendado de Commits
1. `chore(docker-config): runtime-safe compose and dockerfile alignment` (A subset).
2. `fix(api-endpoints): runtime-safe endpoint updates` (B subset sin I/J).
3. `test(runtime): focused runtime and api tests` (C subset).
4. `docs(runtime): safe operational docs` (D subset).
5. `chore(db-migrations): ...` (E, CAUTION con rollback).
6. `chore(setup-seed): ...` (F, CAUTION con demo policy).
7. G/H fuera del release pre-canary.

## 9. Validaciones Requeridas por Commit
- Docker/config: `git diff -- <file>`, `git grep -nE "SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE"`, `docker compose config -q`.
- API endpoints: tests focales (`pytest api/tests -k ...`), revisar contratos HTTP, confirmar sin SQL destructivo.
- Tests: ejecutar tests nuevos/modificados, verificar fixtures anonimizadas, bloquear dependencias externas.
- Docs: revisión manual de PHI/secretos, stage selectivo archivo por archivo.

## 10. Que NO debe commitearse
- Todo dominio G y H (IA clinica y medical incompleto).
- Archivos I/J sin revisión manual y sanitización.
- Seeds y migrations (E/F) sin plan de rollback y datos demo validados.
- Cualquier mezcla multi-dominio en un solo commit.

## 11. Proximo Commit Recomendado
- `chore(docker-config): runtime-safe compose and dockerfile alignment`
- Scope inicial sugerido (GO): `.dockerignore`, `docker-compose.runtime-lab.yml`, `docker-compose.runtime-lock.yml`, `docker/api.Dockerfile`, `docker/brain.Dockerfile`, `docker/decision-service.Dockerfile`, `docker/dialogue-engine.Dockerfile`, `docker/gateway.Dockerfile`, `docker/inference-service.Dockerfile`, `docker/nlg-service.Dockerfile`, `docker/redis.Dockerfile`, `medical-agenda-saas/Dockerfile`.
- Excluir explícitamente de ese commit: `.env.example`, `broker/redis.conf`, `api/app/core/security.py`, `shared/security/secrets.py`, `deploy_vps.ps1`.

## 12. Inventario y Clasificacion Archivo por Archivo
| Ruta exacta | Estado | Dominio | Riesgo | Puede entrar en commit selectivo | Commit sugerido | Validacion requerida |
|---|---|---|---|---|---|---|
| -Pattern | untracked | K | BAJO | NO | chore(cleanup): remove temp artifacts | cleanup plan only |
| .dockerignore | untracked | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| .env.example | tracked-modified | J | ALTO | NO | none | secret scan + env audit + key policy |
| alembic/versions/20260401_0001_users_outbox.py | tracked-modified | E | ALTO | NO | chore(db-migrations): pending review | upgrade/downgrade test + rollback plan |
| alembic/versions/20260401_0002_bot_knowledge_base.py | tracked-modified | E | ALTO | NO | chore(db-migrations): pending review | upgrade/downgrade test + rollback plan |
| alembic/versions/20260402_0005_slot_based_appointments.py | tracked-modified | E | ALTO | NO | chore(db-migrations): pending review | upgrade/downgrade test + rollback plan |
| alembic/versions/20260402_0006_appointment_priorities.py | tracked-modified | E | ALTO | NO | chore(db-migrations): pending review | upgrade/downgrade test + rollback plan |
| alembic/versions/20260508_0025_clinic_id_not_null.py | untracked | E | ALTO | NO | chore(db-migrations): pending review | upgrade/downgrade test + rollback plan |
| alembic/versions/20260508_0026_hash_verify_token.py | untracked | E | ALTO | NO | chore(db-migrations): pending review | upgrade/downgrade test + rollback plan |
| alembic/versions/20260508_0027_rls_indexes_and_sensitive_fields.py | untracked | E | ALTO | NO | chore(db-migrations): pending review | upgrade/downgrade test + rollback plan |
| alembic/versions/20260508_0028_encrypt_patient_phone_with_blind_index.py | untracked | I | ALTO | NO | none | revisar PHI/PII fixtures y logs |
| alembic/versions/20260508_0029_create_patients_table_base.py | untracked | I | ALTO | NO | none | revisar PHI/PII fixtures y logs |
| api/app/api/v1/endpoints/admin.py | tracked-modified | B | MEDIO | SI | fix(api-endpoints): runtime-safe endpoint updates | pytest focal; contract checks; no migration coupling |
| api/app/api/v1/endpoints/auth.py | tracked-modified | B | MEDIO | SI | fix(api-endpoints): runtime-safe endpoint updates | pytest focal; contract checks; no migration coupling |
| api/app/api/v1/endpoints/buffer_slots.py | tracked-modified | B | MEDIO | SI | fix(api-endpoints): runtime-safe endpoint updates | pytest focal; contract checks; no migration coupling |
| api/app/api/v1/endpoints/doctors.py | tracked-modified | I | ALTO | NO | none | revisar PHI/PII fixtures y logs |
| api/app/api/v1/endpoints/health.py | tracked-modified | B | MEDIO | SI | fix(api-endpoints): runtime-safe endpoint updates | pytest focal; contract checks; no migration coupling |
| api/app/api/v1/endpoints/meta.py | tracked-modified | B | MEDIO | SI | fix(api-endpoints): runtime-safe endpoint updates | pytest focal; contract checks; no migration coupling |
| api/app/api/v1/endpoints/patients.py | tracked-modified | I | ALTO | NO | none | revisar PHI/PII fixtures y logs |
| api/app/api/v1/endpoints/realtime.py | tracked-modified | B | MEDIO | SI | fix(api-endpoints): runtime-safe endpoint updates | pytest focal; contract checks; no migration coupling |
| api/app/api/v1/endpoints/time_slots_simple.py | tracked-modified | B | MEDIO | SI | fix(api-endpoints): runtime-safe endpoint updates | pytest focal; contract checks; no migration coupling |
| api/app/api/v1/endpoints/webhooks_google_calendar.py | tracked-modified | I | ALTO | NO | none | revisar PHI/PII fixtures y logs |
| api/app/core/config.py | tracked-modified | J | ALTO | NO | none | secret scan + env audit + key policy |
| api/app/core/security.py | tracked-modified | J | ALTO | NO | none | secret scan + env audit + key policy |
| api/app/dependencies/db.py | tracked-modified | L | MEDIO | NO | none | inspeccion manual |
| api/app/dependencies/tenant.py | tracked-modified | J | ALTO | NO | none | secret scan + env audit + key policy |
| api/app/exceptions/handlers.py | tracked-modified | L | MEDIO | NO | none | inspeccion manual |
| api/app/models/models.py | tracked-modified | L | MEDIO | NO | none | inspeccion manual |
| api/app/services/appointment_service.py | tracked-modified | L | MEDIO | NO | none | inspeccion manual |
| api/app/services/patient_service.py | tracked-modified | I | ALTO | NO | none | revisar PHI/PII fixtures y logs |
| api/app/services/shadow_profile_service.py | tracked-modified | I | ALTO | NO | none | revisar PHI/PII fixtures y logs |
| api/tests/runtime_event_bus_concurrency.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| api/tests/runtime_event_bus_stress.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| api/tests/runtime_event_bus_ttl.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| api/tests/runtime_latency_baseline.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| api/tests/runtime_memory_baseline.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| api/tests/runtime_multiworker_stress.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| api/tests/test_runtime_integration.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| api/tests/test_runtime_startup_lab.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| ARCHITECTURE_GAP_ANALYSIS.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| ARCHITECTURE_LAYER_MAP.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| AUDITOR├ìA_GLOBAL_COMPLETADA.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| BRAIN_NETWORK_FIX.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| broker/redis.conf | tracked-modified | J | ALTO | NO | none | secret scan + env audit + key policy |
| CHAT_IA_END_TO_END_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| CHAT_STATE_AND_DELETE_FIX.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| CLINICAL_CONFIDENCE_SAFETY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| CLINICAL_CONFIDENCE_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| COMPOSE_RUNTIME_LOCK_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| create_seed_users.py | tracked-modified | F | ALTO | NO | chore(setup-seed): demo-only seed alignment | demo-data validation; credential scrub |
| database/init-multiple-dbs.sql | untracked | F | ALTO | NO | chore(setup-seed): demo-only seed alignment | demo-data validation; credential scrub |
| deploy_vps.ps1 | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| DOCKER_ANALYSIS.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| docker-compose.runtime-lab.yml | untracked | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker-compose.runtime-lock.yml | untracked | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker-compose.yml | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/api.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/brain.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/decision-service.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/dialogue-engine.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/gateway.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/inference-service.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/nlg-service.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| docker/redis.Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| DOCTOR_CONTEXT_IMPLEMENTATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| ENVIRONMENT_GAP_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_AUDIT_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_BOUNDED_DESIGN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_CONCURRENCY_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_CONCURRENCY_BASELINE.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_CONCURRENCY_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_CONCURRENCY_TTL_FINAL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_CONCURRENCY_TTL_ROLLBACK.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_HARDENING_FINAL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_MULTIPROCESS_LIMITATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_ROLLBACK_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_STRESS_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| EVENT_BUS_TTL_POLICY.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_ARCHITECTURE_MAP.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_EXECUTIVE_SUMMARY.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_LIMITATIONS_AND_SCOPE.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_READINESS_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_RISK_MATRIX.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_ROLLBACK_MASTER_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_RUNTIME_INTEGRATION_ROADMAP.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FINAL_SAFETY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| FRONTEND_CACHE_PERMISSION_FIX.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| GENERATED_ARTIFACTS_UNTRACK_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| GITIGNORE_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| GLOBAL_AI_FLAGS_REFERENCE.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| GLOBAL_WORKTREE_INVENTORY.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| GROQ_FRONTEND_ENV_FIX.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| HUMAN_REVIEW_ROLLBACK_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| HUMAN_REVIEW_SAFETY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| HUMAN_REVIEW_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| IMAGE_PIPELINE_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| IMAGE_ROLLBACK_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| IMAGE_SAFETY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| LAB_DB_REDIS_CONFIG_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| LAB_DB_REDIS_CONNECTIVITY_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| LAB_DB_REDIS_STARTUP_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| LAB_ENV_DEPENDENCY_SOURCE.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| LAB_ENV_RUNTIME_CONFIG.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| LAB_ENV_SETUP_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| LOCALHOST_AUDIT_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MAIN_PY_DIFF_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEDICAL_AI_WEB_RETRIEVAL_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEDICAL_CONVERSATION_MEMORY_IMPLEMENTATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEDICAL_REASONING_IMPLEMENTATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEDICAL_RUNTIME_CONTEXT_IMPLEMENTATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEDICAL_SPECIALTY_PROTOCOLS_IMPLEMENTATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEDICAL_WEB_RETRIEVAL_IMPLEMENTATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| medical-agenda-saas/.nvmrc | untracked | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| medical-agenda-saas/Dockerfile | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| medical-agenda-saas/package.json | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| medical-agenda-saas/prisma/seed.ts | tracked-modified | F | ALTO | NO | chore(setup-seed): demo-only seed alignment | demo-data validation; credential scrub |
| medical-agenda-saas/src/app/api/import/agenda/parse/route.ts | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/app/api/super-admin/clinics/[id]/whatsapp/route.ts | tracked-modified | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/app/chat/doctor/route.ts | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/chat/chat.service.ts | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/components/doctor-chat-hub.tsx | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/components/doctor-dashboard.tsx | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/components/pages/ImportAgenda.jsx | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/doctor-context/fallback.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/index.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/loader.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/locale-adapters.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/preference-isolation.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/regional-guidelines.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/sanitizer.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/specialty-context.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/timezone-adapters.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/doctor-context/types.ts | untracked | L | MEDIO | NO | none | inspeccion manual |
| medical-agenda-saas/src/lib/groq-doctor-chat.ts | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/audit.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/config.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/index.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/memory-manager.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/sanitizer.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/summarizer.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/token-budget.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-conversation-memory/types.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-reasoning/context-builder.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-reasoning/index.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-reasoning/severity.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-reasoning/specialty-adapters.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-reasoning/templates.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-reasoning/types.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/audit.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/cache.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/config.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/context-builder.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/environmental-alerts.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/epidemiology-context.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/index.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/sanitizer.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/time-context.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/types.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-runtime-context/weather-context.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/context-builder.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/emergency-modifiers.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/fallback.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/index.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/prompt-adapters.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/protocol-loader.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/registry.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/risk-modifiers.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-specialty-protocols/types.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/audit.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/config.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/context-builder.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/extractor.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/index.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/policy.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/query-builder.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/retriever.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/sanitizer.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/source-allowlist.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/src/lib/medical-web-retrieval/types.ts | untracked | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/tests/nlp/doctor-context.test.ts | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| medical-agenda-saas/tests/nlp/groq-doctor-chat.test.ts | tracked-modified | H | CRITICO | NO | none | NO-GO medical features incompletas |
| medical-agenda-saas/tests/nlp/medical-conversation-memory.test.ts | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| medical-agenda-saas/tests/nlp/medical-reasoning.test.ts | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| medical-agenda-saas/tests/nlp/medical-specialty-protocols.test.ts | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| MEMORY_LAYER_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEMORY_ROLLBACK_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MEMORY_SECURITY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| METABRAIN_CRITICAL_FIX_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| METABRAIN_DOCKERIGNORE_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| METABRAIN_DOCKERIGNORE_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| METABRAIN_RUNTIME_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| MetaBrain/audit/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/audit/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/audit/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/cerebro_ai_med/models/artifacts/metadata.json | tracked-modified | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/cerebro_ai_med/models/ml_model.py | tracked-modified | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/cerebro_ai_med/models/registry.py | tracked-modified | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/confidence_audit.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/confidence_engine.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/confidence_explainer.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/confidence_flags.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/confidence_policy.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/confidence_score.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/escalation_recommendation.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/evidence_evaluator.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/hallucination_risk.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/multimodal_conflict.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/provider_consistency.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/safe_display.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/types.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence_py/uncertainty_score.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/confidence-audit.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/confidence-engine.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/confidence-explainer.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/confidence-flags.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/confidence-policy.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/confidence-score.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/escalation-recommendation.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/evidence-evaluator.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/hallucination-risk.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/multimodal-conflict.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/provider-consistency.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/safe-display.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/confidence/uncertainty-score.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/core/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/core/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/core/layer-registry.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/core/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/core/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/audit.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/confidence.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/dicom_contract.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/feature_flags.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/ingestion.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/legacy_adapter.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/metadata_extractor.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/modality_router.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/normalizer.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/provider_contract.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging_py/types.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/dicom.contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/feature-flags.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/image-analysis-result.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/image-audit.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/image-confidence.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/image-ingestion.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/image-metadata-extractor.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/image-normalizer.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/legacy-image-adapter.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/modality-router.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/provider.contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/imaging/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory_py/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory_py/audit.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory_py/jsonl_adapter.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory_py/retriever.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory_py/sanitizer.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory_py/semantic_memory_service.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory_py/types.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/feature-flags.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/jsonl-memory-adapter.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/memory-audit.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/memory-retriever.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/memory-sanitizer.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/semantic-memory-service.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/memory/vector-backend.contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/confidence_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/correlation.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/drift_detector.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/escalation_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/event_bus.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/health_snapshot.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/imaging_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/memory_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/observability_audit.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/performance_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/provider_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/request_lineage.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/review_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/safety_metrics.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/structured_logger.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/telemetry_flags.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/telemetry_policy.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/telemetry_sanitizer.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/trace_context.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/trace_engine.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability_py/types.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/confidence-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/correlation.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/drift-detector.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/escalation-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/event-bus.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/health-snapshot.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/imaging-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/memory-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/observability-audit.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/performance-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/provider-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/request-lineage.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/review-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/safety-metrics.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/structured-logger.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/telemetry-flags.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/telemetry-policy.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/telemetry-sanitizer.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/trace-context.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/trace-engine.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/observability/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/activation_policy.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/dry_run.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/env_validator.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/global_feature_flags.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/health_check.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/kill_switch.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/rollback_registry.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/runtime_guard.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/safe_fallback.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/safety_report.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/shadow_mode.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/startup_validator.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production_safety_py/types.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/activation-policy.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/dry-run.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/env-validator.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/global-feature-flags.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/health-check.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/kill-switch.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/rollback-registry.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/runtime-guard.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/safe-fallback.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/safety-report.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/shadow-mode.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/startup-validator.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/production-safety/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/context_sanitizer.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/future_medical/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/future_medical/adapter.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/gemini/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/gemini/adapter.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/groq/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/groq/adapter.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/local/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/local/adapter.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/openai/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/openai/adapter.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_audit.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_errors.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_fallback.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_flags.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_health.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_registry.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_response.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_retry.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_router.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/provider_timeouts.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/structured_output.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers_py/types.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/future-medical/adapter.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/future-medical/capabilities.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/future-medical/contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/future-medical/health.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/future-medical/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/gemini/adapter.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/gemini/capabilities.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/gemini/contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/gemini/health.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/gemini/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/groq/adapter.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/groq/capabilities.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/groq/contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/groq/health.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/groq/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/llm-orchestrator.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/local/adapter.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/local/capabilities.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/local/contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/local/health.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/local/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/openai/adapter.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/openai/capabilities.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/openai/contract.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/openai/health.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/openai/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-audit.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-context-sanitizer.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-errors.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-fallback.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-flags.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-health.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-registry.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-response.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-retry.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-router.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-scoring.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/provider-timeouts.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/structured-output.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/providers/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/retrieval/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/retrieval/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/retrieval/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_audit.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_blocking.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_confidence_gate.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_decision.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_escalation.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_flags.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_policy.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_queue.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_reasons.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_risk.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_routing.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/review_status.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review_py/types.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-audit.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-blocking.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-confidence-gate.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-decision.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-escalation.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-flags.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-policy.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-queue.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-reasons.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-risk.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-routing.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/review-status.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/review/types.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/risk/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/risk/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/risk/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/rules/__init__.py | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/rules/index.ts | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/rules/README.md | untracked | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/services/inference_service/requirements.txt | tracked-modified | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/services/nlg_service/app/engine.py | tracked-modified | G | CRITICO | NO | none | NO-GO IA clinica |
| MetaBrain/services/nlg_service/requirements.txt | tracked-modified | G | CRITICO | NO | none | NO-GO IA clinica |
| MONGOOSE_INDEX_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| NODE_RUNTIME_ALIGNMENT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| NPM_AUDIT_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| OBSERVABILITY_ROLLBACK_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| OBSERVABILITY_SAFETY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| OBSERVABILITY_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PHASE_2_COMPATIBILITY_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PRECANARY_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PRODUCTION_SAFETY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PRODUCTION_SAFETY_ROLLBACK_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PRODUCTION_SAFETY_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PROVIDER_ROLLBACK_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PROVIDER_ROUTER_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| PROVIDER_SECURITY_MODEL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RATE_LIMIT_COMMIT_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| REMAINING_WORKTREE_DOMAIN_CLASSIFICATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_CANARY_PLAN.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_CANONICAL_TAG_EXECUTION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_DRIFT_TRACE_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_FLAG_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_HARDENING_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_HTTP_E2E_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_IMPORT_FAILURE_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_IMPORT_SUCCESS_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_INTEGRATION_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_LAB_SHUTDOWN_ROLLBACK_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_LAB_VALIDATION_FINAL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_LATENCY_BASELINE.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_MEMORY_BASELINE.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_MULTIWORKER_DB_REDIS_LAB_FINAL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_MULTIWORKER_STRESS_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_ORIGIN_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_PHI_LEAKAGE_CHECK.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_ROLLBACK_DRILL_RESULT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_ROLLBACK_DRILL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_SAFETY_GATES.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_SHADOW_MODE_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_STABILIZATION_NO_CHANGE.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_STARTUP_LAB_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| RUNTIME_WORKTREE_SAFETY_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| SAFE_TAGGING_PLAN_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| scripts/build-dashboard-ui-optimized.ps1 | tracked-modified | L | MEDIO | NO | none | inspeccion manual |
| scripts/e2e_setup_clinics.py | tracked-modified | F | ALTO | NO | chore(setup-seed): demo-only seed alignment | demo-data validation; credential scrub |
| scripts/run_api_lab_worker.py | untracked | F | ALTO | NO | chore(setup-seed): demo-only seed alignment | demo-data validation; credential scrub |
| SELECTIVE_COMMIT_ROADMAP.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| shared/models/models.py | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| shared/schemas/__init__.py | tracked-modified | A | MEDIO | SI | chore(docker-config): runtime-safe config alignment | git diff; secret grep; docker compose config |
| shared/security/encrypted_types.py | untracked | L | MEDIO | NO | none | inspeccion manual |
| shared/security/secrets.py | tracked-modified | J | ALTO | NO | none | secret scan + env audit + key policy |
| tests/unit/test_runtime_integration.py | untracked | C | BAJO | SI | test(runtime): add/update focused tests | run focused tests; fixture review PHI-free |
| tools/expand-medical-sheet-slots.ps1 | untracked | L | MEDIO | NO | none | inspeccion manual |
| tools/extract-medical-sheet-full.ps1 | untracked | L | MEDIO | NO | none | inspeccion manual |
| tools/extract-medical-sheet-header.ps1 | untracked | L | MEDIO | NO | none | inspeccion manual |
| tools/normalize-import-text.ps1 | untracked | L | MEDIO | NO | none | inspeccion manual |
| TYPESCRIPT_TOOLCHAIN_VALIDATION.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| UNTRACKED_RUNTIME_SECURITY_FILES_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| whatsapp_gateway/services/account_resolver.py | tracked-modified | J | ALTO | NO | none | secret scan + env audit + key policy |
| WORKTREE_CLASSIFICATION_MATRIX.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| WORKTREE_GENERATED_ARTIFACTS_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| WORKTREE_GLOBAL_REVIEW_FINAL.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| WORKTREE_MIXING_RISK_REPORT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
| WORKTREE_SECRET_AUDIT.md | untracked | D | BAJO | SI | docs(runtime): safe operational documentation | manual PHI/secret scrub |
