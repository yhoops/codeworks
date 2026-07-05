/**
 * tenant.service.ts 领域服务。
 * 封装单一业务能力的数据库读写与校验，避免控制器和其他模块重复组织查询。
 * 依赖：Prisma 客户端与领域类型；被用于：控制器、种子或测试。
 */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { createSystemPrismaClient } from "../../../platform/database/prisma.client.js";

export interface TenantActor {
  id: string;
}

@Injectable()
export class TenantService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async openTenant(actor: TenantActor, input: {
    name: string;
    slug: string;
    seatLimit: number;
  }) {
    const seatLimit = Math.max(1, Math.trunc(input.seatLimit));

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          seatLimit,
          createdBy: actor.id,
          updatedBy: actor.id
        }
      });
      const membership = await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: actor.id,
          role: "ADMIN",
          status: "ACTIVE"
        }
      });

      return { tenant, membership };
    });
  }

  async addMember(actor: TenantActor, tenantSlug: string, input: {
    userId: string;
    role: string;
  }) {
    const tenant = await this.requireAdminTenant(actor.id, tenantSlug);
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const activeSeats = await tx.membership.count({
        where: {
          tenantId: tenant.id,
          status: "ACTIVE"
        }
      });

      if (activeSeats >= tenant.seatLimit) {
        throw new ConflictException("Tenant seat limit is full");
      }

      const membership = await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: input.userId,
          role: input.role,
          status: "ACTIVE"
        }
      });

      return { tenant, membership };
    });
  }

  async updateMemberStatus(
    actor: TenantActor,
    tenantSlug: string,
    userId: string,
    status: string
  ) {
    const tenant = await this.requireAdminTenant(actor.id, tenantSlug);
    const membership = await this.prisma.membership.update({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId
        }
      },
      data: { status }
    });

    return { tenant, membership };
  }

  private async requireAdminTenant(actorUserId: string, tenantSlug: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: actorUserId,
        role: "ADMIN",
        status: "ACTIVE",
        tenant: { slug: tenantSlug }
      },
      include: { tenant: true }
    });

    if (!membership) {
      throw new ForbiddenException("Tenant admin membership is required");
    }

    return membership.tenant;
  }
}
