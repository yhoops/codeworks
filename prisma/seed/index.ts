/**
 * 演示数据种子编排入口。
 * 按 identity、CRM、项目、资源、成本和 PnL 顺序组合各领域 seed 模块，
 * 对外保持 seedDemoData 与 DEMO_LOGIN 的稳定导出。
 * 依赖：系统 Prisma 客户端和各领域 seed 模块；被用于：prisma/seed.ts 与测试。
 */
import { createSystemPrismaClient } from "../../apps/api/src/platform/database/prisma.client.js";
import { DEMO_LOGIN, type DemoSeedResult } from "./constants.js";
import { upsertCustomer } from "./crm.js";
import {
  resetDemoFinancials,
  upsertBudget,
  upsertDemoTimeAndCost
} from "./costing.js";
import { upsertIdentity } from "./identity.js";
import { upsertPnlSnapshot } from "./pnl.js";
import { upsertProject, upsertSprint, upsertTask } from "./projects.js";
import { upsertAllocation, upsertCapacity, upsertEmployee } from "./resourcing.js";

export { DEMO_LOGIN } from "./constants.js";
export type { DemoSeedResult } from "./constants.js";

export async function seedDemoData(): Promise<DemoSeedResult> {
  const prisma = createSystemPrismaClient();

  try {
    const { tenant, user } = await upsertIdentity(prisma);
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

    await upsertCapacity(prisma, {
      tenantId: tenant.id,
      employeeId: employee.id
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

    await resetDemoFinancials(prisma, {
      tenantId: tenant.id,
      projectId: project.id,
      taskIds: [scopeTask.id, buildTask.id]
    });
    await upsertDemoTimeAndCost(prisma, {
      tenantId: tenant.id,
      projectId: project.id,
      taskId: scopeTask.id,
      employeeId: employee.id,
      userId: user.id
    });
    await upsertAllocation(prisma, {
      tenantId: tenant.id,
      employeeId: employee.id,
      projectId: project.id,
      taskId: scopeTask.id
    });
    await upsertBudget(prisma, {
      tenantId: tenant.id,
      projectId: project.id,
      userId: user.id
    });
    await upsertPnlSnapshot(prisma, {
      tenantId: tenant.id,
      projectId: project.id
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
