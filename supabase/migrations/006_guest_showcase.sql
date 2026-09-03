-- Opt-in, read-only public showcase projection.
-- Idempotent: safe to re-run. Publication remains disabled by default.

alter table public.owner_settings
  add column if not exists showcase_enabled boolean not null default false,
  add column if not exists showcase_bio text;

alter table public.projects
  add column if not exists is_public boolean not null default false;

create or replace function public.get_public_showcase()
returns jsonb
language sql
stable
security definer
set search_path = public
as $get_public_showcase$
  with owner as (
    select
      os.owner_id,
      coalesce(os.display_name, ''::text) as display_name,
      os.showcase_bio
    from public.owner_settings as os
    where os.showcase_enabled = true
  ),
  active_phases as (
    select
      ri.id as phase_id,
      ri.owner_id,
      ri.key as phase_key,
      ri.title as phase_title,
      ri.sort_order
    from public.roadmap_items as ri
    join owner on owner.owner_id = ri.owner_id
    where ri.archived_at is null
  ),
  active_courses as (
    select
      cu.id as course_id,
      cu.owner_id,
      cu.roadmap_item_id as phase_id
    from public.course_units as cu
    join active_phases as ap
      on ap.owner_id = cu.owner_id
     and ap.phase_id = cu.roadmap_item_id
    join owner on owner.owner_id = cu.owner_id
    where cu.archived_at is null
  ),
  module_completion as (
    select
      m.id as module_id,
      m.owner_id,
      m.course_unit_id as course_id,
      ac.phase_id,
      (mp.status = 'done') as is_completed
    from public.modules as m
    join active_courses as ac
      on ac.owner_id = m.owner_id
     and ac.course_id = m.course_unit_id
    join owner on owner.owner_id = m.owner_id
    left join public.module_progress as mp
      on mp.owner_id = owner.owner_id
     and mp.module_id = m.id
    where m.archived_at is null
  ),
  course_rollups as (
    select
      ac.course_id,
      ac.owner_id,
      ac.phase_id,
      pg_catalog.count(mc.module_id)::integer as total,
      pg_catalog.count(mc.module_id) filter (where mc.is_completed)::integer as completed
    from active_courses as ac
    left join module_completion as mc
      on mc.owner_id = ac.owner_id
     and mc.course_id = ac.course_id
    group by ac.course_id, ac.owner_id, ac.phase_id
  ),
  phase_rollups as (
    select
      ap.phase_id,
      ap.owner_id,
      ap.phase_key,
      ap.phase_title,
      ap.sort_order,
      pg_catalog.count(mc.module_id)::integer as total,
      pg_catalog.count(mc.module_id) filter (where mc.is_completed)::integer as completed
    from active_phases as ap
    left join module_completion as mc
      on mc.owner_id = ap.owner_id
     and mc.phase_id = ap.phase_id
    group by
      ap.phase_id,
      ap.owner_id,
      ap.phase_key,
      ap.phase_title,
      ap.sort_order
  ),
  public_stats as (
    select
      coalesce((
        select pg_catalog.sum(xe.amount)
        from public.xp_events as xe
        where xe.owner_id = owner.owner_id
      ), 0::bigint) as xp,
      (
        select pg_catalog.count(*)::integer
        from phase_rollups as pr
        where pr.total > 0 and pr.completed = pr.total
      ) as completed_phases,
      (
        select pg_catalog.count(*)::integer
        from phase_rollups as pr
      ) as total_phases,
      (
        select pg_catalog.count(*)::integer
        from course_rollups as cr
        where cr.total > 0 and cr.completed = cr.total
      ) as completed_courses,
      (
        select pg_catalog.count(*)::integer
        from course_rollups as cr
      ) as total_courses,
      (
        select pg_catalog.count(*)::integer
        from module_completion as mc
        where mc.is_completed
      ) as completed_modules,
      (
        select pg_catalog.count(*)::integer
        from module_completion as mc
      ) as total_modules
    from owner
  ),
  public_phases as (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'key', pr.phase_key,
          'title', pr.phase_title,
          'completed', pr.completed,
          'total', pr.total
        ) order by pr.sort_order, pr.phase_key
      ),
      '[]'::jsonb
    ) as payload
    from phase_rollups as pr
  ),
  public_achievements as (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'key', ad.key,
          'title', ad.title,
          'description', ad.description,
          'icon', ad.icon,
          'earned_at', ea.earned_at
        ) order by ea.earned_at desc, ad.key
      ),
      '[]'::jsonb
    ) as payload
    from public.earned_achievements as ea
    join owner on owner.owner_id = ea.owner_id
    join public.achievement_definitions as ad
      on ad.owner_id = owner.owner_id
     and ad.id = ea.achievement_id
  ),
  public_projects as (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'title', p.title,
          'description', p.description,
          'project_type', p.project_type,
          'status', p.status,
          'tags', p.tags,
          'github_url', p.github_url,
          'demo_url', p.demo_url,
          'cover_image_url', p.cover_image_url,
          'started_at', p.started_at,
          'completed_at', p.completed_at
        ) order by p.sort_order, p.created_at, p.id
      ),
      '[]'::jsonb
    ) as payload
    from public.projects as p
    join owner on owner.owner_id = p.owner_id
    where p.owner_id = owner.owner_id
      and p.is_public = true
      and p.status <> 'archived'
  )
  select pg_catalog.jsonb_build_object(
    'profile', pg_catalog.jsonb_build_object(
      'display_name', owner.display_name,
      'bio', owner.showcase_bio
    ),
    'stats', pg_catalog.jsonb_build_object(
      'xp', ps.xp,
      'phases', pg_catalog.jsonb_build_object(
        'completed', ps.completed_phases,
        'total', ps.total_phases
      ),
      'courses', pg_catalog.jsonb_build_object(
        'completed', ps.completed_courses,
        'total', ps.total_courses
      ),
      'modules', pg_catalog.jsonb_build_object(
        'completed', ps.completed_modules,
        'total', ps.total_modules
      )
    ),
    'phases', pp.payload,
    'achievements', pa.payload,
    'projects', pj.payload,
    'generated_at', pg_catalog.now()
  )
  from owner
  join public_stats as ps on true
  join public_phases as pp on true
  join public_achievements as pa on true
  join public_projects as pj on true;
