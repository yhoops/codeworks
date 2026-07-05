/**
 * time-entry.service.ts 领域服务。
 * 封装单一业务能力的数据库读写与校验，避免控制器和其他模块重复组织查询。
 * 依赖：Prisma 客户端与领域类型；被用于：控制器、种子或测试。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient, type TimeEntry } from "@prisma/client";

import {
  canPerform,
  type AuthzContext
} from "../../platform/authz/rbac.guard.js";
import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";
import {
  createDomainEventBus,
  type DomainEventBuffer,
  type DomainEventBus,
  TransactionalDomainEvents
} from "../../platform/events/domain-event-bus.js";

export type TimeEntrySource = "AUTO" | "MANUAL";

type TimeEntryTransaction = Pick<
  Prisma.TransactionClient,
  "auditLog" | "backlogTask" | "employee" | "timeEntry"
>;

type TaskForTimeEntry = {
  id: string;
  tenantId: string;
  estimateHours: Prisma.Decimal;
  assigneeUserId: string | null;
};

export async function syncDerivedTimeEntryFromTaskChange(
  tx: TimeEntryTransaction,
  buffer: DomainEventBuffer,
  input: {
    tenantId: string;
    task: TaskForTimeEntry;
    toStatus: string;
  }
) {
  const employeeId = input.task.assigneeUserId;

  if (!employeeId) {
    return null;
  }

  const employee = await tx.employee.findFirst({
    where: {
      id: employeeId,
      tenantId: input.tenantId,
      deletedAt: null
    },
    select: { id: true }
  });

  if (!employee) {
    return null;
  }

  const hours =
    input.toStatus === "DONE" ? input.task.estimateHours : new Prisma.Decimal(0);
  const existing = await tx.timeEntry.findUnique({
    where: {
      tenantId_taskId_employeeId: {
        tenantId: input.tenantId,
        taskId: input.task.id,
        employeeId
      }
    }
  });

  if (existing?.source === "MANUAL") {
    return existing;
  }

  const entry = existing
    ? await tx.timeEntry.update({
        where: { id: existing.id },
        data: {
          hours,
          source: "AUTO",
          note: null,
          correctedByUserId: null,
          correctedAt: null,
          deletedAt: null
        }
      })
    : await tx.timeEntry.create({
        data: {
          tenantId: input.tenantId,
          taskId: input.task.id,
          employeeId,
          hours,
          source: "AUTO"
        }
      });

  recordTimeEntryChanged(buffer, entry, {
    beforeHours: existing ? Number(existing.hours) : null
  });
  return entry;
}

@Injectable()
export class TimeEntryService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;
  private readonly events: TransactionalDomainEvents;

  constructor(bus: DomainEventBus = createDomainEventBus()) {
    this.events = new TransactionalDomainEvents(bus);
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async correctTimeEntry(
    actor: AuthzContext,
    input: {
      tenantId: string;
      taskId: string;
      employeeId: string;
      hours: number;
      note?: string;
    }
  ) {
    this.assertTenant(actor, input.tenantId);
    this.assertCanCorrect(actor, input.employeeId);
    const hours = this.requireHours(input.hours);
    const note = this.optionalText(input.note);

    return this.events.runInTransaction(this.prisma, async (tx, buffer) => {
      const [task, employee] = await Promise.all([
        tx.backlogTask.findFirst({
          where: {
            id: input.taskId,
            tenantId: input.tenantId,
            deletedAt: null
          },
          select: { id: true }
        }),
        tx.employee.findFirst({
          where: {
            id: input.employeeId,
            tenantId: input.tenantId,
            deletedAt: null
          },
          select: { id: true }
        })
      ]);

      if (!task) {
        throw new NotFoundException("Task not found");
      }

      if (!employee) {
        throw new NotFoundException("Employee not found");
      }

      const existing = await tx.timeEntry.findUnique({
        where: {
          tenantId_taskId_employeeId: {
            tenantId: input.tenantId,
            taskId: input.taskId,
            employeeId: input.employeeId
          }
        }
      });
      const beforeHours = existing ? Number(existing.hours) : null;
      const entry = existing
        ? await tx.timeEntry.update({
            where: { id: existing.id },
            data: {
              hours,
              source: "MANUAL",
              note,
              correctedByUserId: actor.userId,
              correctedAt: new Date(),
              deletedAt: null
            }
          })
        : await tx.timeEntry.create({
            data: {
              tenantId: input.tenantId,
              taskId: input.taskId,
              employeeId: input.employeeId,
              hours,
              source: "MANUAL",
              note,
              correctedByUserId: actor.userId,
              correctedAt: new Date()
            }
          });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: actor.userId,
          action: "TIME_ENTRY_CORRECTED",
          entityType: "TimeEntry",
          entityId: entry.id,
          details: {
            before: { hours: beforeHours },
            after: { hours: Number(entry.hours), note }
          }
        }
      });
      recordTimeEntryChanged(buffer, entry, { beforeHours });

      return entry;
    });
  }

  private assertTenant(actor: AuthzContext, tenantId: string) {
    if (actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant access denied");
    }
  }

  private assertCanCorrect(actor: AuthzContext, employeeId: string) {
    if (canPerform(actor, "project.write") || actor.userId === employeeId) {
      return;
    }

    throw new ForbiddenException("Time entry correction denied");
  }

  private requireHours(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException("Time entry hours must be a non-negative number");
    }

    return new Prisma.Decimal(value.toFixed(2));
  }

  private optionalText(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}

function recordTimeEntryChanged(
  buffer: DomainEventBuffer,
  entry: TimeEntry,
  input: { beforeHours: number | null }
) {
  buffer.record({
    type: "time_entry.changed",
    tenantId: entry.tenantId,
    aggregateType: "TimeEntry",
    aggregateId: entry.id,
    payload: {
      taskId: entry.taskId,
      employeeId: entry.employeeId,
      beforeHours: input.beforeHours,
      hours: Number(entry.hours),
      source: entry.source
    }
  });
}
