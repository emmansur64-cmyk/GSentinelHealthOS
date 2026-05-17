# PATIENT_HISTORY_ACCESS_CONTRACT_RESULT

## Scope applied
- Applied only inside MB-Chat.
- No changes to WhatsApp, MB-WhatsApp, Redis WhatsApp, Secretaria, agenda, or patient-channel automations.

## Phase 2 - ClinicalActorRole contract continuation
- Doctor path now requires explicit doctor-patient context for professional chat requests.
- Contract validation centralized at service boundary before AI provider calls.
- Contract errors are surfaced as stable errorClass codes in logs:
  - INVALID_DOCTOR_PATIENT_CONTEXT
  - PATIENT_CONTEXT_ACCESS_DENIED
  - PROVIDER_PHI_NOT_ALLOWED

## Phase 3 - Patient Clinical History Access Contract
Implemented in MB-Chat:

1. Explicit DoctorPatientContext contract.
- Added in `src/medical-assistant/doctor-patient-context.contract.ts`.
- Added DTO + request fields in `src/medical-assistant/medical-assistant.types.ts`.

2. Mandatory doctor_id.
- Enforced for doctor role.

3. Mandatory patient_id.
- Enforced for doctor role.

4. Mandatory tenant_id/clinic_id in multi-tenant mode.
- Enforced when `MB_CHAT_MULTI_TENANT=true`.

5. Mandatory encounter_id/appointment_id when active-encounter enforcement is enabled.
- Enforced by default unless `MB_CHAT_REQUIRE_ACTIVE_ENCOUNTER=false`.

6. Generic patient access blocked.
- Access to history is tied to active doctor-patient context IDs.

7. Access to unrelated patients blocked.
- Strict context match enforced (doctor_id, patient_id, tenant/clinic, encounter/appointment).

8. Groq PHI boundary enforced when `safe_for_phi=false`.
- Non-sanitized history is denied with PROVIDER_PHI_NOT_ALLOWED.
- Controlled summary is checked before provider usage.

9. Only minimal controlled clinical summary allowed.
- `activePatientClinicalHistory.clinical_summary` is bounded and requires `is_sanitized=true`.

10. Negative tests added.
- doctor without active patient context.
- patient in another tenant.
- patient without active encounter.
- full history (non-sanitized) sent to Groq path.
- missing patient_id.
- missing doctor_id.

## Test execution
Command executed:
- `npm test -- --runInBand src/medical-assistant/medical-assistant.service.spec.ts src/medical-assistant/medical-assistant.controller.spec.ts src/ai/ai.service.phi-guard.spec.ts`

Result:
- 3 suites passed
- 25 tests passed
- 0 failed

## Final state
MB-Chat is contract-isolated as professional medical chat boundary with explicit doctor-patient active context controls and PHI-safe provider gating for clinical history access.
