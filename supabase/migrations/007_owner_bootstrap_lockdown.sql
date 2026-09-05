-- Require a service-role marker for the first and only owner account.
-- Existing owners are unaffected because this trigger only runs on auth.users INSERT.

create or replace function public.enforce_single_owner()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $enforce_single_owner$
begin
  if (select pg_catalog.count(*) from auth.users) >= 1 then
    raise exception 'Registration is closed: this lab already has an owner.'
      using errcode = 'check_violation';
  end if;

  if coalesce(new.raw_app_meta_data ->> 'owner_bootstrap', 'false') <> 'true' then
    raise exception 'Registration is closed: owner bootstrap authorization is required.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end
$enforce_single_owner$;

revoke all on function public.enforce_single_owner() from public;
revoke all on function public.enforce_single_owner() from anon;
revoke all on function public.enforce_single_owner() from authenticated;
