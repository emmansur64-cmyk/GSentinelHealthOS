# BRAIN CORE PROVIDER CONFIG DESIGN (POR DOMINIO)

Fecha: 2026-05-15
Estado: diseno de configuracion canonica, sin cargar secretos reales.

## 1. Variables esperadas por dominio

```env
GROQ_API_KEY_CHAT=
GROQ_MODEL_CHAT=

GROQ_API_KEY_SECRETARIA=
GROQ_MODEL_SECRETARIA=

GROQ_API_KEY_WHATSAPP=
GROQ_MODEL_WHATSAPP=

GROQ_TIMEOUT_MS_CHAT=
GROQ_TIMEOUT_MS_SECRETARIA=
GROQ_TIMEOUT_MS_WHATSAPP=

GROQ_MAX_RETRIES_CHAT=
GROQ_MAX_RETRIES_SECRETARIA=
GROQ_MAX_RETRIES_WHATSAPP=
```

## 2. Politica de lectura de config

1. `.env` centralizado por ambiente (`dev`, `lab`, `preprod`, `prod`).
2. Ningun secreto en codigo fuente.
3. Cada `assistant_mode` lee solo su config de dominio.
4. No fallback cruzado de keys entre dominios.
5. No rotacion artificial multi-key para evadir limites del proveedor.

## 3. Mapeo objetivo modo -> config

- `doctor_professional`, `clinical_support` -> CHAT
- `secretary_ingestion` -> SECRETARIA
- `appointment_booking` -> WHATSAPP

## 4. Comportamiento fail-safe por dominio

Si falta config del dominio:

- No usar key/model de otro dominio.
- Responder fallback seguro del dominio.
- Marcar `requires_human_review=true` cuando corresponda.
- Registrar evento tecnico sin secreto.

## 5. Logging y secretos

- Prohibido loggear:
  - API keys
  - headers auth completos
  - payloads sensibles completos
- Permitido loggear:
  - nombre de dominio (`chat|secretaria|whatsapp`)
  - modelo (si no es sensible)
  - timeout/retries
  - codigos de error normalizados

## 6. Estado actual observado (referencia)

Hoy existen variables parciales por feature (`DOCTOR_CHAT_GROQ_*`, `WHATSAPP_GROQ_*`, `DOCUMENT_AI_*`, `GROQ_*`) con algunos fallbacks cruzados.

Riesgo actual:

- mezcla de resolucion de key entre dominios
- drift de comportamiento por canal

## 7. Plan de convergencia minima

1. Introducir capa unica `resolveDomainProviderConfig(assistant_mode)`.
2. Resolver config exclusivamente por dominio canonico.
3. Mantener compat temporal con variables legacy, pero con warning y fecha de deprecacion.
4. Cortar fallback cruzado en la fase siguiente de hardening.
