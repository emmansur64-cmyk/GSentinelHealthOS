"""
GUÍA DE INTEGRACIÓN: Bot Knowledge Base en NLU Engine

Documento técnico sobre cómo completar la integración del sistema
de aprendizaje continuo del bot en el NLU Engine del Brain.

Ubicación: brain/KNOWLEDGE_BASE_INTEGRATION.md
"""

# BOT KNOWLEDGE BASE - INTEGRACIÓN EN NLU ENGINE

## 📋 RESUMEN EJECUTIVO

El NLU Engine ha sido mejorado para integrar el Bot Knowledge Base con:

✓ **Búsqueda inteligente**: Exacta (100%) y fuzzy (70%+)
✓ **Caching**: TTL de 5min por doctor
✓ **Scoring**: Confianza ajustada por similitud
✓ **Métricas**: Hit rate de Knowledge Base
✓ **Fallback**: Groq LLM si no hay match
✓ **Zero downtime**: API de KB falla = continúa con reglas

---

## 🏗️ ARQUITECTURA

```
NLUEngine.analyze_with_learning()
│
├─ 1. Obtener lecciones (cache o API)
│     └─ LessonCache.get() → Si TTL válido
│     └─ APIClient.get_bot_lessons() → Si no en cache
│
├─ 2. Buscar match en patrones
│     └─ KnowledgeMatcher.find_best_match()
│     │   ├─ Exacto (==): 100%
│     │   └─ Fuzzy (SequenceMatcher): 70%+
│
├─ 3. Si hay match exacto
│     └─ Retornar directamente
│     └─ confidence = 0.99
│     └─ source = "knowledge_base"
│
├─ 4. Si hay match fuzzy
│     └─ Inyectar en prompt de Groq
│     └─ Groq respeta instrucciones del doctor
│     └─ Boost confianza (+0.15)
│
└─ 5. Si sin match
      └─ Análisis Groq normal
      └─ confidence del propio Groq
```

---

## 🚀 PASO A PASO DE INTEGRACIÓN

### PASO 1: Verificar que NLU Engine está actualizado

```
Archivo: brain/interpreters/nlu_engine.py

Debe incluir:
✓ Clase KnowledgeMatcher con SequenceMatcher
✓ Clase LessonCache con TTL
✓ Clase CachedLesson (dataclass)
✓ Método analyze_with_learning mejorado
✓ Método get_knowledge_metrics()
✓ Método clear_knowledge_cache()
```

### PASO 2: Integrar KnowledgeBaseClient

```python
# En brain/integration/api_client.py

from brain.services.knowledge_base_client import KnowledgeBaseClient

class APIClient:
    def __init__(self, ...):
        # ... código existente ...
        self.kb_client = KnowledgeBaseClient(self.api_base_url)
    
    async def get_bot_lessons(self, doctor_id: str):
        """Proxy al KB client"""
        return await self.kb_client.get_bot_lessons(doctor_id)
    
    def set_knowledge_token(self, token: str):
        """Establece JWT para Knowledge Base"""
        self.kb_client.set_auth_token(token)
```

### PASO 3: Usar en orchestrator/services

```python
# En brain/services/orchestrator.py o donde sea

# Durante inicialización
api_client = APIClient(api_base_url)
api_client.set_knowledge_token(jwt_token_del_doctor)

# En cada análisis
analysis = await NLUEngine.analyze_with_learning(
    text=user_message,
    doctor_id=doctor_id,
    api_client=api_client,  # ← Aquí
    history=conversation_history
)

# Hacer algo con el resultado
if analysis.get("source") == "knowledge_base":
    print(f"✓ Match exacto: {analysis.get('action')}")
elif "fuzzy_match" in analysis:
    print(f"~ Fuzzy match: {analysis['fuzzy_match']['similarity']:.2%}")
```

### PASO 4: Monitoreo (Opcional)

```python
# En dashboard o logging
metrics = NLUEngine.get_knowledge_metrics()

print(f"Knowledge Base Hit Rate: {metrics['hit_rate']}")
print(f"Total queries: {metrics['total_queries']}")

# Guardar en telemetry para análisis
telemetry.record("nlu.knowledge_hit_rate", metrics['hit_rate'])
```

---

## 🔌 API INTEGRATION CHECKLIST

