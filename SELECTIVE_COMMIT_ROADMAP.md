# SELECTIVE COMMIT ROADMAP — 12 de mayo 2026

## Resumen Ejecutivo

**Total Commits Sugeridos:** 7
**Commits GO (Listos):** 4
**Commits CAUTION (Necesitan Validación):** 2
**Commits NO-GO (Bloqueados):** 1+

---

## COMMIT 1: DOCKER/INFRASTRUCTURE HARDENING

**Prioridad:** ALTA  
**Nombre:** `chore(infra): update docker compose and hardening`

### Archivos
```
docker-compose.yml
docker/api.Dockerfile
docker/brain.Dockerfile
docker/decision-service.Dockerfile
docker/dialogue-engine.Dockerfile
docker/gateway.Dockerfile
docker/inference-service.Dockerfile
docker/nlg-service.Dockerfile
docker/redis.Dockerfile
.env.example
```

### Cambios
- Redis 7→8 upgrade
- Postgres 15→16 upgrade
- CPU/Memory limits agregados
- Password authentication en Redis configurado
- Healthchecks mejorados

### Dependencias
- Ninguna

### Riesgos
- ⚠️ Validar que REDIS_PASSWORD no está hardcoded en .env actual
- ⚠️ Validar que redis.conf no expone credenciales

### Rollback
```bash
git revert <commit-hash>
```

### Validación
- [ ] .env real NO está tracked (git status)
- [ ] redis.conf revisado manualmente
- [ ] Docker images buildean localmente
- [ ] Compose levanta sin errores en lab

**Estado:** ✅ GO

---

## COMMIT 2: API CONFIG/SECURITY HARDENING

**Prioridad:** ALTA  
**Nombre:** `feat(security): harden api config and token handling`

### Archivos
```
api/app/core/config.py
api/app/core/security.py
shared/security/secrets.py
api/app/exceptions/handlers.py
```

### Cambios
- Config: Timeouts, pool size, JWT issuer/audience, rate limit config
- Secrets: Hash functions para phone normalization
- Security: Token improvement
- Exception: Handler improvements

### Dependencias
- Ninguna

### Riesgos
- ✅ Bajo (funciones defensivas)

### Rollback
```bash
git revert <commit-hash>
```

### Validación
- [ ] Config flags en .env.example
- [ ] Secrets tests pasan
- [ ] No hay secrets en diff

**Estado:** ✅ GO

---

## COMMIT 3: API ENDPOINTS CONSOLIDATION

**Prioridad:** MEDIA  
**Nombre:** `refactor(api): consolidate endpoints and improve routing`

### Archivos
```
api/app/api/v1/endpoints/admin.py
api/app/api/v1/endpoints/auth.py
api/app/api/v1/endpoints/buffer_slots.py
api/app/api/v1/endpoints/doctors.py
api/app/api/v1/endpoints/health.py
api/app/api/v1/endpoints/meta.py
api/app/api/v1/endpoints/patients.py
api/app/api/v1/endpoints/realtime.py
api/app/api/v1/endpoints/time_slots_simple.py
api/app/api/v1/endpoints/webhooks_google_calendar.py
api/app/dependencies/db.py
api/app/dependencies/tenant.py
api/app/services/appointment_service.py
api/app/services/patient_service.py
api/app/services/shadow_profile_service.py
api/app/models/models.py
```

### Cambios
- API endpoint improvements
- Dependency injection fixes
- Service layer enhancements
- ORM model updates

### Dependencias
- COMMIT 2 (config/security)

### Riesgos
- ✅ Bajo

### Rollback
```bash
git revert <commit-hash>
```

### Validación
- [ ] Endpoints tests pasan
- [ ] No hay regresión en auth
- [ ] Swagger docs actualizadas

**Estado:** ✅ GO

---

## COMMIT 4: DATABASE MIGRATIONS

**Prioridad:** MEDIA  
**Nombre:** `feat(db): add outbox, knowledge base, and appointment redesigns`

### Archivos
```
alembic/versions/20260401_0001_users_outbox.py
alembic/versions/20260401_0002_bot_knowledge_base.py
alembic/versions/20260402_0005_slot_based_appointments.py
alembic/versions/20260402_0006_appointment_priorities.py
database/init-multiple-dbs.sql
```

### Cambios
- Outbox pattern para event sourcing
- Knowledge base schema
- Slot-based appointments redesign
- Priority levels para citas

### Dependencias
- COMMIT 1 (Docker con DB actualizada)
- COMMIT 2 (Config)

### Riesgos
- ⚠️ MEDIA: Schema changes require downtime
- ⚠️ CAUTION: Data migration strategy no documentada

### Rollback Plan REQUERIDO
```bash
# Rollback script
alembic downgrade <prev-revision>
```

### Validación
- [ ] Rollback script exists and tested
- [ ] Data integrity checks automated
- [ ] Zero-downtime strategy defined OR downtime window documented
- [ ] Performance impact tested on large dataset
- [ ] Alembic tests pasan

**Estado:** ⚠️ CAUTION — Liberar SOLO con rollback plan validado

---

## COMMIT 5: RUNTIME TESTS & VALIDATION

**Prioridad:** BAJA  
**Nombre:** `test(runtime): add event bus and stress tests`

### Archivos
```
api/tests/test_runtime_integration.py
api/tests/test_runtime_startup_lab.py
api/tests/runtime_event_bus_concurrency.py
api/tests/runtime_event_bus_stress.py
api/tests/runtime_event_bus_ttl.py
api/tests/runtime_latency_baseline.py
api/tests/runtime_memory_baseline.py
api/tests/runtime_multiworker_stress.py
```

