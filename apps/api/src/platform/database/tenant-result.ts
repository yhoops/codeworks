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
