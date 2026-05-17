# GSENTINELHEALTHOS - EXECUTION ROADMAP (OPERACIONAL)

**Propósito**: Guía semanal ejecutable para llevar el plan maestro a realidad  
**Versión**: 1.0  
**Dueño**: Principal Architect  
**Actualización**: Semanal  

---

## FASE 0: AUDITORÍA GLOBAL (16 MAYO - 6 JUNIO)

### Semana 1 (16-22 Mayo): Mappeo Exhaustivo

#### Lunes 16 - Kickoff
- [ ] Reunión de arquitectura (2h): Validar scope del plan
- [ ] Crear issue tracker en GitHub (Epic por fase)
- [ ] Asignar roles: Architect, SRE, Lead Engineer, QA Lead
- [ ] Setup Discord/Slack canals para comunicación diaria

#### Martes 17-Jueves 19: Deep Dive
- [ ] Auditoría de Docker Compose (documentar limitaciones)
- [ ] Auditoría de PostgreSQL (migrations, schema, RLS)
- [ ] Auditoría de Redis (persistence, Sentinel setup)
- [ ] Auditoría de API endpoints (enumerate all, contracts)
- [ ] Auditoría de Frontend (dependencies, build config)

#### Viernes 20-Sábado 21: Documentation
- [ ] Crear diagrama de dependencias (Mermaid/C4)
- [ ] Crear matriz de componentes (file, language, status)
- [ ] Crear matriz de riesgos (cuantificado)
- [ ] Entregable: ARCHITECTURE_DEEP_DIVE.md

#### Domingo 22: Review
- [ ] Presentación a stakeholders (30 min)
- [ ] Feedback loop
- [ ] Ajustes al plan si es necesario

### Semana 2 (23-29 Mayo): Risk & Dependency Analysis

#### Lunes 23: Risk Quantification
- [ ] Para cada bloque (A-L), cuantificar riesgos
  - [ ] Probability (1-10)
  - [ ] Impact (1-10)
  - [ ] Risk score = Prob * Impact
  - [ ] Mitigation strategy
- [ ] Entregable: DETAILED_RISK_MATRIX.md

#### Martes 24: Dependency Graph
- [ ] Mapear dependencias entre bloques
  - [ ] Bloques que bloquean otros
  - [ ] Orden de activación (topological sort)
  - [ ] Criticidad de dependencias
- [ ] Entregable: DEPENDENCY_GRAPH.md con diagrama

#### Miércoles 25: Performance Baseline
- [ ] Setup baselines (latency, memory, error rate)
  - [ ] API: Measure P50, P95, P99 latencies
  - [ ] Brain: Measure worker throughput
  - [ ] Database: Measure query latency
  - [ ] Redis: Measure operation latency
- [ ] Crear dashboard de baselines
- [ ] Entregable: PERFORMANCE_BASELINE_SNAPSHOT.md

#### Jueves 26: Security Audit
- [ ] Scan dependencias (npm audit, pip audit)
- [ ] Scan secretos (secrets in git?)
- [ ] Scan configuración (hard-coded creds?)
- [ ] Scan permisos (least privilege?)
- [ ] Entregable: SECURITY_AUDIT_BASELINE.md

#### Viernes 27-Sábado 28: Integration Map
- [ ] Mapear todas las integraciones externas
  - [ ] WhatsApp API (endpoints, auth, rate limits)
  - [ ] Google Calendar (OAuth flow, permissions)
  - [ ] Groq API (models, costs, quotas)
  - [ ] Database (connection pool, max connections)
  - [ ] Redis (persistence, replication)
- [ ] Entregable: EXTERNAL_INTEGRATIONS_AUDIT.md

#### Domingo 29: Review & Consolidate
- [ ] Compilar todos los audits en one unified view
- [ ] Crear "Audit Complete" checklist
- [ ] Go/No-Go decision: ¿Podemos proceder a FASE 1?

### Semana 3 (30 MAYO - 6 JUNIO): Finalización & Planning

#### Lunes 30: Consolidate Findings
- [ ] Review de todos los documentos de auditoría
- [ ] Identificar sorpresas o hallazgos críticos
- [ ] Crear "surprises" log (para aprender)

#### Martes 31: GO/NO-GO Auditoría
- [ ] Reunión final: ¿AUDITORÍA COMPLETA y CLARA?
- [ ] Decisión: ¿PROCEDER a FASE 1?
- [ ] Si NO-GO: Documentar bloqueadores, plan de remediate

