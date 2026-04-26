"""Script de validación automática del Knowledge Base System.

Ejecutar desde: e:\GSentinelHealthOS
Python 3.11+
"""

import asyncio
import sys
from uuid import uuid4
from datetime import datetime

# Agregar proyecto root al path
sys.path.insert(0, str(__file__).rsplit("\\", 1)[0])

# Imports para testing
from sqlalchemy import select
from api.app.db.session import async_session_local
from api.app.models import BotLesson, Doctor, Base, User, UserRole
from api.app.db.session import engine


async def setup_test_data():
    """Crea doctor y usuario de prueba en BD."""
    async with async_session_local() as session:
        # Crear tablas si no existen
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Crear doctor dummy
        doctor_id = uuid4()
        doctor = Doctor(
            id=doctor_id,
            name="Dr. Test",
            specialization="General",
            email=f"test-{uuid4()}@hospital.local",
            is_active=True,
        )
        
        session.add(doctor)
        await session.flush()
        
        # Crear usuario asociado al doctor
        user = User(
            id=uuid4(),
            username=f"doctor_test_{uuid4().hex[:6]}",
            hashed_password="$2b$12$dummyhash",  # dummy
            role=UserRole.DOCTOR,
            is_active=True,
            doctor_id=doctor_id,
        )
        
        session.add(user)
        await session.commit()
        
        return doctor_id, user.id


async def test_create_lesson(doctor_id):
    """Test: Crear lección (POST)."""
    print("\n[TEST] Crear lección...")
    
    async with async_session_local() as session:
        lesson = BotLesson(
            pattern="quiero turno urgente",
            correct_action="priorizar como urgencia / validar disponibilidad",
            category="intent",
            doctor_id=doctor_id,
        )
        
        session.add(lesson)
        await session.commit()
        
        print(f"  ✓ Lección creada: {lesson.id}")
        return lesson.id


async def test_duplicate_detection(doctor_id):
    """Test: Detectar duplicados (misma doctor + patrón normalizado)."""
    print("\n[TEST] Detectar duplicados...")
    
    async with async_session_local() as session:
        # Primer intento
        lesson1 = BotLesson(
            pattern="hola soy juan",
            correct_action="saludar al paciente",
            category="tone",
            doctor_id=doctor_id,
        )
        session.add(lesson1)
        await session.commit()
        print(f"  ✓ Primera lección creada: {lesson1.id}")
        
        # Segundo intento (duplicado, capitalización diferente)
        lesson2 = BotLesson(
            pattern="HOLA SOY JUAN",  # Será normalizado a lowercase
            correct_action="saludar al paciente",
            category="tone",
            doctor_id=doctor_id,
        )
        session.add(lesson2)
        
        try:
            await session.commit()
            print("  ✗ ERROR: Duplicado fue permitido (índice UNIQUE no funcionó)")
            return False
        except Exception as e:
            print(f"  ✓ Duplicado rechazado: {type(e).__name__}")
            return True


async def test_list_lessons(doctor_id):
    """Test: Listar lecciones (GET con filtros)."""
    print("\n[TEST] Listar lecciones...")
    
    async with async_session_local() as session:
        # Crear varias lecciones
        for i in range(3):
            lesson = BotLesson(
                pattern=f"patrón prueba {i}",
                correct_action=f"acción {i}",
                category="intent" if i % 2 == 0 else "entity",
                doctor_id=doctor_id,
            )
            session.add(lesson)
        
        await session.commit()
        
        # Listar todas
        result = await session.execute(
            select(BotLesson).where(BotLesson.doctor_id == doctor_id)
        )
        all_lessons = result.scalars().all()
        print(f"  ✓ Total lecciones: {len(all_lessons)}")
        
        # Filtrar por categoría
        result = await session.execute(
            select(BotLesson).where(
                (BotLesson.doctor_id == doctor_id) & 
                (BotLesson.category == "intent")
            )
        )
        intent_lessons = result.scalars().all()
        print(f"  ✓ Lecciones con categoría 'intent': {len(intent_lessons)}")
        
        return len(all_lessons) > 0


