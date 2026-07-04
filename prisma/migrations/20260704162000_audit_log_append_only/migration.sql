REVOKE UPDATE, DELETE ON TABLE "audit_logs" FROM codeworks_app;

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$;

DROP TRIGGER IF EXISTS "audit_logs_prevent_update_delete" ON "audit_logs";

CREATE TRIGGER "audit_logs_prevent_update_delete"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();
