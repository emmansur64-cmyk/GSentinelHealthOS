import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID?.trim() || "default";

const LEGACY_PATH_REDIRECTS: Record<string, string> = {
  "/home": "/",
  "/panel": "/dashboard/agenda",
  "/panel-secretaria": "/dashboard/agenda",
};

const KNOWN_TOP_LEVEL_WEB_SEGMENTS = new Set([
  "",
  "login",
  "admin",
  "clinic",
  "doctor",
  "secretaria",
  "dashboard",
  "register-clinic",
  "chat",
  "ws",
]);

function normalizeRole(role: string): "super_admin" | "admin" | "medico" | "recepcionista" | "auditor" | "patient" | "unknown" {
  if (role === "super_admin") return "super_admin";
  if (role === "admin") return "admin";
  if (role === "auditor") return "auditor";
  if (role === "patient") return "patient";
  if (role === "clinic_owner" || role === "clinic_admin") return "recepcionista";
  if (role === "doctor" || role === "medico") return "medico";
  if (role === "secretaria" || role === "recepcionista" || role === "receptionist") return "recepcionista";
  return "unknown";
}

const roleRoutes: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin", roles: ["super_admin"] },
  { prefix: "/clinic", roles: ["secretaria", "recepcionista", "admin", "clinic_owner", "clinic_admin"] },
  { prefix: "/secretaria", roles: ["secretaria", "recepcionista", "admin", "clinic_owner", "clinic_admin"] },
  { prefix: "/doctor", roles: ["doctor", "medico"] },
  { prefix: "/dashboard/admin", roles: ["admin"] },
  { prefix: "/dashboard/secretaria", roles: ["secretaria", "recepcionista", "admin", "clinic_owner", "clinic_admin"] },
  { prefix: "/dashboard/doctor", roles: ["doctor", "medico"] },
  { prefix: "/api/appointments/today", roles: ["doctor", "medico"] },
  { prefix: "/api/appointments/update-status", roles: ["doctor", "medico"] },
  { prefix: "/api/appointments/create-followup", roles: ["doctor", "medico"] },
  { prefix: "/api/appointments/suggestions", roles: ["secretaria", "recepcionista", "doctor", "medico"] },
  { prefix: "/api/appointments", roles: ["secretaria", "recepcionista", "admin"] },
  { prefix: "/api/predictions", roles: ["secretaria", "recepcionista", "doctor", "medico", "admin"] },
  { prefix: "/api/recommendations", roles: ["secretaria", "recepcionista", "doctor", "medico", "admin"] },
  { prefix: "/api/admin", roles: ["admin"] },
  { prefix: "/api/audit", roles: ["secretaria", "recepcionista", "admin"] },
  { prefix: "/api/users", roles: ["secretaria", "recepcionista", "admin"] },
  { prefix: "/api/patients", roles: ["secretaria", "recepcionista", "admin"] },
  { prefix: "/api/schedules", roles: ["secretaria", "recepcionista", "admin"] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacyTarget = LEGACY_PATH_REDIRECTS[pathname];
  if (legacyTarget) {
    return NextResponse.redirect(new URL(legacyTarget, request.url));
  }

  const [firstSegment = ""] = pathname.split("/").filter(Boolean);
  if (!pathname.startsWith("/api") && !KNOWN_TOP_LEVEL_WEB_SEGMENTS.has(firstSegment)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/clinic") &&
    !pathname.startsWith("/doctor") &&
    !pathname.startsWith("/secretaria") &&
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  // WhatsApp webhook: autenticación vía firma HMAC, no JWT
  if (pathname.startsWith("/api/webhooks/whatsapp")) {
    return NextResponse.next();
  }

  // Health check público
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: { message: "No autenticado" } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = String(payload.role ?? "");
    const tenantId = String(payload.tenantId ?? "").trim();
    const normalizedTokenRole = normalizeRole(role);
    const effectiveTenantId =
      tenantId ||
      (normalizedTokenRole === "super_admin"
        ? (request.cookies.get("tenant_id")?.value?.trim() || DEFAULT_TENANT_ID)
        : "");

    if (!effectiveTenantId) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ ok: false, error: { message: "Token sin tenant asociado" } }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    for (const rule of roleRoutes) {
      if (pathname.startsWith(rule.prefix)) {
        const allowed = rule.roles.some((candidate) => normalizeRole(candidate) === normalizedTokenRole);
        if (allowed) break;

        if (pathname.startsWith("/api")) {
          return NextResponse.json({ ok: false, error: { message: "Sin permisos" } }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-id", effectiveTenantId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: { message: "Token invalido" } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
