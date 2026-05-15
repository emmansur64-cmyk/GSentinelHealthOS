# Quick Start: nlg-service

## Overview

`nlg-service` es un generador de lenguaje natural **sin LLM**, basado en:
- **Templates** (múltiples variantes por tipo de mensaje)
- **Lexicon** (mapeo semántico: códigos → texto natural)
- **Planner** (estructura de mensaje sin generar texto)
- **Generator** (construcción de texto final + validación)

## Ubicación

```
services/nlg_service/
├── app/
│   ├── main.py              # FastAPI app + logging + exception handlers
│   ├── routes.py            # POST /generate + GET /health
│   ├── schemas.py           # Pydantic models
│   ├── engine.py            # Orquestador (planner + generator)
│   ├── planner.py           # Decide estructura del mensaje
│   ├── generator.py         # Construye texto final
│   ├── templates.py         # Variantes de mensaje
│   ├── lexicon.py           # Mapeo semántico
│   └── __init__.py
├── main.py                  # Entry point
├── requirements.txt
├── Dockerfile
└── README.md
```

## Flujo Interno

```
NLGRequest
  ├─→ NLGEngine.generate()
  │   ├─→ MessagePlanner.plan() → MessagePlan (estructura)
  │   ├─→ NLGGenerator.generate() → GeneratedMessage
  │   │   ├─→ Templates.get_*() (selecciona variantes)
  │   │   ├─→ Lexicon.get_*() (mapea códigos)
  │   │   └─→ _assemble_sections() (une con conectores)
  │   └─→ Response (message + metadata)
```

## Componentes Clave

### 1. Lexicon

Mapeo semántico controlado:

```python
from services.nlg_service.app.lexicon import MedicalLexicon

lex = MedicalLexicon()

# Obtener variante de síntoma
text = lex.get_symptom_variant("fever", style="neutral")  # "fiebre" o "temperatura elevada"
text = lex.get_symptom_variant("fever", style="formal")   # "hipertermia"
text = lex.get_symptom_variant("fever", style="casual")   # "calentura"

# Generar lista de síntomas
text = lex.get_symptom_list(["fever", "cough", "dyspnea"])
# → "fiebre, tos y dificultad para respirar"

# Obtener modificador de riesgo
text = lex.get_risk_modifier("high")  # "elevado", "importante", etc.
```

### 2. Templates

Múltiples variantes por tipo:

```python
from services.nlg_service.app.templates import NLGTemplates

tpl = NLGTemplates()

# Apertura contextual
opening = tpl.get_opening("symptom_report")
# → "Por lo que describes..." / "Según los síntomas..." / etc.

# Introducción de riesgo
risk_intro = tpl.get_risk_introduction("high")
# → "existe un riesgo elevado que requiere atención inmediata" / ...

# Recomendación de acción
action = tpl.get_action_recommendation("urgent")
# → "Se recomienda búsqueda inmediata..." / ...

# Conector
connector = tpl.get_connector("causal")
# → "por lo que", "debido a que", etc.
```

### 3. Planner

Decide estructura sin generar texto:

```python
from services.nlg_service.app.planner import MessagePlanner
from services.shared.contracts import DecisionOutput

planner = MessagePlanner()

decision = DecisionOutput(
    risk_level="high",
    clinical_flag="urgent",
    requires_medical_evaluation=True,
    triage_level="red",
    confidence_band="high",
    explanations=["pneumonia_possible"]
)

plan = planner.plan(
    decision_output=decision,
    dialogue_intent="symptom_report",
    patient_symptoms=["fever", "cough"]
)

print(plan.structure)
# → ["risk_intro", "clinical_interpretation", "action_urgent", "disclaimer"]

print(plan.tone)
# → "urgent"

print(plan.variations_to_use)
# → {"risk_intro": "high", "clinical_interpretation": "possible_pneumonia", ...}
```

### 4. Generator

Construye texto desde el plan:

```python
from services.nlg_service.app.generator import NLGGenerator
from services.nlg_service.app.planner import MessagePlanner

generator = NLGGenerator()
planner = MessagePlanner()

# Obtener plan
plan = planner.plan(decision_output=decision, ...)

# Generar texto
generated = generator.generate(
    plan=plan,
    decision_output=decision,
    model_output=model_output,
    symptoms=["fever", "cough"]
)

print(generated.text)
# → "Por lo que describes, existe un riesgo elevado que requiere atención inmediata..."

print(generated.sections)
# → {"opening": "...", "risk_intro": "...", "action": "..."}

print(generated.variants_used)
# → ["opening:symptom_report", "risk_intro:high", ...]
```

### 5. Engine

Orquestador de planner + generator:

