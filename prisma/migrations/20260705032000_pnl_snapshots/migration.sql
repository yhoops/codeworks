ALTER TABLE "budgets" ADD COLUMN "project_id" TEXT;

CREATE INDEX "budgets_project_id_idx" ON "budgets"("project_id");

ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "pnl_snapshots" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "revenue" DECIMAL(18,2) NOT NULL,
  "total_cost" DECIMAL(18,2) NOT NULL,
  "gross_profit" DECIMAL(18,2) NOT NULL,
  "gross_margin" DECIMAL(10,4) NOT NULL,
  "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pnl_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pnl_snapshots_tenant_id_project_id_key"
  ON "pnl_snapshots"("tenant_id", "project_id");
CREATE INDEX "pnl_snapshots_tenant_id_idx" ON "pnl_snapshots"("tenant_id");
CREATE INDEX "pnl_snapshots_project_id_idx" ON "pnl_snapshots"("project_id");
CREATE INDEX "pnl_snapshots_refreshed_at_idx" ON "pnl_snapshots"("refreshed_at");

ALTER TABLE "pnl_snapshots"
  ADD CONSTRAINT "pnl_snapshots_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pnl_snapshots"
  ADD CONSTRAINT "pnl_snapshots_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
