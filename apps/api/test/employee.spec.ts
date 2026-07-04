import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { EmployeeService } from "../src/modules/resourcing/employee.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("EmployeeService", () => {
  const prisma = createSystemPrismaClient();
  const service = new EmployeeService();

  afterAll(async () => {
    await service.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createTenant() {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Employee Tenant ${suffix}`,
        slug: `employee-${suffix}`,
        seatLimit: 5
      }
    });
    const admin: AuthzContext = {
      tenantId: tenant.id,
      userId: randomUUID(),
      roles: ["ADMIN"]
    };
    const member: AuthzContext = {
      tenantId: tenant.id,
      userId: randomUUID(),
      roles: ["MEMBER"]
    };

    return { tenant, admin, member };
  }

  it("maintains employee skills, cost rate, and capacity baseline", async () => {
    const { tenant, admin } = await createTenant();

    const employee = await service.createEmployee(admin, {
      tenantId: tenant.id,
      name: "Ada Delivery",
      email: "ada.delivery@example.test",
      costRate: 180,
      currency: "CNY",
      skills: [
        { name: "TypeScript", level: "SENIOR" },
        { name: "ERP", level: "MID" }
      ],
      capacity: {
        weeklyHours: 32,
        effectiveFrom: new Date("2026-07-01T00:00:00.000Z")
      }
    });

    expect(employee).toMatchObject({
      tenantId: tenant.id,
      name: "Ada Delivery",
      costRate: expect.any(Object),
      currency: "CNY",
      skills: expect.arrayContaining([
        expect.objectContaining({
          level: "SENIOR",
          skill: expect.objectContaining({ name: "TypeScript" })
        })
      ]),
      capacities: [
        expect.objectContaining({
          weeklyHours: expect.any(Object)
        })
      ]
    });
  });

  it("finds available employees by skill and masks cost rate without financial permission", async () => {
    const { tenant, admin, member } = await createTenant();
    await service.createEmployee(admin, {
      tenantId: tenant.id,
      name: "Visible Senior",
      email: "visible@example.test",
      costRate: 220,
      skills: [{ name: "React", level: "SENIOR" }],
      capacity: { weeklyHours: 30 }
    });
    await service.createEmployee(admin, {
      tenantId: tenant.id,
      name: "Other Skill",
      email: "other@example.test",
      costRate: 120,
      skills: [{ name: "Python", level: "MID" }],
      capacity: { weeklyHours: 40 }
    });

    const memberView = await service.findAvailableBySkill(member, {
      tenantId: tenant.id,
      skillName: "react"
    });
    const adminView = await service.findAvailableBySkill(admin, {
      tenantId: tenant.id,
      skillName: "react"
    });

    expect(memberView).toEqual([
      expect.objectContaining({
        name: "Visible Senior",
        costRate: null,
        capacityWeeklyHours: 30
      })
    ]);
    expect(adminView).toEqual([
      expect.objectContaining({
        name: "Visible Senior",
        costRate: "220",
        capacityWeeklyHours: 30
      })
    ]);
  });

  it("does not return employees from another tenant when filtering by skill", async () => {
    const first = await createTenant();
    const second = await createTenant();
    await service.createEmployee(first.admin, {
      tenantId: first.tenant.id,
      name: "Tenant One",
      email: "one@example.test",
      costRate: 100,
      skills: [{ name: "Go", level: "MID" }],
      capacity: { weeklyHours: 20 }
    });
    await service.createEmployee(second.admin, {
      tenantId: second.tenant.id,
      name: "Tenant Two",
      email: "two@example.test",
      costRate: 100,
      skills: [{ name: "Go", level: "MID" }],
      capacity: { weeklyHours: 20 }
    });

    await expect(
      service.findAvailableBySkill(first.admin, {
        tenantId: first.tenant.id,
        skillName: "go"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        tenantId: first.tenant.id,
        name: "Tenant One"
      })
    ]);
  });
});
