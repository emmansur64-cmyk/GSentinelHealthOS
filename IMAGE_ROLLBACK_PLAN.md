# IMAGE ROLLBACK PLAN

## Objetivo

Permitir revertir la Fase 4 sin afectar el pipeline actual de imagen basado en metadata.

## Estado seguro por defecto

La Fase 4 no está conectada al runtime y documenta flags apagados:

- `MEDICAL_VISION_ENABLED=false`
- `MEDICAL_VISION_SHADOW_MODE=true`
- `MEDICAL_VISION_PROVIDER_ENABLED=false`
- `DICOM_ENABLED=false`
- `DICOM_SHADOW_MODE=true`
- `IMAGE_HUMAN_REVIEW_REQUIRED=true`
- `IMAGE_STORE_ORIGINAL=false`

## Cómo volver al pipeline actual

El pipeline actual nunca fue reemplazado. Para conservar o volver al comportamiento previo:

1. No importar `MetaBrain/imaging` ni `MetaBrain/imaging_py` desde runtime.
2. Mantener `_predict_image` actual.
3. Mantener validadores y endpoints existentes.
4. Mantener providers visuales y DICOM desactivados.

## Archivos nuevos

- `MetaBrain/imaging/types.ts`
- `MetaBrain/imaging/feature-flags.ts`
- `MetaBrain/imaging/image-ingestion.ts`
- `MetaBrain/imaging/image-normalizer.ts`
- `MetaBrain/imaging/image-metadata-extractor.ts`
- `MetaBrain/imaging/modality-router.ts`
- `MetaBrain/imaging/image-analysis-result.ts`
- `MetaBrain/imaging/image-confidence.ts`
- `MetaBrain/imaging/image-audit.ts`
- `MetaBrain/imaging/provider.contract.ts`
- `MetaBrain/imaging/dicom.contract.ts`
- `MetaBrain/imaging/legacy-image-adapter.ts`
- `MetaBrain/imaging_py/__init__.py`
- `MetaBrain/imaging_py/types.py`
- `MetaBrain/imaging_py/feature_flags.py`
- `MetaBrain/imaging_py/ingestion.py`
- `MetaBrain/imaging_py/normalizer.py`
- `MetaBrain/imaging_py/metadata_extractor.py`
- `MetaBrain/imaging_py/modality_router.py`
- `MetaBrain/imaging_py/confidence.py`
- `MetaBrain/imaging_py/audit.py`
- `MetaBrain/imaging_py/provider_contract.py`
- `MetaBrain/imaging_py/dicom_contract.py`
- `MetaBrain/imaging_py/legacy_adapter.py`
- `IMAGE_PIPELINE_VALIDATION.md`
- `IMAGE_SAFETY_MODEL.md`
- `IMAGE_ROLLBACK_PLAN.md`

## Archivos modificados

- `MetaBrain/imaging/index.ts`
- `MetaBrain/imaging/README.md`

## Comandos seguros de reversión

```powershell
git diff --name-only -- MetaBrain\imaging MetaBrain\imaging_py IMAGE_PIPELINE_VALIDATION.md IMAGE_SAFETY_MODEL.md IMAGE_ROLLBACK_PLAN.md
git status --short
```

Luego revertir únicamente los archivos listados de esta fase mediante control de versiones.

## Advertencias

- No borrar artefactos existentes de modelos.
- No ejecutar migraciones.
- No reiniciar servicios para revertir esta fase.
- No tocar Docker, compose ni producción.