#### Miércoles 1 JUNIO: FASE 1 Preparation
- [ ] Crear detailed weekly schedule para FASE 1
- [ ] Asignar tasks específicos por rol
- [ ] Setup trabajo branches en git
- [ ] Crear pull request template para FASE 1

#### Jueves 2-Viernes 3: Training
- [ ] Training a equipo: "Our architecture & why it matters"
- [ ] Training a equipo: "The 12 blocks & dependencies"
- [ ] Q&A session

#### Sábado 4-Domingo 6: Rest & Preparation
- [ ] Descanso del equipo
- [ ] Preparación mental para FASE 1 (work more intensive)

---

## FASE 1: NORMALIZACIÓN RUNTIME (7 JUNIO - 28 JUNIO)

### Semana 1 (7-13 JUNIO): Dual ORM Strategy

#### Lunes 7: Decide ORM Strategy
- [ ] Meeting: "SQLAlchemy vs Prisma - what's best?"
  - [ ] Option A: Unify on SQLAlchemy (all layers)
  - [ ] Option B: Unify on Prisma (all layers)
  - [ ] Option C: Explicit separation (api/brain = SQLAlchemy, frontend = Prisma)
  - [ ] Recommendation: Option A (more mature for production)
- [ ] Decide & document

#### Martes 8: ORM Audit
- [ ] Para Option A (Prisma → SQLAlchemy):
  - [ ] Mapear todas las Prisma queries
  - [ ] Encontrar equivalentes en SQLAlchemy
  - [ ] Documentar cambios necesarios
- [ ] Entregable: PRISMA_TO_SQLALCHEMY_MIGRATION_PLAN.md

#### Miércoles 9-Jueves 10: ORM Conversion (Part 1)
- [ ] Convertir medical-agenda-saas queries: appointments, time_slots
- [ ] Tests pass en lab environment
- [ ] Code review

#### Viernes 11-Sábado 12: ORM Conversion (Part 2)
- [ ] Convertir frontend queries: patients, doctors, clinics
- [ ] Tests pass
- [ ] Code review

#### Domingo 13: ORM Complete & Testing
- [ ] E2E tests pass en docker-compose.runtime-lab.yml
- [ ] No regression en API endpoints
- [ ] Entregable: ORM_UNIFICATION_COMPLETE.md

### Semana 2 (14-20 JUNIO): Feature Flags Consolidation

#### Lunes 14: Flag Registry Audit
- [ ] Auditar todos los flags en codebase
  - [ ] `MetaBrain/core/layer-registry.ts`
  - [ ] `api/app/core/config.py`
  - [ ] `.env.example`
  - [ ] Documentation (GLOBAL_AI_FLAGS_REFERENCE.md)
- [ ] Identificar inconsistencias
- [ ] Entregable: FLAG_AUDIT_FINDINGS.md

#### Martes 15: Flag Consolidation
- [ ] Crear centralizado flag registry
  - [ ] Single source of truth
  - [ ] Naming convention standardized
  - [ ] Default values documented
  - [ ] Validation logic (prevent conflicts)
- [ ] Entregable: UNIFIED_FLAG_REGISTRY.ts

#### Miércoles 16-Jueves 17: Flag Updates
- [ ] Update layer-registry.ts (NestJS)
- [ ] Update config.py (FastAPI)
- [ ] Update .env.example
- [ ] Tests pass

#### Viernes 18-Sábado 19: Flag Testing
- [ ] Unit tests para flag combinations
- [ ] Integration tests (flags affect right layers)
- [ ] Conflict detection tests

#### Domingo 20: Flags Complete
- [ ] Entregable: FLAGS_NORMALIZATION_COMPLETE.md

### Semana 3 (21-28 JUNIO): MetaBrain DI Wiring & Docker Optimization

#### Lunes 21: MetaBrain DI Design
- [ ] Design DI container
  - [ ] Production Safety first
  - [ ] Then Observability
  - [ ] Then Provider Router
  - [ ] etc. (respecting dependency order)
- [ ] Entregable: METABRAIN_DI_DESIGN.md

#### Martes 22-Miércoles 23: DI Implementation
- [ ] Wire DI in NestJS
- [ ] Test each layer can be activated independently
- [ ] Compile without errors

