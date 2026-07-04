GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "audit_logs" TO codeworks_app;

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";

CREATE POLICY "audit_logs_tenant_isolation"
ON "audit_logs"
TO codeworks_app
USING ("tenant_id" = current_setting('app.current_tenant_id', true))
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));
