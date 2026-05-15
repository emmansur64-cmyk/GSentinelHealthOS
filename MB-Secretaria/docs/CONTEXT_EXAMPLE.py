"""
Example: How MetaBrain ML Uses Context in Real Decisions

This shows how the 18-feature context flows through the system
"""

# STEP 1: INCIDENT ARRIVES
# ========================
incident = {
    'id': 'incident-2026-04-12-001',
    'timestamp': '2026-04-12T15:30:00Z',
    'message': 'db timeout',
    'source': 'api_server',
    'metadata': {
        'originalType': 'system.error',
        'logs': [log1, log2, log3],
        'metrics': {'cpu': 85, 'mem': 92},
        'data': {...}
    }
}

# STEP 2: FEATURE ENGINEERING (Python)
# =====================================
# data_pipeline.py calcula contexto:

# Temporal Context
hour_of_day = 15  # Afternoon pattern
day_of_week = 2   # Wednesday
time_since_last_min = 5  # otro evento hace 5 min

# Frequency Detection
frequency_1h = 4   # 4 eventos "db timeout" en última hora
frequency_1d = 12  # 12 eventos similares hoy

# Historical Success
action_historical_success_rate = 0.85  # retry funciona 85% de veces
type_action_success_rate = 0.87        # para (db_timeout + retry): 87%

# Context Analysis
logs_count = 3        # Hay logs disponibles
metrics_count = 2     # CPU, Memory disponibles
has_data = 1          # Datos contextuales presentes
source_category = 'api'  # Categoría normalizada

# Dynamic Severity
severity = 'high'  # Porque frequency_1h=4 (recurrente) + diagnosis=TRANSIENT
# severity_score = 2 (TRANSIENT) + 1 (timeout msg) + 2 (freq/2) = 5 → high

# Feature Vector [18 features]
features = [
    15,      # hour_of_day
    2,       # day_of_week
    5.0,     # time_since_last_min
    4,       # frequency_1h
    12,      # frequency_1d
    3,       # logs_count
    2,       # metrics_count
    1,       # has_data
    0.85,    # action_historical_success_rate ← KEY
    0.87,    # type_action_success_rate ← KEY
    # 8 encoded categorical features...
]

# STEP 3: ML PREDICTION (Node.js / ONNX Runtime)
# ===============================================
ml_result = {
    'action': 'retry_with_backoff',
    'confidence': 0.88  # ALTA porque:
                        # - action_historical_success_rate = 0.85
                        # - type_action_success_rate = 0.87
                        # - frequency señala problema conocido
}

# STEP 4: RULES DECISION (Brain Service)
# =======================================
rules_result = {
    'action': 'retry_with_backoff',
    'confidence': 0.75  # NORMAL porque:
                        # - Matching pattern detection
                        # - No usa historia
}

# STEP 5: DECISION COMPETITION
# =============================
# brain.service.ts:
if ml_result.confidence (0.88) > rules_result.confidence (0.75):
    final_action = 'retry_with_backoff'
    reason = '[ML WINS] confidence 0.88 > 0.75 (rules)'
    reason += f' action_historical_success_rate={0.85}'
else:
    final_action = rules_result.action
    reason = '[RULES WIN] ...'

# STEP 6: EXECUTION & LEARNING
# =============================
execution = execute(final_action)

# learning.service registra:
learning.record(
    incident=incident,
    decision=final_decision,
    execution=execution
)

# Al reentrenar:
# - Si retry funcionó → action_historical_success_rate sube a 0.86
# - Si falló → baja a 0.84
# - Próximo evento similar usa tasa actualizada

# ============================================================================
# KEY INSIGHTS: CÓMO EL CONTEXTO MEJORA DECISIONES
# ============================================================================

"""
1. FRECUENCIA → Urgencia
   - frequency_1h=4 → "problema activo ahora" → ejecutar inmediato
   - frequency_1h=0 → "evento aislado" → estrategia cautelosa

2. HISTORIA DE ACCIÓN → Confianza
   - action_historical_success_rate=0.9 → "confiar en esta acción"
   - action_historical_success_rate=0.4 → "buscar alternativa"

3. CONTEXTO TEMPORAL → Patrones
   - hour_of_day=15, frequency_1h=4 → "pico sistemático a las 3pm"
   - Puede sugerir: upgrade infraestructura, scheduled task, etc.

4. DATOS DISPONIBLES → Seguridad
   - has_data=1, logs_count=3 → "información suficiente → actuar"
   - has_data=0, logs_count=0 → "no hay contexto → ser cauteloso"

5. SEVERIDAD DINÁMICA → Urgencia
   - severity='critical' → ejecutar inmediato
   - severity='low' → puede esperar

# FLUJO ANTES vs DESPUÉS

ANTES (sin contexto):
evento → [Rules] → retrying (porque coincide patrón) → ejecuta → aprende??
  ❌ No sabe si funcionó antes
  ❌ No ve si es problema crónico
  ❌ No ajusta confianza

DESPUÉS (con contexto):
evento → [ML usa 18 features] + [Rules] → ML gana si más confianza
                                         → ejecuta con justificación
                                         → registra tasa de éxito real
  ✅ Sabe si acción funcionó (85%)
  ✅ Ve patrón (4 eventos en 1h)
  ✅ Ajusta confianza automáticamente

# CUANDO ESCALAS A PRODUCCIÓN

Con 100+ incidentes históricos:
- action_historical_success_rate será 0.60-0.95 (realista)
- frequency_1h/1d detectará picos verdaderos
- Feature importance mostrará qué importa (probablemente action success)
- Cross-val vs test gap revelaría overfitting real

# SLA DE OPERACIÓN

Daily:
  - Reentrenamiento automático
  - Validación: new_accuracy >= old_accuracy

Weekly:
  - Analizar feature_importance
  - Revisar acciones con baja success_rate

Monthly:
  - Buscar nuevas features o patterns
  - Revisar threshold de confianza
  - A/B test vs rules
"""
