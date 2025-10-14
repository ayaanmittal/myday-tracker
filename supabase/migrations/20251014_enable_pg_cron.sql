-- Enable pg_cron (Supabase installs extensions into the "extensions" schema)
create extension if not exists pg_cron with schema extensions;

-- Optional: allow authenticated role to read cron jobs (not strictly needed)
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    grant usage on schema cron to authenticated;
  end if;
end $$;


