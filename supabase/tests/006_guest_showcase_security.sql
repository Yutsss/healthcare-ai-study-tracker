\set ON_ERROR_STOP on

begin;

create temporary table showcase_test_results (
  case_name text primary key,
  payload jsonb
) on commit drop;

grant insert on table pg_temp.showcase_test_results to anon;

create temporary table showcase_test_context (
  owner_id uuid primary key
) on commit drop;

insert into pg_temp.showcase_test_context (owner_id)
values (:'owner_id'::uuid);

do $assert_column_defaults$
declare
  v_matching_columns integer;
  v_invalid_columns integer;
begin
  select pg_catalog.count(*)::integer
    into v_matching_columns
  from information_schema.columns as c
  where (c.table_schema, c.table_name, c.column_name) in (
    ('public', 'owner_settings', 'showcase_enabled'),
    ('public', 'projects', 'is_public')
  );

  select pg_catalog.count(*)::integer
    into v_invalid_columns
  from information_schema.columns as c
  where (c.table_schema, c.table_name, c.column_name) in (
    ('public', 'owner_settings', 'showcase_enabled'),
    ('public', 'projects', 'is_public')
  )
    and (c.is_nullable <> 'NO' or c.column_default is distinct from 'false');

  if v_matching_columns <> 2 or v_invalid_columns <> 0 then
    raise exception 'Publication flags must be NOT NULL and default to false';
  end if;
end
$assert_column_defaults$;

do $assert_function_boundary$
declare
  v_matching_functions integer;
begin
  select pg_catalog.count(*)::integer
    into v_matching_functions
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  join pg_catalog.pg_language as l on l.oid = p.prolang
  where n.nspname = 'public'
    and p.proname = 'get_public_showcase'
    and p.pronargs = 0
    and p.prorettype = 'jsonb'::pg_catalog.regtype
    and p.prosecdef = true
    and p.provolatile = 's'
    and l.lanname = 'sql'
    and p.proconfig @> array['search_path=public']::text[];

  if v_matching_functions <> 1 then
    raise exception 'Public showcase RPC must be zero-argument stable SQL, SECURITY DEFINER, and fixed to search_path=public';
  end if;
end
$assert_function_boundary$;

update public.owner_settings as os
set showcase_enabled = false,
    showcase_bio = 'A public biography used by the showcase security test.'
where os.owner_id = :'owner_id'::uuid;

do $assert_owner_fixture$
begin
  if not exists (
    select 1
    from public.owner_settings as os
    join pg_temp.showcase_test_context as ctx on ctx.owner_id = os.owner_id
  ) then
    raise exception 'The supplied owner_id does not identify an owner_settings row';
  end if;
end
$assert_owner_fixture$;

set role anon;
insert into pg_temp.showcase_test_results (case_name, payload)
values ('disabled', public.get_public_showcase());
reset role;

do $assert_disabled$
declare
  v_payload jsonb;
begin
  select r.payload
    into v_payload
  from pg_temp.showcase_test_results as r
  where r.case_name = 'disabled';

  if v_payload is not null then
    raise exception 'Disabled publishing must return SQL NULL to anon';
  end if;
end
$assert_disabled$;

-- Isolate the aggregate fixture inside this rollback-only transaction.
delete from public.study_logs as sl where sl.owner_id = :'owner_id'::uuid;
delete from public.activity_events as ae where ae.owner_id = :'owner_id'::uuid;
delete from public.xp_events as xe where xe.owner_id = :'owner_id'::uuid;
delete from public.weekly_quests as wq where wq.owner_id = :'owner_id'::uuid;
delete from public.milestones as ms where ms.owner_id = :'owner_id'::uuid;
delete from public.projects as p where p.owner_id = :'owner_id'::uuid;
delete from public.roadmap_items as ri where ri.owner_id = :'owner_id'::uuid;
delete from public.achievement_definitions as ad where ad.owner_id = :'owner_id'::uuid;

insert into public.roadmap_items (
  id, owner_id, key, title, sort_order, archived_at
) values
  ('00000000-0000-0000-0000-000000000201', :'owner_id'::uuid, 'phase-one', 'Phase One', 1, null),
  ('00000000-0000-0000-0000-000000000202', :'owner_id'::uuid, 'phase-two', 'Phase Two', 2, null),
  ('00000000-0000-0000-0000-000000000203', :'owner_id'::uuid, 'phase-archived', 'Archived Phase', 3, pg_catalog.now());

