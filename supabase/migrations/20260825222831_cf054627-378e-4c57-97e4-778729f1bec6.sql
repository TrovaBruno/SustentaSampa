REVOKE EXECUTE ON FUNCTION public.purge_old_flood_reports() FROM authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'purge-old-flood-reports',
  '0 * * * *',
  $$SELECT public.purge_old_flood_reports();$$
);