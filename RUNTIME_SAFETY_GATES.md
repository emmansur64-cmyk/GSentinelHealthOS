# RUNTIME SAFETY GATES

## Activation gates

Para cualquier activacion futura deben cumplirse todos los gates:

- `AI_RUNTIME_KILL_SWITCH=true` durante shadow inicial.
- `AI_RUNTIME_ENABLED=false` hasta validacion clinica y operativa.
- `AI_RUNTIME_DRY_RUN=true`.
- `AI_RUNTIME_BLOCKING_ENABLED=false`.
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`.
- `OBSERVABILITY_PHI_ALLOWED=false`.
- Rollback probado antes de canary.
- Validacion humana antes de cualquier enforcement clinico.

## Blockers

Bloquean activacion:

- Runtime IA global habilitado sin kill switch.
- Blocking clinico sin human review.
- Vision medica real sin revision clinica formal.
- DICOM real.
- Multimodal clinico real.
- PHI a providers externos sin policy aprobada.
- Vector DB global o patient scope activo sin review.
- Telemetry externa con PHI.

## Kill switch tests

Estado esperado:

- `AI_RUNTIME_KILL_SWITCH=true`
- `guard.allowed=false`
- `fallback_required=true`
- `action=continue_existing_runtime_flow`

El wiring actual respeta ese estado y nunca cambia el output real.

## PHI restrictions

- No se leen bodies de request en el middleware.
- Query params no se registran.
- Headers sensibles se redactan por marcador: authorization, cookie, token, secret, key.
- Payloads complejos quedan como `[SUMMARY_ONLY]`.
- Export externo deshabilitado.

## Provider restrictions

- `LLM_PROVIDER_ROUTER_ENABLED=false`.
- `LLM_PROVIDER_MULTIMODAL_ENABLED=false`.
- `LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED=false`.
- `LLM_PROVIDER_PHI_ALLOWED=false`.
- No hay llamadas de red nuevas.

## Escalation restrictions

- Human review queda pasivo y pendiente.
- No hay bloqueo automatico.
- No hay escalacion automatica productiva.
- No hay diagnostico definitivo.

## Runtime guard

El snapshot de guard se inicializa en startup y se conserva en `app.state.runtime_integration_snapshot`.
Si falta configuracion, se usan defaults seguros.
