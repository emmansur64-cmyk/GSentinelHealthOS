# CONTRACT_MIGRATION_PLAN.md
**GSentinelHealthOS — Plan de Migración de Contratos**
**Fecha:** 2026-05-16
**Objetivo:** Migrar contratos actuales hacia sus versiones endurecidas sin perder datos existentes ni romper backward compatibility.
**Principio:** Todo cambio de schema que afecte persistencia DEBE mantener capacidad de leer registros legacy.

---

## INVENTARIO DE DATOS PERSISTIDOS CON SCHEMA

Los siguientes elementos tienen datos persistidos en disco/DB cuyo schema puede cambiar:

| Fuente | Almacenamiento | Formato | Tamaño estimado | Riesgo migración |
|---|---|---|---|---|
| MedicalChatLearningRecord | JSONL file | JSON por línea | Desconocido | ALTO — no tiene schema_version |
| MemoryEntry | JSONL file (shadow) | JSON por línea | Mínimo (shadow mode) | BAJO — no en producción aún |
| DomainEvent / OutboxRecord | PostgreSQL tabla | JSON column | Potencialmente alto | MEDIO — schema_version existe |
| AppointmentRecord | PostgreSQL (Alembic) | Columnas | Producción | BAJO — Alembic migrations |
| WhatsApp queue messages | Redis (efímero) | JSON string | Efímero | MUY BAJO — TTL corto |

---

## MIGRACIÓN-01: MedicalChatLearningRecord → schemaVersion

**Problema:** Los registros JSONL existentes no tienen `schemaVersion`.
**Riesgo:** Si se hace obligatorio, los registros legacy no serán legibles.

**Estrategia: Migración en 3 fases (versionado progresivo)**

### Fase 1 — Agregar schemaVersion al writer (non-breaking):
```typescript
// medical-chat-learning.service.ts
const record: MedicalChatLearningRecord = {
  schemaVersion: 1,       // ← NUEVO. Registros legacy no lo tienen.
  id: ...,
  recordedAt: ...,
  // ...resto igual
};
await this.appendToJSONL(record);
```

**Resultado:** A partir de este deploy, todos los registros nuevos tendrán `schemaVersion: 1`. Los legacy quedan sin versión.

### Fase 2 — Reader con fallback (non-breaking):
```typescript
private readLearningRecord(raw: unknown): MedicalChatLearningRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  // Compatibilidad legacy — si no tiene schemaVersion, asumir v0→v1
  if (!obj.schemaVersion) {
    return this.migrateLegacyToV1(obj);
  }
  if (obj.schemaVersion === 1) {
    return obj as MedicalChatLearningRecord;
  }
  // Versión futura desconocida — ignorar con log
  this.logger.warn(`[Learning] Unknown schemaVersion: ${obj.schemaVersion}`);
  return null;
}

private migrateLegacyToV1(obj: Record<string, unknown>): MedicalChatLearningRecord {
  return {
    schemaVersion: 1,
    id: String(obj.id ?? crypto.randomUUID()),
    recordedAt: String(obj.recordedAt ?? new Date().toISOString()),
    sessionId: String(obj.sessionId ?? ''),
    doctorRole: String(obj.doctorRole ?? 'DOCTOR'),
    query: String(obj.query ?? obj.message ?? ''),
    response: String(obj.response ?? ''),
    outcomes: Array.isArray(obj.outcomes) ? obj.outcomes : [],
    concepts: Array.isArray(obj.concepts) ? obj.concepts : [],
    patientAgeRange: obj.patientAgeRange ?? null,
    mode: String(obj.mode ?? 'doctor_professional'),
    approved: Boolean(obj.approved ?? false),
  } as MedicalChatLearningRecord;
}
```

### Fase 3 — (Opcional, después de 30+ días) Reescribir archivo JSONL:
```typescript
// Herramienta offline de migración:
async migrateJSONLFile(): Promise<void> {
  const lines = await fs.readFile(this.learningFilePath, 'utf-8');
  const migrated = lines.split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l))
    .map(r => this.readLearningRecord(r))
    .filter(Boolean)
    .map(r => JSON.stringify(r));
  await fs.writeFile(this.learningFilePath + '.migrated', migrated.join('\n'));
  // Renombrar manualmente después de validar
}
```

---

## MIGRACIÓN-02: MemoryEntry (shadow mode) → activación futura

**Situación:** MemoryEntry en JSONL está en shadow mode. No hay datos de producción reales.
**Estrategia:** Incluir `schema_version: int = 1` desde la primera versión activa. No hay legacy que migrar.

