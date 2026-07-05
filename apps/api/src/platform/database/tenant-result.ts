/**
 * tenant-result.ts 数据库平台模块。
 * 承载 Prisma 客户端、租户过滤或 guard 的基础能力，集中保护跨租户边界。
 * 依赖：Prisma 与租户上下文；被用于：API 服务与测试。
 */
// Validates tenant ownership and soft-delete visibility for Prisma query results.
import type { PrismaClient } from "@prisma/client";

import type { TenantContext } from "../tenant/tenant-context.js";
import { auditForbiddenTenantAccess, ForbiddenTenantAccessError } from "./tenant-errors.js";

export async function assertTenantResult(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  result: unknown
): Promise<unknown> {
  if (!result || typeof result !== "object") {
    return result;
  }

  const record = result as { tenantId?: string; deletedAt?: Date | null };

  if (record.tenantId && record.tenantId !== context.tenantId) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_record",
      entityId: typeof (result as { id?: unknown }).id === "string"
        ? (result as { id: string }).id
        : undefined,
      requestedTenantId: record.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }

  if (record.deletedAt) {
    return null;
  }

  return result;
}
