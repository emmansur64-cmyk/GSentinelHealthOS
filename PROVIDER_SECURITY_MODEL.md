# PROVIDER SECURITY MODEL

## Manejo PHI

Por defecto:

```text
LLM_PROVIDER_PHI_ALLOWED=false
```

El sanitizer detecta y redacta:

- emails,
- telefonos,
- documentos,
- secretos,
- tokens,
- passwords,
- metadata sensible.

Si se detecta PHI y el provider no esta autorizado, el request queda bloqueado por politica.

## Providers permitidos

En Fase 5 ningun provider nuevo queda permitido para runtime. Los adapters son desactivados y no hacen llamadas externas.

## Providers bloqueados

Quedan bloqueados por defecto:

- Groq via router nuevo,
- OpenAI,
- Gemini,
- local,
- future-medical.

Los flujos actuales existentes no se modifican.

## Sanitizacion

La sanitizacion ocurre antes de seleccionar provider:

- elimina secretos,
- redacta PHI,
- limpia HTML simple,
- remueve `patient_id` si PHI no esta permitido,
- agrega safety flags.

## Timeout policy

Defaults documentados:

- text: 5000 ms,
- image: 8000 ms,
- multimodal: 10000 ms,
- healthcheck: 1500 ms,
- maximo permitido: 30000 ms.

## Retry policy

Retry controlado:

- default `max_attempts=1`,
- sin retries infinitos,
- backoff simple si una fase futura aumenta el presupuesto.

## Fallback safety

Fallback seguro:

- explicito,
- auditado,
- sin diagnostico,
- sin contenido inventado,
- no oculta que fue fallback.

## External image restrictions

Por defecto:

```text
LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED=false
```

Ninguna imagen real se envia a providers externos en Fase 5.

## Multimodal restrictions

Por defecto:

```text
LLM_PROVIDER_MULTIMODAL_ENABLED=false
```

La multimodalidad queda como contrato futuro, sin ejecucion real.
