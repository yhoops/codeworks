/**
 * 演示身份与租户种子。
 * 负责 demo 用户、租户和 membership 的可重复 upsert，
 * 让主编排入口不承载认证与租户初始化细节。
 * 依赖：hash-wasm 与 identity 常量；被用于：seedDemoData。
 */
import { randomBytes } from "node:crypto";

import { DEMO_LOGIN, DEMO_TENANT_NAME } from "./constants.js";
import type { SystemPrismaClient } from "./types.js";

async function hashPassword(password: string): Promise<string> {
  const { argon2id } = await import("hash-wasm");

  return argon2id({
    password,
    salt: randomBytes(16),
    iterations: 3,
    parallelism: 1,
    memorySize: 19_456,
    hashLength: 32,
    outputType: "encoded"
  });
}

export async function upsertIdentity(prisma: SystemPrismaClient) {
  const passwordHash = await hashPassword(DEMO_LOGIN.password);
  const user = await prisma.user.upsert({
    where: { email: DEMO_LOGIN.email },
    update: {
      name: "Demo Project Manager",
      passwordHash
    },
    create: {
      email: DEMO_LOGIN.email,
      name: "Demo Project Manager",
      passwordHash
    }
  });
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_LOGIN.tenantSlug },
    update: {
      name: DEMO_TENANT_NAME,
      seatLimit: 5,
      deletedAt: null,
      updatedBy: user.id
    },
    create: {
      name: DEMO_TENANT_NAME,
      slug: DEMO_LOGIN.tenantSlug,
      seatLimit: 5,
      createdBy: user.id,
      updatedBy: user.id
    }
  });

  await prisma.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id
      }
    },
    update: {
      role: "ADMIN",
      status: "ACTIVE"
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: "ADMIN",
      status: "ACTIVE"
    }
  });

  return { tenant, user };
}
