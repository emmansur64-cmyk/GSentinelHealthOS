# Medical Imaging DL Pipeline (PyTorch -> ONNX -> Node)

## Objetivo

Analizar imagenes medicas (RMN, RX, TAC) con Deep Learning sin OCR para este flujo.

## Estructura

- data/train
- data/val
- data/test
- scripts/preprocess_images.py
- dl/model.py
- train_dl.py
- export_onnx.py
- models/medical_model.pt
- models/medical_model_v1.onnx

## Etiquetas recomendadas

Formato de clase por carpeta:

study__region__finding

Ejemplos:

- mri__knee__none
- ct__chest__effusion
- xray__spine__fracture

## Flujo de entrenamiento

1. Instalar dependencias Python:

   pip install -r requirements-medical-imaging.txt

2. Preprocesar dataset:

   npm run imaging:preprocess

3. Entrenar modelo:

   npm run imaging:train

4. Validar metricas en:

   models/medical_metrics.json

5. Criterio minimo:

   accepted debe ser true y global_accuracy >= 0.70.

6. Exportar ONNX:

   npm run imaging:export-onnx

7. Generar plantilla automatica de model_config desde todos los ONNX:

   npm run imaging:generate-model-config

## Inference en Node

Endpoint:

POST /api/imaging/analyze

Soporta modelos ONNX preentrenados configurados en:

models/model_config.json

Modelos recomendados para integracion rapida:

- chexnet_xray_v1.onnx
- rsna_ct_hemorrhage_v1.onnx
- medmnist_mri_v1.onnx

Entradas:

- multipart form-data con campo image
- JSON con image_base64

Salida:

- study_type
- condition
- probability
- region
- findings
- confidence
- model_version
- metabrain.response

## Variables utiles

- MEDICAL_IMAGING_ENABLE_ONNX=true
- MEDICAL_IMAGING_MODEL_PATH=models/medical_model_v1.onnx
- MEDICAL_IMAGING_CONFIG_PATH=models/model_config.json
- MEDICAL_IMAGING_MAX_LATENCY_MS=100

## Nota de preprocesado critico

El preprocesado en Node replica por modelo:

- input_size
- channels
- mean/std

Estos parametros se toman de models/model_config.json y deben coincidir con el entrenamiento original del modelo preentrenado.

## Seguridad clinica

Todas las respuestas incluyen advertencia de analisis asistido y no reemplazo diagnostico.
