/**
 * audit.service 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import {
  createPrismaClient,
  createSystemPrismaClient
} from "../src/platform/database/prisma.client.js";
import { AuditService } from "../src/platform/audit/audit.service.js";
import { runWithTenantContext } from "../src/platform/tenant/tenant-context.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("AuditService", () => {
  const systemPrisma = createSystemPrismaClient();
  const tenantPrisma = createPrismaClient();
  const auditService = new AuditService(tenantPrisma);

  afterAll(async () => {
    await tenantPrisma.$disconnect();
    await systemPrisma.$disconnect();
  });

  it("appends actor, entity, before and after values for the active tenant", async () => {
    const suffix = randomUUID();
    const tenant = await systemPrisma.tenant.create({
      data: { name: "Audit Tenant", slug: `audit-${suffix}` }
    });

    const auditLog = await runWithTenantContext(
      { tenantId: tenant.id, userId: "user-1" },
      () =>
        auditService.record({
          action: "BUDGET_UPDATED",
          entityType: "Budget",
          entityId: "budget-1",
          before: { amount: "10.00" },
          after: { amount: "12.00" }
        })
    );

    expect(auditLog).toMatchObject({
      tenantId: tenant.id,
      actorUserId: "user-1",
      action: "BUDGET_UPDATED",
      entityType: "Budget",
      entityId: "budget-1"
    });
    expect(auditLog.createdAt).toBeInstanceOf(Date);
    expect(auditLog.details).toEqual({
      before: { amount: "10.00" },
      after: { amount: "12.00" }
    });
  });

  it("rejects application updates and deletes to keep audit logs append-only", async () => {
    const suffix = randomUUID();
    const tenant = await systemPrisma.tenant.create({
      data: { name: "Immutable Audit Tenant", slug: `audit-immutable-${suffix}` }
    });
    const auditLog = await systemPrisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: "BUDGET_CREATED",
        entityType: "Budget",
        details: { after: { name: "Initial" } }
      }
    });

    await expect(
      runWithTenantContext({ tenantId: tenant.id }, () =>
        tenantPrisma.auditLog.update({
          where: { id: auditLog.id },
          data: { action: "MUTATED" }
        })
      )
    ).rejects.toThrow(/append-only/i);

    await expect(
      runWithTenantContext({ tenantId: tenant.id }, () =>
        tenantPrisma.auditLog.delete({ where: { id: auditLog.id } })
      )
    ).rejects.toThrow(/append-only/i);
  });

  it("rejects direct database updates and deletes to keep audit logs append-only", async () => {
    const suffix = randomUUID();
    const tenant = await systemPrisma.tenant.create({
      data: { name: "Database Audit Tenant", slug: `audit-db-${suffix}` }
    });
    const auditLog = await systemPrisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: "BUDGET_CREATED",
        entityType: "Budget",
        details: { after: { name: "Initial" } }
      }
    });

    await expect(
      systemPrisma.auditLog.update({
        where: { id: auditLog.id },
        data: { action: "MUTATED" }
      })
    ).rejects.toThrow(/append-only/i);

    await expect(
      systemPrisma.auditLog.delete({ where: { id: auditLog.id } })
    ).rejects.toThrow(/append-only/i);
  });
});
