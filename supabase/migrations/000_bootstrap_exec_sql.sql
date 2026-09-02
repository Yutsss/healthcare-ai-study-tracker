-- OPTIONAL bootstrap (run ONCE in Supabase Dashboard -> SQL Editor).
-- It lets the workspace apply the remaining migrations automatically with the
-- server-only secret key via:  node scripts/apply-migrations.mjs
-- The helper is callable ONLY by the service_role (secret key) or the postgres role.

create table if not exists public.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security; -- no policies => invisible to anon/authenticated

create or replace function public.exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), current_user) not in ('service_role', 'postgres') then
    raise exception 'forbidden';
  end if;
  execute sql;
end;
$$;

revoke all on function public.exec_sql(text) from public;
revoke all on function public.exec_sql(text) from anon;
revoke all on function public.exec_sql(text) from authenticated;
grant execute on function public.exec_sql(text) to service_role;
