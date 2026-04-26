import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const DOCTOR_ID = Number(__ENV.DOCTOR_ID || 1);
const SLOT_DATE = __ENV.SLOT_DATE || "2026-04-05";
const SLOT_PICK_STRATEGY = (__ENV.SLOT_PICK_STRATEGY || "first").toLowerCase(); // first|random|same
const TARGET_SLOT_ID = __ENV.TARGET_SLOT_ID ? Number(__ENV.TARGET_SLOT_ID) : null;
const RANDOM_THINK_MIN = Number(__ENV.THINK_MIN_SECONDS || 0.1);
const RANDOM_THINK_MAX = Number(__ENV.THINK_MAX_SECONDS || 0.8);
const PATIENT_ID_BASE = Number(__ENV.PATIENT_ID_BASE || 100000);
const SUMMARY_PATH = __ENV.K6_SUMMARY_JSON || "artifacts/qa/k6_slot_booking_summary.json";

const bookingSuccess = new Counter("booking_success_total");
const bookingConflicts = new Counter("booking_conflicts_total");
const bookingServerErrors = new Counter("booking_server_errors_total");
const bookingClientErrors = new Counter("booking_client_errors_total");
const bookingUnexpectedStatuses = new Counter("booking_unexpected_status_total");
const flowSuccessRate = new Rate("flow_success_rate");
const flowDuration = new Trend("flow_duration_ms", true);
const availabilityDuration = new Trend("availability_duration_ms", true);
const bookingDuration = new Trend("booking_duration_ms", true);

function buildScenarioOptions() {
  const profile = (__ENV.K6_PROFILE || "100").toLowerCase();

  if (profile === "sweep") {
    return {
      scenarios: {
        slot_booking_sweep: {
          executor: "ramping-vus",
          startVUs: 20,
          stages: [
            { duration: "1m", target: 100 },
            { duration: "1m", target: 300 },
            { duration: "1m", target: 500 },
            { duration: "30s", target: 0 },
          ],
          gracefulRampDown: "10s",
        },
      },
    };
  }

  const vus = Math.max(1, Number(profile));
  const duration = __ENV.K6_DURATION || "2m";

  return {
    scenarios: {
      slot_booking_constant: {
        executor: "constant-vus",
        vus,
        duration,
      },
    },
  };
}

export const options = {
  ...buildScenarioOptions(),
  thresholds: {
    http_req_failed: ["rate<0.08"],
    http_req_duration: ["p(95)<1500", "p(99)<2500"],
    "http_req_duration{endpoint:availability}": ["p(95)<900", "p(99)<1500"],
    "http_req_duration{endpoint:booking}": ["p(95)<1200", "p(99)<2200"],
    flow_success_rate: ["rate>0.90"],
    flow_duration_ms: ["p(95)<2500", "p(99)<4000"],
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

function think() {
  const seconds = RANDOM_THINK_MIN + Math.random() * (RANDOM_THINK_MAX - RANDOM_THINK_MIN);
  sleep(Math.max(0, seconds));
}

function resolveSlotId(slots) {
  if (TARGET_SLOT_ID !== null) return TARGET_SLOT_ID;
  if (!Array.isArray(slots) || slots.length === 0) return null;

  if (SLOT_PICK_STRATEGY === "random") {
    const idx = Math.floor(Math.random() * slots.length);
    return slots[idx]?.id ?? null;
  }

  if (SLOT_PICK_STRATEGY === "same") {
    return slots[0]?.id ?? null;
  }

  return slots[0]?.id ?? null;
}

function buildPatientId() {
  return PATIENT_ID_BASE + (__VU * 100000) + __ITER;
}

export default function () {
  const flowStart = Date.now();

  // Step 1: Consultar disponibilidad
  const availableRes = http.get(
    `${BASE_URL}/api/v1/slots/available?doctor_id=${DOCTOR_ID}&date=${encodeURIComponent(SLOT_DATE)}`,
    { tags: { endpoint: "availability" } },
  );
  availabilityDuration.add(availableRes.timings.duration);

  const availableOk = check(availableRes, {
    "availability status is 200": (r) => r.status === 200,
  });

  if (!availableOk) {
    flowSuccessRate.add(false);
    flowDuration.add(Date.now() - flowStart);
    return;
  }

  let payload;
  try {
    payload = availableRes.json();
  } catch (_e) {
    flowSuccessRate.add(false);
    flowDuration.add(Date.now() - flowStart);
    return;
  }

  const slots = payload?.slots || [];
  const selectedSlotId = resolveSlotId(slots);
  if (!selectedSlotId) {
    flowSuccessRate.add(false);
    flowDuration.add(Date.now() - flowStart);
    return;
  }

  think();

  // Step 2 + 3: Seleccionar slot e intentar reservar
  const bookingBody = JSON.stringify({
    slot_id: selectedSlotId,
    patient_id: buildPatientId(),
    priority: "normal",
    allow_reassign: false,
  });

  const bookRes = http.post(
    `${BASE_URL}/api/v1/slots/book`,
    bookingBody,
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "booking" },
    },
  );
  bookingDuration.add(bookRes.timings.duration);

  if (bookRes.status === 200 || bookRes.status === 201) {
    bookingSuccess.add(1);
    flowSuccessRate.add(true);
  } else if (bookRes.status === 409) {
    bookingConflicts.add(1);
    flowSuccessRate.add(true);
  } else if (bookRes.status >= 500) {
    bookingServerErrors.add(1);
    flowSuccessRate.add(false);
  } else if (bookRes.status >= 400) {
    bookingClientErrors.add(1);
    flowSuccessRate.add(false);
  } else {
    bookingUnexpectedStatuses.add(1);
    flowSuccessRate.add(false);
  }

  check(bookRes, {
    "booking status valid": (r) => [200, 201, 409].includes(r.status),
  });

  flowDuration.add(Date.now() - flowStart);
  think();
}

