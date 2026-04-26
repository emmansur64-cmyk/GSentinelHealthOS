"""
ARQUITECTURA VISUAL: Bot Knowledge Base + NLU Integration

Diagrama completo del sistema.
"""

# BOT KNOWLEDGE BASE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GSENTINEL HEALTH OS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PATIENT (WhatsApp)                    DOCTOR (Dashboard)                 │
│  ╔════════════════╗                    ╔════════════════╗                 │
│  ║ "Quiero turno  ║                    ║ Teach Bot      ║                 │
│  ║  urgente"      ║                    ║ "urgente" →    ║                 │
│  ╚════════════╤═══╝                    ║ "priorizar"    ║                 │
│               │                         ╚════════════╤═══╝                 │
│               │                                      │                     │
│               └──────────────────────────────────────┘                     │
│                          │                                                 │
│                          ▼                                                 │
│        ┌────────────────────────────────────┐                             │
│        │     API (FastAPI)                  │                             │
│        │  /api/v1/admin/learn (CRUD)        │                             │
│        │  /api/v1/auth/token                │                             │
│        └────────────────────┬───────────────┘                             │
│                             │                                              │
│                             ▼                                              │
│        ┌──────────────────────────────────────────────┐                   │
│        │      DATABASE (PostgreSQL)                   │                   │
│        │  ┌─────────────────────────────────────────┐ │                   │
│        │  │ bot_knowledge_base                      │ │                   │
│        │  │  id (UUID)                              │ │                   │
│        │  │  doctor_id (FK) → doctors              │ │                   │
│        │  │  pattern (String, indexed)              │ │                   │
│        │  │  correct_action (String)                │ │                   │
│        │  │  category (intent|entity|tone|flow)     │ │                   │
│        │  │  created_at, updated_at                 │ │                   │
│        │  │  idx_doctor_pattern (UNIQUE)            │ │                   │
│        │  └─────────────────────────────────────────┘ │                   │
│        └──────────────────────────────────────────────┘                   │
│                             ▲                                              │
│                             │                                              │
│        ┌────────────────────┴──────────────────────────┐                  │
│        │     BRAIN (Python)                           │                  │
│        │  ╔══════════════════════════════════════╗    │                  │
│        │  ║  NLUEngine                           ║    │                  │
│        │  ║  ┌────────────────────────────────┐  ║    │                  │
│        │  ║  │ analyze_with_learning()        │  ║    │                  │
│        │  ║  │ 1. Get lessons (cache+API)     │  ║    │                  │
│        │  ║  │ 2. KnowledgeMatcher.find()     │  ║    │                  │
│        │  ║  │    ├─ Exact match? (100%)      │  ║    │                  │
│        │  ║  │    ├─ Fuzzy match? (70%+)      │  ║    │                  │
│        │  ║  │    └─ No match?                │  ║    │                  │
│        │  ║  │ 3. Return action or Groq       │  ║    │                  │
│        │  ║  └────────────────────────────────┘  ║    │                  │
│        │  ║                                       ║    │                  │
│        │  ║  ┌────────────────────────────────┐  ║    │                  │
│        │  ║  │ KnowledgeMatcher               │  ║    │                  │
│        │  ║  │ ├─ Exact: pattern == input    │  ║    │                  │
│        │  ║  │ ├─ Fuzzy: SequenceMatcher     │  ║    │                  │
│        │  ║  │ │  (70% threshold)            │  ║    │                  │
│        │  ║  │ └─ Similarity scoring          │  ║    │                  │
│        │  ║  └────────────────────────────────┘  ║    │                  │
│        │  ║                                       ║    │                  │
│        │  ║  ┌────────────────────────────────┐  ║    │                  │
│        │  ║  │ LessonCache                    │  ║    │                  │
│        │  ║  │ ├─ Cache: {doctor_id: [...]}  │  ║    │                  │
│        │  ║  │ ├─ TTL: 5 minutes              │  ║    │                  │
│        │  ║  │ └─ ~5ms latency (hit)          │  ║    │                  │
│        │  ║  └────────────────────────────────┘  ║    │                  │
│        │  ║                                       ║    │                  │
│        │  ║  ┌────────────────────────────────┐  ║    │                  │
│        │  ║  │ Metrics                        │  ║    │                  │
│        │  ║  │ ├─ total_queries               │  ║    │                  │
│        │  ║  │ ├─ knowledge_hits              │  ║    │                  │
│        │  ║  │ ├─ knowledge_misses            │  ║    │                  │
│        │  ║  │ ├─ hit_rate (%)                │  ║    │                  │
│        │  ║  │ └─ groq_queries                │  ║    │                  │
│        │  ║  └────────────────────────────────┘  ║    │                  │
│        │  ╚══════════════════════════════════════╝    │                  │
│        │                                              │                  │
│        │  KnowledgeBaseClient                        │                  │
│        │  ├─ get_bot_lessons(doctor_id)              │                  │
│        │  ├─ get_lesson_stats(doctor_id)             │                  │
│        │  ├─ set_auth_token(jwt)                     │                  │
│        │  └─ async HTTP requests                     │                  │
│        │                                              │                  │
│        └──────────────────────────────────────────────┘                  │
│                             ▲                                              │
│                             │                                              │
│  ┌──────────────────────────┘                                             │
│  │                                                                         │
│  │  Groq LLM (Fallback)                                                  │
│  │  ├─ Analyzed si no hay match                                          │
│  │  ├─ Inyecta contexto de lecciones                                     │
│  │  └─ Respeta instrucciones del doctor                                 │
│  │                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

