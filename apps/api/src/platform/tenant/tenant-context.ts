/**
 * tenant-context.ts API 平台能力。
 * 将审计、鉴权、事件或存储等横切能力从业务模块剥离，保持业务服务聚焦用例。
 * 依赖：NestJS/平台上下文；被用于：领域模块与控制器。
 */
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
