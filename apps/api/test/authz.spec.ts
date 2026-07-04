import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  assertPermission,
  canPerform,
  filterByDataScope,
  maskFinancialFields,
  type AuthzContext
} from "../src/platform/authz/rbac.guard.js";

const admin: AuthzContext = {
  tenantId: "tenant-a",
  userId: "admin",
  roles: ["ADMIN"]
};
const pm: AuthzContext = {
  tenantId: "tenant-a",
  userId: "pm-1",
  roles: ["PM"]
};
const member: AuthzContext = {
  tenantId: "tenant-a",
  userId: "member-1",
  roles: ["MEMBER"]
};
const finance: AuthzContext = {
  tenantId: "tenant-a",
  userId: "finance-1",
  roles: ["FINANCE"]
};

describe("RBAC authorization", () => {
  it("defaults to deny and rejects member-only forbidden operations", () => {
    expect(canPerform(undefined, "tenant.member.manage")).toBe(false);
    expect(canPerform(member, "tenant.member.manage")).toBe(false);
    expect(canPerform(admin, "tenant.member.manage")).toBe(true);

    expect(() => assertPermission(member, "tenant.member.manage")).toThrow(
      ForbiddenException
    );
  });

  it("applies the fixed four-role permission matrix", () => {
    expect(canPerform(admin, "financial.read")).toBe(true);
    expect(canPerform(finance, "financial.read")).toBe(true);
    expect(canPerform(pm, "financial.read")).toBe(false);
    expect(canPerform(member, "project.read")).toBe(true);
    expect(canPerform(member, "project.write")).toBe(false);
    expect(canPerform(pm, "project.write")).toBe(true);
  });

  it("filters list records by tenant and role data scope", () => {
    const records = [
      {
        id: "own",
        tenantId: "tenant-a",
        ownerUserId: "member-1",
        projectManagerId: "pm-2",
        memberUserIds: ["member-1"]
      },
      {
        id: "pm-project",
        tenantId: "tenant-a",
        ownerUserId: "member-2",
        projectManagerId: "pm-1",
        memberUserIds: ["member-2"]
      },
      {
        id: "other",
        tenantId: "tenant-a",
        ownerUserId: "member-2",
        projectManagerId: "pm-2",
        memberUserIds: ["member-2"]
      },
      {
        id: "foreign-tenant",
        tenantId: "tenant-b",
        ownerUserId: "member-1",
        projectManagerId: "pm-1",
        memberUserIds: ["member-1"]
      }
    ];

    expect(filterByDataScope(admin, records).map((record) => record.id)).toEqual([
      "own",
      "pm-project",
      "other"
    ]);
    expect(filterByDataScope(pm, records).map((record) => record.id)).toEqual([
      "pm-project"
    ]);
    expect(filterByDataScope(member, records).map((record) => record.id)).toEqual([
      "own"
    ]);
  });

  it("masks cost and profit fields for non-finance roles", () => {
    const record = {
      id: "project-1",
      name: "Project",
      plannedCost: "1000.00",
      actualCost: "800.00",
      grossProfit: "200.00"
    };

    expect(maskFinancialFields(member, record)).toEqual({
      id: "project-1",
      name: "Project",
      plannedCost: null,
      actualCost: null,
      grossProfit: null
    });
    expect(maskFinancialFields(admin, record)).toEqual(record);
    expect(maskFinancialFields(finance, record)).toEqual(record);
  });
});
