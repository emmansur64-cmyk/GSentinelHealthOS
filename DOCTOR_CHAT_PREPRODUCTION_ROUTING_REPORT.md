# Doctor Chat — Pre-Production Routing Report
**Fecha:** 2026-05-12  
**Estado:** PRE-PRODUCCIÓN — NO-GO para IA clínica activa  
**Branch:** GsentinelH

---

## 1. Arquitectura Nueva

### Capas del pipeline de decisión

```
Frontend (Next.js)
    │
    │  assistant_mode: "doctor_professional"
    │  actor_role:     "doctor"
    ▼
brain-client.ts  ──POST /orchestrate──►  brain/app.py
                                              │
                                         OrchestrationRequest
                                         + assistant_mode
                                         + actor_role
                                              │
                                         IntelligentOrchestrator
                                         .handle_request()
                                              │
                                         build_contract()
                                         ┌───────────────────────────────┐
                                         │ ConversationalContract         │
                                         │  mode: DOCTOR_PROFESSIONAL    │
                                         │  triage_allowed: False        │
                                         │  capabilities: {...}          │
                                         └───────────────────────────────┘
                                              │
                                         decision_core.process_input()
                                              │
                                         ┌── TRIAGE GATE ──────────────┐
                                         │ 1. contract.triage_allowed? │
                                         │ 2. intent in NON_TRIAGE?    │
                                         │ 3. confidence >= MIN?       │
                                         │ 4. explicit_symptoms exist? │
                                         └─────────────────────────────┘
                                              │ Si alguno falla: NO TRIAGE
                                              ▼
                                         generate_response() → respuesta
```

### Nuevos módulos creados

| Módulo | Responsabilidad |
|--------|----------------|
| `brain/contracts/routing.py` | Enums, schemas, capacidades, factory |
| `brain/routing/triage_eligibility.py` | Validador de elegibilidad de triage |
| `brain/routing/role_router.py` | Router determinístico por rol |

---

## 2. Contratos

### AssistantMode

```python
class AssistantMode(str, Enum):
    DOCTOR_PROFESSIONAL  = "doctor_professional"   # triage=NEVER
    PATIENT_ASSISTANT    = "patient_assistant"     # triage=False
    PATIENT_TRIAGE       = "patient_triage"        # triage=SOLO con criterios
    RECEPTIONIST         = "receptionist"          # triage=False
    ADMINISTRATIVE       = "administrative"        # triage=False
    GENERIC_NON_CLINICAL = "generic_non_clinical"  # triage=False (default restrictivo)
```

### Capacidades por modo

| Modo | triage | diagnosis | scheduling | clinical_reasoning | imaging |
|------|--------|-----------|------------|-------------------|---------|
| doctor_professional | **False** | False | True | **True** | **True** |
| patient_assistant | False | False | True | False | False |
| patient_triage | **True** | False | True | False | False |
| receptionist | False | False | True | False | False |
| administrative | False | False | True | False | False |
| generic_non_clinical | False | False | False | False | False |

`imaging_allowed=True` en doctor_professional está preparado para futuras capas RMN/TAC/RX.

---

## 3. Invariantes (No negociables)

### INVARIANT A — Doctor nunca entra a triage automático
```
AssistantMode.DOCTOR_PROFESSIONAL
    → triage_allowed = False (hardcoded en _CAPABILITIES_MAP)
    → RoleRouter siempre devuelve DOCTOR_PIPELINE
    → TriageEligibilityValidator retorna NOT_TRIAGEABLE sin evaluar el resto
```
**Verificado en test:** `TestCasoA::test_doctor_mode_no_triage_allowed`

### INVARIANT B — general_query nunca genera symptom classification
```
NON_TRIAGE_INTENTS incluye: general_query, greeting, small_talk, booking,
    cancel_booking, check_availability, unknown, farewell, help, SYSTEM_RESET,
    administrative, schedule_query, confirmation
→ Si intent en NON_TRIAGE_INTENTS: triage gate bloqueado
```
**Verificado en test:** `TestCasoD::test_general_query_in_non_triage_intents`

### INVARIANT C — Triage requiere TODOS los criterios simultáneos
```
1. contract.capabilities.triage_allowed == True
2. intent in CLINICAL_INTENTS (no en NON_TRIAGE_INTENTS)
3. confidence >= MIN_TRIAGE_CONFIDENCE (0.65)
4. síntomas explícitos en contexto estructurado (NO user_input crudo)
```
**Verificado en test:** `TestCasoC::test_triage_eligible_with_clinical_intent_and_symptoms`

