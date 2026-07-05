/**
 * tenant-guards-costing.ts 数据库平台模块。
 * 承载 Prisma 客户端、租户过滤或 guard 的基础能力，集中保护跨租户边界。
 * 依赖：Prisma 与租户上下文；被用于：API 服务与测试。
 */
// Guards costing relationship writes against cross-tenant time entry references.
import type { PrismaClient } from "@prisma/client";

import type { TenantContext } from "../tenant/tenant-context.js";
import { auditForbiddenTenantAccess, ForbiddenTenantAccessError } from "./tenant-errors.js";

function collectTimeEntryIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectTimeEntryIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    timeEntryId?: unknown;
    timeEntry?: { connect?: { id?: unknown } };
  };

  if (typeof record.timeEntryId === "string") {
    ids.add(record.timeEntryId);
  }

  if (typeof record.timeEntry?.connect?.id === "string") {
    ids.add(record.timeEntry.connect.id);
  }

  return ids;
}

export async function assertTimeEntryTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const timeEntryIds = [...collectTimeEntryIds(data)];

  if (timeEntryIds.length === 0) {
    return;
  }

  const timeEntries = await prisma.timeEntry.findMany({
    where: { id: { in: timeEntryIds } },
    select: { id: true, tenantId: true }
  });
  const foreignTimeEntry = timeEntries.find(
    (timeEntry) => timeEntry.tenantId !== context.tenantId
  );

  if (foreignTimeEntry) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_time_entry",
      entityId: foreignTimeEntry.id,
      requestedTenantId: foreignTimeEntry.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}
