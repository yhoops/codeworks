CREATE TABLE "resource_allocations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "task_id" TEXT,
  "week_start" TIMESTAMP(3) NOT NULL,
  "planned_hours" DECIMAL(10,2) NOT NULL,
  "available_hours_override" DECIMAL(10,2),
  "is_overloaded" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resource_allocations_tenant_id_idx" ON "resource_allocations"("tenant_id");
CREATE INDEX "resource_allocations_employee_id_idx" ON "resource_allocations"("employee_id");
CREATE INDEX "resource_allocations_project_id_idx" ON "resource_allocations"("project_id");
CREATE INDEX "resource_allocations_task_id_idx" ON "resource_allocations"("task_id");
CREATE INDEX "resource_allocations_week_start_idx" ON "resource_allocations"("week_start");
CREATE INDEX "resource_allocations_deleted_at_idx" ON "resource_allocations"("deleted_at");

ALTER TABLE "resource_allocations"
  ADD CONSTRAINT "resource_allocations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_allocations"
  ADD CONSTRAINT "resource_allocations_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_allocations"
  ADD CONSTRAINT "resource_allocations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_allocations"
  ADD CONSTRAINT "resource_allocations_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
