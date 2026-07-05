/**
 * Sprint 生命周期编排服务。
 * 保留 Sprint/任务创建、任务移动和 burndown 查询的数据流编排，
 * 看板状态、估算和 task.changed 载荷细节委派给 task-board.util。
 * 依赖：系统 Prisma 客户端、领域事件和工时同步；被用于核心工作流控制器与项目测试。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import {
  assertPermission,
  type AuthzContext
} from "../../platform/authz/rbac.guard.js";
import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";
import {
  createDomainEventBus,
  type DomainEventBus,
  TransactionalDomainEvents
} from "../../platform/events/domain-event-bus.js";
import { syncDerivedTimeEntryFromTaskChange } from "../timesheets/time-entry.service.js";
import {
  type BoardColumn,
  buildTaskChangeData,
  buildTaskChangedEvent,
  getRemainingEstimateHours,
  optionalText,
  requireEstimate,
  statusForColumn
} from "./task-board.util.js";

export type { BoardColumn } from "./task-board.util.js";

@Injectable()
export class SprintService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;
  private readonly events: TransactionalDomainEvents;

  constructor(bus: DomainEventBus = createDomainEventBus()) {
    this.events = new TransactionalDomainEvents(bus);
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async createSprint(
    actor: AuthzContext,
    input: {
      tenantId: string;
      projectId: string;
      name: string;
      goal?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    await this.requireProject(input.tenantId, input.projectId);

    return this.prisma.sprint.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        name: this.requireText(input.name, "Sprint name is required"),
        goal: optionalText(input.goal),
        startDate: input.startDate,
        endDate: input.endDate
      }
    });
  }

  async createTask(
    actor: AuthzContext,
    input: {
      tenantId: string;
      projectId: string;
      sprintId?: string;
      title: string;
      description?: string;
      estimateHours: number;
      assigneeUserId?: string;
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    await this.requireProject(input.tenantId, input.projectId);

    if (input.sprintId) {
      await this.requireSprint(input.tenantId, input.sprintId, input.projectId);
    }

    const estimateHours = requireEstimate(input.estimateHours);

    return this.events.runInTransaction(this.prisma, async (tx, buffer) => {
      const task = await tx.backlogTask.create({
        data: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          sprintId: input.sprintId,
          title: this.requireText(input.title, "Task title is required"),
          description: optionalText(input.description),
          estimateHours,
          status: "TODO",
          boardColumn: "TODO",
          assigneeUserId: input.assigneeUserId
        }
      });
      const remainingEstimateHours = await getRemainingEstimateHours(tx, {
        tenantId: input.tenantId,
        sprintId: input.sprintId
      });

      await tx.taskChange.create({
        data: buildTaskChangeData({
          tenantId: input.tenantId,
          taskId: task.id,
          sprintId: input.sprintId,
          fromStatus: null,
          toStatus: "TODO",
          remainingEstimateHours
        })
      });
      buffer.record(buildTaskChangedEvent({
        tenantId: input.tenantId,
        taskId: task.id,
        sprintId: input.sprintId,
        fromStatus: null,
        toStatus: "TODO",
        remainingEstimateHours
      }));

      return task;
    });
  }

  async moveTask(
    actor: AuthzContext,
    input: {
      tenantId: string;
      taskId: string;
      boardColumn: BoardColumn;
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    const toStatus = statusForColumn(input.boardColumn);
    const task = await this.requireTask(input.tenantId, input.taskId);

    return this.events.runInTransaction(this.prisma, async (tx, buffer) => {
      const updated = await tx.backlogTask.update({
        where: { id: input.taskId },
        data: {
          status: toStatus,
          boardColumn: input.boardColumn
        }
      });
      const remainingEstimateHours = await getRemainingEstimateHours(tx, {
        tenantId: input.tenantId,
        sprintId: task.sprintId
      });

      await tx.taskChange.create({
        data: buildTaskChangeData({
          tenantId: input.tenantId,
          taskId: task.id,
          sprintId: task.sprintId,
          fromStatus: task.status,
          toStatus,
          remainingEstimateHours
        })
      });
      buffer.record(buildTaskChangedEvent({
        tenantId: input.tenantId,
        taskId: task.id,
        sprintId: task.sprintId,
        fromStatus: task.status,
        toStatus,
        remainingEstimateHours
      }));
      await syncDerivedTimeEntryFromTaskChange(tx, buffer, {
        tenantId: input.tenantId,
        task,
        toStatus
      });

      return updated;
    });
  }

  async getBurndown(input: { tenantId: string; sprintId: string }) {
    await this.requireSprint(input.tenantId, input.sprintId);
    const [tasks, changes] = await Promise.all([
      this.prisma.backlogTask.findMany({
        where: {
          tenantId: input.tenantId,
          sprintId: input.sprintId,
          deletedAt: null
        }
      }),
      this.prisma.taskChange.findMany({
        where: {
          tenantId: input.tenantId,
          sprintId: input.sprintId
        },
        orderBy: [{ changedAt: "asc" }, { id: "asc" }]
      })
    ]);

    const totalEstimateHours = tasks.reduce(
      (sum, task) => sum + Number(task.estimateHours),
      0
    );
    const remainingEstimateHours = tasks
      .filter((task) => task.status !== "DONE")
      .reduce((sum, task) => sum + Number(task.estimateHours), 0);

    return {
      sprintId: input.sprintId,
      totalEstimateHours,
      remainingEstimateHours,
      points: changes.map((change) => ({
        changedAt: change.changedAt,
        remainingEstimateHours: Number(change.remainingEstimateHours)
      }))
    };
  }

  private async requireProject(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
        deletedAt: null
      }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  private async requireSprint(
    tenantId: string,
    sprintId: string,
    projectId?: string
  ) {
    const sprint = await this.prisma.sprint.findFirst({
      where: {
        id: sprintId,
        tenantId,
        ...(projectId ? { projectId } : {}),
        deletedAt: null
      }
    });

    if (!sprint) {
      throw new NotFoundException("Sprint not found");
    }

    return sprint;
  }

  private async requireTask(tenantId: string, taskId: string) {
    const task = await this.prisma.backlogTask.findFirst({
      where: {
        id: taskId,
        tenantId,
        deletedAt: null
      }
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return task;
  }

  private assertProjectWrite(actor: AuthzContext, tenantId: string) {
    if (actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant access denied");
    }

    assertPermission(actor, "project.write");
  }

  private requireText(value: string, message: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }
}