```python
from services.nlg_service.app.engine import NLGEngine

engine = NLGEngine()

result = engine.generate(
    decision_output=decision,
    model_output=model_output,
    dialogue_intent="symptom_report",
    symptoms=["fever", "cough"],
    patient_context={}
)

# result = {
#     "message": "...",
#     "style": "clinical",
#     "variants_used": [...],
#     "disclaimers": [...]
# }
```

## Endpoint de API

### POST /generate

```bash
curl -X POST "http://localhost:8003/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "decision_output": {...},
    "model_output": {...},
    "dialogue_action": {...},
    "symptoms": ["fever", "cough"],
    "patient_context": {}
  }'
```

**Response:**
```json
{
  "message": "Texto natural generado...",
  "style": "clinical",
  "variants_used": ["opening:...", "risk_intro:...", ...],
  "disclaimers": ["Esta evaluación es preliminar..."]
}
```

## Testing

### Unit Test (Lexicon)

```python
from services.nlg_service.app.lexicon import MedicalLexicon

lex = MedicalLexicon()

# Test variantes de síntoma
text = lex.get_symptom_variant("fever")
assert "fiebre" in text or "temperatura" in text

# Test lista de síntomas
text = lex.get_symptom_list(["fever", "cough"])
assert "fiebre" in text
assert "tos" in text
assert " y " in text
```

### Unit Test (Templates)

```python
from services.nlg_service.app.templates import NLGTemplates

tpl = NLGTemplates()

opening = tpl.get_opening("symptom_report")
assert "describe" in opening or "síntomas" in opening or "información" in opening

action = tpl.get_action_recommendation("urgent")
assert "inmediata" in action or "urgente" in action
```

### Integration Test (Full Pipeline)

```python
from fastapi.testclient import TestClient
from services.nlg_service.main import app

client = TestClient(app)

response = client.post("/generate", json={
    "decision_output": {...},
    "model_output": {...},
})

assert response.status_code == 200
data = response.json()
assert len(data["message"]) > 50
assert data["style"] == "clinical"
assert len(data["variants_used"]) > 0
```

## Errores Comunes

### 1. DecisionOutput incompleto
```
Error: field required
```
→ Verificar que DecisionOutput tiene todos los campos:
```python
{
  "risk_level": "high|medium|low",
  "clinical_flag": "routine|priority|urgent",
  "requires_medical_evaluation": bool,
  "triage_level": "green|yellow|red",
  "confidence_band": "low|medium|high",
  "explanations": ["..."]
}
```

### 2. Mensaje generado muy corto
```
Error: Texto generado inválido: menor a 50 caracteres
```
→ El texto debe tener al menos 50 caracteres. Verificar que DecisionOutput sea válido.

### 3. Síntomas no reconocidos
→ Agregar síntoma a `lexicon.py`:
```python
"new_symptom": SymptomVariant(
    primary="síntoma nuevo",
    synonyms=["variante 1", "variante 2"],
    formal="término formal",
    casual="término coloquial",
)
```

## Logging

**Formato JSON estructurado:**

```json
{
  "ts": "2026-04-21T10:30:45.123456+00:00",
  "level": "INFO",
  "logger": "services.nlg_service.app.engine",
  "message": "message_generated_success",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "length": 342,
  "variants_count": 5
}
```

## Extender el Servicio

### Agregar Nueva Variante de Template

**Archivo: `templates.py`**

```python
self.clinical_interpretations["new_condition"] = [
    MessageTemplate(template="...", name="interp_new_1"),
    MessageTemplate(template="...", name="interp_new_2"),
]
```

### Agregar Nuevo Síntoma

**Archivo: `lexicon.py`**

```python
"new_symptom": SymptomVariant(
    primary="síntoma en español",
    synonyms=["sinónimo1", "sinónimo2"],
    formal="término médico formal",
    casual="término coloquial",
)
```

### Cambiar Lógica de Planner

**Archivo: `planner.py`**

Modificar métodos como:
- `_plan_structure()`: Cambiar orden de secciones
- `_get_tone()`: Agregar nuevos tonos
- `_select_variations()`: Mapear nuevas interpretaciones

## Performance

- **Response time**: ~5-15ms por mensaje
- **Memory**: ~50MB (servicio)
- **No external API calls** (determinístico, sin LLM)
- **Escalable**: Sin límite teórico (CPU-bound, no I/O)

## Próximos Pasos

1. **Dominio específico**: Agregar variantes para especialidades médicas
2. **Personalización**: Adaptar tone según demographics del paciente
3. **Feedback loop**: Guardar variantes elegidas para análisis
4. **Métricas**: Prometheus + Grafana para monitoreo
5. **Multilingual**: Extender a otros idiomas
