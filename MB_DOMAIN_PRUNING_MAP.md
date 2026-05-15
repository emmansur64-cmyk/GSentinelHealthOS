# MB Domain Pruning Map

La poda inicial se implementa como guardas fail-closed y manifiestos de dominio. No se borro codigo legacy dentro de las copias para mantener compatibilidad incremental y rollback claro.

| Archivo | Accion | Motivo | Reversible | Riesgo | Fallback |
|---|---|---|---|---|---|
| `MB-Chat/domain/domain_guard.py` | DISABLE por guardas: WhatsApp transport, WhatsApp booking, secretary ingestion, spreadsheet/document parsing, appointment writes, patient triage automatico | MB-Chat debe limitarse a chat/reasoning clinico profesional | Si | Bajo | Quitar guardas o ajustar allowlist |
| `MB-Chat/domain/provider_config.py` | KEEP solo `GROQ_API_KEY_CHAT` / `GROQ_MODEL_CHAT` | Evitar mezcla de provider keys entre dominios | Si | Bajo | Volver a loader legacy generic en fase controlada |
| `MB-Chat/DOMAIN.md` | Documentar KEEP/DISABLE | Auditoria humana y stage selectivo | Si | Bajo | Actualizar documento |
| `MB-Secretaria/domain/domain_guard.py` | DISABLE por guardas: diagnosis, deep clinical reasoning, doctor modes, patient chat, WhatsApp | Secretaria no debe ejecutar clinica ni transporte WhatsApp | Si | Bajo | Quitar guardas o ajustar allowlist |
| `MB-Secretaria/domain/provider_config.py` | KEEP solo `GROQ_API_KEY_SECRETARIA` / `GROQ_MODEL_SECRETARIA` | Aislamiento de provider para ingestion/documentos | Si | Bajo | Volver a loader legacy generic en fase controlada |
| `MB-Secretaria/DOMAIN.md` | Documentar KEEP/DISABLE | Auditoria humana y stage selectivo | Si | Bajo | Actualizar documento |
| `MB-Whatsapp/domain/domain_guard.py` | DISABLE por guardas: diagnosis, deep clinical reasoning, secretary imports, spreadsheet ingestion, full clinical history | WhatsApp debe operar agenda/conversacion, no clinica profunda | Si | Bajo | Quitar guardas o ajustar allowlist |
| `MB-Whatsapp/domain/provider_config.py` | KEEP solo `GROQ_API_KEY_WHATSAPP` / `GROQ_MODEL_WHATSAPP` | Aislamiento de provider para conversacion WhatsApp | Si | Bajo | Volver a loader legacy generic en fase controlada |
| `MB-Whatsapp/DOMAIN.md` | Documentar KEEP/DISABLE | Auditoria humana y stage selectivo | Si | Bajo | Actualizar documento |

## Componentes no eliminados

- `contracts`
- `validators`
- `auth`
- `tenant`
- `logging`
- `Agenda API client`
- `Brain Core compatibility`
- MetaBrain original

## Poda pendiente antes de activar runtime directo

- Reemplazar imports internos `MetaBrain.*` por paquete compartido o path estable.
- Conectar entrypoints reales a guardas de dominio.
- Mover shared/core solo cuando haya pruebas de compatibilidad y callers migrados.