insert into public.course_units (
  id, owner_id, roadmap_item_id, key, title, sort_order, archived_at
) values
  ('00000000-0000-0000-0000-000000000211', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000201', 'course-one', 'Course One', 1, null),
  ('00000000-0000-0000-0000-000000000212', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000202', 'course-two', 'Course Two', 2, null),
  ('00000000-0000-0000-0000-000000000213', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000202', 'course-archived', 'Archived Course', 3, pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000214', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000203', 'course-hidden-with-phase', 'Hidden Course', 4, null);

insert into public.modules (
  id, owner_id, course_unit_id, key, title, sort_order, archived_at
) values
  ('00000000-0000-0000-0000-000000000221', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000211', 'module-one', 'Module One', 1, null),
  ('00000000-0000-0000-0000-000000000222', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000211', 'module-two', 'Module Two', 2, null),
  ('00000000-0000-0000-0000-000000000223', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000212', 'module-three', 'Module Three', 3, null),
  ('00000000-0000-0000-0000-000000000224', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000212', 'module-archived', 'Archived Module', 4, pg_catalog.now()),
  ('00000000-0000-0000-0000-000000000225', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000213', 'module-hidden-with-course', 'Hidden Module', 5, null),
  ('00000000-0000-0000-0000-000000000226', :'owner_id'::uuid, '00000000-0000-0000-0000-000000000214', 'module-hidden-with-phase', 'Hidden Module', 6, null);

insert into public.module_progress (owner_id, module_id, status, completed_at) values
  (:'owner_id'::uuid, '00000000-0000-0000-0000-000000000221', 'done', pg_catalog.now()),
  (:'owner_id'::uuid, '00000000-0000-0000-0000-000000000222', 'learning', null),
  (:'owner_id'::uuid, '00000000-0000-0000-0000-000000000223', 'done', pg_catalog.now()),
  (:'owner_id'::uuid, '00000000-0000-0000-0000-000000000224', 'done', pg_catalog.now()),
  (:'owner_id'::uuid, '00000000-0000-0000-0000-000000000225', 'done', pg_catalog.now()),
  (:'owner_id'::uuid, '00000000-0000-0000-0000-000000000226', 'done', pg_catalog.now());

insert into public.achievement_definitions (
  id, owner_id, key, title, description, icon, criteria
) values (
  '00000000-0000-0000-0000-000000000231',
  :'owner_id'::uuid,
  'first-win',
  'First Win',
  'Completed the first showcase milestone.',
  'trophy',
  '{}'::jsonb
);

insert into public.earned_achievements (
  id, owner_id, achievement_id, earned_at
) values (
  '00000000-0000-0000-0000-000000000232',
  :'owner_id'::uuid,
  '00000000-0000-0000-0000-000000000231',
  '2026-09-01 12:00:00+00'::timestamptz
);

insert into public.projects (
  id, owner_id, key, title, description, project_type, status, tags,
  github_url, demo_url, cover_image_url, started_at, completed_at,
  sort_order, is_public
) values
  (
    '00000000-0000-0000-0000-000000000241', :'owner_id'::uuid,
    'public-active', 'Public Active', 'Safe public description', 'portfolio',
    'completed', array['AI', 'Health'], 'https://github.com/example/public',
    'https://example.com/demo', 'https://example.com/cover.png',
    '2026-08-01'::date, '2026-08-31'::date, 1, true
  ),
  (
    '00000000-0000-0000-0000-000000000242', :'owner_id'::uuid,
    'private-active', 'Private Active', 'Must remain private', 'private',
    'in_progress', array['Private'], null, null, null, null, null, 2, false
  ),
  (
    '00000000-0000-0000-0000-000000000243', :'owner_id'::uuid,
    'public-archived', 'Public Archived', 'Must remain archived', 'archive',
    'archived', array['Archived'], null, null, null, null, null, 3, true
  );

-- Fixture inserts fire existing XP/activity triggers. Replace their output with a
-- deterministic XP fixture so the public aggregate has a hand-checked expectation.
delete from public.activity_events as ae where ae.owner_id = :'owner_id'::uuid;
delete from public.xp_events as xe where xe.owner_id = :'owner_id'::uuid;

insert into public.xp_events (owner_id, amount, source_type, reason) values
  (:'owner_id'::uuid, 40, 'security_test', 'First public XP fixture'),
  (:'owner_id'::uuid, 60, 'security_test', 'Second public XP fixture');

update public.owner_settings as os
set display_name = 'Showcase Test Owner',
    showcase_enabled = true
where os.owner_id = :'owner_id'::uuid;

set role anon;
insert into pg_temp.showcase_test_results (case_name, payload)
values ('enabled', public.get_public_showcase());
reset role;

do $assert_enabled$
declare
  v_payload jsonb;
  v_top_level_keys text[];
  v_profile_keys text[];
  v_stats_keys text[];
  v_counter_keys text[];
  v_phase_keys text[];
  v_project_keys text[];
  v_achievement_keys text[];
begin
  select r.payload
    into v_payload
  from pg_temp.showcase_test_results as r
  where r.case_name = 'enabled';

  if v_payload is null then
    raise exception 'Enabled publishing must return a payload to anon';
  end if;

  if v_payload #>> '{profile,display_name}' is distinct from 'Showcase Test Owner'
     or v_payload #>> '{profile,bio}' is distinct from 'A public biography used by the showcase security test.' then
    raise exception 'Public profile did not contain the expected display name and bio';
  end if;

  if (v_payload #>> '{stats,xp}')::integer is distinct from 100
     or (v_payload #>> '{stats,phases,completed}')::integer is distinct from 1
     or (v_payload #>> '{stats,phases,total}')::integer is distinct from 2
     or (v_payload #>> '{stats,courses,completed}')::integer is distinct from 1
     or (v_payload #>> '{stats,courses,total}')::integer is distinct from 2
     or (v_payload #>> '{stats,modules,completed}')::integer is distinct from 2
     or (v_payload #>> '{stats,modules,total}')::integer is distinct from 3 then
    raise exception 'Public aggregate counts did not match the controlled fixture';
  end if;

  if pg_catalog.jsonb_array_length(v_payload -> 'phases') is distinct from 2
     or ((v_payload -> 'phases') @> '[{"key":"phase-one","title":"Phase One","completed":1,"total":2}]'::jsonb) is distinct from true
     or ((v_payload -> 'phases') @> '[{"key":"phase-two","title":"Phase Two","completed":1,"total":1}]'::jsonb) is distinct from true then
    raise exception 'Per-phase public aggregates included archived data or wrong counts';
  end if;

  if pg_catalog.jsonb_array_length(v_payload -> 'achievements') is distinct from 1
     or v_payload #>> '{achievements,0,key}' is distinct from 'first-win'
     or v_payload #>> '{achievements,0,title}' is distinct from 'First Win' then
    raise exception 'Public achievements did not match earned achievements';
  end if;

  if pg_catalog.jsonb_array_length(v_payload -> 'projects') is distinct from 1
     or v_payload #>> '{projects,0,title}' is distinct from 'Public Active' then
    raise exception 'Public projects must include only explicitly public, non-archived projects';
  end if;

  if (v_payload -> 'projects') @> '[{"title":"Private Active"}]'::jsonb
     or (v_payload -> 'projects') @> '[{"title":"Public Archived"}]'::jsonb then
    raise exception 'Private or archived projects leaked into the public payload';
  end if;

  select pg_catalog.array_agg(k.key order by k.key)
    into v_top_level_keys
  from pg_catalog.jsonb_object_keys(v_payload) as k(key);

  if v_top_level_keys is distinct from array['achievements', 'generated_at', 'phases', 'profile', 'projects', 'stats']::text[] then
    raise exception 'Public payload exposed an unexpected top-level field';
  end if;

  if pg_catalog.jsonb_typeof(v_payload -> 'generated_at') is distinct from 'string' then
    raise exception 'Public payload generated_at must be a timestamp string';
  end if;

  select pg_catalog.array_agg(k.key order by k.key)
    into v_profile_keys
  from pg_catalog.jsonb_object_keys(v_payload -> 'profile') as k(key);

  if v_profile_keys is distinct from array['bio', 'display_name']::text[] then
    raise exception 'Public profile projection exposed private or unspecified fields';
  end if;

  select pg_catalog.array_agg(k.key order by k.key)
    into v_stats_keys
  from pg_catalog.jsonb_object_keys(v_payload -> 'stats') as k(key);

  if v_stats_keys is distinct from array['courses', 'modules', 'phases', 'xp']::text[] then
    raise exception 'Public stats projection exposed private or unspecified fields';
  end if;

  select pg_catalog.array_agg(k.key order by k.key)
    into v_counter_keys
  from pg_catalog.jsonb_object_keys(v_payload #> '{stats,phases}') as k(key);

  if v_counter_keys is distinct from array['completed', 'total']::text[]
     or (select pg_catalog.array_agg(k.key order by k.key)
         from pg_catalog.jsonb_object_keys(v_payload #> '{stats,courses}') as k(key))
        is distinct from array['completed', 'total']::text[]
     or (select pg_catalog.array_agg(k.key order by k.key)
         from pg_catalog.jsonb_object_keys(v_payload #> '{stats,modules}') as k(key))
        is distinct from array['completed', 'total']::text[] then
    raise exception 'Public completion counters exposed private or unspecified fields';
  end if;

  select pg_catalog.array_agg(k.key order by k.key)
    into v_phase_keys
  from pg_catalog.jsonb_object_keys(v_payload #> '{phases,0}') as k(key);

  if v_phase_keys is distinct from array['completed', 'key', 'title', 'total']::text[] then
    raise exception 'Public phase projection exposed private or unspecified fields';
  end if;

  select pg_catalog.array_agg(k.key order by k.key)
    into v_project_keys
  from pg_catalog.jsonb_object_keys(v_payload #> '{projects,0}') as k(key);

  if v_project_keys is distinct from array[
    'completed_at', 'cover_image_url', 'demo_url', 'description', 'github_url',
    'project_type', 'started_at', 'status', 'tags', 'title'
  ]::text[] then
    raise exception 'Public project projection exposed private or unspecified fields';
  end if;

  select pg_catalog.array_agg(k.key order by k.key)
    into v_achievement_keys
  from pg_catalog.jsonb_object_keys(v_payload #> '{achievements,0}') as k(key);

  if v_achievement_keys is distinct from array['description', 'earned_at', 'icon', 'key', 'title']::text[] then
    raise exception 'Public achievement projection exposed private or unspecified fields';
  end if;
end
$assert_enabled$;

do $assert_privileges$
declare
  v_anon_table_grants integer;
  v_table_name text;
begin
  select pg_catalog.count(*)::integer
    into v_anon_table_grants
  from information_schema.role_table_grants as rtg
  where rtg.grantee = 'anon'
    and rtg.table_schema = 'public'
    and rtg.table_name = any (array[
      'owner_settings', 'roadmap_items', 'course_units', 'modules',
      'module_progress', 'exercise_reports', 'curriculum_change_log',
      'milestones', 'milestone_roadmap_items', 'projects', 'study_logs',
      'activity_events', 'xp_events', 'achievement_definitions',
      'earned_achievements', 'weekly_quests'
    ]::text[]);

  if v_anon_table_grants <> 0 then
    raise exception 'Anonymous role must have zero direct application-table privileges';
  end if;

  foreach v_table_name in array array[
    'owner_settings', 'roadmap_items', 'course_units', 'modules',
    'module_progress', 'exercise_reports', 'curriculum_change_log',
    'milestones', 'milestone_roadmap_items', 'projects', 'study_logs',
    'activity_events', 'xp_events', 'achievement_definitions',
    'earned_achievements', 'weekly_quests'
  ]
  loop
    if pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', v_table_name), 'SELECT'
    ) or pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', v_table_name), 'INSERT'
    ) or pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', v_table_name), 'UPDATE'
    ) or pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', v_table_name), 'DELETE'
    ) or pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', v_table_name), 'TRUNCATE'
    ) or pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', v_table_name), 'REFERENCES'
    ) or pg_catalog.has_table_privilege(
      'anon', pg_catalog.format('public.%I', v_table_name), 'TRIGGER'
    ) then
      raise exception 'Anonymous role has an effective privilege on application table %',
        v_table_name;
    end if;
  end loop;

  if not pg_catalog.has_function_privilege(
    'anon', 'public.get_public_showcase()', 'EXECUTE'
  ) then
    raise exception 'Anonymous role must be able to execute get_public_showcase()';
  end if;

  if not pg_catalog.has_function_privilege(
    'authenticated', 'public.get_public_showcase()', 'EXECUTE'
  ) then
    raise exception 'Authenticated role must be able to execute get_public_showcase()';
  end if;

  if pg_catalog.has_function_privilege(
    'service_role', 'public.get_public_showcase()', 'EXECUTE'
  ) then
    raise exception 'Service role must not be a public showcase execution path';
  end if;
end
$assert_privileges$;

rollback;
