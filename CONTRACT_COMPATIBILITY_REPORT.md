# CONTRACT_COMPATIBILITY_REPORT.md
**GSentinelHealthOS — Reporte de Compatibilidad de Contratos**
**Fecha:** 2026-05-16
**Alcance:** Compatibilidad cross-module y cross-language de todos los contratos del sistema.

---

## METODOLOGÍA

Para cada par de módulos que intercambian datos, se evalúa:
- **Productor**: quién genera el payload
- **Consumidor**: quién procesa el payload
- **Schema productor**: tipo/schema en el productor
- **Schema consumidor**: tipo/schema en el consumidor
- **¿Sincronizado?**: si ambos schemas concuerdan
- **Brecha**: descripción de la incompatibilidad si existe

---

## SECCIÓN 1: SaaS Next.js ↔ Brain FastAPI

### Contrato: DecideRequest (entrada)
| Campo | SaaS (Zod) | Brain (Pydantic) | Compat | Brecha |
|---|---|---|---|---|
| `role` | `z.literal("DOCTOR")` | `str` | PARCIAL | Python acepta cualquier string |
| `message` | `z.string().min(1).max(4000)` | `str, min=1, max=4000` | SÍ | Idéntico |
| `context` | `z.record(string, unknown)` | `DecideContext` con estructura | PARCIAL | TS no valida estructura interna |
| `context.patient.id` | `String(id ?? "")` | `str | None` | SÍ | Compatible |
| `context.patient.notes` | `String(notes ?? "") \| null` | `str | None` | SÍ | Compatible |
| `context.doctor_id` | No incluido en SaaS | `str | None` | GAP | SaaS no envía doctor_id |
| `context.recent_history` | No tipado en SaaS | `list[dict[str,Any]]` | NO TIPADO | Ninguno valida estructura |

### Contrato: DecideResponse (salida)
| Campo | Brain produce | SaaS consume | Zod en SaaS | Brecha |
|---|---|---|---|---|
| `action` | `str` | acceso directo | NO | Sin validación de respuesta |
| `response` | `str` | acceso directo | NO | Sin validación de respuesta |
| `confidence` | `float` | acceso directo | NO | Podría ser NaN o fuera de [0,1] |
| `source` | `str` | acceso directo | NO | Sin validación |
| `entities` | `dict` | acceso directo | NO | Sin validación |

**Rating de compatibilidad: 4/10 — Funcional pero sin garantía de integridad**

---

## SECCIÓN 2: MB-Chat NestJS ↔ Brain Python (cerebro_ai_med)

### Contrato: HybridDecisionOrchestrator salida
| Campo | cerebro_ai_med produce | MB-Chat NestJS consume | Brecha |
|---|---|---|---|
| `final_risk_level` | `str` literal en dict | Ningún schema Zod | Sin validación |
| `consensus` | `str` literal en dict | Ningún schema Zod | Sin validación |
| `final_action_plan` | `str` | Ningún schema Zod | Sin validación |
| `follow_up_hours` | `int` | Ningún schema Zod | Podría ser float o None |

**Rating: 2/10 — Completamente implícito**

---

## SECCIÓN 3: Brain contracts Python ↔ TS equivalentes

### Contratos Python existentes en `brain/contracts/core_contracts.py`:
```
ModeGuardResult, ContractValidationError,
CHAT_ASSISTANT_MODES, SECRETARY_ASSISTANT_MODE,
CHAT_PROHIBITED_TOOLS, SECRETARY_PROHIBITED_TOOLS, WHATSAPP_PROHIBITED_TOOLS
```

### Equivalentes TypeScript en MB-Chat:
| Concepto Python | Equivalente TypeScript | Sincronizado |
|---|---|---|
| `ModeGuardResult` | `BrainDecision` en `brain.types.ts` | PARCIAL — campos diferentes |
| `ClinicalActorRole = "DOCTOR"\|"PATIENT"\|"SYSTEM"` | `ClinicalActorRole = "PATIENT"\|"DOCTOR"\|"ADMIN"` | CRÍTICO — "ADMIN" en TS, "SYSTEM" en Python |
| `CHAT_PROHIBITED_TOOLS: set[str]` | Sin equivalente formal en TS | GAP |
| `ContractValidationError` | Sin equivalente formal en TS | GAP |

**INCOMPATIBILIDAD CRÍTICA:** Python usa `"SYSTEM"` como tercer rol; TypeScript usa `"ADMIN"`. Esto puede causar que validaciones de rol fallen silenciosamente al cruzar el bridge.

---

## SECCIÓN 4: MB-Chat providers formales vs providers activos

