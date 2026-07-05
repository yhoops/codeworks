/**
 * Tenant-aware Prisma association guard specs.
 * Covers cross-tenant CRM, project, task, people, and resourcing writes.
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

describeTenantPrisma("Tenant-isolated Prisma client associations", ({
  systemPrisma,
  tenantPrisma
}) => {
  it("rejects contacts linked to another tenant's customer", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "contact"
    );
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
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "project"
    );
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
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "task"
    );
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

  it("rejects resource profiles linked to another tenant's employee or skill", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "resource"
    );
    const tenantBEmployee = await systemPrisma.employee.create({
      data: {
        tenantId: tenantB.id,
        name: "Tenant B Employee",
        costRate: new Prisma.Decimal("100.00")
      }
    });
    const tenantBSkill = await systemPrisma.skill.create({
      data: {
        tenantId: tenantB.id,
        name: `Tenant B Skill ${suffix}`
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.employeeSkill.create({
          data: {
            tenantId: tenantA.id,
            employeeId: tenantBEmployee.id,
            skillId: tenantBSkill.id,
            level: "SENIOR"
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);
    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.capacity.create({
          data: {
            tenantId: tenantA.id,
            employeeId: tenantBEmployee.id,
            weeklyHours: new Prisma.Decimal("40.00")
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: { in: ["EmployeeSkill", "Capacity"] }
        }
      })
    ).resolves.toHaveLength(2);
  });

  it("rejects resource allocations linked to another tenant's employee or project", async () => {
    const suffix = randomUUID();
    const { tenantA, tenantB } = await createTenantPair(
      systemPrisma,
      suffix,
      "allocation"
    );
    const tenantBCustomer = await systemPrisma.customer.create({
      data: { tenantId: tenantB.id, name: `Tenant B Allocation Customer ${suffix}` }
    });
    const tenantBEmployee = await systemPrisma.employee.create({
      data: {
        tenantId: tenantB.id,
        name: "Tenant B Allocation Employee",
        costRate: new Prisma.Decimal("100.00")
      }
    });
    const tenantBProject = await systemPrisma.project.create({
      data: {
        tenantId: tenantB.id,
        customerId: tenantBCustomer.id,
        name: `Tenant B Allocation Project ${suffix}`,
        projectManagerId: randomUUID()
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenantA.id }, () =>
        tenantPrisma.resourceAllocation.create({
          data: {
            tenantId: tenantA.id,
            employeeId: tenantBEmployee.id,
            projectId: tenantBProject.id,
            weekStart: new Date("2026-08-03T00:00:00.000Z"),
            plannedHours: new Prisma.Decimal("8.00")
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenTenantAccessError);

    await expect(
      systemPrisma.auditLog.findMany({
        where: {
          tenantId: tenantA.id,
          action: "CROSS_TENANT_ACCESS_DENIED",
          entityType: "ResourceAllocation"
        }
      })
    ).resolves.toHaveLength(1);
  });
});
