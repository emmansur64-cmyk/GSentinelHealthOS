"""
EJEMPLO DE INTEGRACIÓN: Bot Knowledge Base + NLU Engine

Muestra cómo usar la versión mejorada del NLU Engine con búsqueda
inteligente, caching y scoring de confianza.

Ubicación: brain/examples/knowledge_base_integration_example.py
"""

import asyncio
from uuid import uuid4
from datetime import datetime
from typing import Optional

# Imports
from brain.interpreters.nlu_engine import NLUEngine, KnowledgeMatcher, CachedLesson
from brain.services.knowledge_base_client import KnowledgeBaseClient


async def example_1_fuzzy_matching():
    """
    Ejemplo 1: Búsqueda de similaridad (fuzzy matching) en patrones enseñados.
    """
    print("\n" + "="*70)
    print("EJEMPLO 1: Fuzzy Matching de Patrones")
    print("="*70)
    
    # Simular lecciones enseñadas por un doctor
    doctor_id = str(uuid4())
    lessons = [
        CachedLesson(
            id=str(uuid4()),
            pattern="quiero turno urgente",
            correct_action="priorizar como urgencia",
            category="intent",
            doctor_id=doctor_id,
        ),
        CachedLesson(
            id=str(uuid4()),
            pattern="necesito cita con pediatra",
            correct_action="buscar pediatra disponible",
            category="intent",
            doctor_id=doctor_id,
        ),
        CachedLesson(
            id=str(uuid4()),
            pattern="tengo dolor o fiebre",
            correct_action="consultar por emergencia",
            category="tone",
            doctor_id=doctor_id,
        ),
    ]
    
    # Inputs del usuario
    test_inputs = [
        "quiero turno urgente",        # Exacto
        "quiero turno urgente pls",    # Muy similar
        "necesito cita con pediatra",  # Exacto
        "necesito cita con dermato",   # Similar pero no match
        "tengo fiebre",                # Partial match
    ]
    
    print("\nPatrones enseñados por el doctor:")
    for i, lesson in enumerate(lessons, 1):
        print(f"  {i}. '{lesson.pattern}' → {lesson.correct_action}")
    
    print("\nBúsquedas de usuario:")
    for user_input in test_inputs:
        match = KnowledgeMatcher.find_best_match(user_input, lessons)
        
        if match:
            status = "✓ EXACTO" if match.is_exact else "~ FUZZY"
            print(f"\n  Input: '{user_input}'")
            print(f"  {status} en '{match.pattern}' ({match.similarity:.2%})")
            print(f"  Acción: {match.action}")
            print(f"  Categoría: {match.category}")
        else:
            print(f"\n  Input: '{user_input}'")
            print(f"  ✗ Sin match")


async def example_2_caching():
    """
    Ejemplo 2: Sistemas de caché con TTL para lecciones.
    """
    print("\n" + "="*70)
    print("EJEMPLO 2: Caching con TTL")
    print("="*70)
    
    doctor_id = str(uuid4())
    lessons = [
        CachedLesson(
            id=str(uuid4()),
            pattern="test",
            correct_action="test action",
            category="intent",
            doctor_id=doctor_id,
        ),
    ]
    
    cache = NLUEngine._lesson_cache
    
    # Primer acceso: no en cache
    print("\n1. Primer acceso (no en cache)")
    result = cache.get(doctor_id)
    print(f"   Cache.get(doctor_id): {result}")
    
    # Agregar a cache
    print("\n2. Agreando a cache")
    cache.set(doctor_id, lessons)
    result = cache.get(doctor_id)
    count = len(result) if result is not None else 0
    print(f"   Cache.get(doctor_id): {count} lecciones encontradas")
    
    # Simular expiración (en real serían 5 min)
    print("\n3. Esperando expiración de TTL...")
    cache._ttl = __import__('datetime').timedelta(seconds=0)  # TTL = 0 para prueba controlada
    result = cache.get(doctor_id)
    print(f"   Cache.get(doctor_id) tras expiración: {result}")
    
    print("\n4. Cache limpiado")
    cache.clear(doctor_id)
    result = cache.get(doctor_id)
    print(f"   Cache.get(doctor_id): {result}")


