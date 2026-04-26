"""
API REFERENCE: Bot Knowledge Base System
FastAPI + SQLAlchemy Async

BASE URL: http://localhost:8000/api/v1

AUTENTICACIÓN: Bearer Token (JWT)
  Header: Authorization: Bearer <token>
  Token obtenido en: POST /api/v1/auth/token

═══════════════════════════════════════════════════════════════════════════════

📝 POST /admin/learn - Crear Lección

Description: Enseña al bot un nuevo patrón de comportamiento
Authentication: Required (doctor/admin role)
Status Code: 201 Created | 409 Conflict (duplicado) | 401 Unauthorized

Request Body:
{
  "pattern": "quiero turno urgente",
  "correct_action": "priorizar como urgencia",
  "category": "intent"
}

Request Validation:
  ✓ pattern: string, 3-200 chars, lowercase+trimmed
  ✓ correct_action: string, 1-500 chars
  ✓ category: enum("intent", "entity", "tone", "flow")

Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "pattern": "quiero turno urgente",
  "correct_action": "priorizar como urgencia",
  "category": "intent",
  "doctor_id": "550e8400-e29b-41d4-a716-446655440001",
  "created_at": "2026-04-01T15:30:00+00:00"
}

Error Response (409):
{
  "detail": "Ya existe una lección con este patrón para tu usuario"
}

Example cURL:
curl -X POST http://localhost:8000/api/v1/admin/learn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAi..." \
  -d '{
    "pattern": "quiero turno urgente",
    "correct_action": "priorizar como urgencia",
    "category": "intent"
  }'

═══════════════════════════════════════════════════════════════════════════════

📖 GET /admin/learn - Listar Lecciones

Description: Obtiene todas tus lecciones con filtros opcionales
Authentication: Required (doctor/admin role)
Status Code: 200 OK | 401 Unauthorized

Query Parameters:
  ?skip=0              # Offset para paginación (default: 0)
  ?limit=50            # Número de resultados (default: 50, max: 100)
  ?category=intent     # Filtrar por categoría (optional)

Response (200):
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "pattern": "quiero turno urgente",
    "correct_action": "priorizar como urgencia",
    "category": "intent",
    "doctor_id": "550e8400-e29b-41d4-a716-446655440001",
    "created_at": "2026-04-01T15:30:00+00:00",
    "updated_at": "2026-04-01T15:31:00+00:00"
  },
  ...
]

Example cURL:
# Listar todas (con paginación)
curl -X GET "http://localhost:8000/api/v1/admin/learn?skip=0&limit=20" \
  -H "Authorization: Bearer eyJ0eXAi..."

# Filtrar por categoría
curl -X GET "http://localhost:8000/api/v1/admin/learn?category=intent" \
  -H "Authorization: Bearer eyJ0eXAi..."

═══════════════════════════════════════════════════════════════════════════════

🔍 GET /admin/learn/{lesson_id} - Obtener Lección por ID

Description: Obtiene detalles de una lección específica
Authentication: Required (doctor/admin role)
Status Code: 200 OK | 404 Not Found | 401 Unauthorized

Path Parameters:
  lesson_id: UUID      # ID de la lección (ej: 550e8400-e29b-41d4-a716-446655440000)

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "pattern": "quiero turno urgente",
  "correct_action": "priorizar como urgencia",
  "category": "intent",
  "doctor_id": "550e8400-e29b-41d4-a716-446655440001",
  "created_at": "2026-04-01T15:30:00+00:00",
  "updated_at": "2026-04-01T15:30:00+00:00"
}

Error Response (404):
{
  "detail": "Lección no encontrada o no tienes acceso"
}

Example cURL:
curl -X GET "http://localhost:8000/api/v1/admin/learn/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJ0eXAi..."

═══════════════════════════════════════════════════════════════════════════════

✏️  PUT /admin/learn/{lesson_id} - Actualizar Lección

Description: Actualiza la acción correcta o categoría de una lección
Note: El pattern NO es modificable (es la clave de aprendizaje)
Authentication: Required (doctor/admin role)
Status Code: 200 OK | 404 Not Found | 401 Unauthorized

Path Parameters:
  lesson_id: UUID      # ID de la lección

Request Body (todos los campos opcionales):
{
  "correct_action": "acción mejorada",
  "category": "flow"
}

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "pattern": "quiero turno urgente",
  "correct_action": "acción mejorada",
  "category": "flow",
  "doctor_id": "550e8400-e29b-41d4-a716-446655440001",
  "created_at": "2026-04-01T15:30:00+00:00",
  "updated_at": "2026-04-01T15:35:20+00:00"
}

Example cURL:
curl -X PUT "http://localhost:8000/api/v1/admin/learn/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAi..." \
  -d '{
    "correct_action": "acción mejorada",
    "category": "flow"
  }'

═══════════════════════════════════════════════════════════════════════════════

🗑️  DELETE /admin/learn/{lesson_id} - Eliminar Lección

Description: Elimina una lección permanentemente
Authentication: Required (doctor/admin role)
Status Code: 204 No Content | 404 Not Found | 401 Unauthorized

Path Parameters:
  lesson_id: UUID      # ID de la lección

Response (204): No body

Example cURL:
curl -X DELETE "http://localhost:8000/api/v1/admin/learn/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJ0eXAi..."

═══════════════════════════════════════════════════════════════════════════════

📊 GET /admin/learn/stats/summary - Estadísticas de Aprendizaje

Description: Retorna estadísticas de tus lecciones por categoría
Authentication: Required (doctor/admin role)
Status Code: 200 OK | 401 Unauthorized

Response (200):
{
  "total_lessons": 45,
  "by_category": {
    "intent": 20,
    "entity": 15,
    "tone": 8,
    "flow": 2
  },
  "doctor_id": "550e8400-e29b-41d4-a716-446655440001"
}

Example cURL:
curl -X GET "http://localhost:8000/api/v1/admin/learn/stats/summary" \
  -H "Authorization: Bearer eyJ0eXAi..."

═══════════════════════════════════════════════════════════════════════════════

🔐 CÓDIGOS DE ERROR COMUNES:

401 Unauthorized
  - Falta Authorization header
  - Token expirado o inválido
  - Solución: Obtén nuevo token en /api/v1/auth/token

403 Forbidden
  - Usuario no tiene rol requerido (necesita doctor/admin)
  - Usuario no tiene doctor_id asociado
  - Solución: Verifica tu rol y asociación con doctor

404 Not Found
  - Lección no existe
  - Lección pertenece a otro doctor
  - Solución: Verifica el lesson_id en tu lista

409 Conflict
  - Ya existe una lección con el mismo patrón
  - El patrón se normaliza (lowercase, trimmed)
  - Solución: Modifica el patrón o actualiza la lección existente

422 Unprocessable Entity
  - Validación fallida en Pydantic
  - pattern < 3 o > 200 caracteres
  - correct_action > 500 caracteres
  - category no es uno de: intent, entity, tone, flow
  - Respuesta incluye detalles en "detail"

═══════════════════════════════════════════════════════════════════════════════

💡 EJEMPLOS DE FLUJO COMPLETO:

1. CREAR Y LISTAR:

# Crear lección
curl -X POST http://localhost:8000/api/v1/admin/learn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"pattern":"hola","correct_action":"saludar","category":"tone"}'

# Listar todas
curl -X GET http://localhost:8000/api/v1/admin/learn \
  -H "Authorization: Bearer $TOKEN"


2. ACTUALIZAR CON FEEDBACK:

# Si el doctor ajusta una lección
curl -X PUT http://localhost:8000/api/v1/admin/learn/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"correct_action":"acción refinada basada en feedback"}'


3. ANÁLISIS DE PROGRESO:

# Ver estadísticas
curl -X GET http://localhost:8000/api/v1/admin/learn/stats/summary \
  -H "Authorization: Bearer $TOKEN"

# Filtrar lecciones recientes
curl -X GET "http://localhost:8000/api/v1/admin/learn?skip=0&limit=5" \
  -H "Authorization: Bearer $TOKEN"

═══════════════════════════════════════════════════════════════════════════════

🚀 TIPS DE INTEGRACIÓN:

TypeScript/React:
  const response = await fetch('http://localhost:8000/api/v1/admin/learn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      pattern: 'quiero turno',
      correct_action: 'priorizar',
      category: 'intent'
    })
  })

Python/FastAPI Client:
  from httpx import AsyncClient
  async with AsyncClient() as client:
    response = await client.post(
      'http://localhost:8000/api/v1/admin/learn',
      json={...},
      headers={'Authorization': f'Bearer {token}'}
    )

JavaScript/Fetch:
  const response = await fetch('http://localhost:8000/api/v1/admin/learn', {
    method: 'GET',
    headers: {'Authorization': `Bearer ${token}`},
    params: { category: 'intent', limit: 20 }
  })

═══════════════════════════════════════════════════════════════════════════════
"""

print("✓ API Reference ready")
