import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { ProjectService } from "../src/modules/projects/project.service.js";
import { SprintService } from "../src/modules/projects/sprint.service.js";
import { AllocationService } from "../src/modules/resourcing/allocation.service.js";
import { EmployeeService } from "../src/modules/resourcing/employee.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("Core workflow API", () => {
  const prisma = createSystemPrismaClient();
  const projectService = new ProjectService();
  const sprintService = new SprintService();
  const employeeService = new EmployeeService();
  const allocationService = new AllocationService();
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app?.close();
    await allocationService.onModuleDestroy();
    await employeeService.onModuleDestroy();
    await sprintService.onModuleDestroy();
    await projectService.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createFixture() {
    const suffix = randomUUID();
    const email = `core-${suffix}@codeworks.test`;
    const password = "core workflow secret";
    const tenantSlug = `core-${suffix}`;

    const registerResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, name: "Core PM" })
      .expect(201);
    const userId = registerResponse.body.user.id as string;

    const tenantResponse = await request(app.getHttpServer())
      .post("/tenants/open")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .send({ name: `Core Tenant ${suffix}`, slug: tenantSlug, seatLimit: 5 })
      .expect(201);
    const tenantId = tenantResponse.body.tenant.id as string;

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password, tenantSlug })
      .expect(200);
    const accessToken = loginResponse.body.accessToken as string;
    const actor: AuthzContext = { tenantId, userId, roles: ["ADMIN"] };
    const customer = await prisma.customer.create({
      data: { tenantId, name: `Core Customer ${suffix}` }
    });
    const project = await projectService.createProject(actor, {
      tenantId,
      customerId: customer.id,
      name: `Core Project ${suffix}`
    });
    const employee = await employeeService.createEmployee(actor, {
      tenantId,
      name: "Core Engineer",
      email: `engineer-${suffix}@codeworks.test`,
      costRate: 100,
      capacity: { weeklyHours: 40 }
    });
    const sprint = await sprintService.createSprint(actor, {
      tenantId,
      projectId: project.id,
      name: "MVP Sprint"
    });
    const task = await sprintService.createTask(actor, {
      tenantId,
      projectId: project.id,
      sprintId: sprint.id,
      title: "Ship core board",
      estimateHours: 8,
      assigneeUserId: employee.id
    });

    return { accessToken, employee, project, task };
  }

  it("moves board tasks through HTTP and returns the updated task", async () => {
    const { accessToken, task } = await createFixture();

    const response = await request(app.getHttpServer())
      .patch(`/core/tasks/${task.id}/move`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ boardColumn: "DONE" })
      .expect(200);

    expect(response.body.task).toMatchObject({
      id: task.id,
      boardColumn: "DONE",
      status: "DONE"
    });
    expect(response.body.timeEntry).toMatchObject({
      taskId: task.id,
      hours: 8,
      source: "AUTO"
    });
  });

  it("corrects time entries through HTTP and returns the corrected hours", async () => {
    const { accessToken, employee, task } = await createFixture();

    await request(app.getHttpServer())
      .patch(`/core/tasks/${task.id}/move`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ boardColumn: "DONE" })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch("/core/time-entries")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        taskId: task.id,
        employeeId: employee.id,
        hours: 6,
        note: "实际返工少于估算"
      })
      .expect(200);

    expect(response.body.timeEntry).toMatchObject({
      taskId: task.id,
      employeeId: employee.id,
      hours: 6,
      source: "MANUAL"
    });
  });

  it("schedules allocations through HTTP and flags overload", async () => {
    const { accessToken, employee, project, task } = await createFixture();

    const response = await request(app.getHttpServer())
      .post("/core/allocations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        employeeId: employee.id,
        projectId: project.id,
        taskId: task.id,
        weekStart: "2026-07-06T00:00:00.000Z",
        plannedHours: 45
      })
      .expect(201);

    expect(response.body.allocation).toMatchObject({
      employeeId: employee.id,
      taskId: task.id,
      plannedHours: 45,
      isOverloaded: true
    });
    expect(response.body.utilization).toMatchObject({
      employeeId: employee.id,
      plannedHours: 45,
      availableHours: 40,
      isOverloaded: true
    });
  });

  it("keeps tenant scope after refresh so core routes still authorize", async () => {
    const { accessToken } = await createFixture();
    const firstWorkspace = await request(app.getHttpServer())
      .get("/core/workspace")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(firstWorkspace.body.projects.length).toBeGreaterThan(0);

    const suffix = randomUUID();
    const email = `refresh-core-${suffix}@codeworks.test`;
    const password = "refresh core workflow secret";
    const tenantSlug = `refresh-core-${suffix}`;
    const registerResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, name: "Refresh Core PM" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/tenants/open")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .send({ name: `Refresh Core Tenant ${suffix}`, slug: tenantSlug, seatLimit: 5 })
      .expect(201);
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password, tenantSlug })
      .expect(200);
    const refreshResponse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .get("/core/workspace")
      .set("Authorization", `Bearer ${refreshResponse.body.accessToken}`)
      .expect(200);
  });
});