### Capacidades declaradas vs activas:
| Capacidad | `providers/groq/capabilities.ts` (formal) | `src/ai/providers/groq.provider.ts` (activo) | Sincronizado |
|---|---|---|---|
| `supports_image` | `false` | No declarado | IMPLÍCITO |
| `safe_for_phi` | `false` | No enforced | GAP |
| `max_context_tokens` | `8192` | No enforced | GAP |
| `supports_medical_mode` | `false` | No declarado | IMPLÍCITO |

**Rating: 3/10 — El sistema formal existe pero no es el ejecutado**

---

## SECCIÓN 5: Appointment schemas SaaS ↔ API FastAPI

### AppointmentCreate (entrada POST /appointments)
| Campo | SaaS Next.js Zod | API FastAPI Pydantic | Sincronizado |
|---|---|---|---|
| `patient_phone` | E.164 regex | E.164 validator | SÍ |
| `appointment_date` | `z.string().datetime()` | `datetime` field | SÍ |
| `doctor_name` | `z.string().min(1)` | `str, min=1` | SÍ |
| `specialty` | `z.string()` | `str` | SÍ |
| `duration_minutes` | No en SaaS | `int` en API | GAP |
| `notes` | `z.string().optional()` | `str | None` | SÍ |

**Rating: 7/10 — Mayormente compatible con gap menor en duration_minutes**

---

## SECCIÓN 6: WhatsApp Gateway ↔ Brain API (Redis queue)

### Formato de mensaje en cola:
| Campo | Brain escribe | Gateway lee | Schema | Brecha |
|---|---|---|---|---|
| `to_phone` | string (inferido) | string (inferido) | NINGUNO | Sin validación |
| `message_text` | string (inferido) | string (inferido) | NINGUNO | Sin validación |
| Todo el schema | dict → json.dumps() | json.loads() → dict | NINGUNO | Sin validación de tipos |

**Rating: 1/10 — Completamente implícito**

---

## SECCIÓN 7: Outbox DomainEvent schemas

### DomainEvent → OutboxRecord → Relay
| Etapa | Schema | Re-validación | Brecha |
|---|---|---|---|
| Escritura en DB | `DomainEvent.model_dump()` | SÍ — al crear | Correcto |
| Almacenamiento | `OutboxRecord.payload: dict[str,Any]` | NO | DRIFT-004 |
| Lectura en relay | Raw dict, sin Pydantic | NO | DRIFT-004 |
| Consumo downstream | Sin schema adicional | NO | Alto riesgo |

**Rating: 5/10 — Bien al escribir, sin garantía al leer**

---

## RESUMEN DE COMPATIBILIDAD GLOBAL

| Par de módulos | Rating | Issues críticos |
|---|---|---|
| SaaS Next.js ↔ Brain FastAPI | 4/10 | role str vs literal, response sin Zod |
| MB-Chat ↔ cerebro_ai_med | 2/10 | dict literal sin schema |
| Brain Python types ↔ TS types | 3/10 | ClinicalActorRole "ADMIN" vs "SYSTEM" |
| providers/ formal ↔ src/ai/ activo | 3/10 | safe_for_phi no enforced |
| SaaS ↔ API Appointments | 7/10 | duration_minutes gap menor |
| WhatsApp Gateway ↔ Brain Redis | 1/10 | sin schema |
| Outbox DomainEvent | 5/10 | no re-validado al leer |

**Compatibilidad promedio del sistema: 3.6/10**
**Compatibilidad en caminos clínicos críticos: 2.5/10**

---

## INCOMPATIBILIDADES CRÍTICAS POR PRIORIDAD

### INCOMPAT-01 (CRÍTICA): ClinicalActorRole "ADMIN" vs "SYSTEM"
- Python: `Literal["DOCTOR", "PATIENT", "SYSTEM"]`
- TypeScript (clinical-policy): `'PATIENT' | 'DOCTOR' | 'ADMIN'`
- **Riesgo:** Un request con role "ADMIN" en TS llega como "ADMIN" a Python que espera "SYSTEM" — falla silenciosamente o con 422 no manejado
- **Fix:** Unificar a `"DOCTOR" | "PATIENT" | "ADMIN"` en ambos lenguajes, o mantener "SYSTEM" y mapear "ADMIN"→"SYSTEM" en el bridge

### INCOMPAT-02 (ALTA): safe_for_phi desincronizado
- Python `confidence_py`: `safe_for_phi: bool` como dato informativo
- TypeScript `providers/groq/capabilities.ts`: `safe_for_phi: false` como declaración
- NestJS `AiService`: no consulta ninguno de los dos
- **Riesgo:** PHI puede llegar a Groq sin control

### INCOMPAT-03 (ALTA): WhatsApp queue totalmente implícito
- Sin schema en ningún lado
- Productor y consumidor deben coordinarse por convención únicamente
- **Riesgo:** Un cambio en el productor rompe el consumidor silenciosamente
