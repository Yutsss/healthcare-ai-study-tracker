-- Achievements XP, study-log/report delete cleanup, milestone <-> phase links

-- earned achievement -> XP + activity
create or replace function public.on_achievement_earned()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text; v_xp integer;
begin
  select title, xp_reward into v_title, v_xp from public.achievement_definitions where id = new.achievement_id;
  if coalesce(v_xp, 0) > 0 and not exists (
    select 1 from public.xp_events where owner_id = new.owner_id and source_type = 'achievement' and source_id = new.achievement_id
  ) then
    insert into public.xp_events (owner_id, amount, source_type, source_id, reason)
    values (new.owner_id, v_xp, 'achievement', new.achievement_id, 'Achievement unlocked: ' || coalesce(v_title, ''));
  end if;
  insert into public.activity_events (owner_id, event_type, entity_type, entity_id, payload)
  values (new.owner_id, 'achievement_earned', 'achievement', new.achievement_id, jsonb_build_object('title', v_title, 'xp', v_xp));
  return new;
end $$;

drop trigger if exists trg_achievement_earned on public.earned_achievements;
create trigger trg_achievement_earned
  after insert on public.earned_achievements
  for each row execute function public.on_achievement_earned();

-- deleting a study log removes its XP + activity
create or replace function public.on_study_log_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.xp_events where owner_id = old.owner_id and source_type = 'study_log' and source_id = old.id;
  delete from public.activity_events where owner_id = old.owner_id and entity_type = 'study_log' and entity_id = old.id;
  return old;
end $$;

drop trigger if exists trg_study_log_delete on public.study_logs;
create trigger trg_study_log_delete
  after delete on public.study_logs
  for each row execute function public.on_study_log_delete();

-- deleting an exercise report removes its XP + activity
create or replace function public.on_exercise_report_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.xp_events where owner_id = old.owner_id and source_type = 'exercise_report' and source_id = old.id;
  delete from public.activity_events where owner_id = old.owner_id and entity_type = 'exercise_report' and entity_id = old.id;
  return old;
end $$;

drop trigger if exists trg_exercise_report_delete on public.exercise_reports;
create trigger trg_exercise_report_delete
  after delete on public.exercise_reports
  for each row execute function public.on_exercise_report_delete();

-- milestone_roadmap_items: make RLS work on the join table (owner_id already present)
create index if not exists idx_milestone_roadmap_owner on public.milestone_roadmap_items(owner_id);
create index if not exists idx_earned_achievements_owner on public.earned_achievements(owner_id);
