import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { DepartmentService } from "../src/modules/iam/org/department.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("DepartmentService", () => {
  const prisma = createSystemPrismaClient();
  const service = new DepartmentService();

  afterAll(async () => {
    await service.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createTenant() {
    const suffix = randomUUID();
    return prisma.tenant.create({
      data: {
        name: `Department Tenant ${suffix}`,
        slug: `department-${suffix}`,
        seatLimit: 5
      }
    });
  }

  it("creates a legal multi-level department tree and rejects cycles", async () => {
    const tenant = await createTenant();
    const root = await service.createDepartment({
      tenantId: tenant.id,
      name: "总部"
    });
    const delivery = await service.createDepartment({
      tenantId: tenant.id,
      parentId: root.id,
      name: "交付部"
    });
    const squad = await service.createDepartment({
      tenantId: tenant.id,
      parentId: delivery.id,
      name: "一组"
    });

    await expect(
      service.moveDepartment({
        tenantId: tenant.id,
        departmentId: root.id,
        newParentId: squad.id
      })
    ).rejects.toThrow(/cycle/i);

    await expect(service.getDescendantDepartmentIds(tenant.id, root.id)).resolves.toEqual([
      root.id,
      delivery.id,
      squad.id
    ]);
  });

  it("moves a subtree while preserving its descendants", async () => {
    const tenant = await createTenant();
    const root = await service.createDepartment({
      tenantId: tenant.id,
      name: "总部"
    });
    const delivery = await service.createDepartment({
      tenantId: tenant.id,
      parentId: root.id,
      name: "交付部"
    });
    const sales = await service.createDepartment({
      tenantId: tenant.id,
      parentId: root.id,
      name: "销售部"
    });
    const squad = await service.createDepartment({
      tenantId: tenant.id,
      parentId: delivery.id,
      name: "一组"
    });

    await service.moveDepartment({
      tenantId: tenant.id,
      departmentId: delivery.id,
      newParentId: sales.id
    });

    await expect(prisma.department.findUnique({ where: { id: delivery.id } })).resolves.toMatchObject({
      parentId: sales.id
    });
    await expect(prisma.department.findUnique({ where: { id: squad.id } })).resolves.toMatchObject({
      parentId: delivery.id
    });
  });

  it("returns membership users in a department and its descendants", async () => {
    const tenant = await createTenant();
    const root = await service.createDepartment({
      tenantId: tenant.id,
      name: "总部"
    });
    const delivery = await service.createDepartment({
      tenantId: tenant.id,
      parentId: root.id,
      name: "交付部"
    });
    const sales = await service.createDepartment({
      tenantId: tenant.id,
      parentId: root.id,
      name: "销售部"
    });
    const deliveryUser = await prisma.user.create({
      data: {
        email: `delivery-${randomUUID()}@codeworks.test`,
        name: "Delivery User",
        passwordHash: "$argon2id$v=19$m=1,t=1,p=1$placeholder$placeholder"
      }
    });
    const salesUser = await prisma.user.create({
      data: {
        email: `sales-${randomUUID()}@codeworks.test`,
        name: "Sales User",
        passwordHash: "$argon2id$v=19$m=1,t=1,p=1$placeholder$placeholder"
      }
    });

    await prisma.membership.createMany({
      data: [
        {
          tenantId: tenant.id,
          userId: deliveryUser.id,
          role: "MEMBER",
          status: "ACTIVE",
          departmentId: delivery.id
        },
        {
          tenantId: tenant.id,
          userId: salesUser.id,
          role: "MEMBER",
          status: "ACTIVE",
          departmentId: sales.id
        }
      ]
    });

    await expect(
      service.getUserIdsInDepartmentScope(tenant.id, delivery.id)
    ).resolves.toEqual([deliveryUser.id]);
  });
});
