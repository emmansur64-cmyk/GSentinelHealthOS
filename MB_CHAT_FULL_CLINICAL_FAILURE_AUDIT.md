# MB-Chat Full Clinical Reasoning Failure Audit (LAB)

## 1. Executive Summary

This document replaces the previous template with a real LAB audit executed with commands, payloads, live responses, and service logs.

Main finding:
- MB-Chat clinical reasoning is not reliable in current LAB runtime for doctor mode.
- Complex neurological reasoning (anti-NMDAR) degrades to generic/non-clinical outputs.
- When provider path is unavailable, fallback path routes to non-clinical logic.

Final verdict:
- PRODUCTION SHOULD BE PAUSED for MB-Chat clinical reasoning workflows until the root causes below are corrected and re-validated.

---

## 2. Scope and Constraints

- Scope: LAB runtime only.
- No production changes.
- No deploys.
- No DB schema/data mutation beyond read-only probes and endpoint calls.
- No source code modifications during this audit.

---

## 3. Runtime Snapshot (Observed)

- Active stack:
	- gs_api on 127.0.0.1:8000
	- gs_brain internal on 8001
	- gs_frontend internal (Next server)
- Precanary compose was not raised due host port conflict at 55433 with existing gs_db container.

Relevant runtime env (observed in container):
- gs_frontend:
	- BRAIN_API_URL=http://brain:8001
	- BRAIN_API_KEY_LEN=36
	- GROQ_API_KEY_LEN=56

---

## 4. Mandatory Search Execution (Real)

The mandatory keyword searches were executed over source paths (medical-agenda-saas/src, brain, api) using grep filters.

Key confirmed matches:
- Weather/runtime context injection:
	- medical-agenda-saas/src/chat/chat.service.ts (forced weather/date decisions, open-meteo source text)
	- medical-agenda-saas/src/lib/medical-runtime-context/weather-context.ts (Open-Meteo fetch)
	- medical-agenda-saas/src/lib/groq-doctor-chat.ts (runtime context prompt injection)
- Routing/fallback/assistant mode:
	- medical-agenda-saas/src/lib/brain-client.ts (/orchestrate first, fallback to /api/v1/brain/decide)
	- api/app/api/v1/endpoints/brain_decide.py (intent mapping and response templates)
	- brain/interpreters/nlu_engine.py (general_query default classifier)
	- brain/core/decision_core.py and brain/orchestration/orchestrator.py (triage gate + fallback flow)
- Orchestration references:
	- brain/app.py (POST /orchestrate)
	- brain/orchestration/orchestrator.py

---

## 5. End-to-End Pipeline Mapping (Verified in Code)

Frontend to renderer:
1. Doctor UI sends message in doctor dashboard.
	 - medical-agenda-saas/src/components/doctor-dashboard.tsx
2. POST /chat/doctor route validates auth/role and forwards to service.
	 - medical-agenda-saas/src/app/chat/doctor/route.ts
3. handleDoctorChat builds shared context (patient/history/metadata/runtime/web/memory).
	 - medical-agenda-saas/src/chat/chat.service.ts
4. Decision order in handleDoctorChat:
	 - Forced date/time and forced weather rule responses first.
	 - Then callGroqDoctorChat.
	 - If null, callBrainDecide via brain-client.
5. callBrainDecide order:
	 - POST /orchestrate first.
	 - If /orchestrate non-OK, fallback POST /api/v1/brain/decide.
	 - medical-agenda-saas/src/lib/brain-client.ts
6. UI renderer prints response text directly.
	 - message.content rendered as plain text in chat bubble.
	 - medical-agenda-saas/src/components/doctor-dashboard.tsx

---

## 6. Real Reproduction Matrix

### 6.1 Legacy endpoint: /api/v1/brain/decide (LAB)

Endpoint tested:
- http://127.0.0.1:8000/api/v1/brain/decide

Headers:
- X-Internal-Key: valid internal key from gs_api

Cases executed:

| Case | Status | action/source | Observed response behavior |
|---|---:|---|---|
| A_saludo_simple | 200 | general_query / METABRAIN | Turno-oriented generic prompt |
| B_pregunta_medica_breve | 200 | general_query / METABRAIN | Urgencia template + agenda action |
| D_anti_nmdar_largo | 200 | general_query / METABRAIN | Agenda template, no structured clinical reasoning |
| PF_invalid_key | 403 | auth error | X-Internal-Key invalida |

Critical anti-NMDAR result (raw):
```json
{
	"action": "general_query",
	"response": "He recibido su consulta. Por favor indique si desea agendar, cancelar o consultar disponibilidad de turnos. Especialidad identificada: Medicina General. Paciente: Paciente LAB.",
	"confidence": 0.5,
	"source": "METABRAIN",
	"model_version": "metabrain-v1"
}
```

Correlated API logs:
```text
{"logger":"api.app.api.v1.endpoints.brain_decide","message":"brain/decide: intent=general_query source=METABRAIN confidence=0.50 role=DOCTOR mode=doctor_professional"}
POST /api/v1/brain/decide 200 OK
POST /api/v1/brain/decide 403 Forbidden
```

### 6.2 Main endpoint: /orchestrate (Brain)

Endpoint tested from container network:
- http://brain:8001/orchestrate

Cases executed with frontend key:

| Case | Status | metadata.services_called | Observed response behavior |
|---|---:|---|---|
| A_saludo_simple | 200 | orchestrator-shortcut | Casual greeting shortcut |
| B_pregunta_medica_breve | 200 | decision-core | Generic conversational clinical text, non-specific |
| D_anti_nmdar_largo | 200 | decision-core | Generic summary, no requested structured differential/UCI sequence |
| PF_invalid_key | 401 | n/a | X-Internal-Key invalida o ausente |

