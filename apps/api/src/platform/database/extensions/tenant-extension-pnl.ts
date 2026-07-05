// tenant-isolation-pnl
import { Prisma, type PrismaClient } from "@prisma/client";

import { requireTenantContext } from "../../tenant/tenant-context.js";
import { applyTenantData, assertTenantData, assertTenantDataForWrite, assertWhereTargetsTenant } from "../tenant-data.js";
import { applyTenantOnlyFilter } from "../tenant-filters.js";
import { assertTenantResult } from "../tenant-result.js";
import { assertProjectTargetsTenant } from "../tenant-guards-projects.js";

export function createPnlTenantExtension(prisma: PrismaClient) {
  return Prisma.defineExtension({
    name: "tenant-isolation-pnl",
    query: {
      pnLSnapshot: {
        async create({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "PnLSnapshot", args.data);
          await assertProjectTargetsTenant(prisma, context, "PnLSnapshot", args.data);

          return query({
            ...args,
            data: applyTenantData(args.data, context.tenantId) as typeof args.data
          });
        },
        async createMany({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "PnLSnapshot", args.data);
          await assertProjectTargetsTenant(prisma, context, "PnLSnapshot", args.data);

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

          return assertTenantResult(prisma, context, "PnLSnapshot", result);
        },
        async count({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantOnlyFilter(args, tenantId));
        },
        async update({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "PnLSnapshot", args.data);
          await assertProjectTargetsTenant(prisma, context, "PnLSnapshot", args.data);
          await assertWhereTargetsTenant(
            prisma,
            context,
            "PnLSnapshot",
            args.where,
            (id) =>
              prisma.pnLSnapshot.findUnique({
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

          await assertWhereTargetsTenant(
            prisma,
            context,
            "PnLSnapshot",
            args.where,
            (id) =>
              prisma.pnLSnapshot.findUnique({
                where: { id },
                select: { id: true, tenantId: true }
              })
          );

          return query(applyTenantOnlyFilter(args, context.tenantId));
        },
        async deleteMany({ args, query }) {
          const { tenantId } = requireTenantContext();
          return query(applyTenantOnlyFilter(args, tenantId));
        },
        async upsert({ args, query }) {
          const context = requireTenantContext();

          await assertTenantDataForWrite(prisma, context, "PnLSnapshot", args.create);
          await assertTenantDataForWrite(prisma, context, "PnLSnapshot", args.update);
          await assertProjectTargetsTenant(prisma, context, "PnLSnapshot", args.create);
          await assertProjectTargetsTenant(prisma, context, "PnLSnapshot", args.update);
          await assertWhereTargetsTenant(
            prisma,
            context,
            "PnLSnapshot",
            args.where,
            (id) =>
              prisma.pnLSnapshot.findUnique({
                where: { id },
                select: { id: true, tenantId: true }
              })
          );

          return query({
            ...applyTenantOnlyFilter(args, context.tenantId),
            create: applyTenantData(args.create, context.tenantId) as typeof args.create,
            update: assertTenantData(args.update, context.tenantId) as typeof args.update
          });
        }
      },
    }
  });
}
