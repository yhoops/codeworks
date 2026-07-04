import { Prisma, PrismaClient } from "@prisma/client";

import {
  requireTenantContext,
  type TenantContext
} from "../tenant/tenant-context.js";

export class ForbiddenTenantAccessError extends Error {
  constructor(message = "Cross-tenant data access is forbidden") {
    super(message);
    this.name = "ForbiddenTenantAccessError";
  }
}

function applyNotDeleted<TArgs extends { where?: object }>(args: TArgs): TArgs {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      deletedAt: null
    }
  };
}

function applyTenantOnlyFilter<TArgs extends { where?: object }>(
  args: TArgs,
  tenantId: string
): TArgs {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      tenantId
    }
  };
}

function applyTenantSoftDeleteFilter<TArgs extends { where?: object }>(
  args: TArgs,
  tenantId: string
): TArgs {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      tenantId,
      deletedAt: null
    }
  };
}

function applyTenantData(data: unknown, tenantId: string): unknown {
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

function assertTenantData(data: unknown, tenantId: string): unknown {
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

async function auditForbiddenTenantAccess(
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

async function assertTenantDataForWrite(
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

async function assertWhereTargetsTenant(
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

async function assertContactCustomerTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
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
    await auditForbiddenTenantAccess(prisma, context, "Contact", {
      reason: "foreign_customer",
      entityId: foreignCustomer.id,
      requestedTenantId: foreignCustomer.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

async function assertTenantResult(
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

function createBasePrismaClient() {
  return new PrismaClient();
}

export function createSystemPrismaClient() {
  return createBasePrismaClient().$extends({
    name: "soft-delete-defaults",
    query: {
      budget: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      customer: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      contact: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      }
    }
  });
}

export function createPrismaClient() {
  const prisma = createBasePrismaClient();

  return prisma.$extends({
    name: "tenant-isolation",
    query: {
      budget: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Budget", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Budget", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async findMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async findFirst({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async findUnique({ args, query }) {
          const context = requireTenantContext();
          const result = await query(args);

          return assertTenantResult(prisma, context, "Budget", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Budget", args.data);
          await assertWhereTargetsTenant(prisma, context, "Budget", args.where, (id) =>
            prisma.budget.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async updateMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Budget", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Budget", args.where, (id) =>
            prisma.budget.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query(applyTenantSoftDeleteFilter(args, context.tenantId));
        },
        async deleteMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async upsert({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Budget", args.create);
          await assertTenantDataForWrite(prisma, context, "Budget", args.update);
          await assertWhereTargetsTenant(prisma, context, "Budget", args.where, (id) =>
            prisma.budget.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            create: applyTenantData(args.create, context.tenantId) as typeof args.create,
            update: assertTenantData(
              args.update,
              context.tenantId
            ) as typeof args.update
          });
        }
      },
      customer: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Customer", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Customer", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async findMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async findFirst({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async findUnique({ args, query }) {
          const context = requireTenantContext();
          const result = await query(args);

          return assertTenantResult(prisma, context, "Customer", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Customer", args.data);
          await assertWhereTargetsTenant(prisma, context, "Customer", args.where, (id) =>
            prisma.customer.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async updateMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Customer", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Customer", args.where, (id) =>
            prisma.customer.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query(applyTenantSoftDeleteFilter(args, context.tenantId));
        },
        async deleteMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async upsert({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Customer", args.create);
          await assertTenantDataForWrite(prisma, context, "Customer", args.update);
          await assertWhereTargetsTenant(prisma, context, "Customer", args.where, (id) =>
            prisma.customer.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            create: applyTenantData(args.create, context.tenantId) as typeof args.create,
            update: assertTenantData(
              args.update,
              context.tenantId
            ) as typeof args.update
          });
        }
      },
      contact: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Contact", args.data);
          await assertContactCustomerTargetsTenant(prisma, context, args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Contact", args.data);
          await assertContactCustomerTargetsTenant(prisma, context, args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async findMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async findFirst({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async findUnique({ args, query }) {
          const context = requireTenantContext();
          const result = await query(args);

          return assertTenantResult(prisma, context, "Contact", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Contact", args.data);
          await assertContactCustomerTargetsTenant(prisma, context, args.data);
          await assertWhereTargetsTenant(prisma, context, "Contact", args.where, (id) =>
            prisma.contact.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async updateMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Contact", args.data);
          await assertContactCustomerTargetsTenant(prisma, context, args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Contact", args.where, (id) =>
            prisma.contact.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query(applyTenantSoftDeleteFilter(args, context.tenantId));
        },
        async deleteMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async upsert({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Contact", args.create);
          await assertTenantDataForWrite(prisma, context, "Contact", args.update);
          await assertContactCustomerTargetsTenant(prisma, context, args.create);
          await assertContactCustomerTargetsTenant(prisma, context, args.update);
          await assertWhereTargetsTenant(prisma, context, "Contact", args.where, (id) =>
            prisma.contact.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            create: applyTenantData(args.create, context.tenantId) as typeof args.create,
            update: assertTenantData(
              args.update,
              context.tenantId
            ) as typeof args.update
          });
        }
      },
      auditLog: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "AuditLog", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "AuditLog", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async findMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantOnlyFilter(args, tenantId));
        },
        async findFirst({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantOnlyFilter(args, tenantId));
        },
        async findUnique({ args, query }) {
          const context = requireTenantContext();
          const result = await query(args);

          return assertTenantResult(prisma, context, "AuditLog", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantOnlyFilter(args, tenantId));
        },
        async update() {
          requireTenantContext();
          throw new Error("AuditLog is append-only");
        },
        async updateMany() {
          requireTenantContext();
          throw new Error("AuditLog is append-only");
        },
        async delete() {
          requireTenantContext();
          throw new Error("AuditLog is append-only");
        },
        async deleteMany() {
          requireTenantContext();
          throw new Error("AuditLog is append-only");
        }
      }
    }
  });
}

export type CodeworksPrismaClient = ReturnType<typeof createPrismaClient>;
