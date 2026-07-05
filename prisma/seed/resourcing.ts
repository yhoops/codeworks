/**
 * 演示资源与排期种子。
 * 负责 demo 员工、产能和资源排期的可重复 upsert。
 * 依赖：Prisma Decimal 与 resourcing 常量；被用于：seedDemoData。
 */
import { Prisma } from "@prisma/client";

import { DEMO_EMPLOYEE_EMAIL, DEMO_WEEK_START } from "./constants.js";
import type { SystemPrismaClient } from "./types.js";

export async function upsertEmployee(prisma: SystemPrismaClient, tenantId: string) {
  return prisma.employee.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: DEMO_EMPLOYEE_EMAIL
      }
    },
    update: {
      name: "Lin Demo",
      costRate: new Prisma.Decimal("320.00"),
      currency: "CNY",
      deletedAt: null
    },
    create: {
      tenantId,
      name: "Lin Demo",
      email: DEMO_EMPLOYEE_EMAIL,
      costRate: new Prisma.Decimal("320.00"),
      currency: "CNY"
    }
  });
}

export async function upsertCapacity(
  prisma: SystemPrismaClient,
  input: { tenantId: string; employeeId: string }
) {
  await prisma.capacity.upsert({
    where: { id: `${input.employeeId}:demo-capacity` },
    update: {
      weeklyHours: new Prisma.Decimal("40.00"),
      effectiveFrom: DEMO_WEEK_START,
      effectiveTo: null,
      deletedAt: null
    },
    create: {
      id: `${input.employeeId}:demo-capacity`,
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      weeklyHours: new Prisma.Decimal("40.00"),
      effectiveFrom: DEMO_WEEK_START
    }
  });
}

export async function upsertAllocation(
  prisma: SystemPrismaClient,
  input: {
    tenantId: string;
    employeeId: string;
    projectId: string;
    taskId: string;
  }
) {
  const existing = await prisma.resourceAllocation.findFirst({
    where: {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      projectId: input.projectId,
      taskId: input.taskId,
      weekStart: DEMO_WEEK_START
    }
  });
  const data = {
    plannedHours: new Prisma.Decimal("44.00"),
    availableHoursOverride: new Prisma.Decimal("40.00"),
    isOverloaded: true,
    deletedAt: null
  };

  if (existing) {
    return prisma.resourceAllocation.update({ where: { id: existing.id }, data });
  }

  return prisma.resourceAllocation.create({
    data: {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      projectId: input.projectId,
      taskId: input.taskId,
      weekStart: DEMO_WEEK_START,
      ...data
    }
  });
}