#### Jueves 24: Docker Optimization
- [ ] Audit Docker images (sizes?)
- [ ] Create multi-stage Dockerfiles
- [ ] Reduce image sizes by 30-50%
- [ ] Test images still work

#### Viernes 25-Sábado 26: Environment & Connection Pool
- [ ] Audit .env usage (ensure no hard-coded values)
- [ ] Optimize database connection pool
  - [ ] Measure current: `SHOW max_connections;`
  - [ ] Optimize based on load
  - [ ] Configure per-service limits
- [ ] Implement connection pooling best practices
  - [ ] PgBouncer or built-in pooling?

#### Domingo 27: Review & Testing
- [ ] Full docker-compose.runtime-lab.yml test
- [ ] E2E tests pass
- [ ] Entregable: PHASE_1_COMPLETE.md

---

## FASE 2: HARDENING INFRAESTRUCTURA (29 JUNIO - 18 JULIO)

### Semana 1 (29 JUN - 5 JUL): Backups & Persistence

#### Lunes 29: Backup Strategy
- [ ] Design PostgreSQL backup strategy
  - [ ] Daily full backups
  - [ ] Point-in-time recovery (PITR)
  - [ ] Off-site replication
  - [ ] Test restore procedure
- [ ] Entregable: BACKUP_STRATEGY.md

#### Martes 30 - Miércoles 1: Backup Implementation
- [ ] Implement pg_dump + cron
- [ ] Or: Use managed backup (AWS RDS, Google Cloud SQL)
- [ ] Test restore: Can we restore last 7 days?

#### Jueves 2: Redis Persistence
- [ ] Verify Redis AOF enabled
- [ ] Verify Redis RDB configured
- [ ] Test persistence: Kill Redis, restart, data intact?

#### Viernes 3-Sábado 4: Sentinel Failover Drill
- [ ] Setup Sentinel monitoring
- [ ] Kill Redis master intentionally
- [ ] Verify Sentinel promotes replica automatically
- [ ] Verify application reconnects
- [ ] Document procedure

#### Domingo 5: Persistence Complete
- [ ] All tests pass
- [ ] Entregable: PERSISTENCE_AND_RECOVERY_VALIDATED.md

### Semana 2 (6-12 JUL): Secret Management & Logging

#### Lunes 6: Secret Manager Setup
- [ ] Choose: AWS Secrets Manager, Vault, or similar
- [ ] Setup secret store
- [ ] Migrate current secrets (API keys, DB creds)

#### Martes 7-Miércoles 8: Secret Integration
- [ ] Update application code to read from secret manager
- [ ] Remove .env secrets from container
- [ ] Verify no secrets in logs or git

#### Jueves 9: Log Aggregation
- [ ] Choose: ELK, Splunk, Datadog, or Cloud Logging
- [ ] Setup log collector
- [ ] Configure log retention (30-90 days)

#### Viernes 10-Sábado 11: Log Streaming
- [ ] Pipe Docker logs to centralized logging
- [ ] Verify logs appear in dashboard
- [ ] Create log search queries for common issues

#### Domingo 12: Secrets & Logging Complete
- [ ] Entregable: SECRETS_AND_LOGGING_HARDENED.md

### Semana 3 (13-18 JUL): TLS/SSL & Container Security

