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

async function assertCustomerTargetsTenant(
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

function collectProjectIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectProjectIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    projectId?: unknown;
    project?: { connect?: { id?: unknown } };
  };

  if (typeof record.projectId === "string") {
    ids.add(record.projectId);
  }

  if (typeof record.project?.connect?.id === "string") {
    ids.add(record.project.connect.id);
  }

  return ids;
}

async function assertProjectTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const projectIds = [...collectProjectIds(data)];

  if (projectIds.length === 0) {
    return;
  }

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, tenantId: true }
  });
  const foreignProject = projects.find(
    (project) => project.tenantId !== context.tenantId
  );

  if (foreignProject) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_project",
      entityId: foreignProject.id,
      requestedTenantId: foreignProject.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

function collectSprintIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectSprintIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    sprintId?: unknown;
    sprint?: { connect?: { id?: unknown } };
  };

  if (typeof record.sprintId === "string") {
    ids.add(record.sprintId);
  }

  if (typeof record.sprint?.connect?.id === "string") {
    ids.add(record.sprint.connect.id);
  }

  return ids;
}

async function assertSprintTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const sprintIds = [...collectSprintIds(data)];

  if (sprintIds.length === 0) {
    return;
  }

  const sprints = await prisma.sprint.findMany({
    where: { id: { in: sprintIds } },
    select: { id: true, tenantId: true }
  });
  const foreignSprint = sprints.find(
    (sprint) => sprint.tenantId !== context.tenantId
  );

  if (foreignSprint) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_sprint",
      entityId: foreignSprint.id,
      requestedTenantId: foreignSprint.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

function collectTaskIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectTaskIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    taskId?: unknown;
    task?: { connect?: { id?: unknown } };
  };

  if (typeof record.taskId === "string") {
    ids.add(record.taskId);
  }

  if (typeof record.task?.connect?.id === "string") {
    ids.add(record.task.connect.id);
  }

  return ids;
}

async function assertTaskTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const taskIds = [...collectTaskIds(data)];

  if (taskIds.length === 0) {
    return;
  }

  const tasks = await prisma.backlogTask.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, tenantId: true }
  });
  const foreignTask = tasks.find((task) => task.tenantId !== context.tenantId);

  if (foreignTask) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_task",
      entityId: foreignTask.id,
      requestedTenantId: foreignTask.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

function collectEmployeeIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectEmployeeIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    employeeId?: unknown;
    employee?: { connect?: { id?: unknown } };
  };

  if (typeof record.employeeId === "string") {
    ids.add(record.employeeId);
  }

  if (typeof record.employee?.connect?.id === "string") {
    ids.add(record.employee.connect.id);
  }

  return ids;
}

async function assertEmployeeTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const employeeIds = [...collectEmployeeIds(data)];

  if (employeeIds.length === 0) {
    return;
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, tenantId: true }
  });
  const foreignEmployee = employees.find(
    (employee) => employee.tenantId !== context.tenantId
  );

  if (foreignEmployee) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_employee",
      entityId: foreignEmployee.id,
      requestedTenantId: foreignEmployee.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

function collectSkillIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectSkillIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    skillId?: unknown;
    skill?: { connect?: { id?: unknown } };
  };

  if (typeof record.skillId === "string") {
    ids.add(record.skillId);
  }

  if (typeof record.skill?.connect?.id === "string") {
    ids.add(record.skill.connect.id);
  }

  return ids;
}

