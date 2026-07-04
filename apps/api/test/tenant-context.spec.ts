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