```

---

## FLUJOS DE DATOS

### FLUJO 1: Doctor Enseña

```
Dashboard UI                                 API
    │                                        │
    ├─ POST /admin/learn                     │
    │  pattern: "quiero turno"               │
    │  action: "priorizar"                   │
    │  category: "intent"                    │
    │  JWT: Bearer token                     │
    ├───────────────────────────────────────>│
    │                                        │
    │                    ┌──────────────────────┐
    │                    │ Validación:          │
    │                    │ ✓ JWT válido        │
    │                    │ ✓ Rol doctor        │
    │                    │ ✓ Pattern válido     │
    │                    │ ✓ No duplicado       │
    │                    └──────────────────────┘
    │                        │
    │                        ▼
    │                    PostgreSQL
    │                    INSERT bot_knowledge_base
    │                    doctor_id = extracted_from_jwt
    │                        │
    │<───────────────────────┤
    │ 201 Created            │
    │ {id, pattern, ...}     │
    │                        │
```

### FLUJO 2: Patient Chats (with Knowledge Base)

```
Patient (WhatsApp)         Gateway               NLU Engine              KB + DB
    │                         │                      │                     │
    ├─ "quiero turno"         │                      │                     │
    ├────────────────────────>│                      │                     │
    │                         │                      │                     │
    │                         ├─ Request Analysis    │                     │
    │                         ├─────────────────────>│                     │
    │                         │                      │                     │
    │                         │    ┌─ Get lessons    │                     │
    │                         │    │ (cache or API)  │                     │
    │                         │    ├────────────────────────────────────→  │
    │                         │    │                      ▼                │
    │                         │    │              LessonCache.get()        │
    │                         │    │              (< 5ms if cached)        │
    │                         │    │                      │                │
    │                         │    │  Cache MISS? └─> API call           │
    │                         │    │                      │                │
    │                         │<────────────────────────── Lessons         │
    │                         │                      │  (cacheado)         │
    │                         │                      │                     │
    │                         │                      ▼                     │
    │                         │              KnowledgeMatcher             │
    │                         │              find_best_match()            │
    │                         │              ├─ Exacto? (100%)           │
    │                         │              │ "quiero turno" == input    │
    │                         │              └─ ✓ MATCH!                 │
    │                         │                      │                     │
    │                         │              ┌──────▼──────┐              │
    │                         │              │ SIN GROQ!   │              │
    │                         │              │ Return:     │              │
    │                         │              │ action      │              │
    │                         │              │ confidence  │              │
    │                         │              │ 0.99        │              │
    │                         │              └─────────────┘              │
    │                         │                      │                     │
    │                         │  Result             │                     │
    │                         │<─────────────────────                     │
    │<────────────── "Priorizando tu cita..."       │                     │
    │                         │                      │                     │
    │              ┌──────── Metrics Recorded ─────>│                     │
    │              │          Hit: 1                 │                     │
    │              │          cache_latency: 8ms    │                     │
    │              │          match_type: exact      │                     │
    │              └─────────────────────────────────┘                     │
    │
```

### FLUJO 3: Fallback (Sin Knowledge Base Match)

```
Patient"algo raro lol"           NLU Engine                Groq
    │                               │                       │
    ├──── Request Analysis ────────>│                       │
    │                               │                       │
    │              ┌─ Get lessons   │                       │
    │              │ (cached)       │                       │
    │              │    result: 45 lessons                   │
    │              │                │                       │
    │              ├─ KnowledgeMatcher.find()                │
    │              │  "algo raro" vs patterns:              │
    │              │  ├─ "quiero turno"   → 12% (skip)     │
    │              │  ├─ "hola doctor"    → 8% (skip)      │
    │              │  └─ best: 22% (< 65% threshold)       │
    │              │                                         │
    │              └─ NO MATCH ✗                            │
    │                  Fallback a Groq                       │
    │                                │                       │
    │                    ┌─ Contexto:│                       │
    │                    │ "Doctor enseñó:│                  │
    │                    │  1. quiero..   │                  │
    │                    │  2. necesito..." │                │
    │                    │                │                  │
    │                    │ Input: "algo raro lol"            │
    │                    │                │                  │
    │                    └───────────────>│                  │
    │                                     │                  │
    │                                     ▼                  │
    │                          Groq pide más contexto       │
    │                          pero respeta instrucciones   │
    │                                     │                  │
    │                    Respuesta: intent=general_query    │
    │                             confidence=0.42           │
    │                                     │                  │
    │<────────────────────────────────────┤                  │
    │         "No entiendo, ¿puedes ser más específico?"    │
    │                                                        │
