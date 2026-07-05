/**
 * tenant-errors.ts 数据库平台模块。
 * 承载 Prisma 客户端、租户过滤或 guard 的基础能力，集中保护跨租户边界。
 * 依赖：Prisma 与租户上下文；被用于：API 服务与测试。
 */
// Defines tenant isolation errors and audit logging for forbidden access.
import { Prisma, type PrismaClient } from "@prisma/client";

import type { TenantContext } from "../tenant/tenant-context.js";

export class ForbiddenTenantAccessError extends Error {
  constructor(message = "Cross-tenant data access is forbidden") {
    super(message);
    this.name = "ForbiddenTenantAccessError";
  }
}

export async function auditForbiddenTenantAccess(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  details: Record<string, unknown> = {}
) {
  await prisma.auditLog
    .create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: "CROSS_TENANT_ACCESS_DENIED",
        entityType,
        entityId: typeof details.entityId === "string" ? details.entityId : undefined,
        details: details as Prisma.InputJsonObject
      }
    })
    .catch(() => undefined);
}
