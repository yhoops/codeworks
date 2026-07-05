CREATE TABLE "time_entries" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "hours" DECIMAL(10,2) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'AUTO',
  "note" TEXT,
  "corrected_by_user_id" TEXT,
  "corrected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "time_entries_tenant_id_task_id_employee_id_key"
  ON "time_entries"("tenant_id", "task_id", "employee_id");
CREATE INDEX "time_entries_tenant_id_idx" ON "time_entries"("tenant_id");
CREATE INDEX "time_entries_task_id_idx" ON "time_entries"("task_id");
CREATE INDEX "time_entries_employee_id_idx" ON "time_entries"("employee_id");
CREATE INDEX "time_entries_source_idx" ON "time_entries"("source");
CREATE INDEX "time_entries_deleted_at_idx" ON "time_entries"("deleted_at");

ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
