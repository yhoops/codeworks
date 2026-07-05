/**
 * tenant-extension-costing.ts Prisma 租户隔离扩展。
 * 按业务域拆分 query hooks，使每组模型的租户过滤和关联 guard 可独立审查。
 * 依赖：租户上下文与数据库 guard；被用于：createPrismaClient 组合。
 */
// tenant-isolation-costing
import { Prisma, type PrismaClient } from "@prisma/client";

import { requireTenantContext } from "../../tenant/tenant-context.js";
import { applyTenantData, assertTenantData, assertTenantDataForWrite, assertWhereTargetsTenant } from "../tenant-data.js";
import { applyTenantSoftDeleteFilter } from "../tenant-filters.js";
import { assertTenantResult } from "../tenant-result.js";
import { assertEmployeeTargetsTenant } from "../tenant-guards-resourcing.js";
import { assertProjectTargetsTenant, assertTaskTargetsTenant } from "../tenant-guards-projects.js";
import { assertTimeEntryTargetsTenant } from "../tenant-guards-costing.js";

export function createCostingTenantExtension(prisma: PrismaClient) {
  return Prisma.defineExtension({
    name: "tenant-isolation-costing",
    query: {
      timeEntry: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "TimeEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "TimeEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "TimeEntry", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "TimeEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "TimeEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "TimeEntry", args.data);

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

          return assertTenantResult(prisma, context, "TimeEntry", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "TimeEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "TimeEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "TimeEntry", args.data);
          await assertWhereTargetsTenant(prisma, context, "TimeEntry", args.where, (id) =>
            prisma.timeEntry.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "TimeEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "TimeEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "TimeEntry", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "TimeEntry", args.where, (id) =>
            prisma.timeEntry.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "TimeEntry", args.create);
          await assertTenantDataForWrite(prisma, context, "TimeEntry", args.update);
          await assertTaskTargetsTenant(prisma, context, "TimeEntry", args.create);
          await assertTaskTargetsTenant(prisma, context, "TimeEntry", args.update);
          await assertEmployeeTargetsTenant(prisma, context, "TimeEntry", args.create);
          await assertEmployeeTargetsTenant(prisma, context, "TimeEntry", args.update);
          await assertWhereTargetsTenant(prisma, context, "TimeEntry", args.where, (id) =>
            prisma.timeEntry.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            create: applyTenantData(args.create, context.tenantId) as typeof args.create,
            update: assertTenantData(args.update, context.tenantId) as typeof args.update
          });
        }
      },
      costEntry: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "CostEntry", args.data);
          await assertProjectTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTimeEntryTargetsTenant(prisma, context, "CostEntry", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "CostEntry", args.data);
          await assertProjectTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTimeEntryTargetsTenant(prisma, context, "CostEntry", args.data);

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

          return assertTenantResult(prisma, context, "CostEntry", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "CostEntry", args.data);
          await assertProjectTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTimeEntryTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertWhereTargetsTenant(prisma, context, "CostEntry", args.where, (id) =>
            prisma.costEntry.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "CostEntry", args.data);
          await assertProjectTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTaskTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "CostEntry", args.data);
          await assertTimeEntryTargetsTenant(prisma, context, "CostEntry", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(prisma, context, "CostEntry", args.where, (id) =>
            prisma.costEntry.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "CostEntry", args.create);
          await assertTenantDataForWrite(prisma, context, "CostEntry", args.update);
          await assertProjectTargetsTenant(prisma, context, "CostEntry", args.create);
          await assertProjectTargetsTenant(prisma, context, "CostEntry", args.update);
          await assertTaskTargetsTenant(prisma, context, "CostEntry", args.create);
          await assertTaskTargetsTenant(prisma, context, "CostEntry", args.update);
          await assertEmployeeTargetsTenant(prisma, context, "CostEntry", args.create);
          await assertEmployeeTargetsTenant(prisma, context, "CostEntry", args.update);
          await assertTimeEntryTargetsTenant(prisma, context, "CostEntry", args.create);
          await assertTimeEntryTargetsTenant(prisma, context, "CostEntry", args.update);
          await assertWhereTargetsTenant(prisma, context, "CostEntry", args.where, (id) =>
            prisma.costEntry.findUnique({
              where: { id },
              select: { id: true, tenantId: true }
            })
          );

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            create: applyTenantData(args.create, context.tenantId) as typeof args.create,
            update: assertTenantData(args.update, context.tenantId) as typeof args.update
          });
        }
      },
    }
  });
}
