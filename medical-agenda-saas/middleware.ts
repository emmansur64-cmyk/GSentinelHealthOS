import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

function normalizeRole(role: string): "admin" | "medico" | "recepcionista" | "unknown" {
  if (role === "admin") return "admin";
  if (role === "doctor" || role === "medico") return "medico";
  if (role === "secretaria" || role === "recepcionista") return "recepcionista";
  return "unknown";
}

const roleRoutes: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/dashboard/admin", roles: ["admin"] },
  { prefix: "/dashboard/secretaria", roles: ["secretaria", "recepcionista"] },
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

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/api")) {
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

    if (!tenantId) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ ok: false, error: { message: "Token sin tenant asociado" } }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const normalizedTokenRole = normalizeRole(role);

    for (const rule of roleRoutes) {
      if (pathname.startsWith(rule.prefix)) {
        const allowed = rule.roles.some((candidate) => normalizeRole(candidate) === normalizedTokenRole);
        if (allowed) continue;

        if (pathname.startsWith("/api")) {
          return NextResponse.json({ ok: false, error: { message: "Sin permisos" } }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-id", tenantId);

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
  matcher: ["/dashboard/:path*", "/api/:path*", "/login"],
};