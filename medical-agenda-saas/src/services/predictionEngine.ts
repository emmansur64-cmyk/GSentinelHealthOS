import { prisma } from "@/lib/prisma";
import { logServer, logServerError } from "@/lib/server-logger";
import { observeNoShowPrediction } from "@/lib/observability/metrics";
import {
  inferNoShowProbability,
  getOnnxModelVersion,
  type OnnxNoShowFeatures,
} from "@/lib/ml/onnx-inference";

type EntityType = "patient" | "doctor" | "specialty";

export type RiskLevel = "bajo" | "medio" | "alto";

export type PredictionContext = {
  appointmentId: string | null;
  patientId: string | null;
  doctorId: string;
  specialty: string;
  appointmentDateTime: Date;
  createdAt: Date;
  status?: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";
};

export type NoShowPrediction = {
  probability: number;
  riskLevel: RiskLevel;
  modelVersion: string;
  features: {
    dayOfWeek: number;
    hourOfDay: number;
    leadTimeDays: number;
    dayBucket: "weekday" | "weekend";
    timeBucket: "manana" | "tarde" | "noche";
    patientNoShowRate: number;
    patientSampleSize: number;
    doctorNoShowRate: number;
    doctorSampleSize: number;
    specialtyNoShowRate: number;
    specialtySampleSize: number;
    globalNoShowRate: number;
    isConfirmed: boolean;
  };
};

type EntityScoreRow = {
  no_show_rate: number;
  sample_size: number;
};

type StatsWindow = {
  noShowRate: number;
  sampleSize: number;
};

const SCORE_LOOKBACK_DAYS = 180;
const LEAD_CAP_DAYS = 45;
const EPSILON = 1e-9;

let ensureTablesPromise: Promise<void> | null = null;

function clamp(value: number, min = 0, max = 1): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function riskLevelFromProbability(probability: number): RiskLevel {
  if (probability >= getHighRiskThreshold()) return "alto";
  if (probability >= 0.45) return "medio";
  return "bajo";
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return value;
}

export function getHighRiskThreshold(): number {
  return clamp(parseNumberEnv("PREDICTION_HIGH_RISK_THRESHOLD", 0.7), 0.4, 0.95);
}

export function isOverbookingEnabled(): boolean {
  return (process.env.PREDICTION_OVERBOOKING_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

export function getOverbookingMaxConcurrent(): number {
  const value = Math.floor(parseNumberEnv("PREDICTION_OVERBOOKING_MAX_CONCURRENT", 2));
  return Math.max(2, value);
}

export async function ensurePredictionTables(): Promise<void> {
  if (ensureTablesPromise) {
    await ensureTablesPromise;
    return;
  }

  ensureTablesPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS prediction_entity_scores (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        no_show_rate DOUBLE PRECISION NOT NULL,
        sample_size INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (entity_type, entity_id)
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS prediction_observations (
        appointment_id UUID PRIMARY KEY,
        predicted_probability DOUBLE PRECISION NOT NULL,
        risk_level TEXT NOT NULL,
        model_version TEXT NOT NULL,
        features JSONB NOT NULL,
        outcome_no_show BOOLEAN,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS prediction_daily_metrics (
        metric_date DATE PRIMARY KEY,
        total_predictions INTEGER NOT NULL,
        resolved_predictions INTEGER NOT NULL,
        accuracy DOUBLE PRECISION,
        brier_score DOUBLE PRECISION,
        no_show_rate DOUBLE PRECISION,
        occupancy_rate DOUBLE PRECISION,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_prediction_observations_created_at ON prediction_observations (created_at DESC);",
    );
    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_prediction_observations_resolved_at ON prediction_observations (resolved_at DESC);",
    );
    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_prediction_entity_scores_entity_type ON prediction_entity_scores (entity_type, no_show_rate);",
    );
  })();

  await ensureTablesPromise;
}

