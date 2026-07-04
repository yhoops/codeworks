import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import {
  createPrismaClient,
  createSystemPrismaClient,
  ForbiddenTenantAccessError
} from "../src/platform/database/prisma.client.js";
import { runWithTenantContext } from "../src/platform/tenant/tenant-context.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("Tenant-isolated Prisma client", () => {
  const systemPrisma = createSystemPrismaClient();
  const tenantPrisma = createPrismaClient();

  afterAll(async () => {
    await tenantPrisma.$disconnect();
    await systemPrisma.$disconnect();
  });

  it("returns only rows for the active tenant context", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-${suffix}` }
    });

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

  it("rejects writes that target another tenant", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-cross-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-cross-${suffix}` }
    });

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

  it("rejects and audits reads that target another tenant", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-read-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-read-${suffix}` }
    });
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

  it("does not update rows owned by another tenant", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-update-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-update-${suffix}` }
    });
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

  it("isolates audit logs through the tenant-aware client", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-audit-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-audit-${suffix}` }
    });
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

  it("rejects contacts linked to another tenant's customer", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-contact-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-contact-${suffix}` }
    });
    const tenantBCustomer = await systemPrisma.customer.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Customer ${suffix}`
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.contact.create({
          data: {
            customerId: tenantBCustomer.id,
            name: "Cross Tenant Contact"
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: "Contact"
        }
      })
    ).resolves.toHaveLength(1);
  });

  it("rejects projects and milestones linked to another tenant's aggregate", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-project-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-project-${suffix}` }
    });
    const tenantBCustomer = await systemPrisma.customer.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Project Customer ${suffix}`
      }
    });
    const tenantBProject = await systemPrisma.project.create({
      data: {
        tenantId: tenantB.id,
        customerId: tenantBCustomer.id,
        name: `Tenant B Project ${suffix}`,
        projectManagerId: randomUUID()
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.project.create({
          data: {
            customerId: tenantBCustomer.id,
            name: "Cross Tenant Project",
            projectManagerId: randomUUID()
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);
    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.milestone.create({
          data: {
            projectId: tenantBProject.id,
            name: "Cross Tenant Milestone"
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: { in: ["Project", "Milestone"] }
        }
      })
    ).resolves.toHaveLength(2);
  });

  it("rejects tasks linked to another tenant's project or sprint", async () => {
    const suffix = randomUUID();
    const tenantA = await systemPrisma.tenant.create({
      data: { name: "Tenant A", slug: `tenant-a-task-${suffix}` }
    });
    const tenantB = await systemPrisma.tenant.create({
      data: { name: "Tenant B", slug: `tenant-b-task-${suffix}` }
    });
    const tenantBCustomer = await systemPrisma.customer.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Task Customer ${suffix}`
      }
    });
    const tenantBProject = await systemPrisma.project.create({
      data: {
        tenantId: tenantB.id,
        customerId: tenantBCustomer.id,
        name: `Tenant B Task Project ${suffix}`,
        projectManagerId: randomUUID()
      }
    });
    const tenantBSprint = await systemPrisma.sprint.create({
      data: {
        tenantId: tenantB.id,
        projectId: tenantBProject.id,
        name: `Tenant B Sprint ${suffix}`
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.backlogTask.create({
          data: {
            tenantId: tenantA.id,
            projectId: tenantBProject.id,
            sprintId: tenantBSprint.id,
            title: "Cross Tenant Task",
            estimateHours: new Prisma.Decimal("1.00")
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: "Task"
        }
      })
    ).resolves.toHaveLength(1);
  });
});
