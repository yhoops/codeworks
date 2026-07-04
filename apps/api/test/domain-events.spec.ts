import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import {
  createDomainEventBus,
  TransactionalDomainEvents
} from "../src/platform/events/domain-event-bus.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("TransactionalDomainEvents", () => {
  const prisma = createSystemPrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("publishes buffered events only after the transaction commits", async () => {
    const bus = createDomainEventBus();
    const events = new TransactionalDomainEvents(bus);
    const published: string[] = [];
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: { name: "Events Tenant", slug: `events-${suffix}` }
    });

    bus.subscribe("budget.created", (event) => {
      published.push(event.aggregateId);
    });

    const budgetId = await events.runInTransaction(prisma, async (tx, buffer) => {
      const budget = await tx.budget.create({
        data: {
          tenantId: tenant.id,
          name: `Event Budget ${suffix}`,
          amount: new Prisma.Decimal("10.00")
        }
      });

      buffer.record({
        type: "budget.created",
        tenantId: tenant.id,
        aggregateType: "Budget",
        aggregateId: budget.id,
        payload: { name: budget.name }
      });

      expect(published).toEqual([]);

      return budget.id;
    });

    expect(published).toEqual([budgetId]);
  });

  it("does not publish buffered events when the transaction rolls back", async () => {
    const bus = createDomainEventBus();
    const events = new TransactionalDomainEvents(bus);
    const published: string[] = [];
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: { name: "Rollback Tenant", slug: `rollback-${suffix}` }
    });

    bus.subscribe("budget.created", (event) => {
      published.push(event.aggregateId);
    });

    await expect(
      events.runInTransaction(prisma, async (tx, buffer) => {
        const budget = await tx.budget.create({
          data: {
            tenantId: tenant.id,
            name: `Rollback Budget ${suffix}`,
            amount: new Prisma.Decimal("10.00")
          }
        });

        buffer.record({
          type: "budget.created",
          tenantId: tenant.id,
          aggregateType: "Budget",
          aggregateId: budget.id,
          payload: { name: budget.name }
        });

        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");

    expect(published).toEqual([]);
  });
});
