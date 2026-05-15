import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  evaluateAgendaWriteAuthority,
} from "@/lib/agenda-api-authority";
import {
  createAppointmentViaAgendaApi,
  validateAvailabilityViaAgendaApi,
} from "@/lib/agenda-api-client";

describe("agenda api authority guards", () => {
  beforeEach(() => {
    process.env.AGENDA_API_ALLOW_LEGACY_WRITE_BYPASS = "false";
  });

  afterEach(() => {
    delete process.env.AGENDA_API_ALLOW_LEGACY_WRITE_BYPASS;
  });

  it("bloquea appointment.write fuera de Agenda API", () => {
    const result = evaluateAgendaWriteAuthority({
      operation: "appointment.create",
      assistantMode: "appointment_booking",
      viaAgendaApi: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("agenda_api_authority_enforced");
  });

  it("permite assistant_mode appointment_booking via Agenda API", () => {
    const result = evaluateAgendaWriteAuthority({
      operation: "appointment.create",
      assistantMode: "appointment_booking",
      viaAgendaApi: true,
    });

    expect(result.allowed).toBe(true);
  });

  it("bloquea doctor_professional para writes de agenda", () => {
    const result = evaluateAgendaWriteAuthority({
      operation: "appointment.create",
      assistantMode: "doctor_professional",
      viaAgendaApi: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("doctor_professional");
  });
});

describe("agenda api client", () => {
  const originalFetch = global.fetch;
  const originalGatewayKey = process.env.GATEWAY_API_KEY;
  const originalInternalKey = process.env.INTERNAL_SERVICES_KEY;

  beforeEach(() => {
    process.env.GATEWAY_API_KEY = "test-gateway-key";
    process.env.INTERNAL_SERVICES_KEY = "test-gateway-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    process.env.GATEWAY_API_KEY = originalGatewayKey;
    process.env.INTERNAL_SERVICES_KEY = originalInternalKey;
  });

  it("detecta fallo de scopes en Agenda API", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: "Scope requerido: appointments:create" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await createAppointmentViaAgendaApi({
      tenantId: "8cf4c1ab-7d2f-4cd2-8bc6-2a8ab4d4bb70",
      doctorId: "76870b80-ec3b-4e4a-88bf-f8f2f19f47c8",
      patientId: "07fa955c-9bca-4d55-860a-b0f0b656a6cc",
      dateTimeIso: new Date().toISOString(),
      durationMinutes: 30,
      idempotencyKey: "idem-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("Scope requerido");
  });

  it("resuelve availability lookup via Agenda API", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ available: true, message: "Disponible" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await validateAvailabilityViaAgendaApi({
      tenantId: "8cf4c1ab-7d2f-4cd2-8bc6-2a8ab4d4bb70",
      doctorId: "76870b80-ec3b-4e4a-88bf-f8f2f19f47c8",
      dateTimeIso: new Date().toISOString(),
    });

    expect(result.ok).toBe(true);
    expect(result.data?.available).toBe(true);
  });

  it("falla cerrado ante error de red", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const result = await createAppointmentViaAgendaApi({
      tenantId: "8cf4c1ab-7d2f-4cd2-8bc6-2a8ab4d4bb70",
      doctorId: "76870b80-ec3b-4e4a-88bf-f8f2f19f47c8",
      patientId: "07fa955c-9bca-4d55-860a-b0f0b656a6cc",
      dateTimeIso: new Date().toISOString(),
      durationMinutes: 30,
      idempotencyKey: "idem-2",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("agenda_api_unavailable");
  });
});
