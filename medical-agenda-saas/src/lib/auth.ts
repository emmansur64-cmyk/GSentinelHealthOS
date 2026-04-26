import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { getEnv, getJwtExpiresInHours } from "@/lib/env";
import { prisma } from "@/lib/prisma";

function jwtSecretKey() {
  const env = getEnv();
  return new TextEncoder().encode(env.JWT_SECRET);
}

export type AuthTokenPayload = {
  sub: string;
  role: Role;
  tenantId: string;
  sessionId: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(input: { userId: string; role: Role; tenantId: string }) {
  const jwtExpiresInHours = getJwtExpiresInHours();
  const session = await prisma.session.create({
    data: {
      user_id: input.userId,
      jwt_id: crypto.randomUUID(),
      expires_at: new Date(Date.now() + jwtExpiresInHours * 60 * 60 * 1000),
    },
  });

  const token = await new SignJWT({ role: input.role, tenantId: input.tenantId, sessionId: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setJti(session.jwt_id)
    .setIssuedAt()
    .setExpirationTime(session.expires_at)
    .sign(jwtSecretKey());

  return { token, sessionId: session.id };
}

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());

    if (
      !payload.sub ||
      typeof payload.role !== "string" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.tenantId !== "string"
    ) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, jwt_id: true, revoked_at: true, expires_at: true },
    });

    if (!session) return null;
    if (session.revoked_at) return null;
    if (session.jwt_id !== payload.jti) return null;
    if (session.expires_at.getTime() < Date.now()) return null;

    return {
      sub: payload.sub,
      role: payload.role as Role,
      tenantId: payload.tenantId,
      sessionId: payload.sessionId,
    };
  } catch {
    return null;
  }
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}