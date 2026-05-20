# ML RUNTIME ISOLATION REPORT
Generated: 2026-05-19 00:14:30 -03:00
Mode: PLAN ONLY (no apply)

Target root: E:\GSentinelRuntime\ml
Subdirs: checkpoints, datasets, embeddings, vectorstore, inference-cache, training-cache

## ML related code/artifact references
```
docker-compose.yml:333:      MEDICAL_CHAT_LEARNING_PATH: /app/artifacts/mb-chat-learning/medical-chat-learning.jsonl
docker-compose.yml:341:      - ./MB-Chat/data:/app/artifacts/mb-chat-learning
docker-compose.yml:462:      MEDICAL_CHAT_LEARNING_PATH: /app/artifacts/mb-chat-learning/medical-chat-learning.jsonl
docker-compose.yml:469:      - ./MB-Chat/data:/app/artifacts/mb-chat-learning
scripts\k6_slot_booking_load.js:13:const SUMMARY_PATH = __ENV.K6_SUMMARY_JSON || "artifacts/qa/k6_slot_booking_summary.json";
scripts\qa_postgres_slot_buffer_incremental.py:51:        default="artifacts/qa",
MB-Secretaria\models\anomaly_model_metadata.json:93:  "training_stats": {
MB-Secretaria\models\anomaly_model_metadata.json:97:    "train_normal_sequences": 181,
MB-Secretaria\models\anomaly_model_metadata.json:100:    "train_error_mean": 0.10589775443077087,
MB-Secretaria\models\anomaly_model_metadata.json:101:    "train_error_p95": 0.16205891966819763,
scripts\analyze_k6_summary.py:5:    python scripts/analyze_k6_summary.py artifacts/qa/k6_slot_booking_summary.json
scripts\migration_step_by_step.sh:112:    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, start_time),
scripts\migration_step_by_step.sh:113:    CONSTRAINT fk_slots_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
scripts\migration_step_by_step.sh:114:    CONSTRAINT ck_start_before_end CHECK (start_time < end_time)
scripts\migration_step_by_step.sh:188:    CONSTRAINT uq_appointment_per_slot UNIQUE (slot_id),
scripts\migration_step_by_step.sh:189:    CONSTRAINT fk_appt_new_slot FOREIGN KEY (slot_id) REFERENCES time_slots(id) ON DELETE RESTRICT,
scripts\migration_step_by_step.sh:190:    CONSTRAINT fk_appt_new_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
MB-Secretaria\models\feature_importance_summary.txt:24:Generated Datasets:
MB-Secretaria\models\feature_importance_summary.txt:25:  ✓ X_train_optimized.csv (37 features)
MB-Secretaria\models\feature_importance_summary.txt:26:  ✓ X_train_top80_importance.csv (31 features)
MB-Secretaria\models\onnx_parity_report.json:5:  "onnx_total_ms": 0.7264000014401972,
MB-Secretaria\models\onnx_parity_report.json:6:  "onnx_latency_per_sample_ms": 0.020177777817783255,
MB-Secretaria\models\monitoring\latest_health_check.json:5:    "train_accuracy": 1.0,
MB-Secretaria\models\monitoring\latest_health_check.json:6:    "train_precision": 1.0,
MB-Secretaria\models\monitoring\latest_health_check.json:7:    "train_recall": 1.0,
MB-Secretaria\models\monitoring\latest_health_check.json:8:    "train_f1": 1.0,
MB-Secretaria\models\monitoring\latest_health_check.json:17:    "num_train_samples": 1,
MB-Secretaria\models\monitoring\latest_health_check.json:23:    "num_train_samples": 500,
MB-Secretaria\models\monitoring\latest_health_check.json:25:    "train_accuracy": 0.97
MB-Secretaria\models\model_metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\model_metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\model_metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\model_metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\model_metrics.json:75:  "num_train_samples": 168,
MB-Secretaria\models\registry.json:6:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:8:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:13:      "num_train_samples": 1,
MB-Secretaria\models\registry.json:17:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:22:      "train_accuracy": 0.9,
MB-Secretaria\models\registry.json:24:      "train_f1": 0.89,
MB-Secretaria\models\registry.json:29:      "num_train_samples": 400,
MB-Secretaria\models\registry.json:33:      "notes": "Initial training - 400 samples"
MB-Secretaria\models\registry.json:38:      "train_accuracy": 0.95,
MB-Secretaria\models\registry.json:40:      "train_f1": 0.94,
MB-Secretaria\models\registry.json:45:      "num_train_samples": 500,
MB-Secretaria\models\registry.json:54:      "train_accuracy": 0.87,
MB-Secretaria\models\registry.json:56:      "train_f1": 0.86,
MB-Secretaria\models\registry.json:61:      "num_train_samples": 500,
MB-Secretaria\models\registry.json:70:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:72:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:77:      "num_train_samples": 1,
MB-Secretaria\models\registry.json:81:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:86:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:88:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:93:      "num_train_samples": 1,
MB-Secretaria\models\registry.json:97:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:102:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:104:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:109:      "num_train_samples": 1,
MB-Secretaria\models\registry.json:113:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:118:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:120:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:125:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:129:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:134:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:136:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:141:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:145:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:150:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:152:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:157:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:161:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:166:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:168:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:173:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:182:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:187:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:189:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:194:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:203:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:208:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:210:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:215:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:224:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:229:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:231:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:236:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:245:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:250:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:252:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:257:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:266:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:271:      "train_accuracy": 1.0,
MB-Secretaria\models\registry.json:273:      "train_f1": 1.0,
MB-Secretaria\models\registry.json:278:      "num_train_samples": 168,
MB-Secretaria\models\registry.json:287:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:297:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:303:      "notes": "Initial training - 400 samples"
MB-Secretaria\models\registry.json:339:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:345:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:351:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:357:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:363:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:369:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:375:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:381:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:387:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:393:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:399:      "notes": "Automatic training with validation"
MB-Secretaria\models\registry.json:405:      "notes": "Automatic training with validation"
MB-Secretaria\models\v9\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v9\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v9\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v9\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v9\metrics.json:31:  "num_train_samples": 168,
api\app\services\notification_service.py:12:    CircuitBreakerRegistry,
api\app\services\notification_service.py:21:_WHATSAPP_BREAKER = CircuitBreakerRegistry.get(
MB-Secretaria\models\v4\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v4\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v4\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v4\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v4\metrics.json:19:  "num_train_samples": 1,
api\app\services\google_calendar_service.py:29:from shared.utils.resilience import AsyncRateLimiter, CircuitBreakerConfig, CircuitBreakerRegistry, retry_async
api\app\services\google_calendar_service.py:171:_GOOGLE_BREAKER = CircuitBreakerRegistry.get(
MB-Secretaria\models\v8\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v8\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v8\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v8\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v8\metrics.json:31:  "num_train_samples": 168,
MB-Secretaria\models\v15\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v15\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v15\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v15\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v15\metrics.json:75:  "num_train_samples": 168,
MB-Secretaria\models\v7\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v7\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v7\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v7\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v7\metrics.json:31:  "num_train_samples": 168,
MB-Secretaria\models\v14\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v14\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v14\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v14\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v14\metrics.json:75:  "num_train_samples": 168,
MB-Secretaria\models\v6\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v6\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v6\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v6\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v6\metrics.json:31:  "num_train_samples": 1,
MB-Secretaria\models\v5\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v5\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v5\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v5\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v5\metrics.json:27:  "num_train_samples": 1,
api\app\models\user.py:8:from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Enum, ForeignKey, String, UniqueConstraint
api\app\models\user.py:57:        UniqueConstraint("clinic_id", "user_id", name="uq_clinic_members_clinic_user"),
api\app\models\user.py:58:        CheckConstraint(
MB-Secretaria\models\v13\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v13\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v13\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v13\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v13\metrics.json:75:  "num_train_samples": 168,
api\app\models\time_slot_simple.py:14:    UniqueConstraint, Index, func, CheckConstraint
api\app\models\time_slot_simple.py:29:    CONSTRAINT: UNIQUE(doctor_id, start_time) 
api\app\models\time_slot_simple.py:50:    # Table constraints
api\app\models\time_slot_simple.py:53:        UniqueConstraint("doctor_id", "start_time", name="uq_doctor_slot"),
api\app\models\time_slot_simple.py:58:        CheckConstraint("start_time < end_time", name="ck_start_before_end"),
api\app\models\time_slot_simple.py:59:        CheckConstraint(
api\app\models\time_slot_simple.py:112:        CheckConstraint("buffer_minutes >= 0 AND buffer_minutes <= 120", name="ck_buffer_minutes_range"),
api\app\models\time_slot_simple.py:131:    # The critical constraint: UNIQUE slot_id
api\app\models\time_slot_simple.py:132:    # This SINGLE constraint prevents ALL double-booking issues
api\app\models\time_slot_simple.py:152:    # Table constraints
api\app\models\time_slot_simple.py:158:        CheckConstraint("priority IN ('normal', 'urgent')", name="ck_appointment_priority_valid"),
api\app\models\time_slot_simple.py:159:        CheckConstraint(
api\app\models\time_slot_simple.py:187:        UniqueConstraint("source_slot_id", "blocked_slot_id", name="uq_slot_buffer_block_pair"),
api\app\models\time_slot_simple.py:188:        CheckConstraint("source_slot_id <> blocked_slot_id", name="ck_slot_buffer_block_not_self"),
api\app\models\time_slot_simple.py:244:        CheckConstraint("urgent_sla_target_minutes > 0 AND urgent_sla_target_minutes <= 720", name="ck_urgent_sla_target_range"),
api\app\models\time_slot_simple.py:262:        CheckConstraint("type IN ('doctor', 'room', 'equipment')", name="ck_resource_type_valid"),
api\app\models\time_slot_simple.py:263:        UniqueConstraint("type", "external_ref", name="uq_resource_type_external_ref"),
api\app\models\time_slot_simple.py:284:        UniqueConstraint("resource_id", "start_time", name="uq_resource_slot"),
api\app\models\time_slot_simple.py:287:        CheckConstraint("start_time < end_time", name="ck_resource_slot_time_range"),
api\app\models\time_slot_simple.py:288:        CheckConstraint("status IN ('available', 'booked', 'blocked')", name="ck_resource_slot_status_valid"),
api\app\models\time_slot_simple.py:305:        UniqueConstraint("slot_id", "resource_id", name="uq_slot_required_resource"),
api\app\models\multitenancy.py:8:from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
api\app\models\multitenancy.py:37:        UniqueConstraint("phone_number_id", name="uq_client_whatsapp_phone_number_id"),
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:5:export type OnlineTrainingBufferDocument = HydratedDocument<OnlineTrainingBuffer>;
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:7:@Schema({ timestamps: true, collection: 'online_training_buffer' })
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:8:export class OnlineTrainingBuffer {
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:34:   * Exact ONNX feature vector used in inference (float32 array)
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:38:  onnxFeatureVector!: number[];
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:117:   * Whether this record has been used in training
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:120:  usedInTraining!: boolean;
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:129:   * Quality flags for training filtering
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:137:      isFromEarlyTraining: Boolean, // model was still learning
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:144:    isFromEarlyTraining: boolean;
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:148:export const OnlineTrainingBufferSchema = SchemaFactory.createForClass(
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:149:  OnlineTrainingBuffer,
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:153:OnlineTrainingBufferSchema.index({ incidentId: 1 });
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:154:OnlineTrainingBufferSchema.index({ createdAt: -1 });
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:155:OnlineTrainingBufferSchema.index({ usedInTraining: 1, createdAt: -1 });
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:156:OnlineTrainingBufferSchema.index({ modelVersion: 1, createdAt: -1 });
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:157:OnlineTrainingBufferSchema.index({
api\app\models\models.py:5:from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, Integer, JSON, Index, UniqueConstraint, CheckConstraint, event
api\app\models\models.py:44:        UniqueConstraint("patient_id", "consent_type", "policy_version", name="uq_patient_consent_type_version"),
api\app\models\models.py:48:        CheckConstraint(
api\app\models\models.py:92:        CheckConstraint(
api\app\models\models.py:166:        UniqueConstraint("doctor_id", "date_time", name="uq_appointments_doctor_date_time"),
api\app\models\models.py:167:        CheckConstraint(
api\app\models\models.py:232:        UniqueConstraint("idempotency_key", "http_method", "request_path", name="uq_idempotency_key_method_path"),
api\app\models\models.py:289:        CheckConstraint("action IN ('create', 'update', 'delete')", name="ck_google_outbox_action_valid"),
api\app\models\models.py:290:        CheckConstraint("status IN ('pending', 'processing', 'done', 'failed')", name="ck_google_outbox_status_valid"),
MB-Whatsapp\src\persistence\schemas\feature.schema.ts:21:  onnxFeatureVector?: number[];
MB-Secretaria\models\v12\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v12\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v12\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v12\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v12\metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\src\persistence\persistence.service.ts:13:  OnlineTrainingBuffer,
MB-Whatsapp\src\persistence\persistence.service.ts:14:  OnlineTrainingBufferDocument,
MB-Whatsapp\src\persistence\persistence.service.ts:15:} from './schemas/online-training-buffer.schema';
MB-Whatsapp\src\persistence\persistence.service.ts:28:    @InjectModel(OnlineTrainingBuffer.name)
MB-Whatsapp\src\persistence\persistence.service.ts:29:    private readonly onlineTrainingBufferModel: Model<OnlineTrainingBufferDocument>,
MB-Whatsapp\src\persistence\persistence.service.ts:66:      onnxFeatureVector: sanitized.prediction.onnxFeatureVector,
MB-Whatsapp\src\persistence\persistence.service.ts:127:  // ===== ONLINE TRAINING BUFFER (FASE 1) =====
MB-Whatsapp\src\persistence\persistence.service.ts:133:  async saveOnlineTrainingRecord(
MB-Whatsapp\src\persistence\persistence.service.ts:138:    onnxFeatureVector: number[],
MB-Whatsapp\src\persistence\persistence.service.ts:144:  ): Promise<OnlineTrainingBufferDocument> {
MB-Whatsapp\src\persistence\persistence.service.ts:148:      onnxFeatureVector.length > 0 &&
MB-Whatsapp\src\persistence\persistence.service.ts:149:      !onnxFeatureVector.some((v) => !Number.isFinite(v));
MB-Whatsapp\src\persistence\persistence.service.ts:152:    const record = await this.onlineTrainingBufferModel.create({
MB-Whatsapp\src\persistence\persistence.service.ts:157:      onnxFeatureVector,
MB-Whatsapp\src\persistence\persistence.service.ts:165:      usedInTraining: false,
MB-Whatsapp\src\persistence\persistence.service.ts:171:        isFromEarlyTraining: false, // To be set by learning service
MB-Whatsapp\src\persistence\persistence.service.ts:176:      `[OnlineTraining] Saved buffer record for ${incidentId}`,
MB-Whatsapp\src\persistence\persistence.service.ts:184:  async updateOnlineTrainingOutcome(
MB-Whatsapp\src\persistence\persistence.service.ts:190:    await this.onlineTrainingBufferModel.updateOne(
MB-Whatsapp\src\persistence\persistence.service.ts:201:      `[OnlineTraining] Updated outcome for ${incidentId}: ${outcome}`,
MB-Whatsapp\src\persistence\persistence.service.ts:205:  async registerOnlineTrainingActualAction(
MB-Whatsapp\src\persistence\persistence.service.ts:209:    await this.onlineTrainingBufferModel.updateOne(
MB-Whatsapp\src\persistence\persistence.service.ts:220:      `[OnlineTraining] Registered real action for ${incidentId}: ${actionActual}`,
MB-Whatsapp\src\persistence\persistence.service.ts:225:   * Get untrained buffer records (for micro-batch learning)
MB-Whatsapp\src\persistence\persistence.service.ts:227:  async getUntrainedBufferRecords(
MB-Whatsapp\src\persistence\persistence.service.ts:230:  ): Promise<OnlineTrainingBuffer[]> {
MB-Whatsapp\src\persistence\persistence.service.ts:231:    const query: any = { usedInTraining: false };
MB-Whatsapp\src\persistence\persistence.service.ts:237:    return this.onlineTrainingBufferModel
MB-Whatsapp\src\persistence\persistence.service.ts:241:      .lean<OnlineTrainingBuffer[]>();
MB-Whatsapp\src\persistence\persistence.service.ts:245:   * Mark buffer records as used in training
MB-Whatsapp\src\persistence\persistence.service.ts:249:    await this.onlineTrainingBufferModel.updateMany(
MB-Whatsapp\src\persistence\persistence.service.ts:251:      { $set: { usedInTraining: true } },
MB-Whatsapp\src\persistence\persistence.service.ts:254:      `[OnlineTraining] Marked ${incidentIds.length} records as used`,
MB-Whatsapp\src\persistence\persistence.service.ts:261:  async getOnlineTrainingBufferStats(): Promise<{
MB-Whatsapp\src\persistence\persistence.service.ts:263:    untrainedRecords: number;
MB-Whatsapp\src\persistence\persistence.service.ts:267:    const totalRecords = await this.onlineTrainingBufferModel.countDocuments();
MB-Whatsapp\src\persistence\persistence.service.ts:268:    const untrainedRecords = await this.onlineTrainingBufferModel.countDocuments(
MB-Whatsapp\src\persistence\persistence.service.ts:269:      { usedInTraining: false },
MB-Whatsapp\src\persistence\persistence.service.ts:271:    const recordsWithOutcome = await this.onlineTrainingBufferModel.countDocuments(
MB-Whatsapp\src\persistence\persistence.service.ts:274:    const modelVersions = await this.onlineTrainingBufferModel.distinct(
MB-Whatsapp\src\persistence\persistence.service.ts:280:      untrainedRecords,
MB-Whatsapp\src\persistence\persistence.module.ts:11:  OnlineTrainingBuffer,
MB-Whatsapp\src\persistence\persistence.module.ts:12:  OnlineTrainingBufferSchema,
MB-Whatsapp\src\persistence\persistence.module.ts:13:} from './schemas/online-training-buffer.schema';
MB-Whatsapp\src\persistence\persistence.module.ts:30:      { name: OnlineTrainingBuffer.name, schema: OnlineTrainingBufferSchema },
MB-Whatsapp\src\persistence\persistence-sanitization.spec.ts:4:  it('does not pass original sensitive values to online training persistence', async () => {
MB-Whatsapp\src\persistence\persistence-sanitization.spec.ts:17:    await service.saveOnlineTrainingRecord(
brain\core\config.py:39:        default="medical-agenda-saas/models/no_show_model.onnx",
brain\ml\no_show.py:4:``NoShowPredictor`` (ONNX + fallback heurístico) y devuelve directamente
MB-Secretaria\models\v11\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v11\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v11\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v11\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v11\metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\src\ml-service\model-registry.service.ts:19:interface ModelRegistry {
MB-Whatsapp\src\ml-service\model-registry.service.ts:27:export class ModelRegistryService {
MB-Whatsapp\src\ml-service\model-registry.service.ts:28:  private readonly logger = new Logger(ModelRegistryService.name);
MB-Whatsapp\src\ml-service\model-registry.service.ts:29:  private readonly registryPath = join(process.cwd(), 'models', 'registry.json');
MB-Whatsapp\src\ml-service\model-registry.service.ts:30:  private registry: ModelRegistry | null = null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:35:   * Get model registry with caching
MB-Whatsapp\src\ml-service\model-registry.service.ts:37:  async getRegistry(): Promise<ModelRegistry> {
MB-Whatsapp\src\ml-service\model-registry.service.ts:39:    if (!this.registry || (now - this.lastLoadTime) > this.CACHE_TTL) {
MB-Whatsapp\src\ml-service\model-registry.service.ts:40:      await this.loadRegistry();
MB-Whatsapp\src\ml-service\model-registry.service.ts:42:    return this.registry!;
MB-Whatsapp\src\ml-service\model-registry.service.ts:49:    const registry = await this.getRegistry();
MB-Whatsapp\src\ml-service\model-registry.service.ts:52:      if (!registry.current_production) return null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:53:      return registry.versions.find(v => v.version === registry.current_production) || null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:57:      if (!registry.staging) return null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:58:      return registry.versions.find(v => v.version === registry.staging) || null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:61:    return registry.versions.find(v => v.version === version) || null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:68:    const registry = await this.getRegistry();
MB-Whatsapp\src\ml-service\model-registry.service.ts:69:    return registry.versions;
MB-Whatsapp\src\ml-service\model-registry.service.ts:76:    const registry = await this.getRegistry();
MB-Whatsapp\src\ml-service\model-registry.service.ts:77:    if (!registry.current_production) return null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:78:    return registry.versions.find(v => v.version === registry.current_production) || null;
MB-Whatsapp\src\ml-service\model-registry.service.ts:93:    return join(process.cwd(), 'models', version, 'decision_model.onnx');
MB-Whatsapp\src\ml-service\model-registry.service.ts:97:   * Force reload registry from disk
MB-Whatsapp\src\ml-service\model-registry.service.ts:99:  async reloadRegistry(): Promise<void> {
MB-Whatsapp\src\ml-service\model-registry.service.ts:100:    await this.loadRegistry();
MB-Whatsapp\src\ml-service\model-registry.service.ts:103:  private async loadRegistry(): Promise<void> {
MB-Whatsapp\src\ml-service\model-registry.service.ts:105:      if (!existsSync(this.registryPath)) {
MB-Whatsapp\src\ml-service\model-registry.service.ts:106:        this.logger.warn(`[Registry] Registry file not found: ${this.registryPath}`);
MB-Whatsapp\src\ml-service\model-registry.service.ts:107:        this.registry = {
MB-Whatsapp\src\ml-service\model-registry.service.ts:116:      const raw = readFileSync(this.registryPath, 'utf-8');
MB-Whatsapp\src\ml-service\model-registry.service.ts:117:      this.registry = JSON.parse(raw);
MB-Whatsapp\src\ml-service\model-registry.service.ts:120:      if (this.registry) {
MB-Whatsapp\src\ml-service\model-registry.service.ts:121:        this.logger.debug(`[Registry] Loaded ${this.registry.versions.length} model versions`);
MB-Whatsapp\src\ml-service\model-registry.service.ts:126:      this.logger.error(`[Registry] Failed to load registry: ${msg}`);
MB-Whatsapp\src\ml-service\model-monitor.service.ts:14:  train_accuracy?: number;
MB-Whatsapp\src\ml-service\model-monitor.service.ts:119:    const baselineTrainAccuracy = this.safeNumber(baseline.train_accuracy, baselineAccuracy);
MB-Whatsapp\src\ml-service\model-monitor.service.ts:131:    const currentOverfitting = Math.max(0, baselineTrainAccuracy - currentAccuracy);
MB-Whatsapp\src\ml-service\ml-service.service.ts:2:import { ModelRegistryService } from './model-registry.service';
MB-Whatsapp\src\ml-service\ml-service.service.ts:38:    private readonly registry: ModelRegistryService,
MB-Whatsapp\src\ml-service\ml-service.service.ts:54:      const modelInfo = await this.registry.getProductionVersion();
MB-Whatsapp\src\ml-service\ml-service.service.ts:136:      const loadedModels = ['decision_model.onnx'];
MB-Whatsapp\src\ml-service\ml-service.service.ts:170:    const registry = await this.registry.getRegistry();
MB-Whatsapp\src\ml-service\ml-service.service.ts:172:      production: registry.current_production,
MB-Whatsapp\src\ml-service\ml-service.service.ts:173:      staging: registry.staging,
MB-Whatsapp\src\ml-service\ml-service.service.ts:174:      available: registry.versions.map(v => v.version),
MB-Whatsapp\src\ml-service\ml-service.module.ts:4:import { ModelRegistryService } from './model-registry.service';
MB-Whatsapp\src\ml-service\ml-service.module.ts:13:  providers: [MlServiceService, ModelRegistryService, MetricsService, ModelMonitorService],
brain\orchestration\clients.py:34:    CircuitBreakerRegistry,
brain\orchestration\clients.py:44:_CB_DIALOGUE = CircuitBreakerRegistry.get(
brain\orchestration\clients.py:48:_CB_INFERENCE = CircuitBreakerRegistry.get(
brain\orchestration\clients.py:52:_CB_DECISION = CircuitBreakerRegistry.get(
brain\orchestration\clients.py:56:_CB_NLG = CircuitBreakerRegistry.get(
brain\ml\no_show_predictor.py:3:Motor deterministico con soporte ONNX Runtime y fallback heuristico.
brain\ml\no_show_predictor.py:23:    import onnxruntime as ort
brain\ml\no_show_predictor.py:60:    """Predictor ONNX de probabilidad de ausentismo."""
brain\ml\no_show_predictor.py:86:        p = self._infer_with_onnx(features)
brain\ml\no_show_predictor.py:104:            logger.warning("onnxruntime no disponible; usando fallback heuristico")
brain\ml\no_show_predictor.py:109:            logger.warning("Modelo no-show ONNX no encontrado en %s", self._model_path)
brain\ml\no_show_predictor.py:115:            logger.info("Modelo no-show ONNX cargado desde %s", self._model_path)
brain\ml\no_show_predictor.py:117:            logger.error("Error cargando modelo ONNX de no-show: %s", exc)
brain\ml\no_show_predictor.py:122:    def _infer_with_onnx(self, features: NoShowFeatures) -> float | None:
brain\ml\no_show_predictor.py:139:            logger.error("Error durante inferencia ONNX no-show: %s", exc)
brain\ml\no_show_predictor.py:143:        # Heuristica logistica determinista cuando no hay modelo ONNX.
brain\ml\no_show_predictor.py:209:        # Mantener paridad de dimensiones con el modelo ONNX reutilizando baseline.
brain\orchestration\semantic_memory.py:1:"""Memoria semantica persistente por sesion usando Redis + FAISS."""
brain\orchestration\semantic_memory.py:20:    import faiss
brain\orchestration\semantic_memory.py:22:    faiss = None  # type: ignore[assignment]
brain\orchestration\semantic_memory.py:47:        index_dir: str = "artifacts/semantic_index",
brain\orchestration\semantic_memory.py:60:        """Genera embedding float32 normalizado.
brain\orchestration\semantic_memory.py:62:        Usa OpenAI embeddings si OPENAI_API_KEY esta disponible.
brain\orchestration\semantic_memory.py:63:        Si falla, cae a embedding local hash-based para no romper el flujo.
brain\orchestration\semantic_memory.py:85:            "model": "text-embedding-3-small",
brain\orchestration\semantic_memory.py:96:                    "https://api.openai.com/v1/embeddings",
brain\orchestration\semantic_memory.py:103:            logger.warning("OpenAI embeddings fallback a local: %s", exc)
brain\orchestration\semantic_memory.py:106:        embedding = data.get("data", [{}])[0].get("embedding")
brain\orchestration\semantic_memory.py:107:        if not isinstance(embedding, list) or not embedding:
brain\orchestration\semantic_memory.py:110:        vec = np.array(embedding, dtype=np.float32)
brain\orchestration\semantic_memory.py:113:                "Dimension embeddings inesperada (%s). Esperada=%s",
brain\orchestration\semantic_memory.py:143:                vector = await self.embed(cleaned)
brain\orchestration\semantic_memory.py:147:                    best_score, _ = self._search_index(index, vector, top_k=1)
brain\orchestration\semantic_memory.py:151:                self._add_to_index(index, vector)
brain\orchestration\semantic_memory.py:154:                vector_key = self._vectors_key(session_id)
brain\orchestration\semantic_memory.py:160:                await self.redis.rpush(vector_key, json.dumps(vector.tolist()))
brain\orchestration\semantic_memory.py:164:                await self.redis.ltrim(vector_key, -self.max_records, -1)
brain\orchestration\semantic_memory.py:169:                    await self.redis.expire(vector_key, self.ttl_seconds)
brain\orchestration\semantic_memory.py:235:                    # Similitud semántica (FAISS usa inner product en vectores normalizados = cosine)
brain\orchestration\semantic_memory.py:262:        if faiss is not None:
brain\orchestration\semantic_memory.py:288:        raw_vectors = await self.redis.lrange(self._vectors_key(session_id), 0, -1)
brain\orchestration\semantic_memory.py:290:        vectors: List[np.ndarray] = []
brain\orchestration\semantic_memory.py:291:        for item in raw_vectors:
brain\orchestration\semantic_memory.py:304:            vectors.append(vec)
brain\orchestration\semantic_memory.py:306:        if vectors:
brain\orchestration\semantic_memory.py:307:            matrix = np.vstack(vectors).astype(np.float32)
brain\orchestration\semantic_memory.py:313:        if faiss is not None:
brain\orchestration\semantic_memory.py:314:            return faiss.IndexFlatIP(self.dimension)
brain\orchestration\semantic_memory.py:318:        if faiss is None:
brain\orchestration\semantic_memory.py:331:            redis_count = int(await self.redis.llen(self._vectors_key(session_id)))
brain\orchestration\semantic_memory.py:338:            index = faiss.read_index(str(index_path))
brain\orchestration\semantic_memory.py:344:            logger.warning("No se pudo cargar snapshot FAISS session=%s: %s", session_id, exc)
brain\orchestration\semantic_memory.py:348:        if faiss is None:
brain\orchestration\semantic_memory.py:354:            faiss.write_index(index, str(index_path))
brain\orchestration\semantic_memory.py:358:            logger.warning("No se pudo guardar snapshot FAISS session=%s: %s", session_id, exc)
brain\orchestration\semantic_memory.py:393:    def _add_to_index(self, index, vector: np.ndarray) -> None:
brain\orchestration\semantic_memory.py:394:        if faiss is not None:
brain\orchestration\semantic_memory.py:395:            index.add(vector.reshape(1, -1).astype(np.float32))
brain\orchestration\semantic_memory.py:397:        index.append(vector)
brain\orchestration\semantic_memory.py:400:        if faiss is not None:
brain\orchestration\semantic_memory.py:407:        if faiss is not None:
brain\orchestration\semantic_memory.py:420:        if faiss is not None:
brain\orchestration\semantic_memory.py:441:    def _vectors_key(session_id: str) -> str:
brain\orchestration\semantic_memory.py:442:        return f"semantic_memory:{session_id}:vectors"
brain\orchestration\semantic_memory.py:457:        return self._index_dir / f"{session_id}.faiss"
MB-Secretaria\models\v10\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v10\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v10\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v10\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v10\metrics.json:75:  "num_train_samples": 168,
brain\services\orchestrator.py:454:        # Prediccion no-show en worker Brain (ONNX + fallback deterministico)
MB-Whatsapp\retrieval\index.ts:24:  notes: ["MetaBrain Nest usa embeddings hash; Next usa allowlist y sanitizer."],
MB-Whatsapp\README.md:28:2. **Entrenamiento con Validación** (`scripts/train_model.py`):
MB-Whatsapp\README.md:32:   - Export: `models/decision_model.onnx`
MB-Whatsapp\README.md:35:   - `ModelLoader`: Carga modelo ONNX al iniciar
MB-Whatsapp\README.md:63:- **Carga Dinámica de Modelos**: ONNX runtime con gestión de memoria LRU
MB-Whatsapp\README.md:102:- **Registro de Modelos**: `data/model-registry.json`
MB-Whatsapp\README.md:103:- **Modelos**: `data/models/*.onnx`
MB-Whatsapp\README.md:136:Data → Features (18) → Train/Test Split (80/20) → Training
MB-Whatsapp\README.md:151:2. **`scripts/train_model.py`**: Entrenamiento con métricas comprehensivas
MB-Whatsapp\README.md:154:5. **`scripts/run_ml_validation.py`**: Pipeline orquestada (data → train → validate → monitor)
MB-Whatsapp\README.md:159:# Pipeline completo: data → train → validate → monitor
MB-Whatsapp\README.md:164:python scripts/train_model.py        # Entrenar con validación
MB-Whatsapp\README.md:171:**Overfitting Detection** (train accuracy - test accuracy):
MB-Whatsapp\README.md:194:├── decision_model.onnx         # Export ONNX para Node.js
MB-Whatsapp\README.md:201:├── X_train.csv, X_test.csv     # Features
MB-Whatsapp\README.md:202:├── y_train.csv, y_test.csv     # Labels
MB-Whatsapp\README.md:215:MetaBrain implementa un sistema de **Model Registry** para controlar la evolución segura de modelos con versionado automático, comparación inteligente y rollback seguro.
MB-Whatsapp\README.md:241:Training → Register (v1, v2, v3) → Compare vs Prod → Recommend (DEPLOY/REJECT)
MB-Whatsapp\README.md:270:3. **Model Registry** (`scripts/model_registry.py`)
MB-Whatsapp\README.md:290:   - Actualiza registry con razón y timestamp
MB-Whatsapp\README.md:292:6. **Registry Structure** (`models/registry.json`)
MB-Whatsapp\README.md:314:- ml_confidence: 0-1.0 (REAL, from trained model)
MB-Whatsapp\README.md:326:python scripts/train_model.py
MB-Whatsapp\README.md:334:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\README.md:335:  r = ModelRegistry(); r.print_history()"
MB-Whatsapp\README.md:338:python scripts/demo_model_registry.py
MB-Whatsapp\README.md:345:- [docs/ML_MODEL_REGISTRY.md](docs/ML_MODEL_REGISTRY.md): Version control, comparación, rollback
MB-Whatsapp\README.md:357:python scripts/train_model.py
MB-Whatsapp\README.md:358:# → Crea models/decision_model.pkl y registry.json
MB-Whatsapp\README.md:387:tail -f logs/app.log | grep "Learning.*Retraining"
MB-Whatsapp\README.md:390:python scripts/train_model.py
MB-Whatsapp\README.md:397:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\README.md:398:  ModelRegistry().print_history()"
MB-Whatsapp\README.md:404:python scripts/demo_model_registry.py
MB-Whatsapp\README.md:419:  - ML (0.4): ONNX model + enriched features
MB-Whatsapp\README.md:437:- **Registry**: historial de versiones + deployments en `models/registry.json`
MB-Whatsapp\src\ml-core\predictor.service.ts:2:import * as ort from 'onnxruntime-node';
MB-Whatsapp\src\ml-core\predictor.service.ts:37:    const featureVector = this.featureBuilder.buildFeatures(
MB-Whatsapp\src\ml-core\predictor.service.ts:51:      const tensor = new ort.Tensor('float32', Float32Array.from(featureVector), [1, featureVector.length]);
MB-Whatsapp\src\ml-core\predictor.service.ts:59:      const topFeatures = this.computeTopFeatures(featureVector);
MB-Whatsapp\src\ml-core\predictor.service.ts:68:      this.logger.error(`ONNX prediction failed: ${msg}`);
MB-Whatsapp\src\ml-core\predictor.service.ts:85:  private computeTopFeatures(featureVector: number[], topN = 5): MlTopFeature[] {
MB-Whatsapp\src\ml-core\predictor.service.ts:87:    if (globalImportances.length === 0 || featureVector.length === 0) return [];
MB-Whatsapp\src\ml-core\predictor.service.ts:96:      const value = featureIdx >= 0 && featureIdx < featureVector.length
MB-Whatsapp\src\ml-core\predictor.service.ts:97:        ? featureVector[featureIdx]
MB-Secretaria\models\v1\metrics.json:3:  "train_accuracy": 1.0,
MB-Secretaria\models\v1\metrics.json:4:  "train_precision": 1.0,
MB-Secretaria\models\v1\metrics.json:5:  "train_recall": 1.0,
MB-Secretaria\models\v1\metrics.json:6:  "train_f1": 1.0,
MB-Secretaria\models\v1\metrics.json:15:  "num_train_samples": 1,
MB-Whatsapp\src\ml-core\model.loader.ts:4:import * as ort from 'onnxruntime-node';
MB-Whatsapp\src\ml-core\model.loader.ts:6:interface OnnxMetadata {
MB-Whatsapp\src\ml-core\model.loader.ts:53:  private readonly modelPath = join(process.cwd(), 'models', 'decision_model.onnx');
MB-Whatsapp\src\ml-core\model.loader.ts:54:  private readonly metadataPath = join(process.cwd(), 'models', 'onnx_metadata.json');
MB-Whatsapp\src\ml-core\model.loader.ts:90:      this.logger.warn(`ONNX model not found at ${this.modelPath}`);
MB-Whatsapp\src\ml-core\model.loader.ts:100:        `ONNX model loaded. input=${this.session.inputNames[0]} outputs=${this.session.outputNames.join(',')}`,
MB-Whatsapp\src\ml-core\model.loader.ts:105:      this.logger.error(`Failed to load ONNX model: ${msg}`);
MB-Whatsapp\src\ml-core\model.loader.ts:113:    this.logger.log('Reloading ONNX model and metadata...');
MB-Whatsapp\src\ml-core\model.loader.ts:119:      this.logger.log(`ONNX reload completed at ${this.loadedAt ?? 'unknown'}`);
MB-Whatsapp\src\ml-core\model.loader.ts:121:      this.logger.warn('ONNX reload failed; previous session is unavailable');
MB-Whatsapp\src\ml-core\model.loader.ts:164:      this.logger.warn(`ONNX metadata not found at ${this.metadataPath}`);
MB-Whatsapp\src\ml-core\model.loader.ts:170:      const parsed = JSON.parse(raw) as OnnxMetadata;
MB-Whatsapp\src\ml-core\model.loader.ts:195:      this.logger.log(`Loaded ONNX action classes: ${this.actionClasses.length} schema=${this.metadataInfo.featureSchemaVersion}`);
MB-Whatsapp\src\ml-core\model.loader.ts:198:      this.logger.error(`Failed to load ONNX metadata: ${msg}`);
MB-Secretaria\models\reports\deployment_gate_report.json:8:    "onnx_parity": true
MB-Secretaria\models\reports\deployment_gate_report.json:10:  "onnx_parity": 1.0,
MB-Secretaria\models\reports\recommendation_v10.json:30:      "message": "More or equal training samples"
MB-Whatsapp\src\ml-core\feature-builder.ts:16:interface OnnxMetadata {
MB-Whatsapp\src\ml-core\feature-builder.ts:71:  private readonly metadataPath = join(process.cwd(), 'models', 'onnx_metadata.json');
MB-Whatsapp\src\ml-core\feature-builder.ts:73:  private metadata: OnnxMetadata = {
MB-Whatsapp\src\ml-core\feature-builder.ts:177:    const vector = this.metadata.feature_names.map((name) => this.ensureNumeric(byName[name]));
MB-Whatsapp\src\ml-core\feature-builder.ts:179:    if (vector.length !== this.metadata.num_features) {
MB-Whatsapp\src\ml-core\feature-builder.ts:181:        `Feature length mismatch: expected ${this.metadata.num_features}, got ${vector.length}`,
MB-Whatsapp\src\ml-core\feature-builder.ts:185:    return vector;
MB-Whatsapp\src\ml-core\feature-builder.ts:202:  /** Returns the zero-based index of a feature name in the model's feature vector, or -1 if not found. */
MB-Whatsapp\src\ml-core\feature-builder.ts:220:      this.logger.warn(`ONNX metadata not found at ${this.metadataPath}`);
MB-Whatsapp\src\ml-core\feature-builder.ts:226:      const parsed = JSON.parse(raw) as OnnxMetadata;
MB-Whatsapp\src\ml-core\feature-builder.ts:243:        `Loaded ONNX metadata: ${this.metadata.feature_names.length} features schema=${this.metadata.feature_schema_version ?? 'unknown'} pipeline=${this.metadata.pipeline_version ?? 'unknown'}`,
MB-Whatsapp\src\ml-core\feature-builder.ts:247:      this.logger.error(`Failed to load ONNX metadata: ${msg}`);
MB-Whatsapp\src\ml-core\feature-builder.ts:248:      this.schemaValidationError = `onnx_metadata_load_error: ${msg}`;
MB-Whatsapp\src\ml-core\feature-builder.ts:252:  private validateSchema(metadata: OnnxMetadata): string | null {
MB-Secretaria\models\reports\recommendation_v11.json:30:      "message": "More or equal training samples"
MB-Whatsapp\production_safety_py\__init__.py:7:from .rollback_registry import build_rollback_registry
MB-Whatsapp\production_safety_py\__init__.py:21:    "build_rollback_registry",
MB-Whatsapp\production_safety_py\types.py:69:class RollbackRegistryEntry:
MB-Whatsapp\src\ml\online-learning.service.ts:9:import { OnlineTrainingBuffer } from '../persistence/schemas/online-training-buffer.schema';
MB-Whatsapp\src\ml\online-learning.service.ts:18: * - FASE 4: Incremental dataset generation + retraining
MB-Whatsapp\src\ml\online-learning.service.ts:22: * Runs every X minutes to collect feedback and decide if retraining is needed.
MB-Whatsapp\src\ml\online-learning.service.ts:27:  private isRetrainingInProgress = false;
MB-Whatsapp\src\ml\online-learning.service.ts:28:  private lastRetrainingTime: Date | null = null;
MB-Whatsapp\src\ml\online-learning.service.ts:37:   * Runs every 5 minutes to check if we should retrain
MB-Whatsapp\src\ml\online-learning.service.ts:41:    if (this.isRetrainingInProgress) {
MB-Whatsapp\src\ml\online-learning.service.ts:42:      this.logger.debug('[OnlineLearning] Retraining already in progress, skipping');
MB-Whatsapp\src\ml\online-learning.service.ts:50:        `[OnlineLearning] Buffer stats: total=${stats.totalRecords}, untrained=${stats.untrainedRecords}, with_outcome=${stats.recordsWithOutcome}`,
MB-Whatsapp\src\ml\online-learning.service.ts:53:      // Decision: retrain if we have enough new, quality feedback
MB-Whatsapp\src\ml\online-learning.service.ts:54:      const shouldRetrain = await this.shouldTriggerRetrain(stats);
MB-Whatsapp\src\ml\online-learning.service.ts:55:      if (!shouldRetrain) {
MB-Whatsapp\src\ml\online-learning.service.ts:57:          '[OnlineLearning] Insufficient data for retraining, deferring',
MB-Whatsapp\src\ml\online-learning.service.ts:62:      await this.executeIncrementalRetrain();
MB-Whatsapp\src\ml\online-learning.service.ts:70:   * FASE 3: Check if retraining is warranted
MB-Whatsapp\src\ml\online-learning.service.ts:72:  private async shouldTriggerRetrain(stats: {
MB-Whatsapp\src\ml\online-learning.service.ts:74:    untrainedRecords: number;
MB-Whatsapp\src\ml\online-learning.service.ts:79:    const MIN_UNTRAINED_WITH_OUTCOME = 20;
MB-Whatsapp\src\ml\online-learning.service.ts:80:    if (stats.recordsWithOutcome < MIN_UNTRAINED_WITH_OUTCOME) {
MB-Whatsapp\src\ml\online-learning.service.ts:84:    // Throttle: don't retrain more often than every 30 minutes
MB-Whatsapp\src\ml\online-learning.service.ts:85:    if (this.lastRetrainingTime) {
MB-Whatsapp\src\ml\online-learning.service.ts:86:      const timeSinceLastRetrain = Date.now() - this.lastRetrainingTime.getTime();
MB-Whatsapp\src\ml\online-learning.service.ts:87:      const MIN_RETRAIN_INTERVAL_MS = 30 * 60 * 1000;
MB-Whatsapp\src\ml\online-learning.service.ts:88:      if (timeSinceLastRetrain < MIN_RETRAIN_INTERVAL_MS) {
MB-Whatsapp\src\ml\online-learning.service.ts:90:          `[OnlineLearning] Throttled: only ${(timeSinceLastRetrain / 1000).toFixed(0)}s since last retrain`,
MB-Whatsapp\src\ml\online-learning.service.ts:100:   * FASE 4: Execute incremental retraining pipeline
MB-Whatsapp\src\ml\online-learning.service.ts:102:  private async executeIncrementalRetrain(): Promise<void> {
MB-Whatsapp\src\ml\online-learning.service.ts:103:    this.isRetrainingInProgress = true;
MB-Whatsapp\src\ml\online-learning.service.ts:104:    this.lastRetrainingTime = new Date();
MB-Whatsapp\src\ml\online-learning.service.ts:106:    this.logger.log('[OnlineLearning] Starting incremental retraining...');
MB-Whatsapp\src\ml\online-learning.service.ts:109:      // Step 1: Load untrained buffer records
MB-Whatsapp\src\ml\online-learning.service.ts:119:      if (!this.isBatchValidForTraining(bufferRecords)) {
MB-Whatsapp\src\ml\online-learning.service.ts:120:        this.logger.warn('[OnlineLearning] Invalid/corrupt records detected in batch. Retrain skipped.');
MB-Whatsapp\src\ml\online-learning.service.ts:125:        `[OnlineLearning] Processing ${bufferRecords.length} buffer records for retraining`,
MB-Whatsapp\src\ml\online-learning.service.ts:128:      // Step 2: Export incremental dataset from buffer
MB-Whatsapp\src\ml\online-learning.service.ts:129:      const incrementalDataPath = await this.exportIncrementalDataset(bufferRecords);
MB-Whatsapp\src\ml\online-learning.service.ts:131:        `[OnlineLearning] Exported incremental dataset: ${incrementalDataPath}`,
MB-Whatsapp\src\ml\online-learning.service.ts:134:      // Step 3: Trigger Python retraining script with incremental data
MB-Whatsapp\src\ml\online-learning.service.ts:135:      const trainResult = await this.executeIncrementalTraining(incrementalDataPath);
MB-Whatsapp\src\ml\online-learning.service.ts:136:      if (!trainResult.success) {
MB-Whatsapp\src\ml\online-learning.service.ts:138:          `[OnlineLearning] Training failed: ${trainResult.error}`,
MB-Whatsapp\src\ml\online-learning.service.ts:144:      if (trainResult.gateResult?.passed) {
MB-Whatsapp\src\ml\online-learning.service.ts:148:        // Mark these records as used in training
MB-Whatsapp\src\ml\online-learning.service.ts:157:          `Gate checks: ${JSON.stringify(trainResult.gateResult?.checks)}`,
MB-Whatsapp\src\ml\online-learning.service.ts:163:        `[OnlineLearning] Incremental retrain failed: ${msg}`,
MB-Whatsapp\src\ml\online-learning.service.ts:166:      this.isRetrainingInProgress = false;
MB-Whatsapp\src\ml\online-learning.service.ts:171:   * FASE 3: Export buffer records as CSV for training
MB-Whatsapp\src\ml\online-learning.service.ts:173:  private async exportIncrementalDataset(
MB-Whatsapp\src\ml\online-learning.service.ts:174:    bufferRecords: OnlineTrainingBuffer[],
MB-Whatsapp\src\ml\online-learning.service.ts:181:      `training_buffer_${timestamp}.csv`,
MB-Whatsapp\src\ml\online-learning.service.ts:239:   * FASE 4: Execute Python incremental training
MB-Whatsapp\src\ml\online-learning.service.ts:241:  private async executeIncrementalTraining(
MB-Whatsapp\src\ml\online-learning.service.ts:254:      'train_model_incremental.py',
MB-Whatsapp\src\ml\online-learning.service.ts:273:      // Check if training succeeded (look for deployment gate result in output)
MB-Whatsapp\src\ml\online-learning.service.ts:291:        `[OnlineLearning] Training completed. Gate passed: ${gatePassed}`,
MB-Whatsapp\src\ml\online-learning.service.ts:312:   * Manual trigger for on-demand retraining (via API endpoint)
MB-Whatsapp\src\ml\online-learning.service.ts:314:  async triggerManualRetrain(): Promise<{
MB-Whatsapp\src\ml\online-learning.service.ts:318:    if (this.isRetrainingInProgress) {
MB-Whatsapp\src\ml\online-learning.service.ts:321:        message: 'Retraining is already in progress',
MB-Whatsapp\src\ml\online-learning.service.ts:327:      void this.executeIncrementalRetrain(); // Fire and forget
MB-Whatsapp\src\ml\online-learning.service.ts:330:        message: `Started incremental retraining with ${stats.untrainedRecords} untrained records`,
MB-Whatsapp\src\ml\online-learning.service.ts:345:    isRetrainingInProgress: boolean;
MB-Whatsapp\src\ml\online-learning.service.ts:346:    lastRetrainingTime: Date | null;
MB-Whatsapp\src\ml\online-learning.service.ts:349:      isRetrainingInProgress: this.isRetrainingInProgress,
MB-Whatsapp\src\ml\online-learning.service.ts:350:      lastRetrainingTime: this.lastRetrainingTime,
MB-Whatsapp\src\ml\online-learning.service.ts:356:    untrainedRecords: number;
MB-Whatsapp\src\ml\online-learning.service.ts:362:    const untrainedRecords = sample.length;
MB-Whatsapp\src\ml\online-learning.service.ts:367:      untrainedRecords,
MB-Whatsapp\src\ml\online-learning.service.ts:373:  private isBatchValidForTraining(batch: OnlineTrainingBuffer[]): boolean {
MB-Whatsapp\src\ml\online-learning.service.ts:377:      if (!Array.isArray(row.onnxFeatureVector) || row.onnxFeatureVector.length === 0) {
MB-Whatsapp\src\ml\online-learning.service.ts:383:      if (row.onnxFeatureVector.some((v) => !Number.isFinite(v))) {
MB-Whatsapp\src\ml\online-learning.service.ts:394:    // Safety: avoid training with one single class only.
MB-Whatsapp\providers_py\__init__.py:5:from .provider_registry import ProviderRegistry
MB-Whatsapp\providers_py\__init__.py:15:    "ProviderRegistry",
MB-Whatsapp\src\ml\online-buffer.service.ts:2:import { OnlineTrainingBuffer } from '../persistence/schemas/online-training-buffer.schema';
MB-Whatsapp\src\ml\online-buffer.service.ts:13:    featureVector: number[];
MB-Whatsapp\src\ml\online-buffer.service.ts:20:    await this.persistenceService.saveOnlineTrainingRecord(
MB-Whatsapp\src\ml\online-buffer.service.ts:25:      event.featureVector,
MB-Whatsapp\src\ml\online-buffer.service.ts:39:  async getBatch(limit = 100): Promise<OnlineTrainingBuffer[]> {
MB-Whatsapp\src\ml\online-buffer.service.ts:40:    return this.persistenceService.getUntrainedBufferRecords(limit, true);
MB-Whatsapp\src\ml\online-buffer.service.ts:50:    await this.persistenceService.updateOnlineTrainingOutcome(
MB-Whatsapp\src\ml\online-buffer.service.ts:57:      await this.persistenceService.registerOnlineTrainingActualAction(
MB-Whatsapp\providers_py\types.py:9:ProviderRequestType = Literal["chat", "completion", "embedding", "vision", "multimodal", "healthcheck"]
MB-Secretaria\data\processed\metadata.json:2:  "dataset_type": "synthetic",
MB-Secretaria\data\processed\metadata.json:3:  "input_dir": "E:\\MetaBrain\\data\\synthetic_dataset",
MB-Secretaria\data\processed\metadata.json:5:  "train_samples": 168,
MB-Whatsapp\production_safety_py\safety_report.py:4:from .rollback_registry import build_rollback_registry
MB-Whatsapp\production_safety_py\safety_report.py:13:        "rollback_registry": build_rollback_registry(),
MB-Whatsapp\src\ml\model.service.ts:25:  featureVector?: number[];
MB-Whatsapp\src\ml\model.service.ts:45:   * @param features Enriched feature vector with learning-based signals
MB-Whatsapp\src\ml\model.service.ts:69:        featureVector: [],
MB-Whatsapp\src\ml\model.service.ts:75:    let featureVector: number[] = [];
MB-Whatsapp\src\ml\model.service.ts:78:      featureVector = this.featureBuilder.buildFeatures(incident, features, strategy, rulesAction);
MB-Whatsapp\src\ml\model.service.ts:98:        featureVector,
MB-Whatsapp\src\ml\model.service.ts:126:      error: modelUsed ? undefined : 'onnx_prediction_unavailable',
MB-Whatsapp\src\ml\model.service.ts:128:      featureVector,
MB-Secretaria\data\processed\memory_history_real_validation.jsonl:1:{"entry_id": "e3e95698-41e3-479c-afe3-0d327f45bb80", "request_id": "69d9ce38-b954-4dc3-843b-0ee02f57ae90", "source": "sync", "created_at_utc": "2026-04-21T20:43:02.394421Z", "input_summary": {"source_type": "text", "modality": "TEXT", "text_length": 60}, "model_output": {"model_name": "production_medical_triage", "model_version": "3.0.0", "risk_level": "medium", "finding_code": "needs_clinical_review", "confidence": 0.486075, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation", "features_used": {"token_count": 9.0, "char_count": 60.0, "active_ngrams": 9.0}}, "decision_output": {"risk_level": "high", "clinical_flag": "urgent", "requires_medical_evaluation": true, "suspected_condition": "pneumonia_possible", "clinical_interpretation": "Patron radiologico compatible con proceso infeccioso pulmonar. Requiere correlacion clinica, examen fisico y confirmacion medica.", "action_plan": "urgent_er_referral", "urgency": "immediate", "follow_up_hours": 0, "red_flags": [], "recommended_tests": ["chest_xray_followup", "cbc", "crp", "pulse_oximetry"], "model_evidence": {"finding": "possible_pneumonia", "finding_code": "needs_clinical_review", "model_risk_level": "medium", "modality": "XRAY", "confidence": 0.4861, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation"}}, "nlg_output": {"text": "El analisis integra hallazgos compatibles con un escenario de riesgo elevado. Existe evidencia indirecta de probable compromiso respiratorio infeccioso. Debe activarse circuito de atencion urgente para confirmacion y manejo. Nivel de confianza del modelo: 0.49. Pruebas sugeridas: chest_xray_followup, cbc, crp, pulse_oximetry.", "style": "technical", "variants_used": ["El analisis integra hallazgos compatibles con un escenario de riesgo elevado.", "Existe evidencia indirecta de probable compromiso respiratorio infeccioso.", "Debe activarse circuito de atencion urgente para confirmacion y manejo."], "disclaimers": ["Salida automatizada de apoyo clinico; no reemplaza criterio medico.", "Requiere correlacion con historia clinica, examen fisico y estudios complementarios."]}, "fallback_used": false, "embedding_slot": {"embedding_id": "6abcd183-1dbd-4527-b6b3-a0573c9e492a", "status": "pending", "model_name": "reserved_for_future_embedding_model", "dimensions": null, "vector_ref": "memory_embeddings/sync/42d6d96c-bbec-4a98-b769-956f4397c1f1", "created_at_utc": "2026-04-21T20:43:02.394444Z"}}
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:5:export type OnlineTrainingBufferDocument = HydratedDocument<OnlineTrainingBuffer>;
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:7:@Schema({ timestamps: true, collection: 'online_training_buffer' })
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:8:export class OnlineTrainingBuffer {
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:34:   * Exact ONNX feature vector used in inference (float32 array)
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:38:  onnxFeatureVector!: number[];
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:117:   * Whether this record has been used in training
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:120:  usedInTraining!: boolean;
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:129:   * Quality flags for training filtering
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:137:      isFromEarlyTraining: Boolean, // model was still learning
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:144:    isFromEarlyTraining: boolean;
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:148:export const OnlineTrainingBufferSchema = SchemaFactory.createForClass(
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:149:  OnlineTrainingBuffer,
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:153:OnlineTrainingBufferSchema.index({ incidentId: 1 });
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:154:OnlineTrainingBufferSchema.index({ createdAt: -1 });
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:155:OnlineTrainingBufferSchema.index({ usedInTraining: 1, createdAt: -1 });
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:156:OnlineTrainingBufferSchema.index({ modelVersion: 1, createdAt: -1 });
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:157:OnlineTrainingBufferSchema.index({
MB-Whatsapp\production_safety_py\rollback_registry.py:1:from .types import RollbackRegistryEntry
MB-Whatsapp\production_safety_py\rollback_registry.py:4:def build_rollback_registry() -> list[RollbackRegistryEntry]:
MB-Whatsapp\production_safety_py\rollback_registry.py:6:        _entry("semantic_memory", "MEMORY_ROLLBACK_PLAN.md", ["MetaBrain/memory", "MetaBrain/memory_py"], ["SEMANTIC_MEMORY_ENABLED", "SEMANTIC_MEMORY_WRITE_ENABLED", "SEMANTIC_MEMORY_VECTOR_ENABLED"]),
MB-Whatsapp\production_safety_py\rollback_registry.py:16:def _entry(layer, rollback_doc: str, files_created: list[str], flags_to_disable: list[str]) -> RollbackRegistryEntry:
MB-Whatsapp\production_safety_py\rollback_registry.py:17:    return RollbackRegistryEntry(layer, rollback_doc, files_created, [], flags_to_disable, ["keep_global_kill_switch_enabled", "do_not_delete_runtime_data", "do_not_restart_services_for_documentation_only"])
MB-Whatsapp\src\ml\ml.controller.ts:31:    return this.onlineLearningService.triggerManualRetrain();
MB-Whatsapp\src\ml\ml.controller.ts:37:    isRetrainingInProgress: boolean;
MB-Whatsapp\src\ml\ml.controller.ts:38:    lastRetrainingTime: Date | null;
MB-Chat\src\persistence\schemas\feature.schema.ts:21:  onnxFeatureVector?: number[];
MB-Whatsapp\providers_py\provider_registry.py:6:class ProviderRegistry:
MB-Chat\src\persistence\persistence.service.ts:13:  OnlineTrainingBuffer,
MB-Chat\src\persistence\persistence.service.ts:14:  OnlineTrainingBufferDocument,
MB-Chat\src\persistence\persistence.service.ts:15:} from './schemas/online-training-buffer.schema';
MB-Chat\src\persistence\persistence.service.ts:29:    @InjectModel(OnlineTrainingBuffer.name)
MB-Chat\src\persistence\persistence.service.ts:30:    private readonly onlineTrainingBufferModel: Model<OnlineTrainingBufferDocument>,
MB-Chat\src\persistence\persistence.service.ts:69:      onnxFeatureVector: sanitized.prediction.onnxFeatureVector,
MB-Chat\src\persistence\persistence.service.ts:142:  // ===== ONLINE TRAINING BUFFER (FASE 1) =====
MB-Chat\src\persistence\persistence.service.ts:148:  async saveOnlineTrainingRecord(
MB-Chat\src\persistence\persistence.service.ts:153:    onnxFeatureVector: number[],
MB-Chat\src\persistence\persistence.service.ts:159:  ): Promise<OnlineTrainingBufferDocument> {
MB-Chat\src\persistence\persistence.service.ts:163:      onnxFeatureVector.length > 0 &&
MB-Chat\src\persistence\persistence.service.ts:164:      !onnxFeatureVector.some((v) => !Number.isFinite(v));
MB-Chat\src\persistence\persistence.service.ts:167:    const record = await this.onlineTrainingBufferModel.create({
MB-Chat\src\persistence\persistence.service.ts:172:      onnxFeatureVector,
MB-Chat\src\persistence\persistence.service.ts:180:      usedInTraining: false,
MB-Chat\src\persistence\persistence.service.ts:186:        isFromEarlyTraining: false, // To be set by learning service
MB-Chat\src\persistence\persistence.service.ts:191:      `[OnlineTraining] Saved buffer record for ${incidentId}`,
MB-Chat\src\persistence\persistence.service.ts:199:  async updateOnlineTrainingOutcome(
MB-Chat\src\persistence\persistence.service.ts:205:    await this.onlineTrainingBufferModel.updateOne(
MB-Chat\src\persistence\persistence.service.ts:216:      `[OnlineTraining] Updated outcome for ${incidentId}: ${outcome}`,
MB-Chat\src\persistence\persistence.service.ts:220:  async registerOnlineTrainingActualAction(
MB-Chat\src\persistence\persistence.service.ts:224:    await this.onlineTrainingBufferModel.updateOne(
MB-Chat\src\persistence\persistence.service.ts:235:      `[OnlineTraining] Registered real action for ${incidentId}: ${actionActual}`,
MB-Chat\src\persistence\persistence.service.ts:240:   * Get untrained buffer records (for micro-batch learning)
MB-Chat\src\persistence\persistence.service.ts:242:  async getUntrainedBufferRecords(
MB-Chat\src\persistence\persistence.service.ts:245:  ): Promise<OnlineTrainingBuffer[]> {
MB-Chat\src\persistence\persistence.service.ts:246:    const query: any = { usedInTraining: false };
MB-Chat\src\persistence\persistence.service.ts:252:    return this.onlineTrainingBufferModel
MB-Chat\src\persistence\persistence.service.ts:256:      .lean<OnlineTrainingBuffer[]>();
MB-Chat\src\persistence\persistence.service.ts:260:   * Mark buffer records as used in training
MB-Chat\src\persistence\persistence.service.ts:264:    await this.onlineTrainingBufferModel.updateMany(
MB-Chat\src\persistence\persistence.service.ts:266:      { $set: { usedInTraining: true } },
MB-Chat\src\persistence\persistence.service.ts:269:      `[OnlineTraining] Marked ${incidentIds.length} records as used`,
MB-Chat\src\persistence\persistence.service.ts:276:  async getOnlineTrainingBufferStats(): Promise<{
MB-Chat\src\persistence\persistence.service.ts:278:    untrainedRecords: number;
MB-Chat\src\persistence\persistence.service.ts:282:    const totalRecords = await this.onlineTrainingBufferModel.countDocuments();
MB-Chat\src\persistence\persistence.service.ts:283:    const untrainedRecords = await this.onlineTrainingBufferModel.countDocuments(
MB-Chat\src\persistence\persistence.service.ts:284:      { usedInTraining: false },
MB-Chat\src\persistence\persistence.service.ts:286:    const recordsWithOutcome = await this.onlineTrainingBufferModel.countDocuments(
MB-Chat\src\persistence\persistence.service.ts:289:    const modelVersions = await this.onlineTrainingBufferModel.distinct(
MB-Chat\src\persistence\persistence.service.ts:295:      untrainedRecords,
MB-Chat\src\persistence\persistence.module.ts:11:  OnlineTrainingBuffer,
MB-Chat\src\persistence\persistence.module.ts:12:  OnlineTrainingBufferSchema,
MB-Chat\src\persistence\persistence.module.ts:13:} from './schemas/online-training-buffer.schema';
MB-Chat\src\persistence\persistence.module.ts:31:      { name: OnlineTrainingBuffer.name, schema: OnlineTrainingBufferSchema },
MB-Chat\src\persistence\persistence-sanitization.spec.ts:4:  it('does not pass original sensitive values to online training persistence', async () => {
MB-Chat\src\persistence\persistence-sanitization.spec.ts:17:    await service.saveOnlineTrainingRecord(
MB-Whatsapp\src\dl\predictor.service.ts:2:import * as ort from 'onnxruntime-node';
MB-Secretaria\data\model-registry.json:5:      "path": "models/incident-classifier-v1.0.0.onnx",
MB-Secretaria\data\model-registry.json:13:        "framework": "onnx"
MB-Secretaria\data\model-registry.json:18:      "path": "models/incident-classifier-v1.1.0.onnx",
MB-Secretaria\data\model-registry.json:26:        "framework": "onnx"
MB-Whatsapp\src\dl\model.loader.ts:4:import * as ort from 'onnxruntime-node';
MB-Whatsapp\src\dl\model.loader.ts:19:  private readonly modelPath = join(process.cwd(), 'models', 'anomaly_model.onnx');
MB-Whatsapp\src\dl\model.loader.ts:48:      this.logger.log(`[DL] ONNX model loaded input=${this.session.inputNames[0]}`);
MB-Whatsapp\src\dl\anomaly-predictor.service.ts:2:import * as ort from 'onnxruntime-node';
MB-Chat\src\ml-service\model-registry.service.ts:19:interface ModelRegistry {
MB-Chat\src\ml-service\model-registry.service.ts:27:export class ModelRegistryService {
MB-Chat\src\ml-service\model-registry.service.ts:28:  private readonly logger = new Logger(ModelRegistryService.name);
MB-Chat\src\ml-service\model-registry.service.ts:29:  private readonly registryPath = join(process.cwd(), 'models', 'registry.json');
MB-Chat\src\ml-service\model-registry.service.ts:30:  private registry: ModelRegistry | null = null;
MB-Chat\src\ml-service\model-registry.service.ts:35:   * Get model registry with caching
MB-Chat\src\ml-service\model-registry.service.ts:37:  async getRegistry(): Promise<ModelRegistry> {
MB-Chat\src\ml-service\model-registry.service.ts:39:    if (!this.registry || (now - this.lastLoadTime) > this.CACHE_TTL) {
MB-Chat\src\ml-service\model-registry.service.ts:40:      await this.loadRegistry();
MB-Chat\src\ml-service\model-registry.service.ts:42:    return this.registry!;
MB-Chat\src\ml-service\model-registry.service.ts:49:    const registry = await this.getRegistry();
MB-Chat\src\ml-service\model-registry.service.ts:52:      if (!registry.current_production) return null;
MB-Chat\src\ml-service\model-registry.service.ts:53:      return registry.versions.find(v => v.version === registry.current_production) || null;
MB-Chat\src\ml-service\model-registry.service.ts:57:      if (!registry.staging) return null;
MB-Chat\src\ml-service\model-registry.service.ts:58:      return registry.versions.find(v => v.version === registry.staging) || null;
MB-Chat\src\ml-service\model-registry.service.ts:61:    return registry.versions.find(v => v.version === version) || null;
MB-Chat\src\ml-service\model-registry.service.ts:68:    const registry = await this.getRegistry();
MB-Chat\src\ml-service\model-registry.service.ts:69:    return registry.versions;
MB-Chat\src\ml-service\model-registry.service.ts:76:    const registry = await this.getRegistry();
MB-Chat\src\ml-service\model-registry.service.ts:77:    if (!registry.current_production) return null;
MB-Chat\src\ml-service\model-registry.service.ts:78:    return registry.versions.find(v => v.version === registry.current_production) || null;
MB-Chat\src\ml-service\model-registry.service.ts:93:    return join(process.cwd(), 'models', version, 'decision_model.onnx');
MB-Chat\src\ml-service\model-registry.service.ts:97:   * Force reload registry from disk
MB-Chat\src\ml-service\model-registry.service.ts:99:  async reloadRegistry(): Promise<void> {
MB-Chat\src\ml-service\model-registry.service.ts:100:    await this.loadRegistry();
MB-Chat\src\ml-service\model-registry.service.ts:103:  private async loadRegistry(): Promise<void> {
MB-Chat\src\ml-service\model-registry.service.ts:105:      if (!existsSync(this.registryPath)) {
MB-Chat\src\ml-service\model-registry.service.ts:106:        this.logger.warn(`[Registry] Registry file not found: ${this.registryPath}`);
MB-Chat\src\ml-service\model-registry.service.ts:107:        this.registry = {
MB-Chat\src\ml-service\model-registry.service.ts:116:      const raw = readFileSync(this.registryPath, 'utf-8');
MB-Chat\src\ml-service\model-registry.service.ts:117:      this.registry = JSON.parse(raw);
MB-Chat\src\ml-service\model-registry.service.ts:120:      if (this.registry) {
MB-Chat\src\ml-service\model-registry.service.ts:121:        this.logger.debug(`[Registry] Loaded ${this.registry.versions.length} model versions`);
MB-Chat\src\ml-service\model-registry.service.ts:126:      this.logger.error(`[Registry] Failed to load registry: ${msg}`);
MB-Chat\src\ml-service\model-monitor.service.ts:14:  train_accuracy?: number;
MB-Chat\src\ml-service\model-monitor.service.ts:119:    const baselineTrainAccuracy = this.safeNumber(baseline.train_accuracy, baselineAccuracy);
MB-Chat\src\ml-service\model-monitor.service.ts:131:    const currentOverfitting = Math.max(0, baselineTrainAccuracy - currentAccuracy);
MB-Chat\src\ml-service\ml-service.service.ts:2:import { ModelRegistryService } from './model-registry.service';
MB-Chat\src\ml-service\ml-service.service.ts:38:    private readonly registry: ModelRegistryService,
MB-Chat\src\ml-service\ml-service.service.ts:54:      const modelInfo = await this.registry.getProductionVersion();
MB-Chat\src\ml-service\ml-service.service.ts:136:      const loadedModels = ['decision_model.onnx'];
MB-Chat\src\ml-service\ml-service.service.ts:170:    const registry = await this.registry.getRegistry();
MB-Chat\src\ml-service\ml-service.service.ts:172:      production: registry.current_production,
MB-Chat\src\ml-service\ml-service.service.ts:173:      staging: registry.staging,
MB-Chat\src\ml-service\ml-service.service.ts:174:      available: registry.versions.map(v => v.version),
MB-Whatsapp\production-safety\types.ts:57:export type RollbackRegistryEntry = {
MB-Chat\src\ml-service\ml-service.module.ts:4:import { ModelRegistryService } from './model-registry.service';
MB-Chat\src\ml-service\ml-service.module.ts:13:  providers: [MlServiceService, ModelRegistryService, MetricsService, ModelMonitorService],
api\app\api\v1\endpoints\health.py:19:from shared.utils.resilience import CircuitBreakerRegistry
api\app\api\v1\endpoints\health.py:185:    circuits = await CircuitBreakerRegistry.snapshot_all()
MB-Whatsapp\production-safety\safety-report.ts:1:import { buildRollbackRegistry } from "./rollback-registry";
MB-Whatsapp\production-safety\safety-report.ts:9:    rollback_registry: buildRollbackRegistry(),
MB-Whatsapp\production-safety\rollback-registry.ts:1:import type { ProductionLayer, RollbackRegistryEntry } from "./types";
MB-Whatsapp\production-safety\rollback-registry.ts:3:export function buildRollbackRegistry(): RollbackRegistryEntry[] {
MB-Whatsapp\production-safety\rollback-registry.ts:5:    entry("semantic_memory", "MEMORY_ROLLBACK_PLAN.md", ["MetaBrain/memory", "MetaBrain/memory_py"], ["SEMANTIC_MEMORY_ENABLED", "SEMANTIC_MEMORY_WRITE_ENABLED", "SEMANTIC_MEMORY_VECTOR_ENABLED"]),
MB-Whatsapp\production-safety\rollback-registry.ts:15:function entry(layer: ProductionLayer, rollback_doc: string, files_created: string[], flags_to_disable: string[]): RollbackRegistryEntry {
MB-Whatsapp\production-safety\README.md:27:- Rollback registry.
MB-Secretaria\models\reports\recommendation_v4.json:29:      "message": "More or equal training samples"
MB-Secretaria\models\reports\recommendation_v14.json:30:      "message": "More or equal training samples"
MB-Secretaria\models\reports\recommendation_v15.json:30:      "message": "More or equal training samples"
MB-Chat\src\ml-core\predictor.service.ts:2:import * as ort from 'onnxruntime-node';
MB-Chat\src\ml-core\predictor.service.ts:37:    const featureVector = this.featureBuilder.buildFeatures(
MB-Chat\src\ml-core\predictor.service.ts:51:      const tensor = new ort.Tensor('float32', Float32Array.from(featureVector), [1, featureVector.length]);
MB-Chat\src\ml-core\predictor.service.ts:59:      const topFeatures = this.computeTopFeatures(featureVector);
MB-Chat\src\ml-core\predictor.service.ts:68:      this.logger.error(`ONNX prediction failed: ${msg}`);
MB-Chat\src\ml-core\predictor.service.ts:85:  private computeTopFeatures(featureVector: number[], topN = 5): MlTopFeature[] {
MB-Chat\src\ml-core\predictor.service.ts:87:    if (globalImportances.length === 0 || featureVector.length === 0) return [];
MB-Chat\src\ml-core\predictor.service.ts:96:      const value = featureIdx >= 0 && featureIdx < featureVector.length
MB-Chat\src\ml-core\predictor.service.ts:97:        ? featureVector[featureIdx]
MB-Secretaria\models\reports\recommendation_v13.json:30:      "message": "More or equal training samples"
MB-Whatsapp\src\learning\learning.service.ts:129:  async retrainModel() {
MB-Whatsapp\src\learning\learning.service.ts:130:    this.logger.log('[Learning] Starting model retraining');
MB-Whatsapp\src\learning\learning.service.ts:135:      const retrainCommand = [
MB-Whatsapp\src\learning\learning.service.ts:136:        `${pythonCmd} scripts/extract_real_dataset.py`,
MB-Whatsapp\src\learning\learning.service.ts:137:        `${pythonCmd} scripts/data_pipeline.py --input-dir data/production_dataset --output-dir data/processed --dataset-type production`,
MB-Whatsapp\src\learning\learning.service.ts:138:        `${pythonCmd} scripts/train_model.py`,
MB-Whatsapp\src\learning\learning.service.ts:141:      const { stdout, stderr } = await execAsync(retrainCommand);
MB-Whatsapp\src\learning\learning.service.ts:142:      this.logger.log(`[Learning] Retraining completed: ${stdout}`);
MB-Whatsapp\src\learning\learning.service.ts:143:      if (stderr) this.logger.warn(`[Learning] Retraining stderr: ${stderr}`);
MB-Whatsapp\src\learning\learning.service.ts:145:      this.logger.error('[Learning] Retraining failed', error);
MB-Whatsapp\production-safety\index.ts:8:export * from "./rollback-registry";
MB-Secretaria\models\reports\recommendation_v7.json:29:      "message": "More or equal training samples"
MB-Secretaria\models\reports\recommendation_v6.json:29:      "message": "More or equal training samples"
MB-Chat\src\ml-core\model.loader.ts:4:import * as ort from 'onnxruntime-node';
MB-Chat\src\ml-core\model.loader.ts:6:interface OnnxMetadata {
MB-Chat\src\ml-core\model.loader.ts:53:  private readonly modelPath = join(process.cwd(), 'models', 'decision_model.onnx');
MB-Chat\src\ml-core\model.loader.ts:54:  private readonly metadataPath = join(process.cwd(), 'models', 'onnx_metadata.json');
MB-Chat\src\ml-core\model.loader.ts:90:      this.logger.warn(`ONNX model not found at ${this.modelPath}`);
MB-Chat\src\ml-core\model.loader.ts:100:        `ONNX model loaded. input=${this.session.inputNames[0]} outputs=${this.session.outputNames.join(',')}`,
MB-Chat\src\ml-core\model.loader.ts:105:      this.logger.error(`Failed to load ONNX model: ${msg}`);
MB-Chat\src\ml-core\model.loader.ts:113:    this.logger.log('Reloading ONNX model and metadata...');
MB-Chat\src\ml-core\model.loader.ts:119:      this.logger.log(`ONNX reload completed at ${this.loadedAt ?? 'unknown'}`);
MB-Chat\src\ml-core\model.loader.ts:121:      this.logger.warn('ONNX reload failed; previous session is unavailable');
MB-Chat\src\ml-core\model.loader.ts:164:      this.logger.warn(`ONNX metadata not found at ${this.metadataPath}`);
MB-Chat\src\ml-core\model.loader.ts:170:      const parsed = JSON.parse(raw) as OnnxMetadata;
MB-Chat\src\ml-core\model.loader.ts:195:      this.logger.log(`Loaded ONNX action classes: ${this.actionClasses.length} schema=${this.metadataInfo.featureSchemaVersion}`);
MB-Chat\src\ml-core\model.loader.ts:198:      this.logger.error(`Failed to load ONNX metadata: ${msg}`);
MB-Secretaria\models\reports\recommendation_v5.json:29:      "message": "More or equal training samples"
MB-Secretaria\models\reports\recommendation_v8.json:29:      "message": "More or equal training samples"
MB-Chat\src\ml-core\feature-builder.ts:16:interface OnnxMetadata {
MB-Chat\src\ml-core\feature-builder.ts:71:  private readonly metadataPath = join(process.cwd(), 'models', 'onnx_metadata.json');
MB-Chat\src\ml-core\feature-builder.ts:73:  private metadata: OnnxMetadata = {
MB-Chat\src\ml-core\feature-builder.ts:177:    const vector = this.metadata.feature_names.map((name) => this.ensureNumeric(byName[name]));
MB-Chat\src\ml-core\feature-builder.ts:179:    if (vector.length !== this.metadata.num_features) {
MB-Chat\src\ml-core\feature-builder.ts:181:        `Feature length mismatch: expected ${this.metadata.num_features}, got ${vector.length}`,
MB-Chat\src\ml-core\feature-builder.ts:185:    return vector;
MB-Chat\src\ml-core\feature-builder.ts:202:  /** Returns the zero-based index of a feature name in the model's feature vector, or -1 if not found. */
MB-Chat\src\ml-core\feature-builder.ts:220:      this.logger.warn(`ONNX metadata not found at ${this.metadataPath}`);
MB-Chat\src\ml-core\feature-builder.ts:226:      const parsed = JSON.parse(raw) as OnnxMetadata;
MB-Chat\src\ml-core\feature-builder.ts:243:        `Loaded ONNX metadata: ${this.metadata.feature_names.length} features schema=${this.metadata.feature_schema_version ?? 'unknown'} pipeline=${this.metadata.pipeline_version ?? 'unknown'}`,
MB-Chat\src\ml-core\feature-builder.ts:247:      this.logger.error(`Failed to load ONNX metadata: ${msg}`);
MB-Chat\src\ml-core\feature-builder.ts:248:      this.schemaValidationError = `onnx_metadata_load_error: ${msg}`;
MB-Chat\src\ml-core\feature-builder.ts:252:  private validateSchema(metadata: OnnxMetadata): string | null {
MB-Whatsapp\package.json:27:    "onnxruntime-node": "^1.24.3",
MB-Whatsapp\package.json:28:    "onnxruntime-web": "^1.18.0",
MB-Whatsapp\src\common\types\brain.types.ts:99:  onnxFeatureVector?: number[];
MB-Chat\src\ml\online-learning.service.ts:9:import { OnlineTrainingBuffer } from '../persistence/schemas/online-training-buffer.schema';
MB-Chat\src\ml\online-learning.service.ts:18: * - FASE 4: Incremental dataset generation + retraining
MB-Chat\src\ml\online-learning.service.ts:22: * Runs every X minutes to collect feedback and decide if retraining is needed.
MB-Chat\src\ml\online-learning.service.ts:27:  private isRetrainingInProgress = false;
MB-Chat\src\ml\online-learning.service.ts:28:  private lastRetrainingTime: Date | null = null;
MB-Chat\src\ml\online-learning.service.ts:37:   * Runs every 5 minutes to check if we should retrain
MB-Chat\src\ml\online-learning.service.ts:41:    if (this.isRetrainingInProgress) {
MB-Chat\src\ml\online-learning.service.ts:42:      this.logger.debug('[OnlineLearning] Retraining already in progress, skipping');
MB-Chat\src\ml\online-learning.service.ts:50:        `[OnlineLearning] Buffer stats: total=${stats.totalRecords}, untrained=${stats.untrainedRecords}, with_outcome=${stats.recordsWithOutcome}`,
MB-Chat\src\ml\online-learning.service.ts:53:      // Decision: retrain if we have enough new, quality feedback
MB-Chat\src\ml\online-learning.service.ts:54:      const shouldRetrain = await this.shouldTriggerRetrain(stats);
MB-Chat\src\ml\online-learning.service.ts:55:      if (!shouldRetrain) {
MB-Chat\src\ml\online-learning.service.ts:57:          '[OnlineLearning] Insufficient data for retraining, deferring',
MB-Chat\src\ml\online-learning.service.ts:62:      await this.executeIncrementalRetrain();
MB-Chat\src\ml\online-learning.service.ts:70:   * FASE 3: Check if retraining is warranted
MB-Chat\src\ml\online-learning.service.ts:72:  private async shouldTriggerRetrain(stats: {
MB-Chat\src\ml\online-learning.service.ts:74:    untrainedRecords: number;
MB-Chat\src\ml\online-learning.service.ts:79:    const MIN_UNTRAINED_WITH_OUTCOME = 20;
MB-Chat\src\ml\online-learning.service.ts:80:    if (stats.recordsWithOutcome < MIN_UNTRAINED_WITH_OUTCOME) {
MB-Chat\src\ml\online-learning.service.ts:84:    // Throttle: don't retrain more often than every 30 minutes
MB-Chat\src\ml\online-learning.service.ts:85:    if (this.lastRetrainingTime) {
MB-Chat\src\ml\online-learning.service.ts:86:      const timeSinceLastRetrain = Date.now() - this.lastRetrainingTime.getTime();
MB-Chat\src\ml\online-learning.service.ts:87:      const MIN_RETRAIN_INTERVAL_MS = 30 * 60 * 1000;
MB-Chat\src\ml\online-learning.service.ts:88:      if (timeSinceLastRetrain < MIN_RETRAIN_INTERVAL_MS) {
MB-Chat\src\ml\online-learning.service.ts:90:          `[OnlineLearning] Throttled: only ${(timeSinceLastRetrain / 1000).toFixed(0)}s since last retrain`,
MB-Chat\src\ml\online-learning.service.ts:100:   * FASE 4: Execute incremental retraining pipeline
MB-Chat\src\ml\online-learning.service.ts:102:  private async executeIncrementalRetrain(): Promise<void> {
MB-Chat\src\ml\online-learning.service.ts:103:    this.isRetrainingInProgress = true;
MB-Chat\src\ml\online-learning.service.ts:104:    this.lastRetrainingTime = new Date();
MB-Chat\src\ml\online-learning.service.ts:106:    this.logger.log('[OnlineLearning] Starting incremental retraining...');
MB-Chat\src\ml\online-learning.service.ts:109:      // Step 1: Load untrained buffer records
MB-Chat\src\ml\online-learning.service.ts:119:      if (!this.isBatchValidForTraining(bufferRecords)) {
MB-Chat\src\ml\online-learning.service.ts:120:        this.logger.warn('[OnlineLearning] Invalid/corrupt records detected in batch. Retrain skipped.');
MB-Chat\src\ml\online-learning.service.ts:125:        `[OnlineLearning] Processing ${bufferRecords.length} buffer records for retraining`,
MB-Chat\src\ml\online-learning.service.ts:128:      // Step 2: Export incremental dataset from buffer
MB-Chat\src\ml\online-learning.service.ts:129:      const incrementalDataPath = await this.exportIncrementalDataset(bufferRecords);
MB-Chat\src\ml\online-learning.service.ts:131:        `[OnlineLearning] Exported incremental dataset: ${incrementalDataPath}`,
MB-Chat\src\ml\online-learning.service.ts:134:      // Step 3: Trigger Python retraining script with incremental data
MB-Chat\src\ml\online-learning.service.ts:135:      const trainResult = await this.executeIncrementalTraining(incrementalDataPath);
MB-Chat\src\ml\online-learning.service.ts:136:      if (!trainResult.success) {
MB-Chat\src\ml\online-learning.service.ts:138:          `[OnlineLearning] Training failed: ${trainResult.error}`,
MB-Chat\src\ml\online-learning.service.ts:144:      if (trainResult.gateResult?.passed) {
MB-Chat\src\ml\online-learning.service.ts:148:        // Mark these records as used in training
MB-Chat\src\ml\online-learning.service.ts:157:          `Gate checks: ${JSON.stringify(trainResult.gateResult?.checks)}`,
MB-Chat\src\ml\online-learning.service.ts:163:        `[OnlineLearning] Incremental retrain failed: ${msg}`,
MB-Chat\src\ml\online-learning.service.ts:166:      this.isRetrainingInProgress = false;
MB-Chat\src\ml\online-learning.service.ts:171:   * FASE 3: Export buffer records as CSV for training
MB-Chat\src\ml\online-learning.service.ts:173:  private async exportIncrementalDataset(
MB-Chat\src\ml\online-learning.service.ts:174:    bufferRecords: OnlineTrainingBuffer[],
MB-Chat\src\ml\online-learning.service.ts:181:      `training_buffer_${timestamp}.csv`,
MB-Chat\src\ml\online-learning.service.ts:239:   * FASE 4: Execute Python incremental training
MB-Chat\src\ml\online-learning.service.ts:241:  private async executeIncrementalTraining(
MB-Chat\src\ml\online-learning.service.ts:254:      'train_model_incremental.py',
MB-Chat\src\ml\online-learning.service.ts:273:      // Check if training succeeded (look for deployment gate result in output)
MB-Chat\src\ml\online-learning.service.ts:291:        `[OnlineLearning] Training completed. Gate passed: ${gatePassed}`,
MB-Chat\src\ml\online-learning.service.ts:312:   * Manual trigger for on-demand retraining (via API endpoint)
MB-Chat\src\ml\online-learning.service.ts:314:  async triggerManualRetrain(): Promise<{
MB-Chat\src\ml\online-learning.service.ts:318:    if (this.isRetrainingInProgress) {
MB-Chat\src\ml\online-learning.service.ts:321:        message: 'Retraining is already in progress',
MB-Chat\src\ml\online-learning.service.ts:327:      void this.executeIncrementalRetrain(); // Fire and forget
MB-Chat\src\ml\online-learning.service.ts:330:        message: `Started incremental retraining with ${stats.untrainedRecords} untrained records`,
MB-Chat\src\ml\online-learning.service.ts:345:    isRetrainingInProgress: boolean;
MB-Chat\src\ml\online-learning.service.ts:346:    lastRetrainingTime: Date | null;
MB-Chat\src\ml\online-learning.service.ts:349:      isRetrainingInProgress: this.isRetrainingInProgress,
MB-Chat\src\ml\online-learning.service.ts:350:      lastRetrainingTime: this.lastRetrainingTime,
MB-Chat\src\ml\online-learning.service.ts:356:    untrainedRecords: number;
MB-Chat\src\ml\online-learning.service.ts:362:    const untrainedRecords = sample.length;
MB-Chat\src\ml\online-learning.service.ts:367:      untrainedRecords,
MB-Chat\src\ml\online-learning.service.ts:373:  private isBatchValidForTraining(batch: OnlineTrainingBuffer[]): boolean {
MB-Chat\src\ml\online-learning.service.ts:377:      if (!Array.isArray(row.onnxFeatureVector) || row.onnxFeatureVector.length === 0) {
MB-Chat\src\ml\online-learning.service.ts:383:      if (row.onnxFeatureVector.some((v) => !Number.isFinite(v))) {
MB-Chat\src\ml\online-learning.service.ts:394:    // Safety: avoid training with one single class only.
MB-Whatsapp\core\layer-registry.ts:23:export const PHASE_2_LAYER_REGISTRY: LayerRegistration[] = [
MB-Chat\src\ml\online-buffer.service.ts:2:import { OnlineTrainingBuffer } from '../persistence/schemas/online-training-buffer.schema';
MB-Chat\src\ml\online-buffer.service.ts:13:    featureVector: number[];
MB-Chat\src\ml\online-buffer.service.ts:20:    await this.persistenceService.saveOnlineTrainingRecord(
MB-Chat\src\ml\online-buffer.service.ts:25:      event.featureVector,
MB-Chat\src\ml\online-buffer.service.ts:39:  async getBatch(limit = 100): Promise<OnlineTrainingBuffer[]> {
MB-Chat\src\ml\online-buffer.service.ts:40:    return this.persistenceService.getUntrainedBufferRecords(limit, true);
MB-Chat\src\ml\online-buffer.service.ts:50:    await this.persistenceService.updateOnlineTrainingOutcome(
MB-Chat\src\ml\online-buffer.service.ts:57:      await this.persistenceService.registerOnlineTrainingActualAction(
MB-Chat\src\ml\model.service.ts:25:  featureVector?: number[];
MB-Chat\src\ml\model.service.ts:45:   * @param features Enriched feature vector with learning-based signals
MB-Chat\src\ml\model.service.ts:69:        featureVector: [],
MB-Chat\src\ml\model.service.ts:75:    let featureVector: number[] = [];
MB-Chat\src\ml\model.service.ts:78:      featureVector = this.featureBuilder.buildFeatures(incident, features, strategy, rulesAction);
MB-Chat\src\ml\model.service.ts:98:        featureVector,
MB-Chat\src\ml\model.service.ts:126:      error: modelUsed ? undefined : 'onnx_prediction_unavailable',
MB-Chat\src\ml\model.service.ts:128:      featureVector,
MB-Chat\src\ml\ml.controller.ts:31:    return this.onlineLearningService.triggerManualRetrain();
MB-Chat\src\ml\ml.controller.ts:37:    isRetrainingInProgress: boolean;
MB-Chat\src\ml\ml.controller.ts:38:    lastRetrainingTime: Date | null;
MB-Whatsapp\src\knowledge\schemas\medical-document.schema.ts:12:  embedding!: number[];
MB-Whatsapp\src\knowledge\knowledge.module.ts:8:import { EmbeddingService } from './embedding.service';
MB-Whatsapp\src\knowledge\knowledge.module.ts:20:    EmbeddingService,
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:4:import { EmbeddingService } from './embedding.service';
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:26:    private readonly embeddingService: EmbeddingService,
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:36:      const embedding = this.embeddingService.embed(content);
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:44:            embedding,
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:70:    const queryEmbedding = this.embeddingService.embed(query);
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:72:    // Alternative to pgvector: compute cosine in app layer over curated corpus.
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:81:        const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, r.embedding ?? []);
MB-Whatsapp\src\knowledge\embedding.service.ts:4:export class EmbeddingService {
MB-Whatsapp\src\knowledge\embedding.service.ts:7:  // Lightweight local embedding alternative: hashed token embedding.
MB-Whatsapp\src\knowledge\embedding.service.ts:8:  // Avoids external embedding API dependency while enabling semantic-ish retrieval.
MB-Whatsapp\providers\types.ts:2:export type ProviderRequestType = "chat" | "completion" | "embedding" | "vision" | "multimodal" | "healthcheck";
MB-Whatsapp\providers\provider-registry.ts:3:export class ProviderRegistry {
MB-Whatsapp\models\v9\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v9\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v9\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v9\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v9\metrics.json:31:  "num_train_samples": 168,
MB-Whatsapp\providers\index.ts:13:export * from "./provider-registry";
MB-Whatsapp\src\brain\brain.service.ts:244:        // Low confidence or ONNX failure: fallback to rules.
MB-Whatsapp\src\brain\brain.service.ts:310:        onnxFeatureVector: mlResult.featureVector,
MB-Whatsapp\src\brain\brain.service.ts:332:      // Save to online training buffer for micro-batch learning
MB-Whatsapp\src\brain\brain.service.ts:340:            await this.persistenceService.saveOnlineTrainingRecord(
MB-Whatsapp\src\brain\brain.service.ts:345:              mlResult.featureVector ?? [],
MB-Whatsapp\src\brain\brain.service.ts:358:          `[OnlineTraining] Save buffer record for ${normalizedInput.id}`,
MB-Whatsapp\src\brain\brain.service.ts:369:            this.persistenceService.updateOnlineTrainingOutcome(
MB-Whatsapp\src\brain\brain.service.ts:375:            `[OnlineTraining] update outcome blocked for ${normalizedInput.id}`,
MB-Whatsapp\src\brain\brain.service.ts:445:        this.persistenceService.updateOnlineTrainingOutcome(
MB-Whatsapp\src\brain\brain.service.ts:451:        `[OnlineTraining] update outcome for ${normalizedInput.id}`,
MB-Whatsapp\src\brain\brain.service.ts:495:        this.persistenceService.updateOnlineTrainingOutcome(
MB-Whatsapp\src\brain\brain.service.ts:501:        `[OnlineTraining] update outcome failure for ${normalizedInput.id ?? input.id}`,
MB-Chat\src\medical-assistant\medical-assistant.service.ts:122:      await this.medicalChatLearningService.recordAndTrain({
MB-Chat\src\medical-assistant\medical-assistant.service.ts:374:      await this.medicalChatLearningService.recordAndTrain({
MB-Chat\src\medical-assistant\medical-assistant.service.ts:452:      await this.medicalChatLearningService.recordAndTrain({
MB-Whatsapp\cerebro_ai_med\tests\test_stepc_health_observability.py:63:    assert checks["model_registry_exists"] is True
MB-Whatsapp\cerebro_ai_med\tests\test_stepc_health_observability.py:73:    assert model_health["checks"]["registry_exists"] is True
MB-Whatsapp\cerebro_ai_med\tests\test_stepc_health_observability.py:74:    assert model_health["checks"]["registry_parse_ok"] is True
MB-Whatsapp\cerebro_ai_med\tests\test_stepc_health_observability.py:91:    assert checks["registry_exists"] is True
MB-Whatsapp\cerebro_ai_med\tests\test_stepc_health_observability.py:92:    assert checks["registry_parse_ok"] is True
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:88:    recordAndTrain: jest.fn(async () => ({
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:102:    jest.spyOn(medicalChatLearningServiceMock, 'recordAndTrain').mockResolvedValue({
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:237:    const recordSpy = jest.spyOn(medicalChatLearningServiceMock, 'recordAndTrain');
MB-Whatsapp\models\v8\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v8\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v8\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v8\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v8\metrics.json:31:  "num_train_samples": 168,
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:11:from cerebro_ai_med.models.registry import compute_sha256, parse_active_spec
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:14:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:15:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:26:    assert REGISTRY_PATH.exists(), f"registry_not_found: {REGISTRY_PATH}"
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:27:    spec = parse_active_spec(REGISTRY_PATH)
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:31:    # Integrity check against registry checksums.
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:48:def test_model_loader_and_runtime_inference_with_persisted_artifacts(active_model_spec) -> None:
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:51:    # Loader must expose active version from persisted registry.
MB-Whatsapp\cerebro_ai_med\tests\test_inference_hardening.py:13:from cerebro_ai_med.models.registry import parse_active_spec
MB-Whatsapp\cerebro_ai_med\tests\test_inference_hardening.py:16:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Whatsapp\cerebro_ai_med\tests\test_inference_hardening.py:17:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Whatsapp\cerebro_ai_med\tests\test_inference_hardening.py:53:    assert REGISTRY_PATH.exists(), f"registry_not_found: {REGISTRY_PATH}"
MB-Whatsapp\cerebro_ai_med\tests\test_inference_hardening.py:54:    return parse_active_spec(REGISTRY_PATH)
MB-Whatsapp\cerebro_ai_med\tests\step2_model_demo.py:7:from cerebro_ai_med.models.train_models import train_and_save_models
MB-Whatsapp\cerebro_ai_med\tests\step2_model_demo.py:13:    train_and_save_models()
MB-Chat\src\medical-assistant\learning\semantic-memory.hybrid.spec.ts:38:    await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\semantic-memory.hybrid.spec.ts:102:    const safeRecord = await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\semantic-memory.hybrid.spec.ts:131:    const unsafeRecord = await service.recordAndTrain({
MB-Whatsapp\models\v7\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v7\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v7\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v7\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v7\metrics.json:31:  "num_train_samples": 168,
MB-Whatsapp\cerebro_ai_med\tests\integration_distributed_real.py:112:        assert history["items"][-1]["embedding_slot"]["status"] == "pending"
MB-Whatsapp\cerebro_ai_med\tests\integration_distributed_real.py:113:        assert history["items"][-1]["embedding_slot"]["vector_ref"]
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:66:  allowedForTraining: boolean;
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:281:    const allowedForTraining = this.isAllowedForTraining({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:321:      allowedForTraining,
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:360:  async recordAndTrain(input: HybridLearningInput): Promise<MedicalChatLearningRecord> {
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:444:    const acceptedLearningRecords = this.records.filter((record) => record.allowedForTraining).length;
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:786:      .filter((item) => /(evaluar|considerar|priorizar|vigilar|derivar|escalar|guias|evidencia|contexto|alarma|urgencia|contraind)/i.test(item));
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:885:  private isAllowedForTraining(input: {
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.ts:975:      allowedForTraining: false,
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:131:    const record = await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:177:    const record = await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:200:    expect(record.allowedForTraining).toBe(false);
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:222:    const record = await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:251:    expect(record.allowedForTraining).toBe(true);
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:273:    await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:339:    await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:367:    await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:420:    const record = await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:448:    expect(record.allowedForTraining).toBe(false);
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:470:    const record = await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:516:    const record = await service.recordAndTrain({
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:527:    expect(record.allowedForTraining).toBe(true);
MB-Chat\src\medical-assistant\learning\medical-chat-learning.service.spec.ts:546:    const record = await service.recordAndTrain({
MB-Whatsapp\cerebro_ai_med\requirements.txt:7:onnxruntime==1.19.2
MB-Whatsapp\cerebro_ai_med\requirements.txt:8:faiss-cpu==1.8.0.post1
MB-Whatsapp\cerebro_ai_med\README.md:3:Proyecto modular de IA medica con FastAPI, PyTorch, MONAI, Ollama, ONNX Runtime y FAISS.
MB-Whatsapp\cerebro_ai_med\README.md:21:- models/artifacts/text/{version}/text_risk_pipeline.joblib
MB-Whatsapp\cerebro_ai_med\README.md:22:- models/artifacts/image/{version}/image_risk_pipeline.joblib
MB-Whatsapp\cerebro_ai_med\README.md:23:- models/artifacts/metadata.json
MB-Whatsapp\cerebro_ai_med\README.md:157:- `/health/ready`: valida readiness real (API key configurada, registry presente, modelo activo valido, integridad de artefactos y servicio de modelo cargado).
MB-Whatsapp\cerebro_ai_med\README.md:158:- `/health/model`: health check profundo del modelo (estado de registry, version activa, existencia de artefactos y checksums SHA-256 por artefacto).
MB-Whatsapp\src\guard\guard.service.ts:3:import { SAFE_COMMANDS } from '../execution/command.registry';
MB-Whatsapp\data\model-registry.json:5:      "path": "models/incident-classifier-v1.0.0.onnx",
MB-Whatsapp\data\model-registry.json:13:        "framework": "onnx"
MB-Whatsapp\data\model-registry.json:18:      "path": "models/incident-classifier-v1.1.0.onnx",
MB-Whatsapp\data\model-registry.json:26:        "framework": "onnx"
MB-Whatsapp\models\v6\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v6\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v6\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v6\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v6\metrics.json:31:  "num_train_samples": 1,
MB-Chat\package.json:29:    "onnxruntime-node": "^1.24.3",
MB-Chat\package.json:30:    "onnxruntime-web": "^1.18.0",
MB-Whatsapp\src\action-engine\action.service.ts:3:import { SAFE_COMMANDS } from '../execution/command.registry';
MB-Whatsapp\models\v5\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v5\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v5\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v5\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v5\metrics.json:27:  "num_train_samples": 1,
MB-Whatsapp\src\execution\powershell.executor.ts:4:import { SAFE_COMMANDS } from './command.registry';
MB-Whatsapp\src\execution\powershell.executor.ts:46:    // C2: Metacharacter guard — detect any shell injection even from registry entries
MB-Whatsapp\src\execution\execution-denied-status.spec.ts:57:      updateOnlineTrainingOutcome: jest.fn().mockResolvedValue(undefined),
MB-Whatsapp\src\execution\execution-denied-status.spec.ts:58:      saveOnlineTrainingRecord: jest.fn().mockResolvedValue(undefined),
MB-Whatsapp\src\execution\execution-denied-status.spec.ts:88:          featureVector: [],
MB-Whatsapp\src\execution\execution.service.ts:3:import { SAFE_COMMANDS } from './command.registry';
MB-Whatsapp\src\execution\execution.service.ts:41:    // --- Gate 3: registry tier check ---
MB-Whatsapp\src\execution\execution.service.ts:43:      return this.denied(action, `Action blocked by registry policy: ${action.command}`, rollbackHint);
MB-Whatsapp\src\execution\command.registry.ts:6:export interface CommandRegistryEntry {
MB-Whatsapp\src\execution\command.registry.ts:14:export const SAFE_COMMANDS: Record<CommandId, CommandRegistryEntry> = {
MB-Whatsapp\cerebro_ai_med\models\train_models.py:7:from sklearn.feature_extraction import DictVectorizer
MB-Whatsapp\cerebro_ai_med\models\train_models.py:8:from sklearn.feature_extraction.text import TfidfVectorizer
MB-Whatsapp\cerebro_ai_med\models\train_models.py:11:from sklearn.model_selection import train_test_split
MB-Whatsapp\cerebro_ai_med\models\train_models.py:14:from cerebro_ai_med.models.registry import compute_sha256, ensure_semver, utc_now_iso
MB-Whatsapp\cerebro_ai_med\models\train_models.py:15:from cerebro_ai_med.models.training_data import build_image_dataset, build_text_dataset
MB-Whatsapp\cerebro_ai_med\models\train_models.py:18:ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MB-Whatsapp\cerebro_ai_med\models\train_models.py:19:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Whatsapp\cerebro_ai_med\models\train_models.py:24:def _train_text_pipeline() -> tuple[Pipeline, dict[str, float]]:
MB-Whatsapp\cerebro_ai_med\models\train_models.py:25:    dataset = build_text_dataset()
MB-Whatsapp\cerebro_ai_med\models\train_models.py:26:    x_train, x_test, y_train, y_test = train_test_split(
MB-Whatsapp\cerebro_ai_med\models\train_models.py:27:        dataset.texts,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:28:        dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:31:        stratify=dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:36:            ("vectorizer", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=6000)),
MB-Whatsapp\cerebro_ai_med\models\train_models.py:49:    pipeline.fit(x_train, y_train)
MB-Whatsapp\cerebro_ai_med\models\train_models.py:61:def _train_image_pipeline() -> tuple[Pipeline, dict[str, float]]:
MB-Whatsapp\cerebro_ai_med\models\train_models.py:62:    dataset = build_image_dataset(seed=42, n_per_class=260)
MB-Whatsapp\cerebro_ai_med\models\train_models.py:63:    x_train, x_test, y_train, y_test = train_test_split(
MB-Whatsapp\cerebro_ai_med\models\train_models.py:64:        dataset.features,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:65:        dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:68:        stratify=dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:73:            ("vectorizer", DictVectorizer(sparse=False)),
MB-Whatsapp\cerebro_ai_med\models\train_models.py:86:    pipeline.fit(x_train, y_train)
MB-Whatsapp\cerebro_ai_med\models\train_models.py:98:def train_and_save_models() -> dict[str, object]:
MB-Whatsapp\cerebro_ai_med\models\train_models.py:110:    text_pipeline, text_metrics = _train_text_pipeline()
MB-Whatsapp\cerebro_ai_med\models\train_models.py:111:    image_pipeline, image_metrics = _train_image_pipeline()
MB-Whatsapp\cerebro_ai_med\models\train_models.py:124:        "artifacts": {
MB-Whatsapp\cerebro_ai_med\models\train_models.py:140:    registry: dict[str, object]
MB-Whatsapp\cerebro_ai_med\models\train_models.py:141:    if REGISTRY_PATH.exists():
MB-Whatsapp\cerebro_ai_med\models\train_models.py:143:            registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
MB-Whatsapp\cerebro_ai_med\models\train_models.py:145:            registry = {"active_model": version, "models": []}
MB-Whatsapp\cerebro_ai_med\models\train_models.py:147:        registry = {"active_model": version, "models": []}
MB-Whatsapp\cerebro_ai_med\models\train_models.py:149:    models = registry.get("models", [])
MB-Whatsapp\cerebro_ai_med\models\train_models.py:156:    registry["active_model"] = version
MB-Whatsapp\cerebro_ai_med\models\train_models.py:157:    registry["models"] = models
MB-Whatsapp\cerebro_ai_med\models\train_models.py:158:    REGISTRY_PATH.write_text(json.dumps(registry, indent=2), encoding="utf-8")
MB-Whatsapp\cerebro_ai_med\models\train_models.py:164:        "artifacts": {
MB-Whatsapp\cerebro_ai_med\models\train_models.py:179:    result = train_and_save_models()
MB-Whatsapp\cerebro_ai_med\models\training_data.py:12:class TextDataset:
MB-Whatsapp\cerebro_ai_med\models\training_data.py:18:class ImageDataset:
MB-Whatsapp\cerebro_ai_med\models\training_data.py:23:def build_text_dataset() -> TextDataset:
MB-Whatsapp\cerebro_ai_med\models\training_data.py:92:    return TextDataset(texts=texts, labels=labels)
MB-Whatsapp\cerebro_ai_med\models\training_data.py:95:def build_image_dataset(seed: int = 42, n_per_class: int = 240) -> ImageDataset:
MB-Whatsapp\cerebro_ai_med\models\training_data.py:138:    return ImageDataset(features=features, labels=labels)
MB-Chat\MB_CHAT_LOADTEST_IMPLEMENTATION_REPORT.md:77:- No PHI/PII dataset was introduced.
MB-Chat\LONG_TERM_MEMORY_CRITICAL_TRIGGERS_PRECHECK.md:12:  - `recordAndTrain(input)` (entrada operativa desde chat medico)
MB-Chat\LONG_TERM_MEMORY_CRITICAL_TRIGGERS_PRECHECK.md:18:  - `MB-Chat/src/medical-assistant/medical-assistant.service.ts` (varias llamadas `recordAndTrain`)
MB-Chat\LONG_TERM_MEMORY_CRITICAL_TRIGGERS_PRECHECK.md:55:- Sin metodo `_procesar_memoria_largo_plazo` existente, se refinara el punto equivalente (`recordAndTrain/record`) agregando un procesador interno privado con ese nombre para trazabilidad del requerimiento.
MB-Chat\LONG_TERM_MEMORY_CRITICAL_TRIGGERS_PRECHECK.md:56:- Contrato publico se preserva: `recordAndTrain` y `record` mantienen firma y retorno.
MB-Whatsapp\data\processed\memory_history_real_validation.jsonl:1:{"entry_id": "e3e95698-41e3-479c-afe3-0d327f45bb80", "request_id": "69d9ce38-b954-4dc3-843b-0ee02f57ae90", "source": "sync", "created_at_utc": "2026-04-21T20:43:02.394421Z", "input_summary": {"source_type": "text", "modality": "TEXT", "text_length": 60}, "model_output": {"model_name": "production_medical_triage", "model_version": "3.0.0", "risk_level": "medium", "finding_code": "needs_clinical_review", "confidence": 0.486075, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation", "features_used": {"token_count": 9.0, "char_count": 60.0, "active_ngrams": 9.0}}, "decision_output": {"risk_level": "high", "clinical_flag": "urgent", "requires_medical_evaluation": true, "suspected_condition": "pneumonia_possible", "clinical_interpretation": "Patron radiologico compatible con proceso infeccioso pulmonar. Requiere correlacion clinica, examen fisico y confirmacion medica.", "action_plan": "urgent_er_referral", "urgency": "immediate", "follow_up_hours": 0, "red_flags": [], "recommended_tests": ["chest_xray_followup", "cbc", "crp", "pulse_oximetry"], "model_evidence": {"finding": "possible_pneumonia", "finding_code": "needs_clinical_review", "model_risk_level": "medium", "modality": "XRAY", "confidence": 0.4861, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation"}}, "nlg_output": {"text": "El analisis integra hallazgos compatibles con un escenario de riesgo elevado. Existe evidencia indirecta de probable compromiso respiratorio infeccioso. Debe activarse circuito de atencion urgente para confirmacion y manejo. Nivel de confianza del modelo: 0.49. Pruebas sugeridas: chest_xray_followup, cbc, crp, pulse_oximetry.", "style": "technical", "variants_used": ["El analisis integra hallazgos compatibles con un escenario de riesgo elevado.", "Existe evidencia indirecta de probable compromiso respiratorio infeccioso.", "Debe activarse circuito de atencion urgente para confirmacion y manejo."], "disclaimers": ["Salida automatizada de apoyo clinico; no reemplaza criterio medico.", "Requiere correlacion con historia clinica, examen fisico y estudios complementarios."]}, "fallback_used": false, "embedding_slot": {"embedding_id": "6abcd183-1dbd-4527-b6b3-a0573c9e492a", "status": "pending", "model_name": "reserved_for_future_embedding_model", "dimensions": null, "vector_ref": "memory_embeddings/sync/42d6d96c-bbec-4a98-b769-956f4397c1f1", "created_at_utc": "2026-04-21T20:43:02.394444Z"}}
MB-Chat\LONG_TERM_MEMORY_CRITICAL_TRIGGERS_IMPLEMENTATION_REPORT.md:17:  - `recordAndTrain(input)`
MB-Whatsapp\cerebro_ai_med\models\registry.py:66:            if "artifacts" in lowered:
MB-Whatsapp\cerebro_ai_med\models\registry.py:67:                artifact_index = lowered.index("artifacts")
MB-Whatsapp\cerebro_ai_med\models\registry.py:73:        raise RuntimeError("artifact_path_outside_registry_root")
MB-Whatsapp\cerebro_ai_med\models\registry.py:79:    artifacts = entry.get("artifacts", {})
MB-Whatsapp\cerebro_ai_med\models\registry.py:80:    text = artifacts.get("text", {})
MB-Whatsapp\cerebro_ai_med\models\registry.py:81:    image = artifacts.get("image", {})
MB-Whatsapp\cerebro_ai_med\models\registry.py:114:        raise RuntimeError(f"registry_not_found: {metadata_path}")
MB-Whatsapp\cerebro_ai_med\models\registry.py:120:        raise RuntimeError("registry_has_no_models")
MB-Whatsapp\cerebro_ai_med\models\registry.py:135:        raise RuntimeError(f"registry_not_found: {metadata_path}")
MB-Whatsapp\cerebro_ai_med\models\registry.py:140:        raise RuntimeError("registry_has_no_models")
MB-Whatsapp\data\processed\metadata.json:2:  "dataset_type": "synthetic",
MB-Whatsapp\data\processed\metadata.json:3:  "input_dir": "E:\\MetaBrain\\data\\synthetic_dataset",
MB-Whatsapp\data\processed\metadata.json:5:  "train_samples": 168,
MB-Whatsapp\models\v4\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v4\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v4\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v4\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v4\metrics.json:19:  "num_train_samples": 1,
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:13:from cerebro_ai_med.models.registry import ActiveModelSpec, parse_active_spec, parse_best_fallback_spec
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:21:    return Path(os.path.join(os.path.dirname(__file__), "artifacts")).resolve()
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:25:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:142:                f"Model artifact not found: {path}. Run training: "
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:143:                "e:/MetaBrain/.venv/Scripts/python.exe -m cerebro_ai_med.models.train_models"
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:174:        vectorizer = self._state.text_pipeline.named_steps["vectorizer"]
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:177:        x = vectorizer.transform([text])
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:202:                spec = parse_active_spec(REGISTRY_PATH)
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:215:                            metadata_path=REGISTRY_PATH,
MB-Whatsapp\models\v15\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v15\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v15\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v15\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v15\metrics.json:75:  "num_train_samples": 168,
MB-Chat\src\learning\learning.service.ts:129:  async retrainModel() {
MB-Chat\src\learning\learning.service.ts:130:    this.logger.log('[Learning] Starting model retraining');
MB-Chat\src\learning\learning.service.ts:135:      const retrainCommand = [
MB-Chat\src\learning\learning.service.ts:136:        `${pythonCmd} scripts/extract_real_dataset.py`,
MB-Chat\src\learning\learning.service.ts:137:        `${pythonCmd} scripts/data_pipeline.py --input-dir data/production_dataset --output-dir data/processed --dataset-type production`,
MB-Chat\src\learning\learning.service.ts:138:        `${pythonCmd} scripts/train_model.py`,
MB-Chat\src\learning\learning.service.ts:141:      const { stdout, stderr } = await execAsync(retrainCommand);
MB-Chat\src\learning\learning.service.ts:142:      this.logger.log(`[Learning] Retraining completed: ${stdout}`);
MB-Chat\src\learning\learning.service.ts:143:      if (stderr) this.logger.warn(`[Learning] Retraining stderr: ${stderr}`);
MB-Chat\src\learning\learning.service.ts:145:      this.logger.error('[Learning] Retraining failed', error);
MB-Secretaria\models\reports\recommendation_v9.json:29:      "message": "More or equal training samples"
MB-Whatsapp\cerebro_ai_med\models\artifacts\model_metadata.json:9:  "artifacts": {
MB-Whatsapp\cerebro_ai_med\models\artifacts\model_metadata.json:10:    "text": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\text\\3.0.0\\text_risk_pipeline.joblib",
MB-Whatsapp\cerebro_ai_med\models\artifacts\model_metadata.json:11:    "image": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\image\\3.0.0\\image_risk_pipeline.joblib"
MB-Whatsapp\cerebro_ai_med\models\artifacts\metadata.json:13:      "artifacts": {
MB-Whatsapp\models\v14\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v14\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v14\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v14\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v14\metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\models\feature_importance_summary.txt:24:Generated Datasets:
MB-Whatsapp\models\feature_importance_summary.txt:25:  ✓ X_train_optimized.csv (37 features)
MB-Whatsapp\models\feature_importance_summary.txt:26:  ✓ X_train_top80_importance.csv (31 features)
MB-Whatsapp\services\inference_service\README.md:9:  - resolucion de version activa en registry,
MB-Whatsapp\models\anomaly_model_metadata.json:93:  "training_stats": {
MB-Whatsapp\models\anomaly_model_metadata.json:97:    "train_normal_sequences": 181,
MB-Whatsapp\models\anomaly_model_metadata.json:100:    "train_error_mean": 0.10589775443077087,
MB-Whatsapp\models\anomaly_model_metadata.json:101:    "train_error_p95": 0.16205891966819763,
MB-Whatsapp\models\v13\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v13\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v13\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v13\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v13\metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\cerebro_ai_med\memory\__init__.py:1:from cerebro_ai_med.memory.schemas import EmbeddingSlot, MemoryHistoryEntry, MemoryHistoryResponse
MB-Whatsapp\cerebro_ai_med\memory\__init__.py:6:	"EmbeddingSlot",
MB-Chat\src\knowledge\schemas\medical-document.schema.ts:12:  embedding!: number[];
MB-Whatsapp\cerebro_ai_med\memory\store.py:10:from cerebro_ai_med.memory.schemas import MemoryHistoryEntry, MemoryHistoryResponse, build_embedding_slot
MB-Whatsapp\cerebro_ai_med\memory\store.py:41:            embedding_slot=build_embedding_slot(source=source),
MB-Whatsapp\scripts\visualize_features.py:138:    # === DATASET SIZE COMPARISON ===
MB-Whatsapp\scripts\visualize_features.py:224:Generated Datasets:
MB-Whatsapp\scripts\visualize_features.py:225:  ✓ X_train_optimized.csv (37 features)
MB-Whatsapp\scripts\visualize_features.py:226:  ✓ X_train_top80_importance.csv (31 features)
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:10:class EmbeddingSlot(BaseModel):
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:13:    embedding_id: str
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:17:    vector_ref: str | None = None
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:33:    embedding_slot: EmbeddingSlot
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:43:def build_embedding_slot(source: str) -> EmbeddingSlot:
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:44:    return EmbeddingSlot(
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:45:        embedding_id=str(uuid4()),
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:47:        model_name="reserved_for_future_embedding_model",
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:49:        vector_ref=f"memory_embeddings/{source}/{uuid4()}",
MB-Chat\src\knowledge\knowledge.module.ts:8:import { EmbeddingService } from './embedding.service';
MB-Chat\src\knowledge\knowledge.module.ts:20:    EmbeddingService,
MB-Whatsapp\scripts\validate_onnx_parity.py:6:import onnxruntime as rt
MB-Whatsapp\scripts\validate_onnx_parity.py:13:    onnx_session = rt.InferenceSession('models/decision_model.onnx')
MB-Whatsapp\scripts\validate_onnx_parity.py:14:    input_name = onnx_session.get_inputs()[0].name
MB-Whatsapp\scripts\validate_onnx_parity.py:21:    # ONNX predictions
MB-Whatsapp\scripts\validate_onnx_parity.py:22:    onnx_input = X_test.astype(np.float32).to_numpy()
MB-Whatsapp\scripts\validate_onnx_parity.py:24:    outputs = onnx_session.run(None, {input_name: onnx_input})
MB-Whatsapp\scripts\validate_onnx_parity.py:27:    # Try to extract labels from ONNX outputs.
MB-Whatsapp\scripts\validate_onnx_parity.py:28:    # skl2onnx typically emits label tensor as first output.
MB-Whatsapp\scripts\validate_onnx_parity.py:29:    onnx_label = outputs[0]
MB-Whatsapp\scripts\validate_onnx_parity.py:30:    onnx_pred = np.array(onnx_label).reshape(-1)
MB-Whatsapp\scripts\validate_onnx_parity.py:32:    parity = float((onnx_pred == sk_pred).mean())
MB-Whatsapp\scripts\validate_onnx_parity.py:39:        'onnx_total_ms': ox_ms,
MB-Whatsapp\scripts\validate_onnx_parity.py:40:        'onnx_latency_per_sample_ms': latency_per_sample_ms,
MB-Whatsapp\scripts\validate_onnx_parity.py:45:    with open('models/onnx_parity_report.json', 'w') as f:
MB-Whatsapp\scripts\validate_onnx_parity.py:48:    print('ONNX parity validation complete')
MB-Whatsapp\cerebro_ai_med\main.py:26:from cerebro_ai_med.models.ml_model import REGISTRY_PATH
MB-Whatsapp\cerebro_ai_med\main.py:27:from cerebro_ai_med.models.registry import compute_sha256, parse_active_spec
MB-Whatsapp\cerebro_ai_med\main.py:326:        "model_registry_exists": REGISTRY_PATH.exists(),
MB-Whatsapp\cerebro_ai_med\main.py:346:            "model_registry_exists",
MB-Whatsapp\cerebro_ai_med\main.py:366:        "registry_exists": REGISTRY_PATH.exists(),
MB-Whatsapp\cerebro_ai_med\main.py:367:        "registry_parse_ok": False,
MB-Whatsapp\cerebro_ai_med\main.py:379:        "registry_path": str(REGISTRY_PATH),
MB-Whatsapp\cerebro_ai_med\main.py:383:        raw = json.loads(Path(REGISTRY_PATH).read_text(encoding="utf-8"))
MB-Whatsapp\cerebro_ai_med\main.py:384:        checks["registry_parse_ok"] = True
MB-Whatsapp\cerebro_ai_med\main.py:387:        checks["registry_parse_ok"] = False
MB-Whatsapp\cerebro_ai_med\main.py:390:        spec = parse_active_spec(REGISTRY_PATH)
MB-Chat\src\knowledge\knowledge-index.service.ts:4:import { EmbeddingService } from './embedding.service';
MB-Chat\src\knowledge\knowledge-index.service.ts:26:    private readonly embeddingService: EmbeddingService,
MB-Chat\src\knowledge\knowledge-index.service.ts:36:      const embedding = this.embeddingService.embed(content);
MB-Chat\src\knowledge\knowledge-index.service.ts:44:            embedding,
MB-Chat\src\knowledge\knowledge-index.service.ts:70:    const queryEmbedding = this.embeddingService.embed(query);
MB-Chat\src\knowledge\knowledge-index.service.ts:72:    // Alternative to pgvector: compute cosine in app layer over curated corpus.
MB-Chat\src\knowledge\knowledge-index.service.ts:81:        const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, r.embedding ?? []);
MB-Whatsapp\services\inference_service\app\service.py:120:                    message="Failed to load active model from registry.",
MB-Chat\src\knowledge\embedding.service.ts:4:export class EmbeddingService {
MB-Chat\src\knowledge\embedding.service.ts:7:  // Lightweight local embedding alternative: hashed token embedding.
MB-Chat\src\knowledge\embedding.service.ts:8:  // Avoids external embedding API dependency while enabling semantic-ish retrieval.
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:13:Dataset: X_train_optimized.csv, X_test_optimized.csv
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:21:- Training initial models
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:23:- No latency constraints
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:33:Dataset: X_train_top80_importance.csv, X_test_top80_importance.csv
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:41:- Reducing training time
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:69:- Real-time constraints (<100ms)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:105:### Python: Load and Train
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:113:X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:115:y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:118:# Train model
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:120:model.fit(X_train, y_train)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:128:X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:133:model.fit(X_train, y_train)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:149:X_train_full = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:150:X_train_minimal = X_train_full[top_18_features]
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:153:model.fit(X_train_minimal, y_train)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:156:### Node.js/ONNX: Inference
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:159:import * as ort from 'onnxruntime-node';
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:163:  'models/incident_classifier_v37.onnx'  // Full set
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:270:    data_train = "data/processed/X_train_optimized.csv"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:274:    data_train = "data/processed/X_train_top80_importance.csv"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:278:### Step 3: Train and Validate
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:280:X_train = pd.read_csv(data_train)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:282:y_train = pd.read_csv("data/processed/y_train_optimized.csv").values.ravel()
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:286:model.fit(X_train, y_train)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:288:train_score = model.score(X_train, y_train)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:290:print(f"Accuracy: Train={train_score:.4f}, Test={test_score:.4f}")
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:295:# Convert to ONNX for cross-platform inference
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:296:from skl2onnx import convert_sklearn
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:297:from skl2onnx.common.data_types import FloatTensorType
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:299:initial_type = [("double", FloatTensorType([None, X_train.shape[1]]))]
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:300:onnx_model = convert_sklearn(model, initial_types=initial_type)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:302:with open(f'models/classifier_{feature_set}.onnx', 'wb') as f:
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:303:    f.write(onnx_model.SerializeToString())
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:312:- [ ] Train models with each set
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:325:- [ML_VALIDATION_PRODUCTION.md](ML_VALIDATION_PRODUCTION.md) - Training pipeline
MB-Whatsapp\scripts\validate_model.py:34:    train_acc = metrics.get('train_accuracy', 0)
MB-Whatsapp\scripts\validate_model.py:36:    overfit_score = metrics.get('overfitting_score', train_acc - test_acc)
MB-Whatsapp\scripts\validate_model.py:39:        'train_accuracy': train_acc,
MB-Whatsapp\scripts\validate_model.py:96:        print("❌ No model metrics found. Train a model first.")
MB-Whatsapp\scripts\validate_model.py:106:    print(f"  Train Accuracy: {overfit_check['train_accuracy']:.4f}")
MB-Whatsapp\scripts\validate_model.py:125:    print(f"Cross-Validation (Train, k-fold):")
MB-Whatsapp\scripts\validate_model.py:230:    # 5. DATASET INFO
MB-Whatsapp\scripts\validate_model.py:232:    print("5. DATASET & MODEL INFO")
MB-Whatsapp\scripts\validate_model.py:235:    print(f"  Train Samples: {metrics.get('num_train_samples', 'N/A')}")
MB-Whatsapp\scripts\validate_model.py:247:        recommendations.append("• Increase training data or re-engineer features")
MB-Whatsapp\scripts\validate_model.py:251:        recommendations.append("• Increase training set size if possible")
MB-Whatsapp\scripts\validate_model.py:255:        recommendations.append("• Increase training data per class to validate robustness")
MB-Whatsapp\scripts\validate_model.py:259:        recommendations.append("• Collect more diverse training data")
MB-Whatsapp\scripts\validate_model.py:269:        recommendations.append("• Perform regular retraining with new data")
MB-Whatsapp\scripts\train_model_incremental.py:3:Incremental Model Training for MetaBrain
MB-Whatsapp\scripts\train_model_incremental.py:4:Trains a new model using historical data + online feedback buffer
MB-Whatsapp\scripts\train_model_incremental.py:7:    python train_model_incremental.py <buffer_csv_path>
MB-Whatsapp\scripts\train_model_incremental.py:26:from skl2onnx import convert_sklearn
MB-Whatsapp\scripts\train_model_incremental.py:27:from skl2onnx.common.data_types import FloatTensorType
MB-Whatsapp\scripts\train_model_incremental.py:29:# Import from main training script
MB-Whatsapp\scripts\train_model_incremental.py:31:from train_model import (
MB-Whatsapp\scripts\train_model_incremental.py:34:    export_onnx_metadata,
MB-Whatsapp\scripts\train_model_incremental.py:40:from model_registry import ModelRegistry
MB-Whatsapp\scripts\train_model_incremental.py:44:    """Load the historical training dataset"""
MB-Whatsapp\scripts\train_model_incremental.py:45:    X_train_path = Path('data/processed/X_train.csv')
MB-Whatsapp\scripts\train_model_incremental.py:46:    y_train_path = Path('data/processed/y_train.csv')
MB-Whatsapp\scripts\train_model_incremental.py:50:    if not all([X_train_path.exists(), y_train_path.exists()]):
MB-Whatsapp\scripts\train_model_incremental.py:51:        raise FileNotFoundError('Historical training data not found')
MB-Whatsapp\scripts\train_model_incremental.py:53:    X_train = pd.read_csv(X_train_path)
MB-Whatsapp\scripts\train_model_incremental.py:54:    y_train = pd.read_csv(y_train_path).squeeze()
MB-Whatsapp\scripts\train_model_incremental.py:58:    return X_train, y_train, X_test, y_test
MB-Whatsapp\scripts\train_model_incremental.py:77:def combine_datasets(X_train, y_train, X_incremental, y_incremental):
MB-Whatsapp\scripts\train_model_incremental.py:78:    """Combine historical and incremental datasets"""
MB-Whatsapp\scripts\train_model_incremental.py:80:    common_cols = set(X_train.columns) & set(X_incremental.columns)
MB-Whatsapp\scripts\train_model_incremental.py:81:    X_train_aligned = X_train[list(common_cols)]
MB-Whatsapp\scripts\train_model_incremental.py:84:    X_combined = pd.concat([X_train_aligned, X_incremental_aligned], ignore_index=True)
MB-Whatsapp\scripts\train_model_incremental.py:85:    y_combined = pd.concat([y_train, y_incremental], ignore_index=True, keys=[0, 1])
MB-Whatsapp\scripts\train_model_incremental.py:87:    print(f'[OnlineLearning] Combined dataset: {len(X_combined)} records, {len(X_combined.columns)} features')
MB-Whatsapp\scripts\train_model_incremental.py:91:def train_incremental_model(X, y, feature_names):
MB-Whatsapp\scripts\train_model_incremental.py:92:    """Train model with combined historical + incremental data"""
MB-Whatsapp\scripts\train_model_incremental.py:93:    print('[OnlineLearning] Training RandomForest with incremental data...')
MB-Whatsapp\scripts\train_model_incremental.py:139:    """Main incremental training pipeline"""
MB-Whatsapp\scripts\train_model_incremental.py:141:    print('Incremental Model Training - MetaBrain Online Learning')
MB-Whatsapp\scripts\train_model_incremental.py:146:        X_train_hist, y_train_hist, X_test, y_test = load_historical_data()
MB-Whatsapp\scripts\train_model_incremental.py:148:        X_combined, y_combined, feature_names = combine_datasets(
MB-Whatsapp\scripts\train_model_incremental.py:149:            X_train_hist, y_train_hist, X_incr, y_incr
MB-Whatsapp\scripts\train_model_incremental.py:155:    # Step 2: Train incremental model
MB-Whatsapp\scripts\train_model_incremental.py:157:        model, cv_mean, cv_std = train_incremental_model(X_combined, y_combined, feature_names)
MB-Whatsapp\scripts\train_model_incremental.py:159:        print(f'[ERROR] Training failed: {e}')
MB-Whatsapp\scripts\train_model_incremental.py:170:        train_accuracy = cv_mean
MB-Whatsapp\scripts\train_model_incremental.py:172:        train_accuracy = model.score(X_combined, y_combined)
MB-Whatsapp\scripts\train_model_incremental.py:175:    overfitting_score = calculate_overfitting_score(train_accuracy, test_accuracy)
MB-Whatsapp\scripts\train_model_incremental.py:186:        onnx_path='models/decision_model.onnx',
MB-Whatsapp\scripts\train_model_incremental.py:198:        'onnx_parity': gate_result['onnx_parity'],
MB-Whatsapp\scripts\train_model_incremental.py:203:        'total_training_records': len(X_combined),
MB-Whatsapp\scripts\train_model_incremental.py:218:    # Step 5: Export artifacts
MB-Whatsapp\scripts\train_model_incremental.py:228:        # Convert to ONNX
MB-Whatsapp\scripts\train_model_incremental.py:231:        with open('models/decision_model.onnx', 'wb') as f:
MB-Whatsapp\scripts\train_model_incremental.py:233:        print('[OK] Saved: models/decision_model.onnx')
MB-Whatsapp\scripts\train_model_incremental.py:247:        schema_info = export_onnx_metadata(
MB-Whatsapp\scripts\train_model_incremental.py:254:        # Register in model registry
MB-Whatsapp\scripts\train_model_incremental.py:255:        registry = ModelRegistry('models/registry.json')
MB-Whatsapp\scripts\train_model_incremental.py:267:        version = registry.register_model(
MB-Whatsapp\scripts\train_model_incremental.py:269:            notes=f'Incremental training: {len(X_incr)} online feedback records'
MB-Whatsapp\scripts\train_model_incremental.py:283:    parser = argparse.ArgumentParser(description='Incremental model training')
MB-Whatsapp\models\v12\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v12\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v12\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v12\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v12\metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\scripts\train_model.py:2:import onnxruntime as rt
MB-Whatsapp\scripts\train_model.py:13:from skl2onnx import convert_sklearn
MB-Whatsapp\scripts\train_model.py:14:from skl2onnx.common.data_types import FloatTensorType
MB-Whatsapp\scripts\train_model.py:25:from model_registry import ModelRegistry
MB-Whatsapp\scripts\train_model.py:291:def enforce_dataset_gate(y_train, y_val, y_test):
MB-Whatsapp\scripts\train_model.py:293:    dataset_type = str(metadata.get('dataset_type', 'unknown')).lower()
MB-Whatsapp\scripts\train_model.py:295:    if dataset_type != 'production':
MB-Whatsapp\scripts\train_model.py:296:        print(f"Dataset type: {dataset_type} (production gate not enforced)")
MB-Whatsapp\scripts\train_model.py:299:    total_samples = int(metadata.get('total_samples', len(y_train) + len(y_val) + len(y_test)))
MB-Whatsapp\scripts\train_model.py:304:        y_all = np.concatenate([y_train, y_val, y_test])
MB-Whatsapp\scripts\train_model.py:308:    print(f"Dataset type: production")
MB-Whatsapp\scripts\train_model.py:313:            "Production dataset gate failed: "
MB-Whatsapp\scripts\train_model.py:320:def select_cv_folds(y_train):
MB-Whatsapp\scripts\train_model.py:327:    if len(y_train) < 2:
MB-Whatsapp\scripts\train_model.py:330:    _, class_counts = np.unique(y_train, return_counts=True)
MB-Whatsapp\scripts\train_model.py:339:def calculate_overfitting_score(train_acc, test_acc):
MB-Whatsapp\scripts\train_model.py:340:    """Calculate overfitting indicator: difference between train and test accuracy"""
MB-Whatsapp\scripts\train_model.py:341:    return train_acc - test_acc
MB-Whatsapp\scripts\train_model.py:355:    onnx_path: str = 'models/decision_model.onnx',
MB-Whatsapp\scripts\train_model.py:365:    2. overfitting_score < 0.30  (train_acc - test_acc)
MB-Whatsapp\scripts\train_model.py:367:    4. ONNX parity   == 1.0      (ONNX predictions identical to sklearn)
MB-Whatsapp\scripts\train_model.py:372:      onnx_parity  float – measured parity rate (0‥1)
MB-Whatsapp\scripts\train_model.py:401:    # 4. ONNX parity == 1.0
MB-Whatsapp\scripts\train_model.py:402:    onnx_parity = 0.0
MB-Whatsapp\scripts\train_model.py:406:        sess = rt.InferenceSession(onnx_path)
MB-Whatsapp\scripts\train_model.py:410:        onnx_pred = np.array(ox_out[0]).reshape(-1)
MB-Whatsapp\scripts\train_model.py:411:        onnx_parity = float((onnx_pred == sk_pred).mean())
MB-Whatsapp\scripts\train_model.py:412:        checks['onnx_parity'] = onnx_parity == 1.0
MB-Whatsapp\scripts\train_model.py:414:            f"  [{'PASS' if checks['onnx_parity'] else 'FAIL'}] "
MB-Whatsapp\scripts\train_model.py:415:            f"onnx_parity={onnx_parity:.4f} (required == 1.0)"
MB-Whatsapp\scripts\train_model.py:418:        checks['onnx_parity'] = False
MB-Whatsapp\scripts\train_model.py:419:        details.append(f"  [FAIL] onnx_parity=ERROR ({exc})")
MB-Whatsapp\scripts\train_model.py:425:        'onnx_parity': onnx_parity,
MB-Whatsapp\scripts\train_model.py:468:def export_onnx_metadata(X_train, calibration_payload=None, decision_thresholds=None, top_features_global=None):
MB-Whatsapp\scripts\train_model.py:469:    """Export ONNX runtime metadata for Node.js inference consistency."""
MB-Whatsapp\scripts\train_model.py:475:    metadata_out_path = 'models/onnx_metadata.json'
MB-Whatsapp\scripts\train_model.py:513:    for col in X_train.columns:
MB-Whatsapp\scripts\train_model.py:514:        series = X_train[col]
MB-Whatsapp\scripts\train_model.py:530:    onnx_metadata = {
MB-Whatsapp\scripts\train_model.py:537:        'num_features': int(X_train.shape[1]),
MB-Whatsapp\scripts\train_model.py:548:        json.dump(onnx_metadata, f, indent=2)
MB-Whatsapp\scripts\train_model.py:551:    print('Saved: models/onnx_metadata.json')
MB-Whatsapp\scripts\train_model.py:560:        'num_features': int(X_train.shape[1]),
MB-Whatsapp\scripts\train_model.py:563:def train_model():
MB-Whatsapp\scripts\train_model.py:565:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\scripts\train_model.py:566:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Whatsapp\scripts\train_model.py:572:    enforce_dataset_gate(y_train, y_val, y_test)
MB-Whatsapp\scripts\train_model.py:575:    print(f"MetaBrain ML Model Training - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
MB-Whatsapp\scripts\train_model.py:577:    print(f"Dataset Info:")
MB-Whatsapp\scripts\train_model.py:578:    print(f"  Train size: {X_train.shape[0]} samples, {X_train.shape[1]} features")
MB-Whatsapp\scripts\train_model.py:581:    print(f"  Classes: {len(np.unique(y_train))}")
MB-Whatsapp\scripts\train_model.py:582:    print(f"  Class distribution (train): {np.bincount(y_train.astype(int))}")
MB-Whatsapp\scripts\train_model.py:585:    # Train model
MB-Whatsapp\scripts\train_model.py:586:    print("Training RandomForestClassifier...")
MB-Whatsapp\scripts\train_model.py:588:    model.fit(X_train, y_train)
MB-Whatsapp\scripts\train_model.py:589:    print("[OK] Model trained\n")
MB-Whatsapp\scripts\train_model.py:591:    # === TRAINING SET EVALUATION ===
MB-Whatsapp\scripts\train_model.py:593:    print("TRAINING SET METRICS")
MB-Whatsapp\scripts\train_model.py:595:    y_train_pred = model.predict(X_train)
MB-Whatsapp\scripts\train_model.py:596:    train_accuracy = accuracy_score(y_train, y_train_pred)
MB-Whatsapp\scripts\train_model.py:597:    train_precision = precision_score(y_train, y_train_pred, average='weighted', zero_division=0)
MB-Whatsapp\scripts\train_model.py:598:    train_recall = recall_score(y_train, y_train_pred, average='weighted', zero_division=0)
MB-Whatsapp\scripts\train_model.py:599:    train_f1 = f1_score(y_train, y_train_pred, average='weighted', zero_division=0)
MB-Whatsapp\scripts\train_model.py:601:    print(f"Accuracy:  {train_accuracy:.4f}")
MB-Whatsapp\scripts\train_model.py:602:    print(f"Precision: {train_precision:.4f}")
MB-Whatsapp\scripts\train_model.py:603:    print(f"Recall:    {train_recall:.4f}")
MB-Whatsapp\scripts\train_model.py:604:    print(f"F1-Score:  {train_f1:.4f}\n")
MB-Whatsapp\scripts\train_model.py:626:    cv_folds, min_samples_per_class = select_cv_folds(y_train)
MB-Whatsapp\scripts\train_model.py:652:        # Stratified K-Fold for imbalanced datasets
MB-Whatsapp\scripts\train_model.py:654:        cv_results = cross_validate(model, X_train, y_train, cv=skf, scoring=scorers, n_jobs=-1)
MB-Whatsapp\scripts\train_model.py:713:    class_count = len(np.unique(y_train))
MB-Whatsapp\scripts\train_model.py:876:    overfitting_score = calculate_overfitting_score(train_accuracy, test_accuracy)
MB-Whatsapp\scripts\train_model.py:878:    print(f"Train Accuracy: {train_accuracy:.4f}")
MB-Whatsapp\scripts\train_model.py:943:        print("No previous model found - this is the first training")
MB-Whatsapp\scripts\train_model.py:958:        # Convert to ONNX
MB-Whatsapp\scripts\train_model.py:959:        initial_type = [('float_input', FloatTensorType([None, X_train.shape[1]]))]
MB-Whatsapp\scripts\train_model.py:961:        with open('models/decision_model.onnx', 'wb') as f:
MB-Whatsapp\scripts\train_model.py:963:        print("[OK] Saved: models/decision_model.onnx")
MB-Whatsapp\scripts\train_model.py:965:        # Export runtime metadata for Node.js ONNX inference
MB-Whatsapp\scripts\train_model.py:967:            model, list(X_train.columns), top_n=10
MB-Whatsapp\scripts\train_model.py:969:        schema_info = export_onnx_metadata(
MB-Whatsapp\scripts\train_model.py:970:            X_train,
MB-Whatsapp\scripts\train_model.py:988:            'train_accuracy': float(train_accuracy),
MB-Whatsapp\scripts\train_model.py:989:            'train_precision': float(train_precision),
MB-Whatsapp\scripts\train_model.py:990:            'train_recall': float(train_recall),
MB-Whatsapp\scripts\train_model.py:991:            'train_f1': float(train_f1),
MB-Whatsapp\scripts\train_model.py:1015:            'num_features': int(X_train.shape[1]),
MB-Whatsapp\scripts\train_model.py:1022:            'num_train_samples': int(X_train.shape[0]),
MB-Whatsapp\scripts\train_model.py:1074:            'onnx_parity': gate_result['onnx_parity'],
MB-Whatsapp\scripts\train_model.py:1085:            print(f"[DEPLOYMENT BLOCKED] Artifacts saved for inspection but NOT registered.")
MB-Whatsapp\scripts\train_model.py:1087:            print(f"\n[OK] Model saved successfully (blocked from registry)\n")
MB-Whatsapp\scripts\train_model.py:1093:        # === REGISTER WITH MODEL REGISTRY ===
MB-Whatsapp\scripts\train_model.py:1095:        print("MODEL REGISTRY")
MB-Whatsapp\scripts\train_model.py:1099:            registry = ModelRegistry('models/registry.json')
MB-Whatsapp\scripts\train_model.py:1100:            version = registry.register_model(
MB-Whatsapp\scripts\train_model.py:1102:                notes="Automatic training with validation"
MB-Whatsapp\scripts\train_model.py:1110:            comparator = ModelComparison('models/registry.json')
MB-Whatsapp\scripts\train_model.py:1122:            print("TRAINING SUMMARY")
MB-Whatsapp\scripts\train_model.py:1124:            registry.print_summary()
MB-Whatsapp\scripts\train_model.py:1125:            registry.print_history()
MB-Whatsapp\scripts\train_model.py:1128:            print(f"⚠ Registry error: {e}")
MB-Whatsapp\scripts\train_model.py:1137:    train_model()
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:5:El dataset de entrenamiento pasó de **10 features simples** a **37 features avanzadas**:
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:16:### 1. Generar Dataset Enriquecido
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:25:X_train.csv          → 37 features × train samples
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:27:y_train.csv, y_test.csv → Labels
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:44:python scripts/train_model.py
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:114:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:115:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:129:model.fit(X_train, y_train.values.ravel())
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:171:1. **Dataset generado:**
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:174:   # Debe mostrar X_train.csv, X_test.csv, X_train_scaled.csv, X_test_scaled.csv
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:185:   python -c "import pandas as pd; df = pd.read_csv('data/processed/X_train.csv'); print(f'Nulls: {df.isnull().sum().sum()}')"
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:189:4. **Model training:**
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:191:   python scripts/train_model.py
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:192:   # Debe guardar models/decision_model.pkl (y .onnx)
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:226:→ Re-ejecuta: `python scripts/train_model.py`
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:240:1. ✓ Generar dataset: `python scripts/data_pipeline.py`
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:242:3. ✓ Entrenar: `python scripts/train_model.py`
MB-Whatsapp\scripts\traffic_shadow_real_check.py:118:    metadata_path = MODELS_DIR / "onnx_metadata.json"
MB-Whatsapp\models\reports\recommendation_v9.json:29:      "message": "More or equal training samples"
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:1:# 🚀 IMMEDIATE ACTION PLAN: Phase 3 - Model Training & Benchmark
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:5:**Objective:** Train models with 3 feature sets and select optimal for production
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:11:### Week 1: Model Training & Benchmarking
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:13:#### 🎯 Day 1-2: Training Phase
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:14:- **Output datasets ready:** ✅ Yes (3 variants prepared)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:20:# Task 1: Train full 37-feature model
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:21:python scripts/train_model.py --features full --n-estimators 100
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:23:# Task 2: Train 31-feature optimized model
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:24:python scripts/train_model.py --features top80 --n-estimators 100
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:26:# Task 3: Train 18-feature minimal model
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:27:python scripts/train_model.py --features top90 --n-estimators 100
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:29:# Task 4: Train baseline (previous 10-feature model) for comparison
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:30:python scripts/train_model.py --features baseline --n-estimators 100
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:75:    'full': 'data/processed/X_train_optimized.csv',
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:76:    'top80': 'data/processed/X_train_top80_importance.csv',
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:93:### Step 2: Create train_model.py Script
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:97:- Train RandomForestClassifier with standard hyperparameters
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:100:- Export to ONNX format
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:111:def train_model(feature_set='full', n_estimators=100):
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:112:    """Train model with specified feature set"""
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:114:    # Load datasets
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:116:        X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:119:        X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:124:    y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:127:    # Train model
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:128:    print(f"Training RandomForest with {feature_set} feature set...")
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:129:    print(f"  Features: {X_train.shape[1]}")
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:130:    print(f"  Sample size: {X_train.shape[0]}")
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:141:    model.fit(X_train, y_train)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:144:    train_score = model.score(X_train, y_train)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:147:    print(f"✓ Model trained")
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:148:    print(f"  Train accuracy: {train_score:.4f}")
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:157:    return model, train_score, test_score
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:166:    train_model(args.features, args.n_estimators)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:171:**Purpose:** Compare all trained models side-by-side
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:174:- Training accuracy
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:176:- Overfitting gap (train - test)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:186:Model          Features  Train Acc  Test Acc  Overfitting  Approx Time  Size
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:273:### ✅ Training Success Criteria
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:275:- [ ] All 3 models train successfully
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:276:- [ ] Training completes in <5 minutes total
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:277:- [ ] Both train and test accuracies > 70%
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:278:- [ ] Models export to ONNX successfully
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:298:Phase 3: Model Training & Benchmark
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:300:Day 1-2:  Model Training (3 variants + baseline)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:302:  ├─ 08:30 - Train full set (5-10 min)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:303:  ├─ 09:00 - Train top-80 set (5-10 min)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:304:  ├─ 09:30 - Train top-90 set (5-10 min)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:305:  ├─ 10:00 - Train baseline (5-10 min)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:364:### If models don't train successfully
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:365:- Check feature names match between train/test
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:371:- Check label encoding (y_train values)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:380:- Check for vector operations bottlenecks
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:418:python -c "import pandas as pd; print(pd.read_csv('data/processed/X_train_optimized.csv').shape)"
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:420:# 2. Create train_model.py script (see template above)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:421:# 3. Run training commands (see Step 2)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:429:**Next Step:** Create train_model.py and start training
MB-Whatsapp\models\reports\recommendation_v8.json:29:      "message": "More or equal training samples"
MB-Whatsapp\models\v11\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v11\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v11\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v11\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v11\metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\models\reports\recommendation_v7.json:29:      "message": "More or equal training samples"
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:3:**Current Status:** ✅ COMPLETE - Ready for Production Model Training
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:15:- Stratified train/test split (80/20)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:23:- Produced ready-to-use optimized datasets
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:91:Dataset Quality Metrics:
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:94:Sample Count:           1 train, 1 test (demo dataset)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:102:Train/Test Split:
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:115:✅ **Processed Datasets**
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:116:- `X_train.csv` (37 features, normalized)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:118:- `y_train.csv` / `y_test.csv` (labels)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:218:✅ **Optimized Datasets (3 variants)**
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:220:   - `X_train_optimized.csv`
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:225:   - `X_train_top80_importance.csv`
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:284:- Stratified train/test split
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:295:**Phase 3: Model Training & Benchmarking** (Immediate)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:296:- [ ] Train RandomForest with all 37 features
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:297:- [ ] Train RandomForest with 31 features
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:298:- [ ] Train RandomForest with 18 features
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:372:- [x] Train/test split with stratification
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:387:- [x] Production datasets prepared
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:468:- Encoder/scaler artifacts: ~5MB total
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:483:### 🎯 Priority 1: Model Training (This Week)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:486:# Train with all 37 features
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:487:python scripts/train_model.py --feature-set full
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:489:# Train with top-80 feature set
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:490:python scripts/train_model.py --feature-set top80
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:492:# Train with top-90 feature set
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:493:python scripts/train_model.py --feature-set top90
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:524:**Status:** ✅ READY FOR PRODUCTION MODEL TRAINING
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:530:3. **Production-ready datasets** with zero quality issues
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:535:- **Immediate:** Train and benchmark models with 3 feature sets
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:539:🚀 **Ready to proceed to Phase 3: Model Training!**
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:550:### Generated Datasets
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:551:- `data/processed/X_train_optimized.csv` (37 features)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:553:- `data/processed/X_train_top80_importance.csv` (31 features)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:556:- `data/processed/y_train*.csv` / `y_test*.csv` (Labels)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:584:**Ready for:** Phase 3 - Model Training & Benchmark
MB-Whatsapp\models\reports\recommendation_v6.json:29:      "message": "More or equal training samples"
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:24:│   PersistenceService.saveOnlineTrainingRecord() ────────────┐   │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:30:│  - onnxFeatureVector (array exacto usado)                   │   │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:38:│            MongoDB: online_training_buffer                      │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:40:│ Collection: online_training_buffer                             │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:41:│ ├─ UsedInTraining: false (nuevo)                              │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:42:│ ├─ Indices: (incidentId, createdAt, usedInTraining)          │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:43:│ └─ Esquema: OnlineTrainingBuffer (v. linea 1-128)            │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:62:│   getUntrainedBufferRecords(limit=1000, quality=true)         │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:65:│      - featureVector sin NaN                                 │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:68:│   shouldTriggerRetrain() checks:                              │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:70:│     - Throttle: mín 30 min desde último retrain              │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:72:│   exportIncrementalDataset() → CSV temporal                   │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:74:│ Output: data/incremental/training_buffer_<timestamp>.csv     │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:77:FASE 4: RETRAINING INCREMENTAL + GATE
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:81:│   python scripts/train_model_incremental.py <buffer.csv>       │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:82:│     ├─ Carga: X_train_hist.csv + incremental                  │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:90:│     │   └─ onnx_parity == 1.0     ✓                           │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:93:│     │     ├─ Save decision_model.onnx                        │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:95:│     │     ├─ Register in registry.json (vX)                  │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:96:│     │     └─ Mark buffer records as usedInTraining=true      │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:99:│     │     └─ DEPLOYMENT BLOCKED (pero artifacts guardados)   │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:114:│     - Polling periódico de decision_model.onnx                │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:125:│  └─ Comparar distribución actual vs training:                │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:128:│     - Trigger: retraining prioritario                        │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:152:      → ONNX inference
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:159:      featureVector,
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:168:  → PersistenceService.saveOnlineTrainingRecord()
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:174:      onnxFeatureVector: [0.5, 0.3, ...],
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:192:        isFromEarlyTraining: false
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:207:    "hasValidOutput": true  // ← Ahora es ready para training
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:220:  untrainedRecords: 150
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:221:  recordsWithOutcome: 75  (≥ MIN_UNTRAINED_WITH_OUTCOME = 20) ✓
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:222:  timeSinceLastRetrain: 35 min (≥ MIN_RETRAIN_INTERVAL = 30 min) ✓
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:224:Decision: shouldRetrain = true
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:226:  exportIncrementalDataset()
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:227:    ├─ Query: { usedInTraining: false, qualityMetadata.hasValidOutput: true }
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:230:    └─ Guardado en: data/incremental/training_buffer_2026-04-19T213045Z.csv
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:236:python scripts/train_model_incremental.py data/incremental/training_buffer_2026-04-19T213045Z.csv
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:240:     ├─ X_train_hist: 168 samples, 37 features
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:241:     └─ y_train_hist: [A, B, C, D] labels
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:248:  3. combine_datasets()
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:253:  4. train_incremental_model()
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:268:     ├─ onnx_parity = 1.0 == 1.0 ✓ PASS
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:272:     7. export_onnx_metadata()
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:273:        ├─ Save decision_model.onnx
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:274:        ├─ Save onnx_metadata.json
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:287:        └─ Registry entry: { v16: 0.9722, features: ... }
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:290:        ├─ UPDATE online_training_buffer
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:291:        ├─ SET usedInTraining = true
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:306:| `src/persistence/schemas/online-training-buffer.schema.ts` | 1 | Schema MongoDB para capturar feedback |
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:308:| `scripts/train_model_incremental.py` | 4 | Pipeline Python para reentrenamiento incremental |
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:314:| `src/persistence/persistence.module.ts` | 1 | Registra OnlineTrainingBuffer schema |
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:315:| `src/persistence/persistence.service.ts` | 1 | Métodos `saveOnlineTrainingRecord()`, `getUntrainedBufferRecords()`, etc. |
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:316:| `src/brain/brain.service.ts` | 1 | Captura feedback with `persistenceService.saveOnlineTrainingRecord()` |
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:326:// OnlineLearningService.shouldTriggerRetrain()
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:327:const MIN_UNTRAINED_WITH_OUTCOME = 20;      // Mínimo records con feedback
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:328:const MIN_RETRAIN_INTERVAL_MS = 30 * 60 * 1000;  // 30 min entre retrains
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:330:// train_model_incremental.py (Gate)
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:342:> db.online_training_buffer.find().limit(1)
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:354:cat models/registry.json | jq '.versions | reverse | .[0]'
MB-Whatsapp\models\reports\recommendation_v5.json:29:      "message": "More or equal training samples"
MB-Whatsapp\scripts\run_ml_validation.py:4:Complete workflow: Data → Train → Validate → Monitor
MB-Whatsapp\scripts\run_ml_validation.py:94:            print(f"  Train Samples:      {metrics.get('num_train_samples', 'N/A')}")
MB-Whatsapp\scripts\run_ml_validation.py:97:            print(f"  Train Accuracy:     {metrics.get('train_accuracy', 'N/A'):.4f}")
MB-Whatsapp\scripts\run_ml_validation.py:139:║ Complete workflow: Data → Train → Validate → Monitor                      ║
MB-Whatsapp\scripts\run_ml_validation.py:145:    # Step 1: Split production vs synthetic dataset
MB-Whatsapp\scripts\run_ml_validation.py:149:        "1. Dataset Split (production vs synthetic)",
MB-Whatsapp\scripts\run_ml_validation.py:150:        [python_exe, "scripts/extract_real_dataset.py"]
MB-Whatsapp\scripts\run_ml_validation.py:152:        print("✗ Dataset split failed - cannot continue")
MB-Whatsapp\scripts\run_ml_validation.py:164:            "data/production_dataset",
MB-Whatsapp\scripts\run_ml_validation.py:167:            "--dataset-type",
MB-Whatsapp\scripts\run_ml_validation.py:173:    # Step 3: Model Training
MB-Whatsapp\scripts\run_ml_validation.py:175:        "3. Model Training (with Validation)",
MB-Whatsapp\scripts\run_ml_validation.py:176:        [python_exe, "scripts/train_model.py"]
MB-Whatsapp\scripts\run_ml_validation.py:178:        print("✗ Training failed - cannot continue")
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:9:### 1. ✅ Model Registry (`scripts/model_registry.py`)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:21:registry = ModelRegistry()
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:22:version = registry.register_model(metrics, notes="...")
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:23:registry.promote_to_production('v2')
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:24:registry.print_history()
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:81:### 4. ✅ Integración en train_model.py
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:85:train_model.py
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:88:  ├─ Registra con ModelRegistry → v1 (STAGING)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:98:├── registry.json          # Central registry
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:101:│   ├── decision_model.onnx
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:106:│   ├── decision_model.onnx
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:111:│   ├── decision_model.onnx
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:124:│ Training Day 1  │
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:133:│ Training Day 2  │
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:143:│ Training Day 3  │
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:162:## Registry JSON Structure
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:170:      "train_accuracy": 0.90,
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:172:      "train_f1": 0.89,
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:177:      "num_train_samples": 400,
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:181:      "notes": "Initial training"
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:215:python scripts/train_model.py
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:227:from model_registry import ModelRegistry
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:228:r = ModelRegistry()
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:256:python scripts/demo_model_registry.py
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:266:| `train_accuracy` | Accuracy en train set |
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:268:| `train_f1` | F1 en train |
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:270:| `overfitting_score` | Train - Test gap |
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:273:| `num_train_samples` | Tamaño dataset entrenamiento |
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:274:| `num_test_samples` | Tamaño dataset test |
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:296:   - ✓ Export ONNX exitoso
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:323:├── model_registry.py       (420 líneas)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:326:├── demo_model_registry.py  (250 líneas)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:327:└── train_model.py          (actualizado con integración)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:330:├── registry.json           (histórico de versiones)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:337:└── ML_MODEL_REGISTRY.md    (guía completa)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:343:$ python scripts/train_model.py
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:345:[Training output...]
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:347:MODEL REGISTRY
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:361:  ✓ data:        PASS  More training samples
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:365:TRAINING SUMMARY
MB-Whatsapp\models\reports\recommendation_v4.json:29:      "message": "More or equal training samples"
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:8:- `recordAndTrain` no estaba conectado al flujo real del chat; el servicio llamaba a `record` dos veces y nunca activaba entrenamiento controlado.
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:11:- Habia riesgo de contaminacion clinica: una respuesta Groq profesional podia terminar registrada sin contrato explicito de `allowedForTraining`, `validationStatus`, `reuseScope` o metricas de dependencia del teacher.
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:17:- Se reemplazo el registro crudo por `recordAndTrain` integrado en [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts#L304) y en ramas bloqueadas/fallback [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts#L116) y [src/medical-assistant/medical-assistant.service.ts](src/medical-assistant/medical-assistant.service.ts#L395).
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:56:- `allowedForTraining`
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:100:- `memory/SemanticMemoryService` sigue fuera del root de build Nest; la memoria semantica operativa de esta fase vive en `MedicalChatLearningService` con recall lexical JSONL. Si se quiere vectorizacion real, hay que integrar esa capa al arbol compilado y al DI de Nest.
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:124:- NO-GO para declarar independencia fuerte de Groq: aun existe teacher fallback y el recall sigue siendo lexical, no vectorial.
MB-Whatsapp\models\reports\recommendation_v15.json:30:      "message": "More or equal training samples"
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:15:- **Model Training**: RandomForest con métricas separadas (train vs test)
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:20:python scripts/run_ml_validation.py  # Ejecuta todo: data → train → validate → monitor
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:26:Implementó dicotomía train vs test para detectar memorización:
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:29:Overfitting Score = Train Accuracy - Test Accuracy
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:41:- k = min(5, len(train_data)) - Adapta a datasets pequeños
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:56:  "train_accuracy": 1.0, "train_precision": 1.0, "train_recall": 1.0, "train_f1": 1.0,
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:61:  "num_train_samples": 1,
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:93:- • Collect more diverse training data
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:102:✓ Training Data Quality: < 50 samples
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:113:STEP 2: Model Training (with Validation)           ✓ PASS
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:125:| `data_pipeline.py` | Feature engineering | X_train.csv, X_test.csv, encoders |
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:126:| `train_model.py` | Entrenar con validación | model.pkl, model.onnx, metrics.json |
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:142:- ✓ **Train Accuracy**: 1.0000
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:160:- Train Samples: 1 (minimum for proof of concept)
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:167:- **Caveat**: With minimal training data; score scales with more examples
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:172:- [x] Train/test split implementado (80/20)
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:174:- [x] Overfitting score (train_acc - test_acc) calculado
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:195:- Model training con RandomForest
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:197:- Precision/recall/F1 metrics por dataset
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:198:- Overfitting detection (train vs test gap)
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:208:- All 4 steps passed (data → train → validate → monitor)
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:239:   - Daily retraining via GitHub Actions
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:262:  scripts/train_model.py              # Enhanced training (312 lines)
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:282:1. **Previene overfitting** mediante train/test split y cross-validation
MB-Whatsapp\models\reports\recommendation_v14.json:30:      "message": "More or equal training samples"
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:10:Data → Features (18) → Train/Val/Test Split (70/15/15) → Model Training
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:15:                            (Stratified K-Fold)      & Metrics             (Train/Test Gap)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:29:**Output**: Train/test CSV files with 37 engineered features (++270% vs baseline)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:45:### 2. Model Training (`scripts/train_model.py`)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:46:**Purpose**: Train RandomForestClassifier with comprehensive metrics
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:47:**Output**: Pickled model, ONNX export, metrics JSON
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:54:  "train_accuracy": 0.0-1.0,
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:55:  "train_precision": 0.0-1.0,
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:56:  "train_recall": 0.0-1.0,
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:57:  "train_f1": 0.0-1.0,
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:65:  "num_train_samples": N,
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:98:4. **Training Data Quality**: Alert if <50 samples
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:110:# Execute all steps: data → train → validate → monitor
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:119:# 2. Train model with metrics
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:120:python scripts/train_model.py
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:138:- [ ] ≥ 50 training samples
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:144:- [ ] 20-50 training samples
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:150:- [ ] < 20 training samples
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:154:**Rationale**: With minimal training data (1-10 samples), any model appears perfect. Overfitting is detected by comparing train vs test performance.
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:158:overfitting_score = train_accuracy - test_accuracy
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:163:- **0.05-0.15**: Good generalization - minor optimization to training data
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:164:- **0.15-0.30**: Model overfitted - learned training set specifics
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:168:- Perfect training accuracy (100%) is expected with 1-2 samples
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:174:**Method**: Stratified K-Fold (k = min(5, len(X_train)))
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:219:### 1. Daily Retraining (learning.service.ts)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:222:async retrainModel() {
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:225:  // 3. Run scripts/train_model.py          → train & validate
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:226:  // 4. Model Registry auto-registers v1,v2,v3 with comparison
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:268:- Train/Validation/Test split enforced (70/15/15)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:287:8. **Data Drift**: If input distribution changes, retrain recommended
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:288:9. **Model Age**: If >30 days without retraining, schedule retrain
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:323:- P95 prediction latency (ONNX + rules should be <10ms)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:330:**Minimum Dataset Size**:
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:331:- 50 samples: ML model training begins
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:352:4. Periodically retrain with new data (daily at midnight)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:357:- P95 prediction latency (ONNX inference should be <5ms)
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:367:- Collect more diverse training data
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:372:**Cause**: Model learned training data too specifically
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:376:- Increase training data
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:392:- Retrain with recent data
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:411:| ONNX Inference Time | <5ms | <50ms |
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:425:- <0.65: ML may need retraining or feature engineering
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:442:├── decision_model.onnx         # ONNX export for Node.js
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:449:├── X_train.csv                 # Training features
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:451:├── y_train.csv                 # Training labels
MB-Whatsapp\models\reports\recommendation_v13.json:30:      "message": "More or equal training samples"
MB-Whatsapp\models\reports\recommendation_v11.json:30:      "message": "More or equal training samples"
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:5:### 1. Daily Retraining Integration
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:7:The `LearningService` automatically triggers retraining at midnight:
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:13:async retrainModel() {
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:20:    // Training with validation
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:21:    await execAsync('python scripts/train_model.py');
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:42:        message: 'Daily retraining failed validation',
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:49:      message: 'Model retraining failed',
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:73:      lastRetrain: this.learningService.getLastRetrainTime(),
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:88:        train: metrics.num_train_samples,
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:117:        message: 'Accuracy degraded >10% - consider retraining',
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:148:        message: 'Model >30 days old - schedule retraining',
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:177:    - cron: '0 1 * * *'  # Daily after training
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:213:          aws s3 cp models/decision_model.onnx \
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:214:            s3://metabrain-models/staging/decision_model.onnx
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:219:            --s3-key staging/decision_model.onnx
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:226:          text: 'ML validation failed during daily retrain'
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:299:from prometheus_client import CollectorRegistry, Gauge, write_to_textfile
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:303:    registry = CollectorRegistry()
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:313:        ['set'],  # train or test
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:314:        registry=registry
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:319:        'Train vs test accuracy difference',
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:320:        registry=registry
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:326:        registry=registry
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:332:        registry=registry
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:336:    accuracy.labels(set='train').set(metrics['train_accuracy'])
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:343:    write_to_textfile('metrics/ml_validation.prom', registry)
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:353:After each training, analyze which features matter most:
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:402:# Load training data
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:403:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:404:y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:424:grid_search.fit(X_train, y_train)
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:446:- [ ] **Training**
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:447:  - [ ] No errors during training
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:449:  - [ ] ONNX export successful
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:480:aws s3 cp s3://metabrain-models/archive/decision_model_v1.onnx ./
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:486:  --s3-key archive/decision_model_v1.onnx
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:492:### Manual Retraining
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:493:If automatic retraining fails:
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:501:# 2. Train with validation
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:502:python scripts/train_model.py
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:512:  aws s3 cp models/decision_model.onnx \
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:513:    s3://metabrain-models/current/decision_model.onnx
MB-Whatsapp\models\reports\recommendation_v10.json:30:      "message": "More or equal training samples"
MB-Whatsapp\docs\ML_RULES_COMBINED_SCORING.md:27:Storage + Daily Retrain
MB-Whatsapp\docs\ML_RULES_COMBINED_SCORING.md:80:- ONNX model prediction (NOT hardcoded 1.0)
MB-Whatsapp\docs\ML_RULES_COMBINED_SCORING.md:276:- **ML: 40%** - Trained on actual outcomes, captures temporal patterns
MB-Whatsapp\docs\ML_RULES_COMBINED_SCORING.md:385:- [ML Model Registry](./ML_MODEL_REGISTRY.md) - Version control for models
MB-Whatsapp\docs\ML_RULES_COMBINED_SCORING.md:386:- [ML Validation Production](./ML_VALIDATION_PRODUCTION.md) - Training and validation
MB-Whatsapp\models\v10\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v10\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v10\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v10\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v10\metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\models\reports\deployment_gate_report.json:8:    "onnx_parity": true
MB-Whatsapp\models\reports\deployment_gate_report.json:10:  "onnx_parity": 1.0,
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:1:# MetaBrain Model Registry & Version Control
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:5:MetaBrain implements a comprehensive model registry system to track model evolution, manage versions, enable safe comparisons, and support automatic rollback when issues arise.
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:10:Training Pipeline
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:12:train_model.py (with integrated registry)
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:43:### 1. Model Registry (`scripts/model_registry.py`)
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:45:**Purpose**: Central registry for all model versions
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:49:registry = ModelRegistry('models/registry.json')
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:51:# Register new model after training
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:52:version = registry.register_model(
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:54:    notes="Training with 500 samples"
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:59:registry.promote_to_production('v2')
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:62:prod = registry.get_production_version()
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:63:staging = registry.get_staging_version()
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:65:# Load model from registry
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:66:model = registry.load_model('v2', format='pkl')
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:69:registry.print_history()
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:72:**Registry Structure** (`models/registry.json`):
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:79:      "train_accuracy": 0.90,
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:81:      "train_f1": 0.89,
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:86:      "num_train_samples": 400,
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:90:      "notes": "Initial training"
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:95:      "train_accuracy": 0.95,
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:104:      "train_accuracy": 0.96,
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:118:      "notes": "Initial training"
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:135:│   ├── decision_model.onnx
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:140:│   ├── decision_model.onnx
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:145:│   ├── decision_model.onnx
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:148:├── registry.json          # Central registry
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:158:comparator = ModelComparison('models/registry.json')
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:202:   - ✓ PASS: ≥ production training samples
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:203:   - ✗ FAIL: Fewer training samples
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:227:rollback_mgr = ModelRollback('models/registry.json')
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:254:3. Update registry status
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:265:# 1. Train model - automatically registers and compares
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:266:python scripts/train_model.py
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:283:# data                 ✓ PASS        More training samples
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:290:python scripts/model_registry.py
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:298:from model_registry import ModelRegistry
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:299:registry = ModelRegistry()
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:300:registry.promote_to_production('v3')
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:322:│ Training │
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:371:               │   - Update registry
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:402:## Integration with Training Pipeline
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:404:**train_model.py** now automatically:
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:406:1. Trains model
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:408:3. **Registers with model_registry.py**
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:410:   registry = ModelRegistry()
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:411:   version = registry.register_model(metrics, notes="...")
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:442:| `train_accuracy` | Accuracy on training set |
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:444:| `train_f1` | F1-score on training set |
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:446:| `overfitting_score` | Train - Test accuracy gap |
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:449:| `num_train_samples` | Training data size |
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:453:| `notes` | Custom notes (why trained, what changed, etc) |
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:474:   - ✓ ONNX export successful
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:486:# 1. TRAINING & REGISTRATION
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:487:python scripts/train_model.py
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:488:# Trains, validates, registers, compares, recommends
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:490:# 2. REGISTRY MANAGEMENT
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:491:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:492:  r = ModelRegistry(); r.print_history(); r.print_summary()"
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:499:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:500:  r = ModelRegistry(); r.promote_to_production('v3')"
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:520:Day 1 - Initial Training
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:521:$ python scripts/train_model.py
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:527:$ python scripts/train_model.py
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:539:$ python scripts/train_model.py
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:566:├── registry.json                 # Central registry
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:569:│   ├── decision_model.onnx
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:574:│   ├── decision_model.onnx
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:579:│   ├── decision_model.onnx
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:592:**Issue**: version not found in registry
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:593:- Check `models/registry.json` exists
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:595:- Run training to create first version
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:609:- Collect more training data
MB-Whatsapp\models\registry.json:6:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:8:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:13:      "num_train_samples": 1,
MB-Whatsapp\models\registry.json:17:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:22:      "train_accuracy": 0.9,
MB-Whatsapp\models\registry.json:24:      "train_f1": 0.89,
MB-Whatsapp\models\registry.json:29:      "num_train_samples": 400,
MB-Whatsapp\models\registry.json:33:      "notes": "Initial training - 400 samples"
MB-Whatsapp\models\registry.json:38:      "train_accuracy": 0.95,
MB-Whatsapp\models\registry.json:40:      "train_f1": 0.94,
MB-Whatsapp\models\registry.json:45:      "num_train_samples": 500,
MB-Whatsapp\models\registry.json:54:      "train_accuracy": 0.87,
MB-Whatsapp\models\registry.json:56:      "train_f1": 0.86,
MB-Whatsapp\models\registry.json:61:      "num_train_samples": 500,
MB-Whatsapp\models\registry.json:70:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:72:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:77:      "num_train_samples": 1,
MB-Whatsapp\models\registry.json:81:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:86:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:88:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:93:      "num_train_samples": 1,
MB-Whatsapp\models\registry.json:97:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:102:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:104:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:109:      "num_train_samples": 1,
MB-Whatsapp\models\registry.json:113:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:118:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:120:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:125:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:129:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:134:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:136:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:141:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:145:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:150:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:152:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:157:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:161:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:166:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:168:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:173:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:182:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:187:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:189:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:194:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:203:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:208:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:210:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:215:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:224:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:229:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:231:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:236:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:245:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:250:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:252:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:257:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:266:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:271:      "train_accuracy": 1.0,
MB-Whatsapp\models\registry.json:273:      "train_f1": 1.0,
MB-Whatsapp\models\registry.json:278:      "num_train_samples": 168,
MB-Whatsapp\models\registry.json:287:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:297:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:303:      "notes": "Initial training - 400 samples"
MB-Whatsapp\models\registry.json:339:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:345:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:351:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:357:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:363:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:369:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:375:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:381:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:387:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:393:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:399:      "notes": "Automatic training with validation"
MB-Whatsapp\models\registry.json:405:      "notes": "Automatic training with validation"
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:55:- **Change**: Accepts enriched feature vector, not just hour/day
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:111:- Daily model retraining (daily at midnight)
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:112:- Model Registry versioning for safe evolution
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:123:- Rollback capability via Model Registry
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:158:6. Confirm daily retraining runs
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:159:7. Validate Model Registry auto-registration
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:165:- Total decision time: ~6-7ms (ONNX inference is dominant)
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:207:| Safe rollback | ✅ | Model Registry v1,v2,v3 |
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:234:- [ ] Team trained on new patterns
MB-Whatsapp\metabrain\observability\metrics.py:1:"""Thread-safe observability metrics registry.
MB-Whatsapp\metabrain\observability\metrics.py:70:    """Single registry for all system observability signals."""
MB-Whatsapp\models\onnx_parity_report.json:5:  "onnx_total_ms": 0.7264000014401972,
MB-Whatsapp\models\onnx_parity_report.json:6:  "onnx_latency_per_sample_ms": 0.020177777817783255,
MB-Whatsapp\docs\ML_FEATURES.md:92:18-Feature Vector → ML Model
MB-Whatsapp\docs\ML_FEATURES.md:166:### Nota sobre Dataset Pequeño
MB-Whatsapp\docs\ML_FEATURES.md:168:Con dataset muy pequeño (1-2 muestras por clase):
MB-Whatsapp\memory_py\types.py:43:    vector_enabled: bool = False
MB-Chat\models\v9\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v9\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v9\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v9\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v9\metrics.json:31:  "num_train_samples": 168,
MB-Whatsapp\docs\ML_DECISION_SUMMARY.md:27:(Opcionalmente) Cron daily a medianoche → retrainModel() Python scripts
MB-Whatsapp\docs\ML_DECISION_SUMMARY.md:37:| `retrainModel()` | N/A (Cron) | Promise | Evento automático cada medianoche |
MB-Whatsapp\docs\ML_DECISION_SUMMARY.md:344:retrainModel() @Cron(EVERY_DAY_AT_MIDNIGHT)
MB-Whatsapp\docs\ML_DECISION_SUMMARY.md:385:2. ✅ **ML**: Infraestructura lista (ONNX + predictor)
MB-Whatsapp\memory_py\semantic_memory_service.py:30:        vector_enabled=_read_bool(values.get("SEMANTIC_MEMORY_VECTOR_ENABLED"), False),
MB-Chat\src\guard\guard.service.ts:3:import { SAFE_COMMANDS } from '../execution/command.registry';
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:188:# Ensure scripts/train_model.py has been run once
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:189:python scripts/train_model.py
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:190:# Creates models/decision_model.pkl and decision_model.onnx
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:193:**2. Setup Daily Retraining** (already in LearningService):
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:196:# The retraining happens automatically via:
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:198:async retrainModel() { ... }
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:252:- **Impact**: +1ms (negligible, within ONNX inference margin)
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:261:- Monitor via daily training + Model Registry
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:297:- [ ] Daily retraining executes at midnight
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:298:- [ ] Model Registry auto-registers versions
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:330:- [ML Validation Production](./ML_VALIDATION_PRODUCTION.md) - Training & validation
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:331:- [ML Model Registry](./ML_MODEL_REGISTRY.md) - Version control
MB-Whatsapp\memory_py\jsonl_adapter.py:158:                "embedding_slot": record.get("embedding_slot"),
MB-Whatsapp\docs\FILE_MANIFEST.md:14:3. **[QUICKSTART_FEATURE_SELECTION.md](QUICKSTART_FEATURE_SELECTION.md)** - How to use datasets
MB-Whatsapp\docs\FILE_MANIFEST.md:19:- **[ML_VALIDATION_PRODUCTION.md](ML_VALIDATION_PRODUCTION.md)** - Complete training pipeline
MB-Whatsapp\docs\FILE_MANIFEST.md:46:│   ├─ train_importance_model()
MB-Whatsapp\docs\FILE_MANIFEST.md:71:### 2. PROCESSED DATASETS
MB-Whatsapp\docs\FILE_MANIFEST.md:76:├── X_train_optimized.csv              (1 row × 37 features)
MB-Whatsapp\docs\FILE_MANIFEST.md:82:├── y_train_optimized.csv              (1 row × 1 label)
MB-Whatsapp\docs\FILE_MANIFEST.md:83:│   └─ Training labels
MB-Whatsapp\docs\FILE_MANIFEST.md:95:├── X_train_top80_importance.csv       (1 row × 31 features)
MB-Whatsapp\docs\FILE_MANIFEST.md:111:├── model-registry.json                 (Model versions)
MB-Whatsapp\docs\FILE_MANIFEST.md:115:    ├── X_train.csv ~ X_test.csv       (Original 37-feature sets)
MB-Whatsapp\docs\FILE_MANIFEST.md:116:    ├── y_train.csv ~ y_test.csv       (Original labels)
MB-Whatsapp\docs\FILE_MANIFEST.md:337:2. Load data from data/processed/X_train_optimized.csv
MB-Whatsapp\docs\FILE_MANIFEST.md:339:4. For top-80 set, load X_train_top80_importance.csv instead
MB-Whatsapp\docs\FILE_MANIFEST.md:344:1. Check PHASE_3_ACTION_PLAN.md for training instructions
MB-Whatsapp\docs\FILE_MANIFEST.md:345:2. Use scripts/train_model.py with --features flag
MB-Whatsapp\docs\FILE_MANIFEST.md:383:  Training datasets:             ✅ Ready
MB-Whatsapp\docs\FILE_MANIFEST.md:384:  Test datasets:                 ✅ Ready
MB-Whatsapp\docs\FILE_MANIFEST.md:407:│       ├── X_train_optimized.csv (37 feat)
MB-Whatsapp\docs\FILE_MANIFEST.md:408:│       ├── X_train_top80_importance.csv (31 feat)
MB-Whatsapp\docs\FILE_MANIFEST.md:410:│       ├── y_train*.csv & y_test*.csv
MB-Whatsapp\docs\FILE_MANIFEST.md:419:│   ├── classifier_*.pkl (when trained)
MB-Whatsapp\docs\FILE_MANIFEST.md:420:│   └── registry.json
MB-Whatsapp\docs\FILE_MANIFEST.md:443:Datasets:
MB-Whatsapp\docs\FILE_MANIFEST.md:444:  X_train_optimized.csv         ~8 KB (1 sample)
MB-Whatsapp\docs\FILE_MANIFEST.md:454:(Expandable to GBs with full incident dataset)
MB-Whatsapp\docs\FILE_MANIFEST.md:499:- [ ] Model training initiated
MB-Whatsapp\docs\FILE_MANIFEST.md:509:2. **Execute:** Follow the training plan (this week)
MB-Whatsapp\metabrain\metrics.py:9:    """Small in-process metrics registry for NLG runtime signals."""
MB-Whatsapp\models\v1\metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\v1\metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\v1\metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\v1\metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\v1\metrics.json:15:  "num_train_samples": 1,
MB-Chat\models\v8\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v8\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v8\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v8\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v8\metrics.json:31:  "num_train_samples": 168,
MB-Whatsapp\docs\CONTEXT_EXAMPLE.py:49:# Feature Vector [18 features]
MB-Whatsapp\docs\CONTEXT_EXAMPLE.py:64:# STEP 3: ML PREDICTION (Node.js / ONNX Runtime)
MB-Whatsapp\models\monitoring\latest_health_check.json:5:    "train_accuracy": 1.0,
MB-Whatsapp\models\monitoring\latest_health_check.json:6:    "train_precision": 1.0,
MB-Whatsapp\models\monitoring\latest_health_check.json:7:    "train_recall": 1.0,
MB-Whatsapp\models\monitoring\latest_health_check.json:8:    "train_f1": 1.0,
MB-Whatsapp\models\monitoring\latest_health_check.json:17:    "num_train_samples": 1,
MB-Whatsapp\models\monitoring\latest_health_check.json:23:    "num_train_samples": 500,
MB-Whatsapp\models\monitoring\latest_health_check.json:25:    "train_accuracy": 0.97
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:5:**Dataset:** 37 Features (Enriched from Phase 1)
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:11:The feature selection pipeline analyzed the 37-feature dataset to identify which features drive model predictions and eliminate redundancy. With theoretical importance scoring (demo data has single action class), we identified:
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:104:- **80/20 Rule**: Just 31 features (84% of dataset) capture 80% of predictive power
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:196:Keeping all features maintains information diversity. Feature pruning would only reduce interpretability without computational benefit (with current small dataset size).
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:203:**Use case:** Training with maximum information, production deployment with computational margin
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:253:- **Use:** Edge deployment, real-time constraints
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:266:### Phase 2B: Retraining (Next)
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:267:- [ ] Train model with all 37 features
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:268:- [ ] Train model with 31-feature set
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:269:- [ ] Train model with 18-feature set
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:274:- [ ] Based on retraining results, select optimal feature set
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:285:## GENERATED ARTIFACTS
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:293:### Optimized Datasets
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:294:✅ **data/processed/X_train_optimized.csv**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:298:- Ready for training
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:300:✅ **data/processed/X_train_top80_importance.csv**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:304:- For efficiency-focused training
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:328:Since the demo dataset contains only a single action class, we applied **theoretical feature importance** based on:
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:343:1. Re-run `feature_selection.py` with real training data
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:353:1. ✅ Use full 37-feature set for training
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:361:4. Retrain models with optimized feature sets
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:381:**Conclusion:** The feature expansion from Phase 1 succeeded in creating a diverse, non-redundant feature set that captures multiple dimensions of incident behavior. Ready for production model training.
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:387:1. **Retrain Models** → Use feature_selection.py outputs for next training run
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:392:See: [ML_VALIDATION_PRODUCTION.md](ML_VALIDATION_PRODUCTION.md) for full training pipeline.
MB-Chat\src\execution\powershell.executor.ts:4:import { SAFE_COMMANDS } from './command.registry';
MB-Chat\src\execution\powershell.executor.ts:46:    // C2: Metacharacter guard — detect any shell injection even from registry entries
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:11:Expandir significativamente el dataset de ML eliminando dependencia de variables temporales simples y capturando **contexto real** y **comportamiento histórico** para mejorar generalización y reducir overfitting.
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:17:### 1. 📊 Dataset Enriquecido: 37 Features
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:73:✓ X_train.csv: (1, 37) - 50% train
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:94:- Ejemplos de feature vectors
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:115:- Resultado: 0 valores nulos en dataset final
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:125:- Train/test 80/20 con stratification
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:159:    └── Train/test split (80/20)
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:161:  37-feature CSV dataset
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:162:  ├── X_train.csv, X_test.csv
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:163:  ├── y_train.csv, y_test.csv
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:168:    train_model.py
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:169:    └── RandomForest + ONNX export
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:177:- **Antes:** Gap train/test potencialmente >30% (10 simple features)
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:208:  ✅ X_train.csv, X_test.csv
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:209:  ✅ X_train_scaled.csv, X_test_scaled.csv
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:210:  ✅ y_train.csv, y_test.csv
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:236:1. ✅ Generar dataset enriquecido
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:243:   python scripts/train_model.py
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:296:- ✓ Train/test split estratificado
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:323:✅ Dataset train/test ready
MB-Whatsapp\scripts\data_pipeline.py:442:def create_dataset(input_dir='data/production_dataset', output_dir='data/processed', dataset_type='production'):
MB-Whatsapp\scripts\data_pipeline.py:443:    """Create enriched ML dataset with advanced features"""
MB-Whatsapp\scripts\data_pipeline.py:445:    print("FEATURE ENGINEERING: Creating Enriched ML Dataset")
MB-Whatsapp\scripts\data_pipeline.py:458:            "Run scripts/extract_real_dataset.py first or provide a valid --input-dir."
MB-Whatsapp\scripts\data_pipeline.py:560:        print(f"✓ Balanced dataset size: {len(df_clean)}")
MB-Whatsapp\scripts\data_pipeline.py:627:    # === TRAIN/VALIDATION/TEST SPLIT ===
MB-Whatsapp\scripts\data_pipeline.py:629:    print("TRAIN/VALIDATION/TEST SPLIT")
MB-Whatsapp\scripts\data_pipeline.py:632:    from sklearn.model_selection import train_test_split
MB-Whatsapp\scripts\data_pipeline.py:640:        # For small datasets, use 70/30 split and duplicate validation from test
MB-Whatsapp\scripts\data_pipeline.py:641:        X_train, X_test, y_train, y_test = train_test_split(
MB-Whatsapp\scripts\data_pipeline.py:645:        # Duplicate test as validation for small datasets
MB-Whatsapp\scripts\data_pipeline.py:648:        print(f"\nSmall dataset ({n_samples} samples) - using 70/30 split with validation = test")
MB-Whatsapp\scripts\data_pipeline.py:651:        X_train_val, X_test, y_train_val, y_test = train_test_split(
MB-Whatsapp\scripts\data_pipeline.py:657:        X_train, X_val, y_train, y_val = train_test_split(
MB-Whatsapp\scripts\data_pipeline.py:658:            X_train_val, y_train_val, test_size=val_size, random_state=42,
MB-Whatsapp\scripts\data_pipeline.py:659:            stratify=y_train_val if len(y_train_val.unique()) > 1 else None
MB-Whatsapp\scripts\data_pipeline.py:662:    print(f"\nTrain set: {X_train.shape[0]} samples ({X_train.shape[0]/len(X)*100:.1f}%)")
MB-Whatsapp\scripts\data_pipeline.py:665:    print(f"Features: {X_train.shape[1]}")
MB-Whatsapp\scripts\data_pipeline.py:670:    X_train_scaled = scaler.fit_transform(X_train)
MB-Whatsapp\scripts\data_pipeline.py:677:    # === SAVE DATASETS ===
MB-Whatsapp\scripts\data_pipeline.py:679:    print("SAVING DATASETS")
MB-Whatsapp\scripts\data_pipeline.py:684:    # Save raw datasets
MB-Whatsapp\scripts\data_pipeline.py:685:    X_train.to_csv(os.path.join(output_dir, 'X_train.csv'), index=False)
MB-Whatsapp\scripts\data_pipeline.py:688:    y_train.to_csv(os.path.join(output_dir, 'y_train.csv'), index=False)
MB-Whatsapp\scripts\data_pipeline.py:692:    # Save scaled datasets (for RF, need original; for NN/SVM need scaled)
MB-Whatsapp\scripts\data_pipeline.py:693:    np.savetxt(os.path.join(output_dir, 'X_train_scaled.csv'), X_train_scaled, delimiter=',')
MB-Whatsapp\scripts\data_pipeline.py:711:        'dataset_type': dataset_type,
MB-Whatsapp\scripts\data_pipeline.py:714:        'train_samples': X_train.shape[0],
MB-Whatsapp\scripts\data_pipeline.py:717:        'num_features': X_train.shape[1],
MB-Whatsapp\scripts\data_pipeline.py:729:    print(f"\n✓ X_train.csv: {X_train.shape}")
MB-Whatsapp\scripts\data_pipeline.py:731:    print(f"✓ y_train.csv: {y_train.shape}")
MB-Whatsapp\scripts\data_pipeline.py:741:Dataset enrichment complete!
MB-Whatsapp\scripts\data_pipeline.py:756:✓ Train/val/test split: {X_train.shape[0]}/{X_val.shape[0]}/{X_test.shape[0]} (70/15/15)
MB-Whatsapp\scripts\data_pipeline.py:758:✓ Ready for ML model training!
MB-Whatsapp\scripts\data_pipeline.py:762:    parser = argparse.ArgumentParser(description='Feature engineering pipeline for MetaBrain datasets')
MB-Whatsapp\scripts\data_pipeline.py:763:    parser.add_argument('--input-dir', default='data/production_dataset', help='Input dataset directory')
MB-Whatsapp\scripts\data_pipeline.py:766:        '--dataset-type',
MB-Whatsapp\scripts\data_pipeline.py:769:        help='Dataset provenance label stored in metadata',
MB-Whatsapp\scripts\data_pipeline.py:773:    create_dataset(input_dir=args.input_dir, output_dir=args.output_dir, dataset_type=args.dataset_type)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:13:Dataset: X_train_optimized.csv, X_test_optimized.csv
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:21:- Training initial models
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:23:- No latency constraints
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:33:Dataset: X_train_top80_importance.csv, X_test_top80_importance.csv
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:41:- Reducing training time
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:69:- Real-time constraints (<100ms)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:105:### Python: Load and Train
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:113:X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:115:y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:118:# Train model
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:120:model.fit(X_train, y_train)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:128:X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:133:model.fit(X_train, y_train)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:149:X_train_full = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:150:X_train_minimal = X_train_full[top_18_features]
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:153:model.fit(X_train_minimal, y_train)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:156:### Node.js/ONNX: Inference
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:159:import * as ort from 'onnxruntime-node';
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:163:  'models/incident_classifier_v37.onnx'  // Full set
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:270:    data_train = "data/processed/X_train_optimized.csv"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:274:    data_train = "data/processed/X_train_top80_importance.csv"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:278:### Step 3: Train and Validate
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:280:X_train = pd.read_csv(data_train)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:282:y_train = pd.read_csv("data/processed/y_train_optimized.csv").values.ravel()
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:286:model.fit(X_train, y_train)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:288:train_score = model.score(X_train, y_train)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:290:print(f"Accuracy: Train={train_score:.4f}, Test={test_score:.4f}")
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:295:# Convert to ONNX for cross-platform inference
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:296:from skl2onnx import convert_sklearn
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:297:from skl2onnx.common.data_types import FloatTensorType
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:299:initial_type = [("double", FloatTensorType([None, X_train.shape[1]]))]
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:300:onnx_model = convert_sklearn(model, initial_types=initial_type)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:302:with open(f'models/classifier_{feature_set}.onnx', 'wb') as f:
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:303:    f.write(onnx_model.SerializeToString())
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:312:- [ ] Train models with each set
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:325:- [ML_VALIDATION_PRODUCTION.md](ML_VALIDATION_PRODUCTION.md) - Training pipeline
MB-Whatsapp\models\model_metrics.json:3:  "train_accuracy": 1.0,
MB-Whatsapp\models\model_metrics.json:4:  "train_precision": 1.0,
MB-Whatsapp\models\model_metrics.json:5:  "train_recall": 1.0,
MB-Whatsapp\models\model_metrics.json:6:  "train_f1": 1.0,
MB-Whatsapp\models\model_metrics.json:75:  "num_train_samples": 168,
MB-Whatsapp\scripts\model_rollback.py:16:    def __init__(self, registry_path: str = 'models/registry.json', model_dir: str = 'models'):
MB-Whatsapp\scripts\model_rollback.py:17:        self.registry_path = registry_path
MB-Whatsapp\scripts\model_rollback.py:19:        self.registry_dir = os.path.dirname(registry_path)
MB-Whatsapp\scripts\model_rollback.py:20:        self.registry = self._load_registry()
MB-Whatsapp\scripts\model_rollback.py:22:    def _load_registry(self) -> dict:
MB-Whatsapp\scripts\model_rollback.py:23:        """Load registry"""
MB-Whatsapp\scripts\model_rollback.py:24:        if os.path.exists(self.registry_path):
MB-Whatsapp\scripts\model_rollback.py:25:            with open(self.registry_path, 'r') as f:
MB-Whatsapp\scripts\model_rollback.py:29:    def _save_registry(self):
MB-Whatsapp\scripts\model_rollback.py:30:        """Save registry"""
MB-Whatsapp\scripts\model_rollback.py:31:        with open(self.registry_path, 'w') as f:
MB-Whatsapp\scripts\model_rollback.py:32:            json.dump(self.registry, f, indent=2)
MB-Whatsapp\scripts\model_rollback.py:36:        return self.registry.get('versions', [])
MB-Whatsapp\scripts\model_rollback.py:40:        history = self.registry.get('history', [])
MB-Whatsapp\scripts\model_rollback.py:60:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_rollback.py:66:            print(f"✗ Version {version} not found in registry")
MB-Whatsapp\scripts\model_rollback.py:70:        current_prod = self.registry.get('current_production')
MB-Whatsapp\scripts\model_rollback.py:77:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_rollback.py:89:        version_dir = os.path.join(self.registry_dir, version)
MB-Whatsapp\scripts\model_rollback.py:93:            'decision_model.onnx',
MB-Whatsapp\scripts\model_rollback.py:111:        # Update registry
MB-Whatsapp\scripts\model_rollback.py:118:        self.registry['current_production'] = version
MB-Whatsapp\scripts\model_rollback.py:121:        self.registry['history'].append({
MB-Whatsapp\scripts\model_rollback.py:129:        self._save_registry()
MB-Whatsapp\scripts\model_rollback.py:149:        current = self._get_version(self.registry['current_production'])
MB-Whatsapp\scripts\model_rollback.py:152:        for v in reversed(self.registry['versions']):
MB-Whatsapp\scripts\model_rollback.py:153:            if v['version'] == self.registry['current_production']:
MB-Whatsapp\scripts\model_rollback.py:175:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_rollback.py:177:                if v['version'] != self.registry['current_production']:
MB-Whatsapp\scripts\model_rollback.py:189:        """Get version from registry"""
MB-Whatsapp\scripts\model_rollback.py:190:        for v in self.registry['versions']:
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:3:**Project:** MetaBrain ML Dataset Enrichment
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:12:Expand ML dataset from **10 basic features** → **37 advanced features**
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:28:   ├─ Train/Test split:   ✓ 80/20 stratified
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:106:## 📂 Dataset Structure
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:111:├── X_train.csv                    (1×37): Training features
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:113:├── X_train_scaled.csv            (1×37): Scaled for SVM/NN
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:115:├── y_train.csv                    (1×1):  Labels
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:119:└── metadata.json                  (meta): Dataset info
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:152:   Train/Test Datasets (80/20)
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:153:   ├── X_train: (N, 37)
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:154:   ├── y_train: (N,)
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:158:   [train_model.py] → decision_model.pkl, .onnx
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:181:├── Example vectors
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:212:     └─ Gap (train/test): Potential >20-30%
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:229:     └─ Gap (train/test): Expected <10-15%
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:237:### Targets (Post-Training)
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:278:- [x] Train/test split: Stratified 80/20
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:292:### Week 1: Training & Validation
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:294:# 1. Train model with new features
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:295:python scripts/train_model.py
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:335:# Daily retraining
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:351:### Dataset Metrics
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:355:Train/Test Split:           80/20 (stratified)
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:369:Feature Correlation:        To be analyzed post-training
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:370:Feature Importance:         Ranked post-training
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:407:✅ 0 null values in cleaned dataset
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:411:✅ dataset ready for training
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:417:STATUS: 🎉 READY FOR MODEL TRAINING
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:428:# Train:    python scripts/train_model.py
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:444:✅ data/processed/* (dataset)
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:473:║   ✓ Dataset ready for training                           ║
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:476:║   NEXT: python scripts/train_model.py                    ║
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:485:**Next Phase:** Model Training & Validation
MB-Chat\src\execution\execution.service.ts:3:import { SAFE_COMMANDS } from './command.registry';
MB-Chat\src\execution\execution.service.ts:41:    // --- Gate 3: registry tier check ---
MB-Chat\src\execution\execution.service.ts:43:      return this.denied(action, `Action blocked by registry policy: ${action.command}`, rollbackHint);
MB-Whatsapp\scripts\build_sequence_dataset.py:408:    parser = argparse.ArgumentParser(description='Build sequential anomaly dataset from system events')
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:5:El dataset de entrenamiento pasó de **10 features simples** a **37 features avanzadas**:
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:16:### 1. Generar Dataset Enriquecido
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:25:X_train.csv          → 37 features × train samples
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:27:y_train.csv, y_test.csv → Labels
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:44:python scripts/train_model.py
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:114:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:115:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:129:model.fit(X_train, y_train.values.ravel())
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:171:1. **Dataset generado:**
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:174:   # Debe mostrar X_train.csv, X_test.csv, X_train_scaled.csv, X_test_scaled.csv
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:185:   python -c "import pandas as pd; df = pd.read_csv('data/processed/X_train.csv'); print(f'Nulls: {df.isnull().sum().sum()}')"
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:189:4. **Model training:**
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:191:   python scripts/train_model.py
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:192:   # Debe guardar models/decision_model.pkl (y .onnx)
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:226:→ Re-ejecuta: `python scripts/train_model.py`
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:240:1. ✓ Generar dataset: `python scripts/data_pipeline.py`
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:242:3. ✓ Entrenar: `python scripts/train_model.py`
MB-Whatsapp\scripts\model_registry.py:2:MetaBrain ML Model Registry
MB-Whatsapp\scripts\model_registry.py:14:class ModelRegistry:
MB-Whatsapp\scripts\model_registry.py:15:    """Central registry for recording and managing model versions"""
MB-Whatsapp\scripts\model_registry.py:17:    def __init__(self, registry_path: str = 'models/registry.json'):
MB-Whatsapp\scripts\model_registry.py:18:        self.registry_path = registry_path
MB-Whatsapp\scripts\model_registry.py:19:        self.registry_dir = os.path.dirname(registry_path)
MB-Whatsapp\scripts\model_registry.py:20:        os.makedirs(self.registry_dir, exist_ok=True)
MB-Whatsapp\scripts\model_registry.py:21:        self.registry = self._load_registry()
MB-Whatsapp\scripts\model_registry.py:23:    def _load_registry(self) -> Dict:
MB-Whatsapp\scripts\model_registry.py:24:        """Load registry from JSON file"""
MB-Whatsapp\scripts\model_registry.py:25:        if not os.path.exists(self.registry_path):
MB-Whatsapp\scripts\model_registry.py:34:            with open(self.registry_path, 'r') as f:
MB-Whatsapp\scripts\model_registry.py:37:            print(f"Error loading registry: {e}")
MB-Whatsapp\scripts\model_registry.py:45:    def _save_registry(self):
MB-Whatsapp\scripts\model_registry.py:46:        """Save registry to JSON file"""
MB-Whatsapp\scripts\model_registry.py:47:        with open(self.registry_path, 'w') as f:
MB-Whatsapp\scripts\model_registry.py:48:            json.dump(self.registry, f, indent=2)
MB-Whatsapp\scripts\model_registry.py:52:        if not self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:55:        last_version = self.registry['versions'][-1]['version']
MB-Whatsapp\scripts\model_registry.py:72:        version_dir = os.path.join(self.registry_dir, next_version)
MB-Whatsapp\scripts\model_registry.py:78:        for file in ['decision_model.pkl', 'decision_model.onnx', 'confusion_matrix.json', 'onnx_metadata.json', 'feature_names.txt']:
MB-Whatsapp\scripts\model_registry.py:93:            'train_accuracy': metrics.get('train_accuracy', 0),
MB-Whatsapp\scripts\model_registry.py:95:            'train_f1': metrics.get('train_f1', 0),
MB-Whatsapp\scripts\model_registry.py:100:            'num_train_samples': metrics.get('num_train_samples', 0),
MB-Whatsapp\scripts\model_registry.py:112:        self.registry['versions'].append(version_record)
MB-Whatsapp\scripts\model_registry.py:113:        self.registry['staging'] = next_version
MB-Whatsapp\scripts\model_registry.py:116:        self.registry['history'].append({
MB-Whatsapp\scripts\model_registry.py:123:        self._save_registry()
MB-Whatsapp\scripts\model_registry.py:147:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:162:        if self.registry['current_production']:
MB-Whatsapp\scripts\model_registry.py:163:            for v in self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:164:                if v['version'] == self.registry['current_production']:
MB-Whatsapp\scripts\model_registry.py:169:        self.registry['current_production'] = version
MB-Whatsapp\scripts\model_registry.py:172:        self.registry['history'].append({
MB-Whatsapp\scripts\model_registry.py:176:            'previous_production': self.registry['current_production']
MB-Whatsapp\scripts\model_registry.py:179:        self._save_registry()
MB-Whatsapp\scripts\model_registry.py:189:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:193:                self.registry['history'].append({
MB-Whatsapp\scripts\model_registry.py:200:                self._save_registry()
MB-Whatsapp\scripts\model_registry.py:208:        if not self.registry['current_production']:
MB-Whatsapp\scripts\model_registry.py:211:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:212:            if v['version'] == self.registry['current_production']:
MB-Whatsapp\scripts\model_registry.py:219:        if not self.registry['staging']:
MB-Whatsapp\scripts\model_registry.py:222:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:223:            if v['version'] == self.registry['staging']:
MB-Whatsapp\scripts\model_registry.py:230:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:241:            format: 'pkl' or 'onnx'
MB-Whatsapp\scripts\model_registry.py:246:        version_dir = os.path.join(self.registry_dir, version)
MB-Whatsapp\scripts\model_registry.py:252:        elif format == 'onnx':
MB-Whatsapp\scripts\model_registry.py:253:            model_file = os.path.join(version_dir, 'decision_model.onnx')
MB-Whatsapp\scripts\model_registry.py:262:        print("MODEL REGISTRY HISTORY")
MB-Whatsapp\scripts\model_registry.py:268:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_registry.py:270:            symbol = '●' if v['version'] == self.registry['current_production'] else '◯'
MB-Whatsapp\scripts\model_registry.py:276:        print(f"Current Production: {self.registry['current_production'] or 'None'}")
MB-Whatsapp\scripts\model_registry.py:277:        print(f"Current Staging:    {self.registry['staging'] or 'None'}")
MB-Whatsapp\scripts\model_registry.py:278:        print(f"Total Versions:     {len(self.registry['versions'])}")
MB-Whatsapp\scripts\model_registry.py:282:        """Print registry summary"""
MB-Whatsapp\scripts\model_registry.py:284:        print("MODEL REGISTRY SUMMARY")
MB-Whatsapp\scripts\model_registry.py:306:        print(f"Total Versions: {len(self.registry['versions'])}")
MB-Whatsapp\scripts\model_registry.py:312:    registry = ModelRegistry()
MB-Whatsapp\scripts\model_registry.py:316:        'train_accuracy': 0.95,
MB-Whatsapp\scripts\model_registry.py:318:        'train_f1': 0.93,
MB-Whatsapp\scripts\model_registry.py:323:        'num_train_samples': 500,
MB-Whatsapp\scripts\model_registry.py:328:    # Register (would be called by train_model.py)
MB-Whatsapp\scripts\model_registry.py:329:    version = registry.register_model(
MB-Whatsapp\scripts\model_registry.py:331:        notes="Training with 500 samples"
MB-Whatsapp\scripts\model_registry.py:335:    registry.print_summary()
MB-Whatsapp\scripts\model_registry.py:336:    registry.print_history()
MB-Whatsapp\scripts\analyze_features.py:4:Analyzes the enriched dataset and shows which features are most valuable
MB-Whatsapp\scripts\analyze_features.py:27:    # Check if datasets exist
MB-Whatsapp\scripts\analyze_features.py:28:    if not os.path.exists('data/processed/X_train.csv'):
MB-Whatsapp\scripts\analyze_features.py:29:        print("\nERROR: Training data not found!")
MB-Whatsapp\scripts\analyze_features.py:34:    print("\nLoading datasets...")
MB-Whatsapp\scripts\analyze_features.py:35:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\scripts\analyze_features.py:36:    y_train = pd.read_csv('data/processed/y_train.csv')
MB-Whatsapp\scripts\analyze_features.py:39:    print(f"✓ Loaded {X_train.shape[0]} training samples, {X_train.shape[1]} features")
MB-Whatsapp\scripts\analyze_features.py:46:    numeric_cols = X_train.select_dtypes(include=[np.number]).columns
MB-Whatsapp\scripts\analyze_features.py:47:    stats = X_train[numeric_cols].describe().T
MB-Whatsapp\scripts\analyze_features.py:50:    variance = X_train[numeric_cols].var().sort_values(ascending=False)
MB-Whatsapp\scripts\analyze_features.py:89:            print("Run: python scripts/train_model.py first")
MB-Whatsapp\scripts\analyze_features.py:91:        print("Model not found. Run: python scripts/train_model.py")
MB-Whatsapp\scripts\analyze_features.py:132:    print(f"\nDataset Shape: {X_train.shape}")
MB-Whatsapp\scripts\analyze_features.py:133:    print(f"Null Values: {X_train.isnull().sum().sum()}")
MB-Whatsapp\scripts\analyze_features.py:134:    print(f"Duplicated Rows: {X_train.duplicated().sum()}")
MB-Whatsapp\scripts\analyze_features.py:135:    print(f"Memory Usage: {X_train.memory_usage(deep=True).sum() / 1024:.2f} KB")
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:1:# 🚀 IMMEDIATE ACTION PLAN: Phase 3 - Model Training & Benchmark
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:5:**Objective:** Train models with 3 feature sets and select optimal for production
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:11:### Week 1: Model Training & Benchmarking
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:13:#### 🎯 Day 1-2: Training Phase
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:14:- **Output datasets ready:** ✅ Yes (3 variants prepared)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:20:# Task 1: Train full 37-feature model
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:21:python scripts/train_model.py --features full --n-estimators 100
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:23:# Task 2: Train 31-feature optimized model
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:24:python scripts/train_model.py --features top80 --n-estimators 100
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:26:# Task 3: Train 18-feature minimal model
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:27:python scripts/train_model.py --features top90 --n-estimators 100
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:29:# Task 4: Train baseline (previous 10-feature model) for comparison
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:30:python scripts/train_model.py --features baseline --n-estimators 100
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:75:    'full': 'data/processed/X_train_optimized.csv',
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:76:    'top80': 'data/processed/X_train_top80_importance.csv',
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:93:### Step 2: Create train_model.py Script
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:97:- Train RandomForestClassifier with standard hyperparameters
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:100:- Export to ONNX format
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:111:def train_model(feature_set='full', n_estimators=100):
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:112:    """Train model with specified feature set"""
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:114:    # Load datasets
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:116:        X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:119:        X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:124:    y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:127:    # Train model
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:128:    print(f"Training RandomForest with {feature_set} feature set...")
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:129:    print(f"  Features: {X_train.shape[1]}")
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:130:    print(f"  Sample size: {X_train.shape[0]}")
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:141:    model.fit(X_train, y_train)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:144:    train_score = model.score(X_train, y_train)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:147:    print(f"✓ Model trained")
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:148:    print(f"  Train accuracy: {train_score:.4f}")
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:157:    return model, train_score, test_score
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:166:    train_model(args.features, args.n_estimators)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:171:**Purpose:** Compare all trained models side-by-side
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:174:- Training accuracy
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:176:- Overfitting gap (train - test)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:186:Model          Features  Train Acc  Test Acc  Overfitting  Approx Time  Size
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:273:### ✅ Training Success Criteria
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:275:- [ ] All 3 models train successfully
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:276:- [ ] Training completes in <5 minutes total
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:277:- [ ] Both train and test accuracies > 70%
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:278:- [ ] Models export to ONNX successfully
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:298:Phase 3: Model Training & Benchmark
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:300:Day 1-2:  Model Training (3 variants + baseline)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:302:  ├─ 08:30 - Train full set (5-10 min)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:303:  ├─ 09:00 - Train top-80 set (5-10 min)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:304:  ├─ 09:30 - Train top-90 set (5-10 min)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:305:  ├─ 10:00 - Train baseline (5-10 min)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:364:### If models don't train successfully
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:365:- Check feature names match between train/test
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:371:- Check label encoding (y_train values)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:380:- Check for vector operations bottlenecks
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:418:python -c "import pandas as pd; print(pd.read_csv('data/processed/X_train_optimized.csv').shape)"
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:420:# 2. Create train_model.py script (see template above)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:421:# 3. Run training commands (see Step 2)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:429:**Next Step:** Create train_model.py and start training
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:1:# Feature Engineering: Dataset Enriquecido
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:5:Se ha expandido significativamente el dataset de entrenamiento pasando de **10 features simples** a **37 features avanzadas**, eliminando la dependencia de variables temporales básicas y capturando contexto real, comportamiento histórico y señales de comportamiento.
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:112:## Ejemplo: Feature Vector Enriquecido
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:188:   - ✓ Preservación de distribución en train/test
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:196:   - ✓ Train/Test split 80/20 con stratify por acción
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:199:### 📊 Estadísticas del Dataset
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:207:| Train set | 1 (50%) |
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:220:├── X_train.csv                    # 37 features de entrenamiento
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:222:├── X_train_scaled.csv             # Versión normalizada (para SVM/NN)
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:224:├── y_train.csv                    # Labels de acción (train)
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:245:- Gap train/test → potencialmente >30%
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:265:## Uso del Dataset Enriquecido
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:267:### Training
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:275:# 5. Guarda datasets en data/processed/
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:280:### ML Training
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:286:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:287:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:291:model.fit(X_train, y_train.values.ravel())
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:294:X_train_scaled = pd.read_csv('data/processed/X_train_scaled.csv')
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:296:model_nn.fit(X_train_scaled, y_train.values.ravel())
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:355:   python scripts/train_model.py
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:376:- [Model Training](../scripts/train_model.py)
MB-Whatsapp\scripts\model_monitor.py:42:        """Load baseline metrics from last training"""
MB-Whatsapp\scripts\model_monitor.py:122:        expected_distribution: {class: frequency} from training set
MB-Whatsapp\scripts\model_monitor.py:155:    def check_training_data_quality(self, num_samples: int,
MB-Whatsapp\scripts\model_monitor.py:157:        """Check if training data quality is sufficient"""
MB-Whatsapp\scripts\model_monitor.py:161:                metric='training_data',
MB-Whatsapp\scripts\model_monitor.py:164:                message=f'Low training data volume: {num_samples} samples. Minimum 50 recommended.',
MB-Whatsapp\scripts\model_monitor.py:172:    def check_model_staleness(self, last_training_time: datetime,
MB-Whatsapp\scripts\model_monitor.py:174:        """Check if model is too old and needs retraining"""
MB-Whatsapp\scripts\model_monitor.py:175:        age_days = (datetime.now() - last_training_time).days
MB-Whatsapp\scripts\model_monitor.py:183:                message=f'Model is {age_days} days old. Recommend retraining.',
MB-Whatsapp\scripts\model_monitor.py:222:        data_alert = self.check_training_data_quality(
MB-Whatsapp\scripts\model_monitor.py:223:            current_metrics.get('num_train_samples', 0)
MB-Whatsapp\scripts\model_monitor.py:275:        'num_train_samples': 500,
MB-Whatsapp\scripts\model_monitor.py:277:        'train_accuracy': 0.97,
MB-Chat\src\execution\execution-denied-status.spec.ts:57:      updateOnlineTrainingOutcome: jest.fn().mockResolvedValue(undefined),
MB-Chat\src\execution\execution-denied-status.spec.ts:58:      saveOnlineTrainingRecord: jest.fn().mockResolvedValue(undefined),
MB-Chat\src\execution\execution-denied-status.spec.ts:88:          featureVector: [],
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:5:### 📊 Dataset Enrichment
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:70:[18-Feature Vector] → RFC Model
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:149:✅ scripts/train_model.py
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:186:✅ Dataset generado: `data/processed/X_train.csv` (18 cols)
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:187:✅ Modelo entrenado: `models/decision_model.onnx` (18 inputs)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:3:**Current Status:** ✅ COMPLETE - Ready for Production Model Training
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:15:- Stratified train/test split (80/20)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:23:- Produced ready-to-use optimized datasets
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:91:Dataset Quality Metrics:
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:94:Sample Count:           1 train, 1 test (demo dataset)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:102:Train/Test Split:
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:115:✅ **Processed Datasets**
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:116:- `X_train.csv` (37 features, normalized)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:118:- `y_train.csv` / `y_test.csv` (labels)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:218:✅ **Optimized Datasets (3 variants)**
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:220:   - `X_train_optimized.csv`
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:225:   - `X_train_top80_importance.csv`
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:284:- Stratified train/test split
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:295:**Phase 3: Model Training & Benchmarking** (Immediate)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:296:- [ ] Train RandomForest with all 37 features
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:297:- [ ] Train RandomForest with 31 features
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:298:- [ ] Train RandomForest with 18 features
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:372:- [x] Train/test split with stratification
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:387:- [x] Production datasets prepared
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:468:- Encoder/scaler artifacts: ~5MB total
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:483:### 🎯 Priority 1: Model Training (This Week)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:486:# Train with all 37 features
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:487:python scripts/train_model.py --feature-set full
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:489:# Train with top-80 feature set
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:490:python scripts/train_model.py --feature-set top80
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:492:# Train with top-90 feature set
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:493:python scripts/train_model.py --feature-set top90
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:524:**Status:** ✅ READY FOR PRODUCTION MODEL TRAINING
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:530:3. **Production-ready datasets** with zero quality issues
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:535:- **Immediate:** Train and benchmark models with 3 feature sets
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:539:🚀 **Ready to proceed to Phase 3: Model Training!**
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:550:### Generated Datasets
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:551:- `data/processed/X_train_optimized.csv` (37 features)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:553:- `data/processed/X_train_top80_importance.csv` (31 features)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:556:- `data/processed/y_train*.csv` / `y_test*.csv` (Labels)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:584:**Ready for:** Phase 3 - Model Training & Benchmark
MB-Chat\src\execution\command.registry.ts:6:export interface CommandRegistryEntry {
MB-Chat\src\execution\command.registry.ts:14:export const SAFE_COMMANDS: Record<CommandId, CommandRegistryEntry> = {
MB-Whatsapp\scripts\model_compare.py:15:    def __init__(self, registry_path: str = 'models/registry.json'):
MB-Whatsapp\scripts\model_compare.py:16:        self.registry_path = registry_path
MB-Whatsapp\scripts\model_compare.py:17:        self.registry_dir = os.path.dirname(registry_path)
MB-Whatsapp\scripts\model_compare.py:18:        self.registry = self._load_registry()
MB-Whatsapp\scripts\model_compare.py:20:    def _load_registry(self) -> Dict:
MB-Whatsapp\scripts\model_compare.py:21:        """Load registry"""
MB-Whatsapp\scripts\model_compare.py:22:        if os.path.exists(self.registry_path):
MB-Whatsapp\scripts\model_compare.py:23:            with open(self.registry_path, 'r') as f:
MB-Whatsapp\scripts\model_compare.py:54:            'train_accuracy',
MB-Whatsapp\scripts\model_compare.py:57:            'num_train_samples'
MB-Whatsapp\scripts\model_compare.py:86:        prod = self.registry['current_production']
MB-Whatsapp\scripts\model_compare.py:108:        prod = self._get_version(self.registry['current_production']) if self.registry['current_production'] else None
MB-Whatsapp\scripts\model_compare.py:220:        if candidate['num_train_samples'] >= prod['num_train_samples']:
MB-Whatsapp\scripts\model_compare.py:223:                'prod': prod['num_train_samples'],
MB-Whatsapp\scripts\model_compare.py:224:                'candidate': candidate['num_train_samples'],
MB-Whatsapp\scripts\model_compare.py:225:                'message': 'More or equal training samples'
MB-Whatsapp\scripts\model_compare.py:231:                'prod': prod['num_train_samples'],
MB-Whatsapp\scripts\model_compare.py:232:                'candidate': candidate['num_train_samples'],
MB-Whatsapp\scripts\model_compare.py:233:                'reason': 'Fewer training samples'
MB-Whatsapp\scripts\model_compare.py:256:        """Get version from registry"""
MB-Whatsapp\scripts\model_compare.py:257:        for v in self.registry['versions']:
MB-Whatsapp\scripts\model_compare.py:330:    registry = json.load(open('models/registry.json')) if os.path.exists('models/registry.json') else {'versions': []}
MB-Whatsapp\scripts\model_compare.py:332:    versions = [v['version'] for v in registry.get('versions', [])]
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:45:#### 📊 Dataset Enriquecido
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:48:✅ X_train.csv              (1, 37) - Features entrenamiento
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:50:✅ X_train_scaled.csv       (1, 37) - Versión normalizada
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:52:✅ y_train.csv              (1,)    - Labels entrenamiento
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:56:✅ metadata.json            (meta)  - Info del dataset
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:137:✅ Train/test split:         Stratified 80/20
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:201:# Genera: 37 features, dataset limpio, encoders
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:214:python scripts/train_model.py
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:242:└─ Potencial gap train/test: 20-30%
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:324:✅ 0 null values en dataset limpio
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:328:✅ Dataset ready para training
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:348:  └─ Split train/test
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:350:Clean Dataset (37 features)
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:351:  ├─ X_train.csv ✅
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:353:  ├─ y_train.csv ✅
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:358:    ↓ [train_model.py] READY
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:359:  Model Training
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:371:- [x] ✅ Generar dataset enriquecido
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:372:- [ ] → Ejecutar: `python scripts/train_model.py`
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:386:- [ ] Daily retraining
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:407:║   NEXT PHASE: Model Training                                  ║
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:408:║   RUN: python scripts/train_model.py                          ║
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:419:**Fase siguiente:** Model Training & Validation
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:426:- Dataset: `data/processed/X_train.csv` (37 features)
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:434:# Entrenar: python scripts/train_model.py
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:24:│   PersistenceService.saveOnlineTrainingRecord() ────────────┐   │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:30:│  - onnxFeatureVector (array exacto usado)                   │   │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:38:│            MongoDB: online_training_buffer                      │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:40:│ Collection: online_training_buffer                             │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:41:│ ├─ UsedInTraining: false (nuevo)                              │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:42:│ ├─ Indices: (incidentId, createdAt, usedInTraining)          │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:43:│ └─ Esquema: OnlineTrainingBuffer (v. linea 1-128)            │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:62:│   getUntrainedBufferRecords(limit=1000, quality=true)         │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:65:│      - featureVector sin NaN                                 │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:68:│   shouldTriggerRetrain() checks:                              │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:70:│     - Throttle: mín 30 min desde último retrain              │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:72:│   exportIncrementalDataset() → CSV temporal                   │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:74:│ Output: data/incremental/training_buffer_<timestamp>.csv     │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:77:FASE 4: RETRAINING INCREMENTAL + GATE
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:81:│   python scripts/train_model_incremental.py <buffer.csv>       │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:82:│     ├─ Carga: X_train_hist.csv + incremental                  │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:90:│     │   └─ onnx_parity == 1.0     ✓                           │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:93:│     │     ├─ Save decision_model.onnx                        │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:95:│     │     ├─ Register in registry.json (vX)                  │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:96:│     │     └─ Mark buffer records as usedInTraining=true      │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:99:│     │     └─ DEPLOYMENT BLOCKED (pero artifacts guardados)   │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:114:│     - Polling periódico de decision_model.onnx                │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:125:│  └─ Comparar distribución actual vs training:                │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:128:│     - Trigger: retraining prioritario                        │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:152:      → ONNX inference
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:159:      featureVector,
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:168:  → PersistenceService.saveOnlineTrainingRecord()
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:174:      onnxFeatureVector: [0.5, 0.3, ...],
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:192:        isFromEarlyTraining: false
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:207:    "hasValidOutput": true  // ← Ahora es ready para training
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:220:  untrainedRecords: 150
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:221:  recordsWithOutcome: 75  (≥ MIN_UNTRAINED_WITH_OUTCOME = 20) ✓
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:222:  timeSinceLastRetrain: 35 min (≥ MIN_RETRAIN_INTERVAL = 30 min) ✓
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:224:Decision: shouldRetrain = true
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:226:  exportIncrementalDataset()
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:227:    ├─ Query: { usedInTraining: false, qualityMetadata.hasValidOutput: true }
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:230:    └─ Guardado en: data/incremental/training_buffer_2026-04-19T213045Z.csv
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:236:python scripts/train_model_incremental.py data/incremental/training_buffer_2026-04-19T213045Z.csv
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:240:     ├─ X_train_hist: 168 samples, 37 features
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:241:     └─ y_train_hist: [A, B, C, D] labels
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:248:  3. combine_datasets()
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:253:  4. train_incremental_model()
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:268:     ├─ onnx_parity = 1.0 == 1.0 ✓ PASS
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:272:     7. export_onnx_metadata()
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:273:        ├─ Save decision_model.onnx
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:274:        ├─ Save onnx_metadata.json
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:287:        └─ Registry entry: { v16: 0.9722, features: ... }
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:290:        ├─ UPDATE online_training_buffer
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:291:        ├─ SET usedInTraining = true
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:306:| `src/persistence/schemas/online-training-buffer.schema.ts` | 1 | Schema MongoDB para capturar feedback |
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:308:| `scripts/train_model_incremental.py` | 4 | Pipeline Python para reentrenamiento incremental |
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:314:| `src/persistence/persistence.module.ts` | 1 | Registra OnlineTrainingBuffer schema |
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:315:| `src/persistence/persistence.service.ts` | 1 | Métodos `saveOnlineTrainingRecord()`, `getUntrainedBufferRecords()`, etc. |
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:316:| `src/brain/brain.service.ts` | 1 | Captura feedback with `persistenceService.saveOnlineTrainingRecord()` |
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:326:// OnlineLearningService.shouldTriggerRetrain()
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:327:const MIN_UNTRAINED_WITH_OUTCOME = 20;      // Mínimo records con feedback
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:328:const MIN_RETRAIN_INTERVAL_MS = 30 * 60 * 1000;  // 30 min entre retrains
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:330:// train_model_incremental.py (Gate)
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:342:> db.online_training_buffer.find().limit(1)
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:354:cat models/registry.json | jq '.versions | reverse | .[0]'
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:28:└── Cron: retrainModel() cada medianoche
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:68:#### `retrainModel() @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:71:// Shell: python scripts/data_pipeline.py && python scripts/train_model.py
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:72:// Retrains ONNX model on historical outcomes
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:358:  - command in SAFE_COMMANDS registry
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:616:| `retrainModel()` | `@Cron() → Promise` | Entrena ONNX diariamente |
MB-Whatsapp\docs\ARCHITECTURE_ML_ANALYSIS.md:662:- [src/ml/predictor.ts](../src/ml/predictor.ts) - Inferencia ONNX
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:9:### 1. ✅ Model Registry (`scripts/model_registry.py`)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:21:registry = ModelRegistry()
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:22:version = registry.register_model(metrics, notes="...")
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:23:registry.promote_to_production('v2')
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:24:registry.print_history()
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:81:### 4. ✅ Integración en train_model.py
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:85:train_model.py
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:88:  ├─ Registra con ModelRegistry → v1 (STAGING)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:98:├── registry.json          # Central registry
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:101:│   ├── decision_model.onnx
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:106:│   ├── decision_model.onnx
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:111:│   ├── decision_model.onnx
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:124:│ Training Day 1  │
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:133:│ Training Day 2  │
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:143:│ Training Day 3  │
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:162:## Registry JSON Structure
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:170:      "train_accuracy": 0.90,
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:172:      "train_f1": 0.89,
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:177:      "num_train_samples": 400,
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:181:      "notes": "Initial training"
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:215:python scripts/train_model.py
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:227:from model_registry import ModelRegistry
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:228:r = ModelRegistry()
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:256:python scripts/demo_model_registry.py
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:266:| `train_accuracy` | Accuracy en train set |
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:268:| `train_f1` | F1 en train |
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:270:| `overfitting_score` | Train - Test gap |
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:273:| `num_train_samples` | Tamaño dataset entrenamiento |
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:274:| `num_test_samples` | Tamaño dataset test |
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:296:   - ✓ Export ONNX exitoso
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:323:├── model_registry.py       (420 líneas)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:326:├── demo_model_registry.py  (250 líneas)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:327:└── train_model.py          (actualizado con integración)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:330:├── registry.json           (histórico de versiones)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:337:└── ML_MODEL_REGISTRY.md    (guía completa)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:343:$ python scripts/train_model.py
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:345:[Training output...]
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:347:MODEL REGISTRY
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:361:  ✓ data:        PASS  More training samples
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:365:TRAINING SUMMARY
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:15:- **Model Training**: RandomForest con métricas separadas (train vs test)
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:20:python scripts/run_ml_validation.py  # Ejecuta todo: data → train → validate → monitor
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:26:Implementó dicotomía train vs test para detectar memorización:
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:29:Overfitting Score = Train Accuracy - Test Accuracy
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:41:- k = min(5, len(train_data)) - Adapta a datasets pequeños
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:56:  "train_accuracy": 1.0, "train_precision": 1.0, "train_recall": 1.0, "train_f1": 1.0,
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:61:  "num_train_samples": 1,
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:93:- • Collect more diverse training data
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:102:✓ Training Data Quality: < 50 samples
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:113:STEP 2: Model Training (with Validation)           ✓ PASS
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:125:| `data_pipeline.py` | Feature engineering | X_train.csv, X_test.csv, encoders |
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:126:| `train_model.py` | Entrenar con validación | model.pkl, model.onnx, metrics.json |
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:142:- ✓ **Train Accuracy**: 1.0000
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:160:- Train Samples: 1 (minimum for proof of concept)
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:167:- **Caveat**: With minimal training data; score scales with more examples
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:172:- [x] Train/test split implementado (80/20)
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:174:- [x] Overfitting score (train_acc - test_acc) calculado
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:195:- Model training con RandomForest
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:197:- Precision/recall/F1 metrics por dataset
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:198:- Overfitting detection (train vs test gap)
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:208:- All 4 steps passed (data → train → validate → monitor)
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:239:   - Daily retraining via GitHub Actions
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:262:  scripts/train_model.py              # Enhanced training (312 lines)
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:282:1. **Previene overfitting** mediante train/test split y cross-validation
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:10:Data → Features (18) → Train/Val/Test Split (70/15/15) → Model Training
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:15:                            (Stratified K-Fold)      & Metrics             (Train/Test Gap)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:29:**Output**: Train/test CSV files with 37 engineered features (++270% vs baseline)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:45:### 2. Model Training (`scripts/train_model.py`)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:46:**Purpose**: Train RandomForestClassifier with comprehensive metrics
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:47:**Output**: Pickled model, ONNX export, metrics JSON
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:54:  "train_accuracy": 0.0-1.0,
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:55:  "train_precision": 0.0-1.0,
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:56:  "train_recall": 0.0-1.0,
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:57:  "train_f1": 0.0-1.0,
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:65:  "num_train_samples": N,
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:98:4. **Training Data Quality**: Alert if <50 samples
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:110:# Execute all steps: data → train → validate → monitor
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:119:# 2. Train model with metrics
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:120:python scripts/train_model.py
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:138:- [ ] ≥ 50 training samples
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:144:- [ ] 20-50 training samples
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:150:- [ ] < 20 training samples
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:154:**Rationale**: With minimal training data (1-10 samples), any model appears perfect. Overfitting is detected by comparing train vs test performance.
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:158:overfitting_score = train_accuracy - test_accuracy
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:163:- **0.05-0.15**: Good generalization - minor optimization to training data
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:164:- **0.15-0.30**: Model overfitted - learned training set specifics
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:168:- Perfect training accuracy (100%) is expected with 1-2 samples
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:174:**Method**: Stratified K-Fold (k = min(5, len(X_train)))
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:219:### 1. Daily Retraining (learning.service.ts)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:222:async retrainModel() {
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:225:  // 3. Run scripts/train_model.py          → train & validate
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:226:  // 4. Model Registry auto-registers v1,v2,v3 with comparison
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:268:- Train/Validation/Test split enforced (70/15/15)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:287:8. **Data Drift**: If input distribution changes, retrain recommended
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:288:9. **Model Age**: If >30 days without retraining, schedule retrain
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:323:- P95 prediction latency (ONNX + rules should be <10ms)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:330:**Minimum Dataset Size**:
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:331:- 50 samples: ML model training begins
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:352:4. Periodically retrain with new data (daily at midnight)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:357:- P95 prediction latency (ONNX inference should be <5ms)
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:367:- Collect more diverse training data
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:372:**Cause**: Model learned training data too specifically
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:376:- Increase training data
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:392:- Retrain with recent data
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:411:| ONNX Inference Time | <5ms | <50ms |
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:425:- <0.65: ML may need retraining or feature engineering
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:442:├── decision_model.onnx         # ONNX export for Node.js
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:449:├── X_train.csv                 # Training features
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:451:├── y_train.csv                 # Training labels
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:5:### 1. Daily Retraining Integration
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:7:The `LearningService` automatically triggers retraining at midnight:
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:13:async retrainModel() {
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:20:    // Training with validation
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:21:    await execAsync('python scripts/train_model.py');
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:42:        message: 'Daily retraining failed validation',
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:49:      message: 'Model retraining failed',
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:73:      lastRetrain: this.learningService.getLastRetrainTime(),
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:88:        train: metrics.num_train_samples,
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:117:        message: 'Accuracy degraded >10% - consider retraining',
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:148:        message: 'Model >30 days old - schedule retraining',
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:177:    - cron: '0 1 * * *'  # Daily after training
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:213:          aws s3 cp models/decision_model.onnx \
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:214:            s3://metabrain-models/staging/decision_model.onnx
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:219:            --s3-key staging/decision_model.onnx
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:226:          text: 'ML validation failed during daily retrain'
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:299:from prometheus_client import CollectorRegistry, Gauge, write_to_textfile
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:303:    registry = CollectorRegistry()
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:313:        ['set'],  # train or test
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:314:        registry=registry
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:319:        'Train vs test accuracy difference',
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:320:        registry=registry
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:326:        registry=registry
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:332:        registry=registry
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:336:    accuracy.labels(set='train').set(metrics['train_accuracy'])
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:343:    write_to_textfile('metrics/ml_validation.prom', registry)
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:353:After each training, analyze which features matter most:
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:402:# Load training data
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:403:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:404:y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:424:grid_search.fit(X_train, y_train)
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:446:- [ ] **Training**
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:447:  - [ ] No errors during training
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:449:  - [ ] ONNX export successful
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:480:aws s3 cp s3://metabrain-models/archive/decision_model_v1.onnx ./
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:486:  --s3-key archive/decision_model_v1.onnx
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:492:### Manual Retraining
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:493:If automatic retraining fails:
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:501:# 2. Train with validation
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:502:python scripts/train_model.py
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:512:  aws s3 cp models/decision_model.onnx \
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:513:    s3://metabrain-models/current/decision_model.onnx
MB-Whatsapp\risk\README.md:6:- Modelos sklearn/ONNX existentes.
MB-Whatsapp\risk\README.md:9:Fase 2 no modifica thresholds, modelos ni training.
MB-Chat\docs\ML_RULES_COMBINED_SCORING.md:27:Storage + Daily Retrain
MB-Chat\docs\ML_RULES_COMBINED_SCORING.md:80:- ONNX model prediction (NOT hardcoded 1.0)
MB-Chat\docs\ML_RULES_COMBINED_SCORING.md:276:- **ML: 40%** - Trained on actual outcomes, captures temporal patterns
MB-Chat\docs\ML_RULES_COMBINED_SCORING.md:385:- [ML Model Registry](./ML_MODEL_REGISTRY.md) - Version control for models
MB-Chat\docs\ML_RULES_COMBINED_SCORING.md:386:- [ML Validation Production](./ML_VALIDATION_PRODUCTION.md) - Training and validation
MB-Whatsapp\scripts\extract_real_dataset.py:107:        description='Split data into production and synthetic datasets using incident provenance heuristics.'
MB-Whatsapp\scripts\extract_real_dataset.py:110:    parser.add_argument('--production-dir', default='data/production_dataset', help='Output directory for production dataset')
MB-Whatsapp\scripts\extract_real_dataset.py:111:    parser.add_argument('--synthetic-dir', default='data/synthetic_dataset', help='Output directory for synthetic dataset')
MB-Whatsapp\scripts\extract_real_dataset.py:135:    with (source_dir / 'dataset_split_summary.json').open('w', encoding='utf-8') as f:
MB-Whatsapp\scripts\extract_real_dataset.py:138:    print('Dataset split completed')
MB-Whatsapp\scripts\extract_real_dataset.py:141:    print(f"  Summary: {(source_dir / 'dataset_split_summary.json').resolve()}")
MB-Chat\docs\ML_MODEL_REGISTRY.md:1:# MetaBrain Model Registry & Version Control
MB-Chat\docs\ML_MODEL_REGISTRY.md:5:MetaBrain implements a comprehensive model registry system to track model evolution, manage versions, enable safe comparisons, and support automatic rollback when issues arise.
MB-Chat\docs\ML_MODEL_REGISTRY.md:10:Training Pipeline
MB-Chat\docs\ML_MODEL_REGISTRY.md:12:train_model.py (with integrated registry)
MB-Chat\docs\ML_MODEL_REGISTRY.md:43:### 1. Model Registry (`scripts/model_registry.py`)
MB-Chat\docs\ML_MODEL_REGISTRY.md:45:**Purpose**: Central registry for all model versions
MB-Chat\docs\ML_MODEL_REGISTRY.md:49:registry = ModelRegistry('models/registry.json')
MB-Chat\docs\ML_MODEL_REGISTRY.md:51:# Register new model after training
MB-Chat\docs\ML_MODEL_REGISTRY.md:52:version = registry.register_model(
MB-Chat\docs\ML_MODEL_REGISTRY.md:54:    notes="Training with 500 samples"
MB-Chat\docs\ML_MODEL_REGISTRY.md:59:registry.promote_to_production('v2')
MB-Chat\docs\ML_MODEL_REGISTRY.md:62:prod = registry.get_production_version()
MB-Chat\docs\ML_MODEL_REGISTRY.md:63:staging = registry.get_staging_version()
MB-Chat\docs\ML_MODEL_REGISTRY.md:65:# Load model from registry
MB-Chat\docs\ML_MODEL_REGISTRY.md:66:model = registry.load_model('v2', format='pkl')
MB-Chat\docs\ML_MODEL_REGISTRY.md:69:registry.print_history()
MB-Chat\docs\ML_MODEL_REGISTRY.md:72:**Registry Structure** (`models/registry.json`):
MB-Chat\docs\ML_MODEL_REGISTRY.md:79:      "train_accuracy": 0.90,
MB-Chat\docs\ML_MODEL_REGISTRY.md:81:      "train_f1": 0.89,
MB-Chat\docs\ML_MODEL_REGISTRY.md:86:      "num_train_samples": 400,
MB-Chat\docs\ML_MODEL_REGISTRY.md:90:      "notes": "Initial training"
MB-Chat\docs\ML_MODEL_REGISTRY.md:95:      "train_accuracy": 0.95,
MB-Chat\docs\ML_MODEL_REGISTRY.md:104:      "train_accuracy": 0.96,
MB-Chat\docs\ML_MODEL_REGISTRY.md:118:      "notes": "Initial training"
MB-Chat\docs\ML_MODEL_REGISTRY.md:135:│   ├── decision_model.onnx
MB-Chat\docs\ML_MODEL_REGISTRY.md:140:│   ├── decision_model.onnx
MB-Chat\docs\ML_MODEL_REGISTRY.md:145:│   ├── decision_model.onnx
MB-Chat\docs\ML_MODEL_REGISTRY.md:148:├── registry.json          # Central registry
MB-Chat\docs\ML_MODEL_REGISTRY.md:158:comparator = ModelComparison('models/registry.json')
MB-Chat\docs\ML_MODEL_REGISTRY.md:202:   - ✓ PASS: ≥ production training samples
MB-Chat\docs\ML_MODEL_REGISTRY.md:203:   - ✗ FAIL: Fewer training samples
MB-Chat\docs\ML_MODEL_REGISTRY.md:227:rollback_mgr = ModelRollback('models/registry.json')
MB-Chat\docs\ML_MODEL_REGISTRY.md:254:3. Update registry status
MB-Chat\docs\ML_MODEL_REGISTRY.md:265:# 1. Train model - automatically registers and compares
MB-Chat\docs\ML_MODEL_REGISTRY.md:266:python scripts/train_model.py
MB-Chat\docs\ML_MODEL_REGISTRY.md:283:# data                 ✓ PASS        More training samples
MB-Chat\docs\ML_MODEL_REGISTRY.md:290:python scripts/model_registry.py
MB-Chat\docs\ML_MODEL_REGISTRY.md:298:from model_registry import ModelRegistry
MB-Chat\docs\ML_MODEL_REGISTRY.md:299:registry = ModelRegistry()
MB-Chat\docs\ML_MODEL_REGISTRY.md:300:registry.promote_to_production('v3')
MB-Chat\docs\ML_MODEL_REGISTRY.md:322:│ Training │
MB-Chat\docs\ML_MODEL_REGISTRY.md:371:               │   - Update registry
MB-Chat\docs\ML_MODEL_REGISTRY.md:402:## Integration with Training Pipeline
MB-Chat\docs\ML_MODEL_REGISTRY.md:404:**train_model.py** now automatically:
MB-Chat\docs\ML_MODEL_REGISTRY.md:406:1. Trains model
MB-Chat\docs\ML_MODEL_REGISTRY.md:408:3. **Registers with model_registry.py**
MB-Chat\docs\ML_MODEL_REGISTRY.md:410:   registry = ModelRegistry()
MB-Chat\docs\ML_MODEL_REGISTRY.md:411:   version = registry.register_model(metrics, notes="...")
MB-Chat\docs\ML_MODEL_REGISTRY.md:442:| `train_accuracy` | Accuracy on training set |
MB-Chat\docs\ML_MODEL_REGISTRY.md:444:| `train_f1` | F1-score on training set |
MB-Chat\docs\ML_MODEL_REGISTRY.md:446:| `overfitting_score` | Train - Test accuracy gap |
MB-Chat\docs\ML_MODEL_REGISTRY.md:449:| `num_train_samples` | Training data size |
MB-Chat\docs\ML_MODEL_REGISTRY.md:453:| `notes` | Custom notes (why trained, what changed, etc) |
MB-Chat\docs\ML_MODEL_REGISTRY.md:474:   - ✓ ONNX export successful
MB-Chat\docs\ML_MODEL_REGISTRY.md:486:# 1. TRAINING & REGISTRATION
MB-Chat\docs\ML_MODEL_REGISTRY.md:487:python scripts/train_model.py
MB-Chat\docs\ML_MODEL_REGISTRY.md:488:# Trains, validates, registers, compares, recommends
MB-Chat\docs\ML_MODEL_REGISTRY.md:490:# 2. REGISTRY MANAGEMENT
MB-Chat\docs\ML_MODEL_REGISTRY.md:491:python -c "from model_registry import ModelRegistry; \
MB-Chat\docs\ML_MODEL_REGISTRY.md:492:  r = ModelRegistry(); r.print_history(); r.print_summary()"
MB-Chat\docs\ML_MODEL_REGISTRY.md:499:python -c "from model_registry import ModelRegistry; \
MB-Chat\docs\ML_MODEL_REGISTRY.md:500:  r = ModelRegistry(); r.promote_to_production('v3')"
MB-Chat\docs\ML_MODEL_REGISTRY.md:520:Day 1 - Initial Training
MB-Chat\docs\ML_MODEL_REGISTRY.md:521:$ python scripts/train_model.py
MB-Chat\docs\ML_MODEL_REGISTRY.md:527:$ python scripts/train_model.py
MB-Chat\docs\ML_MODEL_REGISTRY.md:539:$ python scripts/train_model.py
MB-Chat\docs\ML_MODEL_REGISTRY.md:566:├── registry.json                 # Central registry
MB-Chat\docs\ML_MODEL_REGISTRY.md:569:│   ├── decision_model.onnx
MB-Chat\docs\ML_MODEL_REGISTRY.md:574:│   ├── decision_model.onnx
MB-Chat\docs\ML_MODEL_REGISTRY.md:579:│   ├── decision_model.onnx
MB-Chat\docs\ML_MODEL_REGISTRY.md:592:**Issue**: version not found in registry
MB-Chat\docs\ML_MODEL_REGISTRY.md:593:- Check `models/registry.json` exists
MB-Chat\docs\ML_MODEL_REGISTRY.md:595:- Run training to create first version
MB-Chat\docs\ML_MODEL_REGISTRY.md:609:- Collect more training data
MB-Whatsapp\memory\vector-backend.contract.ts:3:export type VectorSearchInput = {
MB-Whatsapp\memory\vector-backend.contract.ts:4:  embedding: number[];
MB-Whatsapp\memory\vector-backend.contract.ts:10:export type VectorSearchResult = {
MB-Whatsapp\memory\vector-backend.contract.ts:13:  backend: "pgvector" | "qdrant" | "local_vector" | "future_provider";
MB-Whatsapp\memory\vector-backend.contract.ts:16:export type FutureVectorBackend = MemoryBackend & {
MB-Whatsapp\memory\vector-backend.contract.ts:17:  upsert_vector(entry: MemoryEntry, embedding: number[]): Promise<void>;
MB-Whatsapp\memory\vector-backend.contract.ts:18:  vector_search(input: VectorSearchInput): Promise<VectorSearchResult[]>;
MB-Whatsapp\memory\vector-backend.contract.ts:21:export const VECTOR_BACKEND_CONTRACT_STATUS = {
MB-Whatsapp\memory\vector-backend.contract.ts:24:  allowedFutureBackends: ["pgvector", "qdrant", "local_vector"],
MB-Whatsapp\memory\vector-backend.contract.ts:25:  note: "Contract only. No vector database dependency or runtime activation is introduced in Phase 3.",
MB-Whatsapp\scripts\generate_synthetic_data.py:97:def generate_synthetic_dataset(total_incidents: int, seed: int, noise_level: float) -> Dict[str, List[dict]]:
MB-Whatsapp\scripts\generate_synthetic_data.py:260:    dataset = generate_synthetic_dataset(total_incidents=args.count, seed=args.seed, noise_level=args.noise)
MB-Whatsapp\scripts\generate_synthetic_data.py:263:    write_json(data_dir / "incidents.json", dataset["incidents"])
MB-Whatsapp\scripts\generate_synthetic_data.py:264:    write_json(data_dir / "outcomes.json", dataset["outcomes"])
MB-Whatsapp\scripts\generate_synthetic_data.py:265:    write_json(data_dir / "audit.json", dataset["audits"])
MB-Whatsapp\scripts\generate_synthetic_data.py:267:    print("Synthetic dataset generated successfully")
MB-Whatsapp\scripts\generate_synthetic_data.py:268:    print(f"  Incidents: {len(dataset['incidents'])}")
MB-Whatsapp\scripts\generate_synthetic_data.py:269:    print(f"  Outcomes:  {len(dataset['outcomes'])}")
MB-Whatsapp\scripts\generate_synthetic_data.py:270:    print(f"  Audits:    {len(dataset['audits'])}")
MB-Whatsapp\scripts\generate_synthetic_data.py:271:    print(f"  Distribution by action: {dataset['class_distribution']}")
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:55:- **Change**: Accepts enriched feature vector, not just hour/day
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:111:- Daily model retraining (daily at midnight)
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:112:- Model Registry versioning for safe evolution
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:123:- Rollback capability via Model Registry
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:158:6. Confirm daily retraining runs
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:159:7. Validate Model Registry auto-registration
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:165:- Total decision time: ~6-7ms (ONNX inference is dominant)
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:207:| Safe rollback | ✅ | Model Registry v1,v2,v3 |
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:234:- [ ] Team trained on new patterns
MB-Chat\docs\COMPLETION_CHECKLIST.md:45:#### 📊 Dataset Enriquecido
MB-Chat\docs\COMPLETION_CHECKLIST.md:48:✅ X_train.csv              (1, 37) - Features entrenamiento
MB-Chat\docs\COMPLETION_CHECKLIST.md:50:✅ X_train_scaled.csv       (1, 37) - Versión normalizada
MB-Chat\docs\COMPLETION_CHECKLIST.md:52:✅ y_train.csv              (1,)    - Labels entrenamiento
MB-Chat\docs\COMPLETION_CHECKLIST.md:56:✅ metadata.json            (meta)  - Info del dataset
MB-Chat\docs\COMPLETION_CHECKLIST.md:137:✅ Train/test split:         Stratified 80/20
MB-Chat\docs\COMPLETION_CHECKLIST.md:201:# Genera: 37 features, dataset limpio, encoders
MB-Chat\docs\COMPLETION_CHECKLIST.md:214:python scripts/train_model.py
MB-Chat\docs\COMPLETION_CHECKLIST.md:242:└─ Potencial gap train/test: 20-30%
MB-Chat\docs\COMPLETION_CHECKLIST.md:324:✅ 0 null values en dataset limpio
MB-Chat\docs\COMPLETION_CHECKLIST.md:328:✅ Dataset ready para training
MB-Chat\docs\COMPLETION_CHECKLIST.md:348:  └─ Split train/test
MB-Chat\docs\COMPLETION_CHECKLIST.md:350:Clean Dataset (37 features)
MB-Chat\docs\COMPLETION_CHECKLIST.md:351:  ├─ X_train.csv ✅
MB-Chat\docs\COMPLETION_CHECKLIST.md:353:  ├─ y_train.csv ✅
MB-Chat\docs\COMPLETION_CHECKLIST.md:358:    ↓ [train_model.py] READY
MB-Chat\docs\COMPLETION_CHECKLIST.md:359:  Model Training
MB-Chat\docs\COMPLETION_CHECKLIST.md:371:- [x] ✅ Generar dataset enriquecido
MB-Chat\docs\COMPLETION_CHECKLIST.md:372:- [ ] → Ejecutar: `python scripts/train_model.py`
MB-Chat\docs\COMPLETION_CHECKLIST.md:386:- [ ] Daily retraining
MB-Chat\docs\COMPLETION_CHECKLIST.md:407:║   NEXT PHASE: Model Training                                  ║
MB-Chat\docs\COMPLETION_CHECKLIST.md:408:║   RUN: python scripts/train_model.py                          ║
MB-Chat\docs\COMPLETION_CHECKLIST.md:419:**Fase siguiente:** Model Training & Validation
MB-Chat\docs\COMPLETION_CHECKLIST.md:426:- Dataset: `data/processed/X_train.csv` (37 features)
MB-Chat\docs\COMPLETION_CHECKLIST.md:434:# Entrenar: python scripts/train_model.py
MB-Whatsapp\scripts\feature_selection.py:21:    For use when we have insufficient training data for actual RF importance
MB-Whatsapp\scripts\feature_selection.py:124:def train_importance_model(X_train, y_train, feature_names):
MB-Whatsapp\scripts\feature_selection.py:125:    """Train RandomForest to get feature importance"""
MB-Whatsapp\scripts\feature_selection.py:128:    if len(np.unique(y_train)) < 2:
MB-Whatsapp\scripts\feature_selection.py:129:        print("⚠ Only 1 class in training data - using theoretical feature importance\n")
MB-Whatsapp\scripts\feature_selection.py:133:    if len(X_train) < 10:
MB-Whatsapp\scripts\feature_selection.py:134:        print("⚠ Limited training data (<10 samples) - using theoretical feature importance\n")
MB-Whatsapp\scripts\feature_selection.py:138:    print("Training RandomForest for feature importance...")
MB-Whatsapp\scripts\feature_selection.py:141:    model.fit(X_train, y_train)
MB-Whatsapp\scripts\feature_selection.py:148:    print("✓ Model trained\n")
MB-Whatsapp\scripts\feature_selection.py:261:    print("\nLoading datasets...")
MB-Whatsapp\scripts\feature_selection.py:262:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\scripts\feature_selection.py:264:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Whatsapp\scripts\feature_selection.py:270:    print(f"✓ Loaded {X_train.shape[0]} train, {X_test.shape[0]} test samples")
MB-Whatsapp\scripts\feature_selection.py:278:    model, importance_scores = train_importance_model(X_train, y_train, feature_names)
MB-Whatsapp\scripts\feature_selection.py:302:    corr_matrix, high_corr_pairs = analyze_feature_correlation(X_train)
MB-Whatsapp\scripts\feature_selection.py:337:    print(f"\nRecommendations for dataset optimization:")
MB-Whatsapp\scripts\feature_selection.py:345:    print("STEP 6: Creating Optimized Datasets")
MB-Whatsapp\scripts\feature_selection.py:352:    X_train_opt = X_train.iloc[:, indices_optimized]
MB-Whatsapp\scripts\feature_selection.py:355:    X_train_opt.to_csv('data/processed/X_train_optimized.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:357:    y_train.to_csv('data/processed/y_train_optimized.csv', index=False) if hasattr(y_train, 'to_csv') else pd.Series(y_train).to_csv('data/processed/y_train_optimized.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:366:    print(f"  Size: {X_train_opt.shape}")
MB-Whatsapp\scripts\feature_selection.py:372:    X_train_top80 = X_train.iloc[:, indices_top80]
MB-Whatsapp\scripts\feature_selection.py:375:    X_train_top80.to_csv('data/processed/X_train_top80_importance.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:384:    print(f"  Size: {X_train_top80.shape}")
MB-Whatsapp\scripts\feature_selection.py:419:  Space savings:               {X_train.shape[1]} → {len(features_to_keep)} dimensions
MB-Whatsapp\scripts\feature_selection.py:429:📁 GENERATED DATASETS:
MB-Whatsapp\scripts\feature_selection.py:430:  • X_train_optimized.csv         ({len(features_to_keep)} features)
MB-Whatsapp\scripts\feature_selection.py:431:  • X_train_top80_importance.csv  ({features_for_80} features)
MB-Whatsapp\scripts\feature_selection.py:436:✓ Ready to train models with optimized feature sets!
MB-Chat\docs\ML_FEATURES.md:92:18-Feature Vector → ML Model
MB-Chat\docs\ML_FEATURES.md:166:### Nota sobre Dataset Pequeño
MB-Chat\docs\ML_FEATURES.md:168:Con dataset muy pequeño (1-2 muestras por clase):
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:28:└── Cron: retrainModel() cada medianoche
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:68:#### `retrainModel() @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:71:// Shell: python scripts/data_pipeline.py && python scripts/train_model.py
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:72:// Retrains ONNX model on historical outcomes
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:358:  - command in SAFE_COMMANDS registry
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:616:| `retrainModel()` | `@Cron() → Promise` | Entrena ONNX diariamente |
MB-Chat\docs\ARCHITECTURE_ML_ANALYSIS.md:662:- [src/ml/predictor.ts](../src/ml/predictor.ts) - Inferencia ONNX
MB-Whatsapp\scripts\demo_model_registry.py:3:Model Registry Demonstration
MB-Whatsapp\scripts\demo_model_registry.py:14:from model_registry import ModelRegistry
MB-Whatsapp\scripts\demo_model_registry.py:19:    """Run demonstration of model registry features"""
MB-Whatsapp\scripts\demo_model_registry.py:22:    print("MetaBrain Model Registry Demonstration")
MB-Whatsapp\scripts\demo_model_registry.py:27:    registry = ModelRegistry('models/registry.json')
MB-Whatsapp\scripts\demo_model_registry.py:28:    comparator = ModelComparison('models/registry.json')
MB-Whatsapp\scripts\demo_model_registry.py:29:    rollback_mgr = ModelRollback('models/registry.json')
MB-Whatsapp\scripts\demo_model_registry.py:31:    # Scenario: Three training runs with improving then degrading performance
MB-Whatsapp\scripts\demo_model_registry.py:35:            'notes': 'Initial training - 400 samples',
MB-Whatsapp\scripts\demo_model_registry.py:37:                'train_accuracy': 0.90,
MB-Whatsapp\scripts\demo_model_registry.py:39:                'train_f1': 0.89,
MB-Whatsapp\scripts\demo_model_registry.py:44:                'num_train_samples': 400,
MB-Whatsapp\scripts\demo_model_registry.py:53:                'train_accuracy': 0.95,
MB-Whatsapp\scripts\demo_model_registry.py:55:                'train_f1': 0.94,
MB-Whatsapp\scripts\demo_model_registry.py:60:                'num_train_samples': 500,
MB-Whatsapp\scripts\demo_model_registry.py:69:                'train_accuracy': 0.87,
MB-Whatsapp\scripts\demo_model_registry.py:71:                'train_f1': 0.86,
MB-Whatsapp\scripts\demo_model_registry.py:76:                'num_train_samples': 500,
MB-Whatsapp\scripts\demo_model_registry.py:84:    print("SIMULATING 3 TRAINING RUNS")
MB-Whatsapp\scripts\demo_model_registry.py:88:        print(f"\n>>> PHASE {i}: Training {scenario['version']}")
MB-Whatsapp\scripts\demo_model_registry.py:91:        # Register model (would come from train_model.py in production)
MB-Whatsapp\scripts\demo_model_registry.py:94:        # For simulation: manually add to registry (skip file copying)
MB-Whatsapp\scripts\demo_model_registry.py:98:            'train_accuracy': scenario['metrics']['train_accuracy'],
MB-Whatsapp\scripts\demo_model_registry.py:100:            'train_f1': scenario['metrics']['train_f1'],
MB-Whatsapp\scripts\demo_model_registry.py:105:            'num_train_samples': scenario['metrics']['num_train_samples'],
MB-Whatsapp\scripts\demo_model_registry.py:112:        registry.registry['versions'].append(version_record)
MB-Whatsapp\scripts\demo_model_registry.py:113:        registry.registry['staging'] = version
MB-Whatsapp\scripts\demo_model_registry.py:114:        registry.registry['history'].append({
MB-Whatsapp\scripts\demo_model_registry.py:120:        registry._save_registry()
MB-Whatsapp\scripts\demo_model_registry.py:130:            registry.promote_to_production(version)
MB-Whatsapp\scripts\demo_model_registry.py:139:                registry.promote_to_production(version)
MB-Whatsapp\scripts\demo_model_registry.py:144:                registry.reject_version(version, "Failed recommendation")
MB-Whatsapp\scripts\demo_model_registry.py:149:    print("FINAL STATE AFTER 3 TRAINING CYCLES")
MB-Whatsapp\scripts\demo_model_registry.py:152:    registry.print_summary()
MB-Whatsapp\scripts\demo_model_registry.py:153:    registry.print_history()
MB-Whatsapp\scripts\demo_model_registry.py:179:        rollback_mgr.registry = registry.registry  # Sync state
MB-Whatsapp\scripts\demo_model_registry.py:180:        rollback_mgr.registry['current_production'] = 'v2'  # Set v2 as current
MB-Whatsapp\scripts\demo_model_registry.py:181:        rollback_mgr._save_registry()
MB-Chat\CLINICAL_AI_HARDENING_FINAL_REPORT.md:34:- Logging constrained to approved fields only:
MB-Chat\docs\ML_DECISION_SUMMARY.md:27:(Opcionalmente) Cron daily a medianoche → retrainModel() Python scripts
MB-Chat\docs\ML_DECISION_SUMMARY.md:37:| `retrainModel()` | N/A (Cron) | Promise | Evento automático cada medianoche |
MB-Chat\docs\ML_DECISION_SUMMARY.md:344:retrainModel() @Cron(EVERY_DAY_AT_MIDNIGHT)
MB-Chat\docs\ML_DECISION_SUMMARY.md:385:2. ✅ **ML**: Infraestructura lista (ONNX + predictor)
MB-Whatsapp\memory\types.ts:102:  vectorEnabled: boolean;
MB-Whatsapp\memory\types.ts:133:  retrieval_mode: "disabled" | "lexical_jsonl" | "future_vector";
MB-Chat\models\v7\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v7\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v7\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v7\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v7\metrics.json:31:  "num_train_samples": 168,
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:188:# Ensure scripts/train_model.py has been run once
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:189:python scripts/train_model.py
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:190:# Creates models/decision_model.pkl and decision_model.onnx
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:193:**2. Setup Daily Retraining** (already in LearningService):
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:196:# The retraining happens automatically via:
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:198:async retrainModel() { ... }
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:252:- **Impact**: +1ms (negligible, within ONNX inference margin)
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:261:- Monitor via daily training + Model Registry
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:297:- [ ] Daily retraining executes at midnight
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:298:- [ ] Model Registry auto-registers versions
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:330:- [ML Validation Production](./ML_VALIDATION_PRODUCTION.md) - Training & validation
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:331:- [ML Model Registry](./ML_MODEL_REGISTRY.md) - Version control
MB-Chat\docs\FILE_MANIFEST.md:14:3. **[QUICKSTART_FEATURE_SELECTION.md](QUICKSTART_FEATURE_SELECTION.md)** - How to use datasets
MB-Chat\docs\FILE_MANIFEST.md:19:- **[ML_VALIDATION_PRODUCTION.md](ML_VALIDATION_PRODUCTION.md)** - Complete training pipeline
MB-Chat\docs\FILE_MANIFEST.md:46:│   ├─ train_importance_model()
MB-Chat\docs\FILE_MANIFEST.md:71:### 2. PROCESSED DATASETS
MB-Chat\docs\FILE_MANIFEST.md:76:├── X_train_optimized.csv              (1 row × 37 features)
MB-Chat\docs\FILE_MANIFEST.md:82:├── y_train_optimized.csv              (1 row × 1 label)
MB-Chat\docs\FILE_MANIFEST.md:83:│   └─ Training labels
MB-Chat\docs\FILE_MANIFEST.md:95:├── X_train_top80_importance.csv       (1 row × 31 features)
MB-Chat\docs\FILE_MANIFEST.md:111:├── model-registry.json                 (Model versions)
MB-Chat\docs\FILE_MANIFEST.md:115:    ├── X_train.csv ~ X_test.csv       (Original 37-feature sets)
MB-Chat\docs\FILE_MANIFEST.md:116:    ├── y_train.csv ~ y_test.csv       (Original labels)
MB-Chat\docs\FILE_MANIFEST.md:337:2. Load data from data/processed/X_train_optimized.csv
MB-Chat\docs\FILE_MANIFEST.md:339:4. For top-80 set, load X_train_top80_importance.csv instead
MB-Chat\docs\FILE_MANIFEST.md:344:1. Check PHASE_3_ACTION_PLAN.md for training instructions
MB-Chat\docs\FILE_MANIFEST.md:345:2. Use scripts/train_model.py with --features flag
MB-Chat\docs\FILE_MANIFEST.md:383:  Training datasets:             ✅ Ready
MB-Chat\docs\FILE_MANIFEST.md:384:  Test datasets:                 ✅ Ready
MB-Chat\docs\FILE_MANIFEST.md:407:│       ├── X_train_optimized.csv (37 feat)
MB-Chat\docs\FILE_MANIFEST.md:408:│       ├── X_train_top80_importance.csv (31 feat)
MB-Chat\docs\FILE_MANIFEST.md:410:│       ├── y_train*.csv & y_test*.csv
MB-Chat\docs\FILE_MANIFEST.md:419:│   ├── classifier_*.pkl (when trained)
MB-Chat\docs\FILE_MANIFEST.md:420:│   └── registry.json
MB-Chat\docs\FILE_MANIFEST.md:443:Datasets:
MB-Chat\docs\FILE_MANIFEST.md:444:  X_train_optimized.csv         ~8 KB (1 sample)
MB-Chat\docs\FILE_MANIFEST.md:454:(Expandable to GBs with full incident dataset)
MB-Chat\docs\FILE_MANIFEST.md:499:- [ ] Model training initiated
MB-Chat\docs\FILE_MANIFEST.md:509:2. **Execute:** Follow the training plan (this week)
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:5:**Dataset:** 37 Features (Enriched from Phase 1)
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:11:The feature selection pipeline analyzed the 37-feature dataset to identify which features drive model predictions and eliminate redundancy. With theoretical importance scoring (demo data has single action class), we identified:
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:104:- **80/20 Rule**: Just 31 features (84% of dataset) capture 80% of predictive power
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:196:Keeping all features maintains information diversity. Feature pruning would only reduce interpretability without computational benefit (with current small dataset size).
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:203:**Use case:** Training with maximum information, production deployment with computational margin
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:253:- **Use:** Edge deployment, real-time constraints
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:266:### Phase 2B: Retraining (Next)
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:267:- [ ] Train model with all 37 features
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:268:- [ ] Train model with 31-feature set
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:269:- [ ] Train model with 18-feature set
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:274:- [ ] Based on retraining results, select optimal feature set
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:285:## GENERATED ARTIFACTS
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:293:### Optimized Datasets
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:294:✅ **data/processed/X_train_optimized.csv**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:298:- Ready for training
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:300:✅ **data/processed/X_train_top80_importance.csv**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:304:- For efficiency-focused training
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:328:Since the demo dataset contains only a single action class, we applied **theoretical feature importance** based on:
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:343:1. Re-run `feature_selection.py` with real training data
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:353:1. ✅ Use full 37-feature set for training
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:361:4. Retrain models with optimized feature sets
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:381:**Conclusion:** The feature expansion from Phase 1 succeeded in creating a diverse, non-redundant feature set that captures multiple dimensions of incident behavior. Ready for production model training.
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:387:1. **Retrain Models** → Use feature_selection.py outputs for next training run
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:392:See: [ML_VALIDATION_PRODUCTION.md](ML_VALIDATION_PRODUCTION.md) for full training pipeline.
MB-Whatsapp\memory\README.md:10:- Vector backend: contract only
MB-Whatsapp\memory\README.md:20:- Prepare future pgvector or Qdrant integration without adding dependencies.
MB-Whatsapp\memory\README.md:28:- `SEMANTIC_MEMORY_VECTOR_ENABLED=false`
MB-Whatsapp\memory\README.md:35:- No external embedding provider is called.
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:11:Expandir significativamente el dataset de ML eliminando dependencia de variables temporales simples y capturando **contexto real** y **comportamiento histórico** para mejorar generalización y reducir overfitting.
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:17:### 1. 📊 Dataset Enriquecido: 37 Features
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:73:✓ X_train.csv: (1, 37) - 50% train
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:94:- Ejemplos de feature vectors
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:115:- Resultado: 0 valores nulos en dataset final
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:125:- Train/test 80/20 con stratification
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:159:    └── Train/test split (80/20)
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:161:  37-feature CSV dataset
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:162:  ├── X_train.csv, X_test.csv
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:163:  ├── y_train.csv, y_test.csv
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:168:    train_model.py
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:169:    └── RandomForest + ONNX export
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:177:- **Antes:** Gap train/test potencialmente >30% (10 simple features)
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:208:  ✅ X_train.csv, X_test.csv
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:209:  ✅ X_train_scaled.csv, X_test_scaled.csv
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:210:  ✅ y_train.csv, y_test.csv
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:236:1. ✅ Generar dataset enriquecido
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:243:   python scripts/train_model.py
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:296:- ✓ Train/test split estratificado
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:323:✅ Dataset train/test ready
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:3:**Project:** MetaBrain ML Dataset Enrichment
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:12:Expand ML dataset from **10 basic features** → **37 advanced features**
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:28:   ├─ Train/Test split:   ✓ 80/20 stratified
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:106:## 📂 Dataset Structure
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:111:├── X_train.csv                    (1×37): Training features
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:113:├── X_train_scaled.csv            (1×37): Scaled for SVM/NN
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:115:├── y_train.csv                    (1×1):  Labels
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:119:└── metadata.json                  (meta): Dataset info
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:152:   Train/Test Datasets (80/20)
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:153:   ├── X_train: (N, 37)
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:154:   ├── y_train: (N,)
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:158:   [train_model.py] → decision_model.pkl, .onnx
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:181:├── Example vectors
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:212:     └─ Gap (train/test): Potential >20-30%
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:229:     └─ Gap (train/test): Expected <10-15%
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:237:### Targets (Post-Training)
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:278:- [x] Train/test split: Stratified 80/20
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:292:### Week 1: Training & Validation
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:294:# 1. Train model with new features
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:295:python scripts/train_model.py
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:335:# Daily retraining
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:351:### Dataset Metrics
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:355:Train/Test Split:           80/20 (stratified)
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:369:Feature Correlation:        To be analyzed post-training
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:370:Feature Importance:         Ranked post-training
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:407:✅ 0 null values in cleaned dataset
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:411:✅ dataset ready for training
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:417:STATUS: 🎉 READY FOR MODEL TRAINING
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:428:# Train:    python scripts/train_model.py
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:444:✅ data/processed/* (dataset)
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:473:║   ✓ Dataset ready for training                           ║
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:476:║   NEXT: python scripts/train_model.py                    ║
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:485:**Next Phase:** Model Training & Validation
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:1:# Feature Engineering: Dataset Enriquecido
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:5:Se ha expandido significativamente el dataset de entrenamiento pasando de **10 features simples** a **37 features avanzadas**, eliminando la dependencia de variables temporales básicas y capturando contexto real, comportamiento histórico y señales de comportamiento.
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:112:## Ejemplo: Feature Vector Enriquecido
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:188:   - ✓ Preservación de distribución en train/test
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:196:   - ✓ Train/Test split 80/20 con stratify por acción
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:199:### 📊 Estadísticas del Dataset
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:207:| Train set | 1 (50%) |
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:220:├── X_train.csv                    # 37 features de entrenamiento
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:222:├── X_train_scaled.csv             # Versión normalizada (para SVM/NN)
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:224:├── y_train.csv                    # Labels de acción (train)
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:245:- Gap train/test → potencialmente >30%
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:265:## Uso del Dataset Enriquecido
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:267:### Training
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:275:# 5. Guarda datasets en data/processed/
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:280:### ML Training
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:286:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:287:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:291:model.fit(X_train, y_train.values.ravel())
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:294:X_train_scaled = pd.read_csv('data/processed/X_train_scaled.csv')
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:296:model_nn.fit(X_train_scaled, y_train.values.ravel())
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:355:   python scripts/train_model.py
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:376:- [Model Training](../scripts/train_model.py)
MB-Chat\services\inference_service\README.md:9:  - resolucion de version activa en registry,
MB-Chat\models\v6\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v6\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v6\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v6\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v6\metrics.json:31:  "num_train_samples": 1,
MB-Chat\core\layer-registry.ts:23:export const PHASE_2_LAYER_REGISTRY: LayerRegistration[] = [
MB-Chat\docs\CONTEXT_EXAMPLE.py:49:# Feature Vector [18 features]
MB-Chat\docs\CONTEXT_EXAMPLE.py:64:# STEP 3: ML PREDICTION (Node.js / ONNX Runtime)
MB-Chat\data\model-registry.json:5:      "path": "models/incident-classifier-v1.0.0.onnx",
MB-Chat\data\model-registry.json:13:        "framework": "onnx"
MB-Chat\data\model-registry.json:18:      "path": "models/incident-classifier-v1.1.0.onnx",
MB-Chat\data\model-registry.json:26:        "framework": "onnx"
MB-Whatsapp\memory\jsonl-memory-adapter.ts:174:        embedding_slot: record.embedding_slot,
MB-Chat\docs\CONTEXT_ENRICHMENT.md:5:### 📊 Dataset Enrichment
MB-Chat\docs\CONTEXT_ENRICHMENT.md:70:[18-Feature Vector] → RFC Model
MB-Chat\docs\CONTEXT_ENRICHMENT.md:149:✅ scripts/train_model.py
MB-Chat\docs\CONTEXT_ENRICHMENT.md:186:✅ Dataset generado: `data/processed/X_train.csv` (18 cols)
MB-Chat\docs\CONTEXT_ENRICHMENT.md:187:✅ Modelo entrenado: `models/decision_model.onnx` (18 inputs)
MB-Whatsapp\memory\index.ts:8:export * from "./vector-backend.contract";
MB-Whatsapp\memory\index.ts:15:  vectorBackend: "contract_only",
MB-Chat\models\feature_importance_summary.txt:24:Generated Datasets:
MB-Chat\models\feature_importance_summary.txt:25:  ✓ X_train_optimized.csv (37 features)
MB-Chat\models\feature_importance_summary.txt:26:  ✓ X_train_top80_importance.csv (31 features)
MB-Chat\data\medical-chat-learning.jsonl:22:{"id":"doctor-chat-1778987314149","recordedAt":"2026-05-17T03:08:34.149Z","source":"doctor_chat_frontend","doctorId":"lab-doctor","conversationId":"doctor:lab-doctor:patient:general:appointment:none:chat:3dc78180-0766-48d8-961c-a55abf2f8585","patientId":null,"appointmentId":null,"userMessage":"📊 Resolución Analítica y Matemática del CasoPaso 1: Análisis del Equilibrio Ácido-Base (El Trastorno Mixto)El estado de la paciente revela un trastorno ácido-base mixto clásico por salicilatos: una alcalosis respiratoria primaria combinada con una acidosis metabólica con brecha aniónica (anion gap) elevada. El pH final es de \\(7.41\\) debido a que ambos trastornos se contraponen vectorialmente.Fisiopatología de la alcalosis respiratoria: Los salicilatos estimulan de forma directa el centro respiratorio en el bulbo raquídeo. Esto genera hiperventilación (taquipnea profunda de Kussmaul, FR: \\(32\\text{ rpm}\\)), barriendo masivamente el dióxido de carbono y bajando la \\(\\text{PaCO}_{2}\\) a \\(20\\text{ mmHg}\\).Fisiopatología de la acidosis metabólica: El salicilato desacopla la fosforilación oxidativa en las mitocondrias. Esto obliga al cuerpo a depender de la glucólisis anaeróbica, acumulando ácido láctico y cuerpos cetónicos, lo que consume el bicarbonato pulmonar y lo desciende a \\(12\\text{ mEq/L}\\).Paso 2: Cálculo Químico de Permeabilidad (Henderson-Hasselbalch)Aplicamos la ecuación para determinar la fracción de fármaco ionizado (\\(\\text{A}^{-}\\)) frente al no ionizado (\\(\\text{HA}\\)):\\(\\text{pH}=\\text{pK}_{a}+\\log \\left(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}\\right)\\)\\(7.41=3.5+\\log \\left(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}\\right)\\implies 3.91=\\log \\left(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}\\right)\\)\\(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}=10^{3.91}\\approx 8128\\)Interpretación clínica: A un \\(\\text{pH}\\) plasmático de \\(7.41\\), por cada molécula de ácido acetilsalicílico no ionizada (\\(\\text{HA}\\)), hay aproximadamente \\(8,128\\) moléculas ionizadas (\\(\\text{A}^{-}\\)).Mecanismo de neuroprotección: Solo la forma no ionizada (\\(\\text{HA}\\)) es liposoluble y cruza la barrera hematoencefálica. Si el \\(\\text{pH}\\) de la sangre disminuye (acidemia), la ecuación se desplaza hacia la izquierda, incrementando la forma \\(\\text{HA}\\) y aumentando dramáticamente la entrada de la toxina al ce","assistantResponse":"Resumen clínico actualizado\nPaciente femenina de 24 años con intento de autolisis por ácido acetilsalicílico (Aspirina). Presenta un trastorno ácido-base mixto: alcalosis respiratoria primaria y acidosis metabólica con brecha aniónica elevada. El pH es de 7.41 debido a la compensación vectorial de ambos trastornos.\nHipotesis actualizada\n1.  Intoxicación grave por ácido acetilsalicílico con trastorno ácido-base mixto.\n2.  Alcalinización urinaria y potenciación de la eliminación renal.\nFactores de riesgo\n- Intento de autolisis.\n- Nivel crítico/tóxico de salicilato.\nRed flags\n- Agitación.\n- Diaforesis.\n- Acúfenos.\n- Alteraciones en los gases arteriales (GSA).\nEvidencia utilizada\n- Datos clínicos y de laboratorio proporcionados.\nSugerencias de evaluación\n1.  Monitoreo continuo de los signos vitales y la concentración sérica de salicilato.\n2.  Iniciar tratamiento con bicarbonato de sodio para alcalinizar la orina y potenciar la eliminación renal.\n3.  Considerar la cinética de eliminación para ajustar el tratamiento.\nLimitaciones\n- No se dispone de información adicional sobre la paciente.\nDisclaimer clinico\nLa evaluación y el manejo del paciente deben realizarse en el contexto de su historial clínico completo y los recursos disponibles. La monitorización estrecha y la respuesta a las intervenciones son cruciales."}
MB-Chat\data\medical-chat-learning.jsonl:78:{"id":"doctor-chat-1779057762481","recordedAt":"2026-05-17T22:42:42.481Z","source":"doctor_chat_frontend","doctorId":"0a947b0b-496a-401d-8060-05228412928d","conversationId":"doctor:0a947b0b-496a-401d-8060-05228412928d:patient:general:appointment:none:chat:fccfefbc-92f9-4b74-82e9-380953ba24f1","patientId":null,"appointmentId":null,"userMessage":"Sobre el manejo de las alergias y analgésicos\"El paciente presentó fiebre y una reacción alérgica al Paracetamol, suspendiéndose su uso. ¿Qué alternativas analgésicas y antipiréticas seguras existen a largo plazo para este paciente además de la dipirona, considerando que debe evitar los desencadenantes de alergias?\"","assistantResponse":"Estructura de razonamiento médico\n\nResumen clínico\nPaciente de 40 años con reacción alérgica al Paracetamol.\n\nHipotesis\n- El paciente requiere alternativas analgésicas y antipiréticas seguras a largo plazo.\n\nFactores de riesgo\n- Reacción alérgica al Paracetamol.\n\nRed flags\n- Ninguna identificada.\n\nEvidencia utilizada\n- Conocimiento general sobre alternativas analgésicas y antipiréticas.\n\nSugerencias de evaluación\n- Considerar opciones como:\n + Ibuprofeno o Naproxeno (AINEs) si no hay contraindicaciones.\n + Acetaminofén alternativas como metamizol (dipirona) ya en uso.\n + Otras opciones como tramadol o codeína en casos específicos.\n\nLimitaciones\n- No hay evidencia específica sobre el caso.\n\nDisclaimer clínico\nLa decisión final debe basarse en el criterio médico y la evidencia disponible."}
MB-Whatsapp\memory\feature-flags.ts:6:  vectorEnabled: false,
MB-Whatsapp\memory\feature-flags.ts:35:    vectorEnabled: readBoolean(env.SEMANTIC_MEMORY_VECTOR_ENABLED, DEFAULT_MEMORY_FEATURE_FLAGS.vectorEnabled),
MB-Whatsapp\memory\feature-flags.ts:47:  SEMANTIC_MEMORY_VECTOR_ENABLED: "false",
MB-Chat\models\v5\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v5\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v5\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v5\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v5\metrics.json:27:  "num_train_samples": 1,
MB-Chat\services\inference_service\app\service.py:120:                    message="Failed to load active model from registry.",
MB-Chat\models\anomaly_model_metadata.json:93:  "training_stats": {
MB-Chat\models\anomaly_model_metadata.json:97:    "train_normal_sequences": 181,
MB-Chat\models\anomaly_model_metadata.json:100:    "train_error_mean": 0.10589775443077087,
MB-Chat\models\anomaly_model_metadata.json:101:    "train_error_p95": 0.16205891966819763,
MB-Chat\cerebro_ai_med\requirements.txt:7:onnxruntime==1.19.2
MB-Chat\cerebro_ai_med\requirements.txt:8:faiss-cpu==1.8.0.post1
MB-Chat\models\v4\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v4\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v4\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v4\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v4\metrics.json:19:  "num_train_samples": 1,
MB-Chat\cerebro_ai_med\README.md:3:Proyecto modular de IA medica con FastAPI, PyTorch, MONAI, Ollama, ONNX Runtime y FAISS.
MB-Chat\cerebro_ai_med\README.md:21:- models/artifacts/text/{version}/text_risk_pipeline.joblib
MB-Chat\cerebro_ai_med\README.md:22:- models/artifacts/image/{version}/image_risk_pipeline.joblib
MB-Chat\cerebro_ai_med\README.md:23:- models/artifacts/metadata.json
MB-Chat\cerebro_ai_med\README.md:157:- `/health/ready`: valida readiness real (API key configurada, registry presente, modelo activo valido, integridad de artefactos y servicio de modelo cargado).
MB-Chat\cerebro_ai_med\README.md:158:- `/health/model`: health check profundo del modelo (estado de registry, version activa, existencia de artefactos y checksums SHA-256 por artefacto).
MB-Chat\cerebro_ai_med\tests\step2_model_demo.py:7:from cerebro_ai_med.models.train_models import train_and_save_models
MB-Chat\cerebro_ai_med\tests\step2_model_demo.py:13:    train_and_save_models()
MB-Chat\cerebro_ai_med\tests\test_stepc_health_observability.py:63:    assert checks["model_registry_exists"] is True
MB-Chat\cerebro_ai_med\tests\test_stepc_health_observability.py:73:    assert model_health["checks"]["registry_exists"] is True
MB-Chat\cerebro_ai_med\tests\test_stepc_health_observability.py:74:    assert model_health["checks"]["registry_parse_ok"] is True
MB-Chat\cerebro_ai_med\tests\test_stepc_health_observability.py:91:    assert checks["registry_exists"] is True
MB-Chat\cerebro_ai_med\tests\test_stepc_health_observability.py:92:    assert checks["registry_parse_ok"] is True
MB-Chat\cerebro_ai_med\tests\integration_distributed_real.py:112:        assert history["items"][-1]["embedding_slot"]["status"] == "pending"
MB-Chat\cerebro_ai_med\tests\integration_distributed_real.py:113:        assert history["items"][-1]["embedding_slot"]["vector_ref"]
MB-Chat\src\dl\predictor.service.ts:2:import * as ort from 'onnxruntime-node';
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:11:from cerebro_ai_med.models.registry import compute_sha256, parse_active_spec
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:14:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:15:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:26:    assert REGISTRY_PATH.exists(), f"registry_not_found: {REGISTRY_PATH}"
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:27:    spec = parse_active_spec(REGISTRY_PATH)
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:31:    # Integrity check against registry checksums.
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:48:def test_model_loader_and_runtime_inference_with_persisted_artifacts(active_model_spec) -> None:
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:51:    # Loader must expose active version from persisted registry.
MB-Chat\src\dl\model.loader.ts:4:import * as ort from 'onnxruntime-node';
MB-Chat\src\dl\model.loader.ts:19:  private readonly modelPath = join(process.cwd(), 'models', 'anomaly_model.onnx');
MB-Chat\src\dl\model.loader.ts:48:      this.logger.log(`[DL] ONNX model loaded input=${this.session.inputNames[0]}`);
MB-Chat\cerebro_ai_med\tests\test_inference_hardening.py:13:from cerebro_ai_med.models.registry import parse_active_spec
MB-Chat\cerebro_ai_med\tests\test_inference_hardening.py:16:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Chat\cerebro_ai_med\tests\test_inference_hardening.py:17:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Chat\cerebro_ai_med\tests\test_inference_hardening.py:53:    assert REGISTRY_PATH.exists(), f"registry_not_found: {REGISTRY_PATH}"
MB-Chat\cerebro_ai_med\tests\test_inference_hardening.py:54:    return parse_active_spec(REGISTRY_PATH)
MB-Chat\MB_CHAT_MEDICAL_CHAT_RUNTIME_TOOLS_AND_LEARNING_AUDIT.md:50:- It has a scheduled daily retraining job.
MB-Chat\MB_CHAT_MEDICAL_CHAT_RUNTIME_TOOLS_AND_LEARNING_AUDIT.md:51:- `MB-Chat/src/persistence/persistence.service.ts` persists outcomes and online-training records.
MB-Chat\src\dl\anomaly-predictor.service.ts:2:import * as ort from 'onnxruntime-node';
MB-Chat\memory\feature-flags.ts:6:  vectorEnabled: false,
MB-Chat\memory\feature-flags.ts:35:    vectorEnabled: readBoolean(env.SEMANTIC_MEMORY_VECTOR_ENABLED, DEFAULT_MEMORY_FEATURE_FLAGS.vectorEnabled),
MB-Chat\memory\feature-flags.ts:47:  SEMANTIC_MEMORY_VECTOR_ENABLED: "false",
MB-Chat\MB_CHAT_LOADTEST_PRECHECK.md:69:- Current decision: **GO with constraints**.
MB-Chat\memory\index.ts:8:export * from "./vector-backend.contract";
MB-Chat\memory\index.ts:15:  vectorBackend: "contract_only",
MB-Chat\memory\jsonl-memory-adapter.ts:174:        embedding_slot: record.embedding_slot,
MB-Chat\models\v15\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v15\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v15\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v15\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v15\metrics.json:75:  "num_train_samples": 168,
MB-Chat\data\processed\memory_history_real_validation.jsonl:1:{"entry_id": "e3e95698-41e3-479c-afe3-0d327f45bb80", "request_id": "69d9ce38-b954-4dc3-843b-0ee02f57ae90", "source": "sync", "created_at_utc": "2026-04-21T20:43:02.394421Z", "input_summary": {"source_type": "text", "modality": "TEXT", "text_length": 60}, "model_output": {"model_name": "production_medical_triage", "model_version": "3.0.0", "risk_level": "medium", "finding_code": "needs_clinical_review", "confidence": 0.486075, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation", "features_used": {"token_count": 9.0, "char_count": 60.0, "active_ngrams": 9.0}}, "decision_output": {"risk_level": "high", "clinical_flag": "urgent", "requires_medical_evaluation": true, "suspected_condition": "pneumonia_possible", "clinical_interpretation": "Patron radiologico compatible con proceso infeccioso pulmonar. Requiere correlacion clinica, examen fisico y confirmacion medica.", "action_plan": "urgent_er_referral", "urgency": "immediate", "follow_up_hours": 0, "red_flags": [], "recommended_tests": ["chest_xray_followup", "cbc", "crp", "pulse_oximetry"], "model_evidence": {"finding": "possible_pneumonia", "finding_code": "needs_clinical_review", "model_risk_level": "medium", "modality": "XRAY", "confidence": 0.4861, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation"}}, "nlg_output": {"text": "El analisis integra hallazgos compatibles con un escenario de riesgo elevado. Existe evidencia indirecta de probable compromiso respiratorio infeccioso. Debe activarse circuito de atencion urgente para confirmacion y manejo. Nivel de confianza del modelo: 0.49. Pruebas sugeridas: chest_xray_followup, cbc, crp, pulse_oximetry.", "style": "technical", "variants_used": ["El analisis integra hallazgos compatibles con un escenario de riesgo elevado.", "Existe evidencia indirecta de probable compromiso respiratorio infeccioso.", "Debe activarse circuito de atencion urgente para confirmacion y manejo."], "disclaimers": ["Salida automatizada de apoyo clinico; no reemplaza criterio medico.", "Requiere correlacion con historia clinica, examen fisico y estudios complementarios."]}, "fallback_used": false, "embedding_slot": {"embedding_id": "6abcd183-1dbd-4527-b6b3-a0573c9e492a", "status": "pending", "model_name": "reserved_for_future_embedding_model", "dimensions": null, "vector_ref": "memory_embeddings/sync/42d6d96c-bbec-4a98-b769-956f4397c1f1", "created_at_utc": "2026-04-21T20:43:02.394444Z"}}
MB-Chat\cerebro_ai_med\models\train_models.py:7:from sklearn.feature_extraction import DictVectorizer
MB-Chat\cerebro_ai_med\models\train_models.py:8:from sklearn.feature_extraction.text import TfidfVectorizer
MB-Chat\cerebro_ai_med\models\train_models.py:11:from sklearn.model_selection import train_test_split
MB-Chat\cerebro_ai_med\models\train_models.py:14:from cerebro_ai_med.models.registry import compute_sha256, ensure_semver, utc_now_iso
MB-Chat\cerebro_ai_med\models\train_models.py:15:from cerebro_ai_med.models.training_data import build_image_dataset, build_text_dataset
MB-Chat\cerebro_ai_med\models\train_models.py:18:ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MB-Chat\cerebro_ai_med\models\train_models.py:19:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Chat\cerebro_ai_med\models\train_models.py:24:def _train_text_pipeline() -> tuple[Pipeline, dict[str, float]]:
MB-Chat\cerebro_ai_med\models\train_models.py:25:    dataset = build_text_dataset()
MB-Chat\cerebro_ai_med\models\train_models.py:26:    x_train, x_test, y_train, y_test = train_test_split(
MB-Chat\cerebro_ai_med\models\train_models.py:27:        dataset.texts,
MB-Chat\cerebro_ai_med\models\train_models.py:28:        dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:31:        stratify=dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:36:            ("vectorizer", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=6000)),
MB-Chat\cerebro_ai_med\models\train_models.py:49:    pipeline.fit(x_train, y_train)
MB-Chat\cerebro_ai_med\models\train_models.py:61:def _train_image_pipeline() -> tuple[Pipeline, dict[str, float]]:
MB-Chat\cerebro_ai_med\models\train_models.py:62:    dataset = build_image_dataset(seed=42, n_per_class=260)
MB-Chat\cerebro_ai_med\models\train_models.py:63:    x_train, x_test, y_train, y_test = train_test_split(
MB-Chat\cerebro_ai_med\models\train_models.py:64:        dataset.features,
MB-Chat\cerebro_ai_med\models\train_models.py:65:        dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:68:        stratify=dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:73:            ("vectorizer", DictVectorizer(sparse=False)),
MB-Chat\cerebro_ai_med\models\train_models.py:86:    pipeline.fit(x_train, y_train)
MB-Chat\cerebro_ai_med\models\train_models.py:98:def train_and_save_models() -> dict[str, object]:
MB-Chat\cerebro_ai_med\models\train_models.py:110:    text_pipeline, text_metrics = _train_text_pipeline()
MB-Chat\cerebro_ai_med\models\train_models.py:111:    image_pipeline, image_metrics = _train_image_pipeline()
MB-Chat\cerebro_ai_med\models\train_models.py:124:        "artifacts": {
MB-Chat\cerebro_ai_med\models\train_models.py:140:    registry: dict[str, object]
MB-Chat\cerebro_ai_med\models\train_models.py:141:    if REGISTRY_PATH.exists():
MB-Chat\cerebro_ai_med\models\train_models.py:143:            registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
MB-Chat\cerebro_ai_med\models\train_models.py:145:            registry = {"active_model": version, "models": []}
MB-Chat\cerebro_ai_med\models\train_models.py:147:        registry = {"active_model": version, "models": []}
MB-Chat\cerebro_ai_med\models\train_models.py:149:    models = registry.get("models", [])
MB-Chat\cerebro_ai_med\models\train_models.py:156:    registry["active_model"] = version
MB-Chat\cerebro_ai_med\models\train_models.py:157:    registry["models"] = models
MB-Chat\cerebro_ai_med\models\train_models.py:158:    REGISTRY_PATH.write_text(json.dumps(registry, indent=2), encoding="utf-8")
MB-Chat\cerebro_ai_med\models\train_models.py:164:        "artifacts": {
MB-Chat\cerebro_ai_med\models\train_models.py:179:    result = train_and_save_models()
MB-Chat\memory\README.md:10:- Vector backend: contract only
MB-Chat\memory\README.md:20:- Prepare future pgvector or Qdrant integration without adding dependencies.
MB-Chat\memory\README.md:28:- `SEMANTIC_MEMORY_VECTOR_ENABLED=false`
MB-Chat\memory\README.md:35:- No external embedding provider is called.
MB-Chat\memory\semantic-memory-service.ts:145:  async trainFromMedicalChat(input: MedicalChatLearningRecord): Promise<boolean> {
MB-Chat\memory\semantic-memory-service.ts:153:        kind: "training-record",
MB-Chat\memory\semantic-memory-service.ts:171:      console.error("Failed to train from medical chat record:", error);
MB-Chat\data\processed\metadata.json:2:  "dataset_type": "synthetic",
MB-Chat\data\processed\metadata.json:3:  "input_dir": "E:\\MetaBrain\\data\\synthetic_dataset",
MB-Chat\data\processed\metadata.json:5:  "train_samples": 168,
MB-Chat\cerebro_ai_med\models\training_data.py:12:class TextDataset:
MB-Chat\cerebro_ai_med\models\training_data.py:18:class ImageDataset:
MB-Chat\cerebro_ai_med\models\training_data.py:23:def build_text_dataset() -> TextDataset:
MB-Chat\cerebro_ai_med\models\training_data.py:92:    return TextDataset(texts=texts, labels=labels)
MB-Chat\cerebro_ai_med\models\training_data.py:95:def build_image_dataset(seed: int = 42, n_per_class: int = 240) -> ImageDataset:
MB-Chat\cerebro_ai_med\models\training_data.py:138:    return ImageDataset(features=features, labels=labels)
MB-Chat\memory\types.ts:110:  vectorEnabled: boolean;
MB-Chat\memory\types.ts:141:  retrieval_mode: "disabled" | "lexical_jsonl" | "future_vector";
MB-Chat\memory\vector-backend.contract.ts:3:export type VectorSearchInput = {
MB-Chat\memory\vector-backend.contract.ts:4:  embedding: number[];
MB-Chat\memory\vector-backend.contract.ts:10:export type VectorSearchResult = {
MB-Chat\memory\vector-backend.contract.ts:13:  backend: "pgvector" | "qdrant" | "local_vector" | "future_provider";
MB-Chat\memory\vector-backend.contract.ts:16:export type FutureVectorBackend = MemoryBackend & {
MB-Chat\memory\vector-backend.contract.ts:17:  upsert_vector(entry: MemoryEntry, embedding: number[]): Promise<void>;
MB-Chat\memory\vector-backend.contract.ts:18:  vector_search(input: VectorSearchInput): Promise<VectorSearchResult[]>;
MB-Chat\memory\vector-backend.contract.ts:21:export const VECTOR_BACKEND_CONTRACT_STATUS = {
MB-Chat\memory\vector-backend.contract.ts:24:  allowedFutureBackends: ["pgvector", "qdrant", "local_vector"],
MB-Chat\memory\vector-backend.contract.ts:25:  note: "Contract only. No vector database dependency or runtime activation is introduced in Phase 3.",
MB-Chat\cerebro_ai_med\models\registry.py:66:            if "artifacts" in lowered:
MB-Chat\cerebro_ai_med\models\registry.py:67:                artifact_index = lowered.index("artifacts")
MB-Chat\cerebro_ai_med\models\registry.py:73:        raise RuntimeError("artifact_path_outside_registry_root")
MB-Chat\cerebro_ai_med\models\registry.py:79:    artifacts = entry.get("artifacts", {})
MB-Chat\cerebro_ai_med\models\registry.py:80:    text = artifacts.get("text", {})
MB-Chat\cerebro_ai_med\models\registry.py:81:    image = artifacts.get("image", {})
MB-Chat\cerebro_ai_med\models\registry.py:114:        raise RuntimeError(f"registry_not_found: {metadata_path}")
MB-Chat\cerebro_ai_med\models\registry.py:120:        raise RuntimeError("registry_has_no_models")
MB-Chat\cerebro_ai_med\models\registry.py:135:        raise RuntimeError(f"registry_not_found: {metadata_path}")
MB-Chat\cerebro_ai_med\models\registry.py:140:        raise RuntimeError("registry_has_no_models")
MB-Chat\cerebro_ai_med\models\ml_model.py:13:from cerebro_ai_med.models.registry import ActiveModelSpec, parse_active_spec, parse_best_fallback_spec
MB-Chat\cerebro_ai_med\models\ml_model.py:21:    return Path(os.path.join(os.path.dirname(__file__), "artifacts")).resolve()
MB-Chat\cerebro_ai_med\models\ml_model.py:25:REGISTRY_PATH = ARTIFACT_DIR / "metadata.json"
MB-Chat\cerebro_ai_med\models\ml_model.py:142:                f"Model artifact not found: {path}. Run training: "
MB-Chat\cerebro_ai_med\models\ml_model.py:143:                "e:/MetaBrain/.venv/Scripts/python.exe -m cerebro_ai_med.models.train_models"
MB-Chat\cerebro_ai_med\models\ml_model.py:174:        vectorizer = self._state.text_pipeline.named_steps["vectorizer"]
MB-Chat\cerebro_ai_med\models\ml_model.py:177:        x = vectorizer.transform([text])
MB-Chat\cerebro_ai_med\models\ml_model.py:202:                spec = parse_active_spec(REGISTRY_PATH)
MB-Chat\cerebro_ai_med\models\ml_model.py:215:                            metadata_path=REGISTRY_PATH,
MB-Chat\models\v14\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v14\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v14\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v14\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v14\metrics.json:75:  "num_train_samples": 168,
MB-Chat\memory_py\jsonl_adapter.py:158:                "embedding_slot": record.get("embedding_slot"),
MB-Chat\models\registry.json:6:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:8:      "train_f1": 1.0,
MB-Chat\models\registry.json:13:      "num_train_samples": 1,
MB-Chat\models\registry.json:17:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:22:      "train_accuracy": 0.9,
MB-Chat\models\registry.json:24:      "train_f1": 0.89,
MB-Chat\models\registry.json:29:      "num_train_samples": 400,
MB-Chat\models\registry.json:33:      "notes": "Initial training - 400 samples"
MB-Chat\models\registry.json:38:      "train_accuracy": 0.95,
MB-Chat\models\registry.json:40:      "train_f1": 0.94,
MB-Chat\models\registry.json:45:      "num_train_samples": 500,
MB-Chat\models\registry.json:54:      "train_accuracy": 0.87,
MB-Chat\models\registry.json:56:      "train_f1": 0.86,
MB-Chat\models\registry.json:61:      "num_train_samples": 500,
MB-Chat\models\registry.json:70:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:72:      "train_f1": 1.0,
MB-Chat\models\registry.json:77:      "num_train_samples": 1,
MB-Chat\models\registry.json:81:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:86:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:88:      "train_f1": 1.0,
MB-Chat\models\registry.json:93:      "num_train_samples": 1,
MB-Chat\models\registry.json:97:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:102:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:104:      "train_f1": 1.0,
MB-Chat\models\registry.json:109:      "num_train_samples": 1,
MB-Chat\models\registry.json:113:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:118:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:120:      "train_f1": 1.0,
MB-Chat\models\registry.json:125:      "num_train_samples": 168,
MB-Chat\models\registry.json:129:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:134:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:136:      "train_f1": 1.0,
MB-Chat\models\registry.json:141:      "num_train_samples": 168,
MB-Chat\models\registry.json:145:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:150:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:152:      "train_f1": 1.0,
MB-Chat\models\registry.json:157:      "num_train_samples": 168,
MB-Chat\models\registry.json:161:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:166:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:168:      "train_f1": 1.0,
MB-Chat\models\registry.json:173:      "num_train_samples": 168,
MB-Chat\models\registry.json:182:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:187:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:189:      "train_f1": 1.0,
MB-Chat\models\registry.json:194:      "num_train_samples": 168,
MB-Chat\models\registry.json:203:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:208:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:210:      "train_f1": 1.0,
MB-Chat\models\registry.json:215:      "num_train_samples": 168,
MB-Chat\models\registry.json:224:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:229:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:231:      "train_f1": 1.0,
MB-Chat\models\registry.json:236:      "num_train_samples": 168,
MB-Chat\models\registry.json:245:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:250:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:252:      "train_f1": 1.0,
MB-Chat\models\registry.json:257:      "num_train_samples": 168,
MB-Chat\models\registry.json:266:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:271:      "train_accuracy": 1.0,
MB-Chat\models\registry.json:273:      "train_f1": 1.0,
MB-Chat\models\registry.json:278:      "num_train_samples": 168,
MB-Chat\models\registry.json:287:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:297:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:303:      "notes": "Initial training - 400 samples"
MB-Chat\models\registry.json:339:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:345:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:351:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:357:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:363:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:369:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:375:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:381:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:387:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:393:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:399:      "notes": "Automatic training with validation"
MB-Chat\models\registry.json:405:      "notes": "Automatic training with validation"
MB-Chat\metabrain\observability\metrics.py:1:"""Thread-safe observability metrics registry.
MB-Chat\metabrain\observability\metrics.py:70:    """Single registry for all system observability signals."""
MB-Chat\memory_py\semantic_memory_service.py:30:        vector_enabled=_read_bool(values.get("SEMANTIC_MEMORY_VECTOR_ENABLED"), False),
MB-Chat\models\onnx_parity_report.json:5:  "onnx_total_ms": 0.7264000014401972,
MB-Chat\models\onnx_parity_report.json:6:  "onnx_latency_per_sample_ms": 0.020177777817783255,
MB-Chat\memory_py\types.py:43:    vector_enabled: bool = False
MB-Chat\metabrain\metrics.py:9:    """Small in-process metrics registry for NLG runtime signals."""
MB-Chat\models\model_metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\model_metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\model_metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\model_metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\model_metrics.json:75:  "num_train_samples": 168,
MB-Chat\models\monitoring\latest_health_check.json:5:    "train_accuracy": 1.0,
MB-Chat\models\monitoring\latest_health_check.json:6:    "train_precision": 1.0,
MB-Chat\models\monitoring\latest_health_check.json:7:    "train_recall": 1.0,
MB-Chat\models\monitoring\latest_health_check.json:8:    "train_f1": 1.0,
MB-Chat\models\monitoring\latest_health_check.json:17:    "num_train_samples": 1,
MB-Chat\models\monitoring\latest_health_check.json:23:    "num_train_samples": 500,
MB-Chat\models\monitoring\latest_health_check.json:25:    "train_accuracy": 0.97
MB-Chat\cerebro_ai_med\models\artifacts\model_metadata.json:9:  "artifacts": {
MB-Chat\cerebro_ai_med\models\artifacts\model_metadata.json:10:    "text": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\text\\3.0.0\\text_risk_pipeline.joblib",
MB-Chat\cerebro_ai_med\models\artifacts\model_metadata.json:11:    "image": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\image\\3.0.0\\image_risk_pipeline.joblib"
MB-Chat\models\v13\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v13\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v13\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v13\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v13\metrics.json:75:  "num_train_samples": 168,
MB-Chat\cerebro_ai_med\models\artifacts\metadata.json:13:      "artifacts": {
MB-Chat\src\common\types\brain.types.ts:99:  onnxFeatureVector?: number[];
MB-Chat\models\v1\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v1\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v1\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v1\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v1\metrics.json:15:  "num_train_samples": 1,
MB-Chat\models\v10\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v10\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v10\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v10\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v10\metrics.json:75:  "num_train_samples": 168,
MB-Chat\models\v12\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v12\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v12\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v12\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v12\metrics.json:75:  "num_train_samples": 168,
MB-Chat\models\reports\recommendation_v9.json:29:      "message": "More or equal training samples"
MB-Chat\models\reports\recommendation_v8.json:29:      "message": "More or equal training samples"
MB-Chat\risk\README.md:6:- Modelos sklearn/ONNX existentes.
MB-Chat\risk\README.md:9:Fase 2 no modifica thresholds, modelos ni training.
MB-Chat\models\reports\recommendation_v7.json:29:      "message": "More or equal training samples"
MB-Chat\cerebro_ai_med\memory\__init__.py:1:from cerebro_ai_med.memory.schemas import EmbeddingSlot, MemoryHistoryEntry, MemoryHistoryResponse
MB-Chat\cerebro_ai_med\memory\__init__.py:6:	"EmbeddingSlot",
MB-Chat\models\reports\recommendation_v6.json:29:      "message": "More or equal training samples"
MB-Chat\cerebro_ai_med\memory\store.py:10:from cerebro_ai_med.memory.schemas import MemoryHistoryEntry, MemoryHistoryResponse, build_embedding_slot
MB-Chat\cerebro_ai_med\memory\store.py:41:            embedding_slot=build_embedding_slot(source=source),
MB-Chat\models\reports\recommendation_v5.json:29:      "message": "More or equal training samples"
MB-Chat\cerebro_ai_med\memory\schemas.py:10:class EmbeddingSlot(BaseModel):
MB-Chat\cerebro_ai_med\memory\schemas.py:13:    embedding_id: str
MB-Chat\cerebro_ai_med\memory\schemas.py:17:    vector_ref: str | None = None
MB-Chat\cerebro_ai_med\memory\schemas.py:33:    embedding_slot: EmbeddingSlot
MB-Chat\cerebro_ai_med\memory\schemas.py:43:def build_embedding_slot(source: str) -> EmbeddingSlot:
MB-Chat\cerebro_ai_med\memory\schemas.py:44:    return EmbeddingSlot(
MB-Chat\cerebro_ai_med\memory\schemas.py:45:        embedding_id=str(uuid4()),
MB-Chat\cerebro_ai_med\memory\schemas.py:47:        model_name="reserved_for_future_embedding_model",
MB-Chat\cerebro_ai_med\memory\schemas.py:49:        vector_ref=f"memory_embeddings/{source}/{uuid4()}",
MB-Chat\models\v11\metrics.json:3:  "train_accuracy": 1.0,
MB-Chat\models\v11\metrics.json:4:  "train_precision": 1.0,
MB-Chat\models\v11\metrics.json:5:  "train_recall": 1.0,
MB-Chat\models\v11\metrics.json:6:  "train_f1": 1.0,
MB-Chat\models\v11\metrics.json:75:  "num_train_samples": 168,
MB-Chat\models\reports\recommendation_v4.json:29:      "message": "More or equal training samples"
MB-Chat\src\brain\brain.db-outage.simulation.spec.ts:42:  saveOnlineTrainingRecord: async () => undefined,
MB-Chat\src\brain\brain.db-outage.simulation.spec.ts:43:  updateOnlineTrainingOutcome: async () => undefined,
MB-Chat\src\brain\brain.db-outage.simulation.spec.ts:58:    featureVector: [],
MB-Chat\scripts\analyze_features.py:4:Analyzes the enriched dataset and shows which features are most valuable
MB-Chat\scripts\analyze_features.py:27:    # Check if datasets exist
MB-Chat\scripts\analyze_features.py:28:    if not os.path.exists('data/processed/X_train.csv'):
MB-Chat\scripts\analyze_features.py:29:        print("\nERROR: Training data not found!")
MB-Chat\scripts\analyze_features.py:34:    print("\nLoading datasets...")
MB-Chat\scripts\analyze_features.py:35:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\scripts\analyze_features.py:36:    y_train = pd.read_csv('data/processed/y_train.csv')
MB-Chat\scripts\analyze_features.py:39:    print(f"✓ Loaded {X_train.shape[0]} training samples, {X_train.shape[1]} features")
MB-Chat\scripts\analyze_features.py:46:    numeric_cols = X_train.select_dtypes(include=[np.number]).columns
MB-Chat\scripts\analyze_features.py:47:    stats = X_train[numeric_cols].describe().T
MB-Chat\scripts\analyze_features.py:50:    variance = X_train[numeric_cols].var().sort_values(ascending=False)
MB-Chat\scripts\analyze_features.py:89:            print("Run: python scripts/train_model.py first")
MB-Chat\scripts\analyze_features.py:91:        print("Model not found. Run: python scripts/train_model.py")
MB-Chat\scripts\analyze_features.py:132:    print(f"\nDataset Shape: {X_train.shape}")
MB-Chat\scripts\analyze_features.py:133:    print(f"Null Values: {X_train.isnull().sum().sum()}")
MB-Chat\scripts\analyze_features.py:134:    print(f"Duplicated Rows: {X_train.duplicated().sum()}")
MB-Chat\scripts\analyze_features.py:135:    print(f"Memory Usage: {X_train.memory_usage(deep=True).sum() / 1024:.2f} KB")
MB-Chat\models\reports\recommendation_v15.json:30:      "message": "More or equal training samples"
MB-Chat\cerebro_ai_med\main.py:26:from cerebro_ai_med.models.ml_model import REGISTRY_PATH
MB-Chat\cerebro_ai_med\main.py:27:from cerebro_ai_med.models.registry import compute_sha256, parse_active_spec
MB-Chat\cerebro_ai_med\main.py:326:        "model_registry_exists": REGISTRY_PATH.exists(),
MB-Chat\cerebro_ai_med\main.py:346:            "model_registry_exists",
MB-Chat\cerebro_ai_med\main.py:366:        "registry_exists": REGISTRY_PATH.exists(),
MB-Chat\cerebro_ai_med\main.py:367:        "registry_parse_ok": False,
MB-Chat\cerebro_ai_med\main.py:379:        "registry_path": str(REGISTRY_PATH),
MB-Chat\cerebro_ai_med\main.py:383:        raw = json.loads(Path(REGISTRY_PATH).read_text(encoding="utf-8"))
MB-Chat\cerebro_ai_med\main.py:384:        checks["registry_parse_ok"] = True
MB-Chat\cerebro_ai_med\main.py:387:        checks["registry_parse_ok"] = False
MB-Chat\cerebro_ai_med\main.py:390:        spec = parse_active_spec(REGISTRY_PATH)
MB-Chat\models\reports\recommendation_v14.json:30:      "message": "More or equal training samples"
MB-Chat\models\reports\recommendation_v10.json:30:      "message": "More or equal training samples"
MB-Chat\scripts\build_sequence_dataset.py:408:    parser = argparse.ArgumentParser(description='Build sequential anomaly dataset from system events')
MB-Chat\scripts\demo_model_registry.py:3:Model Registry Demonstration
MB-Chat\scripts\demo_model_registry.py:14:from model_registry import ModelRegistry
MB-Chat\scripts\demo_model_registry.py:19:    """Run demonstration of model registry features"""
MB-Chat\scripts\demo_model_registry.py:22:    print("MetaBrain Model Registry Demonstration")
MB-Chat\scripts\demo_model_registry.py:27:    registry = ModelRegistry('models/registry.json')
MB-Chat\scripts\demo_model_registry.py:28:    comparator = ModelComparison('models/registry.json')
MB-Chat\scripts\demo_model_registry.py:29:    rollback_mgr = ModelRollback('models/registry.json')
MB-Chat\scripts\demo_model_registry.py:31:    # Scenario: Three training runs with improving then degrading performance
MB-Chat\scripts\demo_model_registry.py:35:            'notes': 'Initial training - 400 samples',
MB-Chat\scripts\demo_model_registry.py:37:                'train_accuracy': 0.90,
MB-Chat\scripts\demo_model_registry.py:39:                'train_f1': 0.89,
MB-Chat\scripts\demo_model_registry.py:44:                'num_train_samples': 400,
MB-Chat\scripts\demo_model_registry.py:53:                'train_accuracy': 0.95,
MB-Chat\scripts\demo_model_registry.py:55:                'train_f1': 0.94,
MB-Chat\scripts\demo_model_registry.py:60:                'num_train_samples': 500,
MB-Chat\scripts\demo_model_registry.py:69:                'train_accuracy': 0.87,
MB-Chat\scripts\demo_model_registry.py:71:                'train_f1': 0.86,
MB-Chat\scripts\demo_model_registry.py:76:                'num_train_samples': 500,
MB-Chat\scripts\demo_model_registry.py:84:    print("SIMULATING 3 TRAINING RUNS")
MB-Chat\scripts\demo_model_registry.py:88:        print(f"\n>>> PHASE {i}: Training {scenario['version']}")
MB-Chat\scripts\demo_model_registry.py:91:        # Register model (would come from train_model.py in production)
MB-Chat\scripts\demo_model_registry.py:94:        # For simulation: manually add to registry (skip file copying)
MB-Chat\scripts\demo_model_registry.py:98:            'train_accuracy': scenario['metrics']['train_accuracy'],
MB-Chat\scripts\demo_model_registry.py:100:            'train_f1': scenario['metrics']['train_f1'],
MB-Chat\scripts\demo_model_registry.py:105:            'num_train_samples': scenario['metrics']['num_train_samples'],
MB-Chat\scripts\demo_model_registry.py:112:        registry.registry['versions'].append(version_record)
MB-Chat\scripts\demo_model_registry.py:113:        registry.registry['staging'] = version
MB-Chat\scripts\demo_model_registry.py:114:        registry.registry['history'].append({
MB-Chat\scripts\demo_model_registry.py:120:        registry._save_registry()
MB-Chat\scripts\demo_model_registry.py:130:            registry.promote_to_production(version)
MB-Chat\scripts\demo_model_registry.py:139:                registry.promote_to_production(version)
MB-Chat\scripts\demo_model_registry.py:144:                registry.reject_version(version, "Failed recommendation")
MB-Chat\scripts\demo_model_registry.py:149:    print("FINAL STATE AFTER 3 TRAINING CYCLES")
MB-Chat\scripts\demo_model_registry.py:152:    registry.print_summary()
MB-Chat\scripts\demo_model_registry.py:153:    registry.print_history()
MB-Chat\scripts\demo_model_registry.py:179:        rollback_mgr.registry = registry.registry  # Sync state
MB-Chat\scripts\demo_model_registry.py:180:        rollback_mgr.registry['current_production'] = 'v2'  # Set v2 as current
MB-Chat\scripts\demo_model_registry.py:181:        rollback_mgr._save_registry()
MB-Chat\scripts\data_pipeline.py:442:def create_dataset(input_dir='data/production_dataset', output_dir='data/processed', dataset_type='production'):
MB-Chat\scripts\data_pipeline.py:443:    """Create enriched ML dataset with advanced features"""
MB-Chat\scripts\data_pipeline.py:445:    print("FEATURE ENGINEERING: Creating Enriched ML Dataset")
MB-Chat\scripts\data_pipeline.py:458:            "Run scripts/extract_real_dataset.py first or provide a valid --input-dir."
MB-Chat\scripts\data_pipeline.py:560:        print(f"✓ Balanced dataset size: {len(df_clean)}")
MB-Chat\scripts\data_pipeline.py:627:    # === TRAIN/VALIDATION/TEST SPLIT ===
MB-Chat\scripts\data_pipeline.py:629:    print("TRAIN/VALIDATION/TEST SPLIT")
MB-Chat\scripts\data_pipeline.py:632:    from sklearn.model_selection import train_test_split
MB-Chat\scripts\data_pipeline.py:640:        # For small datasets, use 70/30 split and duplicate validation from test
MB-Chat\scripts\data_pipeline.py:641:        X_train, X_test, y_train, y_test = train_test_split(
MB-Chat\scripts\data_pipeline.py:645:        # Duplicate test as validation for small datasets
MB-Chat\scripts\data_pipeline.py:648:        print(f"\nSmall dataset ({n_samples} samples) - using 70/30 split with validation = test")
MB-Chat\scripts\data_pipeline.py:651:        X_train_val, X_test, y_train_val, y_test = train_test_split(
MB-Chat\scripts\data_pipeline.py:657:        X_train, X_val, y_train, y_val = train_test_split(
MB-Chat\scripts\data_pipeline.py:658:            X_train_val, y_train_val, test_size=val_size, random_state=42,
MB-Chat\scripts\data_pipeline.py:659:            stratify=y_train_val if len(y_train_val.unique()) > 1 else None
MB-Chat\scripts\data_pipeline.py:662:    print(f"\nTrain set: {X_train.shape[0]} samples ({X_train.shape[0]/len(X)*100:.1f}%)")
MB-Chat\scripts\data_pipeline.py:665:    print(f"Features: {X_train.shape[1]}")
MB-Chat\scripts\data_pipeline.py:670:    X_train_scaled = scaler.fit_transform(X_train)
MB-Chat\scripts\data_pipeline.py:677:    # === SAVE DATASETS ===
MB-Chat\scripts\data_pipeline.py:679:    print("SAVING DATASETS")
MB-Chat\scripts\data_pipeline.py:684:    # Save raw datasets
MB-Chat\scripts\data_pipeline.py:685:    X_train.to_csv(os.path.join(output_dir, 'X_train.csv'), index=False)
MB-Chat\scripts\data_pipeline.py:688:    y_train.to_csv(os.path.join(output_dir, 'y_train.csv'), index=False)
MB-Chat\scripts\data_pipeline.py:692:    # Save scaled datasets (for RF, need original; for NN/SVM need scaled)
MB-Chat\scripts\data_pipeline.py:693:    np.savetxt(os.path.join(output_dir, 'X_train_scaled.csv'), X_train_scaled, delimiter=',')
MB-Chat\scripts\data_pipeline.py:711:        'dataset_type': dataset_type,
MB-Chat\scripts\data_pipeline.py:714:        'train_samples': X_train.shape[0],
MB-Chat\scripts\data_pipeline.py:717:        'num_features': X_train.shape[1],
MB-Chat\scripts\data_pipeline.py:729:    print(f"\n✓ X_train.csv: {X_train.shape}")
MB-Chat\scripts\data_pipeline.py:731:    print(f"✓ y_train.csv: {y_train.shape}")
MB-Chat\scripts\data_pipeline.py:741:Dataset enrichment complete!
MB-Chat\scripts\data_pipeline.py:756:✓ Train/val/test split: {X_train.shape[0]}/{X_val.shape[0]}/{X_test.shape[0]} (70/15/15)
MB-Chat\scripts\data_pipeline.py:758:✓ Ready for ML model training!
MB-Chat\scripts\data_pipeline.py:762:    parser = argparse.ArgumentParser(description='Feature engineering pipeline for MetaBrain datasets')
MB-Chat\scripts\data_pipeline.py:763:    parser.add_argument('--input-dir', default='data/production_dataset', help='Input dataset directory')
MB-Chat\scripts\data_pipeline.py:766:        '--dataset-type',
MB-Chat\scripts\data_pipeline.py:769:        help='Dataset provenance label stored in metadata',
MB-Chat\scripts\data_pipeline.py:773:    create_dataset(input_dir=args.input_dir, output_dir=args.output_dir, dataset_type=args.dataset_type)
MB-Chat\scripts\extract_real_dataset.py:107:        description='Split data into production and synthetic datasets using incident provenance heuristics.'
MB-Chat\scripts\extract_real_dataset.py:110:    parser.add_argument('--production-dir', default='data/production_dataset', help='Output directory for production dataset')
MB-Chat\scripts\extract_real_dataset.py:111:    parser.add_argument('--synthetic-dir', default='data/synthetic_dataset', help='Output directory for synthetic dataset')
MB-Chat\scripts\extract_real_dataset.py:135:    with (source_dir / 'dataset_split_summary.json').open('w', encoding='utf-8') as f:
MB-Chat\scripts\extract_real_dataset.py:138:    print('Dataset split completed')
MB-Chat\scripts\extract_real_dataset.py:141:    print(f"  Summary: {(source_dir / 'dataset_split_summary.json').resolve()}")
MB-Chat\models\reports\deployment_gate_report.json:8:    "onnx_parity": true
MB-Chat\models\reports\deployment_gate_report.json:10:  "onnx_parity": 1.0,
MB-Chat\models\reports\recommendation_v13.json:30:      "message": "More or equal training samples"
MB-Chat\scripts\feature_selection.py:21:    For use when we have insufficient training data for actual RF importance
MB-Chat\scripts\feature_selection.py:124:def train_importance_model(X_train, y_train, feature_names):
MB-Chat\scripts\feature_selection.py:125:    """Train RandomForest to get feature importance"""
MB-Chat\scripts\feature_selection.py:128:    if len(np.unique(y_train)) < 2:
MB-Chat\scripts\feature_selection.py:129:        print("⚠ Only 1 class in training data - using theoretical feature importance\n")
MB-Chat\scripts\feature_selection.py:133:    if len(X_train) < 10:
MB-Chat\scripts\feature_selection.py:134:        print("⚠ Limited training data (<10 samples) - using theoretical feature importance\n")
MB-Chat\scripts\feature_selection.py:138:    print("Training RandomForest for feature importance...")
MB-Chat\scripts\feature_selection.py:141:    model.fit(X_train, y_train)
MB-Chat\scripts\feature_selection.py:148:    print("✓ Model trained\n")
MB-Chat\scripts\feature_selection.py:261:    print("\nLoading datasets...")
MB-Chat\scripts\feature_selection.py:262:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\scripts\feature_selection.py:264:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Chat\scripts\feature_selection.py:270:    print(f"✓ Loaded {X_train.shape[0]} train, {X_test.shape[0]} test samples")
MB-Chat\scripts\feature_selection.py:278:    model, importance_scores = train_importance_model(X_train, y_train, feature_names)
MB-Chat\scripts\feature_selection.py:302:    corr_matrix, high_corr_pairs = analyze_feature_correlation(X_train)
MB-Chat\scripts\feature_selection.py:337:    print(f"\nRecommendations for dataset optimization:")
MB-Chat\scripts\feature_selection.py:345:    print("STEP 6: Creating Optimized Datasets")
MB-Chat\scripts\feature_selection.py:352:    X_train_opt = X_train.iloc[:, indices_optimized]
MB-Chat\scripts\feature_selection.py:355:    X_train_opt.to_csv('data/processed/X_train_optimized.csv', index=False)
MB-Chat\scripts\feature_selection.py:357:    y_train.to_csv('data/processed/y_train_optimized.csv', index=False) if hasattr(y_train, 'to_csv') else pd.Series(y_train).to_csv('data/processed/y_train_optimized.csv', index=False)
MB-Chat\scripts\feature_selection.py:366:    print(f"  Size: {X_train_opt.shape}")
MB-Chat\scripts\feature_selection.py:372:    X_train_top80 = X_train.iloc[:, indices_top80]
MB-Chat\scripts\feature_selection.py:375:    X_train_top80.to_csv('data/processed/X_train_top80_importance.csv', index=False)
MB-Chat\scripts\feature_selection.py:384:    print(f"  Size: {X_train_top80.shape}")
MB-Chat\scripts\feature_selection.py:419:  Space savings:               {X_train.shape[1]} → {len(features_to_keep)} dimensions
MB-Chat\scripts\feature_selection.py:429:📁 GENERATED DATASETS:
MB-Chat\scripts\feature_selection.py:430:  • X_train_optimized.csv         ({len(features_to_keep)} features)
MB-Chat\scripts\feature_selection.py:431:  • X_train_top80_importance.csv  ({features_for_80} features)
MB-Chat\scripts\feature_selection.py:436:✓ Ready to train models with optimized feature sets!
MB-Chat\scripts\generate_synthetic_data.py:97:def generate_synthetic_dataset(total_incidents: int, seed: int, noise_level: float) -> Dict[str, List[dict]]:
MB-Chat\scripts\generate_synthetic_data.py:260:    dataset = generate_synthetic_dataset(total_incidents=args.count, seed=args.seed, noise_level=args.noise)
MB-Chat\scripts\generate_synthetic_data.py:263:    write_json(data_dir / "incidents.json", dataset["incidents"])
MB-Chat\scripts\generate_synthetic_data.py:264:    write_json(data_dir / "outcomes.json", dataset["outcomes"])
MB-Chat\scripts\generate_synthetic_data.py:265:    write_json(data_dir / "audit.json", dataset["audits"])
MB-Chat\scripts\generate_synthetic_data.py:267:    print("Synthetic dataset generated successfully")
MB-Chat\scripts\generate_synthetic_data.py:268:    print(f"  Incidents: {len(dataset['incidents'])}")
MB-Chat\scripts\generate_synthetic_data.py:269:    print(f"  Outcomes:  {len(dataset['outcomes'])}")
MB-Chat\scripts\generate_synthetic_data.py:270:    print(f"  Audits:    {len(dataset['audits'])}")
MB-Chat\scripts\generate_synthetic_data.py:271:    print(f"  Distribution by action: {dataset['class_distribution']}")
MB-Chat\models\reports\recommendation_v11.json:30:      "message": "More or equal training samples"
MB-Chat\scripts\model_compare.py:15:    def __init__(self, registry_path: str = 'models/registry.json'):
MB-Chat\scripts\model_compare.py:16:        self.registry_path = registry_path
MB-Chat\scripts\model_compare.py:17:        self.registry_dir = os.path.dirname(registry_path)
MB-Chat\scripts\model_compare.py:18:        self.registry = self._load_registry()
MB-Chat\scripts\model_compare.py:20:    def _load_registry(self) -> Dict:
MB-Chat\scripts\model_compare.py:21:        """Load registry"""
MB-Chat\scripts\model_compare.py:22:        if os.path.exists(self.registry_path):
MB-Chat\scripts\model_compare.py:23:            with open(self.registry_path, 'r') as f:
MB-Chat\scripts\model_compare.py:54:            'train_accuracy',
MB-Chat\scripts\model_compare.py:57:            'num_train_samples'
MB-Chat\scripts\model_compare.py:86:        prod = self.registry['current_production']
MB-Chat\scripts\model_compare.py:108:        prod = self._get_version(self.registry['current_production']) if self.registry['current_production'] else None
MB-Chat\scripts\model_compare.py:220:        if candidate['num_train_samples'] >= prod['num_train_samples']:
MB-Chat\scripts\model_compare.py:223:                'prod': prod['num_train_samples'],
MB-Chat\scripts\model_compare.py:224:                'candidate': candidate['num_train_samples'],
MB-Chat\scripts\model_compare.py:225:                'message': 'More or equal training samples'
MB-Chat\scripts\model_compare.py:231:                'prod': prod['num_train_samples'],
MB-Chat\scripts\model_compare.py:232:                'candidate': candidate['num_train_samples'],
MB-Chat\scripts\model_compare.py:233:                'reason': 'Fewer training samples'
MB-Chat\scripts\model_compare.py:256:        """Get version from registry"""
MB-Chat\scripts\model_compare.py:257:        for v in self.registry['versions']:
MB-Chat\scripts\model_compare.py:330:    registry = json.load(open('models/registry.json')) if os.path.exists('models/registry.json') else {'versions': []}
MB-Chat\scripts\model_compare.py:332:    versions = [v['version'] for v in registry.get('versions', [])]
MB-Chat\src\brain\brain.service.ts:244:        // Low confidence or ONNX failure: fallback to rules.
MB-Chat\src\brain\brain.service.ts:310:        onnxFeatureVector: mlResult.featureVector,
MB-Chat\src\brain\brain.service.ts:332:      // Save to online training buffer for micro-batch learning
MB-Chat\src\brain\brain.service.ts:340:            await this.persistenceService.saveOnlineTrainingRecord(
MB-Chat\src\brain\brain.service.ts:345:              mlResult.featureVector ?? [],
MB-Chat\src\brain\brain.service.ts:358:          `[OnlineTraining] Save buffer record for ${normalizedInput.id}`,
MB-Chat\src\brain\brain.service.ts:369:            this.persistenceService.updateOnlineTrainingOutcome(
MB-Chat\src\brain\brain.service.ts:375:            `[OnlineTraining] update outcome blocked for ${normalizedInput.id}`,
MB-Chat\src\brain\brain.service.ts:445:        this.persistenceService.updateOnlineTrainingOutcome(
MB-Chat\src\brain\brain.service.ts:451:        `[OnlineTraining] update outcome for ${normalizedInput.id}`,
MB-Chat\src\brain\brain.service.ts:495:        this.persistenceService.updateOnlineTrainingOutcome(
MB-Chat\src\brain\brain.service.ts:501:        `[OnlineTraining] update outcome failure for ${normalizedInput.id ?? input.id}`,
MB-Chat\scripts\model_monitor.py:42:        """Load baseline metrics from last training"""
MB-Chat\scripts\model_monitor.py:122:        expected_distribution: {class: frequency} from training set
MB-Chat\scripts\model_monitor.py:155:    def check_training_data_quality(self, num_samples: int,
MB-Chat\scripts\model_monitor.py:157:        """Check if training data quality is sufficient"""
MB-Chat\scripts\model_monitor.py:161:                metric='training_data',
MB-Chat\scripts\model_monitor.py:164:                message=f'Low training data volume: {num_samples} samples. Minimum 50 recommended.',
MB-Chat\scripts\model_monitor.py:172:    def check_model_staleness(self, last_training_time: datetime,
MB-Chat\scripts\model_monitor.py:174:        """Check if model is too old and needs retraining"""
MB-Chat\scripts\model_monitor.py:175:        age_days = (datetime.now() - last_training_time).days
MB-Chat\scripts\model_monitor.py:183:                message=f'Model is {age_days} days old. Recommend retraining.',
MB-Chat\scripts\model_monitor.py:222:        data_alert = self.check_training_data_quality(
MB-Chat\scripts\model_monitor.py:223:            current_metrics.get('num_train_samples', 0)
MB-Chat\scripts\model_monitor.py:275:        'num_train_samples': 500,
MB-Chat\scripts\model_monitor.py:277:        'train_accuracy': 0.97,
MB-Chat\scripts\model_registry.py:2:MetaBrain ML Model Registry
MB-Chat\scripts\model_registry.py:14:class ModelRegistry:
MB-Chat\scripts\model_registry.py:15:    """Central registry for recording and managing model versions"""
MB-Chat\scripts\model_registry.py:17:    def __init__(self, registry_path: str = 'models/registry.json'):
MB-Chat\scripts\model_registry.py:18:        self.registry_path = registry_path
MB-Chat\scripts\model_registry.py:19:        self.registry_dir = os.path.dirname(registry_path)
MB-Chat\scripts\model_registry.py:20:        os.makedirs(self.registry_dir, exist_ok=True)
MB-Chat\scripts\model_registry.py:21:        self.registry = self._load_registry()
MB-Chat\scripts\model_registry.py:23:    def _load_registry(self) -> Dict:
MB-Chat\scripts\model_registry.py:24:        """Load registry from JSON file"""
MB-Chat\scripts\model_registry.py:25:        if not os.path.exists(self.registry_path):
MB-Chat\scripts\model_registry.py:34:            with open(self.registry_path, 'r') as f:
MB-Chat\scripts\model_registry.py:37:            print(f"Error loading registry: {e}")
MB-Chat\scripts\model_registry.py:45:    def _save_registry(self):
MB-Chat\scripts\model_registry.py:46:        """Save registry to JSON file"""
MB-Chat\scripts\model_registry.py:47:        with open(self.registry_path, 'w') as f:
MB-Chat\scripts\model_registry.py:48:            json.dump(self.registry, f, indent=2)
MB-Chat\scripts\model_registry.py:52:        if not self.registry['versions']:
MB-Chat\scripts\model_registry.py:55:        last_version = self.registry['versions'][-1]['version']
MB-Chat\scripts\model_registry.py:72:        version_dir = os.path.join(self.registry_dir, next_version)
MB-Chat\scripts\model_registry.py:78:        for file in ['decision_model.pkl', 'decision_model.onnx', 'confusion_matrix.json', 'onnx_metadata.json', 'feature_names.txt']:
MB-Chat\scripts\model_registry.py:93:            'train_accuracy': metrics.get('train_accuracy', 0),
MB-Chat\scripts\model_registry.py:95:            'train_f1': metrics.get('train_f1', 0),
MB-Chat\scripts\model_registry.py:100:            'num_train_samples': metrics.get('num_train_samples', 0),
MB-Chat\scripts\model_registry.py:112:        self.registry['versions'].append(version_record)
MB-Chat\scripts\model_registry.py:113:        self.registry['staging'] = next_version
MB-Chat\scripts\model_registry.py:116:        self.registry['history'].append({
MB-Chat\scripts\model_registry.py:123:        self._save_registry()
MB-Chat\scripts\model_registry.py:147:        for v in self.registry['versions']:
MB-Chat\scripts\model_registry.py:162:        if self.registry['current_production']:
MB-Chat\scripts\model_registry.py:163:            for v in self.registry['versions']:
MB-Chat\scripts\model_registry.py:164:                if v['version'] == self.registry['current_production']:
MB-Chat\scripts\model_registry.py:169:        self.registry['current_production'] = version
MB-Chat\scripts\model_registry.py:172:        self.registry['history'].append({
MB-Chat\scripts\model_registry.py:176:            'previous_production': self.registry['current_production']
MB-Chat\scripts\model_registry.py:179:        self._save_registry()
MB-Chat\scripts\model_registry.py:189:        for v in self.registry['versions']:
MB-Chat\scripts\model_registry.py:193:                self.registry['history'].append({
MB-Chat\scripts\model_registry.py:200:                self._save_registry()
MB-Chat\scripts\model_registry.py:208:        if not self.registry['current_production']:
MB-Chat\scripts\model_registry.py:211:        for v in self.registry['versions']:
MB-Chat\scripts\model_registry.py:212:            if v['version'] == self.registry['current_production']:
MB-Chat\scripts\model_registry.py:219:        if not self.registry['staging']:
MB-Chat\scripts\model_registry.py:222:        for v in self.registry['versions']:
MB-Chat\scripts\model_registry.py:223:            if v['version'] == self.registry['staging']:
MB-Chat\scripts\model_registry.py:230:        for v in self.registry['versions']:
MB-Chat\scripts\model_registry.py:241:            format: 'pkl' or 'onnx'
MB-Chat\scripts\model_registry.py:246:        version_dir = os.path.join(self.registry_dir, version)
MB-Chat\scripts\model_registry.py:252:        elif format == 'onnx':
MB-Chat\scripts\model_registry.py:253:            model_file = os.path.join(version_dir, 'decision_model.onnx')
MB-Chat\scripts\model_registry.py:262:        print("MODEL REGISTRY HISTORY")
MB-Chat\scripts\model_registry.py:268:        for v in self.registry['versions']:
MB-Chat\scripts\model_registry.py:270:            symbol = '●' if v['version'] == self.registry['current_production'] else '◯'
MB-Chat\scripts\model_registry.py:276:        print(f"Current Production: {self.registry['current_production'] or 'None'}")
MB-Chat\scripts\model_registry.py:277:        print(f"Current Staging:    {self.registry['staging'] or 'None'}")
MB-Chat\scripts\model_registry.py:278:        print(f"Total Versions:     {len(self.registry['versions'])}")
MB-Chat\scripts\model_registry.py:282:        """Print registry summary"""
MB-Chat\scripts\model_registry.py:284:        print("MODEL REGISTRY SUMMARY")
MB-Chat\scripts\model_registry.py:306:        print(f"Total Versions: {len(self.registry['versions'])}")
MB-Chat\scripts\model_registry.py:312:    registry = ModelRegistry()
MB-Chat\scripts\model_registry.py:316:        'train_accuracy': 0.95,
MB-Chat\scripts\model_registry.py:318:        'train_f1': 0.93,
MB-Chat\scripts\model_registry.py:323:        'num_train_samples': 500,
MB-Chat\scripts\model_registry.py:328:    # Register (would be called by train_model.py)
MB-Chat\scripts\model_registry.py:329:    version = registry.register_model(
MB-Chat\scripts\model_registry.py:331:        notes="Training with 500 samples"
MB-Chat\scripts\model_registry.py:335:    registry.print_summary()
MB-Chat\scripts\model_registry.py:336:    registry.print_history()
MB-Chat\scripts\model_rollback.py:16:    def __init__(self, registry_path: str = 'models/registry.json', model_dir: str = 'models'):
MB-Chat\scripts\model_rollback.py:17:        self.registry_path = registry_path
MB-Chat\scripts\model_rollback.py:19:        self.registry_dir = os.path.dirname(registry_path)
MB-Chat\scripts\model_rollback.py:20:        self.registry = self._load_registry()
MB-Chat\scripts\model_rollback.py:22:    def _load_registry(self) -> dict:
MB-Chat\scripts\model_rollback.py:23:        """Load registry"""
MB-Chat\scripts\model_rollback.py:24:        if os.path.exists(self.registry_path):
MB-Chat\scripts\model_rollback.py:25:            with open(self.registry_path, 'r') as f:
MB-Chat\scripts\model_rollback.py:29:    def _save_registry(self):
MB-Chat\scripts\model_rollback.py:30:        """Save registry"""
MB-Chat\scripts\model_rollback.py:31:        with open(self.registry_path, 'w') as f:
MB-Chat\scripts\model_rollback.py:32:            json.dump(self.registry, f, indent=2)
MB-Chat\scripts\model_rollback.py:36:        return self.registry.get('versions', [])
MB-Chat\scripts\model_rollback.py:40:        history = self.registry.get('history', [])
MB-Chat\scripts\model_rollback.py:60:        for v in self.registry['versions']:
MB-Chat\scripts\model_rollback.py:66:            print(f"✗ Version {version} not found in registry")
MB-Chat\scripts\model_rollback.py:70:        current_prod = self.registry.get('current_production')
MB-Chat\scripts\model_rollback.py:77:        for v in self.registry['versions']:
MB-Chat\scripts\model_rollback.py:89:        version_dir = os.path.join(self.registry_dir, version)
MB-Chat\scripts\model_rollback.py:93:            'decision_model.onnx',
MB-Chat\scripts\model_rollback.py:111:        # Update registry
MB-Chat\scripts\model_rollback.py:118:        self.registry['current_production'] = version
MB-Chat\scripts\model_rollback.py:121:        self.registry['history'].append({
MB-Chat\scripts\model_rollback.py:129:        self._save_registry()
MB-Chat\scripts\model_rollback.py:149:        current = self._get_version(self.registry['current_production'])
MB-Chat\scripts\model_rollback.py:152:        for v in reversed(self.registry['versions']):
MB-Chat\scripts\model_rollback.py:153:            if v['version'] == self.registry['current_production']:
MB-Chat\scripts\model_rollback.py:175:        for v in self.registry['versions']:
MB-Chat\scripts\model_rollback.py:177:                if v['version'] != self.registry['current_production']:
MB-Chat\scripts\model_rollback.py:189:        """Get version from registry"""
MB-Chat\scripts\model_rollback.py:190:        for v in self.registry['versions']:
MB-Chat\scripts\run_ml_validation.py:4:Complete workflow: Data → Train → Validate → Monitor
MB-Chat\scripts\run_ml_validation.py:94:            print(f"  Train Samples:      {metrics.get('num_train_samples', 'N/A')}")
MB-Chat\scripts\run_ml_validation.py:97:            print(f"  Train Accuracy:     {metrics.get('train_accuracy', 'N/A'):.4f}")
MB-Chat\scripts\run_ml_validation.py:139:║ Complete workflow: Data → Train → Validate → Monitor                      ║
MB-Chat\scripts\run_ml_validation.py:145:    # Step 1: Split production vs synthetic dataset
MB-Chat\scripts\run_ml_validation.py:149:        "1. Dataset Split (production vs synthetic)",
MB-Chat\scripts\run_ml_validation.py:150:        [python_exe, "scripts/extract_real_dataset.py"]
MB-Chat\scripts\run_ml_validation.py:152:        print("✗ Dataset split failed - cannot continue")
MB-Chat\scripts\run_ml_validation.py:164:            "data/production_dataset",
MB-Chat\scripts\run_ml_validation.py:167:            "--dataset-type",
MB-Chat\scripts\run_ml_validation.py:173:    # Step 3: Model Training
MB-Chat\scripts\run_ml_validation.py:175:        "3. Model Training (with Validation)",
MB-Chat\scripts\run_ml_validation.py:176:        [python_exe, "scripts/train_model.py"]
MB-Chat\scripts\run_ml_validation.py:178:        print("✗ Training failed - cannot continue")
MB-Chat\src\brain\brain.high-load.spec.ts:53:  saveOnlineTrainingRecord: async () => undefined,
MB-Chat\src\brain\brain.high-load.spec.ts:54:  updateOnlineTrainingOutcome: async () => undefined,
MB-Chat\src\brain\brain.high-load.spec.ts:69:    featureVector: [],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:56:  saveOnlineTrainingRecord: async () => undefined,
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:57:  updateOnlineTrainingOutcome: async () => undefined,
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:72:    featureVector: [],
MB-Chat\retrieval\index.ts:24:  notes: ["MetaBrain Nest usa embeddings hash; Next usa allowlist y sanitizer."],
MB-Chat\README.md:28:2. **Entrenamiento con Validación** (`scripts/train_model.py`):
MB-Chat\README.md:32:   - Export: `models/decision_model.onnx`
MB-Chat\README.md:35:   - `ModelLoader`: Carga modelo ONNX al iniciar
MB-Chat\README.md:63:- **Carga Dinámica de Modelos**: ONNX runtime con gestión de memoria LRU
MB-Chat\README.md:102:- **Registro de Modelos**: `data/model-registry.json`
MB-Chat\README.md:103:- **Modelos**: `data/models/*.onnx`
MB-Chat\README.md:136:Data → Features (18) → Train/Test Split (80/20) → Training
MB-Chat\README.md:151:2. **`scripts/train_model.py`**: Entrenamiento con métricas comprehensivas
MB-Chat\README.md:154:5. **`scripts/run_ml_validation.py`**: Pipeline orquestada (data → train → validate → monitor)
MB-Chat\README.md:159:# Pipeline completo: data → train → validate → monitor
MB-Chat\README.md:164:python scripts/train_model.py        # Entrenar con validación
MB-Chat\README.md:171:**Overfitting Detection** (train accuracy - test accuracy):
MB-Chat\README.md:194:├── decision_model.onnx         # Export ONNX para Node.js
MB-Chat\README.md:201:├── X_train.csv, X_test.csv     # Features
MB-Chat\README.md:202:├── y_train.csv, y_test.csv     # Labels
MB-Chat\README.md:215:MetaBrain implementa un sistema de **Model Registry** para controlar la evolución segura de modelos con versionado automático, comparación inteligente y rollback seguro.
MB-Chat\README.md:241:Training → Register (v1, v2, v3) → Compare vs Prod → Recommend (DEPLOY/REJECT)
MB-Chat\README.md:270:3. **Model Registry** (`scripts/model_registry.py`)
MB-Chat\README.md:290:   - Actualiza registry con razón y timestamp
MB-Chat\README.md:292:6. **Registry Structure** (`models/registry.json`)
MB-Chat\README.md:314:- ml_confidence: 0-1.0 (REAL, from trained model)
MB-Chat\README.md:326:python scripts/train_model.py
MB-Chat\README.md:334:python -c "from model_registry import ModelRegistry; \
MB-Chat\README.md:335:  r = ModelRegistry(); r.print_history()"
MB-Chat\README.md:338:python scripts/demo_model_registry.py
MB-Chat\README.md:345:- [docs/ML_MODEL_REGISTRY.md](docs/ML_MODEL_REGISTRY.md): Version control, comparación, rollback
MB-Chat\README.md:357:python scripts/train_model.py
MB-Chat\README.md:358:# → Crea models/decision_model.pkl y registry.json
MB-Chat\README.md:387:tail -f logs/app.log | grep "Learning.*Retraining"
MB-Chat\README.md:390:python scripts/train_model.py
MB-Chat\README.md:397:python -c "from model_registry import ModelRegistry; \
MB-Chat\README.md:398:  ModelRegistry().print_history()"
MB-Chat\README.md:404:python scripts/demo_model_registry.py
MB-Chat\README.md:419:  - ML (0.4): ONNX model + enriched features
MB-Chat\README.md:437:- **Registry**: historial de versiones + deployments en `models/registry.json`
MB-Chat\src\action-engine\action.service.ts:3:import { SAFE_COMMANDS } from '../execution/command.registry';
MB-Chat\scripts\validate_model.py:34:    train_acc = metrics.get('train_accuracy', 0)
MB-Chat\scripts\validate_model.py:36:    overfit_score = metrics.get('overfitting_score', train_acc - test_acc)
MB-Chat\scripts\validate_model.py:39:        'train_accuracy': train_acc,
MB-Chat\scripts\validate_model.py:96:        print("❌ No model metrics found. Train a model first.")
MB-Chat\scripts\validate_model.py:106:    print(f"  Train Accuracy: {overfit_check['train_accuracy']:.4f}")
MB-Chat\scripts\validate_model.py:125:    print(f"Cross-Validation (Train, k-fold):")
MB-Chat\scripts\validate_model.py:230:    # 5. DATASET INFO
MB-Chat\scripts\validate_model.py:232:    print("5. DATASET & MODEL INFO")
MB-Chat\scripts\validate_model.py:235:    print(f"  Train Samples: {metrics.get('num_train_samples', 'N/A')}")
MB-Chat\scripts\validate_model.py:247:        recommendations.append("• Increase training data or re-engineer features")
MB-Chat\scripts\validate_model.py:251:        recommendations.append("• Increase training set size if possible")
MB-Chat\scripts\validate_model.py:255:        recommendations.append("• Increase training data per class to validate robustness")
MB-Chat\scripts\validate_model.py:259:        recommendations.append("• Collect more diverse training data")
MB-Chat\scripts\validate_model.py:269:        recommendations.append("• Perform regular retraining with new data")
MB-Chat\scripts\validate_onnx_parity.py:6:import onnxruntime as rt
MB-Chat\scripts\validate_onnx_parity.py:13:    onnx_session = rt.InferenceSession('models/decision_model.onnx')
MB-Chat\scripts\validate_onnx_parity.py:14:    input_name = onnx_session.get_inputs()[0].name
MB-Chat\scripts\validate_onnx_parity.py:21:    # ONNX predictions
MB-Chat\scripts\validate_onnx_parity.py:22:    onnx_input = X_test.astype(np.float32).to_numpy()
MB-Chat\scripts\validate_onnx_parity.py:24:    outputs = onnx_session.run(None, {input_name: onnx_input})
MB-Chat\scripts\validate_onnx_parity.py:27:    # Try to extract labels from ONNX outputs.
MB-Chat\scripts\validate_onnx_parity.py:28:    # skl2onnx typically emits label tensor as first output.
MB-Chat\scripts\validate_onnx_parity.py:29:    onnx_label = outputs[0]
MB-Chat\scripts\validate_onnx_parity.py:30:    onnx_pred = np.array(onnx_label).reshape(-1)
MB-Chat\scripts\validate_onnx_parity.py:32:    parity = float((onnx_pred == sk_pred).mean())
MB-Chat\scripts\validate_onnx_parity.py:39:        'onnx_total_ms': ox_ms,
MB-Chat\scripts\validate_onnx_parity.py:40:        'onnx_latency_per_sample_ms': latency_per_sample_ms,
MB-Chat\scripts\validate_onnx_parity.py:45:    with open('models/onnx_parity_report.json', 'w') as f:
MB-Chat\scripts\validate_onnx_parity.py:48:    print('ONNX parity validation complete')
MB-Chat\scripts\train_model_incremental.py:3:Incremental Model Training for MetaBrain
MB-Chat\scripts\train_model_incremental.py:4:Trains a new model using historical data + online feedback buffer
MB-Chat\scripts\train_model_incremental.py:7:    python train_model_incremental.py <buffer_csv_path>
MB-Chat\scripts\train_model_incremental.py:26:from skl2onnx import convert_sklearn
MB-Chat\scripts\train_model_incremental.py:27:from skl2onnx.common.data_types import FloatTensorType
MB-Chat\scripts\train_model_incremental.py:29:# Import from main training script
MB-Chat\scripts\train_model_incremental.py:31:from train_model import (
MB-Chat\scripts\train_model_incremental.py:34:    export_onnx_metadata,
MB-Chat\scripts\train_model_incremental.py:40:from model_registry import ModelRegistry
MB-Chat\scripts\train_model_incremental.py:44:    """Load the historical training dataset"""
MB-Chat\scripts\train_model_incremental.py:45:    X_train_path = Path('data/processed/X_train.csv')
MB-Chat\scripts\train_model_incremental.py:46:    y_train_path = Path('data/processed/y_train.csv')
MB-Chat\scripts\train_model_incremental.py:50:    if not all([X_train_path.exists(), y_train_path.exists()]):
MB-Chat\scripts\train_model_incremental.py:51:        raise FileNotFoundError('Historical training data not found')
MB-Chat\scripts\train_model_incremental.py:53:    X_train = pd.read_csv(X_train_path)
MB-Chat\scripts\train_model_incremental.py:54:    y_train = pd.read_csv(y_train_path).squeeze()
MB-Chat\scripts\train_model_incremental.py:58:    return X_train, y_train, X_test, y_test
MB-Chat\scripts\train_model_incremental.py:77:def combine_datasets(X_train, y_train, X_incremental, y_incremental):
MB-Chat\scripts\train_model_incremental.py:78:    """Combine historical and incremental datasets"""
MB-Chat\scripts\train_model_incremental.py:80:    common_cols = set(X_train.columns) & set(X_incremental.columns)
MB-Chat\scripts\train_model_incremental.py:81:    X_train_aligned = X_train[list(common_cols)]
MB-Chat\scripts\train_model_incremental.py:84:    X_combined = pd.concat([X_train_aligned, X_incremental_aligned], ignore_index=True)
MB-Chat\scripts\train_model_incremental.py:85:    y_combined = pd.concat([y_train, y_incremental], ignore_index=True, keys=[0, 1])
MB-Chat\scripts\train_model_incremental.py:87:    print(f'[OnlineLearning] Combined dataset: {len(X_combined)} records, {len(X_combined.columns)} features')
MB-Chat\scripts\train_model_incremental.py:91:def train_incremental_model(X, y, feature_names):
MB-Chat\scripts\train_model_incremental.py:92:    """Train model with combined historical + incremental data"""
MB-Chat\scripts\train_model_incremental.py:93:    print('[OnlineLearning] Training RandomForest with incremental data...')
MB-Chat\scripts\train_model_incremental.py:139:    """Main incremental training pipeline"""
MB-Chat\scripts\train_model_incremental.py:141:    print('Incremental Model Training - MetaBrain Online Learning')
MB-Chat\scripts\train_model_incremental.py:146:        X_train_hist, y_train_hist, X_test, y_test = load_historical_data()
MB-Chat\scripts\train_model_incremental.py:148:        X_combined, y_combined, feature_names = combine_datasets(
MB-Chat\scripts\train_model_incremental.py:149:            X_train_hist, y_train_hist, X_incr, y_incr
MB-Chat\scripts\train_model_incremental.py:155:    # Step 2: Train incremental model
MB-Chat\scripts\train_model_incremental.py:157:        model, cv_mean, cv_std = train_incremental_model(X_combined, y_combined, feature_names)
MB-Chat\scripts\train_model_incremental.py:159:        print(f'[ERROR] Training failed: {e}')
MB-Chat\scripts\train_model_incremental.py:170:        train_accuracy = cv_mean
MB-Chat\scripts\train_model_incremental.py:172:        train_accuracy = model.score(X_combined, y_combined)
MB-Chat\scripts\train_model_incremental.py:175:    overfitting_score = calculate_overfitting_score(train_accuracy, test_accuracy)
MB-Chat\scripts\train_model_incremental.py:186:        onnx_path='models/decision_model.onnx',
MB-Chat\scripts\train_model_incremental.py:198:        'onnx_parity': gate_result['onnx_parity'],
MB-Chat\scripts\train_model_incremental.py:203:        'total_training_records': len(X_combined),
MB-Chat\scripts\train_model_incremental.py:218:    # Step 5: Export artifacts
MB-Chat\scripts\train_model_incremental.py:228:        # Convert to ONNX
MB-Chat\scripts\train_model_incremental.py:231:        with open('models/decision_model.onnx', 'wb') as f:
MB-Chat\scripts\train_model_incremental.py:233:        print('[OK] Saved: models/decision_model.onnx')
MB-Chat\scripts\train_model_incremental.py:247:        schema_info = export_onnx_metadata(
MB-Chat\scripts\train_model_incremental.py:254:        # Register in model registry
MB-Chat\scripts\train_model_incremental.py:255:        registry = ModelRegistry('models/registry.json')
MB-Chat\scripts\train_model_incremental.py:267:        version = registry.register_model(
MB-Chat\scripts\train_model_incremental.py:269:            notes=f'Incremental training: {len(X_incr)} online feedback records'
MB-Chat\scripts\train_model_incremental.py:283:    parser = argparse.ArgumentParser(description='Incremental model training')
MB-Chat\scripts\visualize_features.py:138:    # === DATASET SIZE COMPARISON ===
MB-Chat\scripts\visualize_features.py:224:Generated Datasets:
MB-Chat\scripts\visualize_features.py:225:  ✓ X_train_optimized.csv (37 features)
MB-Chat\scripts\visualize_features.py:226:  ✓ X_train_top80_importance.csv (31 features)
MB-Chat\production_safety_py\__init__.py:7:from .rollback_registry import build_rollback_registry
MB-Chat\production_safety_py\__init__.py:21:    "build_rollback_registry",
MB-Chat\production_safety_py\types.py:69:class RollbackRegistryEntry:
MB-Chat\scripts\train_model.py:2:import onnxruntime as rt
MB-Chat\scripts\train_model.py:13:from skl2onnx import convert_sklearn
MB-Chat\scripts\train_model.py:14:from skl2onnx.common.data_types import FloatTensorType
MB-Chat\scripts\train_model.py:25:from model_registry import ModelRegistry
MB-Chat\scripts\train_model.py:291:def enforce_dataset_gate(y_train, y_val, y_test):
MB-Chat\scripts\train_model.py:293:    dataset_type = str(metadata.get('dataset_type', 'unknown')).lower()
MB-Chat\scripts\train_model.py:295:    if dataset_type != 'production':
MB-Chat\scripts\train_model.py:296:        print(f"Dataset type: {dataset_type} (production gate not enforced)")
MB-Chat\scripts\train_model.py:299:    total_samples = int(metadata.get('total_samples', len(y_train) + len(y_val) + len(y_test)))
MB-Chat\scripts\train_model.py:304:        y_all = np.concatenate([y_train, y_val, y_test])
MB-Chat\scripts\train_model.py:308:    print(f"Dataset type: production")
MB-Chat\scripts\train_model.py:313:            "Production dataset gate failed: "
MB-Chat\scripts\train_model.py:320:def select_cv_folds(y_train):
MB-Chat\scripts\train_model.py:327:    if len(y_train) < 2:
MB-Chat\scripts\train_model.py:330:    _, class_counts = np.unique(y_train, return_counts=True)
MB-Chat\scripts\train_model.py:339:def calculate_overfitting_score(train_acc, test_acc):
MB-Chat\scripts\train_model.py:340:    """Calculate overfitting indicator: difference between train and test accuracy"""
MB-Chat\scripts\train_model.py:341:    return train_acc - test_acc
MB-Chat\scripts\train_model.py:355:    onnx_path: str = 'models/decision_model.onnx',
MB-Chat\scripts\train_model.py:365:    2. overfitting_score < 0.30  (train_acc - test_acc)
MB-Chat\scripts\train_model.py:367:    4. ONNX parity   == 1.0      (ONNX predictions identical to sklearn)
MB-Chat\scripts\train_model.py:372:      onnx_parity  float – measured parity rate (0‥1)
MB-Chat\scripts\train_model.py:401:    # 4. ONNX parity == 1.0
MB-Chat\scripts\train_model.py:402:    onnx_parity = 0.0
MB-Chat\scripts\train_model.py:406:        sess = rt.InferenceSession(onnx_path)
MB-Chat\scripts\train_model.py:410:        onnx_pred = np.array(ox_out[0]).reshape(-1)
MB-Chat\scripts\train_model.py:411:        onnx_parity = float((onnx_pred == sk_pred).mean())
MB-Chat\scripts\train_model.py:412:        checks['onnx_parity'] = onnx_parity == 1.0
MB-Chat\scripts\train_model.py:414:            f"  [{'PASS' if checks['onnx_parity'] else 'FAIL'}] "
MB-Chat\scripts\train_model.py:415:            f"onnx_parity={onnx_parity:.4f} (required == 1.0)"
MB-Chat\scripts\train_model.py:418:        checks['onnx_parity'] = False
MB-Chat\scripts\train_model.py:419:        details.append(f"  [FAIL] onnx_parity=ERROR ({exc})")
MB-Chat\scripts\train_model.py:425:        'onnx_parity': onnx_parity,
MB-Chat\scripts\train_model.py:468:def export_onnx_metadata(X_train, calibration_payload=None, decision_thresholds=None, top_features_global=None):
MB-Chat\scripts\train_model.py:469:    """Export ONNX runtime metadata for Node.js inference consistency."""
MB-Chat\scripts\train_model.py:475:    metadata_out_path = 'models/onnx_metadata.json'
MB-Chat\scripts\train_model.py:513:    for col in X_train.columns:
MB-Chat\scripts\train_model.py:514:        series = X_train[col]
MB-Chat\scripts\train_model.py:530:    onnx_metadata = {
MB-Chat\scripts\train_model.py:537:        'num_features': int(X_train.shape[1]),
MB-Chat\scripts\train_model.py:548:        json.dump(onnx_metadata, f, indent=2)
MB-Chat\scripts\train_model.py:551:    print('Saved: models/onnx_metadata.json')
MB-Chat\scripts\train_model.py:560:        'num_features': int(X_train.shape[1]),
MB-Chat\scripts\train_model.py:563:def train_model():
MB-Chat\scripts\train_model.py:565:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\scripts\train_model.py:566:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Chat\scripts\train_model.py:572:    enforce_dataset_gate(y_train, y_val, y_test)
MB-Chat\scripts\train_model.py:575:    print(f"MetaBrain ML Model Training - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
MB-Chat\scripts\train_model.py:577:    print(f"Dataset Info:")
MB-Chat\scripts\train_model.py:578:    print(f"  Train size: {X_train.shape[0]} samples, {X_train.shape[1]} features")
MB-Chat\scripts\train_model.py:581:    print(f"  Classes: {len(np.unique(y_train))}")
MB-Chat\scripts\train_model.py:582:    print(f"  Class distribution (train): {np.bincount(y_train.astype(int))}")
MB-Chat\scripts\train_model.py:585:    # Train model
MB-Chat\scripts\train_model.py:586:    print("Training RandomForestClassifier...")
MB-Chat\scripts\train_model.py:588:    model.fit(X_train, y_train)
MB-Chat\scripts\train_model.py:589:    print("[OK] Model trained\n")
MB-Chat\scripts\train_model.py:591:    # === TRAINING SET EVALUATION ===
MB-Chat\scripts\train_model.py:593:    print("TRAINING SET METRICS")
MB-Chat\scripts\train_model.py:595:    y_train_pred = model.predict(X_train)
MB-Chat\scripts\train_model.py:596:    train_accuracy = accuracy_score(y_train, y_train_pred)
MB-Chat\scripts\train_model.py:597:    train_precision = precision_score(y_train, y_train_pred, average='weighted', zero_division=0)
MB-Chat\scripts\train_model.py:598:    train_recall = recall_score(y_train, y_train_pred, average='weighted', zero_division=0)
MB-Chat\scripts\train_model.py:599:    train_f1 = f1_score(y_train, y_train_pred, average='weighted', zero_division=0)
MB-Chat\scripts\train_model.py:601:    print(f"Accuracy:  {train_accuracy:.4f}")
MB-Chat\scripts\train_model.py:602:    print(f"Precision: {train_precision:.4f}")
MB-Chat\scripts\train_model.py:603:    print(f"Recall:    {train_recall:.4f}")
MB-Chat\scripts\train_model.py:604:    print(f"F1-Score:  {train_f1:.4f}\n")
MB-Chat\scripts\train_model.py:626:    cv_folds, min_samples_per_class = select_cv_folds(y_train)
MB-Chat\scripts\train_model.py:652:        # Stratified K-Fold for imbalanced datasets
MB-Chat\scripts\train_model.py:654:        cv_results = cross_validate(model, X_train, y_train, cv=skf, scoring=scorers, n_jobs=-1)
MB-Chat\scripts\train_model.py:713:    class_count = len(np.unique(y_train))
MB-Chat\scripts\train_model.py:876:    overfitting_score = calculate_overfitting_score(train_accuracy, test_accuracy)
MB-Chat\scripts\train_model.py:878:    print(f"Train Accuracy: {train_accuracy:.4f}")
MB-Chat\scripts\train_model.py:943:        print("No previous model found - this is the first training")
MB-Chat\scripts\train_model.py:958:        # Convert to ONNX
MB-Chat\scripts\train_model.py:959:        initial_type = [('float_input', FloatTensorType([None, X_train.shape[1]]))]
MB-Chat\scripts\train_model.py:961:        with open('models/decision_model.onnx', 'wb') as f:
MB-Chat\scripts\train_model.py:963:        print("[OK] Saved: models/decision_model.onnx")
MB-Chat\scripts\train_model.py:965:        # Export runtime metadata for Node.js ONNX inference
MB-Chat\scripts\train_model.py:967:            model, list(X_train.columns), top_n=10
MB-Chat\scripts\train_model.py:969:        schema_info = export_onnx_metadata(
MB-Chat\scripts\train_model.py:970:            X_train,
MB-Chat\scripts\train_model.py:988:            'train_accuracy': float(train_accuracy),
MB-Chat\scripts\train_model.py:989:            'train_precision': float(train_precision),
MB-Chat\scripts\train_model.py:990:            'train_recall': float(train_recall),
MB-Chat\scripts\train_model.py:991:            'train_f1': float(train_f1),
MB-Chat\scripts\train_model.py:1015:            'num_features': int(X_train.shape[1]),
MB-Chat\scripts\train_model.py:1022:            'num_train_samples': int(X_train.shape[0]),
MB-Chat\scripts\train_model.py:1074:            'onnx_parity': gate_result['onnx_parity'],
MB-Chat\scripts\train_model.py:1085:            print(f"[DEPLOYMENT BLOCKED] Artifacts saved for inspection but NOT registered.")
MB-Chat\scripts\train_model.py:1087:            print(f"\n[OK] Model saved successfully (blocked from registry)\n")
MB-Chat\scripts\train_model.py:1093:        # === REGISTER WITH MODEL REGISTRY ===
MB-Chat\scripts\train_model.py:1095:        print("MODEL REGISTRY")
MB-Chat\scripts\train_model.py:1099:            registry = ModelRegistry('models/registry.json')
MB-Chat\scripts\train_model.py:1100:            version = registry.register_model(
MB-Chat\scripts\train_model.py:1102:                notes="Automatic training with validation"
MB-Chat\scripts\train_model.py:1110:            comparator = ModelComparison('models/registry.json')
MB-Chat\scripts\train_model.py:1122:            print("TRAINING SUMMARY")
MB-Chat\scripts\train_model.py:1124:            registry.print_summary()
MB-Chat\scripts\train_model.py:1125:            registry.print_history()
MB-Chat\scripts\train_model.py:1128:            print(f"⚠ Registry error: {e}")
MB-Chat\scripts\train_model.py:1137:    train_model()
MB-Chat\providers_py\__init__.py:5:from .provider_registry import ProviderRegistry
MB-Chat\providers_py\__init__.py:15:    "ProviderRegistry",
MB-Chat\scripts\traffic_shadow_real_check.py:118:    metadata_path = MODELS_DIR / "onnx_metadata.json"
MB-Chat\production-safety\rollback-registry.ts:1:import type { ProductionLayer, RollbackRegistryEntry } from "./types";
MB-Chat\production-safety\rollback-registry.ts:3:export function buildRollbackRegistry(): RollbackRegistryEntry[] {
MB-Chat\production-safety\rollback-registry.ts:5:    entry("semantic_memory", "MEMORY_ROLLBACK_PLAN.md", ["MetaBrain/memory", "MetaBrain/memory_py"], ["SEMANTIC_MEMORY_ENABLED", "SEMANTIC_MEMORY_WRITE_ENABLED", "SEMANTIC_MEMORY_VECTOR_ENABLED"]),
MB-Chat\production-safety\rollback-registry.ts:15:function entry(layer: ProductionLayer, rollback_doc: string, files_created: string[], flags_to_disable: string[]): RollbackRegistryEntry {
MB-Chat\providers_py\types.py:9:ProviderRequestType = Literal["chat", "completion", "embedding", "vision", "multimodal", "healthcheck"]
MB-Chat\production-safety\index.ts:8:export * from "./rollback-registry";
MB-Chat\production_safety_py\safety_report.py:4:from .rollback_registry import build_rollback_registry
MB-Chat\production_safety_py\safety_report.py:13:        "rollback_registry": build_rollback_registry(),
MB-Chat\src\ai\providers\groq.provider.ts:56:    'Tu funcion es auditar el uso correcto, la indicacion adecuada y las contraindicaciones de los medicamentos prescritos.',
MB-Chat\src\ai\providers\groq.provider.ts:64:    'Si el farmaco esta contraindicado para sus enfermedades de base, es inapropiado para su grupo de edad (ej. criterios de Beers en adultos mayores) o duplica otro mecanismo activo, emite bloqueo inmediato.',
MB-Chat\production-safety\safety-report.ts:1:import { buildRollbackRegistry } from "./rollback-registry";
MB-Chat\production-safety\safety-report.ts:9:    rollback_registry: buildRollbackRegistry(),
MB-Chat\production-safety\README.md:27:- Rollback registry.
MB-Chat\production_safety_py\rollback_registry.py:1:from .types import RollbackRegistryEntry
MB-Chat\production_safety_py\rollback_registry.py:4:def build_rollback_registry() -> list[RollbackRegistryEntry]:
MB-Chat\production_safety_py\rollback_registry.py:6:        _entry("semantic_memory", "MEMORY_ROLLBACK_PLAN.md", ["MetaBrain/memory", "MetaBrain/memory_py"], ["SEMANTIC_MEMORY_ENABLED", "SEMANTIC_MEMORY_WRITE_ENABLED", "SEMANTIC_MEMORY_VECTOR_ENABLED"]),
MB-Chat\production_safety_py\rollback_registry.py:16:def _entry(layer, rollback_doc: str, files_created: list[str], flags_to_disable: list[str]) -> RollbackRegistryEntry:
MB-Chat\production_safety_py\rollback_registry.py:17:    return RollbackRegistryEntry(layer, rollback_doc, files_created, [], flags_to_disable, ["keep_global_kill_switch_enabled", "do_not_delete_runtime_data", "do_not_restart_services_for_documentation_only"])
MB-Chat\production-safety\types.ts:57:export type RollbackRegistryEntry = {
MB-Chat\providers_py\provider_registry.py:6:class ProviderRegistry:
MB-Chat\providers\index.ts:13:export * from "./provider-registry";
MB-Chat\providers\provider-registry.ts:3:export class ProviderRegistry {
MB-Chat\providers\types.d.ts:2:export type ProviderRequestType = "chat" | "completion" | "embedding" | "vision" | "multimodal" | "healthcheck";
MB-Chat\providers\types.ts:2:export type ProviderRequestType = "chat" | "completion" | "embedding" | "vision" | "multimodal" | "healthcheck";

```
## Isolation actions
```
Redirect brain semantic index artifacts out of repo to E:\GSentinelRuntime\ml\vectorstore\semantic_index.
Replace ./MB-Chat/data bind mounts used for runtime learning artifacts with E:\GSentinelRuntime\artifacts\mb-chat-learning.
Redirect MB-Chat cerebro_ai_med model artifacts to E:\GSentinelRuntime\ml\checkpoints\cerebro_ai_med.
Redirect MB-Whatsapp dataset/training outputs to E:\GSentinelRuntime\ml\datasets\mb-whatsapp.
Keep source code mounts read-only; keep only runtime ML paths writable.

```
