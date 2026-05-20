# SYSTEM GUARD / SYSTEM BRAIN CODE AUDIT

Generated: 2026-05-18 23:51:01 -03:00
Working dir: E:\GSentinelHealthOS

## Existing targets scanned
```
MB-Chat
MB-Secretaria
MB-Whatsapp
brain
api
scripts
docker-compose.yml

```
## Search 1 (System Guard / Brain tokens)
```
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:230:  diagnosis = SystemBrainService.process(fingerprint, input)
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:338:[7] Apply SystemBrain safety (applySystemBrainDecisionSafety)
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:441:- Métricas de SystemBrain
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:486:  // SystemBrain enrichment
MB-Chat\src\system-brain\system-brain.service.ts:22:export class SystemBrainService {
MB-Chat\src\system-brain\system-brain.service.ts:35:    const windowStart = Date.now() - SystemBrainService.MIN_TIME_WINDOW_MS;
MB-Chat\src\system-brain\system-brain.service.ts:37:      .last(SystemBrainService.MAX_MEMORY_SCAN)
MB-Chat\src\system-brain\system-brain.module.ts:6:import { SystemBrainService } from './system-brain.service';
MB-Chat\src\system-brain\system-brain.module.ts:10:  providers: [SystemBrainService, FrequencyAnalyzer, PatternAnalyzer],
MB-Chat\src\system-brain\system-brain.module.ts:11:  exports: [SystemBrainService],
MB-Chat\src\system-brain\system-brain.module.ts:13:export class SystemBrainModule {}
MB-Whatsapp\src\system-brain\system-brain.service.ts:22:export class SystemBrainService {
MB-Whatsapp\src\system-brain\system-brain.service.ts:35:    const windowStart = Date.now() - SystemBrainService.MIN_TIME_WINDOW_MS;
MB-Whatsapp\src\system-brain\system-brain.service.ts:37:      .last(SystemBrainService.MAX_MEMORY_SCAN)
MB-Whatsapp\src\system-brain\system-brain.module.ts:6:import { SystemBrainService } from './system-brain.service';
MB-Whatsapp\src\system-brain\system-brain.module.ts:10:  providers: [SystemBrainService, FrequencyAnalyzer, PatternAnalyzer],
MB-Whatsapp\src\system-brain\system-brain.module.ts:11:  exports: [SystemBrainService],
MB-Whatsapp\src\system-brain\system-brain.module.ts:13:export class SystemBrainModule {}
MB-Whatsapp\src\brain\brain.service.ts:20:import { SystemBrainService, EnrichedDiagnosis } from '../system-brain/system-brain.service';
MB-Whatsapp\src\brain\brain.service.ts:56:    @Optional() private readonly systemBrainService?: SystemBrainService,
MB-Whatsapp\src\brain\brain.service.ts:134:      const enrichedInput = this.attachSystemBrainContext(normalizedInput, enrichedDiagnosis);
MB-Whatsapp\src\brain\brain.service.ts:143:      decision = this.applySystemBrainDecisionSafety(decision, enrichedDiagnosis);
MB-Whatsapp\src\brain\brain.service.ts:582:  private attachSystemBrainContext(input: IncidentPayload, enrichedDiagnosis: EnrichedDiagnosis): IncidentPayload {
MB-Whatsapp\src\brain\brain.service.ts:601:  private applySystemBrainDecisionSafety(
MB-Whatsapp\src\brain\brain.service.ts:617:        reason: `${decision.reason}. SystemBrain: anti_loop_block pattern=${enrichedDiagnosis.pattern} riskScore=${enrichedDiagnosis.actionRiskScore}`,
MB-Whatsapp\src\brain\brain.service.ts:645:      reason: `${decision.reason}. SystemBrain: ${reasonParts.join(' ')}`,
MB-Whatsapp\src\brain\brain.module.ts:11:import { SystemBrainModule } from '../system-brain/system-brain.module';
MB-Whatsapp\src\brain\brain.module.ts:30:    SystemBrainModule,
MB-Chat\src\brain\brain.service.ts:20:import { SystemBrainService, EnrichedDiagnosis } from '../system-brain/system-brain.service';
MB-Chat\src\brain\brain.service.ts:56:    @Optional() private readonly systemBrainService?: SystemBrainService,
MB-Chat\src\brain\brain.service.ts:134:      const enrichedInput = this.attachSystemBrainContext(normalizedInput, enrichedDiagnosis);
MB-Chat\src\brain\brain.service.ts:143:      decision = this.applySystemBrainDecisionSafety(decision, enrichedDiagnosis);
MB-Chat\src\brain\brain.service.ts:582:  private attachSystemBrainContext(input: IncidentPayload, enrichedDiagnosis: EnrichedDiagnosis): IncidentPayload {
MB-Chat\src\brain\brain.service.ts:601:  private applySystemBrainDecisionSafety(
MB-Chat\src\brain\brain.service.ts:617:        reason: `${decision.reason}. SystemBrain: anti_loop_block pattern=${enrichedDiagnosis.pattern} riskScore=${enrichedDiagnosis.actionRiskScore}`,
MB-Chat\src\brain\brain.service.ts:645:      reason: `${decision.reason}. SystemBrain: ${reasonParts.join(' ')}`,
MB-Chat\src\brain\brain.module.ts:11:import { SystemBrainModule } from '../system-brain/system-brain.module';
MB-Chat\src\brain\brain.module.ts:30:    SystemBrainModule,
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:230:  diagnosis = SystemBrainService.process(fingerprint, input)
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:338:[7] Apply SystemBrain safety (applySystemBrainDecisionSafety)
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:441:- Métricas de SystemBrain
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:486:  // SystemBrain enrichment

```
## Search 2 (watcher/autoheal/scheduler tokens)
```
docker-compose.yml:649:  outbox_scheduler:
docker-compose.yml:653:    container_name: gs_outbox_scheduler
docker-compose.yml:683:      OUTBOX_SCHEDULER_INTERVAL_SECONDS: ${OUTBOX_SCHEDULER_INTERVAL_SECONDS:-15}
docker-compose.yml:695:      GOOGLE_CALENDAR_WATCH_TTL_SECONDS: ${GOOGLE_CALENDAR_WATCH_TTL_SECONDS:-86400}
docker-compose.yml:699:    command: python scripts/run_outbox_scheduler.py
brain\app.py:7:El worker Redis se lanza en background al iniciar la app.
brain\app.py:157:    # Arrancar el worker Redis en background (booking existente)
brain\main.py:221:      - BRAIN_MODE=http    → FastAPI + worker Redis en background (default)
brain\main.py:231:        # Modo HTTP: el worker se lanza como background task dentro del lifespan
brain\services\whatsapp_appointment_intake_service.py:10:from brain.services.appointment_scheduler_service import AppointmentSchedulerService, ScheduledSlot
brain\services\whatsapp_appointment_intake_service.py:77:        scheduler: AppointmentSchedulerService,
brain\services\whatsapp_appointment_intake_service.py:81:        self.scheduler = scheduler
brain\services\whatsapp_appointment_intake_service.py:309:                    await self.scheduler.release_slot_lock(str(lock_key))
brain\services\whatsapp_appointment_intake_service.py:357:        slot = await self.scheduler.find_next_available_slot(
brain\services\whatsapp_appointment_intake_service.py:432:            await self.scheduler.release_slot_lock(lock_key)
brain\services\whatsapp_appointment_intake_service.py:466:            await self.scheduler.release_slot_lock(lock_key)
brain\services\orchestrator.py:14:from brain.services.appointment_scheduler_service import AppointmentSchedulerService
brain\services\orchestrator.py:38:        self.scheduler_service = AppointmentSchedulerService(
brain\services\orchestrator.py:45:            scheduler=self.scheduler_service,
brain\services\knowledge_base_client.py:31:        """Obtiene o crea sesión HTTP asíncrona."""
brain\services\brain_service.py:2:Brain Service - Servicio de IA asíncrono
brain\decision_engine\triage_engine.py:136:        _Rule("cardiaco_cronico_sintoma", "naranja", 0.84,
brain\decision_engine\triage_engine.py:189:        # Cronico descompensado
brain\decision_engine\triage_engine.py:245:        _Rule("sintoma_cronico_estable", "azul", 0.18,
brain\decision_engine\triage_engine.py:246:              lambda s, d, a, c: _contains(s, "siempre tengo", "cronica", "habitual",
brain\services\appointment_scheduler_service.py:23:class AppointmentSchedulerService:
scripts\docker_safe_cleanup.sh:7:# Cron diario seguro (03:00):
scripts\install_outbox_scheduler_service.sh:5:SERVICE_FILE="${PROJECT_ROOT}/deploy/systemd/gsentinel-outbox-scheduler.service"
scripts\install_outbox_scheduler_service.sh:6:TARGET_SERVICE="/etc/systemd/system/gsentinel-outbox-scheduler.service"
scripts\install_outbox_scheduler_service.sh:15:sudo systemctl daemon-reload
scripts\install_outbox_scheduler_service.sh:16:sudo systemctl enable gsentinel-outbox-scheduler
scripts\install_outbox_scheduler_service.sh:17:sudo systemctl restart gsentinel-outbox-scheduler
scripts\install_outbox_scheduler_service.sh:18:sudo systemctl status gsentinel-outbox-scheduler --no-pager
scripts\install_outbox_scheduler_service.sh:20:echo "Outbox scheduler service installed and started."
scripts\perf_appointments_latency.py:96:    env["GOOGLE_OUTBOX_SCHEDULER_INTERVAL_SECONDS"] = str(max(1, interval_seconds))
scripts\perf_appointments_latency.py:98:    cmd = [sys.executable, str(PROJECT_ROOT / "scripts" / "run_google_outbox_scheduler.py")]
scripts\perf_appointments_latency.py:380:        recs.append("Reducir trabajo sincrono en create appointment y mover tareas no criticas al outbox/event bus.")
scripts\perf_appointments_latency.py:395:        recs.append("Separar SLO de respuesta API (sincrono) del SLO de sincronizacion Google (eventual) y monitorear ambos por separado.")
scripts\migrate_redis_external.sh:22:DEPENDENT_SERVICES="${DEPENDENT_SERVICES:-gateway brain booking_worker_0 booking_worker_1 outbox_scheduler}"
MB-Chat\cerebro_ai_med\decision\decision_engine.py:24:_BINARY_FEATURE_WATCHLIST = {
MB-Chat\cerebro_ai_med\decision\decision_engine.py:98:        """Detecta features binarias en watchlist cuyo valor exacto (0/1) puede
MB-Chat\cerebro_ai_med\decision\decision_engine.py:103:            if key in _BINARY_FEATURE_WATCHLIST and val in (0.0, 1.0):
scripts\qa_google_calendar_load.py:6:- google_outbox worker running in background
scripts\qa_google_calendar_load.py:272:def _start_worker_in_background(interval_seconds: int, batch_limit: int) -> subprocess.Popen[str]:
scripts\qa_google_calendar_load.py:274:    env["GOOGLE_OUTBOX_SCHEDULER_INTERVAL_SECONDS"] = str(max(1, interval_seconds))
scripts\qa_google_calendar_load.py:277:    cmd = [sys.executable, str(PROJECT_ROOT / "scripts" / "run_google_outbox_scheduler.py")]
scripts\qa_google_calendar_load.py:509:            worker_proc = _start_worker_in_background(worker_interval, worker_batch_limit)
scripts\qa_google_calendar_load.py:612:                "worker_background": start_worker,
api\app\services\google_calendar_service.py:213:class GoogleWatchResult:
api\app\services\google_calendar_service.py:214:    """Result for channel watch registration/stop operations."""
api\app\services\google_calendar_service.py:435:    async def start_watch_channel(self, calendar_id: Optional[str] = None) -> GoogleWatchResult:
api\app\services\google_calendar_service.py:438:            return GoogleWatchResult(success=False, message="google_calendar_disabled")
api\app\services\google_calendar_service.py:443:            return GoogleWatchResult(success=False, message="missing_webhook_callback_url")
api\app\services\google_calendar_service.py:445:            return GoogleWatchResult(success=False, message="missing_webhook_token")
api\app\services\google_calendar_service.py:457:                "ttl": str(max(60, int(settings.google_calendar_watch_ttl_seconds))),
api\app\services\google_calendar_service.py:462:            client.events().watch(calendarId=calendar_ref, body=body),
api\app\services\google_calendar_service.py:463:            operation="watch_start",
api\app\services\google_calendar_service.py:473:            return GoogleWatchResult(success=False, message="missing_resource_id")
api\app\services\google_calendar_service.py:487:        return GoogleWatchResult(
api\app\services\google_calendar_service.py:494:    async def stop_watch_channel(self, channel_id: str) -> GoogleWatchResult:
api\app\services\google_calendar_service.py:495:        """Stop Google watch channel and mark local record inactive."""
api\app\services\google_calendar_service.py:500:            return GoogleWatchResult(success=False, message="channel_not_found")
api\app\services\google_calendar_service.py:510:                operation="watch_stop",
api\app\services\google_calendar_service.py:515:                "google_watch_stop_failed",
api\app\services\google_calendar_service.py:521:        return GoogleWatchResult(success=True, channel_id=channel_id, resource_id=cast(str, channel.resource_id))
MB-Chat\data\synthetic_dataset\incidents.json:2671:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:2716:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:2763:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:2811:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:2855:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:2897:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:2946:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:2990:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3039:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3088:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3126:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3176:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3226:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3273:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3321:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3368:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3413:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3458:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3506:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3549:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3589:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3639:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3688:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3732:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3776:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3814:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3863:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3906:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3953:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:3997:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4047:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4093:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4138:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4185:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4235:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4278:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4326:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4372:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4417:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4466:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4507:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4554:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4600:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4647:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4692:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4737:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4783:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4827:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4872:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4913:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:4962:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5010:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5058:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5106:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5157:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5204:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5248:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5295:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5346:      "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\incidents.json:5392:      "source": "worker_scheduler",
scripts\qa_detect_booking_deadlocks.py:150:    thread_a = threading.Thread(target=_lock_sequence, args=("A", dsn, order_a, barrier, results), daemon=True)
scripts\qa_detect_booking_deadlocks.py:151:    thread_b = threading.Thread(target=_lock_sequence, args=("B", dsn, order_b, barrier, results), daemon=True)
MB-Chat\data\synthetic_dataset\audit.json:544:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:553:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:562:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:571:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:580:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:589:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:598:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:607:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:616:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:625:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:634:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:643:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:652:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:661:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:670:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:679:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:688:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:697:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:706:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:715:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:724:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:733:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:742:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:751:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:760:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:769:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:778:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:787:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:796:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:805:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:814:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:823:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:832:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:841:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:850:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:859:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:868:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:877:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:886:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:895:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:904:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:913:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:922:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:931:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:940:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:949:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:958:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:967:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:976:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:985:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:994:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1003:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1012:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1021:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1030:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1039:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1048:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1057:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1066:    "source": "worker_scheduler",
MB-Chat\data\synthetic_dataset\audit.json:1075:    "source": "worker_scheduler",
api\app\services\booking_queue_service.py:19:    """Encola reservas y permite consultar resultados asincronos."""
api\app\schemas\appointment_schema.py:112:        description="Estado de sincronizacion Google Calendar: pending | synced | failed"
MB-Secretaria\src\import-preview\schedule-import-preview.service.ts:11:  NormalizedScheduleRow,
MB-Secretaria\src\import-preview\schedule-import-preview.service.ts:91:    const normalized: Partial<NormalizedScheduleRow> = {
MB-Secretaria\src\import-preview\schedule-import-preview.service.ts:211:    const normalized = row.normalized as NormalizedScheduleRow;
scripts\run_google_outbox_scheduler.py:20:async def run_scheduler(interval_seconds: int, batch_limit: int) -> None:
scripts\run_google_outbox_scheduler.py:25:            print(f"Google outbox scheduler error: {exc}")
scripts\run_google_outbox_scheduler.py:41:    interval = int(os.getenv("GOOGLE_OUTBOX_SCHEDULER_INTERVAL_SECONDS", os.getenv("OUTBOX_SCHEDULER_INTERVAL_SECONDS", "15")))
scripts\run_google_outbox_scheduler.py:45:    asyncio.run(run_scheduler(interval_seconds=max(1, interval), batch_limit=max(1, limit)))
MB-Secretaria\src\import-preview\import-preview.types.ts:18:export interface NormalizedScheduleRow {
MB-Secretaria\src\import-preview\import-preview.types.ts:40:  normalized: Partial<NormalizedScheduleRow>;
MB-Chat\data\medical-chat-learning.jsonl:48:{"id":"doctor-chat-1779039216153","recordedAt":"2026-05-17T17:33:36.153Z","source":"doctor_chat_frontend","doctorId":"lab-doctor","conversationId":"doctor:lab-doctor:patient:general:appointment:none:chat:d24e357c-baef-47b1-9750-6b6f80ff4108","patientId":null,"appointmentId":null,"userMessage":"GSentinelHealth OS — CONSOLA DE INTERACCIÓN CLÍNICAMódulo: Protocolos de Comunicación | Fase: Transferencia Crítica a UCIEl sistema asume la confirmación y activa el protocolo de comunicación automatizada. Al transferir a un paciente en estado crítico (Cirrosis + PBE + Lesión Renal Aguda), el mayor riesgo es la pérdida de información en el cambio de turno.Para evitarlo, GSentinelHealth OS genera dos formatos de comunicación simultáneos basados en estándares internacionales:📱 1. Alerta Push de Alta Prioridad (Para Médicos/Enfermeros de la UCI)Esta notificación se envía directamente a los dispositivos móviles del equipo receptor antes de que el paciente cruce las puertas de la unidad.🚨 ALERTA CRÍTICA: Ingreso Inminente UCI (Cama 4)Paciente: Masculino, 58 años.Diagnóstico: PBE confirmada (310 PMN/mm³) + Encefalopatía Hepática Grado II.Riesgo Mayor: Lesión Renal Aguda (Creatinina 1.8 mg/dL).Medicación en curso: Ceftriaxona 2g IV (Día 1) + Infusión de Albúmina Humana 20%.⚠️ Restricción estricta: Bloqueo de AINEs y Contraste Yodado. Monitorear gasto urinario por hora.📋 2. Reporte de Transferencia Estandarizado (Formato SBAR)Este documento se adjunta automáticamente a la Historia Clínica Electrónica para el pase de guardia formal entre los médicos de urgencias y terapia.S (Situation / Situación): Varón de 58 años con cirrosis hepática descompensada por Peritonitis Bacteriana Espontánea y encefalopatía secundaria, cursando con falla renal aguda.B (Background / Antecedentes): Cirrosis de origen etílico. Ingresó por fiebre (38.8°C), dolor abdominal y delirio hipoactivo.A (Assessment / Evaluación actual): Signos vitales estables tras inicio de tratamiento. Temperatura actual 37.5°C. Neurológicamente cooperador pero fluctuante. Líquido asfítico patológico (310 PMN). Creatinina limítrofe en 1.8 mg/dL con diuresis de 30 ml/h (vigilar progresión a Síndrome Hepatorrenal).R (Recommendation / Recomendación):Mantener Ceftriaxona 2g IV cada 24h.Completar esquema de Albúmina (1.5g/kg","assistantResponse":"Fecha y hora en tiempo real:\nFecha: domingo, 17/05/2026\nHora: 14:33:36\nZona horaria: America/Argentina/Buenos_Aires"}
scripts\run_google_reconciliation_scheduler.py:2:"""Periodic scheduler for Google Calendar reconciliation."""
scripts\run_google_reconciliation_scheduler.py:27:async def run_scheduler(interval_seconds: int, hours: int, limit: int) -> None:
scripts\run_google_reconciliation_scheduler.py:32:            print(f"Google reconciliation scheduler error: {exc}")
scripts\run_google_reconciliation_scheduler.py:47:        run_scheduler(
MB-Chat\data\audit.json:544:    "source": "worker_scheduler",
MB-Chat\data\audit.json:553:    "source": "worker_scheduler",
MB-Chat\data\audit.json:562:    "source": "worker_scheduler",
MB-Chat\data\audit.json:571:    "source": "worker_scheduler",
MB-Chat\data\audit.json:580:    "source": "worker_scheduler",
MB-Chat\data\audit.json:589:    "source": "worker_scheduler",
MB-Chat\data\audit.json:598:    "source": "worker_scheduler",
MB-Chat\data\audit.json:607:    "source": "worker_scheduler",
MB-Chat\data\audit.json:616:    "source": "worker_scheduler",
MB-Chat\data\audit.json:625:    "source": "worker_scheduler",
MB-Chat\data\audit.json:634:    "source": "worker_scheduler",
MB-Chat\data\audit.json:643:    "source": "worker_scheduler",
MB-Chat\data\audit.json:652:    "source": "worker_scheduler",
MB-Chat\data\audit.json:661:    "source": "worker_scheduler",
MB-Chat\data\audit.json:670:    "source": "worker_scheduler",
MB-Chat\data\audit.json:679:    "source": "worker_scheduler",
MB-Chat\data\audit.json:688:    "source": "worker_scheduler",
MB-Chat\data\audit.json:697:    "source": "worker_scheduler",
MB-Chat\data\audit.json:706:    "source": "worker_scheduler",
MB-Chat\data\audit.json:715:    "source": "worker_scheduler",
MB-Chat\data\audit.json:724:    "source": "worker_scheduler",
MB-Chat\data\audit.json:733:    "source": "worker_scheduler",
MB-Chat\data\audit.json:742:    "source": "worker_scheduler",
MB-Chat\data\audit.json:751:    "source": "worker_scheduler",
MB-Chat\data\audit.json:760:    "source": "worker_scheduler",
MB-Chat\data\audit.json:769:    "source": "worker_scheduler",
MB-Chat\data\audit.json:778:    "source": "worker_scheduler",
MB-Chat\data\audit.json:787:    "source": "worker_scheduler",
MB-Chat\data\audit.json:796:    "source": "worker_scheduler",
MB-Chat\data\audit.json:805:    "source": "worker_scheduler",
MB-Chat\data\audit.json:814:    "source": "worker_scheduler",
MB-Chat\data\audit.json:823:    "source": "worker_scheduler",
MB-Chat\data\audit.json:832:    "source": "worker_scheduler",
MB-Chat\data\audit.json:841:    "source": "worker_scheduler",
MB-Chat\data\audit.json:850:    "source": "worker_scheduler",
MB-Chat\data\audit.json:859:    "source": "worker_scheduler",
MB-Chat\data\audit.json:868:    "source": "worker_scheduler",
MB-Chat\data\audit.json:877:    "source": "worker_scheduler",
MB-Chat\data\audit.json:886:    "source": "worker_scheduler",
MB-Chat\data\audit.json:895:    "source": "worker_scheduler",
MB-Chat\data\audit.json:904:    "source": "worker_scheduler",
MB-Chat\data\audit.json:913:    "source": "worker_scheduler",
MB-Chat\data\audit.json:922:    "source": "worker_scheduler",
MB-Chat\data\audit.json:931:    "source": "worker_scheduler",
MB-Chat\data\audit.json:940:    "source": "worker_scheduler",
MB-Chat\data\audit.json:949:    "source": "worker_scheduler",
MB-Chat\data\audit.json:958:    "source": "worker_scheduler",
MB-Chat\data\audit.json:967:    "source": "worker_scheduler",
MB-Chat\data\audit.json:976:    "source": "worker_scheduler",
MB-Chat\data\audit.json:985:    "source": "worker_scheduler",
MB-Chat\data\audit.json:994:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1003:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1012:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1021:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1030:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1039:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1048:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1057:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1066:    "source": "worker_scheduler",
MB-Chat\data\audit.json:1075:    "source": "worker_scheduler",
scripts\run_outbox_scheduler.py:21:async def run_scheduler(interval_seconds: int, batch_limit: int) -> None:
scripts\run_outbox_scheduler.py:26:            print(f"Outbox scheduler error: {exc}")
scripts\run_outbox_scheduler.py:42:    interval = int(os.getenv("OUTBOX_SCHEDULER_INTERVAL_SECONDS", "15"))
scripts\run_outbox_scheduler.py:46:    asyncio.run(run_scheduler(interval_seconds=max(1, interval), batch_limit=max(1, limit)))
MB-Chat\data\incidents.json:2671:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:2716:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:2763:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:2811:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:2855:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:2897:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:2946:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:2990:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3039:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3088:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3126:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3176:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3226:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3273:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3321:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3368:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3413:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3458:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3506:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3549:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3589:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3639:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3688:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3732:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3776:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3814:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3863:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3906:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3953:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:3997:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4047:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4093:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4138:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4185:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4235:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4278:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4326:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4372:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4417:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4466:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4507:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4554:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4600:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4647:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4692:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4737:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4783:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4827:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4872:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4913:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:4962:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5010:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5058:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5106:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5157:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5204:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5248:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5295:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5346:      "source": "worker_scheduler",
MB-Chat\data\incidents.json:5392:      "source": "worker_scheduler",
api\app\models\models.py:296:    """Canal de watch para webhooks de Google Calendar."""
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:60:│ @Cron(EVERY_5_MINUTES)                                         │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:216:// @Cron(EVERY_5_MINUTES)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:221:@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:12:@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:177:    - cron: '0 1 * * *'  # Daily after training
MB-Chat\docs\ML_DECISION_SUMMARY.md:27:(Opcionalmente) Cron daily a medianoche → retrainModel() Python scripts
MB-Chat\docs\ML_DECISION_SUMMARY.md:37:| `retrainModel()` | N/A (Cron) | Promise | Evento automático cada medianoche |
MB-Chat\docs\ML_DECISION_SUMMARY.md:344:retrainModel() @Cron(EVERY_DAY_AT_MIDNIGHT)
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:171:# Watch for NEW log patterns
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:195:# Verify cron job runs daily at midnight
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:197:@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:203:# Watch for escalations (score < 0.70)
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:12:- Entrenar modelo ML diariamente (cron job)
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:28:└── Cron: retrainModel() cada medianoche
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:68:#### `retrainModel() @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:616:| `retrainModel()` | `@Cron() → Promise` | Entrena ONNX diariamente |
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:391:5. **Monitoring:** Model quality degrades—continuous watch needed
MB-Whatsapp\package.json:8:    "start:dev": "nest start --watch",
MB-Whatsapp\package.json:11:    "test:watch": "jest --config jest.config.ts --watch",
MB-Whatsapp\README.md:10:- **Event-Driven**: Procesamiento asíncrono con Kafka/RabbitMQ.
MB-Whatsapp\README.md:385:# Sucede diariamente a medianoche (cron job)
api\app\dependencies\db.py:11:    Dependencia para obtener una sesión de DB asíncrona.
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:60:│ @Cron(EVERY_5_MINUTES)                                         │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:216:// @Cron(EVERY_5_MINUTES)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:221:@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:12:@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:177:    - cron: '0 1 * * *'  # Daily after training
MB-Whatsapp\cerebro_ai_med\decision\decision_engine.py:24:_BINARY_FEATURE_WATCHLIST = {
MB-Whatsapp\cerebro_ai_med\decision\decision_engine.py:98:        """Detecta features binarias en watchlist cuyo valor exacto (0/1) puede
MB-Whatsapp\cerebro_ai_med\decision\decision_engine.py:103:            if key in _BINARY_FEATURE_WATCHLIST and val in (0.0, 1.0):
MB-Whatsapp\docs\ML_DECISION_SUMMARY.md:27:(Opcionalmente) Cron daily a medianoche → retrainModel() Python scripts
MB-Whatsapp\docs\ML_DECISION_SUMMARY.md:37:| `retrainModel()` | N/A (Cron) | Promise | Evento automático cada medianoche |
MB-Whatsapp\docs\ML_DECISION_SUMMARY.md:344:retrainModel() @Cron(EVERY_DAY_AT_MIDNIGHT)
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:171:# Watch for NEW log patterns
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:195:# Verify cron job runs daily at midnight
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:197:@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:203:# Watch for escalations (score < 0.70)
MB-Whatsapp\src\ml\online-learning.service.ts:2:import { Cron, CronExpression } from '@nestjs/schedule';
MB-Whatsapp\src\ml\online-learning.service.ts:39:  @Cron(CronExpression.EVERY_5_MINUTES)
api\app\core\config.py:105:    google_calendar_watch_ttl_seconds: int = Field(default=86400, alias="GOOGLE_CALENDAR_WATCH_TTL_SECONDS")
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:391:5. **Monitoring:** Model quality degrades—continuous watch needed
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:12:- Entrenar modelo ML diariamente (cron job)
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:28:└── Cron: retrainModel() cada medianoche
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:68:#### `retrainModel() @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:616:| `retrainModel()` | `@Cron() → Promise` | Entrena ONNX diariamente |
MB-Whatsapp\data\audit.json:544:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:553:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:562:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:571:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:580:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:589:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:598:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:607:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:616:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:625:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:634:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:643:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:652:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:661:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:670:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:679:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:688:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:697:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:706:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:715:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:724:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:733:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:742:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:751:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:760:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:769:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:778:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:787:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:796:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:805:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:814:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:823:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:832:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:841:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:850:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:859:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:868:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:877:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:886:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:895:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:904:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:913:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:922:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:931:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:940:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:949:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:958:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:967:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:976:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:985:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:994:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1003:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1012:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1021:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1030:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1039:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1048:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1057:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1066:    "source": "worker_scheduler",
MB-Whatsapp\data\audit.json:1075:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2671:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2716:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2763:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2811:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2855:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2897:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2946:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:2990:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3039:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3088:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3126:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3176:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3226:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3273:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3321:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3368:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3413:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3458:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3506:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3549:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3589:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3639:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3688:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3732:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3776:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3814:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3863:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3906:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3953:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:3997:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4047:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4093:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4138:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4185:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4235:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4278:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4326:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4372:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4417:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4466:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4507:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4554:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4600:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4647:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4692:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4737:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4783:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4827:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4872:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4913:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:4962:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5010:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5058:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5106:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5157:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5204:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5248:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5295:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5346:      "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\incidents.json:5392:      "source": "worker_scheduler",
MB-Whatsapp\src\learning\learning.service.ts:15:import { Cron, CronExpression } from '@nestjs/schedule';
MB-Whatsapp\src\learning\learning.service.ts:128:  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Secretaria\package.json:8:    "start:dev": "nest start --watch",
MB-Secretaria\package.json:11:    "test:watch": "jest --config jest.config.ts --watch",
MB-Whatsapp\data\synthetic_dataset\audit.json:544:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:553:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:562:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:571:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:580:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:589:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:598:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:607:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:616:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:625:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:634:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:643:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:652:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:661:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:670:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:679:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:688:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:697:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:706:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:715:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:724:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:733:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:742:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:751:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:760:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:769:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:778:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:787:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:796:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:805:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:814:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:823:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:832:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:841:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:850:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:859:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:868:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:877:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:886:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:895:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:904:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:913:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:922:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:931:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:940:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:949:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:958:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:967:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:976:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:985:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:994:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1003:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1012:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1021:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1030:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1039:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1048:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1057:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1066:    "source": "worker_scheduler",
MB-Whatsapp\data\synthetic_dataset\audit.json:1075:    "source": "worker_scheduler",
api\app\api\v1\endpoints\webhooks_google_calendar.py:20:class GoogleWatchStartRequest(BaseModel):
api\app\api\v1\endpoints\webhooks_google_calendar.py:24:class GoogleWatchStartResponse(BaseModel):
api\app\api\v1\endpoints\webhooks_google_calendar.py:32:class GoogleWatchStopResponse(BaseModel):
api\app\api\v1\endpoints\webhooks_google_calendar.py:38:@router.post("/watch/start", response_model=GoogleWatchStartResponse, status_code=status.HTTP_200_OK)
api\app\api\v1\endpoints\webhooks_google_calendar.py:39:async def start_google_calendar_watch(
api\app\api\v1\endpoints\webhooks_google_calendar.py:40:    request: GoogleWatchStartRequest,
api\app\api\v1\endpoints\webhooks_google_calendar.py:43:) -> GoogleWatchStartResponse:
api\app\api\v1\endpoints\webhooks_google_calendar.py:45:    result = await service.start_watch_channel(calendar_id=request.calendar_id)
api\app\api\v1\endpoints\webhooks_google_calendar.py:47:        raise HTTPException(status_code=400, detail=result.message or "watch_start_failed")
api\app\api\v1\endpoints\webhooks_google_calendar.py:49:    return GoogleWatchStartResponse(
api\app\api\v1\endpoints\webhooks_google_calendar.py:58:@router.post("/watch/stop/{channel_id}", response_model=GoogleWatchStopResponse, status_code=status.HTTP_200_OK)
api\app\api\v1\endpoints\webhooks_google_calendar.py:59:async def stop_google_calendar_watch(
api\app\api\v1\endpoints\webhooks_google_calendar.py:63:) -> GoogleWatchStopResponse:
api\app\api\v1\endpoints\webhooks_google_calendar.py:65:    result = await service.stop_watch_channel(channel_id)
api\app\api\v1\endpoints\webhooks_google_calendar.py:67:        raise HTTPException(status_code=404, detail=result.message or "watch_channel_not_found")
api\app\api\v1\endpoints\webhooks_google_calendar.py:69:    return GoogleWatchStopResponse(success=True, channel_id=result.channel_id, message=result.message)
MB-Whatsapp\metabrain\observability\redis_monitor.py:18:    await monitor.start()                 # starts background recovery loop
MB-Whatsapp\metabrain\observability\redis_monitor.py:111:        """Start background recovery loop."""
MB-Whatsapp\metabrain\observability\redis_monitor.py:117:        """Stop the background recovery loop and close the Redis client."""
MB-Whatsapp\metabrain\observability\redis_monitor.py:243:    # ── Background recovery loop ──────────────────────────────────────────────
MB-Whatsapp\data\incidents.json:2671:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:2716:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:2763:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:2811:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:2855:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:2897:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:2946:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:2990:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3039:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3088:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3126:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3176:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3226:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3273:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3321:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3368:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3413:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3458:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3506:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3549:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3589:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3639:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3688:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3732:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3776:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3814:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3863:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3906:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3953:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:3997:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4047:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4093:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4138:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4185:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4235:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4278:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4326:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4372:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4417:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4466:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4507:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4554:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4600:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4647:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4692:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4737:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4783:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4827:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4872:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4913:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:4962:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5010:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5058:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5106:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5157:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5204:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5248:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5295:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5346:      "source": "worker_scheduler",
MB-Whatsapp\data\incidents.json:5392:      "source": "worker_scheduler",
MB-Whatsapp\metabrain\observability\alerts.py:122:        Call this periodically (e.g., from a background task or health endpoint)
MB-Whatsapp\models\onnx_metadata.json:104:      "worker_scheduler": 3
api\app\api\v1\endpoints\appointments.py.bak.BLOQUE_B_20260516_130931:100:    summary="Enqueue de reserva de cita (procesamiento asincrono)",
MB-Whatsapp\models\v13\onnx_metadata.json:104:      "worker_scheduler": 3
api\app\api\v1\endpoints\appointments.py:100:    summary="Enqueue de reserva de cita (procesamiento asincrono)",
MB-Whatsapp\models\v15\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Whatsapp\models\v12\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Whatsapp\models\v11\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Whatsapp\models\v10\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Whatsapp\models\v14\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\README.md:10:- **Event-Driven**: Procesamiento asíncrono con Kafka/RabbitMQ.
MB-Chat\README.md:385:# Sucede diariamente a medianoche (cron job)
MB-Chat\package.json:8:    "start:dev": "nest start --watch",
MB-Chat\package.json:11:    "test:watch": "jest --config jest.config.ts --watch",
MB-Whatsapp\src\execution\execution-denied-status.spec.ts:64:      { suggestEnhancement: jest.fn().mockResolvedValue('watch database') } as unknown as AiService,
MB-Whatsapp\src\events\rabbit\rabbit-bus.service.ts:132:        this.scheduleReconnect();
MB-Whatsapp\src\events\rabbit\rabbit-bus.service.ts:146:      this.scheduleReconnect();
MB-Whatsapp\src\events\rabbit\rabbit-bus.service.ts:150:  private scheduleReconnect(): void {
MB-Chat\models\v12\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\src\common\utils\error-parser.util.spec.ts:9:      source: 'scheduler',
MB-Chat\models\v11\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\metabrain\observability\redis_monitor.py:18:    await monitor.start()                 # starts background recovery loop
MB-Chat\metabrain\observability\redis_monitor.py:111:        """Start background recovery loop."""
MB-Chat\metabrain\observability\redis_monitor.py:117:        """Stop the background recovery loop and close the Redis client."""
MB-Chat\metabrain\observability\redis_monitor.py:243:    # ── Background recovery loop ──────────────────────────────────────────────
MB-Chat\models\v10\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\metabrain\observability\alerts.py:122:        Call this periodically (e.g., from a background task or health endpoint)
MB-Whatsapp\src\common\utils\error-parser.util.spec.ts:9:      source: 'scheduler',
MB-Chat\src\execution\execution-denied-status.spec.ts:64:      { suggestEnhancement: jest.fn().mockResolvedValue('watch database') } as unknown as AiService,
MB-Chat\models\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\models\v15\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\src\events\rabbit\rabbit-bus.service.ts:132:        this.scheduleReconnect();
MB-Chat\src\events\rabbit\rabbit-bus.service.ts:146:      this.scheduleReconnect();
MB-Chat\src\events\rabbit\rabbit-bus.service.ts:150:  private scheduleReconnect(): void {
MB-Chat\models\v14\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\models\v13\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\scripts\generate_synthetic_data.py:38:        source="worker_scheduler",
MB-Chat\src\ml\online-learning.service.ts:2:import { Cron, CronExpression } from '@nestjs/schedule';
MB-Chat\src\ml\online-learning.service.ts:39:  @Cron(CronExpression.EVERY_5_MINUTES)
MB-Secretaria\models\v15\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\src\learning\learning.service.ts:15:import { Cron, CronExpression } from '@nestjs/schedule';
MB-Chat\src\learning\learning.service.ts:128:  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
MB-Secretaria\models\v14\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Chat\src\medical-assistant\medical-assistant.service.ts:316:      const reminderResult = await this.tryScheduleReminderIfRequested(input, effectiveQuery, requestId, effectiveSessionId);
MB-Chat\src\medical-assistant\medical-assistant.service.ts:706:  private async tryScheduleReminderIfRequested(
MB-Chat\src\medical-assistant\medical-assistant.service.ts:789:      'B (Background): Ingreso por fiebre, dolor abdominal y alteracion del estado mental sobre hepatopatia cronica.',
MB-Secretaria\models\v13\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Secretaria\models\v12\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Secretaria\models\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Whatsapp\scripts\generate_synthetic_data.py:38:        source="worker_scheduler",
MB-Secretaria\data\audit.json:544:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:553:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:562:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:571:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:580:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:589:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:598:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:607:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:616:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:625:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:634:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:643:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:652:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:661:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:670:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:679:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:688:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:697:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:706:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:715:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:724:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:733:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:742:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:751:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:760:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:769:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:778:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:787:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:796:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:805:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:814:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:823:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:832:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:841:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:850:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:859:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:868:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:877:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:886:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:895:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:904:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:913:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:922:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:931:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:940:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:949:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:958:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:967:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:976:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:985:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:994:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1003:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1012:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1021:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1030:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1039:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1048:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1057:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1066:    "source": "worker_scheduler",
MB-Secretaria\data\audit.json:1075:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:544:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:553:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:562:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:571:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:580:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:589:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:598:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:607:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:616:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:625:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:634:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:643:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:652:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:661:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:670:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:679:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:688:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:697:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:706:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:715:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:724:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:733:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:742:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:751:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:760:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:769:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:778:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:787:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:796:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:805:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:814:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:823:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:832:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:841:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:850:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:859:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:868:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:877:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:886:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:895:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:904:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:913:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:922:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:931:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:940:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:949:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:958:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:967:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:976:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:985:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:994:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1003:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1012:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1021:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1030:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1039:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1048:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1057:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1066:    "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\audit.json:1075:    "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2671:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2716:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2763:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2811:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2855:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2897:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2946:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:2990:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3039:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3088:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3126:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3176:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3226:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3273:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3321:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3368:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3413:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3458:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3506:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3549:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3589:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3639:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3688:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3732:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3776:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3814:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3863:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3906:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3953:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:3997:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4047:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4093:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4138:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4185:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4235:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4278:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4326:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4372:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4417:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4466:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4507:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4554:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4600:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4647:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4692:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4737:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4783:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4827:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4872:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4913:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:4962:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5010:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5058:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5106:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5157:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5204:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5248:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5295:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5346:      "source": "worker_scheduler",
MB-Secretaria\data\incidents.json:5392:      "source": "worker_scheduler",
MB-Secretaria\models\v10\onnx_metadata.json:104:      "worker_scheduler": 3
MB-Secretaria\data\synthetic_dataset\incidents.json:2671:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:2716:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:2763:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:2811:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:2855:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:2897:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:2946:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:2990:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3039:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3088:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3126:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3176:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3226:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3273:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3321:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3368:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3413:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3458:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3506:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3549:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3589:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3639:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3688:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3732:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3776:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3814:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3863:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3906:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3953:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:3997:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4047:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4093:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4138:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4185:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4235:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4278:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4326:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4372:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4417:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4466:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4507:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4554:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4600:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4647:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4692:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4737:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4783:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4827:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4872:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4913:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:4962:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5010:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5058:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5106:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5157:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5204:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5248:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5295:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5346:      "source": "worker_scheduler",
MB-Secretaria\data\synthetic_dataset\incidents.json:5392:      "source": "worker_scheduler",
MB-Secretaria\models\v11\onnx_metadata.json:104:      "worker_scheduler": 3

```
