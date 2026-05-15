# Auditoria Medical AI Web Retrieval

## 1. Arquitectura real encontrada

Proyecto auditado: `E:\GSentinelHealthOS`.

Estado runtime observado con `docker compose ps`:

| Servicio | Estado observado | Evidencia |
|---|---|---|
| frontend | Up, unhealthy | `docker-compose.yml:353`, contenedor `gs_frontend`, puerto `127.0.0.1:3000` |
| brain | Restarting | `docker-compose.yml:248`, contenedor `gs_brain` |
| dialogue-engine | Up, healthy | `docker-compose.yml:573`, `MetaBrain/services/dialogue_engine/app/routes.py:33` |
| inference-service | Up, healthy | `docker-compose.yml:603`, `MetaBrain/services/inference_service/app/routes.py:50` |
| decision-service | Up, healthy | `docker-compose.yml:633` |
| nlg-service | Up, healthy | `docker-compose.yml:663` |
| api | Up, healthy | `docker-compose.yml:189` |
| gateway | Up, healthy | `docker-compose.yml:308` |

El compose canonico no expone un servicio NestJS de `MetaBrain/src`. Los servicios activos de IA en compose son Python: `dialogue-engine`, `inference-service`, `decision-service`, `nlg-service`, mas `brain` Python.

## 2. Flujo real del chat IA medico

Entry point real del chat medico:

- UI caller:
  - `medical-agenda-saas/src/components/doctor-chat-hub.tsx:65` llama `GET /chat/doctor`.
  - `medical-agenda-saas/src/components/doctor-chat-hub.tsx:105` llama `POST /chat/doctor`.
- Endpoint:
  - `medical-agenda-saas/src/app/chat/doctor/route.ts:82` define `POST`.
  - `medical-agenda-saas/src/app/chat/doctor/route.ts:91` llama `handleDoctorChat`.
- Auth y permisos:
  - `medical-agenda-saas/src/app/chat/doctor/route.ts:49` exige `getAuthenticatedUser()`.
  - `medical-agenda-saas/src/app/chat/doctor/route.ts:42` define `canAccessDoctorChat`.
  - `medical-agenda-saas/src/app/chat/doctor/route.ts:44` permite admin.
  - `medical-agenda-saas/src/app/chat/doctor/route.ts:45` permite doctor/medico solo si `authUser.userId === doctorId`.
- Service principal:
  - `medical-agenda-saas/src/chat/chat.service.ts:328` define `handleDoctorChat`.
- Context builder real:
  - `medical-agenda-saas/src/chat/chat.service.ts:331` llama `resolveClinicalContext`.
  - `medical-agenda-saas/src/chat/chat.service.ts:333` arma `sharedContext`.
  - `medical-agenda-saas/src/chat/chat.service.ts:344` agrega `recent_history`.
  - `medical-agenda-saas/src/chat/chat.service.ts:345` agrega `conversation_history`.
  - `medical-agenda-saas/src/chat/chat.service.ts:346` agrega `clinical_state`.
  - `medical-agenda-saas/src/chat/chat.service.ts:347` agrega metadata y `conversation_id`.
- Provider primario:
  - `medical-agenda-saas/src/chat/chat.service.ts:353` llama `callGroqDoctorChat`.
  - `medical-agenda-saas/src/lib/groq-doctor-chat.ts:189` define `callGroqDoctorChat`.
  - `medical-agenda-saas/src/lib/groq-doctor-chat.ts:207` llama `${config.baseUrl}/chat/completions`.
- Fallbacks:
  - `medical-agenda-saas/src/chat/chat.service.ts:359` solo llama Brain si no hubo `groqResult`.
  - `medical-agenda-saas/src/chat/chat.service.ts:378` usa `metabrain.decide` local si Groq y Brain fallan.

Flujo:

`Doctor UI -> /chat/doctor -> handleDoctorChat -> resolveClinicalContext/sharedContext -> callGroqDoctorChat -> Groq /chat/completions -> auditLog + MetaBrain signal`

Si Groq falla:

`handleDoctorChat -> callBrainDecide -> brain /orchestrate -> fallback local metabrain.decide`

## 3. Flujo WhatsApp IA

Entry point WhatsApp real:

- `medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts:97` define `GET` de verificacion Meta.
- `medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts:121` define `POST` de recepcion.
- `medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts:139` valida firma Meta si existe `WHATSAPP_APP_SECRET`.
- `medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts:202` resuelve tenant por `phoneNumberId`.
- `medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts:211` persiste `incomingMessage`.
- `medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts:229` despacha a cola o inline.

