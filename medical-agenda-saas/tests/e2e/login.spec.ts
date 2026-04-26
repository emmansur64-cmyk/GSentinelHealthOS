import "dotenv/config";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

function credential(name: string, fallbackName?: string, hardFallback?: string) {
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

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("redirecciona a login si intenta acceder a dashboard sin sesion", async ({ page }) => {
  await page.goto("/dashboard/secretaria");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Ingreso seguro")).toBeVisible();
});

test("login secretaria redirige a dashboard de secretaria", async ({ page }) => {
  await login(page, secretariaEmail, secretariaPassword);
  await expect(page).toHaveURL(/\/dashboard\/secretaria$/);
  await expect(page.getByText("Panel Secretaria")).toBeVisible();
});

test("login doctor redirige a dashboard de doctor", async ({ page }) => {
  await login(page, doctorEmail, doctorPassword);
  await expect(page).toHaveURL(/\/dashboard\/doctor$/);
  await expect(page.getByText("Panel Doctor")).toBeVisible();
});

test("logout invalida sesion y protege rutas", async ({ page }) => {
  await login(page, secretariaEmail, secretariaPassword);
  await expect(page).toHaveURL(/\/dashboard\/secretaria$/);

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/dashboard/secretaria");
  await expect(page).toHaveURL(/\/login$/);
});