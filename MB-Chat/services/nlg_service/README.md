# NLG Service: Natural Language Generation (hybrid deterministic + optional Groq)

## Overview

`nlg-service` is a **hybrid natural language generator** for medical decision support.
By default, it runs deterministic rules (planner + generator + rule-based reformulator). If `GROQ_API_KEY` is configured, it additionally runs a controlled Groq refinement pipeline with guardrails and fallback.

**Key Features:**
- ✅ Deterministic core (always available)
- ✅ Optional Groq refinement pipeline (orchestrator -> normalizer -> optional rewriter -> optional refiner -> optional guardrail -> optional fallback)
- ✅ Real linguistic variability (not rigid templates)
- ✅ Clinical safety controls
- ✅ Structured message planning
- ✅ Semantic mapping (lexicon)
- ✅ JSON logging with request tracing

## Optional Groq Refinement

When `GROQ_API_KEY` exists, the reformulation stage can use Groq with system prompts for:

- medical text normalization
- orchestrator (JSON policy that decides normalizer/rewriter/refiner/guardrail/fallback)
- anti-repetition rewriter
- principal fluency refiner
- medical safety guardrail (JSON output)
- prudent fallback if guardrail marks unsafe content

Recommended configuration:

- `NLG_GROQ_MODEL=llama3-70b-8192`
- `NLG_GROQ_TEMPERATURE=0.4`
- `NLG_GROQ_MAX_TOKENS=700`

Environment variables:

- `GROQ_API_KEY`: enables Groq integration
- `NLG_GROQ_ENABLED=true|false` (default `true`)
- `NLG_GROQ_ENABLE_REWRITER=true|false` (default `true`)
- `NLG_GROQ_MODEL` (default `llama3-70b-8192`)
- `NLG_GROQ_TEMPERATURE` (default `0.4`)
- `NLG_GROQ_MAX_TOKENS` (default `700`)

## Architecture

```
NLGRequest (decision_output + model_output + dialogue_action)
    │
    ├─→ MessagePlanner (decides structure: opening → risk → interpretation → action)
    │   └─→ MessagePlan (structure without text yet)
    │
    ├─→ NLGGenerator (constructs text)
    │   ├─→ Templates (multiple variants per message type)
    │   ├─→ Lexicon (semantic mapping: symptom codes → natural language)
    │   └─→ Text Assembly (sentences + connectors)
    │
    └─→ NLGResponse (message + metadata)
```

## Components

### 1. **Lexicon** (`lexicon.py`)

Semantic mapping without generative models:

```python
"fever" → primary="fiebre", synonyms=["temperatura elevada", "alza térmica"],
          formal="hipertermia", casual="calentura"
```

**Purpose:** Convert medical codes (fever, cough, dyspnea) to natural language variants.

### 2. **Templates** (`templates.py`)

Multiple variants per message type (not rigid):

```python
# Opening variants
"Por lo que describes..."
"Según los síntomas que mencionas..."
"Con la información disponible..."

# Risk introductions
HIGH: "existe un riesgo elevado que requiere atención inmediata"
HIGH: "se identifica una situación que podría ser importante..."
MEDIUM: "existe un riesgo moderado que necesita seguimiento"
LOW: "los hallazgos son compatibles con un cuadro de bajo riesgo"
```

### 3. **Planner** (`planner.py`)

Decides message structure **without generating text**:

```
Input: DecisionOutput (risk_level, clinical_flag, explanations)
Output: MessagePlan
  - structure: ["opening", "risk_intro", "clinical_interpretation", "action", "disclaimer"]
  - tone: "reassuring" | "informative" | "urgent"
  - variations: mapping to template variants
```

**Logic:**
- HIGH risk → [risk_intro, interpretation, action_urgent, disclaimer]
- MEDIUM risk → [risk_intro, interpretation, action, disclaimer]
- LOW risk → [opening, interpretation, action, disclaimer]

### 4. **Generator** (`generator.py`)

Constructs final text from plan:

```
1. Select variants from templates (random but controlled)
2. Replace placeholders with lexicon values
3. Assemble sentences with intelligent connectors
4. Validate & sanitize text
```

### 5. **Engine** (`engine.py`)

Orchestrates planner + generator:

```python
generate(
    decision_output=DecisionOutput,
    model_output=ModelOutput,
    dialogue_intent="symptom_report",
    symptoms=["fever", "cough"],
    patient_context={...}
) → {message, style, variants_used, disclaimers}
```

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "nlg-service",
  "version": "1.0.0"
}
```

### POST /generate
Generate natural language message from clinical decision.

**Request:**
```json
{
  "decision_output": {
    "risk_level": "high",
    "clinical_flag": "urgent",
    "requires_medical_evaluation": true,
    "triage_level": "red",
    "confidence_band": "high",
    "explanations": ["pneumonia_possible"]
  },
  "model_output": {
    "model_name": "medical_triage_v3",
    "model_version": "1.2.0",
    "risk_level": "high",
    "finding_code": "infiltrate_bilateral",
    "confidence": 0.87,
    "probabilities": {"low": 0.05, "medium": 0.08, "high": 0.87},
    "recommendation_code": "urgent_evaluation",
    "features_used": {"fever": 1.0, "cough": 1.0, "dyspnea": 0.8}
  },
  "dialogue_action": {
    "intent": "symptom_report",
    "next_step": "prioritize_response"
  },
  "symptoms": ["fever", "cough", "dyspnea"],
  "patient_context": {}
}
```

**Response:**
```json
{
  "message": "Por lo que describes, existe un riesgo elevado que requiere atención inmediata. Los síntomas y hallazgos son compatibles con una posible infección pulmonar. Se recomienda búsqueda inmediata de evaluación médica profesional para confirmación diagnóstica. Esta evaluación es de carácter preliminar y requiere validación por profesional médico calificado.",
  "style": "clinical",
  "variants_used": [
    "opening:symptom_report",
    "risk_intro:high",
    "clinical_interpretation:possible_pneumonia",
    "action:urgent",
    "disclaimer:safety"
  ],
  "disclaimers": [
    "Esta evaluación es de carácter preliminar y requiere validación por profesional médico calificado.",
    "medical_professional_review_recommended"
  ]
}
```

## Real Example: 2-Turn Conversation

### Turn 1: User reports symptoms

**Request:**
```json
{
  "decision_output": {
    "risk_level": "medium",
    "clinical_flag": "priority",
    "requires_medical_evaluation": true,
    "triage_level": "yellow",
    "confidence_band": "medium",
    "explanations": ["respiratory_issue"]
  },
  "model_output": {
    "model_name": "medical_triage_v3",
    "model_version": "1.2.0",
    "risk_level": "medium",
    "finding_code": "mild_infiltrate",
    "confidence": 0.72,
    "probabilities": {"low": 0.15, "medium": 0.72, "high": 0.13},
    "recommendation_code": "priority_evaluation",
    "features_used": {"fever": 1.0, "cough": 0.9}
  },
  "dialogue_action": {
    "intent": "symptom_report",
    "next_step": "request_more_info"
  },
  "symptoms": ["fever", "cough"]
}
```

**Response:**
```json
{
  "message": "Según los síntomas que mencionas (fiebre y tos), existe un riesgo moderado que necesita seguimiento. Los hallazgos sugieren una afección respiratoria. Es recomendable programar una revisión clínica prioritaria en los próximos días. Cualquier diagnóstico debe confirmarse mediante una evaluación médica directa.",
  "style": "clinical",
  "variants_used": [...],
  "disclaimers": [...]
}
```

### Turn 2: User asks about severity

**Request:**
```json
{
  "decision_output": { ... same as above, now with confirmation of severity ... },
  "dialogue_action": {
    "intent": "severity_question",
    "next_step": "explain_risk"
  },
  "symptoms": ["fever", "cough"]
}
```

**Response:**
```json
{
  "message": "Respecto a la gravedad de tu condición, existe un riesgo moderado que necesita seguimiento. Los síntomas que describes son compatibles con una afección respiratoria que requiere valoración médica. Se sugiere agendar una consulta prioritaria en corto plazo para evaluación y posibles estudios complementarios. La información aquí proporcionada no reemplaza la consulta médica profesional.",
  "style": "clinical",
  "variants_used": [...],
  "disclaimers": [...]
}
```

## How to Run

### Local Development

```powershell
cd E:\MetaBrain
uvicorn services.nlg_service.main:app --host 0.0.0.0 --port 8003 --workers 1
```

### Docker Build & Run

```powershell
# Build image
docker build -f services/nlg_service/Dockerfile -t cerebro-nlg-service:latest .

