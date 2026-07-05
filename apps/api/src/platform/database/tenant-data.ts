/**
 * tenant-data.ts 数据库平台模块。
 * 承载 Prisma 客户端、租户过滤或 guard 的基础能力，集中保护跨租户边界。
 * 依赖：Prisma 与租户上下文；被用于：API 服务与测试。
 */
// Validates tenant ownership in Prisma write data and unique where clauses.
import type { PrismaClient } from "@prisma/client";

import type { TenantContext } from "../tenant/tenant-context.js";
import { auditForbiddenTenantAccess, ForbiddenTenantAccessError } from "./tenant-errors.js";

export function applyTenantData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => applyTenantData(item, tenantId));
  }

  if (!data || typeof data !== "object") {
    return data;
  }

  const record = data as Record<string, unknown>;
  const requestedTenantId = record.tenantId;

  if (requestedTenantId && requestedTenantId !== tenantId) {
    throw new ForbiddenTenantAccessError();
  }

  return {
    ...record,
    tenantId
  };
}

function findMismatchedTenantId(data: unknown, tenantId: string): string | undefined {
  if (Array.isArray(data)) {
    for (const item of data) {
      const mismatch = findMismatchedTenantId(item, tenantId);

      if (mismatch) {
        return mismatch;
      }
    }

    return undefined;
  }

  if (!data || typeof data !== "object") {
    return undefined;
  }

  const requestedTenantId = (data as Record<string, unknown>).tenantId;

  return typeof requestedTenantId === "string" && requestedTenantId !== tenantId
    ? requestedTenantId
    : undefined;
}

export function assertTenantData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => assertTenantData(item, tenantId));
  }

  if (!data || typeof data !== "object") {
    return data;
  }

  const record = data as Record<string, unknown>;
  const requestedTenantId = record.tenantId;

  if (requestedTenantId && requestedTenantId !== tenantId) {
    throw new ForbiddenTenantAccessError();
  }

  return data;
}

export async function assertTenantDataForWrite(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const mismatchedTenantId = findMismatchedTenantId(data, context.tenantId);

  if (mismatchedTenantId) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "mismatched_tenant_id",
      requestedTenantId: mismatchedTenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

export async function assertWhereTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  where: unknown,
  findTenantRecord: (
    id: string
  ) => Promise<{ id: string; tenantId: string } | null>
) {
  const id = typeof where === "object" && where ? (where as { id?: unknown }).id : undefined;

  if (typeof id !== "string") {
    return;
  }

  const existing = await findTenantRecord(id);

  if (existing && existing.tenantId !== context.tenantId) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_record",
      entityId: existing.id,
      requestedTenantId: existing.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}
