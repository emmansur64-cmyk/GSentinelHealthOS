# BRAIN CORE INPUT CONTRACTS (MINIMOS)

Fecha: 2026-05-15
Tipo: diseno de contrato minimo verificable (fase documental + validadores aislados).

## Principios

- Contratos strict por modo.
- `assistant_mode` determina dominio.
- `allowed_tools` y `forbidden_tools` son obligatorios para enforcement.
- Fail-closed ante modo desconocido o accion fuera de allowlist.

---

## 1) ChatBrainRequest

### Schema minimo

```json
{
  "request_id": "string",
  "tenant_id": "string",
  "actor_id": "string",
  "actor_role": "string",
  "assistant_mode": "doctor_professional | clinical_support",
  "channel": "web_chat",
  "message": "string",
  "patient_context_ref": "string | null",
  "allowed_tools": ["string"],
  "forbidden_tools": ["string"]
}
```

### Prohibiciones obligatorias

- `appointment_write`
- `whatsapp_send`
- `spreadsheet_ingest`

Regla: cualquier tool prohibida presente en `allowed_tools` => RECHAZAR.

---

## 2) SecretaryBrainRequest

### Schema minimo

```json
{
  "request_id": "string",
  "tenant_id": "string",
  "actor_id": "string",
  "actor_role": "secretary | admin",
  "assistant_mode": "secretary_ingestion",
  "channel": "web_upload | admin_panel",
  "document_ref": "string",
  "import_mode": "preview | apply",
  "allowed_tools": ["string"],
  "forbidden_tools": ["string"]
}
```

### Prohibiciones obligatorias

- `clinical_diagnosis`
- `whatsapp_send`
- `full_clinical_history_access`

---

## 3) WhatsappBrainRequest

### Schema minimo

```json
{
  "request_id": "string",
  "tenant_id": "string",
  "channel": "whatsapp",
  "whatsapp_message_id": "string",
  "patient_phone_ref": "string",
  "phone_hash": "string",
  "message": "string",
  "assistant_mode": "appointment_booking",
  "allowed_tools": ["string"],
  "forbidden_tools": ["string"]
}
```

Regla de identidad minima: debe existir `patient_phone_ref` o `phone_hash`.

### Prohibiciones obligatorias

- `clinical_diagnosis`
- `full_clinical_history_access`
- `spreadsheet_ingest`

---

## 4) BrainCoreResponse

### Schema minimo

```json
{
  "request_id": "string",
  "assistant_mode": "string",
  "decision": "string",
  "confidence": 0.0,
  "safe_response": "string",
  "proposed_actions": ["string"],
  "requires_human_review": false,
  "audit_tags": ["string"],
  "forbidden_action_detected": false
}
```

Reglas:

- `assistant_mode` desconocido => fail closed.
- `proposed_actions` solo puede contener acciones en allowlist oficial.

---

## 5) BrainAction

### Allowlist inicial

- `appointment.search_availability`
- `appointment.create_proposal`
- `appointment.confirm`
- `appointment.cancel_request`
- `appointment.reschedule_request`
- `document.parse_preview`
- `document.import_schedule`
- `clinical.chat_response`
- `human.escalate`

### Prohibido

- DB direct write
- prisma direct call
- raw SQL
- send WhatsApp desde MB-Chat
- clinical diagnosis desde MB-Whatsapp

---

## 6) Reglas transversales de enforcement

1. `allowed_tools` no puede intersectar herramientas prohibidas del modo.
2. `forbidden_tools` debe incluir explicitamente todas las prohibidas del modo.
3. `assistant_mode` invalido siempre bloquea (`requires_human_review=true`).
4. Si `proposed_actions` contiene una accion no permitida:
   - bloquear ejecucion
   - setear `forbidden_action_detected=true`
   - escalar a `human.escalate`

---

## 7) Implementacion minima en esta fase (aislada)

Se agrego un validador aislado para fase de diseno tecnico verificado:

- `brain/contracts/core_contracts.py`

Valida:

- `validate_chat_brain_request`
- `validate_secretary_brain_request`
- `validate_whatsapp_brain_request`
- `validate_brain_core_response`
- allowlist `BrainAction`
- guard fail-closed por modo/tool
