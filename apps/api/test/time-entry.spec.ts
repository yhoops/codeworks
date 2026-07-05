import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { ProjectService } from "../src/modules/projects/project.service.js";
import { SprintService } from "../src/modules/projects/sprint.service.js";
import { EmployeeService } from "../src/modules/resourcing/employee.service.js";
import { TimeEntryService } from "../src/modules/timesheets/time-entry.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";
import {
  createDomainEventBus,
  type DomainEvent
} from "../src/platform/events/domain-event-bus.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("TimeEntryService", () => {
  const prisma = createSystemPrismaClient();
  const bus = createDomainEventBus();
  const projectService = new ProjectService(bus);
  const sprintService = new SprintService(bus);
  const employeeService = new EmployeeService();
  const timeEntryService = new TimeEntryService(bus);

  afterAll(async () => {
    await timeEntryService.onModuleDestroy();
    await employeeService.onModuleDestroy();
    await sprintService.onModuleDestroy();
    await projectService.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createFixture() {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Time Entry Tenant ${suffix}`,
        slug: `time-entry-${suffix}`,
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
        name: `Time Entry Customer ${suffix}`
      }
    });
    const project = await projectService.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: `Time Entry Project ${suffix}`
    });
    const employee = await employeeService.createEmployee(
      { ...actor, roles: ["ADMIN"] },
      {
        tenantId: tenant.id,
        name: `Time Entry Employee ${suffix}`,
        email: `time-entry-${suffix}@example.test`,
        costRate: 120,
        capacity: { weeklyHours: 40 }
      }
    );
    const sprint = await sprintService.createSprint(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      name: "Time Entry Sprint"
    });
    const task = await sprintService.createTask(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      title: "Close task into actual hours",
      estimateHours: 8,
      assigneeUserId: employee.id
    });

    return { tenant, actor, employee, task };
  }

  it("derives actual hours and publishes TimeEntryChanged when a task is completed", async () => {
    const { tenant, actor, employee, task } = await createFixture();
    const events: DomainEvent[] = [];
    bus.subscribe("time_entry.changed", (event) => {
      events.push(event);
    });

    await sprintService.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "DONE"
    });

    const entry = await prisma.timeEntry.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        taskId: task.id,
        employeeId: employee.id,
        deletedAt: null
      }
    });

    expect(entry).toMatchObject({
      tenantId: tenant.id,
      taskId: task.id,
      employeeId: employee.id,
      source: "AUTO"
    });
    expect(Number(entry.hours)).toBe(8);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "time_entry.changed",
          tenantId: tenant.id,
          aggregateType: "TimeEntry",
          aggregateId: entry.id,
          payload: expect.objectContaining({
            taskId: task.id,
            employeeId: employee.id,
            hours: 8,
            source: "AUTO"
          })
        })
      ])
    );
  });

  it("keeps manual corrections authoritative and records an audit trail", async () => {
    const { tenant, actor, employee, task } = await createFixture();
    const memberActor: AuthzContext = {
      tenantId: tenant.id,
      userId: employee.id,
      roles: ["MEMBER"]
    };

    await sprintService.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "DONE"
    });
    const corrected = await timeEntryService.correctTimeEntry(memberActor, {
      tenantId: tenant.id,
      taskId: task.id,
      employeeId: employee.id,
      hours: 6,
      note: "Member corrected actual hours"
    });
    await sprintService.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "IN_PROGRESS"
    });
    await sprintService.moveTask(actor, {
      tenantId: tenant.id,
      taskId: task.id,
      boardColumn: "DONE"
    });

    const entry = await prisma.timeEntry.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        taskId: task.id,
        employeeId: employee.id,
        deletedAt: null
      }
    });
    const audit = await prisma.auditLog.findFirst({
      where: {
        tenantId: tenant.id,
        action: "TIME_ENTRY_CORRECTED",
        entityId: corrected.id
      }
    });

    expect(Number(entry.hours)).toBe(6);
    expect(entry.source).toBe("MANUAL");
    expect(entry.correctedByUserId).toBe(employee.id);
    expect(audit).toMatchObject({
      entityType: "TimeEntry",
      actorUserId: employee.id
    });
  });
});
