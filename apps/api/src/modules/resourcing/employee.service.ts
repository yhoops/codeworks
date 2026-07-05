/**
 * employee.service.ts 领域服务。
 * 封装单一业务能力的数据库读写与校验，避免控制器和其他模块重复组织查询。
 * 依赖：Prisma 客户端与领域类型；被用于：控制器、种子或测试。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

import {
  canPerform,
  type AuthzContext
} from "../../platform/authz/rbac.guard.js";
import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";

type SkillInput = {
  name: string;
  level?: string;
};

type CapacityInput = {
  weeklyHours: number;
  effectiveFrom?: Date;
  effectiveTo?: Date;
};

@Injectable()
export class EmployeeService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async createEmployee(
    actor: AuthzContext,
    input: {
      tenantId: string;
      name: string;
      email?: string;
      costRate: number;
      currency?: string;
      skills?: SkillInput[];
      capacity?: CapacityInput;
    }
  ) {
    this.assertTenant(actor, input.tenantId);
    const skills = this.normalizeSkills(input.skills ?? []);

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          tenantId: input.tenantId,
          name: this.requireText(input.name, "Employee name is required"),
          email: this.optionalText(input.email),
          costRate: this.requireMoney(input.costRate, "Employee cost rate"),
          currency: input.currency ?? "CNY"
        }
      });

      for (const skillInput of skills) {
        const skill = await tx.skill.upsert({
          where: {
            tenantId_name: {
              tenantId: input.tenantId,
              name: skillInput.name
            }
          },
          create: {
            tenantId: input.tenantId,
            name: skillInput.name
          },
          update: {}
        });
        await tx.employeeSkill.create({
          data: {
            tenantId: input.tenantId,
            employeeId: employee.id,
            skillId: skill.id,
            level: skillInput.level ?? "MID"
          }
        });
      }

      if (input.capacity) {
        await tx.capacity.create({
          data: {
            tenantId: input.tenantId,
            employeeId: employee.id,
            weeklyHours: this.requireMoney(
              input.capacity.weeklyHours,
              "Capacity weekly hours"
            ),
            effectiveFrom: input.capacity.effectiveFrom,
            effectiveTo: input.capacity.effectiveTo
          }
        });
      }

      return tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: this.employeeInclude()
      });
    });
  }

  async findAvailableBySkill(
    actor: AuthzContext,
    input: {
      tenantId: string;
      skillName: string;
    }
  ) {
    this.assertTenant(actor, input.tenantId);
    const skillName = this.requireText(input.skillName, "Skill name is required");
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        skills: {
          some: {
            skill: {
              tenantId: input.tenantId,
              name: { equals: skillName, mode: "insensitive" },
              deletedAt: null
            }
          }
        }
      },
      include: this.employeeInclude(),
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    });

    return employees.map((employee) => this.toAvailableEmployee(actor, employee));
  }

  private employeeInclude() {
    return {
      skills: {
        include: { skill: true },
        orderBy: [{ createdAt: "asc" as const }]
      },
      capacities: {
        where: { deletedAt: null },
        orderBy: [{ effectiveFrom: "desc" as const }, { createdAt: "desc" as const }]
      }
    };
  }

  private toAvailableEmployee(
    actor: AuthzContext,
    employee: Awaited<ReturnType<PrismaClient["employee"]["findMany"]>>[number] & {
      skills: Array<{ level: string; skill: { name: string } }>;
      capacities: Array<{ weeklyHours: Prisma.Decimal }>;
    }
  ) {
    const capacity = employee.capacities[0];
    const canReadCost = canPerform(actor, "financial.read");

    return {
      id: employee.id,
      tenantId: employee.tenantId,
      name: employee.name,
      email: employee.email,
      costRate: canReadCost ? employee.costRate.toString() : null,
      currency: canReadCost ? employee.currency : null,
      capacityWeeklyHours: capacity ? Number(capacity.weeklyHours) : 0,
      skills: employee.skills.map((employeeSkill) => ({
        name: employeeSkill.skill.name,
        level: employeeSkill.level
      }))
    };
  }

  private normalizeSkills(skills: SkillInput[]) {
    const seen = new Set<string>();

    return skills.map((skill) => {
      const name = this.requireText(skill.name, "Skill name is required");
      const key = name.toLocaleLowerCase();

      if (seen.has(key)) {
        throw new BadRequestException("Duplicate skill on employee");
      }

      seen.add(key);
      return {
        name,
        level: skill.level?.trim() || "MID"
      };
    });
  }

  private assertTenant(actor: AuthzContext, tenantId: string) {
    if (actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant access denied");
    }
  }

  private requireMoney(value: number, label: string) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${label} must be a non-negative number`);
    }

    return new Prisma.Decimal(value.toFixed(2));
  }

  private requireText(value: string, message: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private optionalText(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
