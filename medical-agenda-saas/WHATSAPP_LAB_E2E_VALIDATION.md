# WHATSAPP LAB E2E VALIDATION

Fecha local: 2026-05-12

Scope unico: `E:\GSentinelHealthOS\medical-agenda-saas`

## Resultado general

WhatsApp LAB E2E: **PARCIAL / NO-GO PRODUCCION**

PASS:
- cuenta LAB existe en `clinic_whatsapp_accounts`;
- webhook inbound local firmado responde 200;
- `incoming_messages` persiste el mensaje LAB.

BLOCKED/FAIL:
- no se proceso conversacion completa;
- no se envio respuesta saliente por restriccion de no enviar mensajes reales;
- no se creo appointment desde WhatsApp;
- no se demostro visualizacion en Agenda;
- no se demostro manejo de conflictos por WhatsApp.

## Comandos ejecutados

- `docker inspect gs_frontend` para leer configuracion runtime sin imprimir secretos en reportes.
- `Invoke-WebRequest POST /api/webhooks/whatsapp`.
- `docker exec -i gs_db psql -U sentinel -d gsentinel_saas`.

## Payload LAB

Datos sinteticos:
- `phone_number_id=LAB_TEST_PHONE_NUMBER_ID`
- `waba_id=LAB_TEST_WABA`
- `from=5491111111111`
- texto: `Quiero sacar un turno de control LAB_TEST`

No se uso paciente real.
No se envio WhatsApp real.

## Resultado endpoint

| Prueba | Esperado | Obtenido | Estado |
|---|---:|---:|---|
| Webhook inbound firmado | 200 | 200 | PASS |
| Persistencia `incoming_messages` | 1 | 1 | PASS |
| `conversation_states` | >0 | 0 | BLOCKED |
| `outgoing_messages` | >=0 sin envio real | 0 | PASS seguro |
| `appointments source=whatsapp` | 1 para E2E completo | 0 | FAIL/BLOCKED |

Evidencia DB:

```text
incoming=1
state=0
outgoing=0
wa_appts=0
```

## Evaluacion por paso E2E

| Paso | Estado | Observacion |
|---|---|---|
| 1. webhook inbound | PASS | `POST /api/webhooks/whatsapp` respondio 200 |
| 2. persistencia incoming_messages | PASS | mensaje LAB insertado |
| 3. conversation_states | BLOCKED | no se proceso worker/conversacion |
| 4. deteccion intencion agenda | BLOCKED | requiere procesamiento |
| 5. busqueda disponibilidad | BLOCKED | requiere procesamiento |
| 6. propuesta horario | BLOCKED | implicaria respuesta |
| 7. confirmacion visible | BLOCKED | implicaria flujo conversacional |
| 8. creacion appointment | FAIL/BLOCKED | no hay appointment WhatsApp |
| 9. visualizacion agenda | BLOCKED | no hay appointment WhatsApp |
| 10. conflictos | BLOCKED | depende de create appointment |

## Motivo de bloqueo seguro

La funcion conversacional termina llamando `sendWhatsAppMessage`, que usa Meta Graph API. Aunque la cuenta LAB tiene tokens dummy, la politica de esta fase prohibe enviar mensajes reales a pacientes o probar envio externo.

Por seguridad, se valido solo inbound/persistencia. El E2E completo queda pendiente para un sandbox controlado con mocks o con un proveedor Meta test aprobado.

## Veredicto WhatsApp

**GO LAB parcial**

**NO-GO PRODUCCION REAL**

