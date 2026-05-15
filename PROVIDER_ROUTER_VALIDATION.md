# PROVIDER ROUTER VALIDATION

## Providers actuales

Los providers runtime actuales permanecen intactos:

- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- `medical-agenda-saas/src/lib/document-ai.ts`
- `medical-agenda-saas/src/server/ai/groqImageAnalysis.ts`
- `medical-agenda-saas/src/medical-imaging/vision-ai.service.ts`
- servicios Python con fallback/local logic donde aplica.

No se reemplazo ningun provider runtime.

## Providers futuros

Se agregaron adapters desactivados y contract-only para:

- Groq
- OpenAI
- Gemini
- local
- future-medical

## Router status

Nuevo router:

- `MetaBrain/providers/provider-router.ts`
- `MetaBrain/providers_py/provider_router.py`

Estado:

- no conectado al runtime,
- apagado por defecto,
- shadow mode por defecto,
- sin llamadas externas.

## Fallback status

Fallback seguro implementado:

- `buildSafeProviderFallback`
- `build_safe_provider_fallback`

El fallback devuelve respuesta vacia segura con flags explicitos. No intenta diagnosticar ni reintentar indefinidamente.

## Flags

No se modifico ningun `.env`.

- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `LLM_PROVIDER_SHADOW_MODE=true`
- `LLM_PROVIDER_FALLBACK_ENABLED=false`
- `LLM_PROVIDER_HEALTHCHECK_ENABLED=true`
- `LLM_PROVIDER_STRUCTURED_OUTPUT_ENABLED=false`
- `LLM_PROVIDER_MULTIMODAL_ENABLED=false`
- `LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED=false`
- `LLM_PROVIDER_PHI_ALLOWED=false`

## Structured output status

Se agrego parsing seguro de JSON y validacion basica de objeto. No se confia en output libre del LLM y no se conecta a providers reales.

## Multimodal status

Multimodal queda como contrato. `supports_multimodal=true` en un provider futuro no activa inferencia real porque:

- `LLM_PROVIDER_MULTIMODAL_ENABLED=false`,
- `LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED=false`,
- adapters estan desactivados.

## Riesgos pendientes

- Conectar providers reales requiere una fase separada con pruebas e2e, observabilidad y revisión PHI.
- Provider visual externo requiere politica de imagenes clinicas, consentimiento y retencion.
- Structured outputs futuros requieren schemas estrictos por caso de uso.

## Rollback

Rollback inmediato:

1. Mantener flags apagados.
2. No importar `MetaBrain/providers` ni `MetaBrain/providers_py` desde runtime.
3. Eliminar archivos nuevos de Fase 5 si se decide revertir.

## Validaciones ejecutadas

- `rg -n "GROQ_API_KEY|DOCTOR_CHAT_GROQ|DOCUMENT_AI|Groq|OpenAI|Gemini|OPENAI_API_KEY|fetch\(|httpx|provider" medical-agenda-saas\src\lib medical-agenda-saas\src\server medical-agenda-saas\src\medical-imaging brain MetaBrain\providers MetaBrain\providers_py -S`
  - Resultado: providers actuales siguen en `medical-agenda-saas`; tambien se detecta `OPENAI_API_KEY` opcional en `brain/orchestration/semantic_memory.py`. No se reemplazo runtime.
- `python -m compileall MetaBrain\providers_py`
  - Resultado: OK.
- Typecheck focal TS:
  - `tsc --noEmit --skipLibCheck --target ES2021 --module Node16 --moduleResolution Node16 --types node providers\**\*.ts`
  - Resultado: OK.
- `npm run build` en `MetaBrain`
  - Resultado: OK.
- `git diff --name-only -- MetaBrain\providers MetaBrain\providers_py PROVIDER_ROUTER_VALIDATION.md PROVIDER_SECURITY_MODEL.md PROVIDER_ROLLBACK_PLAN.md`
  - Resultado: sin salida porque los archivos nuevos estan untracked.
- `git status --short -- MetaBrain\providers MetaBrain\providers_py PROVIDER_ROUTER_VALIDATION.md PROVIDER_SECURITY_MODEL.md PROVIDER_ROLLBACK_PLAN.md`
  - Resultado: muestra archivos nuevos/untracked de esta fase.
