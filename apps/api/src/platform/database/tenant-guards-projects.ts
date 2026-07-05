/**
 * tenant-guards-projects.ts 数据库平台模块。
 * 承载 Prisma 客户端、租户过滤或 guard 的基础能力，集中保护跨租户边界。
 * 依赖：Prisma 与租户上下文；被用于：API 服务与测试。
 */
// Guards project, sprint, and task relationship writes against cross-tenant references.
import type { PrismaClient } from "@prisma/client";

import type { TenantContext } from "../tenant/tenant-context.js";
import { auditForbiddenTenantAccess, ForbiddenTenantAccessError } from "./tenant-errors.js";

function collectProjectIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectProjectIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    projectId?: unknown;
    project?: { connect?: { id?: unknown } };
  };

  if (typeof record.projectId === "string") {
    ids.add(record.projectId);
  }

  if (typeof record.project?.connect?.id === "string") {
    ids.add(record.project.connect.id);
  }

  return ids;
}

export async function assertProjectTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const projectIds = [...collectProjectIds(data)];

  if (projectIds.length === 0) {
    return;
  }

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, tenantId: true }
  });
  const foreignProject = projects.find(
    (project) => project.tenantId !== context.tenantId
  );

  if (foreignProject) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_project",
      entityId: foreignProject.id,
      requestedTenantId: foreignProject.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

function collectSprintIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectSprintIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    sprintId?: unknown;
    sprint?: { connect?: { id?: unknown } };
  };

  if (typeof record.sprintId === "string") {
    ids.add(record.sprintId);
  }

  if (typeof record.sprint?.connect?.id === "string") {
    ids.add(record.sprint.connect.id);
  }

  return ids;
}

export async function assertSprintTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const sprintIds = [...collectSprintIds(data)];

  if (sprintIds.length === 0) {
    return;
  }

  const sprints = await prisma.sprint.findMany({
    where: { id: { in: sprintIds } },
    select: { id: true, tenantId: true }
  });
  const foreignSprint = sprints.find(
    (sprint) => sprint.tenantId !== context.tenantId
  );

  if (foreignSprint) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_sprint",
      entityId: foreignSprint.id,
      requestedTenantId: foreignSprint.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}

function collectTaskIds(data: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(data)) {
    for (const item of data) {
      collectTaskIds(item, ids);
    }

    return ids;
  }

  if (!data || typeof data !== "object") {
    return ids;
  }

  const record = data as {
    taskId?: unknown;
    task?: { connect?: { id?: unknown } };
  };

  if (typeof record.taskId === "string") {
    ids.add(record.taskId);
  }

  if (typeof record.task?.connect?.id === "string") {
    ids.add(record.task.connect.id);
  }

  return ids;
}


export async function assertTaskTargetsTenant(
  prisma: PrismaClient,
  context: TenantContext,
  entityType: string,
  data: unknown
) {
  const taskIds = [...collectTaskIds(data)];

  if (taskIds.length === 0) {
    return;
  }

  const tasks = await prisma.backlogTask.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, tenantId: true }
  });
  const foreignTask = tasks.find((task) => task.tenantId !== context.tenantId);

  if (foreignTask) {
    await auditForbiddenTenantAccess(prisma, context, entityType, {
      reason: "foreign_task",
      entityId: foreignTask.id,
      requestedTenantId: foreignTask.tenantId
    });
    throw new ForbiddenTenantAccessError();
  }
}
