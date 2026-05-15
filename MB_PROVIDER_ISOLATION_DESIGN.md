# MB Provider Isolation Design

## Objetivo

Aislar configuracion Groq por dominio sin crear `.env` por modulo y sin exponer secretos.

## Variables por dominio

| Dominio | API key | Modelo |
|---|---|---|
| `MB-Chat` | `GROQ_API_KEY_CHAT` | `GROQ_MODEL_CHAT` |
| `MB-Secretaria` | `GROQ_API_KEY_SECRETARIA` | `GROQ_MODEL_SECRETARIA` |
| `MB-Whatsapp` | `GROQ_API_KEY_WHATSAPP` | `GROQ_MODEL_WHATSAPP` |

## Loaders agregados

- `MB-Chat/domain/provider_config.py`
- `MB-Secretaria/domain/provider_config.py`
- `MB-Whatsapp/domain/provider_config.py`

Cada loader devuelve:

- Dominio.
- Nombre de variable de API key.
- Nombre de variable de modelo.
- Booleano `api_key_configured`.
- Modelo configurado o `None`.

## Fallbacks

- No hay fallback a `GROQ_API_KEY` generico.
- No hay fallback a keys de otros dominios.
- Si falta key de dominio, `api_key_configured=False` y el caller debe operar en modo deterministico/disabled.

## Restricciones

- Mantener `.env` centralizado.
- No crear `.env` por modulo.
- No loguear valores de keys.
- No interpolar secrets en excepciones.
- No cambiar contratos publicos todavia.

## Logs seguros

Permitido:

- Nombre del dominio.
- Nombre de variable requerida.
- Estado booleano `api_key_configured`.
- Modelo configurado, si no contiene secretos.

Prohibido:

- Valor de API key.
- Headers `Authorization`.
- Cookies.
- Tokens bearer.
- URLs con credenciales.

## Rotacion de keys

- Rotacion independiente por dominio.
- Rollback seguro: restaurar key anterior en variable especifica del dominio.
- Revocacion de emergencia: vaciar solo `GROQ_API_KEY_<DOMINIO>` afectada sin tocar otros dominios.
