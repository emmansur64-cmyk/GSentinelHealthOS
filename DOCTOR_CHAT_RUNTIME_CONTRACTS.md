# Doctor Chat — Runtime Contracts
**Versión:** 1.0.0-preproduction  
**Fuente de verdad:** `brain/contracts/routing.py`

---

## assistant_mode Contract

| Valor | Pipeline | triage | diagnosis | scheduling | clinical_reasoning | imaging |
|-------|----------|--------|-----------|------------|-------------------|---------|
| `doctor_professional` | DOCTOR | ❌ NUNCA | ❌ | ✅ | ✅ | ✅ (futuro RMN/TAC/RX) |
| `patient_assistant` | PATIENT | ❌ | ❌ | ✅ | ❌ | ❌ |
| `patient_triage` | PATIENT/TRIAGE | ✅ (con criterios) | ❌ | ✅ | ❌ | ❌ |
| `receptionist` | PATIENT | ❌ | ❌ | ✅ | ❌ | ❌ |
| `administrative` | PATIENT | ❌ | ❌ | ✅ | ❌ | ❌ |
| `generic_non_clinical` | SAFE_FALLBACK | ❌ | ❌ | ❌ | ❌ | ❌ |
| *(inválido/null)* | SAFE_FALLBACK | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## actor_role Contract

| Valor | Descripción | Pipeline habitual |
|-------|-------------|------------------|
| `doctor` | Médico autenticado | DOCTOR_PIPELINE |
| `patient` | Paciente | PATIENT_PIPELINE / TRIAGE_PIPELINE |
| `receptionist` | Recepcionista | PATIENT_PIPELINE |
| `admin` | Administrador | PATIENT_PIPELINE |
| `system` | Interno/automático | SAFE_FALLBACK |
| *(inválido)* | Desconocido | SAFE_FALLBACK |

---

## clinical_capabilities Contract

```python
@dataclass(frozen=True)
class ClinicalCapabilities:
    triage_allowed:             bool = False
    diagnosis_allowed:          bool = False
    scheduling_allowed:         bool = False
    clinical_reasoning_allowed: bool = False
    imaging_allowed:            bool = False
    prescription_review_allowed: bool = False
```

Principio de mínimo privilegio: todos False por default.

---

## Routing Matrix

| assistant_mode | intent | triage_allowed | explicit_symptoms | confidence | → Pipeline |
|----------------|--------|----------------|-------------------|------------|------------|
| doctor_professional | * | ❌ | * | * | DOCTOR_PIPELINE |
| patient_triage | symptom_report | ✅ | ✅ | ≥0.65 | TRIAGE_PIPELINE |
| patient_triage | symptom_report | ✅ | ❌ | * | PATIENT_PIPELINE |
| patient_triage | general_query | ✅ | * | * | PATIENT_PIPELINE |
| patient_triage | * | ✅ | ✅ | <0.65 | PATIENT_PIPELINE |
| patient_assistant | * | ❌ | * | * | PATIENT_PIPELINE |
| generic_non_clinical | * | ❌ | * | * | SAFE_FALLBACK |
| *(inválido)* | * | ❌ | * | * | SAFE_FALLBACK |

---

## Fallback Matrix

| Condición | Respuesta | Triage ejecutado |
|-----------|-----------|-----------------|
| `contract.triage_allowed = False` | FALLBACK_TRIAGE dict | ❌ |
| `intent in NON_TRIAGE_INTENTS` | FALLBACK_TRIAGE dict | ❌ |
| `confidence < 0.65` | FALLBACK_TRIAGE + needs_clarification | ❌ |
| Sin síntomas explícitos | FALLBACK_TRIAGE dict | ❌ |
| Router exception | SAFE_FALLBACK_RESPONSE | ❌ |
| evaluate_triage exception | FALLBACK_TRIAGE dict | ❌ |
| orchestrator exception | _fallback_decision() estático | ❌ |

---

## Forbidden Transitions

```
PROHIBIDO (hardcoded, sin override posible):

doctor_professional  ──X──►  TRIAGE_PIPELINE
doctor_professional  ──X──►  sintoma_generico
general_query        ──X──►  symptom_classification
user_input           ──X──►  usado como síntoma en triage
modo_invalido        ──X──►  pipeline_medico
assistant_mode=null  ──X──►  pipeline_medico
error_path           ──X──►  evaluate_triage()
fallback             ──X──►  respuesta_clinica
```

---

## Wire Format (Frontend → Brain)

### POST /orchestrate

```json
{
  "user_input": "sabes que dia es hoy",
  "session_id": "doctor:dr-uuid:patient:general",
  "assistant_mode": "doctor_professional",
  "actor_role": "doctor",
  "context": {
    "doctor_id": "dr-uuid-001",
    "patient": { "id": "pat-uuid", "name": "Nombre", "notes": null },
    "conversation_history": [...]
  }
}
```

### Respuesta del Brain

```json
{
  "message": "Respuesta contextualizada del asistente clínico",
  "session_id": "...",
  "metadata": {
    "risk_level": "unknown",
    "triage_level": "unknown",
    "flags": [],
    "confidence": 0.85,
    "assistant_mode": "doctor_professional",
    "actor_role": "doctor",
    "triage_allowed": false,
    "context_type": "casual",
    "request_id": "uuid-v4",
    "latency_ms": 42
  }
}
```

---

## TriageEligibilityState States

| Estado | Significado | Triage ejecutado |
|--------|-------------|-----------------|
| `NOT_TRIAGEABLE` | Modo o contrato prohíben triage | ❌ |
| `ROUTE_GENERIC` | Texto no clínico, sin síntomas, o intent ambiguo | ❌ |
| `ROUTE_DOCTOR` | Contexto de médico → DOCTOR_PIPELINE | ❌ |
| `ROUTE_PATIENT_ASSISTANT` | Paciente sin triage activo | ❌ |
| `TRIAGE_ELIGIBLE` | Todos los criterios cumplidos | ✅ |

**Default:** `ROUTE_GENERIC` (nunca VERDE automático)

---

## Invariantes en Código

```python
# INVARIANT A (brain/contracts/routing.py)
_CAPABILITIES_MAP[AssistantMode.DOCTOR_PROFESSIONAL].triage_allowed == False

# INVARIANT B (brain/contracts/routing.py)
"general_query" in NON_TRIAGE_INTENTS  # siempre True

# INVARIANT C (brain/routing/triage_eligibility.py)
# Todos los checks deben pasar: mode, intent, confidence, explicit_symptoms

# INVARIANT D (brain/routing/role_router.py)
# try/except en route() → siempre devuelve (decision, eligibility)

# INVARIANT E (brain/routing/role_router.py)
# DOCTOR_PROFESSIONAL → DOCTOR_PIPELINE para CUALQUIER intent
```
