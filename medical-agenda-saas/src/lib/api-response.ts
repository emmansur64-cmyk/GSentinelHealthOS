import { NextResponse } from "next/server";

import { logServer } from "@/lib/server-logger";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  if (status >= 500) {
    logServer("error", "api.fail", {
      status,
      message,
      details: details ?? null,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        details: details ?? null,
      },
    },
    { status },
  );
}