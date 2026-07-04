import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { ProjectService } from "../src/modules/projects/project.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import {
  createDomainEventBus,
  type DomainEvent
} from "../src/platform/events/domain-event-bus.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("ProjectService", () => {
  const prisma = createSystemPrismaClient();
  const bus = createDomainEventBus();
  const service = new ProjectService(bus);

  afterAll(async () => {
    await service.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createTenantAndCustomer() {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Project Tenant ${suffix}`,
        slug: `project-${suffix}`,
        seatLimit: 5
      }
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: `Project Customer ${suffix}`
      }
    });
    const actor: AuthzContext = {
      tenantId: tenant.id,
      userId: randomUUID(),
      roles: ["PM"]
    };

    return { tenant, customer, actor };
  }

  it("creates a manual draft project owned by the tenant and customer", async () => {
    const { tenant, customer, actor } = await createTenantAndCustomer();

    const project = await service.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: "ERP Rollout",
      milestones: [{ name: "Kickoff" }, { name: "Go Live" }]
    });

    expect(project).toMatchObject({
      tenantId: tenant.id,
      customerId: customer.id,
      name: "ERP Rollout",
      status: "DRAFT",
      source: "MANUAL",
      projectManagerId: actor.userId,
      milestones: expect.arrayContaining([
        expect.objectContaining({
          tenantId: tenant.id,
          name: "Kickoff",
          projectId: project.id
        }),
        expect.objectContaining({
          tenantId: tenant.id,
          name: "Go Live",
          projectId: project.id
        })
      ])
    });
  });

  it("rejects closing before milestones are accepted and emits audit/event after valid transitions", async () => {
    const { tenant, customer, actor } = await createTenantAndCustomer();
    const events: DomainEvent[] = [];
    bus.subscribe("project.status_changed", (event) => {
      events.push(event);
    });
    const project = await service.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: "Lifecycle Project",
      milestones: [{ name: "Acceptance" }]
    });

    await service.transitionProject(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      toStatus: "ACTIVE"
    });
    await service.transitionProject(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      toStatus: "DELIVERING"
    });
    await expect(
      service.transitionProject(actor, {
        tenantId: tenant.id,
        projectId: project.id,
        toStatus: "CLOSED"
      })
    ).rejects.toThrow(/milestone/i);

    await service.acceptMilestone(actor, {
      tenantId: tenant.id,
      milestoneId: project.milestones[0].id
    });
    const closed = await service.transitionProject(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      toStatus: "CLOSED"
    });

    expect(closed.status).toBe("CLOSED");
    await expect(
      prisma.auditLog.findMany({
        where: {
          tenantId: tenant.id,
          action: "PROJECT_STATUS_CHANGED",
          entityType: "Project",
          entityId: project.id
        }
      })
    ).resolves.toHaveLength(3);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project.status_changed",
          tenantId: tenant.id,
          aggregateId: project.id,
          payload: expect.objectContaining({
            fromStatus: "DELIVERING",
            toStatus: "CLOSED"
          })
        })
      ])
    );
  });

  it("rejects lifecycle transitions from actors without project write permission", async () => {
    const { tenant, customer, actor } = await createTenantAndCustomer();
    const project = await service.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: "Permission Project"
    });
    const memberActor: AuthzContext = {
      tenantId: tenant.id,
      userId: randomUUID(),
      roles: ["MEMBER"]
    };

    await expect(
      service.transitionProject(memberActor, {
        tenantId: tenant.id,
        projectId: project.id,
        toStatus: "ACTIVE"
      })
    ).rejects.toThrow(/permission/i);
  });
});
