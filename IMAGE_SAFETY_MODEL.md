# IMAGE SAFETY MODEL

## Principio

El sistema puede preparar contexto técnico y metadata segura de imágenes médicas, pero no puede emitir diagnóstico definitivo ni sustituir revisión profesional.

## Qué puede hacer

- Validar entrada básica.
- Normalizar MIME y filename.
- Extraer metadata no sensible.
- Calcular dimensiones derivadas como megapíxeles, aspect ratio y bytes-per-pixel.
- Detectar DICOM de forma defensiva por MIME/extensión.
- Calcular confidence bajo e incertidumbre alta cuando solo hay metadata.
- Marcar revisión humana obligatoria.
- Emitir eventos de auditoría sin almacenar imagen original.

## Qué NO puede hacer

- Diagnosticar lesiones.
- Interpretar órganos, placas, TAC o RM como especialista.
- Afirmar normalidad clínica definitiva.
- Enviar imágenes a providers externos en Fase 4.
- Guardar imágenes clínicas originales por defecto.
- Mezclar imaging con memoria semántica, reglas clínicas o providers LLM.
- Activar DICOM real sin dependencia autorizada.

## No diagnóstico definitivo

Todo `ImageAnalysisResult` generado por la capa de Fase 4 incluye:

- `no_definitive_diagnosis=true`
- `requires_human_review=true`
- safety notes de metadata-only

## Revisión humana

`IMAGE_HUMAN_REVIEW_REQUIRED=true` queda documentado como default. La salida sensible requiere revisión humana para cualquier interpretación clínica.

## Manejo de imágenes clínicas

`IMAGE_STORE_ORIGINAL=false` evita almacenar originales por defecto. Si una fase futura necesita persistencia de imágenes, debe definir:

- cifrado,
- retención,
- controles PHI,
- auditoría,
- consentimiento,
- acceso por tenant/doctor/paciente.

## PHI visual

La metadata se sanitiza por claves sensibles:

- patient,
- name,
- email,
- phone,
- address,
- token,
- secret,
- gps,
- latitude,
- longitude.

La capa no extrae PHI de pixels ni OCR.

## Providers externos

Fase 4 no llama providers externos. Cualquier provider futuro debe cumplir:

- provider isolation,
- timeout,
- no PHI innecesaria,
- trazabilidad,
- healthcheck,
- rollback,
- revisión legal/clinica.

## DICOM futuro

DICOM real no está implementado. Solo existe contrato y detección defensiva. Un futuro DICOM real requiere dependencia aprobada y controles de metadata PHI.
