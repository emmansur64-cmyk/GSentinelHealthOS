# GSENTINELHEALTHOS - QUICK REFERENCE CARD

**Imprime esto. Pegalo en la pared.**

---

## ESTADO ACTUAL (16 Mayo 2026)

```
Arquitectura:      ████████░ 8/10   ✓ READY
Runtime:           ██░░░░░░░ 2/10   ✗ NOT READY
IA Clínica:        ░░░░░░░░░ 0/10   ✗ DISABLED
Seguridad:         ██████░░░ 6/10   ⚠ PARTIAL
Infraestructura:   ███████░░ 7/10   ✓ FUNCTIONAL
Observabilidad:    █████░░░░ 5/10   ⚠ PARTIAL
PHI Compliance:    █████░░░░ 5/10   ⚠ PARTIAL
```

**RESULTADO**: No está listo para producción. Pero es recuperable.

---

## 12 BLOQUES DEL SISTEMA

| Bloque | Nombre | Estado | Riesgo | Acción |
|--------|--------|--------|--------|--------|
| A | Core Infra (DB, Redis, Docker) | Funcional | Bajo | Hardening FASE 2 |
| B | Auth & Security (JWT, RLS, PHI) | Parcial | Alto | Endurecimiento FASE 1-2 |
| C | Medical Agenda (Booking, Sync) | Estable | Bajo | Testing FASE 7 |
| D | Chat (WebSocket, History) | Funcional | Medio | Encryption FASE 5 |
| E | WhatsApp (Gateway, Intake) | Funcional | Medio | Scale test FASE 7 |
| F | AI/Groq (Providers, Router) | Experimental | Alto | Activation FASE 4 |
| G | MetaBrain (7 Layers) | Arquitectural | Crítico | DI wiring FASE 1-4 |
| H | Imaging (ONNX, Safety) | Experimental | Alto | Validation FASE 5 |
| I | Workers (Async, Jobs) | Funcional | Medio | Resilience FASE 2 |
| J | Observability (Logs, Metrics) | Parcial | Alto | Integration FASE 6 |
| K | DevOps (Deployment, VPS) | Funcional | Medio | Hardening FASE 2 |
| L | Safety (Kill Switch, Rollback) | Documentado | Medio | Testing FASE 7 |

---

## 9 FASES - TIMELINE

```
┌─ FASE 0 (3 sem)  Auditoría global
├─ FASE 1 (3 sem)  Normalización runtime (ORM, flags, DI)
├─ FASE 2 (3 sem)  Hardening infraestructura (backup, secrets, logging)
├─ FASE 3 (3 sem)  Aislamiento de dominios (12 bloques desacoplados)
├─ FASE 4 (7 sem)  MetaBrain integration (7 capas wired)
├─ FASE 5 (3 sem)  Seguridad clínica (PHI, HIPAA, approvals)
├─ FASE 6 (3 sem)  Observabilidad producción (tracing, alerting)
├─ FASE 7 (6 sem)  Testing masivo (load, stress, chaos, security)
├─ FASE 8 (3 sem)  Preproducción (pilot clinic)
└─ FASE 9 (7 sem)  Producción (gradual rollout)

TOTAL: ~9 meses
```

---

## RIESGOS CRÍTICOS (Top 6)

| Riesgo | Prob | Impact | Mitigación |
|--------|------|--------|-----------|
| Dual ORM desincronización | MEDIA | CRÍTICA | Unify en FASE 1 |
| MetaBrain DI wiring breaks | BAJA | CRÍTICA | Gradual activation + tests |
| Booking overbooking @ scale | MEDIA | CRÍTICA | Load test 1000+ concurrency |
| PHI leak to external provider | BAJA | CRÍTICA | Sanitizers + audit + vault |
| IA diagnosis without human review | MEDIA | CRÍTICA | Confidence thresholds |
| Redis Sentinel failover fails | BAJA | CRÍTICA | Monthly drill |