async function getEntityScore(entityType: EntityType, entityId: string | null): Promise<EntityScoreRow | null> {
  if (!entityId) return null;

  const rows = await prisma.$queryRaw<EntityScoreRow[]>`
    SELECT no_show_rate, sample_size
    FROM prediction_entity_scores
    WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getGlobalNoShowRate(referenceDate: Date): Promise<number> {
  const fromDate = new Date(referenceDate.getTime() - SCORE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<Array<{ no_show_rate: number | null }>>`
    SELECT
      COALESCE(
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END)::double precision
        /
        NULLIF(SUM(CASE WHEN status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::double precision, 0),
        0.18
      ) AS no_show_rate
    FROM appointments
    WHERE deleted_at IS NULL
      AND datetime >= ${fromDate}
      AND datetime < ${referenceDate}
  `;

  const value = Number(rows[0]?.no_show_rate ?? 0.18);
  return clamp(value, 0.02, 0.8);
}

async function getEntityStatsFallback(
  entityType: EntityType,
  entityId: string | null,
  referenceDate: Date,
): Promise<StatsWindow | null> {
  if (!entityId) return null;

  const fromDate = new Date(referenceDate.getTime() - SCORE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  if (entityType === "specialty") {
    const rows = await prisma.$queryRaw<Array<{ no_show_rate: number; sample_size: number }>>`
      SELECT
        COALESCE(
          SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END)::double precision
          /
          NULLIF(SUM(CASE WHEN a.status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::double precision, 0),
          0.18
        ) AS no_show_rate,
        SUM(CASE WHEN a.status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::int AS sample_size
      FROM appointments a
      INNER JOIN doctor_profiles d ON d.user_id = a.doctor_id
      WHERE a.deleted_at IS NULL
        AND a.datetime >= ${fromDate}
        AND a.datetime < ${referenceDate}
        AND d.specialty = ${entityId}
    `;

    const row = rows[0];
    if (!row) return null;
    return {
      noShowRate: clamp(Number(row.no_show_rate ?? 0.18), 0.01, 0.95),
      sampleSize: Math.max(0, Number(row.sample_size ?? 0)),
    };
  }

  const column = entityType === "patient" ? "patient_id" : "doctor_id";
  const rows = await prisma.$queryRawUnsafe<Array<{ no_show_rate: number; sample_size: number }>>(
    `
      SELECT
        COALESCE(
          SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END)::double precision
          /
          NULLIF(SUM(CASE WHEN status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::double precision, 0),
          0.18
        ) AS no_show_rate,
        SUM(CASE WHEN status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::int AS sample_size
      FROM appointments
      WHERE deleted_at IS NULL
        AND datetime >= $1
        AND datetime < $2
        AND ${column} = $3
    `,
    fromDate,
    referenceDate,
    entityId,
  );

  const row = rows[0];
  if (!row) return null;
  return {
    noShowRate: clamp(Number(row.no_show_rate ?? 0.18), 0.01, 0.95),
    sampleSize: Math.max(0, Number(row.sample_size ?? 0)),
  };
}

function reliabilityWeight(sampleSize: number): number {
  return clamp(sampleSize / 20, 0.05, 1);
}

function deriveTimeBucket(hour: number): "manana" | "tarde" | "noche" {
  if (hour < 12) return "manana";
  if (hour < 18) return "tarde";
  return "noche";
}

function blendRate(entityRate: number, entitySample: number, globalRate: number): number {
  const weight = reliabilityWeight(entitySample);
  return clamp(weight * entityRate + (1 - weight) * globalRate, 0.01, 0.95);
}

/** Regresión logística heurística — se usa como fallback cuando el modelo ONNX no está disponible. */
function buildNoShowProbabilityHeuristic(features: NoShowPrediction["features"]): number {
  const weekend = features.dayBucket === "weekend" ? 1 : 0;
  const morning = features.timeBucket === "manana" ? 1 : 0;
  const night = features.timeBucket === "noche" ? 1 : 0;

  const leadNorm = Math.min(features.leadTimeDays, LEAD_CAP_DAYS) / LEAD_CAP_DAYS;

  const z =
    -1.25 +
    2.7 * features.patientNoShowRate +
    1.45 * features.doctorNoShowRate +
    0.75 * features.specialtyNoShowRate +
    0.55 * weekend +
    0.25 * morning +
    0.35 * night +
    0.9 * leadNorm +
    (features.isConfirmed ? -0.65 : 0);

  return clamp(sigmoid(z), 0.01, 0.99);
}

/**
 * Resuelve la probabilidad de no-show intentando primero el modelo ONNX.
 * Si el modelo no está disponible o falla, usa la heurística de respaldo.
 */
async function resolveNoShowProbability(
  features: NoShowPrediction["features"],
): Promise<number> {
  const onnxInput: OnnxNoShowFeatures = {
    patientNoShowRate: features.patientNoShowRate,
    doctorNoShowRate: features.doctorNoShowRate,
    specialtyNoShowRate: features.specialtyNoShowRate,
    leadTimeNorm: Math.min(features.leadTimeDays, LEAD_CAP_DAYS) / LEAD_CAP_DAYS,
    isWeekend: features.dayBucket === "weekend",
    isMorning: features.timeBucket === "manana",
    isNight: features.timeBucket === "noche",
    isConfirmed: features.isConfirmed,
  };

  const onnxProbability = await inferNoShowProbability(onnxInput);
  if (onnxProbability !== null) {
    return onnxProbability;
  }

  return buildNoShowProbabilityHeuristic(features);
}

async function getPatientIdFromDocument(document: string): Promise<string | null> {
  const compact = document.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  if (!compact) return null;

  const syntheticPhone = `pending-${compact}`;
  const patient = await prisma.patient.findFirst({
    where: { phone: syntheticPhone },
    select: { id: true },
  });

  return patient?.id ?? null;
}

async function buildPrediction(context: PredictionContext): Promise<NoShowPrediction> {
  await ensurePredictionTables();

  const patientScore = await getEntityScore("patient", context.patientId);
  const doctorScore = await getEntityScore("doctor", context.doctorId);
  const specialtyScore = await getEntityScore("specialty", context.specialty);

  const globalNoShowRate = await getGlobalNoShowRate(context.appointmentDateTime);

  const patientStatsFallback = patientScore
    ? null
    : await getEntityStatsFallback("patient", context.patientId, context.appointmentDateTime);
  const doctorStatsFallback = doctorScore
    ? null
    : await getEntityStatsFallback("doctor", context.doctorId, context.appointmentDateTime);
  const specialtyStatsFallback = specialtyScore
    ? null
    : await getEntityStatsFallback("specialty", context.specialty, context.appointmentDateTime);

  const patientNoShowRate = blendRate(
    clamp(Number(patientScore?.no_show_rate ?? patientStatsFallback?.noShowRate ?? globalNoShowRate), 0.01, 0.95),
    Number(patientScore?.sample_size ?? patientStatsFallback?.sampleSize ?? 0),
    globalNoShowRate,
  );

  const doctorNoShowRate = blendRate(
    clamp(Number(doctorScore?.no_show_rate ?? doctorStatsFallback?.noShowRate ?? globalNoShowRate), 0.01, 0.95),
    Number(doctorScore?.sample_size ?? doctorStatsFallback?.sampleSize ?? 0),
    globalNoShowRate,
  );

  const specialtyNoShowRate = blendRate(
    clamp(Number(specialtyScore?.no_show_rate ?? specialtyStatsFallback?.noShowRate ?? globalNoShowRate), 0.01, 0.95),
    Number(specialtyScore?.sample_size ?? specialtyStatsFallback?.sampleSize ?? 0),
    globalNoShowRate,
  );

  const leadTimeDays = Math.max(
    0,
    (context.appointmentDateTime.getTime() - context.createdAt.getTime()) / (24 * 60 * 60 * 1000),
  );

  const dayOfWeek = context.appointmentDateTime.getDay();
  const hourOfDay = context.appointmentDateTime.getHours();

  const features: NoShowPrediction["features"] = {
    dayOfWeek,
    hourOfDay,
    leadTimeDays,
    dayBucket: dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday",
    timeBucket: deriveTimeBucket(hourOfDay),
    patientNoShowRate,
    patientSampleSize: Number(patientScore?.sample_size ?? patientStatsFallback?.sampleSize ?? 0),
    doctorNoShowRate,
    doctorSampleSize: Number(doctorScore?.sample_size ?? doctorStatsFallback?.sampleSize ?? 0),
    specialtyNoShowRate,
    specialtySampleSize: Number(specialtyScore?.sample_size ?? specialtyStatsFallback?.sampleSize ?? 0),
    globalNoShowRate,
    isConfirmed: context.status === "confirmed",
  };

  const probability = await resolveNoShowProbability(features);
  const riskLevel = riskLevelFromProbability(probability);

  observeNoShowPrediction({
    source: context.appointmentId ? "appointment" : "slot",
    probability,
    riskLevel,
  });

  return {
    probability,
    riskLevel,
    modelVersion: getOnnxModelVersion(),
    features,
  };
}

export async function recordPredictionObservation(
  appointmentId: string,
  prediction: NoShowPrediction,
): Promise<void> {
  await ensurePredictionTables();

  await prisma.$executeRaw`
    INSERT INTO prediction_observations (
      appointment_id,
      predicted_probability,
      risk_level,
      model_version,
      features,
      created_at
    )
    VALUES (
      ${appointmentId}::uuid,
      ${prediction.probability},
      ${prediction.riskLevel},
      ${prediction.modelVersion},
      ${JSON.stringify(prediction.features)}::jsonb,
      now()
    )
    ON CONFLICT (appointment_id)
    DO UPDATE SET
      predicted_probability = EXCLUDED.predicted_probability,
      risk_level = EXCLUDED.risk_level,
      model_version = EXCLUDED.model_version,
      features = EXCLUDED.features
  `;
}

export async function predictNoShowByAppointmentId(appointmentId: string): Promise<NoShowPrediction> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      patient_id: true,
      doctor_id: true,
      datetime: true,
      created_at: true,
      status: true,
      doctor: {
        select: {
          specialty: true,
        },
      },
    },
  });

  if (!appointment || appointment.status === "cancelled") {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const prediction = await buildPrediction({
    appointmentId: appointment.id,
    patientId: appointment.patient_id,
    doctorId: appointment.doctor_id,
    specialty: appointment.doctor.specialty,
    appointmentDateTime: appointment.datetime,
    createdAt: appointment.created_at,
    status: appointment.status,
  });

  await recordPredictionObservation(appointment.id, prediction);

  return prediction;
}

export async function predictNoShowForSlot(input: {
  doctorId: string;
  specialty: string;
  appointmentDateTime: Date;
  createdAt?: Date;
  patientDocument?: string;
}): Promise<NoShowPrediction> {
  const patientId = input.patientDocument
    ? await getPatientIdFromDocument(input.patientDocument)
    : null;

  return buildPrediction({
    appointmentId: null,
    patientId,
    doctorId: input.doctorId,
    specialty: input.specialty,
    appointmentDateTime: input.appointmentDateTime,
    createdAt: input.createdAt ?? new Date(),
    status: "scheduled",
  });
}

export async function getNoShowDataset(input?: {
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<Array<{
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  specialty: string;
  status: string;
  day_of_week: number;
  hour_of_day: number;
  lead_time_days: number;
  created_at: Date;
  datetime: Date;
}>> {
  const from = input?.from ?? new Date(Date.now() - SCORE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const to = input?.to ?? new Date();
  const limit = Math.max(100, Math.min(input?.limit ?? 25000, 100000));

  const rows = await prisma.$queryRaw<Array<{
    appointment_id: string;
    doctor_id: string;
    patient_id: string;
    specialty: string;
    status: string;
    day_of_week: number;
    hour_of_day: number;
    lead_time_days: number;
    created_at: Date;
    datetime: Date;
  }>>`
    SELECT
      a.id AS appointment_id,
      a.doctor_id,
      a.patient_id,
      d.specialty,
      a.status::text AS status,
      EXTRACT(DOW FROM a.datetime)::int AS day_of_week,
      EXTRACT(HOUR FROM a.datetime)::int AS hour_of_day,
      GREATEST(EXTRACT(EPOCH FROM (a.datetime - a.created_at)) / 86400.0, 0)::double precision AS lead_time_days,
      a.created_at,
      a.datetime
    FROM appointments a
    INNER JOIN doctor_profiles d ON d.user_id = a.doctor_id
    WHERE a.deleted_at IS NULL
      AND a.datetime >= ${from}
      AND a.datetime <= ${to}
      AND a.status IN ('completed', 'no_show', 'cancelled', 'confirmed', 'scheduled')
    ORDER BY a.datetime DESC
    LIMIT ${limit}
  `;

  return rows;
}

export async function recomputeEntityScores(): Promise<{
  patients: number;
  doctors: number;
  specialties: number;
}> {
  await ensurePredictionTables();

  const fromDate = new Date(Date.now() - SCORE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$executeRaw`
    WITH patient_scores AS (
      SELECT
        'patient'::text AS entity_type,
        patient_id::text AS entity_id,
        COALESCE(
          SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END)::double precision
          /
          NULLIF(SUM(CASE WHEN status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::double precision, 0),
          0.18
        ) AS no_show_rate,
        SUM(CASE WHEN status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::int AS sample_size
      FROM appointments
      WHERE deleted_at IS NULL
        AND datetime >= ${fromDate}
      GROUP BY patient_id
    ),
    doctor_scores AS (
      SELECT
        'doctor'::text AS entity_type,
        doctor_id::text AS entity_id,
        COALESCE(
          SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END)::double precision
          /
          NULLIF(SUM(CASE WHEN status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::double precision, 0),
          0.18
        ) AS no_show_rate,
        SUM(CASE WHEN status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::int AS sample_size
      FROM appointments
      WHERE deleted_at IS NULL
        AND datetime >= ${fromDate}
      GROUP BY doctor_id
    ),
    specialty_scores AS (
      SELECT
        'specialty'::text AS entity_type,
        d.specialty::text AS entity_id,
        COALESCE(
          SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END)::double precision
          /
          NULLIF(SUM(CASE WHEN a.status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::double precision, 0),
          0.18
        ) AS no_show_rate,
        SUM(CASE WHEN a.status IN ('completed', 'no_show') THEN 1 ELSE 0 END)::int AS sample_size
      FROM appointments a
      INNER JOIN doctor_profiles d ON d.user_id = a.doctor_id
      WHERE a.deleted_at IS NULL
        AND a.datetime >= ${fromDate}
      GROUP BY d.specialty
    ),
    all_scores AS (
      SELECT * FROM patient_scores
      UNION ALL
      SELECT * FROM doctor_scores
      UNION ALL
      SELECT * FROM specialty_scores
    )
    INSERT INTO prediction_entity_scores (entity_type, entity_id, no_show_rate, sample_size, updated_at)
    SELECT
      entity_type,
      entity_id,
      LEAST(GREATEST(no_show_rate, 0.01), 0.95),
      GREATEST(sample_size, 0),
      now()
    FROM all_scores
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
      no_show_rate = EXCLUDED.no_show_rate,
      sample_size = EXCLUDED.sample_size,
      updated_at = now()
  `;

  const summary = await prisma.$queryRaw<Array<{ entity_type: string; total: number }>>`
    SELECT entity_type, COUNT(*)::int AS total
    FROM prediction_entity_scores
    GROUP BY entity_type
  `;

  const mapped = new Map(summary.map((item) => [item.entity_type, Number(item.total)]));

  return {
    patients: mapped.get("patient") ?? 0,
    doctors: mapped.get("doctor") ?? 0,
    specialties: mapped.get("specialty") ?? 0,
  };
}

export async function resolvePredictionOutcomes(): Promise<{ resolved: number }> {
  await ensurePredictionTables();

  const rows = await prisma.$queryRaw<Array<{ appointment_id: string; status: string }>>`
    SELECT o.appointment_id::text AS appointment_id, a.status::text AS status
    FROM prediction_observations o
    INNER JOIN appointments a ON a.id = o.appointment_id
    WHERE o.outcome_no_show IS NULL
      AND a.status IN ('completed', 'no_show', 'cancelled')
  `;

  if (rows.length === 0) {
    return { resolved: 0 };
  }

  let resolved = 0;

  for (const row of rows) {
    const outcomeNoShow = row.status === "no_show";
    await prisma.$executeRaw`
      UPDATE prediction_observations
      SET outcome_no_show = ${outcomeNoShow},
          resolved_at = now()
      WHERE appointment_id = ${row.appointment_id}::uuid
    `;
    resolved += 1;
  }

  return { resolved };
}

export async function recalculateDailyMetrics(referenceDate = new Date()): Promise<void> {
  await ensurePredictionTables();

  const metricDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  const nextDate = new Date(metricDate.getTime() + 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<Array<{
    total_predictions: number;
    resolved_predictions: number;
    accuracy: number | null;
    brier_score: number | null;
    no_show_rate: number | null;
  }>>`
    SELECT
      COUNT(*)::int AS total_predictions,
      SUM(CASE WHEN outcome_no_show IS NOT NULL THEN 1 ELSE 0 END)::int AS resolved_predictions,
      CASE
        WHEN SUM(CASE WHEN outcome_no_show IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN NULL
        ELSE AVG(
          CASE
            WHEN outcome_no_show IS NOT NULL AND ((predicted_probability >= ${getHighRiskThreshold()}) = outcome_no_show)
              THEN 1.0
            WHEN outcome_no_show IS NOT NULL THEN 0.0
            ELSE NULL
          END
        )
      END AS accuracy,
      CASE
        WHEN SUM(CASE WHEN outcome_no_show IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN NULL
        ELSE AVG(
          CASE
            WHEN outcome_no_show IS NOT NULL THEN
              POWER(predicted_probability - CASE WHEN outcome_no_show THEN 1 ELSE 0 END, 2)
            ELSE NULL
          END
        )
      END AS brier_score,
      AVG(CASE WHEN outcome_no_show IS NOT NULL THEN CASE WHEN outcome_no_show THEN 1 ELSE 0 END ELSE NULL END) AS no_show_rate
    FROM prediction_observations
    WHERE created_at >= ${metricDate}
      AND created_at < ${nextDate}
  `;

  const occupancyRows = await prisma.$queryRaw<Array<{ occupancy_rate: number | null }>>`
    SELECT
      COALESCE(
        SUM(CASE WHEN status IN ('completed', 'confirmed', 'scheduled') THEN duration ELSE 0 END)::double precision
        /
        NULLIF(SUM(CASE WHEN status IN ('completed', 'confirmed', 'scheduled', 'no_show') THEN duration ELSE 0 END)::double precision, 0),
        NULL
      ) AS occupancy_rate
    FROM appointments
    WHERE deleted_at IS NULL
      AND datetime >= ${metricDate}
      AND datetime < ${nextDate}
  `;

  const metrics = rows[0] ?? {
    total_predictions: 0,
    resolved_predictions: 0,
    accuracy: null,
    brier_score: null,
    no_show_rate: null,
  };

  await prisma.$executeRaw`
    INSERT INTO prediction_daily_metrics (
      metric_date,
      total_predictions,
      resolved_predictions,
      accuracy,
      brier_score,
      no_show_rate,
      occupancy_rate,
      updated_at
    )
    VALUES (
      ${metricDate},
      ${Math.max(0, Number(metrics.total_predictions ?? 0))},
      ${Math.max(0, Number(metrics.resolved_predictions ?? 0))},
      ${metrics.accuracy === null ? null : Number(metrics.accuracy)},
      ${metrics.brier_score === null ? null : Number(metrics.brier_score)},
      ${metrics.no_show_rate === null ? null : Number(metrics.no_show_rate)},
      ${occupancyRows[0]?.occupancy_rate === null || occupancyRows[0]?.occupancy_rate === undefined
        ? null
        : Number(occupancyRows[0].occupancy_rate)},
      now()
    )
    ON CONFLICT (metric_date)
    DO UPDATE SET
      total_predictions = EXCLUDED.total_predictions,
      resolved_predictions = EXCLUDED.resolved_predictions,
      accuracy = EXCLUDED.accuracy,
      brier_score = EXCLUDED.brier_score,
      no_show_rate = EXCLUDED.no_show_rate,
      occupancy_rate = EXCLUDED.occupancy_rate,
      updated_at = now()
  `;
}

export async function runPredictionMetricsRecalculation(): Promise<{
  scoreSummary: { patients: number; doctors: number; specialties: number };
  resolved: number;
}> {
  try {
    const scoreSummary = await recomputeEntityScores();
    const { resolved } = await resolvePredictionOutcomes();
    await recalculateDailyMetrics(new Date());

    logServer("info", "prediction.recalculation.completed", {
      model_version: getOnnxModelVersion(),
      patients: scoreSummary.patients,
      doctors: scoreSummary.doctors,
      specialties: scoreSummary.specialties,
      resolved_observations: resolved,
    });

    return { scoreSummary, resolved };
  } catch (error) {
    logServerError("prediction.recalculation.failed", error, {
      model_version: getOnnxModelVersion(),
    });
    throw error;
  }
}

export async function getDoctorScoreSnapshot(input?: {
  specialty?: string;
  limit?: number;
}): Promise<Array<{
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  no_show_rate: number;
  sample_size: number;
}>> {
  await ensurePredictionTables();

  const limit = Math.max(1, Math.min(input?.limit ?? 20, 100));

  const rows = await prisma.$queryRaw<Array<{
    doctor_id: string;
    doctor_name: string;
    specialty: string;
    no_show_rate: number;
    sample_size: number;
  }>>`
    SELECT
      d.user_id AS doctor_id,
      u.name AS doctor_name,
      d.specialty,
      COALESCE(s.no_show_rate, 0.18) AS no_show_rate,
      COALESCE(s.sample_size, 0)::int AS sample_size
    FROM doctor_profiles d
    INNER JOIN users u ON u.id = d.user_id
    LEFT JOIN prediction_entity_scores s
      ON s.entity_type = 'doctor'
      AND s.entity_id = d.user_id
    WHERE (${input?.specialty ?? null}::text IS NULL OR d.specialty ILIKE ${`%${input?.specialty ?? ""}%`})
    ORDER BY COALESCE(s.no_show_rate, 0.18) ASC, COALESCE(s.sample_size, 0) DESC, u.name ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
    specialty: row.specialty,
    no_show_rate: clamp(Number(row.no_show_rate), EPSILON, 1 - EPSILON),
    sample_size: Number(row.sample_size),
  }));
}
