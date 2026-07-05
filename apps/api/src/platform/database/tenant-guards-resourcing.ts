// Guards resourcing relationship writes against cross-tenant employee and skill references.
import type { PrismaClient } from "@prisma/client";

import type { TenantContext } from "../tenant/tenant-context.js";
import { auditForbiddenTenantAccess, ForbiddenTenantAccessError } from "./tenant-errors.js";

function collectEmployeeIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectEmployeeIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    employeeId?: unknown;
    employee?: { connect?: { id?: unknown } };
  };

  if (typeof record.employeeId === "string") {
    ids.add(record.employeeId);
  }

  if (typeof record.employee?.connect?.id === "string") {
    ids.add(record.employee.connect.id);
  }

  return ids;
}

export async function assertEmployeeTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const employeeIds = [...collectEmployeeIds(data)];

  if (employeeIds.length === 0) {
    return;
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, tenantId: true }
  });
  const foreignEmployee = employees.find(
    (employee) => employee.tenantId !== context.tenantId
  );

  if (foreignEmployee) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_employee",
      entityId: foreignEmployee.id,
      requestedTenantId: foreignEmployee.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

function collectSkillIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectSkillIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    skillId?: unknown;
    skill?: { connect?: { id?: unknown } };
  };

  if (typeof record.skillId === "string") {
    ids.add(record.skillId);
  }

  if (typeof record.skill?.connect?.id === "string") {
    ids.add(record.skill.connect.id);
  }

  return ids;
}

export async function assertSkillTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const skillIds = [...collectSkillIds(data)];

  if (skillIds.length === 0) {
    return;
  }

  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds } },
    select: { id: true, tenantId: true }
  });
  const foreignSkill = skills.find((skill) => skill.tenantId !== context.tenantId);

  if (foreignSkill) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_skill",
      entityId: foreignSkill.id,
      requestedTenantId: foreignSkill.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}
