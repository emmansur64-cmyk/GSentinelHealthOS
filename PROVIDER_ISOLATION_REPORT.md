# PROVIDER_ISOLATION_REPORT.md
**GSentinelHealthOS — Reporte de Aislamiento de Proveedores de AI**
**Fecha:** 2026-05-16
**Alcance:** Groq, OpenAI, Gemini, Local, Future-Medical. Contratos de provider, feature flags, fallback, PHI.

---

## ARQUITECTURA DE PROVIDERS (evidencia real)

### Providers declarados en MB-Chat/providers/types.ts:
```typescript
export type ProviderName = "groq" | "openai" | "gemini" | "local" | "future-medical";
```

### Providers con implementación real verificada:
| Provider | Adapter | Capabilities | Health | Estado |
|---|---|---|---|---|
| `groq` | `MB-Chat/providers/groq/adapter.ts` | `capabilities.ts` | `health.ts` | ACTIVO |
| `openai` | `MB-Chat/providers/openai/` (existe dir) | No inspeccionado | — | DECLARADO |
| `gemini` | `MB-Chat/providers/gemini/` (existe dir) | No inspeccionado | — | DECLARADO |
| `local` | `MB-Chat/providers/local/` (existe dir) | No inspeccionado | — | DECLARADO |
| `future-medical` | `MB-Chat/providers/future-medical/` (existe dir) | No inspeccionado | — | DECLARADO |

---

## AISLAMIENTO GROQ (proveedor activo principal)

### Capacidades declaradas:
```typescript
// MB-Chat/providers/groq/capabilities.ts
export const GROQ_CAPABILITIES: ProviderCapabilities = {
  supports_text: true,
  supports_image: false,      // ← texto solamente
  supports_multimodal: false,
  supports_structured_output: true,
  supports_streaming: true,
  supports_medical_mode: false, // ← NO tiene modo médico nativo
  max_context_tokens: 8192,
  safe_for_phi: false,          // ← NO seguro para PHI
};
```

### Estado del adapter:
```typescript
// MB-Chat/providers/groq/adapter.ts
export class DisabledGroqAdapter implements GroqProviderAdapter {
  async complete(input: ProviderRequest): Promise<ProviderResponse> {
    return buildProviderResponse({
      status: "disabled",
      safety_flags: ["PROVIDER_DISABLED", "NO_EXTERNAL_CALL"],
    });
  }
}
```
**NOTA CRÍTICA:** El adapter en `MB-Chat/providers/groq/adapter.ts` es `DisabledGroqAdapter`. El Groq activo en el sistema es `MB-Chat/src/ai/providers/groq.provider.ts` (NestJS). Existe una **dualidad de implementaciones Groq**: una en el sistema de providers tipado (`MB-Chat/providers/`) y otra directamente en NestJS (`MB-Chat/src/ai/providers/`). El router de providers tipado (`llm-orchestrator.ts`) usa la primera; el `AiService` de NestJS usa la segunda directamente.

---

## ISOLATION-01: Dualidad de implementación Groq
**Estado: RIESGO ARQUITECTÓNICO**

**Evidencia:**
- `MB-Chat/providers/groq/adapter.ts` — `DisabledGroqAdapter`, parte del sistema de providers formales
- `MB-Chat/src/ai/providers/groq.provider.ts` — `GroqProvider` NestJS Injectable, **activo en runtime**

**Problema:** El sistema de providers formales (`providers/`) define contratos, capabilities, feature flags y health checks. Pero el `AiService` de NestJS **no usa** ese sistema — usa su propio `GroqProvider` directamente. Esto significa que:
1. Los `GROQ_CAPABILITIES.safe_for_phi = false` no son evaluados en el path real
2. Los feature flags de `providers/groq/` no afectan al `GroqProvider` de NestJS
3. El `llm-orchestrator.ts` puede estar configurado pero sin efecto real

**Nivel de riesgo:** ALTO.

---

## ISOLATION-02: safe_for_phi no enforced en AiService
**Estado: VULNERABILIDAD ACTIVA**

**Evidencia:**
```typescript
// MB-Chat/src/ai/ai.service.ts
async answerMedicalQuestion(
  query: string,
  country = 'US',
  topK = 6,
  imageBase64?: string,
  ...
): Promise<MedicalAnswer> {
  // ← NO hay verificación de `GROQ_CAPABILITIES.safe_for_phi` antes del call
  // ← NO hay PHI detection en `query` antes de enviar a Groq
```

**Resultado:** Queries médicos que pueden contener PHI (`"El paciente Juan García, 45 años, DNI 30123456 tiene..."`) se envían a Groq sin verificación.

---

## ISOLATION-03: ProviderRequest no lleva safety_level al call real
**Estado: CONTRATO DECLARADO, NO ENFORCED**

**Evidencia:**
```typescript
// MB-Chat/providers/types.ts
export type ProviderRequest = {
  safety_level: ProviderSafetyLevel;  // "public" | "internal" | "phi_possible" | "phi_blocked"
  ...
};
```

