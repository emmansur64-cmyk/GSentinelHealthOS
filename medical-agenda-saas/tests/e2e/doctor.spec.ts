import "dotenv/config";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// ─── Credenciales ─────────────────────────────────────────────────────────────

function credential(name: string, fallbackName?: string, hardFallback?: string): string {
  const primary = process.env[name]?.trim();
  if (primary) return primary;
  const fallback = fallbackName ? process.env[fallbackName]?.trim() : undefined;
  if (fallback) return fallback;
  if (hardFallback?.trim()) return hardFallback;
  throw new Error(`Missing credential env var: ${name}${fallbackName ? ` (or ${fallbackName})` : ""}`);
}

const secretariaEmail    = credential("E2E_SECRETARIA_EMAIL",    "SEED_SECRETARIA_EMAIL",    "secretaria@clinic.local");
const secretariaPassword = credential("E2E_SECRETARIA_PASSWORD", "SEED_SECRETARIA_PASSWORD", "ChangeMe123!");
const doctorEmail        = credential("E2E_DOCTOR_EMAIL",        "SEED_DOCTOR_EMAIL",        "doctor@clinic.local");
const doctorPassword     = credential("E2E_DOCTOR_PASSWORD",     "SEED_DOCTOR_PASSWORD",     "ChangeMe123!");

const BASE = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ─── Helper de login via browser ──────────────────────────────────────────────

