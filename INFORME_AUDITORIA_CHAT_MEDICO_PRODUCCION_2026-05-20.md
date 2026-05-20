# Informe de Auditoria - Chat Medico IA (Produccion)

Fecha: 2026-05-20  
Alcance: `medical-agenda-saas` (flujo `doctor chat`)

## Objetivo operativo
- Endurecer la IA medica hibrida (Groq + Brain) para operacion real.
- Evitar respuestas clinicas inestables o contaminadas por dominio agenda.
- Mantener capacidad multi-tenant y degradacion segura para alta concurrencia.
- Confirmar acceso a internet para evidencia medica controlada.

## Cambios implementados

1. Contrato clinico estricto en chat medico
- Archivo: `medical-agenda-saas/src/chat/doctor-clinical-contract.ts`
- Se implemento:
  - Enrutamiento deterministico (`datetime_runtime`, `weather_runtime`, `clinical_pipeline`).
  - Deteccion de prompts clinicos que requieren contrato estructurado.
  - Validacion de respuesta clinica (secciones minimas, limitaciones, disclaimer, longitud minima).
  - Bloqueo de fuga de agenda/citas dentro del chat clinico.
  - Fallback clinico estructurado seguro cuando Groq/Brain no cumplen contrato.
  - Sanitizacion y aislamiento de metadata permitida.

2. Integracion del contrato en el pipeline productivo de respuesta
- Archivo: `medical-agenda-saas/src/chat/chat.service.ts`
- Se integro:
  - Evaluacion de contrato para salida Groq antes de aceptarla.
  - Evaluacion de contrato para salida Brain antes de aceptarla.
  - Rechazo explicito de respuestas no validas y logging de motivo.
  - Fallback seguro con motivo trazable (`providers_unavailable`, `providers_rejected`, etc.).
  - Aislamiento de metadata del chat doctor para evitar contaminacion cruzada.

3. Bloqueo de fallback legacy no clinico en modo doctor
- Archivo: `medical-agenda-saas/src/lib/brain-client.ts`
- Se agrego opcion `allowLegacyFallback`.
- En `assistant_mode=doctor_professional`, se fuerza `allowLegacyFallback=false`.
- Resultado: evita caer en endpoint legacy que puede degradar consistencia clinica.

## Validaciones ejecutadas

Comandos ejecutados:
- `npm run typecheck` -> OK
- `npm run test:all -- doctor-clinical-contract brain-client` -> OK (10 tests)
- `npm run test:whatsapp` -> OK (85 tests)

Resultado:
- Compilacion TypeScript limpia.
- Contrato clinico validado por pruebas unitarias dedicadas.
- Regresion funcional del ecosistema whatsapp en verde.

## Estado de acceso a internet (chat medico)
- Configuracion actual detectada:
  - `MEDICAL_WEB_RETRIEVAL_ENABLED=true`
  - `MEDICAL_WEB_RETRIEVAL_MODE=open`
- El modulo de retrieval web esta activo y usa fuentes abiertas/controladas segun configuracion.

## Riesgos residuales y control
- Riesgo: indisponibilidad temporal de Groq o Brain.
  - Mitigacion activa: fallback clinico estructurado seguro con disclaimer y trazabilidad.
- Riesgo: respuesta no estructurada en casos clinicos complejos.
  - Mitigacion activa: contrato clinico obligatorio + rechazo de respuesta invalida.
- Riesgo: deriva hacia dominio agenda.
  - Mitigacion activa: deteccion de leak de agenda y bloqueo contractual.

## Conclusión
- El chat medico queda endurecido para produccion real en su capa de decision/respuesta:
  - pipeline hibrido Groq + Brain,
  - validacion clinica previa a entrega,
  - degradacion segura sin inventar conducta,
  - aislamiento de metadata.
- Se recomienda mantener monitoreo de tasas `contract_rejected` y `fallbackReason` en observabilidad para ajustar prompts/modelo sin comprometer seguridad.

## Endurecimiento adicional NO-GO -> GO supervisado (2026-05-20)

1. Clinical Evidence Guard
- Archivo: `medical-agenda-saas/src/chat/clinical-evidence-guard.ts`
- Se agrego clasificacion:
  - `clinical_risk_level`: `low | moderate | high | critical`
  - `evidence_confidence`: `verified_guideline | literature_supported | weak_evidence | unsupported`
- Politica implementada:
  - Bloqueo automatico para riesgo `critical` sin evidencia `verified_guideline`.
  - Bloqueo automatico para riesgo `high` con evidencia `weak_evidence` o `unsupported`.
  - Acción de bloqueo: `DOCTOR_CHAT_CLINICAL_POLICY_BLOCK`.

2. Observabilidad clinica reforzada
- Archivo: `medical-agenda-saas/src/lib/observability/metrics.ts`
- Nueva metrica:
  - `doctor_chat_clinical_safety_total{risk_level,evidence_confidence,outcome}`
- Se registra por cada respuesta si fue permitida o bloqueada por policy guard.

3. Retrieval medico endurecido por defecto
- Archivo: `.env.example`
- Cambio de baseline:
  - `MEDICAL_WEB_RETRIEVAL_MODE=open` -> `MEDICAL_WEB_RETRIEVAL_MODE=allowlist`
- Objetivo: reducir riesgo de evidencia no confiable en produccion real.

4. Pruebas nuevas del guard clinico
- Archivo: `medical-agenda-saas/tests/unit/clinical-evidence-guard.test.ts`
- Casos cubiertos:
  - bloqueo de riesgo critico sin evidencia verificada,
  - autorizacion de riesgo critico con evidencia de guideline verificada,
  - bloqueo de riesgo alto con evidencia debil.
