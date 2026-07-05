/**
 * 项目任务看板工具。
 * 集中处理看板列到任务状态的映射、估算规范化、剩余估算查询和 task.changed 事件载荷，
 * 让 SprintService 保留 Sprint 生命周期与数据库编排边界。
 * 依赖：Prisma Decimal 与领域事件类型；被用于：SprintService 和看板单测。
 */
import { BadRequestException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

import type { DomainEventInput } from "../../platform/events/domain-event-bus.js";

export type BoardColumn = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

const BOARD_STATUS: Record<BoardColumn, BoardColumn> = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW: "REVIEW",
  DONE: "DONE"
};

interface TaskChangedInput {
  tenantId: string;
  taskId: string;
  sprintId?: string | null;
  fromStatus: string | null;
  toStatus: BoardColumn;
  remainingEstimateHours: Prisma.Decimal;
}

export function statusForColumn(boardColumn: BoardColumn): BoardColumn {
  const status = BOARD_STATUS[boardColumn];

  if (!status) {
    throw new BadRequestException("Unsupported board column");
  }

  return status;
}

export function requireEstimate(value: number): Prisma.Decimal {
  if (!Number.isFinite(value) || value < 0) {
    throw new BadRequestException("Task estimate must be a non-negative number");
  }

  return new Prisma.Decimal(value.toFixed(2));
}

export function optionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function getRemainingEstimateHours(
  prisma: Pick<PrismaClient, "backlogTask">,
  input: { tenantId: string; sprintId?: string | null }
): Promise<Prisma.Decimal> {
  if (!input.sprintId) {
    return new Prisma.Decimal(0);
  }

  const tasks = await prisma.backlogTask.findMany({
    where: {
      tenantId: input.tenantId,
      sprintId: input.sprintId,
      deletedAt: null,
      status: { not: "DONE" }
    },
    select: { estimateHours: true }
  });

  return tasks.reduce(
    (sum, task) => sum.plus(task.estimateHours),
    new Prisma.Decimal(0)
  );
}

export function buildTaskChangeData(input: TaskChangedInput) {
  return {
    tenantId: input.tenantId,
    taskId: input.taskId,
    sprintId: input.sprintId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    remainingEstimateHours: input.remainingEstimateHours
  };
}

export function buildTaskChangedEvent(input: TaskChangedInput): DomainEventInput {
  return {
    type: "task.changed",
    tenantId: input.tenantId,
    aggregateType: "Task",
    aggregateId: input.taskId,
    payload: {
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      remainingEstimateHours: input.remainingEstimateHours.toNumber()
    }
  };
}
