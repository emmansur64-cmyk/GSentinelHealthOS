# MULTIMODAL_CONTRACT_REPORT.md
**GSentinelHealthOS — Reporte de Contratos Multimodales e Imaging**
**Fecha:** 2026-05-16
**Alcance:** Contratos de imagen médica, análisis multimodal, DICOM, payloads imagen-texto.

---

## ESTADO ACTUAL DEL PIPELINE MULTIMODAL

### Resumen de Capacidades Reales vs Declaradas

| Capacidad | Declarada | Activa en Runtime | Evidencia |
|---|---|---|---|
| Análisis de imagen médica (JPEG/PNG/WEBP) | SÍ | PARCIAL — solo si `MEDICAL_IMAGING_API_URL` configurado | `MedicalImagingService` |
| Análisis DICOM | SÍ (contract en `imaging/dicom.contract.ts`) | NO — `dicomEnabled: false` por feature flag | `imaging/feature-flags.ts` |
| Visión Groq (text+image) | NO — `supports_image: false` | NO | `groq/capabilities.ts` |
| CNN local (PyTorch) | SÍ — `SmallMedicalCNN` 3 clases | PARCIAL — sin pesos entrenados cargados | `cerebro_ai_med/vision/image_model.py` |
| Routing multimodal en MB-Chat | SÍ — detecta `hasImage` | PARCIAL — detecta pero no siempre ejecuta imaging | `medical-assistant.service.ts` |
| Human review gate | SÍ | SÍ — `imageHumanReviewRequired: true` | `imaging/feature-flags.ts` |

---

## MULTIMODAL-01: Contrato de entrada de imagen en MedicalAssistantChatDto
**Estado: PARCIALMENTE TIPADO**

**Evidencia:**
```typescript
// MB-Chat/src/medical-assistant/medical-assistant.types.ts
export class MedicalAssistantChatDto {
  @IsOptional()
  @IsString()
  @MaxLength(200000)
  imageBase64?: string;

  @IsOptional()
  @IsEnum(MedicalAssistantImageMimeType)
  imageMimeType?: MedicalAssistantImageMimeType;
  // MedicalAssistantImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  patientAge?: number;

  @IsOptional()
  @IsString()
  modalityHint?: string;  // ← string libre, no tipado como enum de modalidades
}
```

**Gaps detectados:**
1. `imageMimeType` tiene enum correcto pero no hay validación de coherencia con el contenido real del base64
2. `modalityHint` es `string` libre — sin enum de modalidades: `XRAY | CT | MRI | ECHO | FUNDUS | DERM | ...`
3. `imageBase64` tiene `MaxLength(200000)` pero no hay validación de que es base64 válido ni de tamaño real del archivo decodificado
4. No hay `imageHash` para correlacionar el análisis con la imagen original en el audit trail

---

## MULTIMODAL-02: Transición de MedicalAssistantService hacia imaging
**Estado: CONTRATO IMPLÍCITO**

**Evidencia:**
```typescript
// MB-Chat/src/medical-assistant/medical-assistant.service.ts
const hasImage = typeof input.imageBase64 === 'string' && input.imageBase64.trim().length > 0;
const modality = hasText && hasImage ? 'multimodal' : hasImage ? 'image' : 'text';

// ...luego invoca:
await this.aiService.answerMedicalQuestion(
  query,
  country,
  topK,
  input.imageBase64,   // ← string | undefined, sin validación adicional
  input.imageMimeType, // ← enum | undefined
  input.patientAge,    // ← number | undefined
  input.modalityHint,  // ← string | undefined
  ...
)
```

**Problema:** El `input.imageBase64` pasa directamente a `AiService` sin:
- Verificar que `imageMimeType` sea coherente con el magic bytes del base64
- Verificar feature flag `medicalVisionEnabled` antes de procesar
- Generar un `imageHash` para audit trail
- Verificar que el tamaño decodificado esté dentro de límites seguros

---

## MULTIMODAL-03: AiService — routing imagen vs Groq vs external API
**Estado: CONTRATO IMPLÍCITO**

**Evidencia:**
```typescript
// MB-Chat/src/ai/ai.service.ts
async answerMedicalQuestion(
  query: string,
  ...
  imageBase64?: string,
  imageMimeType?: string,
  ...
): Promise<MedicalAnswer> {
  const hasImage = typeof imageBase64 === 'string' && imageBase64.trim().length > 0;
  // ← Si hasImage: delega a medicalImagingService.analyzeImage()
  // ← Si !hasImage: usa Groq para texto
```

**Evidencia del routing actual:**
```typescript
// MB-Chat/src/ai/medical-imaging.service.ts
// Si MEDICAL_IMAGING_API_URL no está configurado → retorna mensaje de error controlado
// Si está configurado → POST a API externa con imagen en JSON
```

**Contrato de la API externa:**
```typescript
interface ImagingApiResponse {
  findings?: string;
  probability?: number;
  notes?: string;
}
```
**Este contrato es incompleto.** Una API de imaging médico real retorna mucho más que 3 campos. No hay schema para: `modality`, `study_date`, `radiologist_comment`, `urgency_flag`, `dicom_reference`.

---

## MULTIMODAL-04: Next.js imagen analysis route — contrato de entrada
**Estado: SIN SCHEMA EXPLÍCITO**

