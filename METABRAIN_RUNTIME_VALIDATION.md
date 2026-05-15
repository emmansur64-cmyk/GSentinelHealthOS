# MetaBrain Runtime Validation

## Estado inicial

- Fecha: 2026-05-08T23:34:15.2522418-03:00
- Rama git: GsentinelH
- Commit actual: a3f163c49f82d5c9dad73dd5c39fdb2241a58b0d
- Estado git inicial: arbol con cambios previos no confirmados. Se observaron modificaciones existentes en MetaBrain, api, docker, medical-agenda-saas, scripts, shared y whatsapp_gateway antes de esta validacion.
- Estado git final del archivo de reporte: `?? METABRAIN_RUNTIME_VALIDATION.md`
- Servicios evaluados:
  - dialogue-engine: `MetaBrain/services/dialogue_engine`
  - inference-service: `MetaBrain/services/inference_service` + `MetaBrain/cerebro_ai_med`
  - decision-service: `MetaBrain/services/decision_service`
  - nlg-service: `MetaBrain/services/nlg_service`

## Cambios aplicados

- No se aplicaron cambios de codigo en esta fase.
- No se borraron archivos.
- No se modifico `docker-compose.yml`.
- No se tocaron paneles, secretos ni produccion.
- Unico archivo creado/modificado por esta fase: `METABRAIN_RUNTIME_VALIDATION.md`.

## Archivos relevantes ya modificados antes de esta fase

- `MetaBrain/cerebro_ai_med/models/ml_model.py:17`: resuelve `MODEL_PATH` o fallback portable local a `models/artifacts`.
- `MetaBrain/cerebro_ai_med/models/registry.py:56`: resuelve rutas de artefactos desde metadata y remapea paths antiguos bajo `artifacts`.
- `MetaBrain/services/nlg_service/app/engine.py:241`: contiene `sanity_check` medico para contradiccion urgente + lenguaje de bajo riesgo.

## Validacion de rutas de artefactos

- Metadata encontradas:
  - `MetaBrain/cerebro_ai_med/models/artifacts/metadata.json`
  - `MetaBrain/data/processed/metadata.json`
- Busqueda `E:\MetaBrain` en metadata y Python bajo `MetaBrain`: no se encontraron referencias obligatorias en el registry activo.
- `MetaBrain/cerebro_ai_med/models/artifacts/metadata.json` usa rutas relativas:
  - `text/3.0.0/text_risk_pipeline.joblib`
  - `image/3.0.0/image_risk_pipeline.joblib`
- `MetaBrain/data/processed/metadata.json` conserva `input_dir: E:\MetaBrain\data\synthetic_dataset`; no es el registry activo usado por `inference-service`.
- Validacion dentro de `gs_inference_service`:
  - `artifact_dir=/app/MetaBrain/cerebro_ai_med/models/artifacts`
  - `registry=/app/MetaBrain/cerebro_ai_med/models/artifacts/metadata.json`
  - `text_exists=True`
  - `image_exists=True`

## Pruebas ejecutadas

### Inference

- `GET http://127.0.0.1:8011/health`
  - Resultado: `status=ok`, `model_loaded=true`, `model_version=3.0.0`
- `POST http://127.0.0.1:8011/infer`
  - Caso: texto clinico controlado con fiebre alta, disnea y dolor toracico.
  - Resultado:
    - `model_name=production_medical_triage`
    - `model_version=3.0.0`
    - `risk_level=medium`
    - `finding_code=needs_clinical_review`
    - No aparecio `model_load_failed`.

### NLG

- `POST http://127.0.0.1:8013/generate` con riesgo bajo:
  - Resultado: responde `style=clinical`.
  - `metadata.sanity_check.fallback_applied=false`
  - No dispara urgencia innecesaria.
- `POST http://127.0.0.1:8013/generate` con riesgo medio:
  - Resultado: responde `style=clinical`.
  - Observacion: conserva frase de bajo riesgo `"sin hallazgos criticos"` junto a riesgo moderado. No bloquea la condicion solicitada para alto urgente, pero queda como riesgo pendiente.
- `POST http://127.0.0.1:8013/generate` con riesgo alto urgente:
  - Resultado final:
    - `"La evaluacion automatizada clasifica el caso como riesgo alto con prioridad clinica urgente; requiere evaluacion medica urgente..."`
    - `variants_used` incluye `sanity_check:fallback_summary`.
    - `metadata.sanity_check.fallback_applied=true`
    - `metadata.sanity_check.reason=urgent_text_with_low_risk_language`
  - Confirmacion: el texto final de alto riesgo no mezcla urgencia con `"sin hallazgos criticos"`.