### ✓ Knowledge Base API (http://localhost:8000/api/v1/admin/learn)

El NLU Engine espera que el APIClient tenga:

```python
async def get_bot_lessons(doctor_id: str, category: Optional[str] = None) -> List[dict]:
    """
    Returns:
    [
        {
            "id": "uuid",
            "pattern": "quiero turno urgente",
            "correct_action": "priorizar como urgencia",
            "category": "intent"
        },
        ...
    ]
    """
```

Errores manejados:
- 401 Unauthorized → Loguea warning, retorna []
- 403 Forbidden → Loguea warning, retorna []
- 500 Error → Loguea warning, retorna []
- Timeout → Loguea warning, retorna []

---

## 📊 MÉTRICAS Y MONITOREO

### Disponibles en: `NLUEngine.get_knowledge_metrics()`

```python
{
    "total_queries": 1000,
    "knowledge_hits": 750,
    "knowledge_misses": 250,
    "hit_rate": "75.00%",
    "groq_queries": 200,
    "rule_queries": 50
}
```

### Interpretación

- **hit_rate > 70%**: ✓ Excelente, muchas lecciones enseñadas
- **hit_rate 40-70%**: ⚠️ Bueno, pero hay oportunidad de enseñar más
- **hit_rate < 40%**: ℹ️ Normal en inicio, necesita más lecciones

### Logging en: `brain/interpreters/nlu_engine.py`

Buscar logs con `[Knowledge]`:
```
[Knowledge] ✓ MATCH EXACTO: 'quiero turno' → 'priorizar'
[Knowledge] ~ FUZZY MATCH: 'necesito cita' → ... (75%)
[Knowledge] ✗ Sin match para: 'algo raro'
[Knowledge] Obtenidas 45 lecciones desde cache
```

---

## ⚙️ CONFIGURACIÓN Y THRESHOLDS

### En: `brain/interpreters/nlu_engine.py > KnowledgeMatcher`

```python
# Adjust según comportamiento deseado

EXACT_MATCH_THRESHOLD = 0.95    # 95%+ similitud = exacto
FUZZY_MATCH_THRESHOLD = 0.70    # 70%+ similitud = fuzzy
MIN_SIMILARITY_TO_USE = 0.65    # Mínimo para considerar
```

### Guía de ajuste

**Si hay muchos falsos positivos (matches incorrectos):**
```python
MIN_SIMILARITY_TO_USE = 0.80  # Más estricto
```

**Si falta cobertura (muchos misses):**
```python
MIN_SIMILARITY_TO_USE = 0.55  # Más permisivo
```

**Para casos muy específicos:**
```python
FUZZY_MATCH_THRESHOLD = 0.85  # Fuzzy más cercano a exacto
```

---

## 🔄 CACHING - DETALLES TÉCNICOS

### LessonCache

```python
cache = NLUEngine._lesson_cache
cache_ttl = 300  # 5 minutos (default)

# Cache almacena:
{
    "doctor_id": [
        CachedLesson(pattern, action, category, ...),
        ...
    ]
}

# Qué sucede después de TTL:
1. get(doctor_id) devuelve None
2. Próxima query dispara fetch de API
3. Nueva data cacheada
```

### Limpiar cache (si es necesario)

```python
# Para un doctor específico
NLUEngine.clear_knowledge_cache(doctor_id)

# Para todo
NLUEngine.clear_knowledge_cache()
```

---

## 🧪 TESTING

### Unit tests recomendados

```python
# tests/test_nlu_knowledge_integration.py

async def test_exact_match():
    lessons = [CachedLesson(...)]
    match = KnowledgeMatcher.find_best_match("input", lessons)
    assert match.is_exact == True
    assert match.similarity == 1.0

async def test_fuzzy_match():
    lessons = [CachedLesson(pattern="test pattern")]
    match = KnowledgeMatcher.find_best_match("test pattren", lessons)
    assert match.is_exact == False
    assert match.similarity > 0.7

async def test_cache_ttl():
    # Verificar que cache expira
    cache = LessonCache(ttl_seconds=1)
    cache.set("doc", [lesson])
    
    await asyncio.sleep(1.1)
    assert cache.get("doc") is None

async def test_analyze_with_learning():
    analysis = await NLUEngine.analyze_with_learning(
        text="user input",
        doctor_id="uuid",
        api_client=mock_client
    )
    assert analysis.get("source") in ["knowledge_base", "groq", "rules"]
```

