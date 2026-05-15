# IMAGE PIPELINE VALIDATION

## Estado anterior

El pipeline operativo de imagen existente permanece en Python y está acoplado a:

- `MetaBrain/cerebro_ai_med/models/ml_model.py`
- `MetaBrain/cerebro_ai_med/api/routes.py`
- `MetaBrain/cerebro_ai_med/api/validators.py`
- `MetaBrain/services/api_gateway/main.py`
- `MetaBrain/services/inference_service/app/routes.py`

La inferencia actual usa metadata de imagen:

- `pixels_million`
- `aspect_ratio`
- `bytes_per_pixel`
- `modality`

No se reemplazó `_predict_image` ni se modificaron endpoints.

## Estado nuevo

Se agregó una capa paralela de Image Intelligence:

- `MetaBrain/imaging/`
- `MetaBrain/imaging_py/`

La capa incluye contratos, ingesta, normalización, extracción segura de metadata, routing de modalidad, confidence defensivo, audit event, provider contract, DICOM contract y legacy adapter metadata-only.

## Pipeline activo

Pipeline activo real:

- Pipeline actual basado en metadata en `ml_model._predict_image`.

Pipeline agregado en Fase 4:

- `LegacyImageAdapter`
- No conectado al runtime.
- No cambia comportamiento observable.

## Pipeline futuro

Preparado, pero no activado:

- provider visual real,
- DICOM parsing real,
- modalidad avanzada,
- gating de revisión humana,
- confidence clínico ampliado.

## Flags documentados

No se modificó ningún `.env`.

- `MEDICAL_VISION_ENABLED=false`
- `MEDICAL_VISION_SHADOW_MODE=true`
- `MEDICAL_VISION_PROVIDER_ENABLED=false`
- `DICOM_ENABLED=false`
- `DICOM_SHADOW_MODE=true`
- `IMAGE_HUMAN_REVIEW_REQUIRED=true`
- `IMAGE_STORE_ORIGINAL=false`

## Límites clínicos

La capa no realiza diagnóstico visual médico. No interpreta lesiones, órganos, placas, TAC ni RM como especialista. Todo resultado metadata-only marca:

- `legacy_metadata_only=true`
- `no_visual_diagnosis=true`
- `requires_human_review=true`
- `no_definitive_diagnosis=true`

## Validaciones ejecutadas

- `rg -n "_predict_image|predict_image|pixels_million|aspect_ratio|bytes_per_pixel|validate_image_bytes|decode_base64_image|image_base64|DICOM|dicom|MedicalImagePredictor|image_risk_pipeline" MetaBrain\cerebro_ai_med MetaBrain\services MetaBrain\imaging MetaBrain\imaging_py -S`
  - Resultado: confirmó que el pipeline activo sigue en `MetaBrain/cerebro_ai_med/models/ml_model.py`, `dummy_model.py`, validadores/rutas Python y gateways.
- `python -m compileall MetaBrain\imaging_py`
  - Resultado: OK.
- Typecheck focal TS:
  - `tsc --noEmit --skipLibCheck --target ES2021 --module Node16 --moduleResolution Node16 --types node imaging\*.ts`
  - Resultado: OK.
- `npm run build` en `MetaBrain`
  - Resultado: OK.
- `git diff --name-only -- MetaBrain\imaging MetaBrain\imaging_py IMAGE_PIPELINE_VALIDATION.md IMAGE_SAFETY_MODEL.md IMAGE_ROLLBACK_PLAN.md`
  - Resultado: sin salida porque los archivos nuevos están untracked.
- `git status --short -- MetaBrain\imaging MetaBrain\imaging_py IMAGE_PIPELINE_VALIDATION.md IMAGE_SAFETY_MODEL.md IMAGE_ROLLBACK_PLAN.md`
  - Resultado: muestra archivos nuevos/untracked de esta fase.

## Riesgos pendientes

- El pipeline actual sigue acoplado a modelos sklearn y metadata image scoring.
- DICOM real requiere dependencia aprobada, política PHI visual, retención y validación clínica.
- Provider visual externo requiere revisión de seguridad, consentimiento, trazabilidad y circuit breakers.
- Conectar esta capa al runtime debe hacerse en una fase separada con feature flags y shadow mode.

## Rollback

Rollback inmediato:

1. Mantener flags documentados en estado apagado.
2. No importar `MetaBrain/imaging` ni `MetaBrain/imaging_py` desde runtime.
3. Continuar usando el pipeline actual.

No hay migraciones ni cambios de datos que revertir.
