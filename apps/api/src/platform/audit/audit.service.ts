import { Prisma, type AuditLog } from "@prisma/client";

import { requireTenantContext } from "../tenant/tenant-context.js";

export interface AuditRecordInput {
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface AuditPrismaClient {
  auditLog: {
    create(args: {
      data: {
        tenantId: string;
        actorUserId?: string;
        action: string;
        entityType: string;
        entityId?: string;
        details: Prisma.InputJsonObject;
      };
    }): Promise<AuditLog>;
  };
}

export class AuditService {
  constructor(private readonly prisma: AuditPrismaClient) {}

  async record(input: AuditRecordInput): Promise<AuditLog> {
    const context = requireTenantContext();
    const details: Record<string, Prisma.InputJsonValue> = {};

    if (input.before !== undefined) {
      details.before = input.before as Prisma.InputJsonObject;
    }

    if (input.after !== undefined) {
      details.after = input.after as Prisma.InputJsonObject;
    }

    return this.prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        details: details as Prisma.InputJsonObject
      }
    });
  }
}
