DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'codeworks_app') THEN
    CREATE ROLE codeworks_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO codeworks_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tenants" TO codeworks_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "budgets" TO codeworks_app;

ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budgets_tenant_isolation" ON "budgets";

CREATE POLICY "budgets_tenant_isolation"
ON "budgets"
TO codeworks_app
USING ("tenant_id" = current_setting('app.current_tenant_id', true))
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));
