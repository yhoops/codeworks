import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { createSystemPrismaClient } from "../../../platform/database/prisma.client.js";

@Injectable()
export class DepartmentService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async createDepartment(input: {
    tenantId: string;
    name: string;
    parentId?: string;
  }) {
    if (input.parentId) {
      await this.requireDepartment(input.tenantId, input.parentId);
    }

    return this.prisma.department.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        parentId: input.parentId
      }
    });
  }

  async moveDepartment(input: {
    tenantId: string;
    departmentId: string;
    newParentId?: string;
  }) {
    await this.requireDepartment(input.tenantId, input.departmentId);

    if (input.newParentId) {
      await this.requireDepartment(input.tenantId, input.newParentId);
      const descendantIds = await this.getDescendantDepartmentIds(
        input.tenantId,
        input.departmentId
      );

      if (descendantIds.includes(input.newParentId)) {
        throw new BadRequestException("Department move would create a cycle");
      }
    }

    return this.prisma.department.update({
      where: { id: input.departmentId },
      data: { parentId: input.newParentId ?? null }
    });
  }

  async getDescendantDepartmentIds(
    tenantId: string,
    departmentId: string
  ): Promise<string[]> {
    await this.requireDepartment(tenantId, departmentId);

    const orderedIds: string[] = [];
    const queue = [departmentId];

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      orderedIds.push(currentId);

      const children = await this.prisma.department.findMany({
        where: {
          tenantId,
          parentId: currentId,
          deletedAt: null
        },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      });
      queue.push(...children.map((child) => child.id));
    }

    return orderedIds;
  }

  async getUserIdsInDepartmentScope(
    tenantId: string,
    departmentId: string
  ): Promise<string[]> {
    const departmentIds = await this.getDescendantDepartmentIds(
      tenantId,
      departmentId
    );
    const memberships = await this.prisma.membership.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        departmentId: { in: departmentIds }
      },
      orderBy: { createdAt: "asc" },
      select: { userId: true }
    });

    return memberships.map((membership) => membership.userId);
  }

  private async requireDepartment(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        tenantId,
        deletedAt: null
      }
    });

    if (!department) {
      throw new NotFoundException("Department not found");
    }

    return department;
  }
}
