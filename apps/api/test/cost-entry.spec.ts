/**
 * cost-entry 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { CostEntryService } from "../src/modules/costing/cost-entry.service.js";
import { ProjectService } from "../src/modules/projects/project.service.js";
import { SprintService } from "../src/modules/projects/sprint.service.js";
import { EmployeeService } from "../src/modules/resourcing/employee.service.js";
import { TimeEntryService } from "../src/modules/timesheets/time-entry.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";
import { createDomainEventBus } from "../src/platform/events/domain-event-bus.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("CostEntryService", () => {
  const prisma = createSystemPrismaClient();
  const bus = createDomainEventBus();
  const projectService = new ProjectService(bus);
  const sprintService = new SprintService(bus);
  const employeeService = new EmployeeService();
  const timeEntryService = new TimeEntryService(bus);
  const costEntryService = new CostEntryService(bus);

  afterAll(async () => {
    await costEntryService.onModuleDestroy();
    await timeEntryService.onModuleDestroy();
    await employeeService.onModuleDestroy();
    await sprintService.onModuleDestroy();
    await projectService.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createFixture(costRate = 100) {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Cost Tenant ${suffix}`,
        slug: `cost-${suffix}`,
        seatLimit: 5
      }
    });
    const actor: AuthzContext = {
      tenantId: tenant.id,
      userId: randomUUID(),
      roles: ["PM"]
    };
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: `Cost Customer ${suffix}`
      }
    });
    const project = await projectService.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: `Cost Project ${suffix}`
    });
    const employee = await employeeService.createEmployee(
      { ...actor, roles: ["ADMIN"] },
      {
        tenantId: tenant.id,
        name: `Cost Employee ${suffix}`,
        email: `cost-${suffix}@example.test`,
        costRate,
        capacity: { weeklyHours: 40 }
      }
    );
    const sprint = await sprintService.createSprint(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      name: "Cost Sprint"
    });
    const task = await sprintService.createTask(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      title: "Costed task",
      estimateHours: 8,
      assigneeUserId: employee.id
    });

    return { tenant, actor, project, employee, task };
  }

  it("creates a labor cost entry from TimeEntryChanged and summarizes by project", async () => {
    const { tenant, actor, project, employee, task } = await createFixture(120);

    await sprintService.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "DONE"
    });

    const entry = await prisma.costEntry.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        projectId: project.id,
        taskId: task.id,
        employeeId: employee.id,
        type: "labor",
        deletedAt: null
      }
    });
    const summary = await costEntryService.getProjectCostSummary({
      tenantId: tenant.id,
      projectId: project.id
    });

    expect(entry).toMatchObject({
      tenantId: tenant.id,
      projectId: project.id,
      taskId: task.id,
      employeeId: employee.id,
      timeEntryId: expect.any(String),
      type: "labor",
      currency: "CNY"
    });
    expect(Number(entry.quantityHours)).toBe(8);
    expect(Number(entry.unitCostRate)).toBe(120);
    expect(Number(entry.amount)).toBe(960);
    expect(summary).toMatchObject({
      projectId: project.id,
      totalsByType: { labor: 960 },
      totalCost: 960
    });
  });

  it("updates the same labor cost entry with the latest cost rate on correction", async () => {
    const { tenant, actor, project, employee, task } = await createFixture(100);
    const memberActor: AuthzContext = {
      tenantId: tenant.id,
      userId: employee.id,
      roles: ["MEMBER"]
    };

    await sprintService.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "DONE"
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { costRate: 150 }
    });
    await timeEntryService.correctTimeEntry(memberActor, {
      tenantId: tenant.id,
      taskId: task.id,
      employeeId: employee.id,
      hours: 10,
      note: "Actual hours correction"
    });

    const entries = await prisma.costEntry.findMany({
      where: {
        tenantId: tenant.id,
        projectId: project.id,
        taskId: task.id,
        employeeId: employee.id,
        type: "labor",
        deletedAt: null
      }
    });

    expect(entries).toHaveLength(1);
    expect(Number(entries[0]?.quantityHours)).toBe(10);
    expect(Number(entries[0]?.unitCostRate)).toBe(150);
    expect(Number(entries[0]?.amount)).toBe(1500);
  });
});
