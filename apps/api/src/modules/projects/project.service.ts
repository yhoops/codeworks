/**
 * project.service.ts 领域服务。
 * 封装单一业务能力的数据库读写与校验，避免控制器和其他模块重复组织查询。
 * 依赖：Prisma 客户端与领域类型；被用于：控制器、种子或测试。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import {
  assertPermission,
  type AuthzContext
} from "../../platform/authz/rbac.guard.js";
import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";
import {
  createDomainEventBus,
  type DomainEventBus,
  TransactionalDomainEvents
} from "../../platform/events/domain-event-bus.js";

export type ProjectStatus =
  | "DRAFT"
  | "ACTIVE"
  | "DELIVERING"
  | "CLOSED"
  | "SUSPENDED"
  | "CANCELED";

type MilestoneInput = {
  name: string;
  dueDate?: Date;
};

const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ["ACTIVE", "SUSPENDED", "CANCELED"],
  ACTIVE: ["DELIVERING", "SUSPENDED", "CANCELED"],
  DELIVERING: ["CLOSED", "SUSPENDED", "CANCELED"],
  SUSPENDED: ["ACTIVE", "CANCELED"],
  CLOSED: [],
  CANCELED: []
};

@Injectable()
export class ProjectService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;
  private readonly events: TransactionalDomainEvents;

  constructor(bus: DomainEventBus = createDomainEventBus()) {
    this.events = new TransactionalDomainEvents(bus);
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async createProject(
    actor: AuthzContext,
    input: {
      tenantId: string;
      customerId: string;
      name: string;
      milestones?: MilestoneInput[];
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    await this.requireCustomer(input.tenantId, input.customerId);

    return this.prisma.project.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        name: this.requireText(input.name, "Project name is required"),
        status: "DRAFT",
        source: "MANUAL",
        projectManagerId: actor.userId,
        milestones: {
          create: this.normalizeMilestones(input.milestones ?? []).map(
            (milestone) => ({
              ...milestone,
              tenantId: input.tenantId
            })
          )
        }
      },
      include: this.activeMilestonesInclude()
    });
  }

  async transitionProject(
    actor: AuthzContext,
    input: {
      tenantId: string;
      projectId: string;
      toStatus: ProjectStatus;
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    const project = await this.requireProject(input.tenantId, input.projectId);
    const fromStatus = project.status as ProjectStatus;

    if (!TRANSITIONS[fromStatus]?.includes(input.toStatus)) {
      throw new BadRequestException(
        `Invalid project transition ${fromStatus} -> ${input.toStatus}`
      );
    }

    if (
      input.toStatus === "CLOSED" &&
      project.milestones.some((milestone) => milestone.status !== "ACCEPTED")
    ) {
      throw new BadRequestException(
        "Project cannot be closed before all milestones are accepted"
      );
    }

    return this.events.runInTransaction(this.prisma, async (tx, buffer) => {
      const updated = await tx.project.update({
        where: { id: input.projectId },
        data: { status: input.toStatus },
        include: this.activeMilestonesInclude()
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: actor.userId,
          action: "PROJECT_STATUS_CHANGED",
          entityType: "Project",
          entityId: input.projectId,
          details: {
            before: { status: fromStatus },
            after: { status: input.toStatus }
          }
        }
      });
      buffer.record({
        type: "project.status_changed",
        tenantId: input.tenantId,
        aggregateType: "Project",
        aggregateId: input.projectId,
        payload: {
          fromStatus,
          toStatus: input.toStatus
        }
      });

      return updated;
    });
  }

  async createMilestone(
    actor: AuthzContext,
    input: {
      tenantId: string;
      projectId: string;
      name: string;
      dueDate?: Date;
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    await this.requireProject(input.tenantId, input.projectId);

    return this.prisma.milestone.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        name: this.requireText(input.name, "Milestone name is required"),
        dueDate: input.dueDate
      }
    });
  }

  async acceptMilestone(
    actor: AuthzContext,
    input: {
      tenantId: string;
      milestoneId: string;
    }
  ) {
    this.assertProjectWrite(actor, input.tenantId);
    await this.requireMilestone(input.tenantId, input.milestoneId);

    return this.prisma.milestone.update({
      where: { id: input.milestoneId },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date()
      }
    });
  }

  private async requireCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId,
        deletedAt: null
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  private async requireProject(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
        deletedAt: null
      },
      include: this.activeMilestonesInclude()
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  private async requireMilestone(tenantId: string, milestoneId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        tenantId,
        deletedAt: null,
        project: {
          tenantId,
          deletedAt: null
        }
      }
    });

    if (!milestone) {
      throw new NotFoundException("Milestone not found");
    }

    return milestone;
  }

  private activeMilestonesInclude() {
    return {
      milestones: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" as const }, { name: "asc" as const }]
      }
    };
  }

  private assertProjectWrite(actor: AuthzContext, tenantId: string) {
    if (actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant access denied");
    }

    assertPermission(actor, "project.write");
  }

  private normalizeMilestones(milestones: MilestoneInput[]) {
    return milestones.map((milestone) => ({
      name: this.requireText(milestone.name, "Milestone name is required"),
      dueDate: milestone.dueDate
    }));
  }

  private requireText(value: string, message: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }
}
