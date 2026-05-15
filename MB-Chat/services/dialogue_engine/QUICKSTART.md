# Quick Start: dialogue-engine

## Ubicación

```
services/dialogue_engine/
├── app/
│   ├── main.py              # FastAPI app + middleware + error handlers
│   ├── routes.py            # POST /dialogue + GET /health
│   ├── schemas.py           # DialogueRequest, DialogueAction, etc
│   ├── engine.py            # OrquestadorPrincipal (intent + state + policies)
│   ├── intent_classifier.py # RuleBasedIntentClassifier (sin LLM)
│   ├── state_manager.py     # InMemoryStateManager (thread-safe)
│   ├── policies.py          # DialoguePolicyEngine (reglas determinísticas)
│   └── __init__.py
├── main.py                  # Entry point
├── requirements.txt         # fastapi, uvicorn, pydantic
├── Dockerfile               # Imagen production-ready
└── README.md
```

## Conceptos clave

### Intent Types
```python
IntentType = Literal[
    "symptom_report",      # Usuario reporta síntomas
    "follow_up_question",  # Usuario pregunta qué sigue
    "severity_question",   # Usuario pregunta qué tan grave
    "greeting",            # Usuario saluda
    "unknown",             # Clasificación fallida
]
```

### DialogueAction (Output)
```json
{
  "intent": "symptom_report",
  "next_step": "collect_symptoms",
  "required_fields": ["duration", "intensity"],
  "context_updates": {
    "symptoms": ["fever"],
    "symptom_details": {"duration": "3 dias", "intensity": "moderate"},
    "last_risk_level": "low"
  },
  "flags": ["possible_risk"]
}
```

**Campos:**
- `intent`: ¿Qué quiso decir el usuario?
- `next_step`: ¿Qué debe hacer el sistema? (nunca genera texto)
- `required_fields`: ¿Qué información falta?
- `context_updates`: Estado conversacional actualizado
- `flags`: Alertas o marcadores de riesgo

### State Manager (en memoria)

```python
state_manager = InMemoryStateManager()

# Agregar mensaje
state_manager.append_message(
    session_id="user-42",
    role="user",
    message="Tengo fiebre"
)

# Actualizar síntomas
state = state_manager.update_state(
    session_id="user-42",
    extracted_symptoms={"fever"},
    symptom_details={"duration": "3 dias"},
    risk_level="low"
)

# Obtener estado
current = state_manager.get_state("user-42")
```

### Políticas (Reglas determinísticas)

**Archivo: policies.py**

```python
class DialoguePolicyEngine:
    def evaluate(self, intent, state, decision_risk_level):
        # Si risk_level es "high" → prioritize_response + urgent_attention
        # Si faltan campos → request_more_info + required_fields
        # Si symptom_report → collect_symptoms
        # Si severity_question → explain_risk
        # etc...
```

**Agregar nuevas reglas:**

1. Abrir `services/dialogue_engine/app/policies.py`
2. Modificar `PolicyResult` dentro de `evaluate()`
3. Probar con:
   ```python
   from services.dialogue_engine.app.policies import DialoguePolicyEngine
   engine = DialoguePolicyEngine()
   result = engine.evaluate(
       intent="symptom_report",
       state={"symptoms": ["fever"], ...},
       decision_risk_level="high"
   )
   print(result.next_step)  # → "prioritize_response"
   ```

## Flujo interno completo

```
DialogueRequest (session_id, message, decision_output?)
    │
    ├─→ RuleBasedIntentClassifier.classify(message)
    │   └─→ IntentType (por keywords + regex)
    │
    ├─→ RuleBasedIntentClassifier.extract_entities(message)
    │   └─→ (symptoms: Set[str], details: Dict[str, str])
    │
    ├─→ InMemoryStateManager.append_message(user message)
    │
    ├─→ InMemoryStateManager.update_state(symptoms, details, risk)
    │   └─→ Actualiza estado en memoria por session_id
    │
    ├─→ DialoguePolicyEngine.evaluate(intent, state, risk_level)
    │   └─→ PolicyResult (next_step, required_fields, flags)
    │
    └─→ DialogueAction (intent + policy + state)
```

## Testing

### Unit Test (RuleBasedIntentClassifier)

```python
from services.dialogue_engine.app.intent_classifier import RuleBasedIntentClassifier

classifier = RuleBasedIntentClassifier()

# Test intent
intent = classifier.classify("Tengo fiebre y tos")
assert intent == "symptom_report"

# Test entity extraction
symptoms, details = classifier.extract_entities("Tengo fiebre hace 3 dias")
assert "fever" in symptoms
assert details["duration"] == "3 dias"
```

### Integration Test (Endpoint)

```python
from fastapi.testclient import TestClient
from services.dialogue_engine.main import app

client = TestClient(app)

response = client.post("/dialogue", json={
    "session_id": "test-1",
    "message": "Tengo fiebre"
})

assert response.status_code == 200
action = response.json()
assert action["intent"] == "symptom_report"
assert "symptoms" in action["context_updates"]
```

## Errores comunes

### 1. Session vacía/no encontrada
```
Error: session_id cannot be empty
```
→ Usar `session_id` válido (min 3 chars, alphanuméricas + `-_.:`).

### 2. Mensaje vacío
```
Error: message cannot be empty
```
→ Usar `message` de al menos 1 carácter.

### 3. DecisionOutput inválido
```
Error: Request payload validation failed
```
→ Asegurar que `decision_output` tiene campos obligatorios si se envía:
```json
{
  "risk_level": "low|medium|high",
  "clinical_flag": "routine|priority|urgent",
  "requires_medical_evaluation": true|false,
  "triage_level": "green|yellow|red",
  "confidence_band": "low|medium|high",
  "explanations": ["..."]
}
```

## Logging

**Ver logs en tiempo real:**

Local:
```powershell
uvicorn services.dialogue_engine.main:app --log-level debug
```

Docker:
```powershell
docker logs dialogue-service -f
```

**Formato JSON:**
```json
{
  "ts": "2026-04-21T10:30:45.123456+00:00",
  "level": "INFO",
  "logger": "cerebro_ai_med.distributed.dialogue",
  "message": "dialogue_action_generated",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "user-42-session-1",
  "intent": "symptom_report",
  "next_step": "request_more_info",
  "flags": ["possible_risk"],
  "latency_ms": 12.5
}
```

## Próximos desarrollos

1. **Persistencia**: Pasar state_manager a Redis
2. **Custom Intents**: Agregar nuevas clasificaciones específicas del dominio
3. **Políticas dinámicas**: Cargar reglas desde YAML/DB
4. **Multilingual**: Soportar múltiples idiomas en classifier
5. **Metrics**: Prometheus + Grafana
