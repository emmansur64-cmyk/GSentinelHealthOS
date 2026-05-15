# PROVIDER ROLLBACK PLAN

## Objetivo

Permitir revertir la Fase 5 sin afectar providers actuales ni comportamiento observable.

## Como volver al flujo actual

El flujo actual nunca fue reemplazado. Para mantener o volver al estado previo:

1. No importar `MetaBrain/providers` desde runtime.
2. No importar `MetaBrain/providers_py` desde runtime.
3. Mantener flags apagados.
4. Continuar usando los providers existentes en `medical-agenda-saas`.

## Archivos nuevos

- `MetaBrain/providers/types.ts`
- `MetaBrain/providers/provider-registry.ts`
- `MetaBrain/providers/provider-router.ts`
- `MetaBrain/providers/provider-health.ts`
- `MetaBrain/providers/provider-scoring.ts`
- `MetaBrain/providers/provider-fallback.ts`
- `MetaBrain/providers/provider-timeouts.ts`
- `MetaBrain/providers/provider-retry.ts`
- `MetaBrain/providers/provider-audit.ts`
- `MetaBrain/providers/provider-flags.ts`
- `MetaBrain/providers/structured-output.ts`
- `MetaBrain/providers/provider-context-sanitizer.ts`
- `MetaBrain/providers/provider-errors.ts`
- `MetaBrain/providers/provider-response.ts`
- provider subfolders `groq`, `openai`, `gemini`, `local`, `future-medical`
- `MetaBrain/providers_py/` y subcarpetas
- `PROVIDER_ROUTER_VALIDATION.md`
- `PROVIDER_SECURITY_MODEL.md`
- `PROVIDER_ROLLBACK_PLAN.md`

## Archivos modificados

- `MetaBrain/providers/index.ts`
- `MetaBrain/providers/README.md`

## Flags

- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `LLM_PROVIDER_SHADOW_MODE=true`
- `LLM_PROVIDER_FALLBACK_ENABLED=false`
- `LLM_PROVIDER_HEALTHCHECK_ENABLED=true`
- `LLM_PROVIDER_STRUCTURED_OUTPUT_ENABLED=false`
- `LLM_PROVIDER_MULTIMODAL_ENABLED=false`
- `LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED=false`
- `LLM_PROVIDER_PHI_ALLOWED=false`

## Rollback seguro

```powershell
git diff --name-only -- MetaBrain\providers MetaBrain\providers_py PROVIDER_ROUTER_VALIDATION.md PROVIDER_SECURITY_MODEL.md PROVIDER_ROLLBACK_PLAN.md
git status --short
```

Luego revertir solo archivos de Fase 5 mediante control de versiones.

## Riesgos

- Una fase futura que conecte el router debe validar que no se dupliquen llamadas a Groq.
- PHI y multimodalidad requieren aprobacion separada.
