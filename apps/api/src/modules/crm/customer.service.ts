/**
 * customer.service.ts 领域服务。
 * 封装单一业务能力的数据库读写与校验，避免控制器和其他模块重复组织查询。
 * 依赖：Prisma 客户端与领域类型；被用于：控制器、种子或测试。
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { createSystemPrismaClient } from "../../platform/database/prisma.client.js";

type ContactInput = {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
};

type CustomerMutationInput = {
  tenantId: string;
  name?: string;
  status?: string;
  notes?: string;
  contacts?: ContactInput[];
};

@Injectable()
export class CustomerService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async createCustomer(input: CustomerMutationInput & { name: string }) {
    const contacts = this.normalizeContacts(input.contacts ?? []);

    return this.prisma.customer.create({
      data: {
        tenantId: input.tenantId,
        name: this.requireText(input.name, "Customer name is required"),
        status: input.status ?? "ACTIVE",
        notes: this.optionalText(input.notes),
        contacts: {
          create: contacts.map((contact) => ({
            ...contact,
            tenantId: input.tenantId
          }))
        }
      },
      include: this.activeContactsInclude()
    });
  }

  async getCustomer(input: { tenantId: string; customerId: string }) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: input.customerId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      include: this.activeContactsInclude()
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  async listCustomers(input: {
    tenantId: string;
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = this.normalizePositiveInteger(input.page, 1);
    const pageSize = Math.min(
      this.normalizePositiveInteger(input.pageSize, 20),
      100
    );
    const search = input.search?.trim();
    const where = {
      tenantId: input.tenantId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              {
                contacts: {
                  some: {
                    deletedAt: null,
                    OR: [
                      {
                        name: {
                          contains: search,
                          mode: "insensitive" as const
                        }
                      },
                      {
                        email: {
                          contains: search,
                          mode: "insensitive" as const
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        : {})
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: this.activeContactsInclude(),
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return { items, total, page, pageSize };
  }

  async updateCustomer(
    input: CustomerMutationInput & { customerId: string }
  ) {
    await this.requireCustomer(input.tenantId, input.customerId);
    const contacts = input.contacts
      ? this.normalizeContacts(input.contacts)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: input.customerId },
        data: {
          ...(input.name !== undefined
            ? {
                name: this.requireText(
                  input.name,
                  "Customer name is required"
                )
              }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notes !== undefined
            ? { notes: this.optionalText(input.notes) }
            : {})
        }
      });

      if (contacts) {
        const deletedAt = new Date();
        await tx.contact.updateMany({
          where: {
            tenantId: input.tenantId,
            customerId: input.customerId,
            deletedAt: null
          },
          data: { deletedAt }
        });

        if (contacts.length > 0) {
          await tx.contact.createMany({
            data: contacts.map((contact) => ({
              ...contact,
              tenantId: input.tenantId,
              customerId: input.customerId
            }))
          });
        }
      }

      const customer = await tx.customer.findFirst({
        where: {
          id: input.customerId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        include: this.activeContactsInclude()
      });

      if (!customer) {
        throw new NotFoundException("Customer not found");
      }

      return customer;
    });
  }

  async deleteCustomer(input: { tenantId: string; customerId: string }) {
    await this.requireCustomer(input.tenantId, input.customerId);
    const deletedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.contact.updateMany({
        where: {
          tenantId: input.tenantId,
          customerId: input.customerId,
          deletedAt: null
        },
        data: { deletedAt }
      });

      return tx.customer.update({
        where: { id: input.customerId },
        data: { deletedAt }
      });
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

  private activeContactsInclude() {
    return {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" as const }, { name: "asc" as const }]
      }
    };
  }

  private normalizeContacts(contacts: ContactInput[]) {
    return contacts.map((contact) => ({
      name: this.requireText(contact.name, "Contact name is required"),
      email: this.optionalText(contact.email),
      phone: this.optionalText(contact.phone),
      title: this.optionalText(contact.title)
    }));
  }

  private normalizePositiveInteger(
    value: number | undefined,
    fallback: number
  ) {
    if (value === undefined) {
      return fallback;
    }

    return Number.isInteger(value) && value > 0 ? value : fallback;
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