**Evidencia:**
```typescript
// medical-agenda-saas/src/app/api/ai/image-analysis/route.ts
export async function POST(request: NextRequest) {
  // Lee multipart/form-data sin Zod schema
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const source = formData.get('source');
  // ← sin Zod, sin schema de validación
```

**Análisis del flow:**
1. `formData.get('file')` — sin validación de que existe
2. `as File` — cast sin verificación de tipo
3. `formData.get('source')` — parseado con función helper `parseSource()` que solo acepta `"doctor_chat"`, pero sin validación explícita de la variable

**No hay contrato formal para el multipart request de análisis de imágenes en el SaaS.**

---

## MULTIMODAL-05: SmallMedicalCNN — contrato de inferencia
**Estado: PROTOTIPO SIN CONTRATO DE PRODUCCIÓN**

**Evidencia:**
```python
# MB-Chat/cerebro_ai_med/vision/image_model.py
class SmallMedicalCNN(nn.Module):
    # 3 clases: ["normal", "possible_pneumonia", "possible_fracture"]
    # Input esperado: grayscale 224x224
    # Output: logits → softmax → 3 probabilidades
```

**Contratos faltantes:**
1. No hay validación de modalidad de imagen vs modelo — el modelo espera XRAY pero puede recibir cualquier imagen
2. No hay contrato de versión del modelo — `model_name` es un string sin semver
3. No hay contrato de umbrales de confianza — `confidence = 0.4` puede activar un finding sin threshold
4. No hay contrato de threshold de derivación a revisión humana
5. Labels son strings literales sin enum formal

```python
# Sin enum:
self.LABELS = ["normal", "possible_pneumonia", "possible_fracture"]
# ← strings mutables, sin tipo, sin validación de integridad
```

---

## MULTIMODAL-06: MedicalImagingResult — falta de trazabilidad
**Estado: INCOMPLETO PARA PRODUCCIÓN**

**Evidencia:**
```typescript
// MB-Chat/src/ai/medical-imaging.service.ts
export interface MedicalImagingResult {
  findings: string;
  probability: number;
  notes: string;
  assisted: true;
  provider: string;
  // CAMPOS FALTANTES PARA PRODUCCIÓN CLÍNICA:
  // imageHash: string        — para verificar integridad de la imagen analizada
  // traceId: string          — para audit trail
  // requestedAt: string      — timestamp del análisis
  // humanReviewRequired: boolean  — flag de revisión obligatoria
  // modalityDetected: string — qué modalidad detectó el modelo
  // modelVersion: string     — versión del modelo usado
  // patientIdHash: string    — hash del paciente (no PHI, solo para correlación)
}
```

---

## MULTIMODAL-07: Conflict detection multimodal (confidence_py)
**Estado: IMPLEMENTADO, NO INTEGRADO AL PATH REAL**

**Evidencia:**
```python
# MB-Chat/confidence_py/multimodal_conflict.py — existe
# MB-Chat/confidence_py/types.py
@dataclass(slots=True)
class MultimodalConflictResult:
    multimodal_conflict_detected: bool
    conflicts: list[str]
```

El sistema de confianza tiene `MultimodalConflictResult` para detectar conflictos entre texto e imagen, pero este sistema Python no está integrado al flow NestJS de `MedicalAssistantService`. El resultado de imaging llega a NestJS como `MedicalImagingResult` y no pasa por el engine de conflictos Python.

---

## MULTIMODAL-08: DICOM — contrato declarado, pipeline no activo
**Estado: CONTRATO EXISTE, RUNTIME APAGADO**

**Evidencia:**
```typescript
// MB-Chat/imaging/dicom.contract.ts — existe
// MB-Chat/imaging/feature-flags.ts
dicomEnabled: false,          // ← apagado
dicomShadowMode: true,        // ← shadow mode
```
```python
# MB-Chat/imaging_py/dicom_contract.py — existe
```

Los contratos DICOM están definidos en ambos lenguajes pero el pipeline está completamente apagado. No hay riesgo de producción activo, pero el contrato TS y el Python deben verificarse para coherencia antes de activar.

---

## RESUMEN MULTIMODAL

| ID | Descripción | Estado | Riesgo |
|---|---|---|---|
| MM-01 | Entrada de imagen sin validación de magic bytes ni modalityHint enum | INCOMPLETO | ALTO |
| MM-02 | Transición service→imaging sin feature flag check | CONTRATO IMPLÍCITO | ALTO |
| MM-03 | ImagingApiResponse con 3 campos opcionales | INCOMPLETO | CRÍTICO |
| MM-04 | Next.js image route sin Zod schema | SIN SCHEMA | ALTO |
| MM-05 | SmallMedicalCNN sin labels enum ni threshold contract | PROTOTIPO | CRÍTICO |
| MM-06 | MedicalImagingResult sin traceId/imageHash | INCOMPLETO | ALTO |
| MM-07 | MultimodalConflictResult no integrado al path NestJS | NO INTEGRADO | MEDIO |
| MM-08 | DICOM contrato dual TS/Python sin verificación de coherencia | APAGADO | BAJO |

**Conclusión:** El pipeline multimodal tiene arquitectura correcta pero **ningún contrato está completo para producción clínica**. El camino crítico de imagen médica tiene 3 contratos CRÍTICOS y 4 ALTOS sin resolver.
