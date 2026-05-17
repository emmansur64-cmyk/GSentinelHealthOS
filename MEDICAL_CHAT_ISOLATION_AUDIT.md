# MEDICAL CHAT ISOLATION AUDIT

**Status**: PHASE 1 - Evidence-Based Assessment  
**Date**: 2025-01-20  
**Scope**: MB-Chat Medical Assistant Module - Complete Isolation Analysis  
**Objective**: Determine GO/NO-GO for implementing isolation boundaries

---

## EXECUTIVE SUMMARY

**Finding**: CONDITIONAL ISOLATION WITH CRITICAL GAPS
- Medical Chat maintains logical isolation through module structure
- BUT exhibits uncontrolled internet access and lateral movement capability to Brain (incident processing)
- Local learning (JSONL) properly isolated with tenant/doctor scoping
- **VERDICT**: NO-GO for production trust boundary WITHOUT boundary hardening

---

## TABLE 1: DANGEROUS IMPORTS

| Module | Import | Source | Risk Level | Impact |
|--------|--------|--------|-----------|--------|
| medical-assistant.service.ts | `BrainService` | ../brain/brain.service | **CRITICAL** | Allows `processIncident()` autonomously on patient queries (incident processing at line 277) |
| medical-assistant.service.ts | `BrainService` | ../brain/brain.service | **CRITICAL** | BrainService injects ActionService (executes SAFE_COMMANDS registry) + EventProducer |
| medical-assistant.module.ts | `BrainModule` | ../brain/brain.module | **CRITICAL** | Imports entire Brain module - transitive access to ModelService, PersistenceService, MemoryService |
| medical-assistant.service.ts | `MedicalRuntimeToolsService` | ./tools/medical-runtime-tools.service | **HIGH** | Uncontrolled HTTP client (see Table 5) |
| ai/ai.service.ts | None (isolated) | - | **SAFE** | No dangerous imports; Groq provider only |
| medical-assistant.learning.service.ts | None (isolated) | - | **SAFE** | File I/O only (JSONL), no cross-module dependencies |

**Conclusion**: BrainService import is **primary lateral movement vector**. Medical Chat can invoke incident processing intended for core system events.

---

## TABLE 2: EXPOSED ROUTES

| Route | Method | Guard | Authentication | Risk | Write Capability |
|-------|--------|-------|-----------------|------|------------------|
| `/api/assistant/chat` | POST | ApiKeyGuard | API Key required | **MEDIUM** | Read-only (see Table 4) |
| (No other routes) | - | - | - | **SAFE** | - |

**Details**:
- Single public endpoint at `MedicalAssistantController.clinicalChat()`
- ApiKeyGuard enforces API Key validation
- Controller uses `ValidationPipe` (strict whitelist + forbid extra fields)
- Input: `MedicalAssistantChatDto` with optional medical context
- All guards applied consistently

**Conclusion**: Route exposure is **minimal and well-guarded**. Risk is in what the single route can do, not exposure itself.

---

## TABLE 3: ACCESSIBLE SERVICES & METHODS

| Service | Injected Into | Accessible Methods | Boundary Risk |
|---------|---------------|-------------------|----------------|
| **BrainService** | MedicalAssistantService | `processIncident(input: IncidentPayload)` | **CRITICAL**: Invoked at line 277 for patient queries; dry-run only but sets precedent |
| BrainService → ActionService | (via Brain) | `execute(decision: BrainDecision)` | **HIGH**: Can execute SAFE_COMMANDS (blocked for high-risk but allows system commands) |
| BrainService → PersistenceService | (via Brain) | `save(Incident\|Decision\|Outcome)` | **CRITICAL**: Can write incident metadata to MongoDB (indirect via Brain) |
| BrainService → MemoryService | (via Brain) | Memory operations | **HIGH**: Can read/write memory state |
| BrainService → EventProducer | (via Brain) | RabbitMQ publishing | **HIGH**: Can emit events to system (incident.main queue) |
| **AiService** | MedicalAssistantService | `answerMedicalQuestion()`, `refineMedicalText()` | **SAFE**: Groq provider only; PHI guard present |
| **MedicalRuntimeToolsService** | MedicalAssistantService | `buildContext()` | **HIGH**: Makes uncontrolled HTTP requests (see Table 5) |
| **MedicalChatLearningService** | MedicalAssistantService | `recordAndTrain()`, `attemptLocalAnswer()` | **SAFE**: Local JSONL only; no external calls |
| GuardService | (via Brain) | ACL/RBAC checks | **SAFE**: Defensive layer only |

