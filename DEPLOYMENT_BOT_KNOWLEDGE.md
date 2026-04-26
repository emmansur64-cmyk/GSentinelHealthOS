"""Instrucciones para deployment del Knowledge Base System - API Bot Learning."""

# ============ PASO 1: MIGRACIÓN ALEMBIC ============

# Desde la ruta del proyecto (e:\GSentinelHealthOS)

# 1.1 Generar migración automática
alembic revision --autogenerate -m "add bot_knowledge_base table with composite index"

# 1.2 Validar la migración generada (revisar alembic/versions/xxxxx_add_bot_knowledge_base.py)
# Asegúrate de que incluya:
# - Tabla "bot_knowledge_base"
# - Índice compuesto único: idx_doctor_pattern (doctor_id, pattern)

# 1.3 Aplicar migración a la BD
alembic upgrade head

# ============ PASO 2: VALIDAR ENDPOINT ============

# Una vez que el API esté corriendo en http://localhost:8000

# 2.1 Obtener token JWT (si usas autenticación local)
# Ejemplo: curl -X POST http://localhost:8000/api/v1/auth/token ...

# 2.2 Crear lección (POST /api/v1/admin/learn)
curl -X POST http://localhost:8000/api/v1/admin/learn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -d '{
    "pattern": "quiero turno urgente",
    "correct_action": "priorizar como urgencia / validar disponibilidad",
    "category": "intent"
  }'

# Respuesta esperada (201):
# {
#   "id": "550e8400-e29b-41d4-a716-446655440000",
#   "pattern": "quiero turno urgente",
#   "correct_action": "priorizar como urgencia / validar disponibilidad",
#   "category": "intent",
#   "doctor_id": "550e8400-e29b-41d4-a716-446655440001",
#   "created_at": "2026-04-01T15:30:00+00:00"
# }

# 2.3 Listar lecciones propias (GET /api/v1/admin/learn)
curl -X GET "http://localhost:8000/api/v1/admin/learn?skip=0&limit=10" \
  -H "Authorization: Bearer TU_TOKEN_JWT"

# 2.4 Filtrar por categoría (GET /api/v1/admin/learn?category=intent)
curl -X GET "http://localhost:8000/api/v1/admin/learn?category=intent" \
  -H "Authorization: Bearer TU_TOKEN_JWT"

# 2.5 Obtener estadísticas (GET /api/v1/admin/learn/stats/summary)
curl -X GET "http://localhost:8000/api/v1/admin/learn/stats/summary" \
  -H "Authorization: Bearer TU_TOKEN_JWT"

# 2.6 Actualizar lección (PUT /api/v1/admin/learn/{lesson_id})
curl -X PUT "http://localhost:8000/api/v1/admin/learn/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -d '{
    "correct_action": "nueva acción mejorada",
    "category": "flow"
  }'

# 2.7 Eliminar lección (DELETE /api/v1/admin/learn/{lesson_id})
curl -X DELETE "http://localhost:8000/api/v1/admin/learn/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer TU_TOKEN_JWT"

# ============ PASO 3: VALIDACIÓN DE SEGURIDAD ============

# 3.1 Verificar que solo doctors/admins pueden acceder
# - Sin token JWT → 401 Unauthorized
# - Con role != doctor/admin → 403 Forbidden

# 3.2 Verificar que cada doctor solo ve sus propias lecciones
# - Doctor A no podría ver lecciones de Doctor B
# - El doctor_id se extrae del usuario autenticado (no del payload)

# 3.3 Probar deduplicación (mismo doctor + patrón normalizado)
# - Primer POST: sucede
# - Segundo POST idéntico: → 409 Conflict

# 3.4 Probar validación de longitud
# - pattern > 200 caracteres: rechazo en Pydantic
# - correct_action > 500 caracteres: rechazo en Pydantic

# ============ PASO 4: MONITOREO ============

# 4.1 Logs de aplicación
# - Busca "[api]" y "knowledge.py" para debug

# 4.2 Queries SQL (si el API tiene echo=True en SQLAlchemy)
# - Verifica que se use el índice idx_doctor_pattern en SELECT/WHERE

# ============ ESTRUCTURA FINAL EN BD ============

# Tabla: bot_knowledge_base
# Columnas:
#   - id (UUID, PK)
#   - pattern (VARCHAR(200), INDEX, UNIQUE con doctor_id)
#   - correct_action (VARCHAR(500))
#   - category (VARCHAR(50))
#   - doctor_id (UUID, FK → doctors.id, INDEX)
#   - created_at (TIMESTAMP con timezone)
#   - updated_at (TIMESTAMP con timezone)
#
# Índices:
#   - idx_doctor_pattern (UNIQUE(doctor_id, pattern))
#   - idx_pattern (patrón solo, para search)
#   - FK a doctors(id)

# ============ ENDPOINTS SUMMARY ============

# POST   /api/v1/admin/learn              - Crear lección
# GET    /api/v1/admin/learn              - Listar lecciones (con filtros)
# GET    /api/v1/admin/learn/{id}         - Obtener lección por ID
# PUT    /api/v1/admin/learn/{id}         - Actualizar lección
# DELETE /api/v1/admin/learn/{id}         - Eliminar lección
# GET    /api/v1/admin/learn/stats/summary - Estadísticas

print("✓ Documentación de deployment completada")
