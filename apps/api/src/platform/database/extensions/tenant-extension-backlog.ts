// tenant-isolation-backlog
import { Prisma, type PrismaClient } from "@prisma/client";

import { requireTenantContext } from "../../tenant/tenant-context.js";
import { applyTenantData, assertTenantData, assertTenantDataForWrite, assertWhereTargetsTenant } from "../tenant-data.js";
import { applyTenantOnlyFilter, applyTenantSoftDeleteFilter } from "../tenant-filters.js";
import { assertTenantResult } from "../tenant-result.js";
import { assertProjectTargetsTenant, assertSprintTargetsTenant, assertTaskTargetsTenant } from "../tenant-guards-projects.js";

export function createBacklogTenantExtension(prisma: PrismaClient) {
  return Prisma.defineExtension({
    name: "tenant-isolation-backlog",
    query: {
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
    }
  });
}
