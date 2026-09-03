-- Security lockdown: enforce single owner at the DB level and re-assert no-anon grants.
-- Idempotent.

-- 1) Hard cap the number of auth users at ONE (prevents rogue sign-up / account-takeover
--    even if the Supabase "allow signups" dashboard toggle is left on). The first insert
--    (count = 0) is allowed; any further insert is rejected.
create or replace function public.enforce_single_owner()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if (select count(*) from auth.users) >= 1 then
    raise exception 'Registration is closed: this lab already has an owner.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_single_owner on auth.users;
create trigger trg_enforce_single_owner
  before insert on auth.users
  for each row execute function public.enforce_single_owner();

-- 2) Defensive: make sure the low-privilege API roles can never touch application tables
--    directly (RLS already restricts rows; this removes table-level reach entirely for anon).
do $$
declare t text;
begin
  foreach t in array array[
    'owner_settings','roadmap_items','course_units','modules','module_progress','exercise_reports',
    'curriculum_change_log','milestones','milestone_roadmap_items','projects','study_logs',
    'activity_events','xp_events','achievement_definitions','earned_achievements','weekly_quests']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke all on public.%I from public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- 3) Keep the internal migration helper table invisible to API roles.
revoke all on public.schema_migrations from anon;
revoke all on public.schema_migrations from authenticated;
