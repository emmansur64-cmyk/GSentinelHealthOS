# MEDICAL WEB RETRIEVAL IMPLEMENTATION V1

Fecha: 2026-05-09T00:05:35-03:00
Rama git: GsentinelH
Commit base observado: a3f163c
Entorno: LABORATORIO / DEV

## Alcance

Se implemento la primera capa `medical-web-retrieval` solo para el chat profesional medico de `medical-agenda-saas`.

No se modificaron paneles, autenticacion, flujo de pacientes, WhatsApp pipeline, MetaBrain runtime, docker-compose, secretos reales, deploy ni contenedores.

## Arquitectura final

Punto de integracion unico:

- `medical-agenda-saas/src/chat/chat.service.ts`

La capa se ejecuta antes de `callGroqDoctorChat`. Si no hay evidencia valida, si el flag esta apagado o si ocurre cualquier excepcion, el flujo continua igual que antes.

Carpeta creada:

- `medical-agenda-saas/src/lib/medical-web-retrieval/`

Archivos creados:

- `index.ts`
- `config.ts`
- `policy.ts`
- `source-allowlist.ts`
- `types.ts`
- `query-builder.ts`
- `sanitizer.ts`
- `extractor.ts`
- `retriever.ts`
- `audit.ts`
- `context-builder.ts`

Archivos modificados:

- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`
- `.env.example`

## Flags nuevas

Valores seguros por defecto:

```env
MEDICAL_WEB_RETRIEVAL_ENABLED=false
MEDICAL_WEB_RETRIEVAL_MODE=allowlist
MEDICAL_WEB_RETRIEVAL_TIMEOUT_MS=8000
MEDICAL_WEB_RETRIEVAL_MAX_SOURCES=5
```

Con `MEDICAL_WEB_RETRIEVAL_ENABLED=false`, `retrieveMedicalWebEvidence()` devuelve `null` y no se agrega metadata nueva al prompt de Groq.

## Flujo real

1. `handleDoctorChat()` resuelve contexto clinico existente.
2. `buildMedicalWebRetrievalContext()` evalua si debe activar retrieval.
3. `policy.ts` activa solo ante consultas medicas que requieren evidencia externa: medicamentos, guias, protocolos, papers, procedimientos, salud mental o busqueda explicita.
4. `query-builder.ts` arma una consulta generica y elimina identificadores directos: email, telefono, DNI/documento, UUID, IDs internos y patrones simples de nombre de paciente.
5. `retriever.ts` consulta solo URLs HTTPS generadas desde dominios allowlist.
6. `extractor.ts` extrae fragmentos sanitizados.
7. `audit.ts` registra evento tecnico sin escribir DB clinica.
8. `groq-doctor-chat.ts` envia a Groq solo evidencia filtrada y estructurada, no HTML crudo.

## Fallback behavior

Fallback obligatorio implementado:

- flag apagado: flujo actual sin retrieval.
- saludo simple: flujo actual sin retrieval.
- fuente no allowlist: se rechaza.
- fetch falla: se registra rechazo y continua.
- sin fragmentos: no se inyecta evidencia a Groq.
- excepcion general: `context-builder.ts` captura, audita error y devuelve `null`.

No se lanza 500 desde la capa de retrieval.

## Allowlist inicial

Dominios permitidos:

- `who.int`
- `paho.org`
- `nih.gov`
- `cdc.gov`
- `fda.gov`
- `ema.europa.eu`
- `argentina.gob.ar`
- `anmat.gob.ar`
- `pubmed.ncbi.nlm.nih.gov`
- `ncbi.nlm.nih.gov`
- `cochranelibrary.com`
- `nejm.org`
- `thelancet.com`
- `bmj.com`
- `jamanetwork.com`
- `nature.com`
- `harvard.edu`
- `hopkinsmedicine.org`
- `mayoclinic.org`
- `clevelandclinic.org`
- `stanford.edu`
- `ox.ac.uk`
- `cam.ac.uk`
- `ucl.ac.uk`
- `psychiatry.org`
- `apa.org`
- `nimh.nih.gov`
- `dailymed.nlm.nih.gov`

Bloqueos verificados:

- dominios fuera de allowlist.
- sitios sin HTTPS.
- `wikipedia.org`.

## Pruebas ejecutadas

### 1. ENABLED=false

Comando:

```powershell
npx tsx -e "import { retrieveMedicalWebEvidence } from './src/lib/medical-web-retrieval/retriever.ts'; (async()=>{ process.env.MEDICAL_WEB_RETRIEVAL_ENABLED='false'; const result=await retrieveMedicalWebEvidence({tenantId:'lab',doctorUserId:'doctor-1',message:'buscar evidencia warfarina'}); console.log(result === null ? 'DISABLED_OK' : 'DISABLED_CHANGED'); })().catch((error)=>{ console.error(error); process.exit(1); });"
```

Resultado:

```text
DISABLED_OK
```

### 2. Politica, allowlist, sanitizacion y query sin identificadores directos

Resultado resumido:

```json
{
  "greeting": { "shouldRetrieve": false, "reasons": [] },
  "medical": {
    "shouldRetrieve": true,
    "reasons": ["medication", "evidence_papers", "explicit_search"]
  },
  "allowed": true,
  "blocked": false,
  "clean": ". Warfarin interaction evidence.",
  "query": "paciente interaccion warfarina amiodarona telefono evidencia clinica guia medicamento revision"
}
```

### 3. ENABLED=true con red real

Consulta controlada:

```text
buscar evidencia actualizada de interaccion warfarina amiodarona
```

Resultado resumido:

```json
{
  "used": true,
  "fallback": false,
  "sourcesConsulted": ["who.int", "paho.org", "nih.gov"],
  "sourcesRejected": 1
}
```

### 4. Error de provider externo simulado

Se reemplazo `fetch` por una funcion que lanza `simulated_provider_error`.

Resultado:

```json
{
  "used": false,
  "fallback": true,
  "error": "no_evidence_fragments",
  "sourcesRejected": [
    "simulated_provider_error",
    "simulated_provider_error",
    "simulated_provider_error",
    "simulated_provider_error"
  ]
}
```

### 5. Typecheck

Intentos:

```powershell
npm run typecheck
docker exec gs_frontend npm run typecheck
```

Resultado:

```text
tsc: not found
```

Estado: bloqueado por falta de `typescript/tsc` disponible en `node_modules` local y dentro de `gs_frontend`. No se instalaron dependencias ni se modifico Dockerfile porque esta fase prohibe actualizaciones automaticas.

## Riesgos pendientes

- La V1 usa paginas de busqueda allowlist como fuente inicial; no implementa crawling profundo ni APIs especializadas.
- La extraccion de fecha puede quedar en `null` cuando la fuente no expone fecha clara.
- La sanitizacion reduce riesgo de prompt injection, pero debe complementarse con revision clinica y auditoria operacional.
- La redaccion de PHI cubre patrones directos; nombres escritos en formatos no detectables pueden requerir una etapa posterior mas robusta.
- El contenedor `gs_frontend` no tenia esta carpeta montada al momento de validar, por lo que la prueba de typecheck en contenedor no valida estos archivos nuevos.

## Confirmacion

FASE IMPLEMENTACION WEB RETRIEVAL V1 COMPLETA

---

# WEB RETRIEVAL V1 - VALIDACION DE CONTRATO Y COMPILACION

Fecha validacion: 2026-05-09

## Archivos auditados

- `medical-agenda-saas/src/lib/medical-web-retrieval/audit.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/config.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/context-builder.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/extractor.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/index.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/policy.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/query-builder.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/retriever.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/sanitizer.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/source-allowlist.ts`
- `medical-agenda-saas/src/lib/medical-web-retrieval/types.ts`
- `medical-agenda-saas/src/chat/chat.service.ts`
- `medical-agenda-saas/src/lib/groq-doctor-chat.ts`

## Validacion imports/exports

Resultado:

- Modulos internos de `medical-web-retrieval` importan correctamente con imports relativos.
- `index.ts` exporta las funciones usadas por `chat.service.ts` y `groq-doctor-chat.ts`.
- No se detecto dependencia circular dentro de `medical-web-retrieval`.
- `groq-doctor-chat.ts` usa `import type` para tipos de retrieval; no agrega import runtime circular.
- `chat.service.ts` importa solo `buildMedicalWebRetrievalContext`.

Prueba ejecutada:

```powershell
npx tsx -e "import './src/lib/medical-web-retrieval/config.ts'; import './src/lib/medical-web-retrieval/policy.ts'; import './src/lib/medical-web-retrieval/source-allowlist.ts'; import './src/lib/medical-web-retrieval/query-builder.ts'; import './src/lib/medical-web-retrieval/sanitizer.ts'; import './src/lib/medical-web-retrieval/extractor.ts'; import './src/lib/medical-web-retrieval/retriever.ts'; console.log('MODULE_IMPORTS_OK');"
```

Salida:

```text
MODULE_IMPORTS_OK
```

Limitacion: la importacion directa de `groq-doctor-chat.ts` via `tsx` fuera de Next no se pudo ejecutar porque falta el paquete/runtime local `server-only`. Esto no prueba fallo de Next; prueba que el entorno local de ejecucion directa no tiene todas las dependencias instaladas.

## Errores encontrados

1. `retriever.ts`: `evidence` no tenia tipo explicito. Riesgo: inferencia TypeScript inestable en modo estricto.
2. `retriever.ts`: `fetch` seguia redirects automaticamente. Riesgo: fuente inicial allowlist podia redirigir a destino no auditado.
3. `audit.ts`: si `logServer` o `logServerError` lanzaban excepcion, la auditoria podia romper el fallback.
4. `sanitizer.ts`: tras remover `javascript:` podia quedar residuo textual tipo `alert(1)`.
5. `groq-doctor-chat.ts`: metadata malformada en `medical_web_retrieval.sources` podia romper formateo de evidencia.

## Cambios minimos aplicados

1. `retriever.ts`
   - `evidence` tipado como `MedicalWebEvidenceFragment[]`.
   - `fetch` configurado con `redirect: "manual"`.
   - Redirects 3xx bloqueados con error `redirect_blocked_<status>`.
   - Validacion de `response.url` contra allowlist antes de leer body.

2. `audit.ts`
   - `logServer` y `logServerError` protegidos con `try/catch`.
   - La auditoria ya no puede romper el chat ni el fallback.

3. `sanitizer.ts`
   - Eliminacion de llamadas inline residuales `alert(...)`, `prompt(...)`, `confirm(...)`.

4. `groq-doctor-chat.ts`
   - Agregado guard `isMedicalWebEvidenceFragment`.
   - Si `sources` esta malformado o vacio, no se inyecta evidencia y sigue el flujo normal.

## Validacion contratos

Contratos confirmados:

- `MedicalWebRetrievalInput` se usa con `tenantId`, `doctorUserId`, `conversationId`, `message` y `clinicalState`.
- `retrieveMedicalWebEvidence()` retorna `MedicalWebRetrievalResult | null`.
- `buildMedicalWebRetrievalContext()` retorna `MedicalWebRetrievalContext | null`.
- `chat.service.ts` solo agrega `metadata.medical_web_retrieval` cuando existe contexto valido.
- `groq-doctor-chat.ts` solo inyecta evidencia si `instruction` es string y `sources` contiene fragmentos validos.

No se detectaron:

- `JSON.parse` inseguro.
- `await` faltante en el flujo nuevo.
- destructuring inseguro en datos externos.
- `fetch` sin timeout.
- throw expuesto hacia `handleDoctorChat` desde `context-builder.ts`.

## Validacion fallback

Pruebas controladas:

### Retrieval OFF

Resultado:

```text
DISABLED_OK
```

### Retrieval ON con HTML mock allowlist

Resultado:

```json
{
  "used": true,
  "fallback": false,
  "evidence": 2
}
```

### Provider externo falla

Resultado:

```json
{
  "used": false,
  "fallback": true,
  "error": "no_evidence_fragments",
  "rejected": 4,
  "reason": "simulated_provider_error"
}
```

### Redirect bloqueado

Resultado:

```json
{
  "used": false,
  "fallback": true,
  "error": "no_evidence_fragments",
  "reason": "redirect_blocked_302"
}
```

### Timeout

Resultado:

```json
{
  "used": false,
  "fallback": true,
  "error": "no_evidence_fragments",
  "reason": "AbortError"
}
```

### Context builder con excepcion async

Resultado:

```text
CONTEXT_FALLBACK_OK
```

Estado fallback: operativo. No se encontro camino auditado donde una falla de retrieval llegue como 500 al chat medico.

## Validacion seguridad

Confirmado:

- HTTPS obligatorio en `isAllowedMedicalSourceUrl`.
- Hostname validado contra allowlist.
- Subdominios permitidos solo bajo dominio allowlist.
- Dominios no allowlist bloqueados.
- `http://` bloqueado.
- Redirects automaticos bloqueados.
- URL final de respuesta validada antes de consumir body.
- Sanitizacion elimina bloques `script`, `style`, `iframe`, `object`, `embed`, `noscript`.
- Sanitizacion elimina handlers `on*`, `javascript:`, `data:text/html`, tags HTML y residuos `alert/prompt/confirm`.
- Query builder no usa `clinicalState` para ampliar la busqueda externa; esto reduce exposicion de PHI.
- Auditoria no escribe DB clinica y no registra secretos.

