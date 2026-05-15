# MEMORY ROLLBACK PLAN

## Objetivo

Permitir revertir completamente la Fase 3 sin afectar la memoria JSONL actual, endpoints existentes, contratos API ni runtime de MetaBrain.

## Estado seguro por defecto

La Fase 3 queda apagada por diseño:

- `SEMANTIC_MEMORY_ENABLED=false`
- `SEMANTIC_MEMORY_SHADOW_MODE=true`
- `SEMANTIC_MEMORY_VECTOR_ENABLED=false`
- `SEMANTIC_MEMORY_WRITE_ENABLED=false`
- `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=false`

No se modificaron `.env` reales.

## Cómo desactivar memoria semántica

Si una fase futura conecta esta capa al runtime, desactivar:

```text
SEMANTIC_MEMORY_ENABLED=false
SEMANTIC_MEMORY_WRITE_ENABLED=false
SEMANTIC_MEMORY_VECTOR_ENABLED=false
SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=false
```

Con esos valores el servicio retorna vacío/fallback seguro y no escribe memoria semántica.

## Cómo volver al JSONL actual

El JSONL actual nunca fue reemplazado. Para volver al comportamiento previo:

1. No importar `MetaBrain/memory` ni `MetaBrain/memory_py` desde código runtime.
2. Continuar usando `MetaBrain/cerebro_ai_med/memory/store.py`.
3. Mantener vector DB desactivada.

## Archivos nuevos

- `MetaBrain/memory/types.ts`
- `MetaBrain/memory/feature-flags.ts`
- `MetaBrain/memory/semantic-memory-service.ts`
- `MetaBrain/memory/jsonl-memory-adapter.ts`
- `MetaBrain/memory/memory-sanitizer.ts`
- `MetaBrain/memory/memory-retriever.ts`
- `MetaBrain/memory/memory-audit.ts`
- `MetaBrain/memory/vector-backend.contract.ts`
- `MetaBrain/memory_py/__init__.py`
- `MetaBrain/memory_py/types.py`
- `MetaBrain/memory_py/jsonl_adapter.py`
- `MetaBrain/memory_py/semantic_memory_service.py`
- `MetaBrain/memory_py/sanitizer.py`
- `MetaBrain/memory_py/retriever.py`
- `MetaBrain/memory_py/audit.py`
- `MEMORY_LAYER_VALIDATION.md`
- `MEMORY_ROLLBACK_PLAN.md`
- `MEMORY_SECURITY_MODEL.md`

## Archivos modificados

- `MetaBrain/memory/index.ts`
- `MetaBrain/memory/README.md`

## Comandos seguros de reversión

Usar solo si se decide revertir esta fase en laboratorio:

```powershell
git diff --name-only -- MetaBrain/memory MetaBrain/memory_py MEMORY_LAYER_VALIDATION.md MEMORY_ROLLBACK_PLAN.md MEMORY_SECURITY_MODEL.md
git status --short
```

Luego revertir únicamente los archivos listados de esta fase mediante el flujo de control de versiones del equipo.

## Advertencias

- No borrar archivos JSONL históricos.
- No ejecutar migraciones para revertir esta fase.
- No tocar Docker, compose ni producción.
- No asumir que datos legacy tienen scope clínico suficiente para patient memory.
