# Scope Validation Matrix

Fecha: 2026-05-15

## Resumen

Se detectó que `API_KEY_SCOPES` existía, pero `validate_hybrid_auth()` no validaba el scope por endpoint y además llamaba `validate_api_key()` con una firma incorrecta. Se corrigió la validación común y se aplicaron scopes solo donde ya existían scopes declarados.

## Scopes existentes

| Servicio | Scopes |
|---|---|
| `gateway` | `appointments:create`, `appointments:validate-slot`, `patients:read-by-phone`, `patients:create-shadow` |
| `brain` | `appointments:read`, `patients:read`, `appointments:analyse` |

## Matriz

| endpoint | método HTTP | archivo | acción | requiere auth sí/no | scope esperado | scope validado actualmente | riesgo | corrección propuesta |
|---|---|---|---|---|---|---|---|---|
| `/api/v1/appointments` | POST | `api/app/api/v1/endpoints/appointments.py` | Crear cita | Sí | `appointments:create` | Sí | Alto antes: Brain podía crear si tenía API key válida. | Aplicado. |
| `/api/v1/appointments/queue/enqueue` | POST | `api/app/api/v1/endpoints/appointments.py` | Encolar reserva | Sí | `appointments:create` | Sí | Alto antes. | Aplicado. |
| `/api/v1/appointments/queue/result/{request_id}` | GET | `api/app/api/v1/endpoints/appointments.py` | Leer resultado async | Sí | `appointments:read` | Sí | Medio. | Aplicado. |
| `/api/v1/appointments/patient/{patient_id}` | GET | `api/app/api/v1/endpoints/appointments.py` | Leer turnos paciente | Sí | `appointments:read` | Sí | Alto por PHI/agenda. | Aplicado. |
| `/api/v1/appointments/{appointment_id}` | GET | `api/app/api/v1/endpoints/appointments.py` | Leer turno | Sí | `appointments:read` | Sí | Alto por PHI/agenda. | Aplicado. |
| `/api/v1/appointments/doctor/{doctor_id}` | GET | `api/app/api/v1/endpoints/appointments.py` | Leer turnos doctor | Sí | `appointments:read` | Sí | Medio. | Aplicado. |
| `/api/v1/appointments/{appointment_id}` | DELETE | `api/app/api/v1/endpoints/appointments.py` | Cancelar cita | Sí | No existe scope declarado específico | No, solo auth híbrida | Alto. | Definir scope futuro compatible antes de aplicarlo. |
| `/api/v1/appointments/{appointment_id}/confirm` | POST | `api/app/api/v1/endpoints/appointments.py` | Confirmar cita | Sí | `appointments:read` no es ideal; no existe `appointments:update` | Sí, con scope existente `appointments:read` como guard mínimo | Medio. | Crear scope formal `appointments:update` en fase posterior. |
| `/api/v1/appointments/{appointment_id}/reschedule` | POST | `api/app/api/v1/endpoints/appointments.py` | Reprogramar cita | Sí | No existe scope declarado específico | Sí, con `appointments:create` como guard mínimo compatible | Alto. | Crear scope formal `appointments:update` en fase posterior. |
| `/api/v1/appointments/gateway/validate-slot` | POST | `api/app/api/v1/endpoints/appointments.py` | Validar slot | Sí, solo API key | `appointments:validate-slot` | Sí | Medio. | Aplicado. |
| `/api/v1/patients/by-phone/{phone}` | GET | `api/app/api/v1/endpoints/patients.py` | Obtener/crear shadow patient | Sí, API key | `patients:read-by-phone` / `patients:create-shadow` | No, solo API key | Medio. | Pendiente para no ampliar cambios. |
| `/api/v1/patients/whatsapp-upsert` | POST | `api/app/api/v1/endpoints/patients.py` | Upsert paciente WhatsApp | Sí, API key | `patients:create-shadow` | No, solo API key | Alto. | Pendiente. |
| `/api/v1/brain/decide` | POST | `api/app/api/v1/endpoints/brain_decide.py` | Decisión MetaBrain nativa | Sí, API key | `appointments:analyse` u otro scope formal | No, solo API key | Medio. | Pendiente, requiere contrato de scope Brain. |
| `/orchestrate` | POST | `brain/app.py` | Orquestación Brain | Sí si `INTERNAL_SERVICES_KEY` configurado | No hay registry de scopes local | No | Medio. | Definir scope contract sin duplicar Brain. |
| `/health` | GET | `brain/app.py` | Health | No | N/A | N/A | Bajo. | Sin cambio. |

## Correcciones aplicadas

- `InternalAuth` ahora conserva `scopes`.
- `validate_api_key()` devuelve scopes del servicio.
- `validate_hybrid_auth()` acepta `required_scope`.
- `check_permissions()` dejó de tratar servicios internos como acceso total.
- Endpoints de agenda FastAPI usan scopes existentes cuando la evidencia era clara.

## Riesgos restantes

- Faltan scopes formales para update/cancel/reschedule.
- Endpoints de pacientes internos todavía validan API key sin scope granular.
- Brain standalone no tiene matriz local de scopes; solo API key interna si está configurada.