async function assertSkillTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const skillIds = [...collectSkillIds(data)];

  if (skillIds.length === 0) {
    return;
  }

  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds } },
    select: { id: true, tenantId: true }
  });
  const foreignSkill = skills.find((skill) => skill.tenantId !== context.tenantId);

  if (foreignSkill) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_skill",
      entityId: foreignSkill.id,
      requestedTenantId: foreignSkill.tenantId
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
      },
      project: {
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
      milestone: {
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
      sprint: {
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
      backlogTask: {
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
      employee: {
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
      skill: {
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
      capacity: {
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
          await assertCustomerTargetsTenant(prisma, context, "Contact", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Contact", args.data);
          await assertCustomerTargetsTenant(prisma, context, "Contact", args.data);

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
          await assertCustomerTargetsTenant(prisma, context, "Contact", args.data);
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
          await assertCustomerTargetsTenant(prisma, context, "Contact", args.data);

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
          await assertCustomerTargetsTenant(prisma, context, "Contact", args.create);
          await assertCustomerTargetsTenant(prisma, context, "Contact", args.update);
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
      project: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Project", args.data);
          await assertCustomerTargetsTenant(prisma, context, "Project", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Project", args.data);
          await assertCustomerTargetsTenant(prisma, context, "Project", args.data);

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

          return assertTenantResult(prisma, context, "Project", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Project", args.data);
          await assertCustomerTargetsTenant(prisma, context, "Project", args.data);
          await assertWhereTargetsTenant(prisma, context, "Project", args.where, (id) =>
            prisma.project.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Project", args.data);
          await assertCustomerTargetsTenant(prisma, context, "Project", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Project", args.where, (id) =>
            prisma.project.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Project", args.create);
          await assertTenantDataForWrite(prisma, context, "Project", args.update);
          await assertCustomerTargetsTenant(prisma, context, "Project", args.create);
          await assertCustomerTargetsTenant(prisma, context, "Project", args.update);
          await assertWhereTargetsTenant(prisma, context, "Project", args.where, (id) =>
            prisma.project.findUnique({
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
      milestone: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Milestone", args.data);
          await assertProjectTargetsTenant(prisma, context, "Milestone", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Milestone", args.data);
          await assertProjectTargetsTenant(prisma, context, "Milestone", args.data);

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

          return assertTenantResult(prisma, context, "Milestone", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Milestone", args.data);
          await assertProjectTargetsTenant(prisma, context, "Milestone", args.data);
          await assertWhereTargetsTenant(prisma, context, "Milestone", args.where, (id) =>
            prisma.milestone.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Milestone", args.data);
          await assertProjectTargetsTenant(prisma, context, "Milestone", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Milestone", args.where, (id) =>
            prisma.milestone.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Milestone", args.create);
          await assertTenantDataForWrite(prisma, context, "Milestone", args.update);
          await assertProjectTargetsTenant(prisma, context, "Milestone", args.create);
          await assertProjectTargetsTenant(prisma, context, "Milestone", args.update);
          await assertWhereTargetsTenant(prisma, context, "Milestone", args.where, (id) =>
            prisma.milestone.findUnique({
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
      sprint: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Sprint", args.data);
          await assertProjectTargetsTenant(prisma, context, "Sprint", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Sprint", args.data);
          await assertProjectTargetsTenant(prisma, context, "Sprint", args.data);

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

          return assertTenantResult(prisma, context, "Sprint", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Sprint", args.data);
          await assertProjectTargetsTenant(prisma, context, "Sprint", args.data);
          await assertWhereTargetsTenant(prisma, context, "Sprint", args.where, (id) =>
            prisma.sprint.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Sprint", args.data);
          await assertProjectTargetsTenant(prisma, context, "Sprint", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Sprint", args.where, (id) =>
            prisma.sprint.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Sprint", args.create);
          await assertTenantDataForWrite(prisma, context, "Sprint", args.update);
          await assertProjectTargetsTenant(prisma, context, "Sprint", args.create);
          await assertProjectTargetsTenant(prisma, context, "Sprint", args.update);
          await assertWhereTargetsTenant(prisma, context, "Sprint", args.where, (id) =>
            prisma.sprint.findUnique({
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
      backlogTask: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Task", args.data);
          await assertProjectTargetsTenant(prisma, context, "Task", args.data);
          await assertSprintTargetsTenant(prisma, context, "Task", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Task", args.data);
          await assertProjectTargetsTenant(prisma, context, "Task", args.data);
          await assertSprintTargetsTenant(prisma, context, "Task", args.data);

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

          return assertTenantResult(prisma, context, "Task", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Task", args.data);
          await assertProjectTargetsTenant(prisma, context, "Task", args.data);
          await assertSprintTargetsTenant(prisma, context, "Task", args.data);
          await assertWhereTargetsTenant(prisma, context, "Task", args.where, (id) =>
            prisma.backlogTask.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Task", args.data);
          await assertProjectTargetsTenant(prisma, context, "Task", args.data);
          await assertSprintTargetsTenant(prisma, context, "Task", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Task", args.where, (id) =>
            prisma.backlogTask.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Task", args.create);
          await assertTenantDataForWrite(prisma, context, "Task", args.update);
          await assertProjectTargetsTenant(prisma, context, "Task", args.create);
          await assertProjectTargetsTenant(prisma, context, "Task", args.update);
          await assertSprintTargetsTenant(prisma, context, "Task", args.create);
          await assertSprintTargetsTenant(prisma, context, "Task", args.update);
          await assertWhereTargetsTenant(prisma, context, "Task", args.where, (id) =>
            prisma.backlogTask.findUnique({
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
      taskChange: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "TaskChange", args.data);
          await assertTaskTargetsTenant(prisma, context, "TaskChange", args.data);
          await assertSprintTargetsTenant(prisma, context, "TaskChange", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "TaskChange", args.data);
          await assertTaskTargetsTenant(prisma, context, "TaskChange", args.data);
          await assertSprintTargetsTenant(prisma, context, "TaskChange", args.data);

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

          return assertTenantResult(prisma, context, "TaskChange", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantOnlyFilter(args, tenantId));
        },
        async update() {
          requireTenantContext();
          throw new Error("TaskChange is append-only");
        },
        async updateMany() {
          requireTenantContext();
          throw new Error("TaskChange is append-only");
        },
        async delete() {
          requireTenantContext();
          throw new Error("TaskChange is append-only");
        },
        async deleteMany() {
          requireTenantContext();
          throw new Error("TaskChange is append-only");
        }
      },
      employee: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Employee", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Employee", args.data);

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

          return assertTenantResult(prisma, context, "Employee", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Employee", args.data);
          await assertWhereTargetsTenant(prisma, context, "Employee", args.where, (id) =>
            prisma.employee.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Employee", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Employee", args.where, (id) =>
            prisma.employee.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query(applyTenantSoftDeleteFilter(args, context.tenantId));
        },
        async deleteMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        }
      },
      skill: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Skill", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Skill", args.data);

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

          return assertTenantResult(prisma, context, "Skill", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Skill", args.data);
          await assertWhereTargetsTenant(prisma, context, "Skill", args.where, (id) =>
            prisma.skill.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "Skill", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Skill", args.where, (id) =>
            prisma.skill.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query(applyTenantSoftDeleteFilter(args, context.tenantId));
        },
        async deleteMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        }
      },
      employeeSkill: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "EmployeeSkill", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "EmployeeSkill", args.data);
          await assertSkillTargetsTenant(prisma, context, "EmployeeSkill", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "EmployeeSkill", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "EmployeeSkill", args.data);
          await assertSkillTargetsTenant(prisma, context, "EmployeeSkill", args.data);

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

          return assertTenantResult(prisma, context, "EmployeeSkill", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantOnlyFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "EmployeeSkill", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "EmployeeSkill", args.data);
          await assertSkillTargetsTenant(prisma, context, "EmployeeSkill", args.data);
          await assertWhereTargetsTenant(prisma, context, "EmployeeSkill", args.where, (id) =>
            prisma.employeeSkill.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantOnlyFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "EmployeeSkill", args.where, (id) =>
            prisma.employeeSkill.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query(applyTenantOnlyFilter(args, context.tenantId));
        }
      },
      capacity: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Capacity", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "Capacity", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Capacity", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "Capacity", args.data);

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

          return assertTenantResult(prisma, context, "Capacity", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "Capacity", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "Capacity", args.data);
          await assertWhereTargetsTenant(prisma, context, "Capacity", args.where, (id) =>
            prisma.capacity.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "Capacity", args.where, (id) =>
            prisma.capacity.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query(applyTenantSoftDeleteFilter(args, context.tenantId));
        },
        async deleteMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
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
