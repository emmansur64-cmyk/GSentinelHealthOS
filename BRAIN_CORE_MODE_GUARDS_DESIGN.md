# BRAIN CORE MODE GUARDS DESIGN

Fecha: 2026-05-15
Estado: diseno + implementacion minima aislada (sin romper flujos actuales).

## 1. Objetivo

Evitar mezcla de dominios entre MB-Chat, MB-Secretaria y MB-Whatsapp mediante guards fail-closed por `assistant_mode` y herramienta solicitada.

## 2. Reglas de guard requeridas

1. `doctor_professional` no puede usar triage patient-facing.
2. `appointment_booking` no puede emitir diagnostico medico.
3. `secretary_ingestion` no puede acceder historia clinica completa.
4. canal WhatsApp no puede invocar herramientas clinicas profundas.
5. chat medico no puede escribir agenda.

## 3. Guard ya existentes (evidencia)

- `brain/contracts/routing.py`
  - `doctor_professional` con `triage_allowed=False`
- `brain/core/decision_core.py`
  - gate de triage por contrato + intent + sintomas explicitos
- `brain/routing/triage_eligibility.py`
  - invariante A/B/C (bloqueos explicitos)

## 4. Implementacion minima agregada en esta fase

Archivo nuevo: `brain/contracts/core_contracts.py`

- Funcion: `evaluate_mode_guard(mode, requested_tool)`
- Comportamiento:
  - fail-closed si `assistant_mode` desconocido
  - deniega pares modo-tool fuera de dominio
  - retorna `ModeGuardResult(allowed, reason)`

Bloqueos implementados:

- `doctor_professional` bloquea:
  - `triage.patient_facing`
  - `appointment.write`
- `appointment_booking` bloquea:
  - `clinical.diagnosis`
  - `clinical.history.full_access`
  - `clinical.deep_tool`
- `secretary_ingestion` bloquea:
  - `clinical.history.full_access`
  - `clinical.diagnosis`
  - `whatsapp.send`

## 5. Estrategia de adopcion sin romper runtime

Fase 1 (actual):
- guard y validadores aislados, no inyectados aun en todos los entrypoints.

Fase 2:
- aplicar guard en wrappers de entrada por dominio:
  - chat doctor
  - whatsapp assistant
  - import secretaria

Fase 3:
- enforcement en Brain Core previo a ejecucion de acciones (`BrainAction`).

## 6. Testeabilidad

Tests focales agregados:

- `brain/tests/test_brain_core_contracts.py`

Cubre:

- bloqueo de herramientas cruzadas por modo
- fail-closed de modo desconocido
- enforcement de allow/forbidden tools

## 7. Impacto y seguridad

- Cambio pequeno y aislado.
- Sin side effects de runtime.
- Sin cambios de deploy/restart.
- Sin cambios sobre produccion.
