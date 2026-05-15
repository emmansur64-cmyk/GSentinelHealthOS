# Chat State and Delete Fix

Fecha: 2026-05-09
Entorno: LABORATORIO / DEV
Sistema: `E:\GSentinelHealthOS\medical-agenda-saas`

## Estado

FASE CHAT STATE/DELETE FIX COMPLETA

Se corrigio la limpieza persistente de chats y el estado de loading del panel medico sin tocar produccion, Dockerfile, compose, MetaBrain, WhatsApp, retrieval ni runtime context.

## Causa raiz exacta

### Causa real confirmada en runtime

Despues del primer fix, `localhost:3000` seguia sirviendo una imagen vieja del contenedor `gs_frontend`. Reiniciar el contenedor no aplico cambios porque la imagen no habia sido reconstruida.

Evidencia dentro del contenedor antes de reconstruir:

```text
/app/src/chat/chat.service.ts:217 listDoctorChatSessions
```

La query real que alimentaba la lista era:

```ts
prisma.auditLog.findMany({
  where: {
    tenant_id: tenantId,
    entity_type: DOCTOR_CHAT_PARAMS.auditEntityType,
    entity_id: {
      startsWith: `${DOCTOR_CHAT_PARAMS.conversationPrefix}:${input.doctorId}:`,
    },
  },
  orderBy: { created_at: "desc" },
  take: 200,
});
```

Esa query no filtraba `doctor.chat.clear`, no filtraba `doctor_chat.clear_requested` y agrupaba cualquier `audit_log` por `entity_id`. La fuente real de `Chat sin titulo` era esta linea:

```ts
title: message ? (...) : "Chat sin titulo"
```

Cuando el row mas reciente era un marker de clear sin `payload_before.message`, la UI recibia una session con titulo `Chat sin titulo`.

### Delete no persistia visualmente

El boton eliminar llamaba correctamente a:

```text
DELETE /chat/doctor?doctor_id=...&session_id=...
```

pero `clearDoctorChatHistory` no borraba ni ocultaba los intercambios previos. Solo escribia un marker `doctor_chat.clear_requested` y devolvia `deleted_count: 0`.

Luego:

- `listDoctorChatSessions` seguia leyendo todos los `audit_logs` viejos.
- `getDoctorChatHistory` seguia leyendo todos los mensajes viejos.
- El marker de borrado tambien podia contribuir a sesiones sin mensaje, generando `Chat sin titulo`.
- Al cerrar/reabrir o refrescar, el backend devolvia otra vez los chats antiguos.

### Skeleton/loading al reabrir

En `doctor-dashboard.tsx`, `chatLoading` mezclaba dos estados distintos:

- carga de historial;
- envio de mensaje IA.

Ademas, `loadChatHistory` corria aunque el panel estuviera cerrado y no tenia abort/stale guard propio. Si el panel se cerraba durante una carga, podia quedar una transicion de loading confusa al reabrir.

## Endpoints auditados

- `GET /chat/doctor?mode=sessions`: lista sesiones desde `audit_logs`.
- `GET /chat/doctor`: carga historial desde `audit_logs`.
- `DELETE /chat/doctor`: escribe marker de clear.
- `POST /chat/doctor`: genera respuesta IA y persiste intercambio.

No existe tabla dedicada `ChatConversation`/`ChatMessage`; el chat medico persiste sobre `AuditLog`.

Modelo Prisma real:

```text
AuditLog -> tabla audit_logs
```

Campos usados:

- `tenant_id`
- `entity_type = doctor_chat`
- `entity_id = doctor:<doctorId>:patient:<...>:appointment:<...>:chat:<sessionId>`
- `action`
- `payload_before`
- `payload_after`
- `metadata_json`
- `created_at`

## Cambios aplicados

### Backend

Archivo:

```text
medical-agenda-saas/src/chat/chat.service.ts
```

Cambios:

- Se agrego deteccion centralizada de acciones de borrado:
  - `doctor.chat.clear`
  - `doctor_chat.clear_requested`
- `getDoctorChatHistory` ahora devuelve solo intercambios posteriores al ultimo clear.
- `listDoctorChatSessions` ahora ignora conversaciones cuyo ultimo evento relevante fue clear.
- `resolveClinicalContext` ya no pasa historial anterior al ultimo clear como memoria contextual hacia Groq/Brain/MetaBrain.
- `clearDoctorChatHistory` calcula `deleted_count` real sobre intercambios visibles actuales.
- La idempotencia por `chat_request_id` no puede devolver respuestas anteriores a un clear.

Se conserva auditoria: no se borra fisicamente `audit_logs`; se usa tombstone logico para la experiencia de chat.

### Frontend

Archivo:

```text
medical-agenda-saas/src/components/doctor-dashboard.tsx
```

Cambios:

- Se separo `chatHistoryLoading` de `chatLoading`.
- `loadChatHistory` ahora usa `AbortController`.
- Al cerrar chat se aborta carga de historial y envio en curso.
- Al iniciar nuevo chat se aborta carga/envio anterior y se limpia loading.
- Al eliminar el chat seleccionado se limpia:
  - `chatSessionId`
  - `chatMessages`
  - `chatInput`
  - `chatPatientId`
  - `chatAppointmentId`
  - `chatMenuOpen`
  - `chatHistoryLoading`
- El skeleton depende de `chatHistoryLoading`, no del envio IA.

Archivo ya protegido previamente:

```text
medical-agenda-saas/src/components/doctor-chat-hub.tsx
```

Se mantiene con abort/single-flight para envio. La correccion backend hace que su clear general tambien quede persistente.

## WebSocket/cache/local state

- No se encontro uso de `localStorage`/`sessionStorage` para chats medicos.
- No se encontro React Query/SWR para estos endpoints de chat.
- El WebSocket del dashboard no genera IA; solo recarga datos.
- Ya estaba corregido para no recargar historial por evento `message` si `chatOpen === false`.
- Tras delete, el estado local remueve el chat y el backend ya no lo devuelve en refetch.

## Validaciones ejecutadas

- `npm run typecheck`: OK.
- `npx vitest run tests/nlp/groq-doctor-chat.test.ts`: OK, 4 tests.
- Retrieval OFF: OK.
- Retrieval ON mock: OK.
- Retrieval fallback: OK.
- Runtime context time-only: OK.
- `npm run build`: OK.
- `docker compose build frontend`: OK.
- `docker compose up -d --no-deps frontend`: OK.
- Verificacion dentro de `gs_frontend`: el contenedor ya contiene `isDoctorChatClearAction`, `cleared: true`, `deleted_count: existingCount` y `chatHistoryLoading`.

### Validacion HTTP real

Se autentico contra `http://localhost:3000/api/auth/login` como doctor de laboratorio y se probo el endpoint real del contenedor reconstruido.

Resultado:

1. `GET /chat/doctor?doctor_id=lab-doctor&mode=sessions`
   - Resultado inicial despues de aplicar fix: `sessions: []`.
2. `POST /chat/doctor`
   - Mensaje: `hola`
   - Session nueva: `711ae326-c12e-48bd-b54c-582b8984f3bc`
   - Resultado: 200.
3. `GET /chat/doctor?doctor_id=lab-doctor&mode=sessions`
   - Resultado: session nueva aparece con `title: "hola"` y `message_count: 1`.
4. `GET /chat/doctor?doctor_id=lab-doctor&session_id=711ae326-c12e-48bd-b54c-582b8984f3bc`
   - Resultado: 2 mensajes renderizables, doctor + metabrain.
5. `DELETE /chat/doctor?doctor_id=lab-doctor&session_id=711ae326-c12e-48bd-b54c-582b8984f3bc`
   - Resultado: `deleted_count: 1`, `marker_written: true`.
6. `GET /chat/doctor?doctor_id=lab-doctor&mode=sessions`
   - Resultado: `sessions: []`.
7. `GET /chat/doctor?doctor_id=lab-doctor&session_id=711ae326-c12e-48bd-b54c-582b8984f3bc`
   - Resultado: `messages: []`.
8. Nueva autenticacion simulando incognito y nuevo `GET sessions`
   - Resultado: `sessions: []`.

Validacion DB real sobre `audit_logs` para esa session:

- `doctor.chat.exchange`: existe y queda preservado para auditoria.
- `doctor_chat.clear_requested`: existe.
- `doctor.chat.clear`: existe con `payload_after.cleared=true` y `deleted_count=1`.
- `UPDATE` de auditoria funcional: existe con `cleared=true`.

DELETE CHAT PERSISTENTE VALIDADO.

Build mantiene 1 warning NFT de Turbopack ya conocido, no bloqueante y no relacionado con chat state/delete.

## Validacion funcional esperada

1. Abrir chat: carga historial si existe, sin skeleton infinito.
2. Enviar `hola`: IA responde una sola vez.
3. Cerrar chat: aborta cargas/envios activos y limpia loading.
4. Reabrir chat: no queda skeleton infinito.
5. Eliminar chat: backend escribe tombstone, frontend limpia estado.
6. Cerrar/reabrir: chat eliminado no reaparece.
7. Refresh navegador: chat eliminado no reaparece porque `GET mode=sessions` lo filtra.
8. WebSocket activo: no revive chats borrados porque el backend ya no los lista.
9. Crear nuevo chat: usa nueva session y funciona normalmente.

## Riesgos pendientes

- La eliminacion es logica por auditoria, no borrado fisico. Esto preserva trazabilidad clinica pero requiere que futuras queries de chat respeten el tombstone.
- Si en el futuro se crea una tabla `ChatConversation`, conviene migrar este tombstone a un campo `deleted_at` formal.
- `AuditLog` se usa como almacenamiento de chat; a largo plazo seria mas limpio separar conversacion/mensajes de auditoria.