Prueba de dominio:

```json
{
  "allowed": true,
  "blockedHttp": false,
  "blockedDomain": false
}
```

Prueba sanitizacion:

```text
. Warfarin interaction evidence.
```

Riesgo pendiente: la redaccion de nombres cubre patrones simples; no reemplaza una politica completa de de-identificacion clinica.

## Compatibilidad Next/runtime

Observaciones:

- La capa usa `fetch`, `AbortController`, `URL` y `process.env`, compatibles con Node 20 del proyecto.
- No usa `fs`, `path`, DB, Prisma ni APIs de navegador.
- No incluye `"use client"`.
- La integracion vive en `chat.service.ts`, ruta server-side del chat medico.
- `groq-doctor-chat.ts` ya dependia de `server-only`; la capa no cambia ese contrato.
- El contenedor `gs_frontend` observado no tenia montada la carpeta nueva `src/lib/medical-web-retrieval`, por lo que no sirve para validar estos cambios sin reconstruccion/montaje correcto. No se reinicio ni reconstruyo contenedor.

## Estado typecheck

Intentos:

```powershell
npm run typecheck
npm exec -- tsc --noEmit --pretty false
docker exec gs_frontend sh -lc "npm run typecheck"
```

Resultados:

```text
"tsc" no se reconoce como un comando interno o externo
This is not the tsc command you are looking for
sh: 1: tsc: not found
```

Diagnostico: falta `typescript/tsc` utilizable en `node_modules` local y dentro de `gs_frontend`. No se instalo TypeScript ni se modifico toolchain porque la fase prohibe actualizar/instalar dependencias automaticamente.

## Riesgos pendientes

- Typecheck completo pendiente hasta restaurar dependencias locales o contenedor con `tsc`.
- La extraccion V1 sigue siendo simple y basada en HTML de busquedas allowlist.
- No hay test automatizado persistente agregado; las pruebas fueron ejecuciones controladas por `tsx`.
- La importacion directa de `groq-doctor-chat.ts` fuera de Next queda bloqueada por `server-only` ausente en el entorno local directo.

## Confirmacion validacion

FASE WEB RETRIEVAL V1 VALIDACION COMPLETA
