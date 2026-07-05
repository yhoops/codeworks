/**
 * tenant-management 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

async function registerUser(
  app: INestApplication,
  email: string,
  name: string
): Promise<{ accessToken: string; refreshToken: string; user: { id: string } }> {
  const response = await request(app.getHttpServer())
    .post("/auth/register")
    .send({ email, password: "tenant-management-secret", name })
    .expect(201);

  return response.body;
}

describeWithDatabase("Tenant management API", () => {
  const prisma = createSystemPrismaClient();
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("opens a tenant with the requester as active admin member", async () => {
    const suffix = randomUUID();
    const owner = await registerUser(
      app,
      `owner-${suffix}@codeworks.test`,
      "Owner User"
    );

    const response = await request(app.getHttpServer())
      .post("/tenants/open")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Acme Studio",
        slug: `acme-${suffix}`,
        seatLimit: 3
      })
      .expect(201);

    expect(response.body).toMatchObject({
      tenant: {
        name: "Acme Studio",
        slug: `acme-${suffix}`,
        seatLimit: 3
      },
      membership: {
        userId: owner.user.id,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });

    await expect(
      prisma.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: response.body.tenant.id,
            userId: owner.user.id
          }
        }
      })
    ).resolves.toMatchObject({
      role: "ADMIN",
      status: "ACTIVE"
    });
  });

  it("rejects adding members when the tenant seat limit is full", async () => {
    const suffix = randomUUID();
    const owner = await registerUser(
      app,
      `seat-owner-${suffix}@codeworks.test`,
      "Seat Owner"
    );
    const member = await registerUser(
      app,
      `seat-member-${suffix}@codeworks.test`,
      "Seat Member"
    );
    const tenantResponse = await request(app.getHttpServer())
      .post("/tenants/open")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Seat Limited Tenant",
        slug: `seat-${suffix}`,
        seatLimit: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantResponse.body.tenant.slug}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ userId: member.user.id, role: "MEMBER" })
      .expect(409);

    await expect(
      prisma.membership.count({
        where: {
          tenantId: tenantResponse.body.tenant.id,
          status: "ACTIVE"
        }
      })
    ).resolves.toBe(1);
  });

  it("rejects tenant login after a member is deactivated", async () => {
    const suffix = randomUUID();
    const owner = await registerUser(
      app,
      `active-owner-${suffix}@codeworks.test`,
      "Active Owner"
    );
    const memberEmail = `active-member-${suffix}@codeworks.test`;
    const member = await registerUser(app, memberEmail, "Active Member");
    const tenantSlug = `active-${suffix}`;

    await request(app.getHttpServer())
      .post("/tenants/open")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Active Tenant",
        slug: tenantSlug,
        seatLimit: 2
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ userId: member.user.id, role: "MEMBER" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: memberEmail,
        password: "tenant-management-secret",
        tenantSlug
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tenants/${tenantSlug}/members/${member.user.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "INACTIVE" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: memberEmail,
        password: "tenant-management-secret",
        tenantSlug
      })
      .expect(401);
  });
});
