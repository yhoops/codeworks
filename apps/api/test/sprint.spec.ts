/**
 * sprint 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { ProjectService } from "../src/modules/projects/project.service.js";
import { SprintService } from "../src/modules/projects/sprint.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import {
  createDomainEventBus,
  type DomainEvent
} from "../src/platform/events/domain-event-bus.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("SprintService", () => {
  const prisma = createSystemPrismaClient();
  const bus = createDomainEventBus();
  const projectService = new ProjectService(bus);
  const service = new SprintService(bus);

  afterAll(async () => {
    await service.onModuleDestroy();
    await projectService.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createProject() {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Sprint Tenant ${suffix}`,
        slug: `sprint-${suffix}`,
        seatLimit: 5
      }
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: `Sprint Customer ${suffix}`
      }
    });
    const actor: AuthzContext = {
      tenantId: tenant.id,
      userId: randomUUID(),
      roles: ["PM"]
    };
    const project = await projectService.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: `Sprint Project ${suffix}`
    });

    return { tenant, actor, project };
  }

  it("creates tasks under a sprint and keeps status aligned with board columns", async () => {
    const { tenant, actor, project } = await createProject();
    const sprint = await service.createSprint(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      name: "Sprint 1",
      goal: "Deliver core board"
    });
    const task = await service.createTask(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      title: "Build board",
      estimateHours: 8
    });

    expect(task).toMatchObject({
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      status: "TODO",
      boardColumn: "TODO",
      estimateHours: expect.any(Object)
    });

    const moved = await service.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "IN_PROGRESS"
    });

    expect(moved).toMatchObject({
      status: "IN_PROGRESS",
      boardColumn: "IN_PROGRESS"
    });
  });

  it("returns sprint burndown points from remaining estimates over task changes", async () => {
    const { tenant, actor, project } = await createProject();
    const sprint = await service.createSprint(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      name: "Sprint 2"
    });
    const first = await service.createTask(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      title: "First task",
      estimateHours: 5
    });
    await service.createTask(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      title: "Second task",
      estimateHours: 3
    });
    await service.moveTask(actor, {
      tenantId: tenant.id,
      taskId: first.id,
      boardColumn: "DONE"
    });

    const burndown = await service.getBurndown({
      tenantId: tenant.id,
      sprintId: sprint.id
    });

    expect(burndown).toMatchObject({
      sprintId: sprint.id,
      totalEstimateHours: 8,
      remainingEstimateHours: 3
    });
    expect(burndown.points.map((point) => point.remainingEstimateHours)).toEqual([
      5,
      8,
      3
    ]);
  });

  it("rejects cross-tenant task access and emits task change events", async () => {
    const { tenant, actor, project } = await createProject();
    const other = await createProject();
    const events: DomainEvent[] = [];
    bus.subscribe("task.changed", (event) => {
      events.push(event);
    });
    const sprint = await service.createSprint(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      name: "Sprint 3"
    });
    const task = await service.createTask(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      title: "Tenant task",
      estimateHours: 2
    });

    await expect(
      service.moveTask(other.actor, {
        tenantId: other.tenant.id,
        taskId: task.id,
        boardColumn: "DONE"
      })
    ).rejects.toThrow(/task/i);

    await service.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "DONE"
    });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "task.changed",
          tenantId: tenant.id,
          aggregateId: task.id,
          payload: expect.objectContaining({
            fromStatus: "TODO",
            toStatus: "DONE",
            remainingEstimateHours: 0
          })
        })
      ])
    );
  });
});