---

## 🎯 FLUJOS DE USO

### Flujo 1: Match exacto (ideal)

```
Usuario: "quiero turno urgente"
Doctor enseñó: "quiero turno urgente" → "priorizar"

NLU Pipeline:
1. Buscar en cache: hit ✓
2. KnowledgeMatcher.find_best_match(): exacto (100%)
3. → Retornar directo con action y confidence 0.99
4. Tiempo: ~5ms

Resultado:
{
  "source": "knowledge_base",
  "confidence": 0.99,
  "action": "priorizar",
  "match_similarity": 1.0
}
```

### Flujo 2: Fuzzy match (acceptable)

```
Usuario: "necesito turno urgentee"  (typo)
Doctor enseñó: "quiero turno urgente"

NLU Pipeline:
1. KnowledgeMatcher.find_best_match(): fuzzy 92%
2. Inyectar en prompt Groq como contexto
3. Groq respeta: "el doctor enseñó..."
4. → Retornar intent+entities con boost

Resultado:
{
  "source": "groq",
  "confidence": 0.89 (0.74 de Groq + 0.15 boost),
  "fuzzy_match": PatternMatch(similarity=0.92),
  "intent": "book_appointment"
}
```

### Flujo 3: Sin match (fallback)

```
Usuario: "qué se yo..."
Doctor no enseñó nada similar

NLU Pipeline:
1. KnowledgeMatcher.find_best_match(): None (< 0.65)
2. Análisis Groq normal
3. → Retornar análisis standard

Resultado:
{
  "source": "groq",
  "confidence": 0.45,
  "intent": "general_query"
}
```

---

## 🚨 TROUBLESHOOTING

### Problema: Sin matches aunque hay lecciones

**Verificar:**
1. ¿Cache expirado? → `NLUEngine.clear_knowledge_cache(doctor_id)`
2. ¿API retorna lecciones? → Check logs `[Knowledge]`
3. ¿Threshold muy alto? → Bajar `MIN_SIMILARITY_TO_USE`
4. ¿Token JWT inválido? → `api_client.set_knowledge_token(new_token)`

### Problema: Matches incorrectos (falsos positivos)

**Soluciones:**
1. Aumentar threshold: `MIN_SIMILARITY_TO_USE = 0.80+`
2. Revisar lecciones que no es específicas
3. Enseñar patrones más claros/diferentes

### Problema: Queries lentas (> 1s)

**Causas comunes:**
1. API lenta → Check PostgreSQL
2. Cache con TTL bajo → Aumentar `ttl_seconds`
3. Muchas lecciones (> 1000) → Paginar/filtrar

---

## 📈 LÍNEA DE BASE Y OBJETIVOS

### Métricas esperadas

```
Semana 1 (inicio):
  hit_rate: 10-20%     (pocos doctors enseñan)
  groq_queries: 80%    (falla back to LLM)

Semana 4 (estable):
  hit_rate: 40-60%     (buen adoption)
  groq_queries: 25%    (eficiente)
  rule_queries: 15%    (fallback)

Mes 3 (maduro):
  hit_rate: 70%+       (excelente)
  groq_queries: 10%    (mínimo necesario)
  latency: < 50ms      (cache hit)
```

---

## 🔗 ARCHIVOS RELACIONADOS

- `api/app/models/models.py` — Modelo BotLesson
- `api/app/api/v1/endpoints/knowledge.py` — Endpoints CRUD
- `brain/interpreters/nlu_engine.py` — NLU Engine (aquí)
- `brain/services/knowledge_base_client.py` — Cliente HTTP KB
- `brain/examples/knowledge_base_integration_example.py` — Ejemplos
- `scripts/test_bot_knowledge_base.py` — Tests BD

---

## ✋ RESUMEN: WHAT'S NEXT

1. **Integrar KnowledgeBaseClient** en `api_client.py`
2. **Pasar api_client** a `analyze_with_learning()`
3. **Monitorear métricas** con `get_knowledge_metrics()`
4. **Ajustar thresholds** según performance real
5. **Dashboard**: Mostrar hit_rate a doctors para motivar enseñanza