### INVARIANT D — Si el router falla → safe fallback
```
RoleRouter.route() → try/except → (SAFE_FALLBACK, NOT_TRIAGEABLE)
_fallback_decision() → retorna dict estático sin evaluar triage
```
**Verificado en test:** `TestCasoE::test_generic_non_clinical_gets_safe_fallback`

### INVARIANT E — Doctor / Paciente son pipelines excluyentes
```
DOCTOR_PROFESSIONAL → DOCTOR_PIPELINE (para CUALQUIER intent, incluso symptom_report)
PATIENT_TRIAGE → PATIENT_PIPELINE o TRIAGE_PIPELINE (nunca DOCTOR_PIPELINE)
```
**Verificado en test:** `TestRoleIsolation::test_doctor_never_gets_triage_pipeline`

---

## 4. Routing Flow

```
handle_request(user_input, assistant_mode, actor_role)
    │
    ├─ build_contract(mode_raw, actor_role_raw)
    │       → AssistantMode.from_raw()  (inválido → GENERIC_NON_CLINICAL)
    │       → ActorRole.from_raw()      (inválido → SYSTEM)
    │       → get_capabilities(mode)
    │
    ├─ decision_core.process_input(user_input, context, contract=contract)
    │       │
    │       ├─ detect_intent() → NLU → intent, confidence
    │       │
    │       ├─ TRIAGE GATE:
    │       │       ┌── contract.triage_allowed? ──No──► NO TRIAGE
    │       │       ├── intent in NON_TRIAGE? ─────No──► NO TRIAGE
    │       │       ├── confidence < MIN? ──────────No──► pedir aclaración
    │       │       └── TriageEligibilityValidator.validate()
    │       │               → explicit_symptoms? ──No──► NO TRIAGE
    │       │               → TRIAGE_ELIGIBLE ────────► evaluate_triage()
    │       │
    │       └─ generate_response(intent, triage, context)
    │
    └─ return message + metadata (assistant_mode, triage_gate, routing_trace)
```

---

## 5. Triage Gating

### Antes (BUG)
```python
# triage_engine.py — eliminado
if not matched and symptoms:
    best_level = "verde"          # "sabes que dia es hoy" → verde
    matched.append("sintoma_generico")  # texto libre → sintoma

# decision_core.py — eliminado
symptoms = context.get("symptoms") or [user_input]  # user_input como síntoma
```

### Después (FIX)
```python
# triage_engine.py
if not matched:
    best_level = "azul"   # texto sin regla clínica → no urgente, sin clasificar

# decision_core.py — evaluate_triage solo con síntomas explícitos validados
if explicit_symptoms is not None:
    symptoms = explicit_symptoms     # validados por TriageEligibilityValidator
else:
    symptoms = context.get("symptoms") or []   # NO user_input crudo
if not symptoms:
    return dict(_FALLBACK_TRIAGE)    # sin síntomas → sin triage
```

---

## 6. Fallback Hierarchy

```
1. contract.triage_allowed=False → FALLBACK_TRIAGE (dict estático vacío)
2. intent in NON_TRIAGE_INTENTS  → FALLBACK_TRIAGE
3. confidence < MIN              → FALLBACK_TRIAGE + flag "needs_clarification"
4. no explicit_symptoms          → FALLBACK_TRIAGE
5. triage_engine exception       → FALLBACK_TRIAGE + log error
6. orchestrator exception        → _fallback_decision() (estático, sin triage)
7. router exception              → (SAFE_FALLBACK, NOT_TRIAGEABLE)
```

**PROHIBIDO en toda la jerarquía:**
- Usar user_input como síntoma
- Generar `sintoma_generico`
- Ejecutar triage para DOCTOR_PROFESSIONAL
- Retornar respuesta clínica cuando triage no se ejecutó

---

## 7. Observabilidad

### Campos de audit trail en la respuesta del orchestrator

```json
{
  "metadata": {
    "assistant_mode": "doctor_professional",
    "actor_role": "doctor",
    "triage_allowed": false,
    "context_type": "casual"
  }
}
```

### Routing trace en decision_core output

