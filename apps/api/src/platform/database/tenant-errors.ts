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