#### Lunes 13: Certificate Management
- [ ] Setup auto-renewing SSL certificates (Let's Encrypt)
- [ ] Verify HTTPS only (HTTP → HTTPS redirect)
- [ ] Test certificate renewal automation

#### Martes 14-Miércoles 15: Container Security
- [ ] Scan Docker images for vulnerabilities
- [ ] Use minimal base images (alpine?)
- [ ] Verify images signed

#### Jueves 16: Network Isolation
- [ ] Verify Docker network isolation
- [ ] Expose only necessary ports
- [ ] Verify VPS firewall rules

#### Viernes 17-Sábado 18: Health Checks
- [ ] Implement health checks per service
  - [ ] PostgreSQL: Can we query?
  - [ ] Redis: Can we ping?
  - [ ] API: Does /health return 200?
  - [ ] Brain: Does /health return 200?
  - [ ] Frontend: Can we request index.html?
- [ ] Docker Compose respects health checks (restart on fail)

#### Domingo 18: PHASE 2 Complete
- [ ] Entregable: INFRASTRUCTURE_HARDENED.md

---

## FASE 3: AISLAMIENTO DE DOMINIOS (19 JUL - 9 AGOSTO)

### Semana 1 (19-25 JUL): BLOQUE A-E Analysis

#### Lunes 19: BLOQUE A (Core Infra) Audit
- [ ] Verificar: DB, Redis, Docker, Network aislados
- [ ] Documentar interfaces
- [ ] Entregable: BLOQUE_A_AUDIT.md

#### Martes 20: BLOQUE B (Auth) Audit
- [ ] Verificar: JWT, RLS, PHI flags, Secret handling
- [ ] Identificar cross-bloque dependencies
- [ ] Entregable: BLOQUE_B_AUDIT.md

#### Miércoles 21: BLOQUE C (Medical Agenda) Audit
- [ ] Verificar: Appointment CRUD, Slots, Google Sync
- [ ] Health checks per domain entity
- [ ] Entregable: BLOQUE_C_AUDIT.md

#### Jueves 22: BLOQUE D-E (Chat, WhatsApp) Audit
- [ ] Verificar: WebSocket, Message routing, Webhook
- [ ] Cross-domain message contracts
- [ ] Entregable: BLOQUE_D_E_AUDIT.md

#### Viernes 23-Sábado 24: Refactoring A-E
- [ ] Decouple A-E using explicit APIs
- [ ] No circular dependencies
- [ ] Tests pass per domain

#### Domingo 25: A-E Complete
- [ ] Entregable: DOMAINS_A_E_ISOLATED.md

### Semana 2 (26 JUL - 1 AGO): BLOQUE F-J Analysis

#### Lunes 26: BLOQUE F (AI/Groq) Audit
- [ ] Verify provider isolation
- [ ] Document API contracts
- [ ] Entregable: BLOQUE_F_AUDIT.md

#### Martes 27: BLOQUE G (MetaBrain) Audit
- [ ] Verify DI wiring (if completed in Phase 1)
- [ ] Verify layers can be toggled independently
- [ ] Entregable: BLOQUE_G_AUDIT.md

#### Miércoles 28: BLOQUE H-J (Imaging, Workers, Observability) Audit
- [ ] Verify image pipeline isolated
- [ ] Verify workers have health checks
- [ ] Verify observability doesn't leak PHI
- [ ] Entregable: BLOQUE_H_J_AUDIT.md

#### Jueves 29-Viernes 30: Refactoring F-J
- [ ] Decouple using interfaces
- [ ] No direct imports between blocks
- [ ] Dependency injection for cross-block calls

#### Sábado 31-Domingo 1: Testing
- [ ] E2E tests for each domain flow
- [ ] Tests pass independently and integrated

### Semana 3 (2-9 AGO): BLOQUE K-L & Integration

#### Lunes 2: BLOQUE K-L (DevOps, Safety) Audit
- [ ] Verify containerization strategy
- [ ] Verify safety gates operational
- [ ] Entregable: BLOQUE_K_L_AUDIT.md

#### Martes 3-Miércoles 4: Contract Definition
- [ ] Define explicit contracts between blocks
- [ ] OpenAPI specs per API
- [ ] Event message schemas (for async)
- [ ] Database column versioning (for schema evolution)

#### Jueves 5-Viernes 6: Integration Testing
- [ ] E2E test each block boundary
- [ ] Tests validate contracts
- [ ] Load test integrated system

#### Sábado 7-Domingo 8: Full System Validation
- [ ] All blocks work independently
- [ ] All blocks integrate correctly
- [ ] Entregable: DOMAINS_FULLY_ISOLATED.md

---

## FASE 4: METABRAIN INTEGRATION (10 AGOSTO - 28 SEPTIEMBRE)

### Semana 1-2 (10-23 AGO): Production Safety Layer

#### Lunes 10: Production Safety Design Review
- [ ] Review MetaBrain/production-safety code
- [ ] Design activation sequence
- [ ] Design rollback per layer

#### Martes 11-Miércoles 12: Production Safety Tests
- [ ] Unit tests: All gates work
- [ ] Integration tests: Gates prevent bad actions
- [ ] Kill switch tested (activates, prevents all AI)

#### Jueves 13-Viernes 14: Production Safety Activation (Test Env)
- [ ] Enable in docker-compose.runtime-lab.yml
- [ ] Verify no side effects
- [ ] Verify gates functional

#### Sábado 15-Domingo 16: Production Safety Drill
- [ ] Monthly drill: Test kill switch
- [ ] Entregable: PRODUCTION_SAFETY_TESTED.md

### Semana 3-4 (24 AGO - 6 SEPT): Observability Layer

#### Lunes 24: Observability Design Review
- [ ] Review MetaBrain/observability code
- [ ] Design shadow mode (no external calls)
- [ ] Design audit trail

#### Martes 25-Miércoles 26: Observability Tests
- [ ] Unit tests: All metrics collected
- [ ] Integration tests: Traces follow requests
- [ ] No PHI in observability

#### Jueves 27-Viernes 28: Observability Activation (Shadow)
- [ ] Enable in test env (shadow only)
- [ ] Verify no side effects
- [ ] Verify traces appear in centralized logging

#### Sábado 29-Domingo 30: Observability Validation
- [ ] Entregable: OBSERVABILITY_TESTED.md

### Semana 5-6 (7-20 SEPT): Provider Router & Confidence Layers

#### Lunes 7: Provider Router Design Review
- [ ] Review provider selection logic
- [ ] Design fallback strategy
- [ ] Design cost tracking

#### Martes 8-Miércoles 9: Provider Tests
- [ ] Unit tests: Router selects best provider
- [ ] Fallback tests: Switch on timeout
- [ ] Load tests: Handle max QPS

#### Jueves 10-Viernes 11: Provider Activation (Shadow)
- [ ] Enable in test env (no new external calls)
- [ ] Verify no side effects

#### Sábado 12-Domingo 13: Confidence Layer
- [ ] Review confidence scoring logic
- [ ] Tests: Confidence scores make sense
- [ ] Shadow mode: Log scores but don't use

#### Lunes 14: Clinical Review Layer
- [ ] Review human review queue logic
- [ ] Tests: Queue functional, non-blocking
- [ ] Shadow mode: Queue filled but not checked

#### Martes 15-Miércoles 16: Memory & Imaging Layers
- [ ] Review semantic memory logic
- [ ] Tests: Memory reads/writes work
- [ ] Shadow mode: No external vector DB
- [ ] Review imaging logic
- [ ] Tests: Inference works
- [ ] Shadow mode: Metadata only, no clinical use

#### Jueves 17-Viernes 18: Full MetaBrain Integration Test
- [ ] All 7 layers wired
- [ ] All layers in shadow mode
- [ ] E2E test: Full request flow
- [ ] No side effects

#### Sábado 19-Domingo 20: MetaBrain Complete
- [ ] Entregable: METABRAIN_INTEGRATION_COMPLETE.md

---

## FASE 5: SEGURIDAD CLÍNICA (29 SEPT - 17 OCTUBRE)

### Semana 1 (29 SEPT - 5 OCT): PHI Audit Trail & HIPAA Mapping

#### Lunes 29: PHI Audit Trail
- [ ] Identify all PHI access points
- [ ] Log every access (who, what, when, why)
- [ ] Store logs immutably
- [ ] Entregable: PHI_ACCESS_AUDIT_IMPLEMENTED.md

#### Martes 30 - Miércoles 1: HIPAA Mapping
- [ ] Map every component to HIPAA requirement
- [ ] Document compliance per component
- [ ] Identify gaps

#### Jueves 2-Viernes 3: Clinical Review Workflow
- [ ] Define: When is human review required?
- [ ] Define: Who can approve AI recommendations?
- [ ] Implement: UI/UX for review
- [ ] Test: Workflow end-to-end

#### Sábado 4-Domingo 5: Hallucination Detection
- [ ] Design: How detect if AI "hallucinates"?
- [ ] Implement: Confidence threshold logic
- [ ] Test: Low-confidence recommendations flagged

### Semana 2 (6-12 OCT): Confidence & Fairness

#### Lunes 6: Confidence Thresholds
- [ ] Define: Minimum confidence for auto-acceptance
- [ ] Define: Confidence for human review required
- [ ] Implement in code
- [ ] Test: Recommendations properly scored

#### Martes 7-Miércoles 8: Fairness Audit
- [ ] Analyze: Does AI perform equally across demographics?
- [ ] Test: No demographic bias detected
- [ ] Implement: Fairness monitoring

#### Jueves 9-Viernes 10: Provider Cost Tracking
- [ ] Track: Cost per AI call, per provider
- [ ] Monitor: Budget usage
- [ ] Alert: If over budget

#### Sábado 11-Domingo 12: Clinical Approval
- [ ] Doctor sign-off: AI safety model acceptable
- [ ] Ethicist sign-off: Ethical considerations addressed
- [ ] Compliance sign-off: HIPAA requirements met
- [ ] Entregable: CLINICAL_SAFETY_APPROVED.md

---

## FASE 6: OBSERVABILIDAD PRODUCCIÓN (18 OCT - 8 NOV)

### Semana 1-2: Metrics & Dashboards

#### Lunes 18: Metrics Setup
- [ ] Setup Prometheus scraping
- [ ] Define key metrics per service
- [ ] Implement metric emission in code

#### Martes 19-Miércoles 20: Dashboards
- [ ] Create Grafana dashboards
  - [ ] API: Throughput, latency, error rate
  - [ ] Brain: Queue depth, processing latency
  - [ ] Database: Query time, connections
  - [ ] Redis: Hit rate, evictions

#### Jueves 21-Viernes 22: Alerting Rules
- [ ] Define: When to alert
- [ ] Implement: Alerting rules
- [ ] Test: Alerts fire when expected

#### Sábado 23-Domingo 24: SLO Definition
- [ ] Define: Service Level Objectives
  - [ ] API availability: 99.5%
  - [ ] API latency P99: < 500ms
  - [ ] Database recovery time: < 5 min
- [ ] Implement: SLO tracking

### Semana 3: Tracing & Logging

#### Lunes 25: Distributed Tracing
- [ ] Setup Jaeger or similar
- [ ] Instrument code with trace IDs
- [ ] Trace request across all services

#### Martes 26-Miércoles 27: Log Retention & Compliance
- [ ] Define: Log retention policy (30/90 days)
- [ ] Implement: Automated log archival
- [ ] Verify: Compliance with retention requirements

#### Jueves 28-Viernes 29: On-Call Runbooks
- [ ] Define: On-call escalation
- [ ] Create: Runbooks for common issues
- [ ] Train: On-call team

#### Sábado 30-Domingo 1: Observability Complete
- [ ] Entregable: OBSERVABILITY_PRODUCTION_READY.md

---

## FASE 7: TESTING MASIVO (9 NOV - 20 DIC)

### Semana 1-2: Load Testing

#### Lunes 9: Load Test Design
- [ ] Define: Load profile (requests per second, concurrency)
- [ ] Define: Success criteria (P99 latency, error rate)
- [ ] Tool: k6, Locust, or JMeter

#### Martes 10-Miércoles 11: Load Test Implementation
- [ ] Write load test scenarios
  - [ ] Appointment booking: 100 rps, 1000 concurrent
  - [ ] Chat messages: 50 rps, 500 concurrent
  - [ ] API read: 500 rps, 5000 concurrent

#### Jueves 12-Viernes 13: Load Test Execution
- [ ] Run load tests
- [ ] Identify bottlenecks
- [ ] Optimize if needed

#### Sábado 14-Domingo 15: Stress Test
- [ ] Gradually increase load until system breaks
- [ ] Identify breaking point
- [ ] Verify graceful degradation

### Semana 3-4: Chaos & Security Testing

#### Lunes 16: Chaos Engineering
- [ ] Kill containers randomly (chaos monkey)
- [ ] Introduce network latency
- [ ] Verify system resilience

#### Martes 17-Miércoles 18: Security Testing
- [ ] Penetration test API endpoints
- [ ] Scan for vulnerabilities
- [ ] Verify CSRF, XSS, SQL injection protection

#### Jueves 19-Viernes 20: Disaster Recovery
- [ ] Simulate database failure
- [ ] Verify backup restoration
- [ ] Verify business continuity

#### Sábado 21-Domingo 22: Performance Validation
- [ ] Entregable: TESTING_COMPLETE.md (all tests pass)

---

## FASE 8: PREPRODUCCIÓN (21 DIC - 10 ENERO)

### Semana 1 (21-27 DIC): Pilot Clinic Onboarding

#### Lunes 21: Clinic Selection
- [ ] Choose: Pilot clinic (1-2 locations)
- [ ] Get: Informed consent from clinic staff & patients

#### Martes 22-Miércoles 23: Training
- [ ] 4-hour training: Doctor, staff on new features
- [ ] 2-hour training: Support team on troubleshooting

#### Jueves 24: Soft Launch
- [ ] Deploy to pilot environment
- [ ] Monitor: Very closely (1h check-in cycle)
- [ ] Verify: No critical issues

#### Viernes 25-Sábado 26: Holiday Pause
- [ ] (Holiday)

#### Domingo 27: Readiness Check
- [ ] Are we ready to continue?
- [ ] Entregable: PILOT_CLINIC_LAUNCHED.md

### Semana 2-3 (28 DIC - 10 ENERO): Pilot Validation

#### Daily Monitoring
- [ ] Check: Error rates
- [ ] Check: API latency
- [ ] Check: Doctor satisfaction
- [ ] Check: No patient harm incidents

#### Feedback Loops
- [ ] Weekly: Doctor feedback session
- [ ] Bi-weekly: Clinic workflow review

#### Entregable
- [ ] PILOT_CLINIC_VALIDATION_REPORT.md (at end)

---

## FASE 9: PRODUCCIÓN (11 ENERO - 28 FEBRERO)

### Semana 1 (11-17 ENERO): Production Readiness

#### Lunes 11: Final Checklist
- [ ] All requirements from section 6 met?
- [ ] GO/NO-GO decision

#### Martes 12-Miércoles 13: Production Deployment
- [ ] Deploy to production VPS
- [ ] Enable monitoring
- [ ] Activate alerting

#### Jueves 14-Viernes 15: Blue-Green Testing
- [ ] Verify: Blue environment (previous version) still works
- [ ] Verify: Green environment (new version) works
- [ ] Prepare: Switch procedure (if needed)

#### Sábado 16-Domingo 17: Monitoring Intensified
- [ ] 24/7 on-call active
- [ ] Check every 15 minutes (automated)
- [ ] Any issue: immediate rollback

### Semana 2-4 (18 ENERO - 28 FEBRERO): Gradual Rollout

#### Phase 1 (Week 1): One clinic (monitoring intensively)
#### Phase 2 (Week 2-3): 5 clinics (expand carefully)
#### Phase 3 (Week 4-6): All clinics (full rollout)

#### Per Phase:
- [ ] Monitor error rate
- [ ] Monitor doctor satisfaction
- [ ] Monitor no patient incidents
- [ ] Entregable: Phase completion report

---

## GOVERNANCE & ESCALATION

### Approval Bodies

#### Technical Review Board (TRB)
- **Members**: CTO, Principal Architect, Lead Engineer
- **Cadence**: Weekly
- **Authority**: Approve/reject phase completion

#### Clinical Review Board (CRB)
- **Members**: Chief Medical Officer, Lead Doctor, Compliance Officer
- **Cadence**: Bi-weekly (FASE 5+)
- **Authority**: Approve AI safety model, patient consent, clinical protocols

#### Risk Review Board (RRB)
- **Members**: CTO, CMO, Head of Ops, Compliance
- **Cadence**: Monthly
- **Authority**: Assess risk matrix, approve new risks

### Escalation Path

```
Bug found during FASE
   ↓
If Critical → Halt phase, escalate to CTO
   ↓
If High → Create issue, continue with mitigation
   ↓
If Medium → Log for later, continue
   ↓
If Low → Add to backlog
```

### Communication

- **Daily**: Team standup (15 min)
- **Weekly**: Stakeholder update (30 min)
- **Monthly**: Executive review (60 min)
- **Emergency**: All-hands (as needed)

---

## SUCCESS METRICS

### Phase Completion
- All phase deliverables completed
- All tests pass
- TRB approval obtained
- No critical blockers remain

### Go-Live Success
- Zero critical incidents in first week
- < 1% error rate sustained
- Doctor satisfaction > 8/10
- All monitoring alerts responsive

### 30-Day Post-Production
- System stable (99.5%+ uptime)
- Patient adoption > 50%
- Zero PHI breaches
- SLOs met

---

## DOCUMENT MAINTENANCE

This roadmap is LIVING. Update weekly:
- [ ] Mark completed sections as ✓
- [ ] Adjust timeline if needed
- [ ] Document blockers & mitigations
- [ ] Log lessons learned

**Owner**: Principal Architect  
**Last Update**: [Today's date]  
**Next Review**: [Next Friday]
