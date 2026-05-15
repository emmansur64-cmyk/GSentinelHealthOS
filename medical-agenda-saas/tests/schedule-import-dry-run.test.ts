import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  validateScheduleImportDryRunPayload,
  type ScheduleImportDryRunResponse,
} from "@/lib/admin-schedule-import-dry-run";

const validPayload = {
  tenantId: "tenant-1",
  batchId: "batch-1",
  batchIdempotencyKey: "batch-idem-1",
  rows: [
    {
      rowNumber: 1,
      rowIdempotencyKey: "row-idem-1",
      doctorName: "Dra Ana Gomez",
      specialty: "Clinica",
      location: "Sede Centro",
      dayOfWeek: "lunes",
      startTime: "08:00",
      endTime: "12:00",
    },
  ],
  mode: "dry_run",
  apply: false,
  contractVersion: "mb-secretaria-import-v1",
};

describe("POST /admin/schedule-import/dry-run", () => {
  const originalEnv = { ...process.env };
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AGENDA_IMPORT_DRY_RUN_ENABLED;
    delete process.env.AGENDA_IMPORT_DRY_RUN_API_KEY;
    delete process.env.AGENDA_IMPORT_DRY_RUN_MAX_ROWS;
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rechaza cuando el endpoint esta apagado por defecto", async () => {
    const { POST } = await import("@/app/admin/schedule-import/dry-run/route");

    const response = await POST(buildRequest(validPayload, "test-key"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.wouldWrite).toBe(false);
  });

  it("rechaza sin x-internal-api-key", async () => {
    process.env.AGENDA_IMPORT_DRY_RUN_ENABLED = "true";
    process.env.AGENDA_IMPORT_DRY_RUN_API_KEY = "test-key";
    const { POST } = await import("@/app/admin/schedule-import/dry-run/route");

    const response = await POST(buildRequest(validPayload));

    expect(response.status).toBe(401);
  });

  it("rechaza API key invalida y no loguea la key recibida", async () => {
    process.env.AGENDA_IMPORT_DRY_RUN_ENABLED = "true";
    process.env.AGENDA_IMPORT_DRY_RUN_API_KEY = "test-key";
    const { POST } = await import("@/app/admin/schedule-import/dry-run/route");

    const response = await POST(buildRequest(validPayload, "bad-secret-key"));
    const logs = warnSpy.mock.calls.flat().join(" ");

    expect(response.status).toBe(401);
    expect(logs).not.toContain("bad-secret-key");
    expect(logs).not.toContain("test-key");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("acepta payload dry_run valido compatible con MB-Secretaria", async () => {
    process.env.AGENDA_IMPORT_DRY_RUN_ENABLED = "true";
    process.env.AGENDA_IMPORT_DRY_RUN_API_KEY = "test-key";
    const { POST } = await import("@/app/admin/schedule-import/dry-run/route");

    const response = await POST(buildRequest(validPayload, "test-key"));
    const body = (await response.json()) as ScheduleImportDryRunResponse;

    expect(response.status).toBe(200);
    expect(body.status).toBe("dry_run_ok");
    expect(body.apply).toBe(false);
    expect(body.wouldWrite).toBe(false);
    expect(body.tenantId).toBe(validPayload.tenantId);
    expect(body.batchId).toBe(validPayload.batchId);
    expect(body.batchIdempotencyKey).toBe(validPayload.batchIdempotencyKey);
    expect(body.summary).toEqual({
      receivedRows: 1,
      acceptedRows: 1,
      rejectedRows: 0,
      warnings: 0,
    });
    expect(body.rows[0]).toMatchObject({
      rowNumber: 1,
      rowIdempotencyKey: "row-idem-1",
      status: "accepted",
      errors: [],
      warnings: [],
    });
  });

  it("rechaza apply=true", () => {
    const result = validateScheduleImportDryRunPayload({ ...validPayload, apply: true });
    expect(result.ok).toBe(false);
    expect(result.response.wouldWrite).toBe(false);
  });

  it("rechaza mode distinto de dry_run", () => {
    const result = validateScheduleImportDryRunPayload({ ...validPayload, mode: "write" });
    expect(result.ok).toBe(false);
    expect(result.response.wouldWrite).toBe(false);
  });

  it("rechaza tenantId faltante", () => {
    const { tenantId: _tenantId, ...payload } = validPayload;
    const result = validateScheduleImportDryRunPayload(payload);
    expect(result.ok).toBe(false);
  });

  it("rechaza batchIdempotencyKey faltante", () => {
    const { batchIdempotencyKey: _batchIdempotencyKey, ...payload } = validPayload;
    const result = validateScheduleImportDryRunPayload(payload);
    expect(result.ok).toBe(false);
  });

  it("rechaza fila sin rowIdempotencyKey", () => {
    const result = validateScheduleImportDryRunPayload({
      ...validPayload,
      rows: [{ ...validPayload.rows[0], rowIdempotencyKey: "" }],
    });

    expect(result.ok).toBe(true);
    expect(result.response.summary.rejectedRows).toBe(1);
    expect(result.response.rows[0].status).toBe("rejected");
  });

  it("rechaza startTime >= endTime", () => {
    const result = validateScheduleImportDryRunPayload({
      ...validPayload,
      rows: [{ ...validPayload.rows[0], startTime: "12:00", endTime: "12:00" }],
    });

    expect(result.ok).toBe(true);
    expect(result.response.summary.rejectedRows).toBe(1);
    expect(result.response.rows[0].errors).toContain("startTime must be before endTime");
  });

  it("rechaza formato horario invalido", () => {
    const result = validateScheduleImportDryRunPayload({
      ...validPayload,
      rows: [{ ...validPayload.rows[0], startTime: "8am" }],
    });

    expect(result.ok).toBe(true);
    expect(result.response.summary.rejectedRows).toBe(1);
    expect(result.response.rows[0].status).toBe("rejected");
  });

  it("siempre responde wouldWrite=false", () => {
    const valid = validateScheduleImportDryRunPayload(validPayload);
    const invalid = validateScheduleImportDryRunPayload({ ...validPayload, apply: true });

    expect(valid.response.wouldWrite).toBe(false);
    expect(invalid.response.wouldWrite).toBe(false);
  });

  it("no contiene Prisma write ni raw SQL write en la implementacion dry-run", () => {
    const source = readDryRunSource();

    expect(source).not.toMatch(/prisma\.\w+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\b/i);
    expect(source).not.toMatch(/\$executeRaw|executeRaw|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM/i);
  });

  it("no importa Prisma ni crea turnos reales", () => {
    const source = readDryRunSource();

    expect(source).not.toContain("@/lib/prisma");
    expect(source).not.toMatch(/appointment\.(create|upsert|update|delete)\b/i);
  });
});

function buildRequest(payload: unknown, key?: string): Request {
  const headers: HeadersInit = { "content-type": "application/json" };
  if (key) headers["x-internal-api-key"] = key;
  return new Request("http://localhost/admin/schedule-import/dry-run", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

function readDryRunSource(): string {
  const files = [
    path.join(process.cwd(), "src", "app", "admin", "schedule-import", "dry-run", "route.ts"),
    path.join(process.cwd(), "src", "lib", "admin-schedule-import-dry-run.ts"),
  ];

  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}
