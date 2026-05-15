# WORKTREE MIXING RISK REPORT — 12 de mayo 2026

## Análisis de Mezclas Peligrosas

### 1. RUNTIME + GENERATED ARTIFACTS

#### 1.1 Python Cache Files (__pycache__)
| Archivo | Estado | Mezcla Detectada | Riesgo | Acción |
|---------|--------|------------------|--------|--------|
| MetaBrain/cerebro_ai_med/__pycache__/*.pyc | TRACKED | Tracked + Generated | MEDIO | Agregar `**/__pycache__/` a .gitignore |
| MetaBrain/metabrain/__pycache__/*.pyc | TRACKED | Tracked + Generated | MEDIO | Agregar a .gitignore |
| MetaBrain/services/__pycache__/*.pyc | TRACKED | Tracked + Generated | MEDIO | Agregar a .gitignore |

#### 1.2 TypeScript Build Output
| Archivo | Estado | Mezcla Detectada | Riesgo | Acción |
|---------|--------|------------------|--------|--------|
| MetaBrain/tsconfig.tsbuildinfo | TRACKED | Tracked + Generated | BAJO | Agregar `*.tsbuildinfo` a .gitignore |

**Impacto:** Archivos generados en cada compilación; ocupan espacio sin valor en histórico.
**Recomendación:** Agregar a .gitignore y hacer commit separado para limpiar histórico.

---

### 2. DOCKER + ENVIRONMENT SECRETS

#### 2.1 docker-compose.yml + REDIS_PASSWORD
| Característica | Antes | Después | Riesgo |
|---------------|-------|--------|--------|
| Redis auth | No configurado | requirepass "$REDIS_PASSWORD" | MEDIA |
| Variable env | No usada | environment: REDIS_PASSWORD: ${REDIS_PASSWORD} | MEDIA |
| Healthcheck | sin password | -a "$$REDIS_PASSWORD" ping | OK |

**Problema Detectado:** 
El cambio en `docker-compose.yml` intenta pasar `REDIS_PASSWORD` como variable de entorno. Si en el worktree actual hay un `.env` real (no `.example`), está TRACKED accidentalmente, estaría expuesto.

**Validación Requerida:**
1. Verificar que `.env` real NO esté en git status
2. Verificar que `broker/redis.conf` NO contiene credenciales en plaintext
3. Verificar que REDIS_PASSWORD solo se inyecta en runtime, no hard-coded

**Recomendación:** 
- Commit `docker-compose.yml` es SEGURO si `.env` no está tracked
- Documentar que REDIS_PASSWORD debe venir de environment, no de git

---

### 3. MEDICAL FEATURES + RUNTIME INCOMPLETOS

#### 3.1 medical-agenda-saas/* Nuevos Módulos
| Módulo | Archivos | Status | Mezcla Detectada | Riesgo |
|--------|----------|--------|------------------|--------|
| medical-conversation-memory | 8 | UNTRACKED | Feature incompleta + Runtime incomplete | ALTA |
| medical-reasoning | 6 | UNTRACKED | Feature incompleta + Runtime incomplete | ALTA |
| medical-runtime-context | 10 | UNTRACKED | Feature incompleta + Runtime incomplete | ALTA |
| medical-specialty-protocols | 8 | UNTRACKED | Feature incompleta + Runtime incomplete | ALTA |
| medical-web-retrieval | 11 | UNTRACKED | Feature incompleta + Runtime incomplete | ALTA |
| doctor-context | 9 | UNTRACKED | Feature incompleta + Runtime incomplete | ALTA |

**Problema Detectado:**
50+ archivos de features médicas sin terminar, mezcladas con cambios de infraestructura ya commiteados. Si se comittean juntos:
- Riesgo de regresión si feature incompleta se activa
- Imposible rollback de una sin la otra
- Test suite incompleta

**Recomendación:** NO COMMITEAR hasta que:
1. Tests pasen
2. Integración completa en runtime/provider
3. Seguridad médica auditada
4. Documentación finalizada

---

### 4. METABRAIN MÓDULOS + PROVIDER INTEGRATION

#### 4.1 MetaBrain/confidence + review + providers Incompletos
| Módulo | Archivos | Status | Mezcla Detectada | Riesgo |
|--------|----------|--------|------------------|--------|
| confidence* | 35 | UNTRACKED | IA confidence + review layer incomplete | ALTA |
| review* | 35 | UNTRACKED | Human review + IA incomplete | ALTA |
| providers* | 60 | UNTRACKED | Provider routing + safety incomplete | ALTA |
| production-safety* | 35 | UNTRACKED | Safety gates + IA workflow incomplete | ALTA |

**Problema Detectado:**
Arquitectura completa de IA clínica (confidence→review→providers) está incompleta y sin integración con runtime pasivo commiteado.

Si se comittean:
- Runtime pasivo + IA activa = CONFLICTO arquitectónico
- Safety gates no validadas
- Provider fallbacks no probados
- Human review queue no integrada

**Recomendación:** NO COMMITEAR hasta que:
1. Arquitectura de integración esté finalizada
2. Safety model completo esté auditado
3. Flags de kill-switch/shadow-mode funcionen completamente
4. Tests de end-to-end pasen

---

### 5. TESTS + DOCUMENTACIÓN ENTRELAZADOS

#### 5.1 Tests Nuevos sin Docs de Integración
| Test | Estado | Mezcla Detectada | Riesgo |
|------|--------|------------------|--------|
| test_runtime_integration.py | UNTRACKED | Test + Runtime Integration | BAJA |
| runtime_event_bus_*.py | UNTRACKED | Test + Event Bus Infrastructure | BAJA |
| runtime_latency_baseline.py | UNTRACKED | Test + Performance Baseline | BAJA |

**Problema Detectado:** Tests documentan comportamiento esperado pero no hay documentación clara de:
- Qué debe pasar (validación)
- Qué no debe pasar (restricción)
- Cuándo rollback

**Recomendación:** Commitear tests SOLO si hay:
1. Corresponidng .md con rationale
2. Documentación de baseline aceptada
3. CI/CD pipeline configurada

---

### 6. ALEMBIC MIGRATIONS + SCHEMA CHANGES

#### 6.1 Nuevas Migraciones sin Rollback Plan
| Migración | Status | Cambios | Mezcla Detectada | Riesgo |
|-----------|--------|---------|------------------|--------|
| 20260401_0001_users_outbox.py | TRACKED | Outbox pattern | Migration + Event sourcing incomplete | MEDIA |
| 20260401_0002_bot_knowledge_base.py | TRACKED | Knowledge base | Migration + Bot incomplete | MEDIA |
| 20260402_0005_slot_based_appointments.py | TRACKED | Slot redesign | Migration + Agenda incomplete | MEDIA |
| 20260402_0006_appointment_priorities.py | TRACKED | Priorities | Migration + Scheduling incomplete | MEDIA |

**Problema Detectado:**
Migraciones están tracked pero:
- Corresponding rollback scripts no documentados
- Downtime strategy no claro
- Tested en lab pero no en staging

**Recomendación:** Commitear SOLO si:
1. Rollback plan documentado y probado
2. Data integrity checks incluidos
3. Performance impact validated
4. Zero-downtime deployment strategy definida

---

### 7. BACKUP FILES + DOCUMENTATION CONFLICTS

#### 7.1 Backups sin Cleanupplan
| Archivo | Estado | Problema | Riesgo |
|---------|--------|----------|--------|
| api/app/main.py.backup_20260512_151754 | UNTRACKED | Backup temporal | BAJA |
| medical-agenda-saas/*.backup-before-* | UNTRACKED | Backups de edición | BAJA |

**Problema Detectado:** 
Backups temporales pueden confundir a otros desarrolladores sobre qué es versión oficial.

**Recomendación:** 
Limpiar backups localmente después de validación final. NO commitear.

---

## Matriz de Riesgo de Mezcla

| Mezcla | Commits Afectados | Severidad | Acción Requerida |
|--------|------------------|-----------|------------------|
| Runtime + Generated | 1+ | MEDIA | Limpiar .gitignore |
| Docker + Secrets | 1 | MEDIA | Validar .env no tracked |
| Medical + Runtime Incomplete | 5+ | ALTA | NO COMMITEAR aún |
| MetaBrain Incomplete | 5+ | ALTA | NO COMMITEAR aún |
| Tests + Docs | 1-2 | BAJA-MEDIA | EVALUAR con roadmap |
| Migrations | 4 | MEDIA | Validar rollback |
| Backups | 2 | BAJA | LIMPIAR local |

---

## Conclusión

**Mezclas Críticas Detectadas:** 3 (Medical, MetaBrain, Generated artifacts)
**Mezclas Medias Detectadas:** 3 (Docker secrets, Migrations, Tests)
**Mezclas Bajas Detectadas:** 2 (Backups, Documentation)

**Blockers para Commits Múltiples:**
1. ✅ Runtime/Core: LISTO (sin mezclas críticas)
2. ⚠️ Docker/Infrastructure: LISTO con validación
3. ✅ API Endpoints: LISTO
4. ⚠️ Migrations: LISTO con rollback plan
5. ❌ Medical Features: NO LISTO (incompleto)
6. ❌ MetaBrain IA: NO LISTO (incompleto)
7. ⚠️ Tests: EVALUAR con integración

---

## Próximo Paso
Ver `SELECTIVE_COMMIT_ROADMAP.md` para plan seguro de commits ordenados.
