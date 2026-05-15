# MEMORY LAYER VALIDATION

## Estado anterior

La memoria operativa existente de MetaBrain usa un store JSONL append-only en:

- `MetaBrain/cerebro_ai_med/memory/store.py`

Ese store mantiene un buffer local y escribe eventos históricos en formato JSONL. En esta fase no fue reemplazado, migrado ni borrado.

## Estado nuevo

Se agregó una capa paralela y controlada de memoria semántica en:

- `MetaBrain/memory/`
- `MetaBrain/memory_py/`

La capa define contratos, sanitización, auditoría, retrieval léxico compatible y adapters JSONL no destructivos. No queda conectada al runtime ni a DI en esta fase.

## Backend activo

Backend activo real del sistema:

- JSONL actual existente.

Backend nuevo de compatibilidad:

- `JsonlMemoryAdapter`, por defecto en modo readonly/shadow y sin cambiar el formato existente.

## Backend futuro

La capa vectorial queda solo como contrato:

- `FutureVectorBackend`
- `VectorSearchInput`
- `VectorSearchResult`

No se agregó dependencia a pgvector, Qdrant ni proveedores de embeddings. No se generan embeddings reales.

## Flags documentados

No se modificó ningún `.env`. Flags sugeridos para una fase futura controlada:

- `SEMANTIC_MEMORY_ENABLED=false`
- `SEMANTIC_MEMORY_SHADOW_MODE=true`
- `SEMANTIC_MEMORY_VECTOR_ENABLED=false`
- `SEMANTIC_MEMORY_WRITE_ENABLED=false`
- `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=false`

## PHI safety

La sanitización conserva una postura defensiva:

- redacta emails,
- redacta teléfonos,
- redacta documentos identificatorios,
- redacta tokens, secretos, API keys y JWT,
- elimina HTML residual,
- remueve query strings de URLs,
- bloquea contenido vacío,
- redacta claves sensibles en metadata.

Patient scope queda bloqueado por defecto mediante `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=false`.

## Limitaciones

- No hay vector DB activa.
- No hay embeddings reales.
- No hay conexión al runtime actual.
- La búsqueda inicial es léxica sobre JSONL compatible.
- Los registros legacy pueden no tener `tenant_id` o `doctor_id`; el adapter los marca como `legacy_unknown`.
- La capa no debe usarse para diagnóstico autónomo ni aprendizaje automático.

## Rollback

Rollback funcional inmediato:

1. Mantener flags en sus defaults apagados.
2. No importar `MetaBrain/memory` ni `MetaBrain/memory_py` desde runtime.
3. Eliminar los archivos nuevos de Fase 3 si se requiere revertir el árbol.

El store JSONL actual permanece intacto.

## Validaciones ejecutadas

- `rg -n "MemoryHistoryStore|memory_history|jsonl|append\(|recent\(|CEREBRO_MEMORY_HISTORY_PATH|conversation_history" MetaBrain\cerebro_ai_med MetaBrain\services\api_gateway MetaBrain\memory MetaBrain\memory_py -S`
  - Resultado: confirmó que el runtime actual sigue usando `MemoryHistoryStore` en `MetaBrain/services/api_gateway/main.py` y `worker.py`, con JSONL en `CEREBRO_MEMORY_HISTORY_PATH`.
- `python -m compileall MetaBrain\memory_py`
  - Resultado: OK.
- Typecheck focal TS:
  - `tsc --noEmit --skipLibCheck --target ES2021 --module Node16 --moduleResolution Node16 --types node memory\*.ts`
  - Resultado: OK.
- `npm run build` en `MetaBrain`
  - Resultado: OK.
- `git diff --name-only -- MetaBrain\memory MetaBrain\memory_py MEMORY_LAYER_VALIDATION.md MEMORY_ROLLBACK_PLAN.md MEMORY_SECURITY_MODEL.md`
  - Resultado: sin salida porque los archivos nuevos están untracked.
- `git status --short -- MetaBrain\memory MetaBrain\memory_py MEMORY_LAYER_VALIDATION.md MEMORY_ROLLBACK_PLAN.md MEMORY_SECURITY_MODEL.md`
  - Resultado: muestra archivos nuevos/untracked de esta fase.
- `git status --short`
  - Resultado: el workspace contiene muchos cambios previos no relacionados; no fueron revertidos ni modificados por esta fase.

## Riesgos pendientes

- Conectar esta capa al runtime debe hacerse en una fase separada con DI, trazabilidad y pruebas end-to-end.
- Una futura vector DB requiere diseño de cifrado, PHI policy, migraciones no destructivas y revisión clínica.
- Los datos legacy necesitan normalización formal antes de habilitar scopes estrictos en producción.
