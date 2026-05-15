# MetaBrain Structure Audit

## Alcance

Auditoria estructural de `MetaBrain` como base fisica para `MB-Chat`, `MB-Secretaria` y `MB-Whatsapp`.

## Arbol estructural observado

```text
MetaBrain/
  audit/
  cerebro_ai_med/
    api/
    config/
    decision/
    memory/
    models/
    nlg/
    tests/
    vision/
  confidence/ and confidence_py/
  core/
  data/
  docs/
  imaging/ and imaging_py/
  memory/ and memory_py/
  metabrain/
  models/
  observability/ and observability_py/
  production-safety/ and production_safety_py/
  providers/ and providers_py/
  retrieval/
  review/ and review_py/
  risk/
  rules/
  scripts/
  services/
    api_gateway/
    decision_service/
    dialogue_engine/
    inference_service/
    nlg_service/
    shared/
  src/
    action-engine/
    ai/
    audit/
    brain/
    dl/
    events/
    execution/
    guard/
    ingress/
    integration/
    persistence/
```

## Responsabilidades detectadas

- Orquestacion/NLU: `MetaBrain\nlu_engine.py`, `MetaBrain\metabrain\pipeline.py`, `MetaBrain\services\nlg_service\app\reformulator.py`.
- Routing/brain TS: `MetaBrain\src\brain\brain.router.ts`, `MetaBrain\src\brain\brain.service.ts`.
- Booking/agenda operacional: `MetaBrain\src\brain\strategies\booking.strategy.ts`, `MetaBrain\src\guard\rules\booking.rules.ts`, `MetaBrain\src\action-engine\executors\booking.executor.ts`.
- Clinica/triage: `MetaBrain\cerebro_ai_med\decision\hybrid_decision.py`, `MetaBrain\services\decision_service\app\rules.py`, `MetaBrain\services\nlg_service\app\planner.py`.
- Providers/Groq: `MetaBrain\services\nlg_service\app\reformulator.py`, `MetaBrain\providers`, `MetaBrain\providers_py`.
- Observabilidad/logging: `MetaBrain\observability`, `MetaBrain\observability_py`, `MetaBrain\cerebro_ai_med\api\observability.py`.
- Contratos compartidos: `MetaBrain\services\shared\contracts.py`, `MetaBrain\core`, `MetaBrain\providers\types.ts`, `MetaBrain\memory\types.ts`.
- Auth/API key local de Cerebro: `MetaBrain\cerebro_ai_med\api\security.py`, `MetaBrain\services\api_gateway\main.py`.
- Scripts operativos y pruebas: `MetaBrain\scripts`, `MetaBrain\cerebro_ai_med\tests`, `MetaBrain\src\*.spec.ts`.

## Archivos criticos

- `MetaBrain\services\nlg_service\app\reformulator.py`: usa `GROQ_API_KEY` generico; necesita aislamiento futuro por dominio.
- `MetaBrain\cerebro_ai_med\decision\hybrid_decision.py`: combina reglas de Cerebro con Groq; pertenece a dominio clinico/MB-Chat.
- `MetaBrain\nlu_engine.py`: detecta intents de booking/cancelacion; no debe quedar activo en MB-Chat para acciones de agenda.
- `MetaBrain\src\brain\brain.service.ts`: mezcla routing, booking/schedule/error y ejecucion.
- `MetaBrain\src\guard\guard.service.ts`: contiene guardas para booking y schedule.
- `MetaBrain\services\shared\contracts.py`: reutilizable como contrato compartido.

## Imports cruzados y dependencias peligrosas

- Algunos providers Python importan desde `MetaBrain.providers_py...`; en una fase posterior deben apuntar a un core compartido o package estable antes de activar runtime desde carpetas `MB-*`.
- `services/nlg_service/app/reformulator.py` lee `GROQ_API_KEY` generico; queda documentado para aislamiento por dominio.
- `src/brain` y `src/guard` tienen booking y schedule acoplados en el mismo modulo.
- Scripts de webhook y pruebas de WhatsApp existen bajo `MetaBrain\scripts`, pero no son autoridad runtime actual.

## Modulos reutilizables

- Contracts: `services/shared/contracts.py`, `core`, `providers/types.ts`.
- Validators/sanitizers: `providers_py/context_sanitizer.py`, `memory_py/sanitizer.py`, `cerebro_ai_med/api/validators.py`.
- Auth/tenant/logging: `cerebro_ai_med/api/security.py`, `cerebro_ai_med/api/observability.py`, `observability*`.
- Provider boundaries: `providers`, `providers_py`.

## Modulos mezclados

- `src/brain`: booking, schedule, error routing y acciones.
- `services/nlg_service`: NLG clinico con Groq generico.
- `nlu_engine.py`: intents conversacionales y de agenda juntos.
- `cerebro_ai_med`: API, decision, modelos, vision, NLG y memoria bajo el mismo namespace.

## Riesgos de duplicacion

- Copiar artefactos generados (`node_modules`, `dist`, `__pycache__`) aumenta peso sin mejorar separacion.
- Copiar `.env` reales expondria secretos; no se detecto `.env` real en raiz de MetaBrain, solo `.env.example`.
- La separacion fisica inicial no debe convertirse en runtime activo hasta corregir imports cruzados y provider loaders.