async def example_3_nlu_with_knowledge():
    """
    Ejemplo 3: NLU mejorado con integración de Knowledge Base.
    
    NOTA: Requiere:
    - API corriendo en http://localhost:8000
    - Doctor con UUID válido
    - Token JWT válido
    """
    print("\n" + "="*70)
    print("EJEMPLO 3: NLU Engine + Knowledge Base Integration")
    print("="*70)
    
    print("\nNOTA: Para ejecutar este ejemplo se necesita:")
    print("  1. API corriendo: python scripts/run_api_server.py")
    print("  2. Doctor con lecciones en BD")
    print("  3. Token JWT válido")
    
    print("\nPseudo-código de uso:\n")
    
    example_code = '''
    # Paso 1: Crear cliente de Knowledge Base
    kb_client = KnowledgeBaseClient("http://localhost:8000")
    kb_client.set_auth_token("tu_token_jwt_aqui")
    
    # Paso 2: Analizar mensaje con knowledge base
    analysis = await NLUEngine.analyze_with_learning(
        text="quiero turno urgente",
        doctor_id="uuid-del-doctor",
        api_client=kb_client
    )
    
    # Paso 3: Resultado incluye:
    result = {
        "intent": "book_appointment",
        "entities": { "specialty": "General" },
        "confidence": 0.99,
        "source": "knowledge_base",           # ← Desde KB
        "action": "priorizar como urgencia",  # ← Acción del doctor
        "match_pattern": "quiero turno urgente",
        "match_similarity": 1.0,              # ← Exacto
    }
    
    # Paso 4: Ver métricas
    metrics = NLUEngine.get_knowledge_metrics()
    print(f"Hit rate: {metrics['hit_rate']}")
    print(f"Total queries: {metrics['total_queries']}")
    '''
    
    print(example_code)


async def example_4_metrics_and_monitoring():
    """
    Ejemplo 4: Métricas de performance del Knowledge Base.
    """
    print("\n" + "="*70)
    print("EJEMPLO 4: Monitoreo y Métricas")
    print("="*70)
    
    # Simular algunas queries
    NLUEngine._metrics["total_queries"] = 100
    NLUEngine._metrics["knowledge_hits"] = 75
    NLUEngine._metrics["knowledge_misses"] = 25
    NLUEngine._metrics["metabrain_queries"] = 20
    
    metrics = NLUEngine.get_knowledge_metrics()
    
    print("\nMétricas del NLU Engine:")
    print(f"  Total queries: {metrics['total_queries']}")
    print(f"  Knowledge hits: {metrics['knowledge_hits']}")
    print(f"  Knowledge misses: {metrics['knowledge_misses']}")
    print(f"  Hit rate: {metrics['hit_rate']}")
    print(f"  MetaBrain queries: {metrics['metabrain_queries']}")
    
    print("\nInterpretación:")
    print(f"  ✓ {metrics['hit_rate']} de las queries usan Knowledge Base")
    print(f"  ✓ {metrics['metabrain_queries']} queries procesadas por MetaBrain")


async def example_5_thresholds():
    """
    Ejemplo 5: Ajuste de thresholds de similitud.
    """
    print("\n" + "="*70)
    print("EJEMPLO 5: Thresholds de Similitud")
    print("="*70)
    
    print("\nThresholds configurables en KnowledgeMatcher:")
    print(f"  EXACT_MATCH_THRESHOLD: {KnowledgeMatcher.EXACT_MATCH_THRESHOLD}")
    print(f"  FUZZY_MATCH_THRESHOLD: {KnowledgeMatcher.FUZZY_MATCH_THRESHOLD}")
    print(f"  MIN_SIMILARITY_TO_USE: {KnowledgeMatcher.MIN_SIMILARITY_TO_USE}")
    
    print("\nAjuste recomendado según caso de uso:")
    print("\n  📊 STRICT (máxima precisión):")
    print("     MIN_SIMILARITY_TO_USE = 0.85")
    print("     → Solo matches muy altos")
    print("\n  ⚖️  BALANCED (default):")
    print("     MIN_SIMILARITY_TO_USE = 0.65")
    print("     → Balance entre recall y precisión")
    print("\n  🔓 LOOSE (máxima cobertura):")
    print("     MIN_SIMILARITY_TO_USE = 0.50")
    print("     → Captura más casos pero puede ser ruidoso")


async def main():
    """Ejecuta todos los ejemplos."""
    print("\n" + "="*70)
    print("BOT KNOWLEDGE BASE - EJEMPLOS DE INTEGRACIÓN")
    print("="*70)
    
    await example_1_fuzzy_matching()
    await example_2_caching()
    await example_3_nlu_with_knowledge()
    await example_4_metrics_and_monitoring()
    await example_5_thresholds()
    
    print("\n" + "="*70)
    print("✓ Ejemplos completados")
    print("="*70)
    print("\nPróximos pasos:")
    print("  1. Integrar KnowledgeBaseClient en brain/integration/api_client.py")
    print("  2. Pasar api_client a NLUEngine.analyze_with_learning()")
    print("  3. Monitorear métricas con get_knowledge_metrics()")
    print("  4. Ajustar thresholds según performance")


if __name__ == "__main__":
    asyncio.run(main())
