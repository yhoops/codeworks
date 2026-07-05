/**
 * demo-seed 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import { describe, expect, it } from "vitest";

import { AuthService } from "../src/modules/iam/auth/auth.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import { DEMO_LOGIN, seedDemoData } from "../../../prisma/seed.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("Demo seed", () => {
  it("creates an idempotent login-ready demo tenant and complete operating data", async () => {
    const prisma = createSystemPrismaClient();
    const authService = new AuthService();

    try {
      const first = await seedDemoData();
      const second = await seedDemoData();

      expect(second).toMatchObject({
        tenantId: first.tenantId,
        userId: first.userId,
        projectId: first.projectId
      });

      const login = await authService.login({
        email: DEMO_LOGIN.email,
        password: DEMO_LOGIN.password,
        tenantSlug: DEMO_LOGIN.tenantSlug
      });

      expect(login.tenant).toMatchObject({
        id: first.tenantId,
        slug: DEMO_LOGIN.tenantSlug,
        role: "ADMIN"
      });

      const [customers, projects, sprints, tasks, timeEntries, costEntries, allocations, budgets] =
        await Promise.all([
          prisma.customer.count({ where: { tenantId: first.tenantId, deletedAt: null } }),
          prisma.project.count({ where: { tenantId: first.tenantId, deletedAt: null } }),
          prisma.sprint.count({ where: { tenantId: first.tenantId, deletedAt: null } }),
          prisma.backlogTask.count({ where: { tenantId: first.tenantId, deletedAt: null } }),
          prisma.timeEntry.count({ where: { tenantId: first.tenantId, deletedAt: null } }),
          prisma.costEntry.count({ where: { tenantId: first.tenantId, deletedAt: null } }),
          prisma.resourceAllocation.count({
            where: { tenantId: first.tenantId, deletedAt: null }
          }),
          prisma.budget.count({
            where: { tenantId: first.tenantId, projectId: first.projectId, deletedAt: null }
          })
        ]);

      expect(customers).toBeGreaterThanOrEqual(1);
      expect(projects).toBeGreaterThanOrEqual(1);
      expect(sprints).toBeGreaterThanOrEqual(1);
      expect(tasks).toBeGreaterThanOrEqual(3);
      expect(timeEntries).toBeGreaterThanOrEqual(1);
      expect(costEntries).toBeGreaterThanOrEqual(1);
      expect(allocations).toBeGreaterThanOrEqual(1);
      expect(budgets).toBeGreaterThanOrEqual(1);

      const taskCountAfterSecondRun = await prisma.backlogTask.count({
        where: { tenantId: first.tenantId, deletedAt: null }
      });

      await seedDemoData();

      await expect(
        prisma.backlogTask.count({
          where: { tenantId: first.tenantId, deletedAt: null }
        })
      ).resolves.toBe(taskCountAfterSecondRun);
    } finally {
      await authService.onModuleDestroy();
      await prisma.$disconnect();
    }
  });
});