### Cambios
- Tests para runtime integration (passive)
- Event bus concurrency tests
- Stress tests
- Latency/memory baselines

### Dependencias
- COMMIT 1 (runtime ya integrado)
- COMMIT 2 (config)

### Riesgos
- ✅ Bajo (tests, no production code)

### Validation Requirements
- [ ] 100% tests pasan en lab
- [ ] CI/CD pipeline configurada
- [ ] Baselines documentados
- [ ] Performance targets claros

**Estado:** ✅ GO (tests, low risk)

---

## COMMIT 6: CLEANUP — GITIGNORE & GENERATED ARTIFACTS

**Prioridad:** BAJA  
**Nombre:** `chore(git): add gitignore for generated artifacts`

### Archivos
```
.gitignore (update)
```

### Cambios
- Agregar `**/__pycache__/`
- Agregar `*.pyc`
- Agregar `*.tsbuildinfo`
- Agregar `npm-audit*.json`
- Agregar `dist/`, `build/`, `.next/`

### Dependencias
- Ninguna (pero debe hacerse ANTES de demás commits)

### Riesgos
- ✅ Bajo

**Estado:** ✅ GO

---

## COMMIT 7: SETUP/CONFIGURATION

**Prioridad:** BAJA  
**Nombre:** `chore(setup): add lab and seed configuration`

### Archivos
```
create_seed_users.py
docker-compose.runtime-lab.yml
scripts/e2e_setup_clinics.py
scripts/run_api_lab_worker.py
deploy_vps.ps1
```

### Cambios
- Seed data para demo
- Lab configuration
- VPS deployment script

### Dependencias
- COMMIT 1 (Docker)
- COMMIT 4 (DB migrations)

### Riesgos
- ⚠️ MEDIA: Seed data puede contener placeholders confusos

### Validation Requirements
- [ ] Seed data no contiene secretos
- [ ] Lab compose levanta sin errores
- [ ] Deploy script actualizado para VPS actual

**Estado:** ⚠️ CAUTION — Revisar seed data

---

## BLOQUEADOS (NO-GO)

### COMMIT X: MEDICAL AGENDA FEATURES
**Archivos:** 50+ en `medical-agenda-saas/src/lib/medical-*`
**Razón:** INCOMPLETO - Features sin integración en runtime
**Desbloqueador:** 
1. Tests completos
2. Provider integration finalizada
3. Security audit completa
4. Docs finalizadas

---

### COMMIT Y: METABRAIN IA MODULES
**Archivos:** 200+ en `MetaBrain/confidence/`, `review/`, `providers/`, `production-safety/`
**Razón:** INCOMPLETO - IA clínica sin integración, safety gates no validadas
**Desbloqueador:**
1. Confidence model completa
2. Review workflow integrada
3. Provider fallbacks probados
4. Safety model auditada
5. Kill-switch/shadow-mode funcionales

---

## ORDEN RECOMENDADO

```
┌─────────────────────────────────────┐
│ COMMIT 6: GITIGNORE (foundation)    │
└──────────────┬──────────────────────┘
               │
        ┌──────▼──────────┐
        │  Parallelizable  │
        │                  │
   ┌────▼─────┐    ┌───────▼──────┐
   │COMMIT 1:  │    │COMMIT 2:     │
   │Docker/    │    │Config/       │
   │Infra      │    │Security      │
   └────┬─────┘    └───────┬──────┘
        │                  │
        │         ┌────────▼────────┐
        │         │COMMIT 3: API    │
        │         │Endpoints        │
        │         └────────┬────────┘
        │                  │
        └──────────┬───────┘
                   │
            ┌──────▼──────────┐
            │COMMIT 4:        │
            │Migrations       │
            │(validate)       │
            └──────┬──────────┘
                   │
            ┌──────▼──────────┐
            │COMMIT 5: Tests  │
            └──────┬──────────┘
                   │
            ┌──────▼──────────┐
            │COMMIT 7: Setup  │
            │(validate)       │
            └─────────────────┘
```

---

## Summary Table

| # | Nombre | Archivos | Estado | Dependencias | Rollback |
|---|--------|----------|--------|--------------|----------|
| 1 | Docker/Infra | 10 | ✅ GO | Ninguna | `git revert` |
| 2 | Config/Security | 4 | ✅ GO | Ninguna | `git revert` |
| 3 | API Endpoints | 16 | ✅ GO | #2 | `git revert` |
| 4 | Migrations | 5 | ⚠️ CAUTION | #1,#2 | `alembic downgrade` |
| 5 | Tests | 8 | ✅ GO | #1,#2 | `git revert` |
| 6 | Gitignore | 1 | ✅ GO | Ninguna | `git revert` |
| 7 | Setup | 5 | ⚠️ CAUTION | #1,#4 | `git revert` |
| X | Medical | 50+ | ❌ NO-GO | Bloqueado | — |
| Y | MetaBrain IA | 200+ | ❌ NO-GO | Bloqueado | — |

---

## Criterio de Go/No-Go

### GO ✅
- Código validado
- Tests pasan
- Sin secretos
- Sin PHI
- Rollback simple

### CAUTION ⚠️
- Necesita validación adicional
- Rollback más complejo
- Requerimientos claros antes de commit

### NO-GO ❌
- Incompleto/en desarrollo
- Cambios arquitectónicos sin finalizar
- Seguridad médica sin auditar
- No commitear hasta desbloqueador

---

## Próximo Paso
Ver `WORKTREE_GLOBAL_REVIEW_FINAL.md` para consolidación final y estado actual del repositorio.
