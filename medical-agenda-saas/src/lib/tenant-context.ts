import { AsyncLocalStorage } from "node:async_hooks";

import type { Role } from "@prisma/client";

type TenantContext = {
  tenantId: string;
  userId?: string;
  role?: Role;
};

const storage = new AsyncLocalStorage<TenantContext>();

export function setTenantContext(context: TenantContext): void {
  storage.enterWith(context);
}

export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getTenantContext(): TenantContext | null {
  return storage.getStore() ?? null;
}

export function getTenantIdFromContext(): string | null {
  return storage.getStore()?.tenantId ?? null;
}
