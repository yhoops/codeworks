/**
 * allocation.service.ts 领域服务。
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
import { Prisma, PrismaClient } from "@prisma/client";

import { type AuthzContext, assertPermission } from "../../platform/authz/rbac.guard.js";
import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";

@Injectable()
export class AllocationService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async scheduleAllocation(
    actor: AuthzContext,
    input: {
      tenantId: string;
      employeeId: string;
      projectId: string;
      taskId?: string;
      weekStart: Date;
      plannedHours: number;
      availableHoursOverride?: number;
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    const weekStart = this.normalizeWeekStart(input.weekStart);
    await this.requireEmployee(input.tenantId, input.employeeId);
    await this.requireProject(input.tenantId, input.projectId);

    if (input.taskId) {
      await this.requireTask(input.tenantId, input.taskId, input.projectId);
    }

    const plannedHours = this.requireHours(input.plannedHours, "Planned hours");
    const availableHoursOverride =
      input.availableHoursOverride === undefined
        ? undefined
        : this.requireHours(input.availableHoursOverride, "Available hours");
    const existingPlannedHours = await this.sumPlannedHours({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      weekStart
    });
    const availableHours =
      availableHoursOverride ??
      (await this.getCapacityHours(input.tenantId, input.employeeId, weekStart));
    const isOverloaded = existingPlannedHours.plus(plannedHours).gt(availableHours);

    return this.prisma.resourceAllocation.create({
      data: {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        projectId: input.projectId,
        taskId: input.taskId,
        weekStart,
        plannedHours,
        availableHoursOverride,
        isOverloaded
      }
    });
  }

  async getWeeklyUtilization(input: {
    tenantId: string;
    employeeId: string;
    weekStart: Date;
  }) {
    const weekStart = this.normalizeWeekStart(input.weekStart);
    await this.requireEmployee(input.tenantId, input.employeeId);
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        weekStart,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });
    const planned = allocations.reduce(
      (sum, allocation) => sum.plus(allocation.plannedHours),
      new Prisma.Decimal(0)
    );
    const override = allocations
      .map((allocation) => allocation.availableHoursOverride)
      .find((value): value is Prisma.Decimal => value !== null);
    const available =
      override ?? (await this.getCapacityHours(input.tenantId, input.employeeId, weekStart));
    const availableNumber = available.toNumber();
    const plannedNumber = planned.toNumber();

    return {
      employeeId: input.employeeId,
      weekStart,
      plannedHours: plannedNumber,
      availableHours: availableNumber,
      utilizationRatio:
        availableNumber === 0 ? 0 : Number((plannedNumber / availableNumber).toFixed(4)),
      isOverloaded: availableNumber > 0 && planned.gt(available)
    };
  }

  private async requireEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null }
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    return employee;
  }

  private async requireProject(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  private async requireTask(tenantId: string, taskId: string, projectId: string) {
    const task = await this.prisma.backlogTask.findFirst({
      where: { id: taskId, tenantId, projectId, deletedAt: null }
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return task;
  }

  private async getCapacityHours(
    tenantId: string,
    employeeId: string,
    weekStart: Date
  ) {
    const capacity = await this.prisma.capacity.findFirst({
      where: {
        tenantId,
        employeeId,
        deletedAt: null,
        effectiveFrom: { lte: weekStart },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: weekStart } }]
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }]
    });

    return capacity?.weeklyHours ?? new Prisma.Decimal(0);
  }

  private async sumPlannedHours(input: {
    tenantId: string;
    employeeId: string;
    weekStart: Date;
  }) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        weekStart: input.weekStart,
        deletedAt: null
      },
      select: { plannedHours: true }
    });

    return allocations.reduce(
      (sum, allocation) => sum.plus(allocation.plannedHours),
      new Prisma.Decimal(0)
    );
  }

  private assertProjectWrite(actor: AuthzContext, tenantId: string) {
    if (actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant access denied");
    }

    assertPermission(actor, "project.write");
  }

  private normalizeWeekStart(value: Date) {
    const normalized = new Date(value);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  }

  private requireHours(value: number, label: string) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${label} must be a non-negative number`);
    }

    return new Prisma.Decimal(value.toFixed(2));
  }
}
