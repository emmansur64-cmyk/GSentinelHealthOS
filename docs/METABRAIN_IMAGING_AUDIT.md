# Auditoria MetaBrain para imagenes medicas

Fecha: 2026-04-27

## Alcance auditado

Se revisaron los flujos reales de imagenes en:

- `medical-agenda-saas/src/app/api/imaging/analyze/route.ts`
- `medical-agenda-saas/src/app/api/import/agenda/parse/route.ts`
- `medical-agenda-saas/src/medical-imaging/imaging.service.ts`
- `medical-agenda-saas/src/medical-imaging/predictor.service.ts`
- `medical-agenda-saas/src/medical-imaging/model.loader.ts`
- `medical-agenda-saas/src/medical-imaging/preprocess.ts`
- `medical-agenda-saas/src/lib/metabrain.ts`
- `medical-agenda-saas/models/model_config.json`

## Estado real antes del ajuste

MetaBrain podia:

- Detectar por nombre, extension, mime type y tamano si un archivo parecia RMN, TAC, RX o DICOM.
- Intentar inferencia ONNX si existian modelos locales configurados.
- Preprocesar imagenes comunes con `sharp` para modelos ONNX.
- Devolver una guia clinica conservadora con reglas en `buildImagingClinicalGuidance`.
- Caer a un fallback estructurado si no habia modelo local.

MetaBrain no podia garantizar:

- Lectura visual real de RMN/TAC/RX complejas si no habia modelos ONNX presentes.
- Interpretacion de DICOM nativo como serie medica completa.
- Analisis multiplanar, comparacion de cortes, mediciones radiologicas o diagnostico definitivo.
- Uso local de modelos ONNX porque en el arbol actual hay `model_config.json`, pero no se encontraron los archivos `.onnx` referenciados.

## Riesgo detectado

El sistema podia responder como "analisis estructurado" aun cuando en realidad estaba en fallback. Eso es aceptable como ayuda preliminar si se informa, pero no debe presentarse como lectura radiologica real.

## Ajuste aplicado

Se agregaron servicios:

- `medical-agenda-saas/src/medical-imaging/vision-ai.service.ts`
- `medical-agenda-saas/src/medical-imaging/dicom-renderer.service.ts`

Comportamiento:

1. Si hay modelo ONNX disponible y responde dentro del limite, se mantiene ONNX.
2. Si el archivo es DICOM monocromo sin compresion encapsulada, se renderiza localmente a PNG para ONNX/IA visual.
3. Si ONNX no esta disponible y `DOCUMENT_AI_ENABLED=true`, intenta analisis visual IA sobre imagen renderizada comun (`image/jpeg`, `image/png`) o DICOM renderizado.
4. Si la IA visual falla o no hay credenciales, vuelve al fallback estructurado existente.
5. Para DICOM comprimido, multiframe o formatos especiales, no se promete lectura visual: queda pendiente soporte dedicado.

No se agregaron credenciales ni datos falsos.

## Variables usadas

Se reutilizan las variables existentes:

```env
DOCUMENT_AI_ENABLED=false
DOCUMENT_AI_REQUIRE_SUCCESS=false
DOCUMENT_AI_PROVIDER=openai
DOCUMENT_AI_BASE_URL=https://api.openai.com/v1
DOCUMENT_AI_MODEL=gpt-4.1
DOCUMENT_AI_API_KEY=
DOCUMENT_AI_TIMEOUT_MS=25000
DOCUMENT_AI_MAX_RETRIES=2
```

## Capacidad actual por tipo

RMN:

- Con imagen renderizada y `DOCUMENT_AI_ENABLED=true`: puede hacer lectura visual asistida conservadora.
- Sin IA visual ni ONNX real: solo clasificacion/fallback por metadatos/nombre.
- DICOM monocromo sin compresion: se renderiza a PNG y puede pasar por ONNX/IA visual.
- DICOM comprimido/multiframe/serie completa: no resuelto como lectura radiologica completa.

Tomografia:

- Con imagen renderizada y `DOCUMENT_AI_ENABLED=true`: puede describir hallazgos visibles de forma conservadora.
- Sin IA visual ni ONNX real: fallback.
- DICOM monocromo sin compresion: render local a PNG disponible.
- Serie DICOM completa: pendiente de pipeline dedicado.

RX:

- Con imagen renderizada y `DOCUMENT_AI_ENABLED=true`: puede analizar visualmente una placa/captura.
- Si se agregan modelos ONNX reales, el pipeline local puede usarlos.
- Sin ambos: fallback.

## Cambios de seguridad

El endpoint `/api/imaging/analyze` dejo de loguear el contenido completo de `findings` y registra solo `findings_count`.

## Pendientes tecnicos reales

- Cargar modelos `.onnx` reales o desactivar modelos inexistentes en `model_config.json`.
- Agregar validacion de existencia de modelos en health/diagnostico operativo.
- Ampliar DICOM para transfer syntaxes comprimidos, multiframe y series completas.
- Separar configuracion de IA documental y vision medica si se necesitan proveedores/modelos distintos.
- Agregar evaluacion clinica con dataset validado antes de usar resultados como apoyo de mayor riesgo.

## Verificacion ejecutada

```bash
cd medical-agenda-saas
npm exec tsc -- --noEmit --pretty false
npm exec vitest run tests/medical-imaging-detection.test.ts tests/document-ai.test.ts
```

Resultado: TypeScript OK, 12 tests OK.
