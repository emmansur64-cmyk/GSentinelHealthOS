"""PowerShell script para deployment del Bot Knowledge Base System."""

# Rooted at: e:\GSentinelHealthOS

$ProgressPreference = "SilentlyContinue"
$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════"
    Write-Host "  $Text"
    Write-Host "═══════════════════════════════════════════════════════════════"
}

function Write-Success {
    param([string]$Text)
    Write-Host "  ✓ $Text" -ForegroundColor Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "  ✗ $Text" -ForegroundColor Red
}

Write-Header "🧠 BOT KNOWLEDGE BASE DEPLOYMENT"

# Paso 0: Pre-validaciones
Write-Host "`n[0] Pre-validaciones..."

if (-not (Test-Path ".\alembic.ini")) {
    Write-Error "alembic.ini no encontrado"
    exit 1
}
Write-Success "alembic.ini existe"

if (-not (Test-Path ".\api\app\models\models.py")) {
    Write-Error "Modelos no encontrados"
    exit 1
}
Write-Success "Modelos validados"

if (-not (Test-Path ".\api\app\api\v1\endpoints\knowledge.py")) {
    Write-Error "Endpoints no creados"
    exit 1
}
Write-Success "Endpoints validados"

# Paso 1: Alembic migration
Write-Header "PASO 1: GENERAR MIGRACIÓN ALEMBIC"

Write-Host "`n  Ejecutando: alembic revision --autogenerate -m 'add bot_knowledge_base'"
try {
    & python -m alembic revision --autogenerate -m "add bot_knowledge_base table with composite index"
    Write-Success "Migración generada"
} catch {
    Write-Error "Error en generación de migración: $_"
    exit 1
}

# Paso 2: Mostrar el archivo de migración
Write-Host "`n  Buscando archivo de migración...`n"
$migration_file = Get-ChildItem "alembic/versions" -Filter "*add_bot_knowledge_base*" | Select-Object -Last 1

if ($migration_file) {
    Write-Success "Archivo: $($migration_file.Name)"
    Write-Host "`n  📋 REVISA MANUALMENTE:"
    Write-Host "     - Tabla 'bot_knowledge_base' creada"
    Write-Host "     - Índice idx_doctor_pattern UNIQUE"
    Write-Host "     - FK doctor_id → doctors.id"
    Write-Host ""
    Write-Host "  Contenido resumido:"
    $content = Get-Content $migration_file.FullName | Select-String -Pattern "(CreateTable|Index|ForeignKey)" | Select-Object -First 10
    $content | ForEach-Object { Write-Host "     $_" }
} else {
    Write-Error "No se encontró archivo de migración"
    exit 1
}

Write-Host "`n  ⚠️  Presiona ENTER para aplicar la migración a la BD..."
Read-Host

# Paso 3: Apply migration
Write-Header "PASO 3: APLICAR MIGRACIÓN A BD"

Write-Host "`n  Ejecutando: alembic upgrade head"
try {
    & python -m alembic upgrade head
    Write-Success "Migración aplicada a la BD"
} catch {
    Write-Error "Error al aplicar migración: $_"
    Write-Host "  Nota: Verifica que PostgreSQL esté corriendo"
    exit 1
}

# Paso 4: Validación de BD
Write-Header "PASO 4: VALIDACIÓN DE BD"

$test_script = @"
import asyncio
import sys
sys.path.insert(0, '.')

from api.app.db.session import engine, async_session_local
from api.app.models import BotLesson
from sqlalchemy import inspect

async def validate():
    async with engine.connect() as conn:
        inspector = inspect(conn.sync_connection)
        tables = inspector.get_table_names()
        
        if 'bot_knowledge_base' not in tables:
            print('[ERROR] Tabla bot_knowledge_base no encontrada')
            return False
        
        print('[✓] Tabla bot_knowledge_base existe')
        
        # Check índices
        indexes = inspector.get_indexes('bot_knowledge_base')
        index_names = [idx.get('name') for idx in indexes]
        
        if 'idx_doctor_pattern' in index_names:
            print('[✓] Índice idx_doctor_pattern existe')
        else:
            print('[WARN] Índice idx_doctor_pattern no encontrado')
        
        # Check columnas
        columns = [col['name'] for col in inspector.get_columns('bot_knowledge_base')]
        required = ['id', 'pattern', 'correct_action', 'category', 'doctor_id', 'created_at', 'updated_at']
        
        for col in required:
            if col in columns:
                print(f'[✓] Columna {col} existe')
            else:
                print(f'[ERROR] Columna {col} NO EXISTE')
                return False
        
        return True

result = asyncio.run(validate())
sys.exit(0 if result else 1)
"@

Write-Host "`n  Validando estructura de BD..."
$test_script | & python -c (Get-Content -Raw)

if ($LASTEXITCODE -eq 0) {
    Write-Success "BD validada correctamente"
} else {
    Write-Error "Validación de BD falló"
    exit 1
}

# Paso 5: Test suite
Write-Header "PASO 5: EJECUTAR TEST SUITE"

Write-Host "`n  Ejecutando: python scripts/test_bot_knowledge_base.py`n"
try {
    & python scripts/test_bot_knowledge_base.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Todos los tests pasaron ✓"
    } else {
        Write-Error "Algunos tests fallaron"
        exit 1
    }
} catch {
    Write-Error "Error ejecutando tests: $_"
    exit 1
}

# Final
Write-Header "✅ DEPLOYMENT COMPLETADO"

Write-Host "`n  Referencias:"
Write-Host "  📖 DEPLOYMENT_BOT_KNOWLEDGE.md - Ejemplos de endpoints"
Write-Host "  📋 BOT_KNOWLEDGE_BASE_IMPLEMENTATION.txt - Resumen técnico"
Write-Host "  🧪 scripts/test_bot_knowledge_base.py - Suite de tests"
Write-Host ""
Write-Host "  Próximos pasos:"
Write-Host "  1. Inicia el API: python scripts/run_api_server.py"
Write-Host "  2. Prueба endpoints con cURL (ver DEPLOYMENT_BOT_KNOWLEDGE.md)"
Write-Host "  3. Verifica logs en [api] knowledge.py"
Write-Host ""