Pipeline principal:

- `medical-agenda-saas/src/lib/whatsapp/queue.ts:38` encola con `enqueueIncomingMessage`.
- `medical-agenda-saas/src/lib/whatsapp/processing-worker.ts:19` importa `generateWhatsAppMetaBrainReply`.
- `medical-agenda-saas/src/lib/whatsapp/processing-worker.ts:209` obtiene/crea `conversationState`.
- `medical-agenda-saas/src/lib/whatsapp/processing-worker.ts:221` llama `handleMessage`.
- `medical-agenda-saas/src/lib/whatsapp/processing-worker.ts:247` pasa resultado a cola de respuesta.
- `medical-agenda-saas/src/lib/whatsapp/response-worker.ts:162` envia mensaje por WhatsApp.

WhatsApp IA:

- `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts:273` arma contexto.
- `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts:433` construye contexto para respuesta.
- `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts:497` usa `callGroqDoctorChat` solo si no hay `brainResult`.
- `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts:509` fuerza respuesta segura y disclaimer.
- `medical-agenda-saas/src/lib/whatsapp/groq-assistant.ts:84` tiene prompt separado para paciente WhatsApp.
- `medical-agenda-saas/src/lib/whatsapp/groq-assistant.ts:104` tambien puede llamar `chat/completions`, pero el flujo encontrado en `conversation-engine` y `processing-worker` usa `generateWhatsAppMetaBrainReply`.

Separacion real:

- Chat medico: `medical-agenda-saas/src/lib/groq-doctor-chat.ts:96` dice que siempre habla con medico.
- WhatsApp paciente: `medical-agenda-saas/src/lib/whatsapp/groq-assistant.ts:86` dice que es asistente de agenda medica para paciente y `:89` prohibe diagnosticos/tratamientos.

## 4. Flujo clinico IA

Para chat medico:

