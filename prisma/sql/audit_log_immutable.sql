CREATE OR REPLACE FUNCTION titlecheck_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION titlecheck_reject_audit_mutation();
