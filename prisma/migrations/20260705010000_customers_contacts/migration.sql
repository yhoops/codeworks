CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "title" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");
CREATE INDEX "customers_tenant_id_status_idx" ON "customers"("tenant_id", "status");
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

CREATE INDEX "contacts_tenant_id_idx" ON "contacts"("tenant_id");
CREATE INDEX "contacts_customer_id_idx" ON "contacts"("customer_id");
CREATE INDEX "contacts_deleted_at_idx" ON "contacts"("deleted_at");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