Anti-NMDAR /orchestrate response (raw fragment):
```json
{
	"message": "Por lo que describis, se destacan ... Podemos ajustar esto con mas informacion.",
	"metadata": {
		"confidence": 0.5,
		"services_called": ["decision-core"],
		"assistant_mode": "doctor_professional",
		"actor_role": "doctor",
		"triage_allowed": false
	}
}
```

Correlated brain logs (transport level):
```text
POST /orchestrate 200 OK
POST /orchestrate 401 Unauthorized
```

### 6.3 Structured probe to trigger clinical_case path

A structured accented clinical text probe was executed on /orchestrate.

Observed response:
- Entered clinical path and returned fixed rhabdomyolysis-oriented output:
	- "El cuadro es compatible con cuadro muscular agudo inducida por esfuerzo"
	- "hidratacion agresiva"
	- triage_level verde in this probe

This is clinically unrelated to anti-NMDAR reasoning goals and demonstrates domain bias in the structured clinical branch.

---

## 7. Provider Audit (Real)

Direct provider probes from LAB network:

1. GET https://api.groq.com/openai/v1/models
	 - Status: 403
	 - Body: error code: 1010

2. POST https://api.groq.com/openai/v1/chat/completions
	 - Status: 403
	 - Body: error code: 1010

Impact in code path:
- medical-agenda-saas/src/lib/groq-doctor-chat.ts
	- On !response.ok, callGroqDoctorChat logs warning and returns null.
- medical-agenda-saas/src/chat/chat.service.ts
	- Null Groq result triggers callBrainDecide fallback path.

Conclusion:
- Provider failure is not hypothetical in current LAB runtime; it is reproducible.

---

## 8. Prompt Audit (Sanitized, Code-Verified)

Prompt assembly source:
- medical-agenda-saas/src/lib/groq-doctor-chat.ts

System prompt constraints include:
- doctor-only conversation
- no appointment scheduling behavior
- use runtime context for date/time
- use structured medical reasoning and specialty protocol when present

Message order sent to Groq:
1. system prompt
2. Contexto clinico disponible (JSON)
3. Doctor profile context (if available)
4. Conversational medical memory (if available)
5. Runtime context (if available)
6. Web evidence context (if available)
7. Specialty protocol (if available)
8. Structured medical reasoning (if available)
9. Conversation history
10. Current user message

Truncation/compaction behavior:
- clip() trims long context fields before prompt construction.

Note:
- Raw runtime prompt payload was reconstructed from exact source flow.
- No successful provider completion was available in LAB due 403 provider errors.

---

## 9. Root Cause Analysis (Evidence-Based)

### RC-1: Provider path unavailable in LAB
- Evidence: Groq endpoints return 403 error code 1010.
- Effect: callGroqDoctorChat returns null.

### RC-2: Doctor fallback enters non-clinical/generic logic
- Evidence: chat.service fallback chain Groq -> brain-client.
- Evidence: brain-client uses /orchestrate then legacy /api/v1/brain/decide fallback.

### RC-3: /orchestrate default clinical response is generic template, not deep reasoning
- Evidence: anti-NMDAR /orchestrate returns generic text with confidence 0.5 and services_called=[decision-core].
- Evidence in code: linguistic_engine uses generic intro/symptom/ending templates.

### RC-4: Legacy /brain/decide is appointment-intent NLU, not clinical reasoning engine
- Evidence in code:
	- Intent set limited to book_appointment/cancel/check_availability/general_query.
	- general_query response explicitly asks to agendar/cancelar/consultar turnos.
- Evidence in runtime: anti-NMDAR returns action=general_query and turno-oriented response.

### RC-5: Structured clinical path is narrow and biased
- clinical_detector requires long text and specific accented keywords.
- clinical_parser parses a narrow symptom/lab set (muscle pain/myoglobinuria/CK/creatinina/potasio/crossfit).
- clinical summary generation is rhabdomyolysis-oriented with fixed action templates.
- This does not represent robust multi-domain neurological reasoning.

---

## 10. Risk and Severity

Clinical safety risk: CRITICAL
- Complex cases can degrade to:
	- appointment workflow text,
	- generic non-actionable text,
	- clinically biased template unrelated to actual differential.

Operational risk: HIGH
- Failure mode is silent at user level (HTTP 200 with plausible text).

Audit confidence: HIGH for reproduced failure paths in LAB.

---

## 11. Production Decision

### VERDICT: PRODUCTION SHOULD BE PAUSED

Scope of pause:
- MB-Chat clinical reasoning for doctor workflows.

Reason:
- Reproducible inability to provide reliable structured reasoning in severe cases.
- Real provider unavailability currently activates fallback paths that are not clinically equivalent.

---

## 12. What Was and Was Not Changed

Changed:
- Only runtime probes, endpoint calls, grep-based code audit, and log extraction.

Not changed:
- No source code modifications.
- No production config changes.
- No deployment actions.
- No DB migration or schema changes.

---

## 13. Evidence Appendix (Command-Level)

Representative executed probes:
- POST http://127.0.0.1:8000/api/v1/brain/decide (A, B, anti-NMDAR, invalid-key)
- docker logs gs_api --since 10m
- POST http://brain:8001/orchestrate (A, B, anti-NMDAR, invalid-key)
- docker logs gs_brain --since 10m
- GET https://api.groq.com/openai/v1/models
- POST https://api.groq.com/openai/v1/chat/completions
- Mandatory search commands for:
	- open-meteo|weather|context|operational context
	- general_query|triage|fallback|assistant_mode|doctor|clinical
	- provider fallback|nextModule|orchestration|compose_response