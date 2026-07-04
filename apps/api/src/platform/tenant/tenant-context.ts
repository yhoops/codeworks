import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  userId?: string;
  roles?: string[];
}

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(
  context: TenantContext,
  callback: () => T | Promise<T>
): Promise<Awaited<T>> {
  return tenantContextStorage.run(
    context,
    async () => await callback()
  ) as Promise<Awaited<T>>;
}

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function requireTenantContext(): TenantContext {
  const context = getTenantContext();

  if (!context) {
    throw new Error("Tenant context is required for this operation");
  }

  return context;
}
