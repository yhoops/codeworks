import { Prisma } from "@prisma/client";

import { createPrismaClient } from "../apps/api/src/platform/database/prisma.client.js";

const prisma = createPrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: { name: "Demo Tenant" },
    create: {
      name: "Demo Tenant",
      slug: "demo"
    }
  });

  await prisma.budget.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: "MVP Demo Budget"
      }
    },
    update: {
      amount: new Prisma.Decimal("100000.00")
    },
    create: {
      tenantId: tenant.id,
      name: "MVP Demo Budget",
      amount: new Prisma.Decimal("100000.00")
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