async function loginPage(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

// ─── Modo serial: beforeAll establece estado compartido ───────────────────────

test.describe.configure({ mode: "serial" });

test.describe("Doctor — flujo clínico E2E", () => {
  /**
   * Identificador único por ejecución para evitar colisiones entre runs.
   * Se asigna en beforeAll y se comparte con todos los tests del suite.
   */
  let runId: string;
  let patientName: string;

  test.beforeAll(async ({ playwright }) => {
    runId      = Date.now().toString(36);
    patientName = `E2E-Doctor-${runId}`;
    const patientPhone = `9${runId.slice(-9).padStart(9, "0")}`;

    // ── 1. Obtener user ID del doctor ─────────────────────────────────────────
    const docCtx = await playwright.request.newContext({ baseURL: BASE });

    const docLogin = await docCtx.post("/api/auth/login", {
      data: { email: doctorEmail, password: doctorPassword },
    });
    expect(docLogin.ok(), "Login doctor debe ser exitoso en beforeAll").toBeTruthy();

    const { data: docData } = (await docLogin.json()) as { data: { user: { id: string } } };
    const doctorUserId = docData.user.id;
    await docCtx.dispose();

    // ── 2. Crear paciente y turnos como secretaria ─────────────────────────────
    const secCtx = await playwright.request.newContext({ baseURL: BASE });

    const secLogin = await secCtx.post("/api/auth/login", {
      data: { email: secretariaEmail, password: secretariaPassword },
    });
    expect(secLogin.ok(), "Login secretaria debe ser exitoso en beforeAll").toBeTruthy();

    // Crear paciente de prueba
    const patientRes = await secCtx.post("/api/patients", {
      data: { name: patientName, phone: patientPhone },
    });
    expect(patientRes.ok(), `Crear paciente '${patientName}' debe devolver 2xx`).toBeTruthy();
    const { data: patientData } = (await patientRes.json()) as { data: { id: string } };
    const patientId = patientData.id;

    // Crear dos turnos para hoy: 09:00 (appt1) y 10:00 (appt2)
    const todayAt = (hour: number): string => {
      const dt = new Date();
      dt.setHours(hour, 0, 0, 0);
      return dt.toISOString();
    };

    const apptPayload = (hour: number) => ({
      patient_id: patientId,
      doctor_id:  doctorUserId,
      datetime:   todayAt(hour),
      duration:   30,
      status:     "scheduled",
      source:     "manual",
    });

    const appt1Res = await secCtx.post("/api/appointments", { data: apptPayload(9) });
    expect(appt1Res.ok(), "Crear turno 09:00 debe devolver 2xx").toBeTruthy();

    const appt2Res = await secCtx.post("/api/appointments", { data: apptPayload(10) });
    expect(appt2Res.ok(), "Crear turno 10:00 debe devolver 2xx").toBeTruthy();

    await secCtx.dispose();
  });

  // ─── Test 1: El doctor ve la agenda del día con los turnos creados ──────────

  test("doctor ve los dos turnos creados en la agenda de hoy", async ({ page }) => {
    await loginPage(page, doctorEmail, doctorPassword);
    await expect(page).toHaveURL(/\/dashboard\/doctor$/);

    // Encabezado de agenda visible
    await expect(page.getByRole("heading", { name: "Agenda de hoy" })).toBeVisible();

    // Los dos turnos del paciente de prueba aparecen en la lista
    const apptButtons = page.getByRole("button").filter({ hasText: patientName });
    await expect(apptButtons).toHaveCount(2, { timeout: 20_000 });
  });

  // ─── Test 2: Marcar primer turno como atendido + registrar evolución ─────────

  test("doctor marca el primer turno como atendido y guarda evolución clínica", async ({ page }) => {
    await loginPage(page, doctorEmail, doctorPassword);
    await expect(page).toHaveURL(/\/dashboard\/doctor$/);

    // Esperar la lista de turnos
    const apptButtons = page.getByRole("button").filter({ hasText: patientName });
    await expect(apptButtons.first()).toBeVisible({ timeout: 20_000 });

    // Seleccionar primer turno (09:00)
    await apptButtons.first().click();

    // Escribir evolución clínica
    const evolutionField = page.getByLabel("Registro clinico (evolucion)");
    await evolutionField.fill("Paciente evolucionando favorablemente. Sin complicaciones.");

    // Marcar como atendido
    await page.getByRole("button", { name: "Marcar como atendido" }).click();

    // Confirmar toast de éxito
    await expect(page.getByText("Registro clinico actualizado")).toBeVisible({ timeout: 10_000 });

    // Badge del primer turno debe actualizarse a 'completed'
    await expect(apptButtons.first().getByText("completed")).toBeVisible({ timeout: 10_000 });
  });

  // ─── Test 3: Marcar segundo turno como ausente ───────────────────────────────

  test("doctor marca el segundo turno como ausente", async ({ page }) => {
    await loginPage(page, doctorEmail, doctorPassword);
    await expect(page).toHaveURL(/\/dashboard\/doctor$/);

    // Esperar ambos turnos cargados
    const apptButtons = page.getByRole("button").filter({ hasText: patientName });
    await expect(apptButtons).toHaveCount(2, { timeout: 20_000 });

    // Seleccionar segundo turno (10:00)
    await apptButtons.nth(1).click();

    // Marcar como ausente
    await page.getByRole("button", { name: "Marcar ausente" }).click();

    // Confirmar toast de éxito
    await expect(page.getByText("Registro clinico actualizado")).toBeVisible({ timeout: 10_000 });

    // Badge del segundo turno debe actualizarse a 'no_show'
    await expect(apptButtons.nth(1).getByText("no_show")).toBeVisible({ timeout: 10_000 });
  });

  // ─── Test 4: Reprogramar un turno ────────────────────────────────────────────

  test("doctor reprograma el segundo turno a una nueva hora", async ({ page }) => {
    await loginPage(page, doctorEmail, doctorPassword);
    await expect(page).toHaveURL(/\/dashboard\/doctor$/);

    const apptButtons = page.getByRole("button").filter({ hasText: patientName });
    await expect(apptButtons.nth(1)).toBeVisible({ timeout: 20_000 });
    await apptButtons.nth(1).click();

    // Cambiar fecha/hora al mismo día pero a las 14:00
    const newDatetime = (() => {
      const dt = new Date();
      dt.setHours(14, 0, 0, 0);
      // datetime-local input espera "YYYY-MM-DDTHH:MM"
      return dt.toISOString().slice(0, 16);
    })();

    const datetimeInput = page.locator('input[type="datetime-local"]');
    await datetimeInput.fill(newDatetime);

    await page.getByRole("button", { name: "Reprogramar turno" }).click();

    await expect(page.getByText("Turno reprogramado")).toBeVisible({ timeout: 10_000 });
  });

  // ─── Test 5: Crear turno de seguimiento ──────────────────────────────────────

  test("doctor crea un seguimiento a 14 días desde el primer turno", async ({ page }) => {
    await loginPage(page, doctorEmail, doctorPassword);
    await expect(page).toHaveURL(/\/dashboard\/doctor$/);

    // Seleccionar el primer turno
    const apptButtons = page.getByRole("button").filter({ hasText: patientName });
    await expect(apptButtons.first()).toBeVisible({ timeout: 20_000 });
    await apptButtons.first().click();

    // Ingresar 14 días en el campo de seguimiento
    const daysInput = page.getByPlaceholder("Dias");
    await daysInput.clear();
    await daysInput.fill("14");

    // Crear seguimiento
    await page.getByRole("button", { name: "Control en X dias" }).click();

    // Confirmar toast "Seguimiento creado a 14 dias"
    await expect(page.getByText("Seguimiento creado a 14 dias")).toBeVisible({ timeout: 10_000 });
  });

  // ─── Test 6: Logout invalida la sesión del doctor ────────────────────────────

  test("logout invalida la sesión del doctor y protege el dashboard", async ({ page }) => {
    await loginPage(page, doctorEmail, doctorPassword);
    await expect(page).toHaveURL(/\/dashboard\/doctor$/);

    // Hacer logout
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Intentar volver al dashboard sin sesión debe redirigir al login
    await page.goto("/dashboard/doctor");
    await expect(page).toHaveURL(/\/login$/);
  });
});
