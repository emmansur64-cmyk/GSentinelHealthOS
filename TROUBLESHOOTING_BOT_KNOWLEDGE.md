"""
TROUBLESHOOTING: Bot Knowledge Base System

Soluciones para problemas comunes durante deployment y operación.

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "ModuleNotFoundError: No module named 'api.app.api.v1.endpoints.knowledge'"

Causa: El archivo knowledge.py no está siendo importado correctamente en main.py

Solución:
  1. Verifica que exista: api/app/api/v1/endpoints/knowledge.py
  2. Verifica que main.py tenga:
     from api.app.api.v1.endpoints import ... knowledge ...
  3. Verifica que no haya __pycache__ viejo:
     rmdir /s /q api\app\api\v1\endpoints\__pycache__
  4. Reinicia el API

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "alembic revision --autogenerate" no genera las columnas

Causa: Los modelos no están siendo importados en alembic/env.py

Solución:
  1. Abre: alembic/env.py
  2. Busca: from api.app.models import Base
  3. Asegúrate de que Base está importado
  4. Verifica que BotLesson esté en: api/app/models/__init__.py (__all__)
  5. Reintentar: alembic revision --autogenerate -m "add bot_knowledge_base"

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "sqlalchemy.exc.IntegrityError: duplicate key value violates unique constraint"

Causa: Intento de insertar patrón duplicado para el mismo doctor

Solución (en app):
  - El error esperado es 409 Conflict
  - Si ves IntegrityError directamente, verifica que la validación de app
    esté antes de db.add()

Solución (en BD):
  - Si ya hay duplicados:
    DELETE FROM bot_knowledge_base WHERE id IN (
      SELECT id FROM bot_knowledge_base
      WHERE (doctor_id, pattern) IN (
        SELECT doctor_id, pattern FROM bot_knowledge_base
        GROUP BY doctor_id, pattern HAVING COUNT(*) > 1
      ) AND id NOT IN (
        SELECT MAX(id) FROM bot_knowledge_base
        GROUP BY doctor_id, pattern
      )
    );

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "401 Unauthorized - missing_bearer_token"

Solución:
  1. Obtén un token JWT válido primero:
     POST /api/v1/auth/token
     Username: tu_usuario_doctor
     Password: tu_contraseña
     
  2. Copia el access_token de la respuesta
  
  3. Usa en headers:
     Authorization: Bearer <access_token_aquí>
     
  4. Verifica que el token no esté expirado (default: 24h)
     - Si expiró, obtén uno nuevo

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "403 Forbidden - No tienes permisos suficientes"

Causa: Tu usuario no tiene rol doctor/admin

Solución:
  1. Verifica tu rol en la BD:
     SELECT username, role FROM users WHERE username = 'tu_usuario'
     
  2. Si el rol es 'receptionist', contacta admin para cambiar a 'doctor'
  
  3. Si no tienes doctor_id asociado:
     UPDATE users SET doctor_id = 'doctor_uuid_válido' WHERE id = 'tu_id'

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "422 Unprocessable Entity - pattern too short"

Solución:
  - pattern mínimo: 3 caracteres
  - Asegúrate de que no sea solo espacios
  - Ejemplo válido: "ayuda" (5 caracteres)
  - Ejemplo inválido: "a" (1 carácter)

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "422 Unprocessable Entity - invalid_category"

Solución:
  - category debe ser uno de: "intent", "entity", "tone", "flow"
  - En PowerShell, asegúrate de escapar comillas correctamente
  - Válido: "intent" (minúsculas)
  - Inválido: "Intent", "INTENT", "unknown"

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "404 Not Found - Lección no encontrada o no tienes acceso"

Causa 1: El UUID es incorrecto
  Solución: Obtén el UUID exacto con GET /admin/learn

Causa 2: La lección pertenece a otro doctor
  Solución: Solo puedes acceder a tus propias lecciones
  Verifica que el doctor_id en la respuesta corresponda a tu usuario

═══════════════════════════════════════════════════════════════════════════════

❌ ERROR: "409 Conflict - Ya existe una lección con este patrón"

Solución:
  1. Opción A: Usa otro patrón (más específico o diferente)
  
  2. Opción B: Actualiza la lección existente:
     - GET /admin/learn (busca el patrón existente)
     - PUT /admin/learn/{id} con nueva acción/categoría
     
  3. El patrón se normaliza (lowercase + trim):
     "Quiero turno" → "quiero turno"
     "  help  " → "help"
     Si ambos normalizados son iguales, es duplicado

═══════════════════════════════════════════════════════════════════════════════

⚠️  PERFORMANCE ISSUES

Problema: Queries lentas en GET /admin/learn
  
Solución:
  1. Verifica índices:
     SELECT * FROM pg_indexes WHERE tablename = 'bot_knowledge_base'
     
  2. Si idx_doctor_pattern es UNIQUE pero falta:
     CREATE UNIQUE INDEX idx_doctor_pattern 
     ON bot_knowledge_base(doctor_id, pattern)
     
  3. Análisis de query (con EXPLAIN PLAN):
     EXPLAIN ANALYZE
     SELECT * FROM bot_knowledge_base 
     WHERE doctor_id = 'tu_doctor_id'
     ORDER BY created_at DESC

Problema: Timeout en POST (> 10 segundos)
  
Solución:
  1. Verifica que PostgreSQL esté activo:
     psql -U user -h localhost -d gsentinel_db -c "SELECT 1"
     
  2. Verifica conexión a pool:
     SELECT COUNT(*) FROM pg_stat_activity 
     WHERE datname = 'gsentinel_db'
     
  3. Considera aumentar pool_size en config:
     echo "pool_size=20" >> api/.env

═══════════════════════════════════════════════════════════════════════════════

🔍 DEBUGGING

Habilitar logs detallados:

1. En main.py, configura SQLAlchemy echo:
   engine = create_async_engine(
       DATABASE_URL,
       echo=True,  # Muestra todas las queries SQL
       ...
   )

2. En knowledge.py, agrega logs:
   import logging
   logger = logging.getLogger(__name__)
   
   # En cada endpoint:
   logger.debug(f"POST /admin/learn: user={user.user_id}, pattern='{payload.pattern}'")

3. Ejecuta con DEBUG=1:
   export DEBUG=1
   python scripts/run_api_server.py

═══════════════════════════════════════════════════════════════════════════════

🧪 VALIDACIÓN DE BD

Verifica integridad:

-- 1. Contar registros
SELECT COUNT(*) as total_lessons FROM bot_knowledge_base;

-- 2. Distribución por doctor
SELECT doctor_id, COUNT(*) FROM bot_knowledge_base GROUP BY doctor_id;

-- 3. Buscar duplicados (no debería haber)
SELECT doctor_id, pattern, COUNT(*) 
FROM bot_knowledge_base 
GROUP BY doctor_id, pattern 
HAVING COUNT(*) > 1;

-- 4. Verificar FKs
SELECT COUNT(*) FROM bot_knowledge_base b
WHERE NOT EXISTS (SELECT 1 FROM doctors d WHERE d.id = b.doctor_id);

-- 5. Timestamps válidos
SELECT COUNT(*) FROM bot_knowledge_base 
WHERE created_at > NOW() OR updated_at > NOW();

═══════════════════════════════════════════════════════════════════════════════

🔄 RESETEO COMPLETO (Desarrollo)

Si algo sale muy mal:

1. Drop de tabla (⚠️ DESTRUYE DATOS):
   DROP TABLE IF EXISTS bot_knowledge_base CASCADE;

2. Regenerar migración:
   rm alembic/versions/*add_bot_knowledge_base*
   alembic revision --autogenerate -m "recreate bot_knowledge_base"

3. Aplicar:
   alembic upgrade head

4. Reiniciar tests:
   python scripts/test_bot_knowledge_base.py

═══════════════════════════════════════════════════════════════════════════════

📞 DIAGNOSTICO RÁPIDO

Ejecuta este script para validación rápida:

import asyncio
from api.app.db.session import async_session_local
from api.app.models import BotLesson

async def diagnose():
    async with async_session_local() as session:
        try:
            result = await session.execute("SELECT 1")
            print("✓ Conexión a BD OK")
        except Exception as e:
            print(f"✗ Conexión a BD FALLA: {e}")
            return
        
        from sqlalchemy import inspect
        inspector = inspect(BotLesson)
        print(f"✓ Modelo BotLesson loaded: {len(inspector.columns)} columnas")
        
        from sqlalchemy import text
        try:
            result = await session.execute(text("SELECT COUNT(*) FROM bot_knowledge_base"))
            count = result.scalar()
            print(f"✓ Tabla existe con {count} registros")
        except Exception as e:
            print(f"✗ Tabla no existe: {e}")

asyncio.run(diagnose())

═══════════════════════════════════════════════════════════════════════════════
"""

print("✓ Troubleshooting guide ready")
