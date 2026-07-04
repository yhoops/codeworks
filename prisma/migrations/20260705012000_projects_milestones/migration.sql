CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "project_manager_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "milestones" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "due_date" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");
CREATE INDEX "projects_customer_id_idx" ON "projects"("customer_id");
CREATE INDEX "projects_tenant_id_status_idx" ON "projects"("tenant_id", "status");
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

CREATE INDEX "milestones_tenant_id_idx" ON "milestones"("tenant_id");
CREATE INDEX "milestones_project_id_idx" ON "milestones"("project_id");
CREATE INDEX "milestones_tenant_id_status_idx" ON "milestones"("tenant_id", "status");
CREATE INDEX "milestones_deleted_at_idx" ON "milestones"("deleted_at");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
