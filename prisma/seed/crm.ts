/**
 * 演示 CRM 种子。
 * 负责 demo 客户记录的可重复 upsert。
 * 依赖：CRM 常量与系统 Prisma 类型；被用于：seedDemoData。
 */
import { DEMO_CUSTOMER_NAME } from "./constants.js";
import type { SystemPrismaClient } from "./types.js";

export async function upsertCustomer(prisma: SystemPrismaClient, tenantId: string) {
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
