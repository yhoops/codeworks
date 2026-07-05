/**
 * pnl.service.ts 领域服务。
 * 封装单一业务能力的数据库读写与校验，避免控制器和其他模块重复组织查询。
 * 依赖：Prisma 客户端与领域类型；被用于：控制器、种子或测试。
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";
import {
  createDomainEventBus,
  type DomainEventBus
} from "../../platform/events/domain-event-bus.js";

@Injectable()
export class PnlService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;

  constructor(private readonly bus: DomainEventBus = createDomainEventBus()) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async getRealtimeProjectPnl(input: { tenantId: string; projectId: string }) {
    await this.requireProject(input.tenantId, input.projectId);
    return this.calculateProjectPnl(input);
  }

  async refreshProjectSnapshot(input: { tenantId: string; projectId: string }) {
    const pnl = await this.getRealtimeProjectPnl(input);
    const snapshot = await this.prisma.pnLSnapshot.upsert({
      where: {
        tenantId_projectId: {
          tenantId: input.tenantId,
          projectId: input.projectId
        }
      },
      create: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        revenue: this.money(pnl.revenue),
        totalCost: this.money(pnl.totalCost),
        grossProfit: this.money(pnl.grossProfit),
        grossMargin: new Prisma.Decimal(pnl.grossMargin.toFixed(4))
      },
      update: {
        revenue: this.money(pnl.revenue),
        totalCost: this.money(pnl.totalCost),
        grossProfit: this.money(pnl.grossProfit),
        grossMargin: new Prisma.Decimal(pnl.grossMargin.toFixed(4)),
        refreshedAt: new Date()
      }
    });

    if (pnl.revenue > 0 && pnl.totalCost > pnl.revenue) {
      await this.bus.publish({
        type: "project.budget_exceeded",
        tenantId: input.tenantId,
        aggregateType: "Project",
        aggregateId: input.projectId,
        occurredAt: new Date(),
        payload: {
          budgetAmount: pnl.revenue,
          totalCost: pnl.totalCost,
          overrun: Number((pnl.totalCost - pnl.revenue).toFixed(2))
        }
      });
    }

    return snapshot;
  }

  async getDashboardPnl(input: { tenantId: string; projectId: string }) {
    const snapshot = await this.prisma.pnLSnapshot.findUnique({
      where: {
        tenantId_projectId: {
          tenantId: input.tenantId,
          projectId: input.projectId
        }
      }
    });

    if (!snapshot || snapshot.tenantId !== input.tenantId) {
      throw new NotFoundException("PnL snapshot not found");
    }

    return {
      projectId: input.projectId,
      revenue: Number(snapshot.revenue),
      totalCost: Number(snapshot.totalCost),
      grossProfit: Number(snapshot.grossProfit),
      grossMargin: Number(snapshot.grossMargin)
    };
  }

  private async calculateProjectPnl(input: { tenantId: string; projectId: string }) {
    const [budgets, costs] = await Promise.all([
      this.prisma.budget.findMany({
        where: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          deletedAt: null
        },
        select: { amount: true }
      }),
      this.prisma.costEntry.findMany({
        where: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          deletedAt: null
        },
        select: { type: true, amount: true }
      })
    ]);
    const revenue = budgets.reduce(
      (sum, budget) => sum.plus(budget.amount),
      new Prisma.Decimal(0)
    );
    const costByType: Record<string, number> = {};
    const totalCost = costs.reduce((sum, cost) => {
      costByType[cost.type] = (costByType[cost.type] ?? 0) + Number(cost.amount);
      return sum.plus(cost.amount);
    }, new Prisma.Decimal(0));
    const grossProfit = revenue.minus(totalCost);
    const revenueNumber = Number(revenue);
    const grossProfitNumber = Number(grossProfit);

    return {
      projectId: input.projectId,
      revenue: revenueNumber,
      totalCost: Number(totalCost),
      grossProfit: grossProfitNumber,
      grossMargin:
        revenueNumber === 0
          ? 0
          : Number((grossProfitNumber / revenueNumber).toFixed(4)),
      costByType
    };
  }

  private async requireProject(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }
  }

  private money(value: number) {
    return new Prisma.Decimal(value.toFixed(2));
  }
}