# Run container
docker run -p 8003:8003 \
  -e CEREBRO_API_KEY="real_async_key_2026" \
  cerebro-nlg-service:latest
```

### Test Endpoint

```powershell
$body = @{
  decision_output = @{
    risk_level = "high"
    clinical_flag = "urgent"
    requires_medical_evaluation = $true
    triage_level = "red"
    confidence_band = "high"
    explanations = @("critical_symptoms_present")
  }
  model_output = @{
    model_name = "medical_triage_v3"
    model_version = "1.2.0"
    risk_level = "high"
    finding_code = "critical_pattern"
    confidence = 0.92
    probabilities = @{low=0.02; medium=0.06; high=0.92}
    recommendation_code = "urgent_evaluation"
    features_used = @{fever=1.0; dyspnea=1.0}
  }
  symptoms = @("fever", "dyspnea")
} | ConvertTo-Json

curl -X POST "http://localhost:8003/generate" `
  -H "Content-Type: application/json" `
  -d $body | ConvertTo-Json
```

## Safety & Clinical Controls

### No Diagnosis Assertion
The service NEVER generates text like:
- "You have pneumonia" (diagnostic assertion)
- "You definitely need X" (absolute claim)

Instead it uses:
- "compatible with" (suggestive language)
- "suggests" (probabilistic)
- "may indicate" (uncertain)

### Always Include Disclaimers
Every message includes:
```
"Esta evaluación es de carácter preliminar y requiere validación por profesional médico calificado."
```

### Risk-Based Tone Adjustment
- HIGH risk → Emphasis on urgency, immediate action
- MEDIUM risk → Balanced, prioritize evaluation
- LOW risk → Reassuring, routine monitoring

## Logging

**Format:** JSON with structured fields

```json
{
  "ts": "2026-04-21T10:30:45.123456+00:00",
  "level": "INFO",
  "logger": "cerebro_ai_med.nlg_service",
  "message": "message_generated",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "message_length": 342,
  "variants_count": 5,
  "latency_ms": 8.5
}
```

## Architecture Integration

### In docker-compose.distributed.yml

```yaml
nlg-service:
  build:
    context: ..
    dockerfile: services/nlg_service/Dockerfile
  command: ["uvicorn", "services.nlg_service.main:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "1"]
  expose:
    - "8003"
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8003/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s
```

### API Gateway Integration

Gateway calls nlg-service AFTER decision-service:

```
User Input
  ↓
[inference-service] → ModelOutput
  ↓
[decision-service] → DecisionOutput
  ↓
[dialogue-engine] → DialogueAction
  ↓
[nlg-service] → Natural Language Message
  ↓
User Response
```

## Extending the Service

### Add New Symptom

**File: `lexicon.py`**
```python
"new_symptom": SymptomVariant(
    primary="síntoma nuevo",
    synonyms=["variante 1", "variante 2"],
    formal="término formal",
    casual="término coloquial",
)
```

### Add New Clinical Condition

**File: `templates.py`**
```python
self.clinical_interpretations["new_condition"] = [
    MessageTemplate(template="...", name="interp_new_1"),
    MessageTemplate(template="...", name="interp_new_2"),
]
```

### Add New Risk Rule

**File: `planner.py`**
Modify `_plan_structure()` method to handle new risk levels or contexts.

## Performance Metrics

- Response time: ~5-15ms (per message)
- No external API calls
- Memory usage: ~50MB (service only)
- Concurrent sessions: Limited by FastAPI workers (default 1, scale via kubernetes)

## Next Steps (Optional)

1. **Template Enrichment:** Add domain-specific variations per medical specialty
2. **Personalization:** Adapt tone/complexity to patient demographics
3. **A/B Testing:** Track message variants for effectiveness analysis
4. **Multilingual:** Extend lexicon for English, Portuguese, etc.
5. **Metrics:** Add Prometheus endpoints for message quality tracking
