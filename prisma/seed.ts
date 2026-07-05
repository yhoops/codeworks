import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

import { Prisma } from "@prisma/client";

import { createSystemPrismaClient } from "../apps/api/src/platform/database/prisma.client.js";

export const DEMO_LOGIN = {
  email: "demo.pm@codeworks.test",
  password: "CodeworksDemo2026!",
  tenantSlug: "demo"
} as const;

const DEMO_TENANT_NAME = "Codeworks Demo Tenant";
const DEMO_CUSTOMER_NAME = "Acme Digital Transformation";
const DEMO_PROJECT_NAME = "Acme ERP Launch";
const DEMO_SPRINT_NAME = "Sprint 1 - Quote to Delivery";
const DEMO_EMPLOYEE_EMAIL = "lin.demo@codeworks.test";
const DEMO_WEEK_START = new Date("2026-07-06T00:00:00.000Z");

export interface DemoSeedResult {
  tenantId: string;
  userId: string;
  projectId: string;
}

type SystemPrismaClient = ReturnType<typeof createSystemPrismaClient>;

async function hashPassword(password: string): Promise<string> {
  const { argon2id } = await import("hash-wasm");

  return argon2id({
    password,
    salt: randomBytes(16),
    iterations: 3,
    parallelism: 1,
    memorySize: 19_456,
    hashLength: 32,
    outputType: "encoded"
  });
}

async function upsertCustomer(prisma: SystemPrismaClient, tenantId: string) {
  const existing = await prisma.customer.findFirst({
    where: { tenantId, name: DEMO_CUSTOMER_NAME }
  });
  const data = {
    status: "ACTIVE",
    notes: "Demo customer with an active ERP implementation stream.",
    deletedAt: null
  };

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.customer.create({
    data: {
      tenantId,
      name: DEMO_CUSTOMER_NAME,
      ...data
    }
  });
}

async function upsertProject(
  prisma: SystemPrismaClient,
  input: { tenantId: string; customerId: string; projectManagerId: string }
) {
  const existing = await prisma.project.findFirst({
    where: { tenantId: input.tenantId, name: DEMO_PROJECT_NAME }
  });
  const data = {
    customerId: input.customerId,
    status: "ACTIVE",
    source: "DEMO_SEED",
    projectManagerId: input.projectManagerId,
    deletedAt: null
  };

  if (existing) {
    return prisma.project.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.project.create({
    data: {
      tenantId: input.tenantId,
      name: DEMO_PROJECT_NAME,
      ...data
    }
  });
}

async function upsertSprint(
  prisma: SystemPrismaClient,
  input: { tenantId: string; projectId: string }
) {
  const existing = await prisma.sprint.findFirst({
    where: { tenantId: input.tenantId, projectId: input.projectId, name: DEMO_SPRINT_NAME }
  });
  const data = {
    goal: "Demonstrate lead-to-delivery execution with live cost feedback.",
    status: "ACTIVE",
    startDate: DEMO_WEEK_START,
    endDate: new Date("2026-07-17T00:00:00.000Z"),
    deletedAt: null
  };

  if (existing) {
    return prisma.sprint.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.sprint.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      name: DEMO_SPRINT_NAME,
      ...data
    }
  });
}

async function upsertEmployee(prisma: SystemPrismaClient, tenantId: string) {
  return prisma.employee.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: DEMO_EMPLOYEE_EMAIL
      }
    },
    update: {
      name: "Lin Demo",
      costRate: new Prisma.Decimal("320.00"),
      currency: "CNY",
      deletedAt: null
    },
    create: {
      tenantId,
      name: "Lin Demo",
      email: DEMO_EMPLOYEE_EMAIL,
      costRate: new Prisma.Decimal("320.00"),
      currency: "CNY"
    }
  });
}

