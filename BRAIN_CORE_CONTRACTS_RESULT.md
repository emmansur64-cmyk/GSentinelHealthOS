# BRAIN CORE CONTRACTS RESULT

Fecha: 2026-05-15
Rama: GsentinelH

## 1. Diagnostico

- Brain Core actual ya tiene guards de routing/triage para rol y modo, pero no contrato MB unificado por dominio de entrada.
- Existen dos contratos activos para Brain (`/orchestrate` y `/api/v1/brain/decide`) con payloads distintos.
- Chat doctor, WhatsApp e importacion administrativa aun comparten componentes y proveedores con acoplamiento.
- No se detecto separacion fisica de MB-Chat/MB-Secretaria/MB-Whatsapp (esperado para fase 1).

## 2. Archivos auditados

- `brain/app.py`
- `brain/orchestration/orchestrator.py`
- `brain/core/decision_core.py`
- `brain/decision_engine/triage_engine.py`
- `brain/contracts/routing.py`
- `brain/routing/role_router.py`
- `brain/routing/triage_eligibility.py`
- `brain/main.py`
- `brain/services/orchestrator.py`
- `brain/services/whatsapp_appointment_intake_service.py`
- `brain/integration/api_client.py`
- `api/app/api/v1/endpoints/brain_decide.py`
- `api/app/main.py`
- `medical-agenda-saas/src/lib/brain-client.ts`
- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/app/chat/doctor/route.ts`
- `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts`
- `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts`
- `medical-agenda-saas/src/app/api/import/agenda/parse/route.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`

## 3. Documentos creados

- `BRAIN_CORE_CONTRACTS_PRECHECK.md`
- `BRAIN_CORE_CURRENT_STATE_AUDIT.md`
- `BRAIN_CORE_BOUNDED_CONTEXTS.md`
- `BRAIN_CORE_INPUT_CONTRACTS.md`
- `BRAIN_CORE_CONTRACT_GAP_MATRIX.md`
- `BRAIN_CORE_MODE_GUARDS_DESIGN.md`
- `BRAIN_CORE_PROVIDER_CONFIG_DESIGN.md`
- `BRAIN_CORE_CONTRACTS_RESULT.md`

## 4. Contratos definidos

- ChatBrainRequest
- SecretaryBrainRequest
- WhatsappBrainRequest
- BrainCoreResponse
- BrainAction allowlist inicial

Implementacion minima aislada:

- `brain/contracts/core_contracts.py`
  - validadores de request por dominio
  - validador de response/acciones
  - guard fail-closed por modo/tool

## 5. Gaps encontrados

1. Falta enforcement de `allowed_tools/forbidden_tools` en entrypoints actuales.
2. Contrato dual Brain (`/orchestrate` vs `/api/v1/brain/decide`).
3. WhatsApp combina agenda + providers clinicos sin contrato MB explicito.
4. Import secretaria no usa aun contrato `secretary_ingestion` formal.
5. Falta allowlist central ejecutable de `BrainAction` en runtime.

## 6. Guards disenados o implementados

- Disenados: reglas de modo para MB-Chat/MB-Secretaria/MB-Whatsapp.
- Implementados (aislados): `evaluate_mode_guard(...)` en `brain/contracts/core_contracts.py`.
- Guards preexistentes aprovechados: `routing.py`, `triage_eligibility.py`, `decision_core.py`.

## 7. Tests ejecutados

- `e:/GSentinelHealthOS/.venv_runtime_lab/Scripts/python.exe -m pytest brain/tests/test_brain_core_contracts.py -q`
  - Resultado: 7 passed
- `e:/GSentinelHealthOS/.venv_runtime_lab/Scripts/python.exe -m py_compile brain/contracts/core_contracts.py brain/tests/test_brain_core_contracts.py`
  - Resultado: OK (sin errores)
- `git diff --check -- <archivos tocados en esta fase>`
  - Resultado: OK (sin whitespace/conflict issues)
- Barrido defensivo de secretos (`Select-String` sobre archivos tocados)
  - Resultado: sin hallazgos

## 8. Riesgos restantes

- Riesgo de drift funcional por coexistencia de rutas legacy y modernas.
- Riesgo de mezcla de dominios mientras no se inyecte contrato MB en todos los entrypoints.
- Riesgo operativo por worktree preexistente muy sucio.

## 9. Proximo paso seguro

- Integrar validadores de `core_contracts.py` en wrappers de entrada (chat, whatsapp, secretaria) sin mover carpetas.
- Unificar capa de respuesta con `BrainCoreResponse` + `BrainAction` allowlist.
- Mantener deprecacion controlada de `/api/v1/brain/decide`.

## 10. Confirmaciones explicitas

- NO deploy
- NO restart
- NO produccion
- NO duplicacion Brain
- NO creacion fisica todavia de MB-Chat / MB-Secretaria / MB-Whatsapp
- NO migracion medical-agenda-saas
