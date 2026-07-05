/**
 * 演示 PnL 种子。
 * 负责写入项目实时盈亏快照，使 dashboard 可直接显示稳定财务数据。
 * 依赖：Prisma Decimal；被用于：seedDemoData。
 */
import { Prisma } from "@prisma/client";

import type { SystemPrismaClient } from "./types.js";

export async function upsertPnlSnapshot(
  prisma: SystemPrismaClient,
  input: { tenantId: string; projectId: string }
) {
  await prisma.pnLSnapshot.upsert({
    where: {
      tenantId_projectId: {
        tenantId: input.tenantId,
        projectId: input.projectId
      }
    },
    update: {
      revenue: new Prisma.Decimal("100000.00"),
      totalCost: new Prisma.Decimal("2080.00"),
      grossProfit: new Prisma.Decimal("97920.00"),
      grossMargin: new Prisma.Decimal("0.9792")
    },
    create: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      revenue: new Prisma.Decimal("100000.00"),
      totalCost: new Prisma.Decimal("2080.00"),
      grossProfit: new Prisma.Decimal("97920.00"),
      grossMargin: new Prisma.Decimal("0.9792")
    }
  });
}