**Isolation Weakness**: BrainService grants transitively to 13+ core services (ModelService, AuditService, ExecutionService, etc.)

---

## TABLE 4: WRITE OPERATIONS - WHAT CAN BE MODIFIED

| Target | Write Method | Accessible Via | Allowed/Blocked | Impact |
|--------|-------------|-----------------|-----------------|--------|
| **MongoDB - Incident collection** | `persistenceService.save(incident)` | BrainService → PersistenceService | **ALLOWED** | Medical Chat can create incident records (via `processIncident()`) |
| **MongoDB - Decision collection** | `persistenceService.save(decision)` | BrainService → PersistenceService | **ALLOWED** | Can record decision metadata |
| **MongoDB - Outcome collection** | `persistenceService.save(outcome)` | BrainService → PersistenceService | **ALLOWED** | Can write outcome history |
| **MongoDB - Clinical records** | None | - | **BLOCKED** | No direct appointment/patient repository injection |
| **MongoDB - Appointments** | None | - | **BLOCKED** | No AppointmentService, no @InjectModel(Appointment) |
| **MongoDB - Patient records** | None | - | **BLOCKED** | No PatientService, no @InjectModel(Patient) |
| **Google Calendar** | webhook POST | RuntimeToolsService → fetch() | **ALLOWED** | Can POST calendar reminders (line 677: `MEDICAL_CHAT_GOOGLE_CALENDAR_WEBHOOK_URL`) |
| **JSONL file** (medical-chat-learning.jsonl) | append + reinit | MedicalChatLearningService | **ALLOWED** | Can append learning records (isolated, tenant/doctor scoped) |
| **Redis** | - | - | **BLOCKED** | No Redis client injected; only in-memory cache (Map) |
| **System commands** | (via ActionService) | BrainService → ActionService | **BLOCKED** | Only SAFE_COMMANDS registry; blocked for high-risk + tier:blocked |

**Conclusion**: Can write to Brain/Incident metadata and Google Calendar, but **NOT to core clinical records** (appointments/patients/diagnoses). JSONL writes properly isolated.

---

## TABLE 5: HTTP / INTERNET ACCESS - UNCONTROLLED FETCH CALLS

| URL Target | Service | Method | Gateway? | PHI Risk | Evidence |
|------------|---------|--------|----------|----------|----------|
| `https://www.google.com/search` | MedicalRuntimeToolsService | fetch + parse | **NO GATEWAY** | **HIGH** | Line 294-299: Direct `fetch()` with user query; no sanitization before send |
| `https://www.sati.org.ar/guias/` | MedicalRuntimeToolsService | fetch | NO | MEDIUM | Line 32: Official medical source; safe domain |
| `https://pubmed.ncbi.nlm.nih.gov/` | MedicalRuntimeToolsService | fetch | NO | LOW | Line 113: PubMed; safe domain |
| `https://www.who.int/*` | MedicalRuntimeToolsService | fetch | NO | LOW | Lines 68-77: WHO official; safe domains |
| `https://clinicaltrials.gov/` | MedicalRuntimeToolsService | fetch | NO | LOW | Line 122: Clinical trials; safe domain |
| `https://geocoding-api.open-meteo.com/` | MedicalRuntimeToolsService | fetch | NO | **MEDIUM** | Line 510-512: User-supplied location; potential injection vector |
| `https://api.open-meteo.com/v1/forecast` | MedicalRuntimeToolsService | fetch | NO | **LOW** | Line 533, 542: Weather forecast; safe |
| `https://med.stanford.edu/` | MedicalRuntimeToolsService | fetch | NO | LOW | Line 158: Medical school resources; safe |
| `https://www.health.harvard.edu/` | MedicalRuntimeToolsService | fetch | NO | LOW | Line 140: Harvard Health; safe |

