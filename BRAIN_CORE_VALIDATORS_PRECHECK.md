# BRAIN CORE VALIDATORS PRECHECK

## Scope
- Integrar incrementalmente validadores de `brain/contracts/core_contracts.py` en entrypoints runtime reales.
- Sin separacion fisica de servicios.
- Sin deploy, restart ni cambios de infraestructura.

## Branch and Baseline
- Branch: `GsentinelH`
- Commits de referencia inmediatos:
  - `6461957` docs(brain-core): define modular contracts and focused guards
  - `6b1d41b` fix(metabrain): harden critical routing guards

## Initial Git State (target files)
- Modified:
  - `brain/contracts/core_contracts.py`
  - `brain/app.py`
  - `api/app/api/v1/endpoints/brain_decide.py`
  - `api/app/api/v1/endpoints/webhooks_whatsapp.py`
  - `brain/tests/test_brain_core_contracts.py`
- Untracked:
  - `brain/tests/test_brain_entrypoint_contract_integration.py`

## Candidate Entrypoints
- `brain/app.py` -> `POST /orchestrate`
- `api/app/api/v1/endpoints/brain_decide.py` -> `POST /api/v1/brain/decide`
- `api/app/api/v1/endpoints/webhooks_whatsapp.py` -> `POST /api/v1/webhooks/whatsapp`

## Risks
- Worktree sucio preexistente: riesgo alto de mezclar cambios no relacionados.
- Compatibilidad legacy: clientes sin `assistant_mode` deben mantener contrato HTTP y fallback seguro.
- Fase incremental: no introducir cambios de API breaking.

## Safety Constraints
- Fail-closed para `assistant_mode` desconocido.
- Defaults legacy restrictivos cuando falta `assistant_mode`.
- No permisos amplios por defecto.
- Solo cambios en archivos objetivo con validacion focal.
