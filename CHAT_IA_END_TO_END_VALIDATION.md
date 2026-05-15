# Chat Medico IA - Validacion End-to-End Controlada

Fecha: 2026-05-09
Entorno: LABORATORIO / DEV
Proyecto: `E:\GSentinelHealthOS\medical-agenda-saas`

## Estado

FASE CHAT MEDICO IA VALIDACION COMPLETA

Se audito el flujo completo del chat medico, se identifico la causa raiz probable del auto-chat reportado y se aplico una correccion minima para impedir reintentos autonomos, respuestas tardias despues de cerrar el panel y duplicacion de respuestas por request repetido.

## Flujo real encontrado

Frontend principal:

```text
src/components/doctor-dashboard.tsx
-> POST /chat/doctor
-> renderiza respuesta en estado local
-> GET /chat/doctor para historial
```

Frontend alternativo:

```text
src/components/doctor-chat-hub.tsx
-> POST /chat/doctor
-> renderiza respuesta en estado local
-> GET /chat/doctor para historial
```

Backend:

```text
src/app/chat/doctor/route.ts
-> handleDoctorChat
-> medical-runtime-context
-> medical-web-retrieval
-> callGroqDoctorChat
-> callBrainDecide fallback
-> metabrain local fallback
-> logFunctionalAudit
-> publishMetaBrainSignal
```

Persistencia/historial:

- `chat.service.ts` lee historial desde `auditLog`.
- Cada intercambio se guarda via `logFunctionalAudit`.
- El historial se reconstruye como pares `doctor` / `metabrain`.
- No se encontro SSE ni streaming en este chat.
- No se encontro WebSocket que envie prompts a la IA.
- El WebSocket del dashboard solo escucha notificaciones generales y recargaba historial.

## Causa raiz exacta

No se encontro un loop recursivo backend IA->IA ni un assistant message reentrando directamente como user. La causa raiz operativa esta en el frontend y en la semantica de retry:

1. `src/components/doctor-dashboard.tsx` usaba `fetchJsonWithRetry` para `POST /chat/doctor` con `retries: 2`.
2. `src/components/doctor-chat-hub.tsx` tenia el mismo patron.
3. `fetchJsonWithRetry` reintenta errores de red/timeout y HTTP 5xx, sin distinguir metodos idempotentes de POSTs que generan IA.
4. Si el cliente abortaba por timeout, cierre del chat o navegacion, el servidor podia seguir procesando la primera solicitud. El retry podia disparar otra invocacion IA.
5. El panel flotante no abortaba la peticion al cerrar: cerrar solo hacia `setChatOpen(false)`, pero el componente seguia montado y la promesa podia completar despues.
6. El handler WebSocket del dashboard recargaba historial ante `eventType === "message"` incluso con el chat cerrado, lo que podia hacer visible actividad tardia al reabrir.

Evidencia:

- `src/lib/http-client.ts`: retry generico para requests.
- `src/components/doctor-dashboard.tsx` antes: `sendDoctorChat` no tenia single-flight, no abortaba al cerrar y usaba helper con retry.
- `src/components/doctor-chat-hub.tsx` antes: mismo patron de POST con retry.
- `src/chat/chat.service.ts` antes: no habia `request_id` para devolver resultado existente ante duplicados.

## Correccion minima aplicada

Frontend:

- `src/components/doctor-dashboard.tsx`
  - Agregado `fetchChatJson` con `retries: 0` para `POST /chat/doctor`.
  - Agregado `chatRequestRef` como single-flight guard.
  - Agregado `AbortController` por envio.
  - Cerrar chat ahora aborta request en curso y limpia loading.
  - Nuevo chat aborta request en curso.
  - Respuestas tardias/stale se ignoran si el request ya no es el activo.
  - WebSocket `message` solo recarga historial si `chatOpen === true`.

- `src/components/doctor-chat-hub.tsx`
  - Agregado `fetchChatJson` con `retries: 0`.
  - Agregado single-flight guard.
  - Agregado `AbortController` y cleanup al desmontar.
  - Respuestas abortadas/stale no agregan mensajes.

Backend:

- `src/chat/chat.service.ts`
  - Agregado `chat_request_id` sanitizado.
  - Agregado lookup idempotente de intercambios ya completados.
  - Si llega un duplicado con el mismo `chat_request_id`, devuelve la decision persistida y no vuelve a ejecutar runtime context, retrieval, Groq ni fallbacks.
  - `payloadBefore` guarda `request_id` para auditoria y dedupe.

## Lineas clave post-correccion

- `src/components/doctor-dashboard.tsx:92`: POST de chat sin retry.
- `src/components/doctor-dashboard.tsx:124`: request activo con `AbortController`.
- `src/components/doctor-dashboard.tsx:235`: cleanup al desmontar.
- `src/components/doctor-dashboard.tsx:261`: WebSocket no recarga historial si el chat esta cerrado.
- `src/components/doctor-dashboard.tsx:394`: cierre aborta request activo.
- `src/components/doctor-dashboard.tsx:428`: single-flight antes de enviar.
- `src/components/doctor-dashboard.tsx:451`: POST con `signal`.
- `src/components/doctor-dashboard.tsx:490`: ignora respuesta stale/abortada.
- `src/components/doctor-chat-hub.tsx:48`: POST de chat sin retry.
- `src/components/doctor-chat-hub.tsx:67`: request activo con `AbortController`.
- `src/components/doctor-chat-hub.tsx:86`: cleanup al desmontar.
- `src/components/doctor-chat-hub.tsx:133`: single-flight antes de enviar.
- `src/components/doctor-chat-hub.tsx:162`: ignora respuesta stale/abortada.
- `src/chat/chat.service.ts:66`: sanitizacion de `chat_request_id`.
- `src/chat/chat.service.ts:82`: busqueda de decision completada por request id.
- `src/chat/chat.service.ts:375`: dedupe antes de runtime/retrieval/Groq.

## Validaciones ejecutadas

- `npx vitest run tests/nlp/groq-doctor-chat.test.ts`: OK, 3 tests.
- `runtime OFF`: OK.
- `weather timeout fallback`: OK.
- `retrieval OFF`: OK.
- `retrieval ON mock`: OK.
- `retrieval fallback`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.

Build mantiene 2 warnings NFT de Turbopack ya conocidos, no bloqueantes y no relacionados con el chat.

## Validacion de condiciones criticas

- Usuario envia "hola": la UI solo permite un request activo.
- IA responde una vez: no hay retry automatico para el POST de chat.
- Cerrar chat: aborta el request activo y no agrega respuestas tardias al estado local.
- Reabrir chat: carga historial persistido, sin disparar POST.
- Historial persistido: se lee por GET, no reingresa como mensaje humano.
- Assistant/metabrain: solo se renderiza y se usa como historial; no dispara `sendDoctorChat`.
- Multiple mensajes rapidos: guard por `chatRequestRef` evita requests paralelos desde la misma UI.
- Refresh/desmontaje: cleanup aborta el request activo en las UIs afectadas.
- WebSocket reconnect: cleanup existente cierra socket y limpia timer; el evento `message` ya no recarga historial con chat cerrado.

## Estado de subsistemas

- Groq: sigue siendo request/response, sin stream.
- Retrieval medico: sigue funcionando y mantiene fallback.
- Runtime context: sigue funcionando y mantiene fallback.
- Persistencia: audit log conserva historial; se agrego `request_id` en `payloadBefore`.
- Streaming/SSE: no existen en el chat medico actual.
- WebSocket: solo notificaciones; no dispara IA.
- Fallback: si Groq falla, se mantiene Brain/metabrain local.

## Que NO se toco

- Produccion.
- VPS.
- Dockerfile.
- Compose.
- Contenedores.
- Auth.
- Paneles fuera del chat medico.
- WhatsApp pipeline.
- MetaBrain runtime.
- Dependencias.
- medical-web-retrieval.
- medical-runtime-context.

## Riesgos pendientes

- La idempotencia backend evita duplicados completados; no implementa lock distribuido para dos requests identicos concurrentes que lleguen exactamente antes de que exista auditoria. La UI ahora bloquea ese caso para el flujo normal.
- Si otro cliente externo llama manualmente al endpoint sin `chat_request_id`, el backend conserva comportamiento previo.
- Para una fase futura, se podria agregar constraint/tabla dedicada de idempotency keys si se necesita garantia distribuida fuerte.