$get_public_showcase$;

comment on column public.owner_settings.showcase_enabled is
  'Owner opt-in for the read-only public showcase.';
comment on column public.owner_settings.showcase_bio is
  'Biography deliberately published through get_public_showcase().';
comment on column public.projects.is_public is
  'Per-project opt-in for the read-only public showcase.';
comment on function public.get_public_showcase() is
  'Returns the fixed public showcase projection, or SQL NULL when publishing is disabled.';

-- Re-assert the existing direct-table boundary without changing owner RLS policies.
do $revoke_anon_application_tables$
declare
  t text;
begin
  foreach t in array array[
    'owner_settings', 'roadmap_items', 'course_units', 'modules',
    'module_progress', 'exercise_reports', 'curriculum_change_log',
    'milestones', 'milestone_roadmap_items', 'projects', 'study_logs',
    'activity_events', 'xp_events', 'achievement_definitions',
    'earned_achievements', 'weekly_quests'
  ]
  loop
    execute pg_catalog.format('revoke all on table public.%I from anon', t);
    execute pg_catalog.format('revoke all on table public.%I from public', t);
  end loop;
end
$revoke_anon_application_tables$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default. Remove all inherited or
-- stale grants before exposing only this read-only projection to API roles.
revoke all on function public.get_public_showcase() from public;
revoke all on function public.get_public_showcase() from anon;
revoke all on function public.get_public_showcase() from authenticated;
revoke all on function public.get_public_showcase() from service_role;
grant execute on function public.get_public_showcase() to anon, authenticated;
