import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";
import { PnlService } from "../costing/pnl.service.js";
import { AuthService } from "../iam/auth/auth.service.js";
import { SprintService, type BoardColumn } from "../projects/sprint.service.js";
import { AllocationService } from "../resourcing/allocation.service.js";
import { TimeEntryService } from "../timesheets/time-entry.service.js";

@Controller("core")
export class CoreWorkflowController {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;

  constructor(
    private readonly authService: AuthService,
    private readonly sprintService: SprintService,
    private readonly timeEntryService: TimeEntryService,
    private readonly allocationService: AllocationService,
    private readonly pnlService: PnlService
  ) {}

  @Get("dashboard")
  async dashboard(@Headers("authorization") authorization?: string) {
    const actor = await this.requireActor(authorization);
    const projects = await this.prisma.project.findMany({
      where: { tenantId: actor.tenantId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }]
    });
    const dashboardProjects = await Promise.all(
      projects.map(async (project) => {
        const [pnl, utilization] = await Promise.all([
          this.pnlService.getRealtimeProjectPnl({
            tenantId: actor.tenantId,
            projectId: project.id
          }),
          this.getProjectUtilization(actor.tenantId, project.id)
        ]);

        return {
          id: project.id,
          name: project.name,
          revenue: pnl.revenue,
          totalCost: pnl.totalCost,
          grossProfit: pnl.grossProfit,
          grossMargin: pnl.grossMargin,
          overBudget: pnl.revenue > 0 && pnl.totalCost > pnl.revenue,
          utilization
        };
      })
    );

