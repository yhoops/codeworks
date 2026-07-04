import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { CustomerService } from "../src/modules/crm/customer.service.js";
import { createSystemPrismaClient } from "../src/platform/database/prisma.client.js";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("CustomerService", () => {
  const prisma = createSystemPrismaClient();
  const service = new CustomerService();

  afterAll(async () => {
    await service.onModuleDestroy();
    await prisma.$disconnect();
  });

  async function createTenant(prefix = "customer") {
    const suffix = randomUUID();
    return prisma.tenant.create({
      data: {
        name: `${prefix} tenant ${suffix}`,
        slug: `${prefix}-${suffix}`,
        seatLimit: 5
      }
    });
  }

  it("creates a tenant-scoped customer with one-to-many contacts", async () => {
    const tenant = await createTenant();

    const customer = await service.createCustomer({
      tenantId: tenant.id,
      name: "Acme Consulting",
      status: "ACTIVE",
      notes: "Strategic account",
      contacts: [
        {
          name: "Ada Lovelace",
          email: "ada@example.test",
          phone: "13800000000",
          title: "CTO"
        },
        {
          name: "Grace Hopper",
          email: "grace@example.test"
        }
      ]
    });

    expect(customer).toMatchObject({
      tenantId: tenant.id,
      name: "Acme Consulting",
      contacts: [
        expect.objectContaining({
          tenantId: tenant.id,
          name: "Ada Lovelace",
          customerId: customer.id
        }),
        expect.objectContaining({
          tenantId: tenant.id,
          name: "Grace Hopper",
          customerId: customer.id
        })
      ]
    });
  });

  it("lists only one tenant's customers with keyword filtering and pagination", async () => {
    const tenantA = await createTenant("customer-a");
    const tenantB = await createTenant("customer-b");

    await service.createCustomer({
      tenantId: tenantA.id,
      name: "Acme Alpha",
      contacts: [{ name: "Alice Buyer", email: "alice@example.test" }]
    });
    await service.createCustomer({
      tenantId: tenantA.id,
      name: "Acme Beta",
      contacts: [{ name: "Bob Buyer", email: "bob@example.test" }]
    });
    await service.createCustomer({
      tenantId: tenantA.id,
      name: "Zenith",
      contacts: [{ name: "Zoe Buyer", email: "zoe@example.test" }]
    });
    await service.createCustomer({
      tenantId: tenantB.id,
      name: "Acme Foreign",
      contacts: [{ name: "Mallory Buyer", email: "mallory@example.test" }]
    });

    const result = await service.listCustomers({
      tenantId: tenantA.id,
      search: "acme",
      page: 2,
      pageSize: 1
    });

    expect(result).toMatchObject({
      total: 2,
      page: 2,
      pageSize: 1
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      tenantId: tenantA.id,
      name: "Acme Beta"
    });
  });

  it("updates customer fields and replaces contacts inside the same tenant", async () => {
    const tenant = await createTenant("customer-update");
    const customer = await service.createCustomer({
      tenantId: tenant.id,
      name: "Before Update",
      notes: "Before notes",
      contacts: [{ name: "Old Contact", email: "old@example.test" }]
    });

    const updated = await service.updateCustomer({
      tenantId: tenant.id,
      customerId: customer.id,
      name: "After Update",
      status: "INACTIVE",
      notes: "After notes",
      contacts: [{ name: "New Contact", email: "new@example.test" }]
    });

    expect(updated).toMatchObject({
      tenantId: tenant.id,
      id: customer.id,
      name: "After Update",
      status: "INACTIVE",
      notes: "After notes",
      contacts: [
        expect.objectContaining({
          tenantId: tenant.id,
          name: "New Contact",
          customerId: customer.id
        })
      ]
    });
    await expect(
      prisma.contact.findMany({
        where: {
          tenantId: tenant.id,
          customerId: customer.id,
          name: "Old Contact",
          deletedAt: null
        }
      })
    ).resolves.toHaveLength(0);
  });

  it("soft deletes a customer and hides its contacts from customer lists", async () => {
    const tenant = await createTenant("customer-delete");
    const customer = await service.createCustomer({
      tenantId: tenant.id,
      name: "Delete Me",
      contacts: [{ name: "Deleted Contact", email: "deleted@example.test" }]
    });

    await service.deleteCustomer({
      tenantId: tenant.id,
      customerId: customer.id
    });

    await expect(
      service.listCustomers({ tenantId: tenant.id, search: "delete" })
    ).resolves.toMatchObject({
      total: 0,
      items: []
    });
    await expect(
      prisma.contact.findMany({
        where: { tenantId: tenant.id, customerId: customer.id, deletedAt: null }
      })
    ).resolves.toHaveLength(0);
  });
});