function metricValue(metrics, name, field) {
  const metric = metrics?.[name]?.values || {};
  return metric[field] !== undefined ? metric[field] : null;
}

export function handleSummary(data) {
  const p95 = metricValue(data.metrics, "http_req_duration", "p(95)");
  const p99 = metricValue(data.metrics, "http_req_duration", "p(99)");
  const rps = metricValue(data.metrics, "http_reqs", "rate");
  const errorRate = metricValue(data.metrics, "http_req_failed", "rate");

  const slowEndpoints = [];
  const availP95 = metricValue(data.metrics, "http_req_duration{endpoint:availability}", "p(95)");
  const bookP95 = metricValue(data.metrics, "http_req_duration{endpoint:booking}", "p(95)");
  if (availP95 !== null && availP95 > 900) slowEndpoints.push("availability");
  if (bookP95 !== null && bookP95 > 1200) slowEndpoints.push("booking");

  const brief = {
    base_url: BASE_URL,
    doctor_id: DOCTOR_ID,
    slot_date: SLOT_DATE,
    slot_pick_strategy: SLOT_PICK_STRATEGY,
    target_slot_id: TARGET_SLOT_ID,
    k6_profile: __ENV.K6_PROFILE || "100",
    k6_duration: __ENV.K6_DURATION || "2m",
    throughput_rps: rps,
    latency_p95_ms: p95,
    latency_p99_ms: p99,
    error_rate: errorRate,
    slow_endpoints: slowEndpoints,
    bottleneck_hints: [
      ...(errorRate !== null && errorRate > 0.08 ? ["High error rate: investigate saturation, DB pool, lock contention"] : []),
      ...(p95 !== null && p95 > 1500 ? ["High p95 latency: inspect PostgreSQL slow queries and endpoint-level timings"] : []),
      ...(bookP95 !== null && bookP95 > 1200 ? ["Booking endpoint slower than target: review transactional locking and indexes"] : []),
    ],
  };

  return {
    stdout:
      `\n=== k6 Slot Booking Summary ===\n` +
      `Profile: ${brief.k6_profile} | Duration: ${brief.k6_duration}\n` +
      `RPS: ${brief.throughput_rps}\n` +
      `Latency p95/p99 (ms): ${brief.latency_p95_ms} / ${brief.latency_p99_ms}\n` +
      `Error rate: ${brief.error_rate}\n` +
      `Slow endpoints: ${brief.slow_endpoints.length ? brief.slow_endpoints.join(", ") : "none"}\n` +
      `Bottleneck hints: ${brief.bottleneck_hints.length ? brief.bottleneck_hints.join(" | ") : "none"}\n`,
    [SUMMARY_PATH]: JSON.stringify({ brief, raw: data }, null, 2),
  };
}
