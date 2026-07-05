import { Injectable, NotFoundException } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";
import {
  createDomainEventBus,
  type DomainEvent,
  type DomainEventBus
} from "../../platform/events/domain-event-bus.js";

@Injectable()
export class CostEntryService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;
  private readonly unsubscribe: () => void;

  constructor(bus: DomainEventBus = createDomainEventBus()) {
    this.unsubscribe = bus.subscribe("time_entry.changed", (event) =>
      this.handleTimeEntryChanged(event)
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.unsubscribe();
    await this.prisma.$disconnect();
  }

  async getProjectCostSummary(input: { tenantId: string; projectId: string }) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: input.projectId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const entries = await this.prisma.costEntry.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        deletedAt: null
      },
      select: { type: true, amount: true }
    });
    const totalsByType: Record<string, number> = {};

    for (const entry of entries) {
      totalsByType[entry.type] =
        (totalsByType[entry.type] ?? 0) + Number(entry.amount);
    }

    return {
      projectId: input.projectId,
      totalsByType,
      totalCost: Object.values(totalsByType).reduce((sum, amount) => sum + amount, 0)
    };
  }

  private async handleTimeEntryChanged(event: DomainEvent) {
    const timeEntry = await this.prisma.timeEntry.findFirst({
      where: {
        id: event.aggregateId,
        tenantId: event.tenantId,
        deletedAt: null
      },
      include: {
        task: {
          select: {
            id: true,
            projectId: true
          }
        },
        employee: {
          select: {
            id: true,
            costRate: true,
            currency: true
          }
        }
      }
    });

    if (!timeEntry) {
      return;
    }

    const amount = timeEntry.hours.mul(timeEntry.employee.costRate);

    await this.prisma.costEntry.upsert({
      where: {
        tenantId_timeEntryId_type: {
          tenantId: timeEntry.tenantId,
          timeEntryId: timeEntry.id,
          type: "labor"
        }
      },
      create: {
        tenantId: timeEntry.tenantId,
        projectId: timeEntry.task.projectId,
        taskId: timeEntry.taskId,
        employeeId: timeEntry.employeeId,
        timeEntryId: timeEntry.id,
        type: "labor",
        amount,
        currency: timeEntry.employee.currency,
        quantityHours: timeEntry.hours,
        unitCostRate: timeEntry.employee.costRate,
        source: "TIME_ENTRY"
      },
      update: {
        projectId: timeEntry.task.projectId,
        taskId: timeEntry.taskId,
        employeeId: timeEntry.employeeId,
        amount,
        currency: timeEntry.employee.currency,
        quantityHours: timeEntry.hours,
        unitCostRate: timeEntry.employee.costRate,
        source: "TIME_ENTRY",
        deletedAt: null
      }
    });
  }
}