- El contexto clinico se construye en `medical-agenda-saas/src/chat/chat.service.ts`.
- El prompt Groq se construye en `medical-agenda-saas/src/lib/groq-doctor-chat.ts`.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:96` define `buildSystemPrompt`.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:112` define `formatContext`.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:152` define `buildMessages`.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:153` toma los ultimos 8 mensajes de `conversation_history`.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:164` arma `system`, contexto y mensaje actual.

Para imagenes medicas:

- `medical-agenda-saas/src/app/api/ai/image-analysis/route.ts:79` define `POST`.
- `medical-agenda-saas/src/app/api/ai/image-analysis/route.ts:94` aplica rate limit.
- `medical-agenda-saas/src/app/api/ai/image-analysis/route.ts:122` verifica consentimiento si hay `patientId`.
- `medical-agenda-saas/src/app/api/ai/image-analysis/route.ts:149` llama `analyzeMedicalImage`.
- `medical-agenda-saas/src/medical-imaging/vision-ai.service.ts:26` define prompt de imagen medica.
- `medical-agenda-saas/src/medical-imaging/vision-ai.service.ts:189` llama `/chat/completions`.

Para Brain Python:

- `brain/app.py:187` expone `POST /orchestrate`.
- `brain/app.py:79` construye `IntelligentOrchestrator`.
- `brain/orchestration/clients.py:27` importa motores locales.
- `brain/orchestration/clients.py:28` importa `MetaBrain.nlu_engine`.
- `brain/orchestration/clients.py:96` usa `DialogueClient` local.
- `brain/orchestration/clients.py:129` usa `InferenceClient` local.
- `brain/orchestration/clients.py:160` usa `DecisionClient` local.
- `brain/orchestration/clients.py:192` usa `NLGClient` local.
- `brain/orchestration/orchestrator.py:385` arma `core_context`.
- `brain/orchestration/orchestrator.py:393` llama `brain.core.decision_core.process_input`.
- `brain/orchestration/orchestrator.py:434` limpia la respuesta final.

## 5. Servicios realmente activos

Activos en compose:

- `frontend`: Next.js medical-agenda-saas, donde vive el chat medico real.
- `brain`: Python Brain, pero observado reiniciando.
- `dialogue-engine`: Python MetaBrain service.
- `inference-service`: Python MetaBrain service.
- `decision-service`: Python MetaBrain service.
- `nlg-service`: Python MetaBrain service.
- `api`, `gateway`, workers, DB, Redis.

No activo en compose:

- `MetaBrain/src` NestJS. Compila segun validacion previa, pero no aparece como servicio en `docker-compose.yml`.

## 6. Servicios legacy/no usados o no conectados al flujo real

- `MetaBrain/src/knowledge/*` contiene retrieval medico y fuentes web, pero no esta conectado al compose canonico.
- `MetaBrain/src/ai/ai.controller.ts` expone funcionalidad Nest, pero no hay servicio Nest en compose.
- `brain/orchestration/clients.py:1-17` declara adaptadores 100% offline y sin HTTP externo.
- `brain/app.py:110-112` indica que el worker Redis legacy de Brain puede estar deshabilitado si no se habilita por flag.
- `whatsapp_gateway/app/main.py` indica gateway legacy Python separado; el endpoint WhatsApp principal auditado esta en Next `medical-agenda-saas/src/app/api/webhooks/whatsapp/route.ts`.

## 7. Donde vive el contexto IA

Chat medico:

- Contexto DB/tenant/paciente/turno/historial: `medical-agenda-saas/src/chat/chat.service.ts`.
- Prompt y messages hacia Groq: `medical-agenda-saas/src/lib/groq-doctor-chat.ts`.
- Historial persistido: `prisma.auditLog`, usado en `medical-agenda-saas/src/chat/chat.service.ts:109` y `:178`.
- Tenant:
  - `medical-agenda-saas/src/chat/chat.service.ts:75` usa `getTenantIdFromContext()`.
  - `medical-agenda-saas/src/chat/chat.service.ts:81` filtra appointment por `tenant_id` y `doctor_id`.
  - `medical-agenda-saas/src/chat/chat.service.ts:93` filtra paciente por `tenant_id`.

WhatsApp:

- Contexto conversacional: `conversationState.context_json`.
- `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts:127` lee/crea contexto.
- `medical-agenda-saas/src/lib/whatsapp/conversation-engine.ts:139` actualiza contexto.
- `medical-agenda-saas/src/lib/whatsapp/metabrain-assistant.ts:273` arma contexto clinico/operativo para IA.

Brain:

- `brain/orchestration/orchestrator.py:385` combina `session_state`, contexto entrante y memoria.
- `brain/orchestration/orchestrator.py:556` hidrata historial desde `conversation_history`.

## 8. Donde se llaman providers externos

Groq chat medico:

- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:62` resuelve API key.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:75` arma config.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:207` llama `fetch(${config.baseUrl}/chat/completions)`.

Groq WhatsApp:

- `medical-agenda-saas/src/lib/whatsapp/groq-assistant.ts:52` resuelve API key.
- `medical-agenda-saas/src/lib/whatsapp/groq-assistant.ts:104` llama `fetch(${config.baseUrl}/chat/completions)`.

Groq imagenes/documentos:

- `medical-agenda-saas/src/medical-imaging/vision-ai.service.ts:56` toma `DOCUMENT_AI_API_KEY` o `GROQ_API_KEY`.
- `medical-agenda-saas/src/medical-imaging/vision-ai.service.ts:189` arma URL `/chat/completions`.
- `medical-agenda-saas/src/lib/document-ai.ts:666` tambien arma endpoint `/chat/completions`.

Groq NLG Python:

- `MetaBrain/services/nlg_service/app/reformulator.py:601` llama `self._client.chat.completions.create`.

Groq Nest MetaBrain no canonico:

- `MetaBrain/src/ai/providers/groq.provider.ts:130` llama `/chat/completions`.

OpenAI embeddings legacy/local:

- `brain/orchestration/semantic_memory.py:80` lee `OPENAI_API_KEY`.
- `brain/orchestration/semantic_memory.py:96` llama `https://api.openai.com/v1/embeddings`.

## 9. Donde conviene insertar retrieval

Punto recomendado para una futura capa controlada:

`medical-agenda-saas/src/lib/medical-web-retrieval/`

Integracion directa para chat medico:

- Insertar entre `sharedContext` y `callGroqDoctorChat` en `medical-agenda-saas/src/chat/chat.service.ts:333-357`.
- El retrieval debe devolver un bloque estructurado para `sharedContext.metadata.medical_web_retrieval` o un campo separado controlado.
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts:152-178` deberia consumir ese bloque al construir messages, con instruccion de tratar fuentes externas como datos no confiables y citables.

Motivo:

- El chat medico real ya vive en `medical-agenda-saas`.
- Alli estan auth, tenant, audit, consentimiento, rate limit y logs.
- Alli se llama Groq directo.
- Brain esta reiniciando actualmente y no es el path primario cuando Groq esta configurado.
- MetaBrain Nest ya tiene retrieval, pero no esta en compose canonico.

## 10. Riesgos detectados

- PHI enviada a fuentes externas si el retrieval usa query cruda con nombre, telefono, DNI, notas o historia clinica.
- Mezcla tenant si la cache no incluye `tenantId` y scope de usuario/conversacion.
- Prompt injection desde paginas externas si snippets se insertan como instrucciones.
- HTML/script injection si se renderizan resultados web sin sanitizar.
- Contaminacion entre conversaciones si cachea por query solamente.
- Contaminacion entre pacientes si se persiste contexto retrieval junto a historial sin scope.
- Fuentes no confiables si se permite web abierta.
- Bypass de guardrails si Groq recibe contenido externo como mensaje de sistema.
- Fuga de secretos si logs incluyen URLs con tokens o payloads clinicos.
- Inconsistencia clinica si se mezclan recomendaciones web con decisiones de triage sin prioridad clara.

## 11. Riesgos clinicos

- Respuestas basadas en fuentes desactualizadas.
- Uso de abstracts o noticias como si fueran guia clinica.
- Dosis o indicaciones de medicamentos sin contexto del paciente.
- Falta de diferenciacion entre informacion general, evidencia y conducta clinica.
- Riesgo de que el chat medico cite fuentes sin advertir limitaciones.

## 12. Riesgos multi-tenant

Evidencia de tenant actual:

- `medical-agenda-saas/src/chat/chat.service.ts:75` obtiene tenant del contexto.
- `medical-agenda-saas/src/chat/chat.service.ts:81`, `:93`, `:100`, `:111`, `:180`, `:221`, `:275` filtran o registran por tenant.
- `medical-agenda-saas/src/lib/prisma.ts:66` aplica tenant scoping para modelos marcados.

Riesgos si se agrega retrieval:

- Cache global por query sin tenant.
- Auditoria sin `tenant_id`.
- Reuso de snippets con contexto de paciente.
- Consulta externa construida desde texto clinico no anonimizado.

## 13. Riesgos de seguridad

Controles existentes relevantes:

- Auth chat medico: `medical-agenda-saas/src/app/chat/doctor/route.ts:49`, `:83`, `:109`.
- Permiso doctor/admin: `medical-agenda-saas/src/app/chat/doctor/route.ts:42-45`.
- Redaccion logs: `medical-agenda-saas/src/lib/server-logger.ts:7` define `SENSITIVE_KEY_REGEX`.
- Audit funcional: `medical-agenda-saas/src/lib/audit-functional.ts:20`.
- Imagen IA con consentimiento: `medical-agenda-saas/src/app/api/ai/image-analysis/route.ts:122-146`.
- WhatsApp rate limit: `medical-agenda-saas/src/lib/whatsapp/rate-limiter.ts:70`.

Controles faltantes para retrieval:

- Allowlist estricta de dominios medicos.
- Sanitizador de contenido externo.
- Normalizador de citas.
- Politica anti prompt-injection.
- Redactor PHI antes de query externa.
- Cache con scope y TTL.
- Auditoria por busqueda, fuente, URL, fecha, snippets usados y respuesta final.

## 14. Propuesta arquitectonica final

### Opcion A: retrieval en medical-agenda-saas

Ventajas:

- Es donde vive el chat medico real.
- Integra directo con `getAuthenticatedUser`, tenant, Prisma, audit y Groq actual.
- Menor cambio operativo: no requiere nuevo servicio ni tocar compose.
- Compatible con el flujo actual del doctor y con el fallback a Brain.
- Permite no tocar paneles.

Riesgos:

- El frontend server Next asumiria responsabilidad de retrieval y cache.
- Hay que asegurar que no se haga query externa con PHI.

### Opcion B: retrieval en MetaBrain

Ventajas:

- Ya existe codigo Nest de knowledge/retrieval:
  - `MetaBrain/src/knowledge/knowledge.retriever.ts:22`
  - `MetaBrain/src/knowledge/medical-sources.service.ts:16`
  - `MetaBrain/src/ai/ai.service.ts:82`

Riesgos:

- `MetaBrain/src` no esta conectado al compose canonico.
- No es el entrypoint real del chat medico.
- Conectarlo implicaria arquitectura/deploy futuro, fuera de esta fase.
- Brain actual observado esta reiniciando.

### Opcion C: servicio aislado

Ventajas:

- Mejor aislamiento de red, allowlist, cache, sanitizacion y auditoria.
- Escalable y reusable por doctor chat, WhatsApp, NLG y futuras APIs.

Riesgos:

- Implica nuevo servicio y cambios de compose/deploy.
- El usuario prohibio inventar servicios nuevos en esta fase.
- Mayor complejidad operacional.

## 15. Recomendacion

Recomendacion: Opcion A ahora, con diseno interno aislado por carpeta, sin servicio nuevo.

Carpeta exacta recomendada:

`medical-agenda-saas/src/lib/medical-web-retrieval/`

Razon tecnica:

- El entrypoint real del chat medico esta en `medical-agenda-saas/src/app/chat/doctor/route.ts`.
- El contexto real se arma en `medical-agenda-saas/src/chat/chat.service.ts`.
- El provider real Groq del chat medico esta en `medical-agenda-saas/src/lib/groq-doctor-chat.ts`.
- Los controles de tenant/audit/autenticacion ya estan en `medical-agenda-saas`.
- No requiere crear servicio nuevo ni tocar compose.

Estrategia futura minima:

- `medical-web-retrieval/config.ts`: allowlist y limites.
- `medical-web-retrieval/query-redactor.ts`: remover PHI antes de buscar.
- `medical-web-retrieval/source-client.ts`: cliente HTTP con allowlist.
- `medical-web-retrieval/sanitizer.ts`: quitar HTML/scripts e instrucciones.
- `medical-web-retrieval/retriever.ts`: orquestador de busqueda.
- `medical-web-retrieval/citations.ts`: normalizacion de citas.
- `medical-web-retrieval/audit.ts`: registrar query redacted, dominios, urls y snippets usados.
- `medical-web-retrieval/types.ts`: contrato estable.

## 16. Servicios exactos afectados en una implementacion futura

- `frontend` solamente para fase inicial.
- No tocar `brain`, `api`, `gateway`, microservicios Python ni MetaBrain Nest al principio.

## 17. Archivos exactos afectados en una implementacion futura

Agregar:

- `medical-agenda-saas/src/lib/medical-web-retrieval/*`

Modificar de forma puntual:

- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- Opcional: `medical-agenda-saas/src/lib/observability/metrics.ts`
- Opcional: migracion Prisma si se decide tabla dedicada de auditoria/cache.

No modificar para esta capa inicial:

- `Panel Login`
- paneles estaticos
- `docker-compose.yml`
- `MetaBrain/src`
- `MetaBrain/services/*`
- `brain/*`
- secretos `.env`

## 18. Que NO tocar

- No convertir MetaBrain Nest en runtime canonico en esta fase.
- No conectar retrieval a WhatsApp paciente hasta separar politica clinica de agenda.
- No dar internet libre a Groq.
- No enviar PHI a motores de busqueda.
- No usar contenido externo como `system`.
- No mezclar citas externas con decision de riesgo sin prioridad clinica.

## 19. Que debe quedar aislado

- Busqueda web.
- Allowlist de dominios.
- Sanitizacion de documentos externos.
- Cache.
- Auditoria de retrieval.
- Construccion de bloque de fuentes.
- Politica anti prompt-injection.

## 20. Que debe quedar auditado

- Usuario/doctor.
- Tenant.
- Conversation ID.
- Query original solo si esta redacted o hash; no PHI cruda.
- Query enviada.
- Dominios consultados.
- URLs usadas.
- Titulos, fechas y fuente.
- Snippets insertados en prompt.
- Decision de usar/no usar retrieval.
- Provider LLM usado en respuesta.

## 21. Que debe quedar con allowlist medica

Allowlist minima futura:

- PubMed/NCBI.
- OMS/WHO.
- OPS/PAHO.
- CDC.
- NIH/MedlinePlus.
- Guias clinicas configuradas por pais o clinica.
- Documentos internos validados por la clinica.

No permitir:

- Busqueda web abierta.
- Blogs no verificados.
- Redes sociales.
- Paginas con HTML/script sin sanitizar.
- Contenido patrocinado.

## 22. Confirmacion

FASE AUDITORIA WEB RETRIEVAL COMPLETA
