'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';
import { ACHIEVEMENTS, achievementProgress, type AchievementProgress, type AchievementStats } from '@/lib/achievements';
import type { LabAchievementView } from '@/lib/lab/types';
import { useCurriculumTree } from './useCurriculum';
import { useExerciseReports } from './useExerciseReports';
import { useStudyLogs } from './useStudyLogs';
import { useStreak, useXp } from './useGamification';

type DefRow = { id: string; key: string };
type EarnedRow = { achievement_id: string; earned_at: string };

export const ACHIEVEMENTS_KEY = ['achievements'];

async function fetchAchievementState() {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('Not signed in');

  // Ensure definitions exist / are up to date (idempotent upsert on owner_id,key)
  const rows = ACHIEVEMENTS.map((a) => ({
    owner_id: userId, key: a.key, title: a.title, description: a.description, icon: a.icon,
    xp_reward: a.xp_reward, criteria: { metric: a.metric, target: a.target },
  }));
  const { error: upErr } = await supabase.from('achievement_definitions').upsert(rows, { onConflict: 'owner_id,key' });
  if (upErr) throw new Error(upErr.message);

  const [defs, earned] = await Promise.all([
    supabase.from('achievement_definitions').select('id,key'),
    supabase.from('earned_achievements').select('achievement_id,earned_at'),
  ]);
  if (defs.error) throw new Error(defs.error.message);
  if (earned.error) throw new Error(earned.error.message);
  return { userId, defs: (defs.data || []) as DefRow[], earned: (earned.data || []) as EarnedRow[] };
}

export type AchievementView = LabAchievementView;

export function useAchievements({ unlock = true }: { unlock?: boolean } = {}) {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ACHIEVEMENTS_KEY, queryFn: fetchAchievementState, staleTime: 60_000 });
  const { tree, isLoading: treeLoading } = useCurriculumTree();
  const reports = useExerciseReports();
  const logs = useStudyLogs();
  const { streak, isLoading: streakLoading } = useStreak();
  const xp = useXp();

  const loading = state.isLoading || treeLoading || reports.isLoading || logs.isLoading || streakLoading || xp.isLoading;

  const stats: AchievementStats = useMemo(() => ({
    modules_done: tree?.totals.modulesDone ?? 0,
    units_done: tree?.totals.unitsDone ?? 0,
    phases_done: tree?.totals.phasesDone ?? 0,
    reports: reports.reports.length,
    logs: logs.logs.length,
    minutes: logs.totalMinutes + reports.reports.reduce((s, r) => s + (r.time_spent_minutes || 0), 0),
    streak: Math.max(streak.current, streak.longest),
    level: xp.level.level,
  }), [tree, reports.reports, logs.logs, logs.totalMinutes, streak, xp.level.level]);

  const items: AchievementView[] = useMemo(() => {
    const defById = new Map((state.data?.defs || []).map((d) => [d.key, d.id] as const));
    const earnedById = new Map((state.data?.earned || []).map((e) => [e.achievement_id, e.earned_at] as const));
    return ACHIEVEMENTS.map((def) => {
      const id = defById.get(def.key) ?? null;
      const earnedAt = id ? earnedById.get(id) ?? null : null;
      const p = achievementProgress(def, stats);
      return { ...p, id, earnedAt, complete: p.complete || Boolean(earnedAt) };
    });
  }, [state.data, stats]);

  const earnedCount = items.filter((i) => i.earnedAt).length;
  const nearest = useMemo(
    () => items.filter((i) => !i.earnedAt && !i.complete).sort((a, b) => b.ratio - a.ratio || a.target - b.target).slice(0, 3),
    [items]
  );

  // Unlock newly completed achievements (once per key per session)
  const inflight = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!unlock || loading || !state.data) return;
    const toUnlock = items.filter((i) => i.id && !i.earnedAt && achievementProgress(i.def, stats).complete && !inflight.current.has(i.def.key));
    if (toUnlock.length === 0) return;
    const supabase = createClient();
    (async () => {
      for (const a of toUnlock) {
        inflight.current.add(a.def.key);
        const { error } = await supabase.from('earned_achievements').insert({ owner_id: state.data.userId, achievement_id: a.id });
        if (!error) toast.success(`Achievement unlocked: ${a.def.title}`, { description: `${a.def.description} +${a.def.xp_reward} XP` });
        else if (error.code !== '23505') inflight.current.delete(a.def.key);
      }
      qc.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    })();
  }, [unlock, loading, items, stats, state.data, qc]);

  return { items, nearest, earnedCount, total: ACHIEVEMENTS.length, stats, isLoading: loading, error: state.error };
}
