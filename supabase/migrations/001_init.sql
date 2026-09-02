-- Yuta's Lab :: initial schema, strict RLS (auth.uid() = owner_id) and gamification triggers
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table if not exists public.owner_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  weekly_goal_minutes integer not null default 300,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  title text not null,
  phase_label text,
  description text,
  provider text,
  category text,
  priority text,
  access text,
  target_competency text,
  source_url text,
  sort_order integer not null default 0,
  manually_edited boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table if not exists public.course_units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  roadmap_item_id uuid not null references public.roadmap_items(id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  source_urls text[] not null default '{}',
  sort_order integer not null default 0,
  manually_edited boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_unit_id uuid not null references public.course_units(id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  source_type text,
  source_url text,
  estimated_minutes integer,
  xp_value integer not null default 20,
  sort_order integer not null default 0,
  manually_edited boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table if not exists public.module_progress (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'learning', 'exercise', 'done')),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, module_id)
);

create table if not exists public.exercise_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  activity_title text,
  confidence integer check (confidence between 1 and 5),
  difficulty integer check (difficulty between 1 and 5),
  time_spent_minutes integer check (time_spent_minutes >= 0),
  what_learned text,
  struggles text,
  created_at timestamptz not null default now()
);

create table if not exists public.curriculum_change_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text,
  title text not null,
  description text,
  sort_order integer not null default 0,
  target_date date,
  achieved_at timestamptz,
  manually_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table if not exists public.milestone_roadmap_items (
  owner_id uuid not null references auth.users(id) on delete cascade,
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  roadmap_item_id uuid not null references public.roadmap_items(id) on delete cascade,
  primary key (milestone_id, roadmap_item_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text,
  title text not null,
  description text,
  project_type text,
  status text not null default 'idea'
    check (status in ('idea', 'planned', 'in_progress', 'completed', 'archived')),
  tags text[] not null default '{}',
  github_url text,
  demo_url text,
  cover_image_url text,
  started_at date,
  completed_at date,
  sort_order integer not null default 0,
  manually_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  minutes integer not null check (minutes > 0),
  topic text,
  notes text,
  module_id uuid references public.modules(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  source_type text not null,
  source_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  icon text,
  criteria jsonb not null default '{}'::jsonb,
  xp_reward integer not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table if not exists public.earned_achievements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievement_definitions(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (owner_id, achievement_id)
);

create table if not exists public.weekly_quests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  key text not null,
  title text not null,
  quest_type text,
  target integer not null default 1,
  progress integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, week_start, key)
);

-- indexes
create index if not exists idx_course_units_roadmap on public.course_units(roadmap_item_id);
create index if not exists idx_modules_unit on public.modules(course_unit_id);
create index if not exists idx_module_progress_owner on public.module_progress(owner_id);
create index if not exists idx_xp_events_owner_created on public.xp_events(owner_id, created_at desc);
create index if not exists idx_activity_owner_created on public.activity_events(owner_id, created_at desc);
create index if not exists idx_study_logs_owner_date on public.study_logs(owner_id, logged_on desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['owner_settings','roadmap_items','course_units','modules','module_progress','milestones','projects']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only on EVERY table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'owner_settings','roadmap_items','course_units','modules','module_progress','exercise_reports',
    'curriculum_change_log','milestones','milestone_roadmap_items','projects','study_logs',
    'activity_events','xp_events','achievement_definitions','earned_achievements','weekly_quests']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_select on public.%I', t);
    execute format('drop policy if exists owner_insert on public.%I', t);
    execute format('drop policy if exists owner_update on public.%I', t);
    execute format('drop policy if exists owner_delete on public.%I', t);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New auth user -> owner_settings row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.owner_settings (owner_id, display_name)
  values (new.id, split_part(coalesce(new.email, 'owner'), '@', 1))
  on conflict (owner_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Gamification: module progress -> activity + XP (module / unit / phase bonuses)
-- ---------------------------------------------------------------------------
create or replace function public.on_module_progress_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_module_title text;
  v_xp integer;
  v_unit_id uuid;
  v_unit_title text;
  v_phase_id uuid;
  v_phase_title text;
  v_unit_done boolean;
  v_phase_done boolean;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  select m.title, m.xp_value, m.course_unit_id
    into v_module_title, v_xp, v_unit_id
  from public.modules m where m.id = new.module_id;

  insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
  values (
    new.owner_id,
    case when new.status = 'done' then 'module_completed' else 'module_status_changed' end,
    'module', new.module_id,
    jsonb_build_object('title', v_module_title, 'status', new.status)
  );

  if new.status <> 'done' then
    return new;
  end if;

  -- module XP (awarded once per module, ever)
  if not exists (
    select 1 from public.xp_events x
    where x.owner_id = new.owner_id and x.source_type = 'module' and x.source_id = new.module_id
  ) then
    insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
    values (new.owner_id, coalesce(v_xp, 20), 'module', new.module_id, 'Completed module: ' || coalesce(v_module_title, ''));
  end if;

  -- course unit bonus
  select cu.title, cu.roadmap_item_id into v_unit_title, v_phase_id
  from public.course_units cu where cu.id = v_unit_id;

  select not exists (
    select 1 from public.modules m
    left join public.module_progress mp on mp.module_id = m.id and mp.owner_id = new.owner_id
    where m.course_unit_id = v_unit_id and m.archived_at is null
      and coalesce(mp.status, 'not_started') <> 'done'
  ) into v_unit_done;

  if v_unit_done and not exists (
    select 1 from public.xp_events x
    where x.owner_id = new.owner_id and x.source_type = 'course_unit' and x.source_id = v_unit_id
  ) then
    insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
    values (new.owner_id, 50, 'course_unit', v_unit_id, 'Completed course: ' || coalesce(v_unit_title, ''));
    insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
    values (new.owner_id, 'unit_completed', 'course_unit', v_unit_id, jsonb_build_object('title', v_unit_title));
  end if;

  -- phase bonus
  select r.title into v_phase_title from public.roadmap_items r where r.id = v_phase_id;

  select not exists (
    select 1 from public.modules m
    join public.course_units cu on cu.id = m.course_unit_id
    left join public.module_progress mp on mp.module_id = m.id and mp.owner_id = new.owner_id
    where cu.roadmap_item_id = v_phase_id and m.archived_at is null and cu.archived_at is null
      and coalesce(mp.status, 'not_started') <> 'done'
  ) into v_phase_done;

  if v_phase_done and not exists (
    select 1 from public.xp_events x
    where x.owner_id = new.owner_id and x.source_type = 'roadmap_item' and x.source_id = v_phase_id
  ) then
    insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
    values (new.owner_id, 200, 'roadmap_item', v_phase_id, 'Completed phase: ' || coalesce(v_phase_title, ''));
    insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
    values (new.owner_id, 'phase_completed', 'roadmap_item', v_phase_id, jsonb_build_object('title', v_phase_title));
  end if;

  return new;
end $$;

drop trigger if exists trg_module_progress_change on public.module_progress;
create trigger trg_module_progress_change
  after insert or update on public.module_progress
  for each row execute function public.on_module_progress_change();

-- study log -> XP (1 XP per 10 minutes, max 30 per log) + activity
create or replace function public.on_study_log_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
  values (new.owner_id, least(30, greatest(1, ceil(new.minutes / 10.0)::int)), 'study_log', new.id,
          'Logged ' || new.minutes || ' min' || coalesce(' on ' || new.topic, ''));
  insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
  values (new.owner_id, 'study_logged', 'study_log', new.id,
          jsonb_build_object('minutes', new.minutes, 'topic', new.topic, 'logged_on', new.logged_on));
  return new;
end $$;

drop trigger if exists trg_study_log_insert on public.study_logs;
create trigger trg_study_log_insert
  after insert on public.study_logs
  for each row execute function public.on_study_log_insert();

-- exercise self-report -> 15 XP + activity
create or replace function public.on_exercise_report_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select title into v_title from public.modules where id = new.module_id;
  insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
  values (new.owner_id, 15, 'exercise_report', new.id, 'Exercise report: ' || coalesce(new.activity_title, v_title, ''));
  insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
  values (new.owner_id, 'exercise_reported', 'exercise_report', new.id,
          jsonb_build_object('module_title', v_title, 'activity_title', new.activity_title, 'confidence', new.confidence));
  return new;
end $$;

drop trigger if exists trg_exercise_report_insert on public.exercise_reports;
create trigger trg_exercise_report_insert
  after insert on public.exercise_reports
  for each row execute function public.on_exercise_report_insert();
