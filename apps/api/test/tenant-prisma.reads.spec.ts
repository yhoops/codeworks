/**
 * Tenant-aware Prisma read isolation specs.
 * Covers tenant-scoped reads, cross-tenant unique reads, and audit-log visibility.
 */
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";

import {
  describeTenantPrisma,
  createTenantPair,
  ForbiddenTenantAccessError,
  Prisma,
  runWithTenantContext
} from "./tenant-prisma.fixture.js";

describeTenantPrisma("Tenant-isolated Prisma client reads", ({
  systemPrisma,
  tenantPrisma
}) => {
  it("returns only rows for the active tenant context", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "read-list"
    );

    await runWithTenantContext({ tenantId: tenantA.id }, async () => {
      await tenantPrisma.budget.create({
        data: {
          name: `Tenant A Budget ${suffix}`,
          amount: new Prisma.Decimal("10.00")
        }
      });
    });

    await runWithTenantContext({ tenantId: tenantB.id }, async () => {
      await tenantPrisma.budget.create({
        data: {
          name: `Tenant B Budget ${suffix}`,
          amount: new Prisma.Decimal("20.00")
        }
      });
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.budget.findMany({ orderBy: { name: "asc" } })
      )
    ).resolves.toMatchObject([
      {
        name: `Tenant A Budget ${suffix}`,
        tenantId: tenantA.id
      }
    ]);
  });

  it("rejects and audits reads that target another tenant", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "read"
    );
    const tenantBBudget = await systemPrisma.budget.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Read Budget ${suffix}`,
        amount: new Prisma.Decimal("20.00")
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.budget.findUnique({ where: { id: tenantBBudget.id } })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: "Budget",
          entityId: tenantBBudget.id
        }
      })
    ).resolves.toHaveLength(1);
  });

  it("isolates audit logs through the tenant-aware client", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "audit"
    );
    const tenantBAudit = await systemPrisma.auditLog.create({
      data: {
        tenantId: tenantB.id,
        action: "BUDGET_UPDATED",
        entityType: "Budget",
        details: { suffix }
      }
    });

    await runWithTenantContext({ tenantId: tenantA.id }, async () => {
      await tenantPrisma.auditLog.create({
        data: {
          action: "BUDGET_CREATED",
          entityType: "Budget",
          details: { suffix }
        }
      });
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })
      )
    ).resolves.toEqual([
      expect.objectContaining({
        tenantId: tenantA.id,
        action: "BUDGET_CREATED"
      })
    ]);

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.auditLog.findUnique({ where: { id: tenantBAudit.id } })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);
  });
});
