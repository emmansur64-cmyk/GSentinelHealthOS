# BRAIN CORE VALIDATOR INTEGRATION MAP

## Runtime Integration Summary

| File | Runtime Point | Integration Type | Mode Handling | Failure Mode |
|---|---|---|---|---|
| `brain/contracts/core_contracts.py` | Core contract layer | Added `validate_runtime_brain_request`, `validate_generic_brain_request`, default forbidden tool helpers, reinforced mode guards | Normaliza modo con fallback `generic_non_clinical`; modo desconocido fail-closed | `ContractValidationError` |
| `brain/app.py` | `POST /orchestrate` | Build payload + validate before calling orchestrator | Usa `assistant_mode` explícito o fallback restrictivo; completa campos legacy opcionales | Respuesta segura `OrchestrationResponse` con `contract_validation_blocked` |
| `api/app/api/v1/endpoints/brain_decide.py` | `POST /brain/decide` | Validate request before NLU + guard intent->tool | `DOCTOR` sin modo => `doctor_professional`; resto fallback restrictivo | `DecideResponse` bloqueada (`CONTRACT_GUARD`) |
| `api/app/api/v1/endpoints/webhooks_whatsapp.py` | `POST /webhooks/whatsapp` | Validate parsed WhatsApp request + guard intent tool | Modo fijo `appointment_booking` | `HTTP 422` (contract) o `HTTP 403` (mode guard) |

## Guard Reinforcement Applied
- `doctor_professional`: bloquea `triage.patient_facing`, `appointment.write`, `whatsapp_send`, `spreadsheet_ingest`.
- `appointment_booking`: bloquea `clinical_diagnosis`, `full_clinical_history_access`, `spreadsheet_ingest` (y alias previos).
- `secretary_ingestion`: bloquea `clinical_diagnosis`, `whatsapp_send`, `full_clinical_history_access`.
- Modo desconocido: fail-closed.

## Legacy Compatibility
- Requests existentes siguen aceptando payload previo (nuevos campos opcionales).
- Defaults restrictivos evitan permisos amplios cuando faltan campos de runtime.
- Bloqueo temprano evita ejecutar NLU/orchestrator cuando el contrato no cumple.