```python
# memory_py/types.py — antes de activar:
@dataclass
class MemoryEntry:
    schema_version: int = 1  # ← agregar campo con default
    id: str = ""
    # ...resto de campos
```

**No requiere migración** — shadow mode significa que los archivos JSONL existentes son descartables.

---

## MIGRACIÓN-03: DomainEvent schema_version bump

**Situación actual:**
```python
class DomainEvent(BaseModel):
    schema_version: int = 1  # ← ya existe
    event_type: EventType
    # ...
```

**La tabla `outbox` en PostgreSQL** tiene registros con `schema_version: 1`.

**Cuando se agregue un campo nuevo al DomainEvent:**

### Estrategia: versión additive (backward compatible)
```python
# Agregar campo con default: siempre backward compatible
class DomainEvent(BaseModel):
    schema_version: int = 1
    new_field: str | None = None  # ← con default None, los registros v1 siguen siendo válidos
```

### Estrategia: versión breaking (renombrar campo, cambiar tipo)
```python
# Bump schema_version:
class DomainEvent(BaseModel):
    schema_version: int = 2  # ← bump
    # El relay.py debe manejar versiones:
    # if record.schema_version == 1: migrar
    # if record.schema_version == 2: usar directo
```

**Regla:** Todo cambio al schema de DomainEvent que no sea additive debe hacer `schema_version += 1`.

---

## MIGRACIÓN-04: DecideRequest.role str → Literal

**Impacto en producción:** El SaaS Next.js siempre envía `"DOCTOR"`. Cambiar Python de `str` a `Literal["DOCTOR","PATIENT","SYSTEM"]` no rompe clientes existentes.

**Riesgo:** Si algún consumidor envía un role no esperado (p.ej., `"doctor"` en minúsculas), Python empezará a rechazarlo con 422.

**Estrategia: migración en 2 pasos**

### Paso 1 — Validación con normalization (non-breaking):
```python
from pydantic import field_validator
class DecideRequest(BaseModel):
    role: str

    @field_validator('role')
    @classmethod
    def normalize_role(cls, v: str) -> str:
        normalized = v.upper()
        allowed = {"DOCTOR", "PATIENT", "SYSTEM"}
        if normalized not in allowed:
            raise ValueError(f"role debe ser uno de: {allowed}")
        return normalized
```

### Paso 2 (luego de confirmar que todos los callers envían uppercase) — Literal directo:
```python
class DecideRequest(BaseModel):
    role: Literal["DOCTOR", "PATIENT", "SYSTEM"]
```

---

## MIGRACIÓN-05: WhatsApp Redis messages → Pydantic

**Situación:** Los mensajes en Redis son JSON sin schema formal. Son efímeros (se consumen al leer).

**Estrategia:** No hay migración de datos necesaria — Redis no tiene persistencia larga para este queue. El cambio de writer + reader puede hacerse en un único deploy coordinado.

**Plan:**
1. Deploy WhatsApp Gateway con el nuevo `WhatsAppOutgoingMessage` reader que hace `.model_validate_json()` con try/except
2. Los mensajes legacy en Redis que no matcheen el schema serán loggeados como error y descartados (ya es el comportamiento actual cuando falla el parsing)
3. Deploy Brain/API con el nuevo writer que usa `WhatsAppOutgoingMessage(...).model_dump_json()`
4. Sin ventana de incompatibilidad — el reader con try/except maneja ambas versiones durante la transición

---

## RESUMEN DE ESTRATEGIAS DE MIGRACIÓN

| # | Contrato | Estrategia | Ventana de incompatibilidad | Pérdida de datos posible |
|---|---|---|---|---|
| MIG-01 | LearningRecord JSONL | 3 fases: writer primero, reader con fallback, reescritura opcional | Ninguna | No |
| MIG-02 | MemoryEntry JSONL | Campo con default desde v1 activa | Ninguna (shadow mode) | No aplica |
| MIG-03 | DomainEvent DB | Additive: con default. Breaking: schema_version bump + relay migration | Corta (deploy relay + writer) | No |
| MIG-04 | DecideRequest.role | Normalización primero, Literal después de verificar | Ninguna con normalización | No |
| MIG-05 | WhatsApp Redis | Deploy coordinado writer+reader con try/except | Muy corta (TTL Redis) | Mensajes en tránsito |

---

## GATE CRITERIA DE MIGRACIÓN

Antes de aplicar cualquier migración:
1. **Backup de datos**: Para JSONL files, copiar archivo antes de modificar
2. **Prueba en staging**: Ejecutar migración completa en ambiente de staging con datos reales
3. **Validación de integridad**: Contar registros antes y después de migración
4. **Rollback plan documentado**: Para cada migración, definir cómo revertir si hay errores
