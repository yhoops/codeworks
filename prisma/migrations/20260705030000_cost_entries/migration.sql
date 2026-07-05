CREATE TABLE "cost_entries" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "task_id" TEXT,
  "employee_id" TEXT,
  "time_entry_id" TEXT,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "quantity_hours" DECIMAL(10,2),
  "unit_cost_rate" DECIMAL(10,2),
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cost_entries_tenant_id_time_entry_id_type_key"
  ON "cost_entries"("tenant_id", "time_entry_id", "type");
CREATE INDEX "cost_entries_tenant_id_idx" ON "cost_entries"("tenant_id");
CREATE INDEX "cost_entries_project_id_idx" ON "cost_entries"("project_id");
CREATE INDEX "cost_entries_task_id_idx" ON "cost_entries"("task_id");
CREATE INDEX "cost_entries_employee_id_idx" ON "cost_entries"("employee_id");
CREATE INDEX "cost_entries_time_entry_id_idx" ON "cost_entries"("time_entry_id");
CREATE INDEX "cost_entries_type_idx" ON "cost_entries"("type");
CREATE INDEX "cost_entries_deleted_at_idx" ON "cost_entries"("deleted_at");

ALTER TABLE "cost_entries"
  ADD CONSTRAINT "cost_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cost_entries"
  ADD CONSTRAINT "cost_entries_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cost_entries"
  ADD CONSTRAINT "cost_entries_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cost_entries"
  ADD CONSTRAINT "cost_entries_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cost_entries"
  ADD CONSTRAINT "cost_entries_time_entry_id_fkey"
  FOREIGN KEY ("time_entry_id") REFERENCES "time_entries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
