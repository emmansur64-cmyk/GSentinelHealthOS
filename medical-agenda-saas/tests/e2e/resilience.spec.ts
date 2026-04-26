import "dotenv/config";

import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

type LoginResponse = {
  ok: boolean;
  data?: {
    id: string;
    role: "secretaria" | "doctor";
  };
  error?: { message?: string };
};

type DoctorListResponse = {
  ok: boolean;
  data: Array<{ user_id: string }>;
};

type CreatePatientResponse = {
  ok: boolean;
  data: { id: string; name: string; phone: string };
};

type CreateAppointmentResponse = {
  ok: boolean;
  data?: {
    id: string;
    doctor_id: string;
    datetime: string;
    duration: number;
  };
  error?: { message?: string };
};

function credential(name: string, fallbackName?: string, hardFallback?: string): string {
  const primary = process.env[name]?.trim();
  if (primary) return primary;

  const fallback = fallbackName ? process.env[fallbackName]?.trim() : undefined;
  if (fallback) return fallback;

  if (hardFallback?.trim()) return hardFallback;
  throw new Error(`Missing credential env var: ${name}${fallbackName ? ` (or ${fallbackName})` : ""}`);
}

const secretariaEmail = credential("E2E_SECRETARIA_EMAIL", "SEED_SECRETARIA_EMAIL", "secretaria@clinic.local");
const secretariaPassword = credential("E2E_SECRETARIA_PASSWORD", "SEED_SECRETARIA_PASSWORD", "ChangeMe123!");
const doctorEmail = credential("E2E_DOCTOR_EMAIL", "SEED_DOCTOR_EMAIL", "doctor@clinic.local");
const doctorPassword = credential("E2E_DOCTOR_PASSWORD", "SEED_DOCTOR_PASSWORD", "ChangeMe123!");
const BASE = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function loginApi(requestContext: APIRequestContext, email: string, password: string) {
  const loginRes = await requestContext.post("/api/auth/login", {
    data: { email, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  const payload = (await loginRes.json()) as LoginResponse;
  expect(payload.ok).toBeTruthy();
  expect(payload.data?.id).toBeTruthy();
}

test.describe("Resilience E2E", () => {
  test.skip(!hasDatabase, "Requiere DATABASE_URL para validar flujos reales con PostgreSQL.");

  test("retry en login UI ante 503 transitorio", async ({ page }) => {
    let loginHits = 0;

    await page.route("**/api/auth/login", async (route) => {
      loginHits += 1;

      if (loginHits === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: { message: "Servicio temporalmente no disponible" } }),
        });
        return;
      }

      await route.fallback();
    });

    await loginViaUI(page, secretariaEmail, secretariaPassword);

    await expect(page).toHaveURL(/\/dashboard\/secretaria$/);
    expect(loginHits).toBeGreaterThan(1);
  });

  test("bloqueo concurrente de turnos simultaneos evita superposicion final", async ({ playwright }) => {
    const runId = Date.now().toString(36);
    const requestedDate = new Date();
    requestedDate.setHours(11, 0, 0, 0);

    const ctxA = await playwright.request.newContext({ baseURL: BASE });
    const ctxB = await playwright.request.newContext({ baseURL: BASE });

    await loginApi(ctxA, secretariaEmail, secretariaPassword);
    await loginApi(ctxB, secretariaEmail, secretariaPassword);

    const doctorRes = await ctxA.get("/api/doctors");
    expect(doctorRes.ok()).toBeTruthy();
    const doctors = (await doctorRes.json()) as DoctorListResponse;
    expect(doctors.ok).toBeTruthy();
    expect(doctors.data.length).toBeGreaterThan(0);
    const doctorId = doctors.data[0].user_id;

    const patientRes = await ctxA.post("/api/patients", {
      data: {
        name: `E2E-Resilience-${runId}`,
        phone: `8${runId.slice(-9).padStart(9, "0")}`,
      },
    });
    expect(patientRes.ok()).toBeTruthy();
    const patientPayload = (await patientRes.json()) as CreatePatientResponse;
    const patientId = patientPayload.data.id;

    const body = {
      patient_id: patientId,
      doctor_id: doctorId,
      datetime: requestedDate.toISOString(),
      duration: 30,
      status: "scheduled",
      source: "manual",
      notes: "test concurrencia",
    };

    const [aRes, bRes] = await Promise.all([
      ctxA.post("/api/appointments", { data: body }),
      ctxB.post("/api/appointments", { data: body }),
    ]);

    const statuses = [aRes.status(), bRes.status()];
    expect(statuses.some((status) => status === 201)).toBeTruthy();
    expect(statuses.every((status) => status === 201 || status === 409)).toBeTruthy();

    const createdRows: Array<NonNullable<CreateAppointmentResponse["data"]>> = [];
    if (aRes.status() === 201) {
      const payloadA = (await aRes.json()) as CreateAppointmentResponse;
      if (payloadA.data) createdRows.push(payloadA.data);
    }
    if (bRes.status() === 201) {
      const payloadB = (await bRes.json()) as CreateAppointmentResponse;
      if (payloadB.data) createdRows.push(payloadB.data);
    }

    if (createdRows.length === 2) {
      const [first, second] = createdRows;
      const firstStart = new Date(first.datetime).getTime();
      const secondStart = new Date(second.datetime).getTime();
      const minGapMs = Math.min(first.duration, second.duration) * 60_000;

      expect(Math.abs(firstStart - secondStart)).toBeGreaterThanOrEqual(minGapMs);
    }

    await ctxA.dispose();
    await ctxB.dispose();
  });

  test("enforcement de roles: doctor no puede crear turnos administrativos", async ({ playwright }) => {
    const doctorCtx = await playwright.request.newContext({ baseURL: BASE });
    await loginApi(doctorCtx, doctorEmail, doctorPassword);

    const denied = await doctorCtx.post("/api/appointments", {
      data: {
        patient_id: crypto.randomUUID(),
        doctor_id: crypto.randomUUID(),
        datetime: new Date().toISOString(),
        duration: 30,
        status: "scheduled",
        source: "manual",
      },
    });

    expect(denied.status()).toBe(403);

    await doctorCtx.dispose();
  });
});