    return { projects: dashboardProjects };
  }

  @Get("workspace")
  async workspace(@Headers("authorization") authorization?: string) {
    const actor = await this.requireActor(authorization);
    const [projects, tasks, employees, timeEntries, allocations] = await Promise.all([
      this.prisma.project.findMany({
        where: { tenantId: actor.tenantId, deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }]
      }),
      this.prisma.backlogTask.findMany({
        where: { tenantId: actor.tenantId, deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { title: "asc" }]
      }),
      this.prisma.employee.findMany({
        where: { tenantId: actor.tenantId, deletedAt: null },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.timeEntry.findMany({
        where: { tenantId: actor.tenantId, deletedAt: null },
        orderBy: [{ correctedAt: "desc" }, { createdAt: "desc" }]
      }),
      this.prisma.resourceAllocation.findMany({
        where: { tenantId: actor.tenantId, deletedAt: null },
        orderBy: [{ weekStart: "asc" }, { createdAt: "asc" }]
      })
    ]);

    return {
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status
      })),
      tasks: tasks.map((task) => this.serializeTask(task)),
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        email: employee.email
      })),
      timeEntries: timeEntries.map((entry) => this.serializeTimeEntry(entry)),
      allocations: allocations.map((allocation) => this.serializeAllocation(allocation))
    };
  }

  @Patch("tasks/:taskId/move")
  async moveTask(
    @Headers("authorization") authorization: string | undefined,
    @Param("taskId") taskId: string,
    @Body() body: { boardColumn: BoardColumn }
  ) {
    const actor = await this.requireActor(authorization);
    const task = await this.sprintService.moveTask(actor, {
      tenantId: actor.tenantId,
      taskId,
      boardColumn: body.boardColumn
    });
    const timeEntry = await this.prisma.timeEntry.findFirst({
      where: {
        tenantId: actor.tenantId,
        taskId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    return {
      task: this.serializeTask(task),
      timeEntry: timeEntry ? this.serializeTimeEntry(timeEntry) : null
    };
  }

  @Patch("time-entries")
  async correctTimeEntry(
    @Headers("authorization") authorization: string | undefined,
    @Body()
    body: {
      taskId: string;
      employeeId: string;
      hours: number;
      note?: string;
    }
  ) {
    const actor = await this.requireActor(authorization);
    const timeEntry = await this.timeEntryService.correctTimeEntry(actor, {
      tenantId: actor.tenantId,
      ...body
    });

    return { timeEntry: this.serializeTimeEntry(timeEntry) };
  }

  @Post("allocations")
  async scheduleAllocation(
    @Headers("authorization") authorization: string | undefined,
    @Body()
    body: {
      employeeId: string;
      projectId: string;
      taskId?: string;
      weekStart: string;
      plannedHours: number;
      availableHoursOverride?: number;
    }
  ) {
    const actor = await this.requireActor(authorization);
    const weekStart = new Date(body.weekStart);
    const allocation = await this.allocationService.scheduleAllocation(actor, {
      tenantId: actor.tenantId,
      employeeId: body.employeeId,
      projectId: body.projectId,
      taskId: body.taskId,
      weekStart,
      plannedHours: body.plannedHours,
      availableHoursOverride: body.availableHoursOverride
    });
    const utilization = await this.allocationService.getWeeklyUtilization({
      tenantId: actor.tenantId,
      employeeId: body.employeeId,
      weekStart
    });

    return {
      allocation: this.serializeAllocation(allocation),
      utilization
    };
  }

  private async requireActor(authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    return this.authService.authenticateActor(token);
  }

  private async getProjectUtilization(tenantId: string, projectId: string) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: { tenantId, projectId, deletedAt: null },
      orderBy: [{ weekStart: "asc" }, { createdAt: "asc" }]
    });
    const employeeIds = [...new Set(allocations.map((allocation) => allocation.employeeId))];
    const capacities = await this.prisma.capacity.findMany({
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        deletedAt: null
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }]
    });
    const capacityByEmployee = new Map<string, number>();

    for (const capacity of capacities) {
      if (!capacityByEmployee.has(capacity.employeeId)) {
        capacityByEmployee.set(capacity.employeeId, Number(capacity.weeklyHours));
      }
    }

    const buckets = new Map<string, { plannedHours: number; availableHours: number }>();

    for (const allocation of allocations) {
      const key = `${allocation.employeeId}:${allocation.weekStart.toISOString()}`;
      const bucket = buckets.get(key) ?? {
        plannedHours: 0,
        availableHours:
          allocation.availableHoursOverride?.toNumber() ??
          capacityByEmployee.get(allocation.employeeId) ??
          0
      };
      bucket.plannedHours += allocation.plannedHours.toNumber();
      buckets.set(key, bucket);
    }

    const totals = Array.from(buckets.values()).reduce(
      (sum, bucket) => ({
        plannedHours: sum.plannedHours + bucket.plannedHours,
        availableHours: sum.availableHours + bucket.availableHours
      }),
      { plannedHours: 0, availableHours: 0 }
    );

    return {
      ...totals,
      utilizationRatio:
        totals.availableHours === 0
          ? 0
          : Number((totals.plannedHours / totals.availableHours).toFixed(4)),
      isOverloaded: totals.availableHours > 0 && totals.plannedHours > totals.availableHours
    };
  }

  private serializeTask(task: {
    id: string;
    projectId: string;
    sprintId: string | null;
    title: string;
    status: string;
    boardColumn: string;
    estimateHours: { toNumber(): number };
    assigneeUserId: string | null;
  }) {
    return {
      id: task.id,
      projectId: task.projectId,
      sprintId: task.sprintId,
      title: task.title,
      status: task.status,
      boardColumn: task.boardColumn,
      estimateHours: task.estimateHours.toNumber(),
      assigneeUserId: task.assigneeUserId
    };
  }

  private serializeTimeEntry(entry: {
    id: string;
    taskId: string;
    employeeId: string;
    hours: { toNumber(): number };
    source: string;
    note: string | null;
  }) {
    return {
      id: entry.id,
      taskId: entry.taskId,
      employeeId: entry.employeeId,
      hours: entry.hours.toNumber(),
      source: entry.source,
      note: entry.note
    };
  }

  private serializeAllocation(allocation: {
    id: string;
    employeeId: string;
    projectId: string;
    taskId: string | null;
    weekStart: Date;
    plannedHours: { toNumber(): number };
    availableHoursOverride: { toNumber(): number } | null;
    isOverloaded: boolean;
  }) {
    return {
      id: allocation.id,
      employeeId: allocation.employeeId,
      projectId: allocation.projectId,
      taskId: allocation.taskId,
      weekStart: allocation.weekStart.toISOString(),
      plannedHours: allocation.plannedHours.toNumber(),
      availableHoursOverride: allocation.availableHoursOverride?.toNumber() ?? null,
      isOverloaded: allocation.isOverloaded
    };
  }
}
