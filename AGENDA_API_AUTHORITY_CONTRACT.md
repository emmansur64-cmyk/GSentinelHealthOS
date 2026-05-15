# AGENDA API AUTHORITY CONTRACT

## 1) Operaciones autorizadas (fuente oficial)
Agenda API (`/api/v1/appointments`) pasa a ser la autoridad explicita para:
- crear turnos
- modificar turnos
- cancelar turnos
- reprogramar turnos
- consultar disponibilidad oficial de slot (`/api/v1/appointments/gateway/validate-slot`)
- aplicar disponibilidad medica importada cuando el flujo de import sea migrado

## 2) Operaciones prohibidas fuera de Agenda API
Prohibidas para callers externos cuando enforcement estricto este activo:
- `appointment.write` fuera de Agenda API
- cancelacion directa de agenda fuera de Agenda API
- reprogramacion directa fuera de Agenda API

Temporalmente permitido en fase incremental:
- bypass legacy con warning estructurado (`agenda_authority.legacy_bypass`) para no romper runtime
- lecturas legacy necesarias

## 3) Contratos minimos request/response
### Create appointment
- Endpoint: `POST /api/v1/appointments`
- Request minimo:
  - `doctor_id` (UUID)
  - `patient_id` (UUID)
  - `date_time` (ISO)
  - `status` (`scheduled` recomendado)
  - `reason` (opcional)
- Headers:
  - `X-Internal-Key`
  - `X-Clinic-Id`
  - `Idempotency-Key` (recomendado)
- Response minima:
  - `id`
  - `doctor_id`
  - `patient_id`
  - `date_time`
  - `status`

### Availability validation
- Endpoint: `POST /api/v1/appointments/gateway/validate-slot?doctor_id=<uuid>&appointment_time=<iso>`
- Response:
  - `available` (bool)
  - `message` (string)

## 4) Roles permitidos
- Servicios internos con API Key valida (`gateway`, `brain`) segun scopes.
- Usuarios JWT segun reglas del endpoint.

## 5) assistant_mode permitido
- `appointment_booking`: permitido para `appointment.write` via Agenda API.
- `doctor_professional`: no autorizado para `appointment.write` directo.
- desconocido: fail-closed.

## 6) scopes esperados
- create: `appointments:create`
- read/list/lookup: `appointments:read`
- validate-slot: `appointments:validate-slot`

## 7) fallback seguro
- Si Agenda API no responde, se permite fallback legacy controlado solo durante fase incremental.
- El fallback deja warning estructurado y trazable.
- En modo estricto (`AGENDA_API_ALLOW_LEGACY_WRITE_BYPASS=false`) el write queda bloqueado.

## 8) comportamiento ante fallo
- Error de autenticacion/scope -> rechazo sin write.
- Error de red/timeouts -> respuesta controlada y fallback segun modo.
- request invalido -> fail-closed.

## 9) reglas de idempotencia
- `Idempotency-Key` obligatorio recomendado para writes desde callers de mensajeria.
- Reintentos deben reutilizar la misma key.

## 10) reglas de auditoria/logging
- Logging estructurado obligatorio para bypass y fallback:
  - `agenda_authority.legacy_bypass`
  - `agenda_authority.create_fallback_legacy`
  - `agenda_authority.availability_fallback_legacy`
- No incluir PHI/PII en texto de log.