El `ProviderRequest` tiene `safety_level`, pero el `GroqProvider` NestJS no usa `ProviderRequest`. Recibe un prompt string directamente:
```typescript
// MB-Chat/src/ai/providers/groq.provider.ts (inferido)
// La interfaz real es prompt: string, no ProviderRequest
```

El contrato `ProviderRequest` con `safety_level` existe en el sistema de providers formales pero no está integrado al path de ejecución real.

---

## ISOLATION-04: ProviderResponse.confidence_score opcional
**Estado: DERIVA DE CONTRATO**

**Evidencia:**
```typescript
// MB-Chat/providers/types.ts
export type ProviderResponse = {
  confidence_score?: number;  // ← opcional
  ...
};
```

El `confidence_score` llega a `ClinicalConfidenceInput` como `ProviderOutputSummary.confidence_score?: float | None`. Un proveedor que no retorna `confidence_score` (como Groq en texto) produce inputs al motor de confianza con `None`. El motor de confianza tiene que manejar `None` en todas las rutas, lo que genera paths de bajo coverage.

---

## ISOLATION-05: Feature flags no versionados entre providers
**Estado: IMPLÍCITO**

**Evidencia:**
```typescript
// MB-Chat/providers/provider-flags.ts (existe)
// MB-Chat/imaging/feature-flags.ts
// MB-Chat/memory_py/types.py: MemoryFeatureFlags
// MB-Chat/providers/groq/capabilities.ts: GROQ_CAPABILITIES
```

Hay **4 sistemas de feature flags separados** para providers:
1. `ProviderFeatureFlags` en `providers/types.ts`
2. `GROQ_CAPABILITIES` hardcoded en `groq/capabilities.ts`
3. `ImageFeatureFlags` en `imaging/feature-flags.ts`
4. `MemoryFeatureFlags` en `memory_py/types.py`

No hay un punto único de configuración de provider. Un cambio en capacidades de Groq requiere actualizar múltiples archivos sin garantía de coherencia.

---

## ISOLATION-06: Fallback provider no tiene contrato de capabilities
**Estado: IMPLÍCITO**

**Evidencia:**
```typescript
// MB-Chat/src/ai/providers/fallback.provider.ts
// El FallbackProvider existe pero no implementa ProviderCapabilities formal
// No hay capacidades declaradas (soporta imagen? PHI seguro?)
```

El `FallbackProvider` es la última línea de defensa pero no tiene contrato de capabilities. Si el sistema lo activa y el query contiene una imagen, el fallback podría manejarla incorrectamente.

---

## ISOLATION-07: Metabrain Pipeline — provider aislamiento correcto
**Estado: CORRECTO**

**Evidencia:**
```python
# MB-Chat/metabrain/pipeline.py
class GroqLanguagePipeline:
    # Tiene prompts separados por función: orchestrator, normalizer, rewriter, refiner, guardrail, fallback
    # Cada prompt tiene responsabilidad específica y delimitada
    # guardrail verifica seguridad antes de retornar
```

El pipeline de Metabrain tiene buen aislamiento funcional de prompts. Cada paso del pipeline tiene un prompt dedicado y el guardrail evalúa la salida antes de retornar al caller.

---

## ISOLATION-08: MEDICAL_GROQ_PROVIDER token — segundo provider Groq
**Estado: DOCUMENTADO, RIESGO DE CONFUSIÓN**

**Evidencia:**
```typescript
// MB-Chat/src/ai/ai.service.ts
constructor(
  private readonly groqProvider: GroqProvider,
  @Inject(MEDICAL_GROQ_PROVIDER) private readonly medicalGroqProvider: GroqProvider,
)
```

Hay **dos instancias de GroqProvider**: una genérica y una `MEDICAL_GROQ_PROVIDER`. El servicio usa ambas:
- `groqProvider` para análisis e hints genéricos
- `medicalGroqProvider` para `refineMedicalText()`

**Riesgo:** Si ambas instancias apuntan al mismo modelo Groq con diferentes configuraciones de sistema, un cambio en una no se refleja en la otra. No hay evidencia de que la configuración sea diferente entre ambas.

---

## RESUMEN DE AISLAMIENTO DE PROVIDERS

| ID | Descripción | Estado | Riesgo |
|---|---|---|---|
| I-01 | Dualidad implementación Groq | RIESGO ARQUITECTÓNICO | ALTO |
| I-02 | safe_for_phi no enforced | VULNERABILIDAD | ALTO |
| I-03 | ProviderRequest safety_level no llega al path real | CONTRATO NO ENFORCED | ALTO |
| I-04 | confidence_score opcional en ProviderResponse | DERIVA | MEDIO |
| I-05 | Feature flags de providers no centralizados | IMPLÍCITO | MEDIO |
| I-06 | FallbackProvider sin capabilities contract | IMPLÍCITO | MEDIO |
| I-07 | Metabrain pipeline aislamiento | CORRECTO | — |
| I-08 | Dos instancias GroqProvider sin differentiación clara | DOCUMENTADO | BAJO |

**Acción crítica:** Unificar los dos sistemas de providers (formal `MB-Chat/providers/` y NestJS `MB-Chat/src/ai/providers/`) o documentar explícitamente cuál es canónico y cuál es legacy.
