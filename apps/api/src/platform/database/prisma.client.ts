// Composes focused Prisma clients and tenant isolation extensions.
import { PrismaClient } from "@prisma/client";

import { createBacklogTenantExtension } from "./extensions/tenant-extension-backlog.js";
import { createBudgetTenantExtension } from "./extensions/tenant-extension-budget.js";
import { createCostingTenantExtension } from "./extensions/tenant-extension-costing.js";
import { createCrmTenantExtension } from "./extensions/tenant-extension-crm.js";
import { createFilesTenantExtension } from "./extensions/tenant-extension-files.js";
import { createPeopleTenantExtension } from "./extensions/tenant-extension-people.js";
import { createPnlTenantExtension } from "./extensions/tenant-extension-pnl.js";
import { createProjectsTenantExtension } from "./extensions/tenant-extension-projects.js";
import { createResourcingTenantExtension } from "./extensions/tenant-extension-resourcing.js";
import { createSprintsTenantExtension } from "./extensions/tenant-extension-sprints.js";

export { createSystemPrismaClient } from "./system-prisma.client.js";
export { ForbiddenTenantAccessError } from "./tenant-errors.js";

function createBasePrismaClient() {
  return new PrismaClient();
}

export function createPrismaClient() {
  const prisma = createBasePrismaClient();

  return prisma
    .$extends(createBudgetTenantExtension(prisma))
    .$extends(createCrmTenantExtension(prisma))
    .$extends(createProjectsTenantExtension(prisma))
    .$extends(createSprintsTenantExtension(prisma))
    .$extends(createBacklogTenantExtension(prisma))
    .$extends(createPeopleTenantExtension(prisma))
    .$extends(createResourcingTenantExtension(prisma))
    .$extends(createCostingTenantExtension(prisma))
    .$extends(createPnlTenantExtension(prisma))
    .$extends(createFilesTenantExtension(prisma));
}

export type CodeworksPrismaClient = ReturnType<typeof createPrismaClient>;
