-- V1 completion: Focus/Pomodoro settings, focus-session dedupe, weekly quests XP, projects XP.
-- Idempotent.

-- 1) Pomodoro settings live with the owner
alter table public.owner_settings
  add column if not exists focus_minutes integer not null default 25,
  add column if not exists short_break_minutes integer not null default 5,
  add column if not exists long_break_minutes integer not null default 15,
  add column if not exists long_break_every integer not null default 4;

alter table public.owner_settings drop constraint if exists owner_settings_pomodoro_bounds;
alter table public.owner_settings add constraint owner_settings_pomodoro_bounds check (
  focus_minutes between 1 and 180 and short_break_minutes between 1 and 60
  and long_break_minutes between 1 and 120 and long_break_every between 1 and 12
);

-- 2) Study logs: source + focus session id. One log per focus session, enforced by the DB.
alter table public.study_logs
  add column if not exists source text not null default 'manual',
  add column if not exists session_id uuid,
  add column if not exists focus_intervals integer not null default 0;

create unique index if not exists uq_study_logs_owner_session
  on public.study_logs(owner_id, session_id) where session_id is not null;

-- 3) Weekly quests: reward + description; XP awarded exactly once on completion.
alter table public.weekly_quests
  add column if not exists xp_reward integer not null default 50,
  add column if not exists description text;

create or replace function public.on_weekly_quest_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    if not exists (
      select 1 from public.xp_events where owner_id = new.owner_id and source_type = 'weekly_quest' and source_id = new.id
    ) then
      insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
      values (new.owner_id, coalesce(new.xp_reward, 0), 'weekly_quest', new.id, 'Weekly quest complete: ' || new.title);
      insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
      values (new.owner_id, 'quest_completed', 'weekly_quest', new.id, jsonb_build_object('title', new.title, 'xp', new.xp_reward));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_weekly_quest_completed on public.weekly_quests;
create trigger trg_weekly_quest_completed
  after insert or update on public.weekly_quests
  for each row execute function public.on_weekly_quest_completed();

-- 4) Projects: activity + XP (once) when a project is completed.
create or replace function public.on_project_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    if not exists (
      select 1 from public.xp_events where owner_id = new.owner_id and source_type = 'project' and source_id = new.id
    ) then
      insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
      values (new.owner_id, 150, 'project', new.id, 'Completed project: ' || new.title);
    end if;
    insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
    values (new.owner_id, 'project_completed', 'project', new.id, jsonb_build_object('title', new.title));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
    values (new.owner_id, 'project_status_changed', 'project', new.id, jsonb_build_object('title', new.title, 'status', new.status));
  elsif tg_op = 'INSERT' then
    insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
    values (new.owner_id, 'project_created', 'project', new.id, jsonb_build_object('title', new.title));
  end if;
  return new;
end $$;

drop trigger if exists trg_project_change on public.projects;
create trigger trg_project_change
  after insert or update on public.projects
  for each row execute function public.on_project_change();

-- 5) Curriculum change log indexes
create index if not exists idx_change_log_owner_created on public.curriculum_change_log(owner_id, created_at desc);
create index if not exists idx_weekly_quests_owner_week on public.weekly_quests(owner_id, week_start);
