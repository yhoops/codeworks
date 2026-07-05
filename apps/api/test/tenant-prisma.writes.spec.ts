/**
 * Tenant-aware Prisma write isolation specs.
 * Covers explicit tenant mismatches, single-row writes, and batch writes.
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

describeTenantPrisma("Tenant-isolated Prisma client writes", ({
  systemPrisma,
  tenantPrisma
}) => {
  it("rejects writes that target another tenant", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "cross"
    );

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.budget.create({
          data: {
            tenantId: tenantB.id,
            name: `Cross Tenant Budget ${suffix}`,
            amount: new Prisma.Decimal("999.00")
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: "Budget"
        }
      })
    ).resolves.toHaveLength(1);
  });

  it("does not update rows owned by another tenant", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "update"
    );
    const tenantBBudget = await systemPrisma.budget.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Budget ${suffix}`,
        amount: new Prisma.Decimal("20.00")
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.budget.update({
          where: { id: tenantBBudget.id },
          data: { name: "Compromised Budget" }
        })
      )
    ).rejects.toThrow();

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

    await expect(
      systemPrisma.budget.findUnique({ where: { id: tenantBBudget.id } })
    ).resolves.toMatchObject({
      tenantId: tenantB.id,
      name: `Tenant B Budget ${suffix}`
    });
  });

  it("rejects and audits batch writes that target another tenant's budget", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "batch"
    );
    const tenantABudget = await systemPrisma.budget.create({
      data: {
        tenantId: tenantA.id,
        name: `Tenant A Batch Budget ${suffix}`,
        amount: new Prisma.Decimal("10.00")
      }
    });
    const tenantBUpdateBudget = await systemPrisma.budget.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Batch Update Budget ${suffix}`,
        amount: new Prisma.Decimal("20.00")
      }
    });
    const tenantBDeleteBudget = await systemPrisma.budget.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Batch Delete Budget ${suffix}`,
        amount: new Prisma.Decimal("30.00")
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.budget.updateMany({
          where: { id: tenantBUpdateBudget.id },
          data: { name: "Compromised Batch Budget" }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);
    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.budget.deleteMany({
          where: { id: tenantBDeleteBudget.id }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: "Budget",
          entityId: { in: [tenantBUpdateBudget.id, tenantBDeleteBudget.id] }
        }
      })
    ).resolves.toHaveLength(2);
    await expect(
      systemPrisma.budget.findUnique({ where: { id: tenantBUpdateBudget.id } })
    ).resolves.toMatchObject({
      tenantId: tenantB.id,
      name: `Tenant B Batch Update Budget ${suffix}`
    });
    await expect(
      systemPrisma.budget.findUnique({ where: { id: tenantBDeleteBudget.id } })
    ).resolves.toMatchObject({
      tenantId: tenantB.id,
      name: `Tenant B Batch Delete Budget ${suffix}`
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.budget.updateMany({
          where: { id: tenantABudget.id },
          data: { name: `Tenant A Batch Updated ${suffix}` }
        })
      )
    ).resolves.toMatchObject({ count: 1 });
  });
});