### Servicios canonicos

- `GET /health`
  - dialogue-engine: `status=ok`, `service=dialogue_engine`
  - decision-service: `status=ok`, `service=decision_service`
  - inference-service: `status=ok`, `model_loaded=true`, `model_version=3.0.0`
  - nlg-service: `status=ok`, `service=nlg-service`, `version=1.0.0`
- `POST /dialogue`
  - Resultado: `intent=symptom_report`, `next_step=request_more_info`, `flags=possible_risk`
- `POST /infer`
  - Resultado: `risk_level=medium`, `recommendation_code=priority_evaluation`
- `POST /decide`
  - Resultado: `risk_level=medium`, `clinical_flag=priority`, `triage_level=yellow`, `requires_medical_evaluation=true`
- `POST /generate`
  - Resultado: respuesta clinica generada con disclaimer medico.

### Nest MetaBrain

- Comando: `npm run build` en `MetaBrain`
- Resultado: OK
- Evidencia: `nest build` termino con exit code 0.
- Nota: `MetaBrain/src` compila, pero no esta conectado al compose canonico en esta fase.

### Tests

- `docker exec gs_inference_service python -m pytest --version`
  - Resultado: fallo por `No module named pytest`.
- `docker exec gs_nlg_service python -m pytest --version`
  - Resultado: fallo por `No module named pytest`.
- `npm test -- --runInBand` en `MetaBrain`
  - Resultado: fallo.
  - Suites: 3 passed, 6 failed, 9 total.
  - Tests ejecutados: 6 passed, 6 total.
  - Causa principal: specs TypeScript antiguas no sincronizadas con firmas actuales:
    - `src/ingress/incident.robustness.spec.ts:69`: `BrainService` espera 13-16 argumentos y recibe 11.
    - `src/events/producer/event.producer.ts:15`: `EventProducer` requiere `RabbitBusService`.
    - `src/ingress/incident.controller.ts:35`: `handle` requiere `request`.
    - `src/ai/ai-provider.failure.spec.ts:101`: `AiService` espera 6 argumentos y recibe 3.
  - No se corrigieron specs en esta fase porque no bloquean `npm run build` ni el runtime canonico validado.

### Seguridad

- Comando: `npm audit --json` en `MetaBrain`
- Modo: solo lectura.
- Resultado:
  - low: 4
  - moderate: 11
  - high: 6
  - critical: 1
  - total: 22
- No se ejecuto `npm audit fix`.

## Salidas relevantes resumidas

- `docker compose ps dialogue-engine inference-service decision-service nlg-service`:
  - `gs_dialogue_engine`: Up, healthy, puerto `127.0.0.1:8010`
  - `gs_inference_service`: Up, healthy, puerto `127.0.0.1:8011`
  - `gs_decision_service`: Up, healthy, puerto `127.0.0.1:8012`
  - `gs_nlg_service`: Up, healthy, puerto `127.0.0.1:8013`
- Inference:
  - `model_loaded=true`
  - `model_version=3.0.0`
  - `/infer` no devuelve `model_load_failed`.
- NLG:
  - Alto urgente aplica fallback y elimina contradiccion de bajo riesgo.

## Estado final por servicio

| Servicio | Estado | Evidencia |
|---|---|---|
| dialogue-engine | OK | `/health` OK y `/dialogue` responde `symptom_report` |
| decision-service | OK | `/health` OK y `/decide` responde decision clinica |
| inference-service | OK | `/health` con `model_loaded=true`; `/infer` sin `model_load_failed` |
| nlg-service | OK con riesgo pendiente no bloqueante | `/health` OK; alto urgente sin contradiccion tras sanity fallback |
| MetaBrain Nest | Compila, no canonico en compose | `npm run build` OK |

## Riesgos pendientes

- `MetaBrain/data/processed/metadata.json` conserva una ruta historica `E:\MetaBrain\data\synthetic_dataset`, aunque no es el registry activo del inference runtime.
- NLG para riesgo medio puede combinar `riesgo moderado` con frase de bajo riesgo `"sin hallazgos criticos"`. No se corrigio porque la condicion bloqueante solicitada era alto urgente y no se amplio alcance.
- `pytest` no esta instalado dentro de `gs_inference_service` ni `gs_nlg_service`; no se modificaron Dockerfiles para tests.
- Specs TypeScript antiguas de MetaBrain fallan por firmas desactualizadas aunque `npm run build` compila.
- `npm audit` reporta 22 vulnerabilidades, incluyendo 1 critica; no se aplicaron fixes automaticos.

## Resultado final

FASE METABRAIN RUNTIME VALIDATION COMPLETA
