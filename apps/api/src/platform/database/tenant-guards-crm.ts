// Guards CRM relationship writes against cross-tenant customer references.
import type { PrismaClient } from "@prisma/client";

import type { TenantContext } from "../tenant/tenant-context.js";
import { auditForbiddenTenantAccess, ForbiddenTenantAccessError } from "./tenant-errors.js";

function collectCustomerIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectCustomerIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    customerId?: unknown;
    customer?: { connect?: { id?: unknown } };
  };

  if (typeof record.customerId === "string") {
    ids.add(record.customerId);
  }

  if (typeof record.customer?.connect?.id === "string") {
    ids.add(record.customer.connect.id);
  }

  return ids;
}

export async function assertCustomerTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const customerIds = [...collectCustomerIds(data)];

  if (customerIds.length === 0) {
    return;
  }

  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, tenantId: true }
  });
  const foreignCustomer = customers.find(
    (customer) => customer.tenantId !== context.tenantId
  );

  if (foreignCustomer) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_customer",
      entityId: foreignCustomer.id,
      requestedTenantId: foreignCustomer.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}
