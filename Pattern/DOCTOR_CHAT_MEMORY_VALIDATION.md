# Validación: Doctor Chat Memory Conversacional

**Fecha:** 17 de mayo de 2026  
**Estado:** Implementado con logging detallado para debugging

---

## Cambios Realizados

### 1. **Carga de Memoria Multi-Sesión** (`chat.service.ts`)

Función `loadScopedDoctorMemoryExchanges()` que:
- Carga los últimos 80 intercambios (doctor message + IA response) para el mismo doctor y paciente
- Respeta límites de tenant
- No mezcla pacientes ni conversaciones borradas
- Emite logs de debug con cantidad de exchanges encontrados

### 2. **Construcción de Memoria Conversacional** (`memory-manager.ts`)

Función `buildMedicalConversationMemory()` ahora:
- Recibe los exchanges cargados por `loadScopedDoctorMemoryExchanges()`
- Genera resumen comprimido de conversaciones previas
- Extrae menciones de medicamentos, hipótesis, decisiones clínicas
- Emite logs detallados si está habilitada o en fallback

### 3. **Inyección en Prompt de Groq** (`groq-doctor-chat.ts`)

Función `buildMessages()` ahora:
- Extrae la memoria del contexto
- Emite logs de debug si la memoria se cargó correctamente
- Inyecta sección "MEMORIA CLINICA CONVERSACIONAL" en el prompt de Groq
- Groq recibe esta información y la usa para responder considerando historial previo

---

## Flujo de Validación: Qué Logs Buscar

### **Paso 1: Carga de Memoria**
```
event: "doctor_chat.memory_load_start"
- doctor_id: "doctor-001"
- patient_id: "patient-123" (o "general" si sin paciente)
- total_rows_found: N (número de registros de audit_log encontrados)
```

✅ **Esperado:** `total_rows_found > 0` si hay chats previos guardados

### **Paso 2: Filtrado de Exchanges**
```
event: "doctor_chat.memory_load_complete"
- total_exchanges_after_filter: N
- exchanges_sample: [
    { doctor_msg: "...", assistant_msg: "..." },
    { doctor_msg: "...", assistant_msg: "..." }
  ]
```

✅ **Esperado:** `total_exchanges_after_filter > 0` si la carga fue exitosa

### **Paso 3: Construcción de Memoria**
```
event: "medical_conversation_memory.build_start"
- enabled: true
- input_exchanges_count: N

event: "medical_conversation_memory.build_success"
- summary_length: M (caracteres en el resumen)
- decisions_count: K
- medications_count: J
- active_conversation: true
```

✅ **Esperado:** `active_conversation: true` y `summary_length > 0`

### **Paso 4: Inyección en Groq**
```
event: "doctor_chat.groq.memory_loaded"
- active_conversation: true
- summary_length: M
- decisions: K
- medications: J

event: "doctor_chat.groq.memory_injected_to_prompt"
- memory_active: true
- messages_count: 1 (el mensaje de memoria)
- summary_excerpt: "..."
```

✅ **Esperado:** Ambos logs presentes = memoria está siendo inyectada al prompt

---

## Test Manual: Cómo Reproducir

### **Sesión 1: El doctor se presenta**
1. Doctor abre chat sin paciente seleccionado (o con un paciente)
2. Dice: "Mi nombre es Dr. Juan Pérez"
3. IA responde algo
4. Doctor cierra el chat

📊 **Resultado esperado en logs:**
- `doctor_chat.exchange` se guarda en `auditLog`
- doctor_message = "Mi nombre es Dr. Juan Pérez"
- response = respuesta de IA

### **Sesión 2: El doctor pregunta si recuerda**
1. Doctor abre un **nuevo chat** (session_id diferente) con el **mismo paciente** (o sin paciente)
2. Dice: "¿Recuerdas mi nombre?"
3. **Verifica los logs:**

```bash
# En servidor frontend (Next.js):
# Buscar logs con:
- "doctor_chat.memory_load_complete"
- "medical_conversation_memory.build_success"
- "doctor_chat.groq.memory_injected_to_prompt"
```

Si ves estos tres logs en orden:
- ✅ Memoria se cargó
- ✅ Memoria se procesó
- ✅ Memoria se inyectó a Groq

### **Respuesta esperada de la IA:**

**Opción A (con memoria funcionando):**
> "Sí, Doctor. Basándome en nuestra conversación anterior, su nombre es Dr. Juan Pérez. ¿En qué puedo ayudarlo hoy?"

**Opción B (sin memoria - INCORRECTO):**
> "Según el contexto disponible, su nombre es doctor.demo. ¿Es correcto?"

---

## Posibles Problemas y Soluciones

### ❌ **Problema: No veo logs de memoria**

**Causa probable:** `MEDICAL_CONVERSATION_MEMORY_ENABLED=false` en `.env`

**Solución:**
```bash
# En .env, agregar o activar:
MEDICAL_CONVERSATION_MEMORY_ENABLED=true
MEDICAL_CONVERSATION_MEMORY_MAX_EXCHANGES=12
MEDICAL_CONVERSATION_MEMORY_TTL_HOURS=12
```

### ❌ **Problema: `total_exchanges_after_filter: 0`**

**Causa probable:**
- No hay chats previos guardados
- O fueron borrados con "clear chat"
- O son de otro doctor/paciente

**Solución:**
- Hacer 2+ chats en la misma sesión primero
- Guardar esos chats
- Luego abrir uno nuevo y verificar que se cargan

### ❌ **Problema: IA ignora la memoria inyectada**

**Causa probable:**
- Groq recibió la memoria pero eligió ignorarla
- O la IA está configurada para no usar contexto conversacional

**Solución:**
- Verificar que `GROQ_SAFE_FOR_PHI=false` (por defecto)
- Groq debería usar la memoria si está en el prompt

---

## Archivo de Prueba: Unit Tests

Se creó [src/chat/__tests__/chat-memory-flow.test.ts](../medical-agenda-saas/src/chat/__tests__/chat-memory-flow.test.ts) que valida:

1. ✅ Se cargan exchanges de sesiones previas
2. ✅ No se mezclan pacientes
3. ✅ Se respetan límites de "clear" chat
4. ✅ Memory estructura es correcta

**Ejecutar tests:**
```bash
cd medical-agenda-saas
npm run test -- chat-memory-flow
```

---

## Resumen del Aprendizaje Híbrido

| Componente | Qué Hace | Evidencia |
|---|---|---|
| **loadScopedDoctorMemoryExchanges()** | Carga historial multi-sesión | Log: `memory_load_complete` |
| **buildMedicalConversationMemory()** | Comprime y resume exchanges | Log: `medical_conversation_memory.build_success` |
| **Groq Prompt Injection** | Inyecta sección "MEMORIA CLINICA" | Log: `memory_injected_to_prompt` |
| **IA Response** | Usa memoria para responder | "Basándome en nuestro chat anterior..." |

---

**Próximos pasos:**
1. Revisar logs en producción
2. Confirmar que `memory_load_complete` trae exchanges > 0
3. Confirmar que `memory_injected_to_prompt` se emite
4. Validar que respuestas de IA mencionan historial previo