async function upsertTask(
  prisma: SystemPrismaClient,
  input: {
    tenantId: string;
    projectId: string;
    sprintId: string;
    title: string;
    description: string;
    estimateHours: string;
    status: string;
    boardColumn: string;
    assigneeUserId: string;
  }
) {
  const existing = await prisma.backlogTask.findFirst({
    where: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      title: input.title
    }
  });
  const data = {
    sprintId: input.sprintId,
    description: input.description,
    estimateHours: new Prisma.Decimal(input.estimateHours),
    status: input.status,
    boardColumn: input.boardColumn,
    assigneeUserId: input.assigneeUserId,
    deletedAt: null
  };

  if (existing) {
    return prisma.backlogTask.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.backlogTask.create({
    data: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      title: input.title,
      ...data
    }
  });
}

async function upsertAllocation(
  prisma: SystemPrismaClient,
  input: {
    tenantId: string;
    employeeId: string;
    projectId: string;
    taskId: string;
  }
) {
  const existing = await prisma.resourceAllocation.findFirst({
    where: {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      projectId: input.projectId,
      taskId: input.taskId,
      weekStart: DEMO_WEEK_START
    }
  });
  const data = {
    plannedHours: new Prisma.Decimal("44.00"),
    availableHoursOverride: new Prisma.Decimal("40.00"),
    isOverloaded: true,
    deletedAt: null
  };

  if (existing) {
    return prisma.resourceAllocation.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.resourceAllocation.create({
    data: {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      projectId: input.projectId,
      taskId: input.taskId,
      weekStart: DEMO_WEEK_START,
      ...data
    }
  });
}

export async function seedDemoData(): Promise<DemoSeedResult> {
  const prisma = createSystemPrismaClient();
  const passwordHash = await hashPassword(DEMO_LOGIN.password);

  try {
    const user = await prisma.user.upsert({
      where: { email: DEMO_LOGIN.email },
      update: {
        name: "Demo Project Manager",
        passwordHash
      },
      create: {
        email: DEMO_LOGIN.email,
        name: "Demo Project Manager",
        passwordHash
      }
    });

    const tenant = await prisma.tenant.upsert({
      where: { slug: DEMO_LOGIN.tenantSlug },
      update: {
        name: DEMO_TENANT_NAME,
        seatLimit: 5,
        deletedAt: null,
        updatedBy: user.id
      },
      create: {
        name: DEMO_TENANT_NAME,
        slug: DEMO_LOGIN.tenantSlug,
        seatLimit: 5,
        createdBy: user.id,
        updatedBy: user.id
      }
    });

    await prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id
        }
      },
      update: {
        role: "ADMIN",
        status: "ACTIVE"
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });

    const customer = await upsertCustomer(prisma, tenant.id);
    const project = await upsertProject(prisma, {
      tenantId: tenant.id,
      customerId: customer.id,
      projectManagerId: user.id
    });
    const sprint = await upsertSprint(prisma, {
      tenantId: tenant.id,
      projectId: project.id
    });
    const employee = await upsertEmployee(prisma, tenant.id);

    await prisma.capacity.upsert({
      where: { id: `${employee.id}:demo-capacity` },
      update: {
        weeklyHours: new Prisma.Decimal("40.00"),
        effectiveFrom: DEMO_WEEK_START,
        effectiveTo: null,
        deletedAt: null
      },
      create: {
        id: `${employee.id}:demo-capacity`,
        tenantId: tenant.id,
        employeeId: employee.id,
        weeklyHours: new Prisma.Decimal("40.00"),
        effectiveFrom: DEMO_WEEK_START
      }
    });

    const [scopeTask, buildTask] = await Promise.all([
      upsertTask(prisma, {
        tenantId: tenant.id,
        projectId: project.id,
        sprintId: sprint.id,
        title: "Confirm implementation scope",
        description: "Align customer scope, budget and sprint backlog before build starts.",
        estimateHours: "12.00",
        status: "DONE",
        boardColumn: "DONE",
        assigneeUserId: user.id
      }),
      upsertTask(prisma, {
        tenantId: tenant.id,
        projectId: project.id,
        sprintId: sprint.id,
        title: "Build delivery workflow",
        description: "Move the core project board through active delivery.",
        estimateHours: "28.00",
        status: "IN_PROGRESS",
        boardColumn: "IN_PROGRESS",
        assigneeUserId: user.id
      }),
      upsertTask(prisma, {
        tenantId: tenant.id,
        projectId: project.id,
        sprintId: sprint.id,
        title: "Prepare go-live readiness",
        description: "Keep a visible remaining task for backlog and dashboard demos.",
        estimateHours: "16.00",
        status: "TODO",
        boardColumn: "TODO",
        assigneeUserId: user.id
      })
    ]);
    const demoTaskIds = [scopeTask.id, buildTask.id];

    await prisma.costEntry.deleteMany({
      where: {
        tenantId: tenant.id,
        projectId: project.id
      }
    });
    await prisma.timeEntry.deleteMany({
      where: {
        tenantId: tenant.id,
        taskId: { in: demoTaskIds }
      }
    });
    await prisma.resourceAllocation.deleteMany({
      where: {
        tenantId: tenant.id,
        projectId: project.id
      }
    });

    const timeEntry = await prisma.timeEntry.upsert({
      where: {
        tenantId_taskId_employeeId: {
          tenantId: tenant.id,
          taskId: scopeTask.id,
          employeeId: employee.id
        }
      },
      update: {
        hours: new Prisma.Decimal("6.50"),
        source: "DEMO_SEED",
        note: "Demo labor booked against completed scope work.",
        correctedByUserId: user.id,
        correctedAt: new Date("2026-07-07T10:00:00.000Z"),
        deletedAt: null
      },
      create: {
        tenantId: tenant.id,
        taskId: scopeTask.id,
        employeeId: employee.id,
        hours: new Prisma.Decimal("6.50"),
        source: "DEMO_SEED",
        note: "Demo labor booked against completed scope work.",
        correctedByUserId: user.id,
        correctedAt: new Date("2026-07-07T10:00:00.000Z")
      }
    });

    await prisma.costEntry.upsert({
      where: {
        tenantId_timeEntryId_type: {
          tenantId: tenant.id,
          timeEntryId: timeEntry.id,
          type: "labor"
        }
      },
      update: {
        projectId: project.id,
        taskId: scopeTask.id,
        employeeId: employee.id,
        amount: new Prisma.Decimal("2080.00"),
        currency: "CNY",
        quantityHours: new Prisma.Decimal("6.50"),
        unitCostRate: new Prisma.Decimal("320.00"),
        source: "DEMO_SEED",
        deletedAt: null
      },
      create: {
        tenantId: tenant.id,
        projectId: project.id,
        taskId: scopeTask.id,
        employeeId: employee.id,
        timeEntryId: timeEntry.id,
        type: "labor",
        amount: new Prisma.Decimal("2080.00"),
        currency: "CNY",
        quantityHours: new Prisma.Decimal("6.50"),
        unitCostRate: new Prisma.Decimal("320.00"),
        source: "DEMO_SEED"
      }
    });

    await upsertAllocation(prisma, {
      tenantId: tenant.id,
      employeeId: employee.id,
      projectId: project.id,
      taskId: scopeTask.id
    });

    await prisma.budget.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: "MVP Demo Budget"
        }
      },
      update: {
        projectId: project.id,
        amount: new Prisma.Decimal("100000.00"),
        currency: "CNY",
        updatedBy: user.id,
        deletedAt: null
      },
      create: {
        tenantId: tenant.id,
        projectId: project.id,
        name: "MVP Demo Budget",
        amount: new Prisma.Decimal("100000.00"),
        currency: "CNY",
        createdBy: user.id,
        updatedBy: user.id
      }
    });

    await prisma.pnLSnapshot.upsert({
      where: {
        tenantId_projectId: {
          tenantId: tenant.id,
          projectId: project.id
        }
      },
      update: {
        revenue: new Prisma.Decimal("100000.00"),
        totalCost: new Prisma.Decimal("2080.00"),
        grossProfit: new Prisma.Decimal("97920.00"),
        grossMargin: new Prisma.Decimal("0.9792")
      },
      create: {
        tenantId: tenant.id,
        projectId: project.id,
        revenue: new Prisma.Decimal("100000.00"),
        totalCost: new Prisma.Decimal("2080.00"),
        grossProfit: new Prisma.Decimal("97920.00"),
        grossMargin: new Prisma.Decimal("0.9792")
      }
    });

    return {
      tenantId: tenant.id,
      userId: user.id,
      projectId: project.id
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await seedDemoData();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
