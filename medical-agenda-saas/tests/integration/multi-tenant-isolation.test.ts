import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { disconnectPrisma, getTestPrisma } from "./test-isolation";

const authState = vi.hoisted(() => ({
  user: null as null | { userId: string; tenantId: string; role: string; sessionId: string },
  tenant: null as null | { id: string; estado: string },
}));

vi.mock("@/lib/server-auth", () => ({
  getAuthenticatedUser: vi.fn(async () => authState.user),
  hasRole: vi.fn((user: { role?: string } | null, roles: string[]) => {
    if (!user?.role) return false;
    return roles.includes(user.role);
  }),
}));

vi.mock("@/middleware/tenantMiddleware", () => ({
  requireTenant: vi.fn(async () => {
    if (!authState.tenant) {
      return {
        ok: false,
        response: Response.json({ ok: false, error: { message: "Tenant requerido" } }, { status: 403 }),
      };
    }
    return { ok: true, tenant: authState.tenant };
  }),
}));

type TenantFixture = {
  tenantId: string;
  adminUserId: string;
  doctorUserId: string;
  patientId: string;
  appointmentId: string;
  availabilityRuleId: string;
};

type IsolationFixtures = {
  tenantA: TenantFixture;
  tenantB: TenantFixture;
};

describe("multi-tenant isolation with crossed fixtures", () => {
  const prisma = getTestPrisma();
  let fixtures: IsolationFixtures | null = null;

  beforeEach(async () => {
    fixtures = await createCrossTenantFixtures();
    authState.user = {
      userId: fixtures.tenantA.adminUserId,
      tenantId: fixtures.tenantA.tenantId,
      role: "admin",
      sessionId: `test-session-${randomUUID()}`,
    };
    authState.tenant = { id: fixtures.tenantA.tenantId, estado: "active" };
  });

  afterEach(async () => {
    authState.user = null;
    authState.tenant = null;
    if (fixtures) {
      await deleteCrossTenantFixtures([fixtures.tenantA.tenantId, fixtures.tenantB.tenantId]);
      fixtures = null;
    }
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("does not expose patients, doctors or schedules from another clinic", async () => {
    expect(fixtures).not.toBeNull();
    const { tenantA, tenantB } = fixtures!;

    const patientsRoute = await import("@/app/api/patients/[id]/route");
    const doctorsRoute = await import("@/app/api/doctors/[id]/route");
    const schedulesRoute = await import("@/app/api/schedules/[id]/route");

    const ownPatient = await patientsRoute.GET(
      new Request(`http://localhost/api/patients/${tenantA.patientId}`),
      routeParams(tenantA.patientId),
    );
    expect(ownPatient.status).toBe(200);
    await expectJsonDataId(ownPatient, tenantA.patientId);

    const foreignPatient = await patientsRoute.GET(
      new Request(`http://localhost/api/patients/${tenantB.patientId}`),
      routeParams(tenantB.patientId),
    );
    expect(foreignPatient.status).toBe(404);

    const ownDoctor = await doctorsRoute.GET(
      new Request(`http://localhost/api/doctors/${tenantA.doctorUserId}`),
      routeParams(tenantA.doctorUserId),
    );
    expect(ownDoctor.status).toBe(200);
    await expectJsonDataId(ownDoctor, tenantA.doctorUserId, "user_id");

    const foreignDoctor = await doctorsRoute.GET(
      new Request(`http://localhost/api/doctors/${tenantB.doctorUserId}`),
      routeParams(tenantB.doctorUserId),
    );
    expect(foreignDoctor.status).toBe(404);

    const ownSchedule = await schedulesRoute.GET(
      new Request(`http://localhost/api/schedules/${tenantA.availabilityRuleId}`),
      routeParams(tenantA.availabilityRuleId),
    );
    expect(ownSchedule.status).toBe(200);
    await expectJsonDataId(ownSchedule, tenantA.availabilityRuleId);

    const foreignSchedule = await schedulesRoute.GET(
      new Request(`http://localhost/api/schedules/${tenantB.availabilityRuleId}`),
      routeParams(tenantB.availabilityRuleId),
    );
    expect(foreignSchedule.status).toBe(404);
  });

  it("keeps appointment listing scoped to the authenticated clinic", async () => {
    expect(fixtures).not.toBeNull();
    const { tenantA, tenantB } = fixtures!;

    const appointmentsRoute = await import("@/app/api/appointments/route");

    const ownResponse = await appointmentsRoute.GET(
      new Request(`http://localhost/api/appointments?patient_id=${tenantA.patientId}`),
    );
    expect(ownResponse.status).toBe(200);
    const ownBody = (await ownResponse.json()) as { ok: boolean; data: Array<{ id: string; tenant_id: string }> };
    expect(ownBody.ok).toBe(true);
    expect(ownBody.data).toHaveLength(1);
    expect(ownBody.data[0].id).toBe(tenantA.appointmentId);
    expect(ownBody.data[0].tenant_id).toBe(tenantA.tenantId);

    const foreignResponse = await appointmentsRoute.GET(
      new Request(`http://localhost/api/appointments?patient_id=${tenantB.patientId}`),
    );
    expect(foreignResponse.status).toBe(200);
    const foreignBody = (await foreignResponse.json()) as { ok: boolean; data: Array<{ id: string }> };
    expect(foreignBody.ok).toBe(true);
    expect(foreignBody.data).toEqual([]);
  });

  async function createCrossTenantFixtures(): Promise<IsolationFixtures> {
    const runId = randomUUID().slice(0, 8);
    const tenantA = await createTenantFixture(`tenant-a-${runId}`);
    const tenantB = await createTenantFixture(`tenant-b-${runId}`);
    return { tenantA, tenantB };
  }

  async function createTenantFixture(slug: string): Promise<TenantFixture> {
    const tenant = await prisma.tenant.create({
      data: {
        nombre: `Clinic ${slug}`,
        slug,
        email: `${slug}@test.local`,
      },
    });

    const admin = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email: `admin-${slug}@test.local`,
        name: `Admin ${slug}`,
        role: "admin",
        password_hash: "$2a$10$test",
      },
    });

    const doctorUser = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email: `doctor-${slug}@test.local`,
        name: `Doctor ${slug}`,
        role: "doctor",
        password_hash: "$2a$10$test",
      },
    });

    await prisma.doctorProfile.create({
      data: {
        tenant_id: tenant.id,
        user_id: doctorUser.id,
        specialty: "Clinica medica",
        matricula: `MAT-${slug}`,
        ai_tag: `doctor-${slug}`,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        tenant_id: tenant.id,
        name: `Patient ${slug}`,
        document: `DOC-${slug}`,
        phone: `+54911${randomUUID().replaceAll("-", "").slice(0, 10)}`,
      },
    });

    const availabilityRule = await prisma.availabilityRule.create({
      data: {
        tenant_id: tenant.id,
        doctor_id: doctorUser.id,
        day_of_week: 1,
        start_time: "09:00",
        end_time: "12:00",
        slot_duration: 30,
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        tenant_id: tenant.id,
        patient_id: patient.id,
        doctor_id: doctorUser.id,
        datetime: new Date("2099-05-01T09:00:00.000Z"),
        duration: 30,
        status: "scheduled",
        source: "manual",
      },
    });

    return {
      tenantId: tenant.id,
      adminUserId: admin.id,
      doctorUserId: doctorUser.id,
      patientId: patient.id,
      appointmentId: appointment.id,
      availabilityRuleId: availabilityRule.id,
    };
  }

  async function deleteCrossTenantFixtures(tenantIds: string[]) {
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.activityLog.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.appointment.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.availabilityRule.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.patient.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.doctorProfile.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.session.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.user.deleteMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }),
    ]);
  }
});

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function expectJsonDataId(response: Response, expectedId: string, field = "id") {
  const body = (await response.json()) as { ok: boolean; data: Record<string, unknown> };
  expect(body.ok).toBe(true);
  expect(body.data[field]).toBe(expectedId);
}
