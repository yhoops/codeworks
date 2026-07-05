/**
 * 演示项目与任务种子。
 * 负责 demo 项目、Sprint 和 backlog task 的可重复 upsert。
 * 依赖：Prisma Decimal 与项目常量；被用于：seedDemoData。
 */
import { Prisma } from "@prisma/client";

import { DEMO_PROJECT_NAME, DEMO_SPRINT_NAME, DEMO_WEEK_START } from "./constants.js";
import type { SystemPrismaClient } from "./types.js";

export async function upsertProject(
  prisma: SystemPrismaClient,
  input: { tenantId: string; customerId: string; projectManagerId: string }
) {
  const existing = await prisma.project.findFirst({
    where: { tenantId: input.tenantId, name: DEMO_PROJECT_NAME }
  });
  const data = {
    customerId: input.customerId,
    status: "ACTIVE",
    source: "DEMO_SEED",
    projectManagerId: input.projectManagerId,
    deletedAt: null
  };

  if (existing) {
    return prisma.project.update({ where: { id: existing.id }, data });
  }

  return prisma.project.create({
    data: {
      tenantId: input.tenantId,
      name: DEMO_PROJECT_NAME,
      ...data
    }
  });
}

export async function upsertSprint(
  prisma: SystemPrismaClient,
  input: { tenantId: string; projectId: string }
) {
  const existing = await prisma.sprint.findFirst({
    where: { tenantId: input.tenantId, projectId: input.projectId, name: DEMO_SPRINT_NAME }
  });
  const data = {
    goal: "Demonstrate lead-to-delivery execution with live cost feedback.",
    status: "ACTIVE",
    startDate: DEMO_WEEK_START,
    endDate: new Date("2026-07-17T00:00:00.000Z"),
    deletedAt: null
  };

  if (existing) {
    return prisma.sprint.update({ where: { id: existing.id }, data });
  }

  return prisma.sprint.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      name: DEMO_SPRINT_NAME,
      ...data
    }
  });
}

export async function upsertTask(
  prisma: SystemPrismaClient,
  input: {
    tenantId: string;
    projectId: string;
    sprintId: string;
    title: string;
    description: string;
    estimateHours: string;
    status: string;
    boardColumn: string;
    assigneeUserId: string;
  }
) {
  const existing = await prisma.backlogTask.findFirst({
    where: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      title: input.title
    }
  });
  const data = {
    sprintId: input.sprintId,
    description: input.description,
    estimateHours: new Prisma.Decimal(input.estimateHours),
    status: input.status,
    boardColumn: input.boardColumn,
    assigneeUserId: input.assigneeUserId,
    deletedAt: null
  };

  if (existing) {
    return prisma.backlogTask.update({ where: { id: existing.id }, data });
  }

  return prisma.backlogTask.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      title: input.title,
      ...data
    }
  });
}