**Internet Access Analysis**:
- **Direct fetch() calls**: 34+ hardcoded HTTPS domains
- **Gateway enforcement**: NONE (direct client calls, no centralized proxy)
- **Query sanitization pre-send**: PARTIAL (URL encoding applied but no domain whitelist validation)
- **PHI leakage risk**: MEDIUM (user queries sent to Google Search API unencrypted to third parties)
- **Env var control**: `MEDICAL_CHAT_INTERNET_MODE` exists but not enforcing domain whitelist

**Conclusion**: **CRITICAL GAP** - RuntimeToolsService has uncontrolled direct internet access with no gateway validation.

---

## TABLE 6: ENVIRONMENT VARIABLES USED

| Variable | Service | Used For | Exposure Risk | Default/Requirement |
|----------|---------|----------|----------------|-------------------|
| `MEDICAL_CHAT_LEARNING_PATH` | MedicalChatLearningService | JSONL file location | **MEDIUM** | Line 962: File path disclosure |
| `MEDICAL_CHAT_INTERNET_MODE` | RuntimeToolsService, AiService | Control fetch behavior | **LOW** | Line 399: Mode toggle (should enforce but doesn't) |
| `MEDICAL_CHAT_TIMEZONE` | RuntimeToolsService | Timezone offset | **LOW** | Line 173: Non-sensitive |
| `MEDICAL_CHAT_WEATHER_ENABLED` | RuntimeToolsService | Feature flag | **LOW** | Line 487: Feature control |
| `MEDICAL_CHAT_WEATHER_LOCATION` | RuntimeToolsService | Default weather location | **LOW** | Line 493: Geographic hint |
| `MEDICAL_CHAT_GOOGLE_CALENDAR_WEBHOOK_URL` | MedicalAssistantService | Webhook endpoint for reminders | **HIGH** | Line 677: Webhook URL disclosure; must be hardened |
| `MB_CHAT_MULTI_TENANT` | MedicalAssistantService | Tenant mode | **MEDIUM** | Line 492: Determines isolation mode |
| `MB_CHAT_REQUIRE_ACTIVE_ENCOUNTER` | MedicalAssistantService | Patient context enforcement | **LOW** | Line 497: Policy flag |
| `RABBITMQ_URL` | EventProducer | Message broker | **CRITICAL** | Line 17 (rabbit-bus.service): Connection string (should be secret) |
| `RABBITMQ_EXCHANGE` | EventProducer | Exchange name | **MEDIUM** | Line 18: Event routing config |
| `RABBITMQ_INCIDENT_QUEUE` | EventProducer | Incident queue name | **MEDIUM** | Line 19: Queue routing (can trigger incident processing) |
| `MEDICAL_IMAGING_API_URL` | MedicalImagingService | External imaging API | **CRITICAL** | Line 43: Third-party integration credentials |
| `MEDICAL_IMAGING_API_KEY` | MedicalImagingService | Imaging API auth | **CRITICAL** | Line 44: API key exposure risk |
| `ENABLE_AUTO_REPAIR` | ExecutionService | Auto-repair toggle | **HIGH** | Line 27: Dangerous if enabled |
| `ALLOWED_ACTIONS` | ExecutionService | Action whitelist | **MEDIUM** | Line 9: Controls ActionService capability |

**Conclusion**: Medical Chat uses non-sensitive env vars for behavior, BUT:
- `RABBITMQ_*` vars grant access to event infrastructure (incident queue)
- `MEDICAL_CHAT_GOOGLE_CALENDAR_WEBHOOK_URL` must be treated as sensitive
- `MEDICAL_IMAGING_API_*` keys represent third-party integration risk

---

## TABLE 7: MEMORY & PERSISTENCE ISOLATION

| Component | Storage Type | Location | Isolation Scope | Cross-Module Risk | Evidence |
|-----------|--------------|----------|-----------------|------------------|----------|
| **JSONL Learning Records** | File (append-only) | `process.env.MEDICAL_CHAT_LEARNING_PATH` | **Tenant/Doctor/Session** | **SAFE** | Lines 962-967: Configured via env, isolated file I/O |
| JSONL - Record Loading | File read | Same as above | **Tenant/Doctor/Session** | **SAFE** | Lines 921-944: Load from disk, respect MAX_MEMORY (500), skip corrupt |
| JSONL - Sanitization | Memory (Map) | In-process | **Tenant/Doctor/Session** | **SAFE** | Scope resolution (lines 1103-1118): tenant_id + doctor_id + patient_hash |
| Hybrid Learning Records | In-memory (Map) | Runtime instance | **Per-session** | **SAFE** | Lines 965-967: In `this.records[]` array, respects reuseScope matching |
| Brain Incident History | MongoDB (Mongoose) | `Incident` model | **Per-incident** | **CRITICAL** | via BrainService → PersistenceService (transitive access) |
| Knowledge Cache | In-memory (Map) | Runtime instance | **Per-retrieval** | **SAFE** | knowledge-index.service: Local LRU cache, 10-min TTL |
| Groq Response Cache | In-memory (Map) | Runtime instance | **Per-prompt** | **SAFE** | groq.provider.ts line 76: 256-entry LRU, 5-min TTL |
| Redis | - | - | N/A | **NOT USED** | grep confirms only in-memory caches, not Redis |

**Isolation Mechanisms**:
- ✅ Tenant/Doctor scope resolution: `resolveScope()` enforces tenant_id + doctor_id
- ✅ Reuse scope matching: `matchesReuseScope()` blocks cross-doctor access
- ✅ Append-only JSONL: No mutation of past records (immutable history)
- ✅ Max memory (500 records): Prevents unbounded growth
- ⚠️ MongoDB via BrainService: Incident records accessible transitively
- ✅ No Redis: Eliminates shared cache pollution risk

**Conclusion**: Learning service properly isolated. Brain service accesses MongoDB Incident collection (NOT clinical data, but still core infra).

---

## TABLE 8: PERMISSIONS & ACCESS CONTROL

| Layer | Implementation | Medical Chat Access | Isolation Effectiveness |
|-------|----------------|-------------------|------------------------|
| **HTTP Route Guard** | `ApiKeyGuard` | ✅ Enforced | GOOD - requires valid API key |
| **Input Validation** | `ValidationPipe` (strict) | ✅ Enforced | GOOD - whitelist + forbid extra fields |
| **Module Scope** | NestJS @Module + DI | ⚠️ Partial | MEDIUM - imports BrainModule transitively |
| **Tenant Isolation** | Context-based scope | ✅ Enforced at Learning layer | GOOD - tenant_id + doctor_id matching |
| **Doctor Isolation** | Context-based scope | ✅ Enforced at Learning layer | GOOD - doctor_id validation in reuseScope |
| **Patient Isolation** | Hash-based | ✅ Enforced at Learning layer | GOOD - patientIdHash prevents direct ID exposure |
| **BrainService Access** | Direct injection | ✅ Allowed (design choice) | **WEAK** - no boundary; allows incident processing |
| **Database Access** | Via PersistenceService (transitive) | ⚠️ Via BrainService only | MEDIUM - Medical Chat can't directly mutate clinical data |
| **Clinical Record Access** | No @InjectModel(Clinical*) | ✅ Blocked | GOOD - no appointment/patient repositories |
| **Event Publishing** | Via EventProducer (transitive) | ⚠️ Via BrainService only | MEDIUM - can emit to incident queue but no direct execution |
| **ACL/RBAC** | GuardService | ⚠️ Used but not enforced for Medical Chat | WEAK - Medical Chat bypasses explicit RBAC checks |
| **Rate Limiting** | Per-instance sliding window | ⚠️ In BrainService only | WEAK - not global (suggests multi-instance issue) |

**ACL Rules** (from GuardService):
- Medical Chat routes NOT explicitly guarded by permission checks
- BrainService has its own rate limiter (5/sec per-instance)
- ActionService validates against SAFE_COMMANDS registry

**Conclusion**: 
- **Tenant/Doctor isolation at Learning layer**: ✅ Strong
- **Route-level ACL**: ⚠️ API Key only (not role-based)
- **Brain module access**: ❌ No explicit boundary enforcement
- **Clinical data access**: ✅ Blocked at model layer

---

## ISOLATION STATE ASSESSMENT

### POSITIVE FINDINGS ✅

| # | Finding | Evidence |
|---|---------|----------|
| 1 | **No direct clinical data access** | No appointment/patient/diagnosis repository injection |
| 2 | **Learning data properly scoped** | tenant/doctor/session isolation enforced in `matchesReuseScope()` |
| 3 | **Sanitization pipeline strong** | PHI redaction (email, phone, document ID, address, dates, HTML) |
| 4 | **Append-only JSONL** | No mutation of past learning records; corruption-safe loading |
| 5 | **Single well-guarded route** | POST /api/assistant/chat with ApiKeyGuard + ValidationPipe |
| 6 | **No Redis pollution risk** | Only in-memory caches; no shared state |
| 7 | **Groq PHI guard exists** | `assertGroqPhiAllowedOrThrow()` checks before sending to Groq |
| 8 | **Learning disabled for patients** | `allowedForTraining=false` for all patient-role queries |

### CRITICAL GAPS ❌

| # | Gap | Impact | Severity |
|----|-----|--------|----------|
| 1 | **BrainService lateral movement** | Medical Chat invokes `processIncident()` autonomously (line 277) | **CRITICAL** |
| 2 | **Uncontrolled HTTP fetch** | RuntimeToolsService makes direct calls to Google Search + other domains; no gateway | **CRITICAL** |
| 3 | **Transitive persistence access** | Via BrainService → PersistenceService → MongoDB (incident records writable) | **HIGH** |
| 4 | **No explicit route-level ACL** | Only API Key guard; no role-based access control on chat endpoint | **MEDIUM** |
| 5 | **Event queue access** | Medical Chat can publish to RabbitMQ incident queue via EventProducer | **MEDIUM** |
| 6 | **Google Calendar webhook** | Can write reminders to external calendar (MEDICAL_CHAT_GOOGLE_CALENDAR_WEBHOOK_URL) | **MEDIUM** |
| 7 | **Env var mode bypass** | `MEDICAL_CHAT_INTERNET_MODE` doesn't enforce domain whitelist; only toggles on/off | **MEDIUM** |
| 8 | **No boundary validation layer** | BrainService assumes Medical Chat caller is trusted; no cross-module policy validation | **HIGH** |

---

## LATERAL MOVEMENT ANALYSIS

**Attack Vector 1: Incident Processing**
```
User Query → MedicalAssistantService.handleMedicalChatMessage()
                    ↓
              for PATIENT + text mode: processIncident(incident)
                    ↓
          BrainService.processIncident()
                    ↓
         (can trigger ActionService, ModelService, MemoryService)
```
**Risk**: Medical Chat intended for patient-facing chat can invoke core system incident processing.

**Attack Vector 2: Uncontrolled Internet**
```
MedicalAssistantService.buildContext()
        ↓
MedicalRuntimeToolsService.buildContext()
        ↓
fetch(https://www.google.com/search?q=<USER_QUERY>)
        ↓
Third-party internet exposure (PHI leak risk)
```
**Risk**: User queries sent to Google Search API without sanitization or gateway.

**Attack Vector 3: Event Publishing**
```
BrainService.processIncident()
        ↓
EventProducer.publish(incident)
        ↓
RabbitMQ incident.main queue
        ↓
(consumed by unknown downstream processes)
```
**Risk**: Medical Chat events propagate to system infrastructure without explicit boundaries.

---

## ISOLATION VERDICT

### Current State: **LOGICAL ISOLATION** (design-level)
- Medical Chat module separate from core systems
- No direct clinical data access
- Learning records properly scoped

### Actual State: **BROKEN ISOLATION** (runtime-level)
- BrainService import allows autonomous incident processing
- HTTP access uncontrolled (internet gateway gap)
- Event publishing not gated by Medical Chat boundary

### Verdict for Production: **NO-GO** ❌

| Criterion | Status | Must-Fix Before Prod |
|-----------|--------|---------------------|
| No clinical data direct access | ✅ PASS | N/A |
| Learning isolation enforced | ✅ PASS | N/A |
| No uncontrolled internet | ❌ FAIL | Yes - add HTTP gateway |
| No lateral movement to core | ❌ FAIL | Yes - remove BrainService / gate processIncident() |
| No event queue autonomy | ❌ FAIL | Yes - disable incident emission or audit-only mode |
| Route-level ACL present | ❌ FAIL | Optional - recommended for defense-in-depth |

---

## RECOMMENDATIONS FOR BOUNDARY IMPLEMENTATION (PHASE 2)

### Priority 1: CRITICAL Fixes
1. **Remove or gate BrainService import**
   - Option A: Remove `BrainService` injection; move incident processing to separate async handler
   - Option B: Create `GatedBrainBridge` that only allows dry-run mode + audit logging
   - **Impact**: Prevents autonomous incident processing

2. **Add HTTP gateway layer**
   - Inject `HttpGatewayService` instead of direct fetch()
   - Whitelist domains: SATI, WHO, CDC, PubMed, OpenMeteo (weather only)
   - Block: Google Search, geolocation (unless explicitly scoped to patient location)
   - **Impact**: Prevents uncontrolled internet access + PHI leakage

3. **Audit-only event publishing**
   - Log all incident publishing to audit trail
   - Disable autonomous queue emission for Medical Chat origin
   - Require explicit escalation for production events
   - **Impact**: Prevents event infrastructure pollution

### Priority 2: HIGH Improvements
4. **Add route-level role-based ACL**
   - Use GuardService explicitly on /api/assistant/chat
   - Require `MEDICAL_CHAT_USER` permission
   - Enforce doctor/patient context validation

5. **Strengthen env var handling**
   - Make `MEDICAL_CHAT_INTERNET_MODE` a domain whitelist (not just toggle)
   - Validate `MEDICAL_CHAT_GOOGLE_CALENDAR_WEBHOOK_URL` format
   - Document CRITICAL vars: RABBITMQ_*, IMAGING_API_*

6. **Add integration tests**
   - Test cross-module access attempts (should block)
   - Test internet domain validation (should whitelist only)
   - Test tenant/doctor isolation (should fail on cross-tenant access)

---

## EVIDENCE SOURCES

All findings derived from static code analysis:
- **medical-assistant.service.ts** (lines 1-800+)
- **medical-assistant.module.ts** (lines 1-20)
- **medical-assistant.controller.ts** (lines 1-50)
- **medical-runtime-tools.service.ts** (lines 1-600+)
- **medical-chat-learning.service.ts** (lines 1-1300+)
- **brain.service.ts** (lines 30-80)
- **action.service.ts** (lines 1-30)
- **grep searches** for imports, HTTP calls, env vars, DB access
- **file I/O patterns** verified in learning service persistence

---

## CONCLUSION

**Medical Chat Isolation Status**: ⚠️ **CONDITIONAL**

- ✅ Learning records properly isolated (tenant/doctor scope)
- ✅ No clinical data direct access (appointments/patients blocked)
- ✅ Single well-guarded API route
- ❌ BrainService lateral movement (incident processing autonomous)
- ❌ Uncontrolled internet access (HTTP fetch to Google + others)
- ❌ Event publishing to core infrastructure (audit-only mode recommended)

**PHASE 2 Deliverable**: Implement isolation boundaries listed in Priority 1-2 above before considering Medical Chat production-ready for true boundary enforcement.

**Sign-Off**: This audit provides evidence-based risk assessment. Proceed to implementation phase only with explicit stakeholder acceptance of current gaps.

---

**Next Steps**:
1. ✅ PHASE 1 Complete: Audit evidence generated
2. ⏭️ PHASE 2: Implement isolation boundaries (Priority 1 fixes)
3. ⏭️ PHASE 3: Validate with integration + penetration tests
4. ⏭️ PHASE 4: Deploy to production with boundaries enforced