```json
{
  "_routing_trace": {
    "mode": "doctor_professional",
    "intent": "general_query",
    "confidence": 0.85,
    "triage_allowed_by_contract": false,
    "triage_gate": "BLOCKED_BY_CONTRACT",
    "triage_gate_reason": "mode=doctor_professional",
    "triage_executed": false
  }
}
```

### Logs de invariantes

```
[REQ-ID] decision-core → intent=general_query confidence=0.85
    mode=doctor_professional triage_gate=BLOCKED_BY_CONTRACT
```

### PHI sanitizado en todos los logs
- No tokens, no cookies, no JWTs
- No emails, no phones, no DNI en logs de routing

---

## 8. Riesgos Mitigados

| Riesgo | Antes | Después |
|--------|-------|---------|
| "sabes que dia es hoy" → urgencia verde | **ACTIVO** | BLOQUEADO por INVARIANT A+B |
| texto libre → sintoma_generico | **ACTIVO** | ELIMINADO de triage_engine |
| user_input como síntoma | **ACTIVO** | BLOQUEADO: evaluate_triage requiere explicit_symptoms |
| fallback con triage en error path | **ACTIVO** | _fallback_decision() es estático sin triage |
| modo desconocido → pipeline médico | **ACTIVO** | GENERIC_NON_CLINICAL + SAFE_FALLBACK |
| doctor en pipeline de paciente | **ACTIVO** | INVARIANT E: pipelines excluyentes |
| general_query → clasificación síntomas | **ACTIVO** | NON_TRIAGE_INTENTS gate |

---

## 9. Compatibilidad Futura — IA Clínica

### Agregar nuevo AssistantMode
1. Agregar entry en `AssistantMode` enum
2. Agregar `ClinicalCapabilities` en `_CAPABILITIES_MAP`
3. Agregar case en `RoleRouter._route_internal()`
4. Agregar tests correspondientes
5. `triage_allowed` debe ser `False` por default hasta validación clínica completa

### Nueva capa de NLU clínica
1. Agregar intent en `CLINICAL_INTENTS` (no en `NON_TRIAGE_INTENTS`)
2. El `TriageEligibilityValidator` lo habilitará automáticamente para `patient_triage`
3. Los médicos seguirán sin acceso (INVARIANT A)

---

## 10. Compatibilidad Futura — RMN/TAC/RX

El contrato ya tiene `imaging_allowed=True` para `DOCTOR_PROFESSIONAL`.

### Extensión de contratos para imaging
```python
# brain/contracts/routing.py — cuando sea necesario:
@dataclass(frozen=True)
class ClinicalCapabilities:
    imaging_allowed: bool = False          # ya existe
    # Futuro:
    # dicom_read_allowed: bool = False
    # imaging_report_allowed: bool = False
    # imaging_type_allowed: set[str] = field(default_factory=set)
```

### Pipeline de imaging
El `ConversationalContract.to_context_dict()` ya propaga `_imaging_allowed`.
Cuando se implemente, el pipeline de imaging debe verificar este flag ANTES
de procesar cualquier DICOM o imagen médica.

---

## 11. Rollback

Para revertir todos los cambios de routing:

```bash
# Revertir solo los archivos de routing (sin afectar la lógica existente)
git checkout HEAD -- brain/decision_engine/triage_engine.py
git checkout HEAD -- brain/core/decision_core.py
git checkout HEAD -- brain/orchestration/orchestrator.py
git checkout HEAD -- brain/app.py
git checkout HEAD -- medical-agenda-saas/src/lib/brain-client.ts
git checkout HEAD -- medical-agenda-saas/src/chat/chat.service.ts

# Los nuevos módulos (sin efectos secundarios si no se importan):
# brain/contracts/ y brain/routing/ pueden dejarse sin remover
# ya que son solo utilizados si se importan explícitamente
```

El rollback vuelve al estado PRE-HARDENING donde el bug está activo.
NO recomendado salvo emergencia operacional crítica.

---

## Estado Final

**Implementado:** Arquitectura completa de routing con contratos, invariantes, tests.  
**Tests:** 56/56 PASS.  
**Sintaxis:** 10/10 OK.  
**git diff --check:** OK.  
**NO deployado:** Este código está en el working tree, no en producción.  
**Estado:** PRE-PRODUCCIÓN — requiere validación funcional completa antes de activar IA clínica.