---

## PROHIBIDO ANTES DE PRODUCCIÓN

```
✗ NO diagnóstico definitivo autónomo
✗ NO PHI a providers externos
✗ NO IA activa sin human review
✗ NO DICOM sin clinical validation
✗ NO enforcement clínico automático
✗ NO deploy sin rollback procedure
✗ NO cambios sin code review
✗ NO secrets en .env en git
```

---

## GO/NO-GO CHECKLIST (Pre-Production)

**Infrastructure**
- [ ] Backups automated + restore tested
- [ ] Sentinel failover automatic
- [ ] Centralized logging active
- [ ] Metrics collection live
- [ ] Alerting rules working

**Security**
- [ ] JWT tokens + refresh flow
- [ ] Multi-tenant RLS enforced
- [ ] PHI sanitization active
- [ ] Secrets in vault (not .env)
- [ ] Rate limiting per tenant

**Clinical**
- [ ] Doctor sign-off obtained
- [ ] Ethicist approval received
- [ ] Compliance audit passed
- [ ] HIPAA mapping complete
- [ ] Human review workflow tested

**Testing**
- [ ] Load test passed (1000+ concurrent)
- [ ] Stress test passed
- [ ] Chaos test passed (kill containers)
- [ ] Security pen test passed
- [ ] E2E tests pass

**Observability**
- [ ] Centralized logging (retention policy)
- [ ] Metrics dashboard (Grafana)
- [ ] Distributed tracing (Jaeger)
- [ ] Alerting rules + runbooks
- [ ] On-call rotation configured

---

## WEEKLY STANDUP TEMPLATE

```
Monday 9am:
  - What did we accomplish last week?
  - Are we on track with timeline?
  - Any blockers?
  - Any risks emerging?
  
Technical Issues:
  - [Issue]: [Status]: [ETA]
  
Clinical/Compliance:
  - Approvals received?
  - Concerns?
  
Next Week:
  - Planned deliverables?
  - Dependencies?
  - Resource needs?
```

---

## KEY DOCUMENTS

1. **GSENTINELHEALTHOS_MASTER_PRODUCTION_PLAN.md** — Full plan (160+ pages)
2. **EXECUTION_ROADMAP.md** — Weekly executable (130+ pages)
3. **EXECUTIVE_SUMMARY.md** — For stakeholders (2 pages)
4. **This card** — Quick reference (1 page)

---

## CRITICAL CONTACTS

```
Principal Architect:    [Name] — Decisions, escalation
Technical Lead:        [Name] — Day-to-day execution
Clinical Lead:         [Name] — Clinical safety approvals
SRE/DevOps:           [Name] — Infrastructure & monitoring
On-Call Engineer:      [Schedule] — Incident response
```

---

## GO TO PRODUCTION? Checklist

```
ALL sections below must be GREEN:

INFRASTRUCTURE        ░░░░░░░░░░ [Progress]
SECURITY              ░░░░░░░░░░ [Progress]
CLINICAL SAFETY       ░░░░░░░░░░ [Progress]
TESTING               ░░░░░░░░░░ [Progress]
OBSERVABILITY         ░░░░░░░░░░ [Progress]

If ANY section is RED: HALT. Fix. Retry.
If ALL sections GREEN: CTO + CMO + Compliance sign-off.
                       PROCEED TO PRODUCTION.
```

---

## RED FLAGS 🚩

If you see ANY of these during execution, STOP immediately:

- [ ] Test failure not understood → investigate
- [ ] Performance degradation unexplained → investigate
- [ ] PHI accessed without approval → investigate
- [ ] Secrets found in git → investigate
- [ ] Phase not completed → escalate
- [ ] Doctor/ethicist concerned → escalate
- [ ] Compliance finding → escalate

---

**Print this. Update weekly. Refer daily.**

Last updated: 16 de mayo de 2026
