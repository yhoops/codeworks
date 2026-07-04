CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_tenant_id_name_key" ON "departments"("tenant_id", "name");
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");
CREATE INDEX "departments_deleted_at_idx" ON "departments"("deleted_at");

ALTER TABLE "departments"
ADD CONSTRAINT "departments_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "departments"
ADD CONSTRAINT "departments_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "departments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "memberships"
ADD COLUMN "department_id" TEXT;

CREATE INDEX "memberships_department_id_idx" ON "memberships"("department_id");

ALTER TABLE "memberships"
ADD CONSTRAINT "memberships_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
