/**
 * Shared fixture for tenant-aware Prisma isolation specs.
 * Owns the paired system/tenant clients so split specs keep identical setup.
 */
import { Prisma } from "@prisma/client";
import { afterAll, describe } from "vitest";

import {
  createPrismaClient,
  createSystemPrismaClient,
  ForbiddenTenantAccessError
} from "../src/platform/database/prisma.client.js";
import { runWithTenantContext } from "../src/platform/tenant/tenant-context.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

type SystemPrismaClient = ReturnType<typeof createSystemPrismaClient>;
type TenantPrismaClient = ReturnType<typeof createPrismaClient>;

export { ForbiddenTenantAccessError, Prisma, runWithTenantContext };

export interface TenantPrismaHarness {
  systemPrisma: SystemPrismaClient;
  tenantPrisma: TenantPrismaClient;
}

export function describeTenantPrisma(
  name: string,
  registerSpecs: (harness: TenantPrismaHarness) => void
) {
  describeWithDatabase(name, () => {
    const systemPrisma = createSystemPrismaClient();
    const tenantPrisma = createPrismaClient();

    afterAll(async () => {
      await tenantPrisma.$disconnect();
      await systemPrisma.$disconnect();
    });

    registerSpecs({ systemPrisma, tenantPrisma });
  });
}

export async function createTenantPair(
  systemPrisma: SystemPrismaClient,
  suffix: string,
  slugScope: string
) {
  const tenantA = await systemPrisma.tenant.create({
    data: { name: "Tenant A", slug: `tenant-a-${slugScope}-${suffix}` }
  });
  const tenantB = await systemPrisma.tenant.create({
    data: { name: "Tenant B", slug: `tenant-b-${slugScope}-${suffix}` }
  });

  return { tenantA, tenantB };
}
