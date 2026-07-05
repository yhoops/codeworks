import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { PnlService } from "../src/modules/costing/pnl.service.js";
import { ProjectService } from "../src/modules/projects/project.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";
import {
  createDomainEventBus,
  type DomainEvent
} from "../src/platform/events/domain-event-bus.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("PnlService", () => {
  const prisma = createSystemPrismaClient();
  const bus = createDomainEventBus();
  const projectService = new ProjectService(bus);
  const service = new PnlService(bus);

  afterAll(async () => {
    await service.onModuleDestroy();
    await projectService.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createProjectWithBudget(budgetAmount = 1000) {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `PnL Tenant ${suffix}`,
        slug: `pnl-${suffix}`,
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
        name: `PnL Customer ${suffix}`
      }
    });
    const project = await projectService.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: `PnL Project ${suffix}`
    });
    await prisma.budget.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        name: `Budget ${suffix}`,
        amount: new Prisma.Decimal(budgetAmount)
      }
    });

    return { tenant, project };
  }

  it("returns realtime project PnL from budgeted revenue minus costs", async () => {
    const { tenant, project } = await createProjectWithBudget(1000);
    await prisma.costEntry.createMany({
      data: [
        {
          tenantId: tenant.id,
          projectId: project.id,
          type: "labor",
          amount: new Prisma.Decimal("300.00")
        },
        {
          tenantId: tenant.id,
          projectId: project.id,
          type: "expense",
          amount: new Prisma.Decimal("200.00")
        }
      ]
    });

    await expect(
      service.getRealtimeProjectPnl({
        tenantId: tenant.id,
        projectId: project.id
      })
    ).resolves.toMatchObject({
      projectId: project.id,
      revenue: 1000,
      totalCost: 500,
      grossProfit: 500,
      grossMargin: 0.5,
      costByType: {
        labor: 300,
        expense: 200
      }
    });
  });

  it("refreshes a PnL snapshot for dashboard reads and emits budget alerts", async () => {
    const { tenant, project } = await createProjectWithBudget(400);
    const events: DomainEvent[] = [];
    bus.subscribe("project.budget_exceeded", (event) => {
      events.push(event);
    });
    await prisma.costEntry.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        type: "labor",
        amount: new Prisma.Decimal("450.00")
      }
    });

    const snapshot = await service.refreshProjectSnapshot({
      tenantId: tenant.id,
      projectId: project.id
    });
    const dashboard = await service.getDashboardPnl({
      tenantId: tenant.id,
      projectId: project.id
    });

    expect(snapshot).toMatchObject({
      tenantId: tenant.id,
      projectId: project.id,
      revenue: expect.any(Object),
      totalCost: expect.any(Object),
      grossProfit: expect.any(Object)
    });
    expect(Number(snapshot.revenue)).toBe(400);
    expect(Number(snapshot.totalCost)).toBe(450);
    expect(Number(snapshot.grossProfit)).toBe(-50);
    expect(dashboard).toMatchObject({
      projectId: project.id,
      revenue: 400,
      totalCost: 450,
      grossProfit: -50,
      grossMargin: -0.125
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project.budget_exceeded",
          tenantId: tenant.id,
          aggregateId: project.id,
          payload: expect.objectContaining({
            budgetAmount: 400,
            totalCost: 450
          })
        })
      ])
    );
  });
});
