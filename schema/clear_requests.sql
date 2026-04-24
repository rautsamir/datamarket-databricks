-- Clear access-request workflow data only (demo reset).
-- Does NOT touch: data_products, users, user_library, or product-related audit rows.
--
-- Run against your Lakebase DB after setting search_path to your portal schema, e.g.:
--   PGPASSWORD="$LAKEBASE_TOKEN" psql -h "$LAKEBASE_HOST" -p 5432 -U "$DATABRICKS_USER" \
--     -d "$LAKEBASE_DB" --set=sslmode=require \
--     -c "SET search_path TO datamarket, public;" -f schema/clear_requests.sql
--
-- Or from psql:  SET search_path TO datamarket, public;

BEGIN;

DELETE FROM audit_log
WHERE event_type IN (
  'REQUEST_SUBMITTED',
  'REQUEST_APPROVED',
  'REQUEST_DENIED',
  'ACCESS_REVOKED',
  'NUDGE_SENT'
);

DELETE FROM access_requests;

COMMIT;
