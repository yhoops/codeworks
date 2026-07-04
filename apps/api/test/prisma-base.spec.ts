import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "../src/platform/database/prisma.client.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("Prisma base contract", () => {
  const prisma = createPrismaClient();

  beforeEach(async () => {
    await prisma.budget.deleteMany();
    await prisma.tenant.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores money as Decimal and defaults currency to CNY", async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: "Contract Test Tenant",
        slug: "contract-test"
      }
    });

    const budget = await prisma.budget.create({
      data: {
        tenantId: tenant.id,
        name: "Implementation Budget",
        amount: new Prisma.Decimal("12345.67")
      }
    });

    expect(budget.amount).toBeInstanceOf(Prisma.Decimal);
    expect(budget.amount.toString()).toBe("12345.67");
    expect(budget.currency).toBe("CNY");
  });

  it("excludes soft-deleted budgets from default reads", async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: "Soft Delete Tenant",
        slug: "soft-delete-test"
      }
    });

    const budget = await prisma.budget.create({
      data: {
        tenantId: tenant.id,
        name: "Hidden Budget",
        amount: new Prisma.Decimal("88.00")
      }
    });

    await prisma.budget.update({
      where: { id: budget.id },
      data: { deletedAt: new Date() }
    });

    await expect(
      prisma.budget.findMany({ where: { tenantId: tenant.id } })
    ).resolves.toHaveLength(0);
    await expect(
      prisma.budget.count({ where: { tenantId: tenant.id } })
    ).resolves.toBe(0);
  });
});
