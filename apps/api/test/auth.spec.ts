import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("Auth API", () => {
  const prisma = createSystemPrismaClient();
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("registers and logs in with argon2 password storage", async () => {
    const suffix = randomUUID();
    const email = `auth-${suffix}@codeworks.test`;
    const password = "correct horse battery staple";

    const registerResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, name: "Auth User" })
      .expect(201);

    expect(registerResponse.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: {
        email,
        name: "Auth User"
      }
    });
    expect(JSON.stringify(registerResponse.body)).not.toContain("passwordHash");

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toBe(password);
    expect(user.passwordHash).toMatch(/^\$argon2/);

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(200);

    expect(loginResponse.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { id: user.id, email }
    });
    expect(JSON.stringify(loginResponse.body)).not.toContain("passwordHash");
  });

  it("rotates refresh tokens and rejects old or logged out tokens", async () => {
    const suffix = randomUUID();
    const email = `refresh-${suffix}@codeworks.test`;
    const password = "refresh token secret";

    const loginResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, name: "Refresh User" })
      .expect(201);
    const firstRefresh = loginResponse.body.refreshToken as string;

    const refreshResponse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(200);
    const secondAccess = refreshResponse.body.accessToken as string;
    const secondRefresh = refreshResponse.body.refreshToken as string;

    expect(secondRefresh).not.toBe(firstRefresh);

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(401);

    await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ refreshToken: secondRefresh })
      .expect(204);

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: secondRefresh })
      .expect(401);

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${secondAccess}`)
      .expect(401);
  });

  it("protects non-public auth endpoints with access tokens", async () => {
    const suffix = randomUUID();
    const email = `me-${suffix}@codeworks.test`;
    const password = "access token secret";

    await request(app.getHttpServer()).get("/auth/me").expect(401);

    const registerResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, name: "Me User" })
      .expect(201);

    const meResponse = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .expect(200);

    expect(meResponse.body).toMatchObject({
      email,
      name: "Me User"
    });
    expect(JSON.stringify(meResponse.body)).not.toContain("passwordHash");
  });
});
