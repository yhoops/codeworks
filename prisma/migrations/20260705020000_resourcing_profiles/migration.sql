CREATE TABLE "employees" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "cost_rate" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skills" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_skills" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "skill_id" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'MID',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capacities" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "weekly_hours" DECIMAL(10,2) NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "capacities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employees_tenant_id_email_key" ON "employees"("tenant_id", "email");
CREATE INDEX "employees_tenant_id_idx" ON "employees"("tenant_id");
CREATE INDEX "employees_deleted_at_idx" ON "employees"("deleted_at");

CREATE UNIQUE INDEX "skills_tenant_id_name_key" ON "skills"("tenant_id", "name");
CREATE INDEX "skills_tenant_id_idx" ON "skills"("tenant_id");
CREATE INDEX "skills_deleted_at_idx" ON "skills"("deleted_at");

CREATE UNIQUE INDEX "employee_skills_tenant_id_employee_id_skill_id_key"
  ON "employee_skills"("tenant_id", "employee_id", "skill_id");
CREATE INDEX "employee_skills_tenant_id_idx" ON "employee_skills"("tenant_id");
CREATE INDEX "employee_skills_employee_id_idx" ON "employee_skills"("employee_id");
CREATE INDEX "employee_skills_skill_id_idx" ON "employee_skills"("skill_id");

CREATE INDEX "capacities_tenant_id_idx" ON "capacities"("tenant_id");
CREATE INDEX "capacities_employee_id_idx" ON "capacities"("employee_id");
CREATE INDEX "capacities_effective_from_idx" ON "capacities"("effective_from");
CREATE INDEX "capacities_deleted_at_idx" ON "capacities"("deleted_at");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "skills"
  ADD CONSTRAINT "skills_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_skills"
  ADD CONSTRAINT "employee_skills_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_skills"
  ADD CONSTRAINT "employee_skills_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_skills"
  ADD CONSTRAINT "employee_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "skills"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "capacities"
  ADD CONSTRAINT "capacities_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "capacities"
  ADD CONSTRAINT "capacities_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
