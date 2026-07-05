/**
 * 演示成本与预算种子。
 * 负责清理演示财务副作用、写入工时、成本和预算记录。
 * 依赖：Prisma Decimal；被用于：seedDemoData。
 */
import { Prisma } from "@prisma/client";

import type { SystemPrismaClient } from "./types.js";

export async function resetDemoFinancials(
  prisma: SystemPrismaClient,
  input: { tenantId: string; projectId: string; taskIds: string[] }
) {
  await prisma.costEntry.deleteMany({
    where: {
      tenantId: input.tenantId,
      projectId: input.projectId
    }
  });
  await prisma.timeEntry.deleteMany({
    where: {
      tenantId: input.tenantId,
      taskId: { in: input.taskIds }
    }
  });
  await prisma.resourceAllocation.deleteMany({
    where: {
      tenantId: input.tenantId,
      projectId: input.projectId
    }
  });
}

export async function upsertDemoTimeAndCost(
  prisma: SystemPrismaClient,
  input: {
    tenantId: string;
    projectId: string;
    taskId: string;
    employeeId: string;
    userId: string;
  }
) {
  const timeEntry = await prisma.timeEntry.upsert({
    where: {
      tenantId_taskId_employeeId: {
        tenantId: input.tenantId,
        taskId: input.taskId,
        employeeId: input.employeeId
      }
    },
    update: {
      hours: new Prisma.Decimal("6.50"),
      source: "DEMO_SEED",
      note: "Demo labor booked against completed scope work.",
      correctedByUserId: input.userId,
      correctedAt: new Date("2026-07-07T10:00:00.000Z"),
      deletedAt: null
    },
    create: {
      tenantId: input.tenantId,
      taskId: input.taskId,
      employeeId: input.employeeId,
      hours: new Prisma.Decimal("6.50"),
      source: "DEMO_SEED",
      note: "Demo labor booked against completed scope work.",
      correctedByUserId: input.userId,
      correctedAt: new Date("2026-07-07T10:00:00.000Z")
    }
  });

  await prisma.costEntry.upsert({
    where: {
      tenantId_timeEntryId_type: {
        tenantId: input.tenantId,
        timeEntryId: timeEntry.id,
        type: "labor"
      }
    },
    update: {
      projectId: input.projectId,
      taskId: input.taskId,
      employeeId: input.employeeId,
      amount: new Prisma.Decimal("2080.00"),
      currency: "CNY",
      quantityHours: new Prisma.Decimal("6.50"),
      unitCostRate: new Prisma.Decimal("320.00"),
      source: "DEMO_SEED",
      deletedAt: null
    },
    create: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      taskId: input.taskId,
      employeeId: input.employeeId,
      timeEntryId: timeEntry.id,
      type: "labor",
      amount: new Prisma.Decimal("2080.00"),
      currency: "CNY",
      quantityHours: new Prisma.Decimal("6.50"),
      unitCostRate: new Prisma.Decimal("320.00"),
      source: "DEMO_SEED"
    }
  });
}

export async function upsertBudget(
  prisma: SystemPrismaClient,
  input: { tenantId: string; projectId: string; userId: string }
) {
  await prisma.budget.upsert({
    where: {
      tenantId_name: {
        tenantId: input.tenantId,
        name: "MVP Demo Budget"
      }
    },
    update: {
      projectId: input.projectId,
      amount: new Prisma.Decimal("100000.00"),
      currency: "CNY",
      updatedBy: input.userId,
      deletedAt: null
    },
    create: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      name: "MVP Demo Budget",
      amount: new Prisma.Decimal("100000.00"),
      currency: "CNY",
      createdBy: input.userId,
      updatedBy: input.userId
    }
  });
}
