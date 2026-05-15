# BRAIN CORE ENTRYPOINTS AUDIT

## Goal
Mapear entrypoints runtime relevantes para enforcement de contratos modulares y guards por modo.

## Entrypoint Matrix

| Domain | File | Function/Route | Request Type | Target Mode | Contract Validator | Integration Risk |
|---|---|---|---|---|---|---|
| Doctor chat orchestration | `brain/app.py` | `orchestrate` (`POST /orchestrate`) | `OrchestrationRequest` | `doctor_professional` o fallback legacy restrictivo | `validate_runtime_brain_request` | Medio: debe preservar respuesta `OrchestrationResponse` |
| Legacy brain NLU | `api/app/api/v1/endpoints/brain_decide.py` | `brain_decide` (`POST /brain/decide`) | `DecideRequest` | Derivado por rol (`DOCTOR`->`doctor_professional`) o fallback restrictivo | `validate_runtime_brain_request` + `evaluate_mode_guard` | Medio: endpoint usado por integraciones legacy |
| WhatsApp webhook legacy | `api/app/api/v1/endpoints/webhooks_whatsapp.py` | `receive_whatsapp_webhook` (`POST /webhooks/whatsapp`) | Meta webhook payload parseado | `appointment_booking` | `validate_runtime_brain_request` + `evaluate_mode_guard` | Bajo-Medio: flujo ya acotado por intent |

## Coverage Notes
- Doctor-facing: cubierto en `/orchestrate` y `/brain/decide`.
- WhatsApp patient-facing: cubierto en webhook legacy.
- Secretary/import:
  - No entrypoint Python directo equivalente al contrato de ingest (`secretary_ingestion`) en este cambio.
  - Se mantiene para siguiente incremento sobre rutas de import/document ingest cuando se identifique el endpoint runtime canónico.

## Compatibility Decisions
- Campos nuevos en requests son opcionales (no breaking).
- Si falta `assistant_mode`:
  - `/orchestrate`: `generic_non_clinical` (restrictivo)
  - `/brain/decide`: `doctor_professional` solo para rol `DOCTOR`; resto `generic_non_clinical`
- `assistant_mode` desconocido: bloqueo fail-closed.
