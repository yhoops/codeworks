import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { ProjectService } from "../src/modules/projects/project.service.js";
import { AllocationService } from "../src/modules/resourcing/allocation.service.js";
import { EmployeeService } from "../src/modules/resourcing/employee.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("AllocationService", () => {
  const prisma = createSystemPrismaClient();
  const projectService = new ProjectService();
  const employeeService = new EmployeeService();
  const service = new AllocationService();

  afterAll(async () => {
    await service.onModuleDestroy();
    await employeeService.onModuleDestroy();
    await projectService.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createFixture() {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Allocation Tenant ${suffix}`,
        slug: `allocation-${suffix}`,
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
        name: `Allocation Customer ${suffix}`
      }
    });
    const project = await projectService.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: `Allocation Project ${suffix}`
    });
    const employee = await employeeService.createEmployee(
      { ...actor, roles: ["ADMIN"] },
      {
        tenantId: tenant.id,
        name: `Allocation Employee ${suffix}`,
        email: `allocation-${suffix}@example.test`,
        costRate: 100,
        skills: [{ name: "Planning", level: "MID" }],
        capacity: { weeklyHours: 40 }
      }
    );

    return { tenant, actor, project, employee };
  }

  it("marks an employee overloaded when planned hours exceed available capacity", async () => {
    const { tenant, actor, project, employee } = await createFixture();
    const weekStart = new Date("2026-07-06T00:00:00.000Z");

    await service.scheduleAllocation(actor, {
      tenantId: tenant.id,
      employeeId: employee.id,
      projectId: project.id,
      weekStart,
      plannedHours: 30
    });
    const overloaded = await service.scheduleAllocation(actor, {
      tenantId: tenant.id,
      employeeId: employee.id,
      projectId: project.id,
      weekStart,
      plannedHours: 15
    });

    expect(overloaded).toMatchObject({
      tenantId: tenant.id,
      employeeId: employee.id,
      plannedHours: expect.any(Object),
      isOverloaded: true
    });
  });

  it("returns weekly planned hours, available hours, and utilization ratio", async () => {
    const { tenant, actor, project, employee } = await createFixture();
    const weekStart = new Date("2026-07-13T00:00:00.000Z");

    await service.scheduleAllocation(actor, {
      tenantId: tenant.id,
      employeeId: employee.id,
      projectId: project.id,
      weekStart,
      plannedHours: 20
    });

    await expect(
      service.getWeeklyUtilization({
        tenantId: tenant.id,
        employeeId: employee.id,
        weekStart
      })
    ).resolves.toMatchObject({
      employeeId: employee.id,
      weekStart,
      plannedHours: 20,
      availableHours: 40,
      utilizationRatio: 0.5,
      isOverloaded: false
    });
  });

  it("uses an available-hours override as the leave adjustment extension point", async () => {
    const { tenant, actor, project, employee } = await createFixture();
    const weekStart = new Date("2026-07-20T00:00:00.000Z");

    await service.scheduleAllocation(actor, {
      tenantId: tenant.id,
      employeeId: employee.id,
      projectId: project.id,
      weekStart,
      plannedHours: 30,
      availableHoursOverride: 24
    });

    await expect(
      service.getWeeklyUtilization({
        tenantId: tenant.id,
        employeeId: employee.id,
        weekStart
      })
    ).resolves.toMatchObject({
      plannedHours: 30,
      availableHours: 24,
      utilizationRatio: 1.25,
      isOverloaded: true
    });
  });
});
