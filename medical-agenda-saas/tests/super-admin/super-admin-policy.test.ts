import { describe, expect, it } from "vitest";

import { getDashboardRouteByRole } from "../../src/lib/dashboard-route";
import { canAccessAdmin, canEditClinicConfiguration } from "../../src/lib/role-permissions";
import { canLoginWithClinicStatus, isSuperAdminRoleValue } from "../../src/lib/super-admin-policy";
import { normalizeRole, roleMatches } from "../../src/middleware/roleMiddleware";

describe("super admin RBAC policy", () => {
  it("routes only super_admin to the owner panel", () => {
    expect(getDashboardRouteByRole("super_admin")).toBe("/admin");
    expect(getDashboardRouteByRole("admin")).toBe("/dashboard/agenda");
  });

  it("does not collapse super_admin into clinic admin roles", () => {
    expect(normalizeRole("super_admin")).toBe("super_admin");
    expect(normalizeRole("clinic_admin")).toBe("admin");
    expect(roleMatches("admin", ["super_admin"])).toBe(false);
    expect(roleMatches("super_admin", ["super_admin"])).toBe(true);
  });

  it("keeps receptionists and doctors out of admin/global configuration", () => {
    expect(canAccessAdmin("receptionist")).toBe(false);
    expect(canAccessAdmin("doctor")).toBe(false);
    expect(canEditClinicConfiguration("doctor")).toBe(false);
    expect(canEditClinicConfiguration("clinic_admin")).toBe(true);
  });

  it("returns the expected clinic and doctor landing routes", () => {
    expect(getDashboardRouteByRole("clinic_owner")).toBe("/dashboard/agenda");
    expect(getDashboardRouteByRole("clinic_admin")).toBe("/dashboard/agenda");
    expect(getDashboardRouteByRole("receptionist")).toBe("/dashboard/agenda");
    expect(getDashboardRouteByRole("doctor")).toBe("/doctor/dashboard");
  });

  it("allows a super admin without depending on clinic status", () => {
    expect(isSuperAdminRoleValue("super_admin")).toBe(true);
    expect(
      canLoginWithClinicStatus({
        role: "super_admin",
        userActive: true,
        userStatus: "active",
        tenantStatus: "disabled",
      }),
    ).toBe(true);
  });

  it("blocks clinic users when the clinic is suspended or disabled", () => {
    expect(
      canLoginWithClinicStatus({
        role: "clinic_admin",
        userActive: true,
        userStatus: "active",
        tenantStatus: "suspended",
      }),
    ).toBe(false);

    expect(
      canLoginWithClinicStatus({
        role: "doctor",
        userActive: true,
        userStatus: "active",
        tenantStatus: "disabled",
      }),
    ).toBe(false);
  });

  it("reactivated clinic users can log in again", () => {
    expect(
      canLoginWithClinicStatus({
        role: "receptionist",
        userActive: true,
        userStatus: "active",
        tenantStatus: "active",
      }),
    ).toBe(true);
  });

  it("suspended users remain blocked even when clinic is active", () => {
    expect(
      canLoginWithClinicStatus({
        role: "clinic_admin",
        userActive: false,
        userStatus: "suspended",
        tenantStatus: "active",
      }),
    ).toBe(false);
  });
});
