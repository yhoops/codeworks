/**
 * tenant-context 行为规格测试。
 * 按业务能力或平台契约聚焦真实服务/数据库行为，避免把跨模块验收压回实现细节。
 * 依赖：Vitest、Prisma/Nest 测试入口；被用于：API 回归门禁。
 */
import { describe, expect, it } from "vitest";

import {
  getTenantContext,
  requireTenantContext,
  runWithTenantContext
} from "../src/platform/tenant/tenant-context.js";

describe("TenantContext", () => {
  it("keeps tenant context scoped to the async request flow", async () => {
    await expect(
      runWithTenantContext(
        {
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["admin"]
        },
        async () => {
          await Promise.resolve();
          return requireTenantContext();
        }
      )
    ).resolves.toMatchObject({
      tenantId: "tenant-a",
      userId: "user-a",
      roles: ["admin"]
    });

    expect(getTenantContext()).toBeUndefined();
  });

  it("requires a tenant context for isolated operations", () => {
    expect(() => requireTenantContext()).toThrow(/Tenant context is required/);
  });
});
