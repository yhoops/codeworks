/**
 * tenant-extension-resourcing.ts Prisma 租户隔离扩展。
 * 按业务域拆分 query hooks，使每组模型的租户过滤和关联 guard 可独立审查。
 * 依赖：租户上下文与数据库 guard；被用于：createPrismaClient 组合。
 */
// tenant-isolation-resourcing
import { Prisma, type PrismaClient } from "@prisma/client";

import { requireTenantContext } from "../../tenant/tenant-context.js";
import { applyTenantData, assertTenantData, assertTenantDataForWrite, assertWhereTargetsTenant } from "../tenant-data.js";
import { applyTenantSoftDeleteFilter } from "../tenant-filters.js";
import { assertTenantResult } from "../tenant-result.js";
import { assertEmployeeTargetsTenant } from "../tenant-guards-resourcing.js";
import { assertProjectTargetsTenant, assertTaskTargetsTenant } from "../tenant-guards-projects.js";

export function createResourcingTenantExtension(prisma: PrismaClient) {
  return Prisma.defineExtension({
    name: "tenant-isolation-resourcing",
    query: {
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
      resourceAllocation: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "ResourceAllocation", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertProjectTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertTaskTargetsTenant(prisma, context, "ResourceAllocation", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "ResourceAllocation", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertProjectTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertTaskTargetsTenant(prisma, context, "ResourceAllocation", args.data);

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

          return assertTenantResult(prisma, context, "ResourceAllocation", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantSoftDeleteFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "ResourceAllocation", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertProjectTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertTaskTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertWhereTargetsTenant(
            prisma,
            context,
            "ResourceAllocation",
            args.where,
            (id) =>
              prisma.resourceAllocation.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "ResourceAllocation", args.data);
          await assertEmployeeTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertProjectTargetsTenant(prisma, context, "ResourceAllocation", args.data);
          await assertTaskTargetsTenant(prisma, context, "ResourceAllocation", args.data);

          return query({
            ...applyTenantSoftDeleteFilter(args, context.tenantId),
            data: assertTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async delete({ args, query }) {
          const context = requireTenantContext();

          await assertWhereTargetsTenant(
            prisma,
            context,
            "ResourceAllocation",
            args.where,
            (id) =>
              prisma.resourceAllocation.findUnique({
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

          await assertTenantDataForWrite(prisma, context, "ResourceAllocation", args.create);
          await assertTenantDataForWrite(prisma, context, "ResourceAllocation", args.update);
          await assertEmployeeTargetsTenant(prisma, context, "ResourceAllocation", args.create);
          await assertEmployeeTargetsTenant(prisma, context, "ResourceAllocation", args.update);
          await assertProjectTargetsTenant(prisma, context, "ResourceAllocation", args.create);
          await assertProjectTargetsTenant(prisma, context, "ResourceAllocation", args.update);
          await assertTaskTargetsTenant(prisma, context, "ResourceAllocation", args.create);
          await assertTaskTargetsTenant(prisma, context, "ResourceAllocation", args.update);
          await assertWhereTargetsTenant(
            prisma,
            context,
            "ResourceAllocation",
            args.where,
            (id) =>
              prisma.resourceAllocation.findUnique({
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
