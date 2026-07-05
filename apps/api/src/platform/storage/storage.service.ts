import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import {
  assertPermission,
  type AuthzContext
} from "../authz/rbac.guard.js";
import { createSystemPrismaClient } from "../database/prisma.client.js";

export type AttachmentTargetType = "PROJECT" | "TASK";

export interface StoredObject {
  provider: string;
  key: string;
  sizeBytes: number;
}

export interface StorageBackend {
  readonly provider: string;
  putObject(input: {
    tenantId: string;
    fileName: string;
    contentType: string;
    data: Buffer;
  }): Promise<StoredObject>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}

export class LocalDiskStorage implements StorageBackend {
  readonly provider = "local";
  private readonly root: string;

  constructor(root = join(process.cwd(), ".data", "attachments")) {
    this.root = resolve(root);
  }

  async putObject(input: {
    tenantId: string;
    fileName: string;
    data: Buffer;
  }): Promise<StoredObject> {
    const safeName = basename(input.fileName).replace(/[^\w.-]+/g, "_");
    const key = `${input.tenantId}/${randomUUID()}-${safeName || "attachment"}`;
    const path = this.resolveKey(key);

    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, input.data);

    return {
      provider: this.provider,
      key,
      sizeBytes: input.data.byteLength
    };
  }

  async getObject(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  private resolveKey(key: string) {
    const path = resolve(this.root, key);

    if (!path.startsWith(`${this.root}\\`) && path !== this.root) {
      throw new BadRequestException("Invalid storage key");
    }

    return path;
  }
}

@Injectable()
export class AttachmentService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient();

  constructor(private readonly storage: StorageBackend = new LocalDiskStorage()) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async uploadAttachment(
    actor: AuthzContext,
    input: {
      tenantId: string;
      targetType: AttachmentTargetType;
      targetId: string;
      fileName: string;
      contentType: string;
      data: Buffer;
    }
  ) {
    this.assertTenant(actor, input.tenantId);
    assertPermission(actor, "project.write");
    await this.requireTarget(input.tenantId, input.targetType, input.targetId);

    if (input.data.byteLength === 0) {
      throw new BadRequestException("Attachment file is empty");
    }

    const fileName = this.requireText(input.fileName, "Attachment file name is required");
    const contentType = this.requireText(
      input.contentType,
      "Attachment content type is required"
    );
    const stored = await this.storage.putObject({
      tenantId: input.tenantId,
      fileName,
      contentType,
      data: input.data
    });

    return this.prisma.attachment.create({
      data: {
        tenantId: input.tenantId,
        targetType: input.targetType,
        targetId: input.targetId,
        fileName,
        contentType,
        sizeBytes: stored.sizeBytes,
        storageProvider: stored.provider,
        storageKey: stored.key,
        checksumSha256: createHash("sha256").update(input.data).digest("hex"),
        createdByUserId: actor.userId
      }
    });
  }

  async downloadAttachment(
    actor: AuthzContext,
    input: { tenantId: string; attachmentId: string }
  ) {
    this.assertTenant(actor, input.tenantId);
    assertPermission(actor, "project.read");
    const attachment = await this.requireAttachment(input.tenantId, input.attachmentId);
    await this.requireTarget(attachment.tenantId, attachment.targetType, attachment.targetId);
    const data = await this.storage.getObject(attachment.storageKey);

    return { attachment, data };
  }

  async deleteAttachment(
    actor: AuthzContext,
    input: { tenantId: string; attachmentId: string }
  ) {
    this.assertTenant(actor, input.tenantId);
    assertPermission(actor, "project.write");
    const attachment = await this.requireAttachment(input.tenantId, input.attachmentId);

    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: { deletedAt: new Date() }
    });
    await this.storage.deleteObject(attachment.storageKey).catch(() => undefined);
  }

  private async requireAttachment(tenantId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        deletedAt: null
      }
    });

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    return attachment;
  }

  private async requireTarget(
    tenantId: string,
    targetType: string,
    targetId: string
  ) {
    if (targetType === "PROJECT") {
      const project = await this.prisma.project.findFirst({
        where: { id: targetId, tenantId, deletedAt: null },
        select: { id: true }
      });

      if (!project) {
        throw new NotFoundException("Attachment target project not found");
      }

      return;
    }

    if (targetType === "TASK") {
      const task = await this.prisma.backlogTask.findFirst({
        where: { id: targetId, tenantId, deletedAt: null },
        select: { id: true }
      });

      if (!task) {
        throw new NotFoundException("Attachment target task not found");
      }

      return;
    }

    throw new BadRequestException("Unsupported attachment target type");
  }

  private assertTenant(actor: AuthzContext, tenantId: string) {
    if (actor.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant access denied");
    }
  }

  private requireText(value: string, message: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }
}
