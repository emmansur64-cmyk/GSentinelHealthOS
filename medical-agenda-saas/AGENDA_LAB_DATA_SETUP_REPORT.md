# AGENDA LAB DATA SETUP REPORT

Fecha local: 2026-05-12

Scope unico: `E:\GSentinelHealthOS\medical-agenda-saas`

## Resultado

Datos LAB minimos creados en `gsentinel_saas`.

No se usaron datos reales.
No se usaron `clinic.local`, `import.local`, `Clinica Demo Local` ni placeholders ambiguos.

## Comandos ejecutados

- `node -e` para generar hash bcrypt LAB.
- `docker exec -i gs_db psql -v ON_ERROR_STOP=1 -U sentinel -d gsentinel_saas`
- `docker exec -i gs_db psql -U sentinel -d gsentinel_saas`

## Entidades LAB creadas

| Entidad | Identificador | Estado |
|---|---|---|
| Tenant | `LAB_TEST_TENANT` | creado/validado |
| Clinica logica | `LAB_TEST_CLINIC` | representada como tenant `nombre` y `clinic_id` WhatsApp |
| Secretaria LAB | `LAB_TEST_SECRETARY` | creada/validada |
| Doctor | `LAB_TEST_DOCTOR` | creado/validado |
| Paciente | `LAB_TEST_PATIENT` | creado/validado |
| WhatsApp | `LAB_TEST_WHATSAPP` | cuenta dummy creada/validada |

## IDs LAB

| Objeto | ID |
|---|---|
| Secretaria | `11111111-1111-4111-8111-111111111111` |
| Doctor/User | `22222222-2222-4222-8222-222222222222` |
| Availability rule | `33333333-3333-4333-8333-333333333333` |
| Patient | `44444444-4444-4444-8444-444444444444` |
| Clinic WhatsApp account | `55555555-5555-4555-8555-555555555555` |

## Conteos verificados

| Check | Resultado |
|---|---:|
| LAB tenants | 1 |
| LAB users | 2 |
| LAB doctor_profiles | 1 |
| LAB agenda_settings | 1 |
| LAB availability_rules | 1 |
| LAB patients | 1 |
| LAB whatsapp_accounts | 1 |
| LAB appointments iniciales | 0 |

## Configuracion de disponibilidad

| Campo | Valor |
|---|---|
| `doctor_id` | `22222222-2222-4222-8222-222222222222` |
| `day_of_week` | `2` |
| `start_time` | `12:00` |
| `end_time` | `16:00` |
| `slot_duration` | `30` |

## WhatsApp LAB

Se creo cuenta en `clinic_whatsapp_accounts` con:
- `tenant_id=LAB_TEST_TENANT`
- `phone_number_id=LAB_TEST_PHONE_NUMBER_ID`
- tokens dummy marcados como LAB
- sin envio real

## Seguridad

No se cargaron pacientes reales.
No se enviaron mensajes reales.
No se borraron datos.
No se hizo reset DB.

