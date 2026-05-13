# WORKTREE CLASSIFICATION MATRIX — 12 de mayo 2026

## Matriz de Clasificación por Dominio

### GRUPO A: RUNTIME/CORE (Tracked Modified)
| Archivo | Cambios | Criticidad | ¿Commitear? | Razón |
|---------|---------|-----------|-----------|-------|
| api/app/core/config.py | +timeout, +pool_size, +jwt_issuer, +samesite | MEDIA | SI | Configuración operacional necesaria |
| shared/security/secrets.py | +sha256_hex, +normalize_phone, +hash_phone | MEDIA | SI | Funciones defensivas de seguridad |
| api/app/core/security.py | ? | MEDIA | SI | Core de seguridad |
| api/app/exceptions/handlers.py | ? | BAJA | SI | Manejadores de excepciones |

### GRUPO B: DOCKER/LAB (Tracked Modified + Untracked)
| Archivo | Estado | Cambios | Criticidad | ¿Commitear? | Razón |
|---------|--------|---------|-----------|-----------|-------|
| docker-compose.yml | TRACKED | Redis upgrade 7→8, password vars | MEDIA | SI | Infraestructura, versiones seguras |
| docker-compose.runtime-lab.yml | UNTRACKED | ? | BAJA | NO | Lab local, no necesario |
| docker/*.Dockerfile | TRACKED | ? | MEDIA | SI | Build specs |
| database/init-multiple-dbs.sql | UNTRACKED | New | BAJA | NO | Inicialización local |

### GRUPO C: API ENDPOINTS (Tracked Modified)
| Archivo | Cambios | Criticidad | ¿Commitear? | Razón |
|---------|---------|-----------|-----------|-------|
| api/app/api/v1/endpoints/auth.py | ? | MEDIA | SI | Autenticación |
| api/app/api/v1/endpoints/admin.py | ? | MEDIA | SI | Admin |
| api/app/api/v1/endpoints/*.py (otros 9) | ? | BAJA-MEDIA | SI | Endpoints funcionales |

### GRUPO D: INFRASTRUCTURE (Tracked Modified)
| Archivo | Cambios | Criticidad | ¿Commitear? | Razón |
|---------|---------|-----------|-----------|-------|
| .env.example | MODIFICADO | Placeholder updates | BAJA | SI | Documentación de vars |
| broker/redis.conf | TRACKED | No verificado | ALTA | REVISAR | Contiene configuración sensible |
| create_seed_users.py | TRACKED | ? | MEDIA | REVISAR | Crea usuarios demo |
| deploy_vps.ps1 | TRACKED | ? | MEDIA | SI | Deploy script |

### GRUPO E: DATABASE/MIGRATIONS (Tracked Modified)
| Archivo | Cambios | Criticidad | ¿Commitear? | Razón |
|---------|---------|-----------|-----------|-------|
| alembic/versions/*.py (4 nuevas) | TRACKED | Nueva schema | ALTA | SI | Migraciones versionadas |
| api/app/models/models.py | TRACKED | ? | MEDIA | SI | ORM models |
| api/app/dependencies/db.py | TRACKED | ? | MEDIA | SI | DB dependencies |

### GRUPO F: TESTS (Untracked)
| Archivo | Cambios | Criticidad | ¿Commitear? | Razón |
|---------|---------|-----------|-----------|-------|
| api/tests/test_runtime_*.py (8 nuevos) | UNTRACKED | Test suites | BAJA-MEDIA | EVALUAR | Runtime tests, valida pasivo |
| medical-agenda-saas/tests/nlp/*.test.ts | UNTRACKED | Test suites | BAJA | NO | Aún en desarrollo |

### GRUPO G: DOCUMENTACIÓN (Untracked)
| Archivo | Cantidad | Criticidad | ¿Commitear? | Razón |
|---------|----------|-----------|-----------|-------|
| ARCHITECTURE_*.md | 7 | BAJA | NO | Auditoría interna |
| EVENT_BUS_*.md | 10 | BAJA | NO | Auditoría interna |
| RUNTIME_*.md | 20 | BAJA | NO | Auditoría interna |
| FINAL_*.md | 10 | BAJA | NO | Auditoría interna |
| METABRAIN_*.md | 3 | BAJA | NO | Auditoría interna |
| Otros reportes | 50+ | BAJA | NO | Documentación de proceso |

### GRUPO H: METABRAIN NUEVOS MÓDULOS (Untracked)
| Directorio | Archivos | Criticidad | ¿Commitear? | Razón |
|-----------|----------|-----------|-----------|-------|
| MetaBrain/confidence/ + *_py/ | 35 | ALTA | ¿? | Confianza de salida IA, incompleto |
| MetaBrain/imaging/ + *_py/ | 30 | ALTA | ¿? | Análisis de imágenes, incompleto |
| MetaBrain/memory/ + *_py/ | 20 | MEDIA | ¿? | Memory layer, incompleto |
| MetaBrain/review/ + *_py/ | 35 | ALTA | ¿? | Human review layer, incompleto |
| MetaBrain/providers/ + *_py/ | 60 | ALTA | ¿? | Provider integration, incompleto |
| MetaBrain/production-safety/ + *_py/ | 35 | ALTA | ¿? | Safety gates, incompleto |
| MetaBrain/observability/ + *_py/ | 45 | MEDIA | ¿? | Metrics/logging, incompleto |

### GRUPO I: MEDICAL AGENDA NUEVOS (Untracked)
| Directorio | Archivos | Criticidad | ¿Commitear? | Razón |
|-----------|----------|-----------|-----------|-------|
| medical-agenda-saas/src/lib/medical-* | 50+ | MEDIA-ALTA | NO | Features médicas, no integradas aún |
| medical-agenda-saas/src/lib/doctor-context/ | 9 | MEDIA | NO | Doctor context, fase temprana |

### GRUPO J: BACKUPS/TEMPORALES (Untracked)
| Archivo | Criticidad | ¿Commitear? | Razón |
|---------|-----------|-----------|-------|
| api/app/main.py.backup_20260512_151754 | BAJA | NUNCA | Backup temporal, limpieza local |
| *.backup-before-* (2) | BAJA | NUNCA | Backups temporales |
| -Pattern (directorio) | BAJA | NUNCA | No estándar |

### GRUPO K: GENERATED/CACHE (Tracked Modified)
| Archivo | Criticidad | ¿Ignorar? | Razón |
|---------|-----------|-----------|-------|
| __pycache__/*.pyc (20+) | BAJA | SÍ | Generados, add a .gitignore |
| tsconfig.tsbuildinfo | BAJA | SÍ | Generado por TypeScript |
| npm-audit-*.json (2) | BAJA | SÍ | Reportes generados |

### GRUPO L: DATOS/PHI (Untracked - CRÍTICOS)
| Archivo | Contenido | Criticidad | Acción | Razón |
|---------|----------|-----------|--------|-------|
| test-import*.txt (4 archivos) | DESCONOCIDO | ALTA | REVISAR | Potencial PHI/datos reales |

---

## Matriz de Mezcla Peligrosa

| Característica | Detectado | Riesgo | Acción |
|---------------|----------|--------|--------|
| Runtime + Generated | SÍ | MEDIO | Separar .pyc/.tsbuildinfo a .gitignore |
| Runtime + Docs | SÍ | BAJO | Mantener separados en commits |
| Docker + Secrets | SÍ | MEDIA | Verificar .env no está tracked |
| MetaBrain Incompleto | SÍ | ALTO | NO COMMITEAR módulos médicos sin finalizar |
| Medical Agenda Incompleto | SÍ | ALTO | NO COMMITEAR features sin integración |

---

## Plan Seguro Recomendado

### COMMIT 1: Docker/Infrastructure (PRIORITY 1)
- docker-compose.yml
- docker/*.Dockerfile
- .env.example
- deploy_vps.ps1
- **RESTRICCIÓN:** Excluir REDIS_PASSWORD real

### COMMIT 2: Config/Security/Core (PRIORITY 2)
- api/app/core/config.py
- shared/security/secrets.py
- api/app/core/security.py
- api/app/exceptions/handlers.py

### COMMIT 3: API Endpoints/Services (PRIORITY 3)
- api/app/api/v1/endpoints/*.py (todos)
- api/app/dependencies/*.py
- api/app/services/*.py
- api/app/models/models.py

### COMMIT 4: Database/Migrations (PRIORITY 4)
- alembic/versions/*.py (4 nuevas)

### COMMIT 5: Tests (PRIORITY 5)
- api/tests/test_runtime_*.py (si pasan validación)

### NO COMMITEAR (PRIORITY 0)
- MetaBrain/* módulos nuevos (incompletos)
- medical-agenda-saas/* features nuevas (incompletos)
- *.md reportes (documentación local)
- test-import*.txt (auditar PHI primero)
- Backups (limpiar localmente)
- __pycache__/*.pyc (agregar a .gitignore)

---

## Estado Final: LISTO PARA PLAN DE COMMITS SELECTIVOS
Ver `SELECTIVE_COMMIT_ROADMAP.md` para orden y dependencias exactas.
