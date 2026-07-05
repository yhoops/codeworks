import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, describe, expect, it } from "vitest";

import { ProjectService } from "../src/modules/projects/project.service.js";
import { SprintService } from "../src/modules/projects/sprint.service.js";
import type { AuthzContext } from "../src/platform/authz/rbac.guard.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";
import {
  AttachmentService,
  LocalDiskStorage,
  type StorageBackend,
  type StoredObject
} from "../src/platform/storage/storage.service.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("AttachmentService", () => {
  const prisma = createSystemPrismaClient();
  const projectService = new ProjectService();
  const sprintService = new SprintService();
  const tempRoots: string[] = [];

  afterAll(async () => {
    await sprintService.onModuleDestroy();
    await projectService.onModuleDestroy();
    await prisma.$disconnect();
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  });

  async function createFixture() {
    const suffix = randomUUID();
    const tenant = await prisma.tenant.create({
      data: {
        name: `Attachment Tenant ${suffix}`,
        slug: `attachment-${suffix}`,
        seatLimit: 5
      }
    });
    const actor: AuthzContext = {
      tenantId: tenant.id,
      userId: randomUUID(),
      roles: ["PM"]
    };
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: `Attachment Customer ${suffix}`
      }
    });
    const project = await projectService.createProject(actor, {
      tenantId: tenant.id,
      customerId: customer.id,
      name: `Attachment Project ${suffix}`
    });
    const sprint = await sprintService.createSprint(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      name: "Attachment Sprint"
    });
    const task = await sprintService.createTask(actor, {
      tenantId: tenant.id,
      projectId: project.id,
      sprintId: sprint.id,
      title: "Attachment task",
      estimateHours: 1
    });

    return { tenant, actor, project, task };
  }

  async function createLocalService() {
    const root = await mkdtemp(join(tmpdir(), "codeworks-attachments-"));
    tempRoots.push(root);
    return new AttachmentService(new LocalDiskStorage(root));
  }

  it("uploads an attachment through local storage and records metadata", async () => {
    const { tenant, actor, project } = await createFixture();
    const service = await createLocalService();

    const attachment = await service.uploadAttachment(actor, {
      tenantId: tenant.id,
      targetType: "PROJECT",
      targetId: project.id,
      fileName: "contract.txt",
      contentType: "text/plain",
      data: Buffer.from("signed contract")
    });
    const downloaded = await service.downloadAttachment(actor, {
      tenantId: tenant.id,
      attachmentId: attachment.id
    });

    expect(attachment).toMatchObject({
      tenantId: tenant.id,
      targetType: "PROJECT",
      targetId: project.id,
      fileName: "contract.txt",
      contentType: "text/plain",
      storageProvider: "local"
    });
    expect(Number(attachment.sizeBytes)).toBe(Buffer.byteLength("signed contract"));
    expect(downloaded.data.toString("utf8")).toBe("signed contract");
    expect(downloaded.attachment.id).toBe(attachment.id);
  });

  it("enforces tenant and read permission when downloading attachments", async () => {
    const { tenant, actor, project } = await createFixture();
    const other = await createFixture();
    const service = await createLocalService();
    const attachment = await service.uploadAttachment(actor, {
      tenantId: tenant.id,
      targetType: "PROJECT",
      targetId: project.id,
      fileName: "scope.txt",
      contentType: "text/plain",
      data: Buffer.from("tenant scoped")
    });

    await expect(
      service.downloadAttachment(other.actor, {
        tenantId: other.tenant.id,
        attachmentId: attachment.id
      })
    ).rejects.toThrow(/attachment|tenant|permission/i);
    await expect(
      service.downloadAttachment({ ...actor, roles: [] }, {
        tenantId: tenant.id,
        attachmentId: attachment.id
      })
    ).rejects.toThrow(/permission/i);
  });

  it("keeps business code stable when switching storage backends and deletes cleanly", async () => {
    const { tenant, actor, task } = await createFixture();
    const storage = new MemoryStorage();
    const service = new AttachmentService(storage);
    const attachment = await service.uploadAttachment(actor, {
      tenantId: tenant.id,
      targetType: "TASK",
      targetId: task.id,
      fileName: "task-note.md",
      contentType: "text/markdown",
      data: Buffer.from("# Task note")
    });

    expect(storage.objects.get(attachment.storageKey)?.toString("utf8")).toBe("# Task note");

    await service.deleteAttachment(actor, {
      tenantId: tenant.id,
      attachmentId: attachment.id
    });

    const deleted = await prisma.attachment.findUniqueOrThrow({
      where: { id: attachment.id }
    });
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(storage.deletedKeys).toContain(attachment.storageKey);
  });
});

class MemoryStorage implements StorageBackend {
  readonly provider = "memory";
  readonly objects = new Map<string, Buffer>();
  readonly deletedKeys: string[] = [];

  async putObject(input: {
    tenantId: string;
    fileName: string;
    data: Buffer;
  }): Promise<StoredObject> {
    const key = `${input.tenantId}/${randomUUID()}-${input.fileName}`;
    this.objects.set(key, input.data);

    return {
      provider: this.provider,
      key,
      sizeBytes: input.data.byteLength
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const data = this.objects.get(key);

    if (!data) {
      throw new Error("Object not found");
    }

    return data;
  }

  async deleteObject(key: string): Promise<void> {
    this.deletedKeys.push(key);
    this.objects.delete(key);
  }
}
