CREATE TABLE "sprints" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "sprint_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "estimate_hours" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "board_column" TEXT NOT NULL DEFAULT 'TODO',
  "assignee_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_changes" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "sprint_id" TEXT,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "remaining_estimate_hours" DECIMAL(10,2) NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sprints_tenant_id_idx" ON "sprints"("tenant_id");
CREATE INDEX "sprints_project_id_idx" ON "sprints"("project_id");
CREATE INDEX "sprints_tenant_id_status_idx" ON "sprints"("tenant_id", "status");
CREATE INDEX "sprints_deleted_at_idx" ON "sprints"("deleted_at");

CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_sprint_id_idx" ON "tasks"("sprint_id");
CREATE INDEX "tasks_tenant_id_status_idx" ON "tasks"("tenant_id", "status");
CREATE INDEX "tasks_tenant_id_board_column_idx" ON "tasks"("tenant_id", "board_column");
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");

CREATE INDEX "task_changes_tenant_id_idx" ON "task_changes"("tenant_id");
CREATE INDEX "task_changes_task_id_idx" ON "task_changes"("task_id");
CREATE INDEX "task_changes_sprint_id_idx" ON "task_changes"("sprint_id");
CREATE INDEX "task_changes_changed_at_idx" ON "task_changes"("changed_at");

ALTER TABLE "sprints"
  ADD CONSTRAINT "sprints_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sprints"
  ADD CONSTRAINT "sprints_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_changes"
  ADD CONSTRAINT "task_changes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_changes"
  ADD CONSTRAINT "task_changes_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_changes"
  ADD CONSTRAINT "task_changes_sprint_id_fkey"
  FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
