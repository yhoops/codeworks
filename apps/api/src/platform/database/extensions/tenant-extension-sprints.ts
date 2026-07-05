/**
 * tenant-extension-sprints.ts Prisma 租户隔离扩展。
 * 按业务域拆分 query hooks，使每组模型的租户过滤和关联 guard 可独立审查。
 * 依赖：租户上下文与数据库 guard；被用于：createPrismaClient 组合。
 */
// tenant-isolation-sprints
import { Prisma, type PrismaClient } from "@prisma/client";

import { requireTenantContext } from "../../tenant/tenant-context.js";
import { applyTenantData, assertTenantData, assertTenantDataForWrite, assertWhereTargetsTenant } from "../tenant-data.js";
import { applyTenantSoftDeleteFilter } from "../tenant-filters.js";
import { assertTenantResult } from "../tenant-result.js";
import { assertProjectTargetsTenant } from "../tenant-guards-projects.js";

export function createSprintsTenantExtension(prisma: PrismaClient) {
  return Prisma.defineExtension({
    name: "tenant-isolation-sprints",
    query: {
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
    }
  });
}
