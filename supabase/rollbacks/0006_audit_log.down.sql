-- 0006_audit_log.down.sql -- Rollback for the audit_log table + helper.
begin;
drop function if exists app.audit(text, text, text, jsonb, jsonb, text, text, text);
drop policy if exists audit_log_insert on audit_log;
drop policy if exists audit_log_select on audit_log;
drop table if exists audit_log;
commit;