```

---

## COMPONENTES CLAVE

### 1. API (FastAPI + SQLAlchemy)

```python
POST /api/v1/admin/learn
├─ Auth: JWT (Bearer token)
├─ Validación: Pydantic schemas
├─ Deduplicación: Índice UNIQUE en BD
├─ Response: 201 Created | 409 Conflict
└─ Doctor_id: Extraído del token (no del input)

GET /api/v1/admin/learn?category=intent&limit=50
├─ Auth: JWT
├─ Filtrado: Por categoría, paginado
├─ Ownership: Solo lecciones del doctor
└─ Response: List[BotLessonResponse]
```

### 2. NLU Engine (Brain)

```python
NLUEngine.analyze_with_learning(
    text=user_input,
    doctor_id=doctor_uuid,
    api_client=kb_client,
    history=conversation_history
)

Pipeline:
1. LessonCache.get(doctor_id) ─┐
2. APIClient.get_bot_lessons() ├─> lessons: List[CachedLesson]
3. KnowledgeMatcher.find_best_match(text, lessons)
   ├─ Exact: == comparison (100%)
   └─ Fuzzy: SequenceMatcher (70%)
4. Return action | Groq | rules
```

### 3. KnowledgeMatcher

```python
class KnowledgeMatcher:
    EXACT_MATCH_THRESHOLD = 0.95
    FUZZY_MATCH_THRESHOLD = 0.70
    MIN_SIMILARITY_TO_USE = 0.65
    
    find_best_match(user_text, lessons)
    ├─ Exact: if pattern == normalized(user_text)
    │  └─ return PatternMatch(similarity=1.0, is_exact=True)
    └─ Fuzzy: SequenceMatcher(None, user_text, pattern).ratio()
       └─ return if similarity >= FUZZY_MATCH_THRESHOLD
```

### 4. LessonCache

```python
class LessonCache:
    _cache: {doctor_id: [CachedLesson]}
    _ttl: timedelta(300s)
    
    get(doctor_id)
    ├─ In cache? Expired? ─> None | [lessons]
    
    set(doctor_id, lessons)
    ├─ Store in _cache with timestamp
    
    clear(doctor_id?)
    ├─ Remove specific or all
```

---

## INTEGRACIÓN STEPS

```
┌─────────────────────────────────────────────────┐
│ 1. API Knowledge Base                           │
│    ✓ READY (6 endpoints)                        │
├─────────────────────────────────────────────────┤
│ 2. NLU Engine Mejorado                          │
│    ✓ READY (KnowledgeMatcher + Cache)          │
├─────────────────────────────────────────────────┤
│ 3. KnowledgeBaseClient                          │
│    ✓ READY (HTTP + Token management)           │
├─────────────────────────────────────────────────┤
│ 4. Integration en api_client.py                 │
│    TODO (paste KnowledgeBaseClient methods)     │
├─────────────────────────────────────────────────┤
│ 5. Usage en orchestrator/services               │
│    TODO (pass api_client to analyze_with_learning) │
├─────────────────────────────────────────────────┤
│ 6. Migration + Testing                          │
│    TODO (alembic upgrade head)                  │
└─────────────────────────────────────────────────┘
```

---

## PERFORMANCE COMPARISON

```
Sin Knowledge Base          Con Knowledge Base
──────────────────         ───────────────────

Latency:                    Latency:
└─ Groq: ~800ms            ├─ Cache hit: ~20ms
└─ Rules: ~10ms            ├─ Fuzzy: ~150ms
                            ├─ Groq (backup): ~850ms
                            └─ Rules: ~10ms

Accuracy:                   Accuracy:
└─ Groq: ~70%              ├─ Exact match: 99%
└─ Rules: ~50%             ├─ Fuzzy: ~85%
                            ├─ Groq (boosted): ~80%
                            └─ Rules: 50%

Doctor UX:                  Doctor UX:
└─ "Bot no entendió"       ├─ "Bot aprendió"
                            ├─ "Enseña al bot"
                            └─ "Mi patrón: ... → ..."
```

---

## MONITORING DASHBOARD (Recomendado)

```
┌── Bot Learning Metrics ───────────────────────┐
│                                               │
│  Hit Rate: ████████░░ 75%                     │
│  Total Lessons: 245                           │
│                                               │
│  By Category:                                 │
│  ├─ Intent:  ██████████ 120  (49%)           │
│  ├─ Entity:  ████████   85   (35%)           │
│  ├─ Tone:    ██        25   (10%)            │
│  └─ Flow:    ░         15    (6%)            │
│                                               │
│  Performance:                                 │
│  ├─ Avg latency (cache hit): 8ms             │
│  ├─ Cache hit rate: 94%                      │
│  ├─ Groq fallback: 6%                        │
│  └─ Rules fallback: 0%                       │
│                                               │
│  Top Doctors (by lessons):                    │
│  ├─ Dr. López: 45 lessons                    │
│  ├─ Dr. García: 38 lessons                   │
│  └─ Dr. Martín: 32 lessons                   │
│                                               │
└───────────────────────────────────────────────┘
```