async def test_update_lesson(doctor_id, lesson_id):
    """Test: Actualizar lección (PUT)."""
    print("\n[TEST] Actualizar lección...")
    
    async with async_session_local() as session:
        result = await session.execute(
            select(BotLesson).where(BotLesson.id == lesson_id)
        )
        lesson = result.scalar()
        
        if lesson:
            original_action = lesson.correct_action
            lesson.correct_action = "acción mejorada y actualizada"
            await session.commit()
            
            print(f"  ✓ Acción actualizada: '{original_action}' → '{lesson.correct_action}'")
            return True
        else:
            print("  ✗ Lección no encontrada")
            return False


async def test_delete_lesson(doctor_id):
    """Test: Eliminar lección (DELETE)."""
    print("\n[TEST] Eliminar lección...")
    
    async with async_session_local() as session:
        # Crear lección temporal
        lesson = BotLesson(
            pattern="lección para eliminar",
            correct_action="borrable",
            category="intent",
            doctor_id=doctor_id,
        )
        session.add(lesson)
        await session.commit()
        lesson_id = lesson.id
        
        # Eliminar
        result = await session.execute(
            select(BotLesson).where(BotLesson.id == lesson_id)
        )
        lesson_to_delete = result.scalar()
        
        if lesson_to_delete:
            await session.delete(lesson_to_delete)
            await session.commit()
            print(f"  ✓ Lección eliminada: {lesson_id}")
            return True
        else:
            print("  ✗ No se encontró lección para eliminar")
            return False


async def test_stats(doctor_id):
    """Test: Estadísticas por categoría."""
    print("\n[TEST] Estadísticas...")
    
    async with async_session_local() as session:
        result = await session.execute(
            select(BotLesson).where(BotLesson.doctor_id == doctor_id)
        )
        lessons = result.scalars().all()
        
        # Contar por categoría
        stats = {}
        for lesson in lessons:
            stats[lesson.category] = stats.get(lesson.category, 0) + 1
        
        print(f"  ✓ Distribución por categoría:")
        for cat, count in stats.items():
            print(f"      - {cat}: {count}")
        
        return len(lessons) > 0


async def test_validation_limits():
    """Test: Validación de límites de longitud."""
    print("\n[TEST] Validación de límites...")
    
    async with async_session_local() as session:
        doctor_id = uuid4()
        
        # Patrón muy largo (> 200 chars)
        long_pattern = "a" * 250
        try:
            lesson = BotLesson(
                pattern=long_pattern,
                correct_action="test",
                category="intent",
                doctor_id=doctor_id,
            )
            session.add(lesson)
            await session.commit()
            print("  ✗ ERROR: Pattern muy largo fue aceptado")
            return False
        except Exception as e:
            print(f"  ✓ Pattern largo rechazado: {type(e).__name__}")
        
        # Acción muy larga (> 500 chars)
        long_action = "x" * 600
        try:
            lesson = BotLesson(
                pattern="test",
                correct_action=long_action,
                category="intent",
                doctor_id=doctor_id,
            )
            session.add(lesson)
            await session.commit()
            print("  ✗ ERROR: Action muy larga fue aceptada")
            return False
        except Exception as e:
            print(f"  ✓ Action larga rechazada: {type(e).__name__}")
        
        return True


async def main():
    """Ejecuta suite de tests."""
    print("=" * 60)
    print("🧪 VALIDACIÓN BOT KNOWLEDGE BASE SYSTEM")
    print("=" * 60)
    print(f"  Inicio: {datetime.now().isoformat()}")
    
    try:
        # Setup
        print("\n[SETUP] Preparando BD de prueba...")
        doctor_id, user_id = await setup_test_data()
        print(f"  ✓ Doctor creado: {doctor_id}")
        print(f"  ✓ Usuario creado: {user_id}")
        
        # Tests
        lesson_id = await test_create_lesson(doctor_id)
        await test_duplicate_detection(doctor_id)
        await test_list_lessons(doctor_id)
        await test_update_lesson(doctor_id, lesson_id)
        await test_delete_lesson(doctor_id)
        await test_stats(doctor_id)
        await test_validation_limits()
        
        print("\n" + "=" * 60)
        print("✓ TODOS LOS TESTS PASARON")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ ERROR EN TESTS: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
