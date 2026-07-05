/**
 * prisma-base 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("Prisma base contract", () => {
  const prisma = createSystemPrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores money as Decimal and defaults currency to CNY", async () => {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: "Contract Test Tenant",
        slug: `contract-test-${suffix}`
      }
    });

    const budget = await prisma.budget.create({
      data: {
        tenantId: tenant.id,
        name: `Implementation Budget ${suffix}`,
        amount: new Prisma.Decimal("12345.67")
      }
    });

    expect(budget.amount).toBeInstanceOf(Prisma.Decimal);
    expect(budget.amount.toString()).toBe("12345.67");
    expect(budget.currency).toBe("CNY");
  });

  it("excludes soft-deleted budgets from default reads", async () => {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: "Soft Delete Tenant",
        slug: `soft-delete-test-${suffix}`
      }
    });

    const budget = await prisma.budget.create({
      data: {
        tenantId: tenant.id,
        name: `Hidden Budget ${suffix}`,
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
