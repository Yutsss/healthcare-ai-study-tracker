'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { celebrate } from '@/lib/celebrate';
import { createClient } from '@/lib/supabase/browser';
import { currentWeekStartKey, questTemplatesToCreate, questsForWeek, type QuestTemplate, type QuestType } from '@/lib/quests';
import { weekDayKeys } from '@/lib/week';
import { useStudyLogs } from './useStudyLogs';
import { useStreak } from './useGamification';
import type { LabQuestRow, LabQuestView } from '@/lib/lab/types';

export type QuestRow = LabQuestRow;
export type QuestView = LabQuestView;

export const QUESTS_KEY = ['weekly-quests'];

async function ensureWeekQuests(): Promise<QuestRow[]> {
  const supabase = createClient();
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess?.session?.user?.id;
  if (!userId) throw new Error('Not signed in');
  const week = currentWeekStartKey();
  const existing = await supabase.from('weekly_quests').select('*').eq('week_start', week).order('created_at');
  if (existing.error) throw new Error(existing.error.message);
  const existingRows = (existing.data || []) as QuestRow[];
  const templates = questTemplatesToCreate(week, existingRows.length);
  if (templates.length === 0) return existingRows;
  // Idempotent: unique (owner_id, week_start, key). Never re-create or reset existing rows.
  const rows = templates.map((t) => ({
    owner_id: userId, week_start: week, key: t.key, title: t.title, description: t.description,
    quest_type: t.type, target: t.target, xp_reward: t.xp,
  }));
  const { error: upErr } = await supabase.from('weekly_quests').upsert(rows, { onConflict: 'owner_id,week_start,key', ignoreDuplicates: true });
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase.from('weekly_quests').select('*').eq('week_start', week).order('created_at');
  if (error) throw new Error(error.message);
  return (data || []) as QuestRow[];
}

async function weekActivityCounts(): Promise<Record<string, number>> {
  const supabase = createClient();
  const keys = weekDayKeys();
  const start = new Date(keys[0] + 'T00:00:00');
  const { data, error } = await supabase
    .from('activity_events')
    .select('event_type,created_at')
    .gte('created_at', start.toISOString())
    .limit(2000);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const e of data || []) counts[e.event_type] = (counts[e.event_type] || 0) + 1;
  return counts;
}

export function useWeeklyQuests() {
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: QUESTS_KEY, queryFn: ensureWeekQuests, staleTime: 60_000 });
  const acts = useQuery({ queryKey: ['activity', 'week-counts'], queryFn: weekActivityCounts, staleTime: 30_000 });
  const { logs } = useStudyLogs();
  const { streak } = useStreak();

  const metrics = useMemo(() => {
    const keys = new Set(weekDayKeys());
    const weekLogs = logs.filter((l) => keys.has(l.logged_on));
    const a = acts.data || {};
    return {
      sessions: weekLogs.length,
      minutes: weekLogs.reduce((s, l) => s + l.minutes, 0),
      focus_intervals: weekLogs.reduce((s, l) => s + (l.focus_intervals || 0), 0),
      modules: a['module_completed'] || 0,
      courses: a['unit_completed'] || 0,
      reports: a['exercise_reported'] || 0,
      streak: streak.current,
    } as Record<QuestType, number>;
  }, [logs, acts.data, streak.current]);

  const quests: QuestView[] = useMemo(() => (rows.data || []).map((r) => {
    const current = metrics[r.quest_type] ?? 0;
    return {
      ...r,
      current,
      ratio: Math.min(1, current / Math.max(1, r.target)),
      complete: Boolean(r.completed_at) || current >= r.target,
      template: questsForWeek(r.week_start).find((t) => t.key === r.key),
    };
  }), [rows.data, metrics]);

  // Persist progress and mark completion (XP awarded once by DB trigger).
  const inflight = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!rows.data || acts.isLoading) return;
    const supabase = createClient();
    const updates = quests.filter((q) => {
      const progress = Math.min(q.target, q.current);
      const shouldComplete = !q.completed_at && q.current >= q.target;
      return (progress !== q.progress || shouldComplete) && !inflight.current.has(q.id);
    });
    if (!updates.length) return;
    (async () => {
      let changed = false;
      for (const q of updates) {
        inflight.current.add(q.id);
        const patch: Record<string, unknown> = { progress: Math.min(q.target, q.current) };
        const completing = !q.completed_at && q.current >= q.target;
        if (completing) patch.completed_at = new Date().toISOString();
        const { error } = await supabase.from('weekly_quests').update(patch).eq('id', q.id).is('completed_at', null);
        inflight.current.delete(q.id);
        if (!error) {
          changed = true;
          if (completing) {
            celebrate('quest');
            toast.success(`Quest complete: ${q.title}`, { description: `+${q.xp_reward} XP bonus`, duration: 6000 });
          }
        }
      }
      if (changed) {
        qc.invalidateQueries({ queryKey: QUESTS_KEY });
        qc.invalidateQueries({ queryKey: ['xp'] });
        qc.invalidateQueries({ queryKey: ['activity'] });
      }
    })();
  }, [quests, rows.data, acts.isLoading, qc]);

  const completed = quests.filter((q) => q.completed_at).length;
  return { quests, completed, isLoading: rows.isLoading || acts.isLoading, error: rows.error || acts.error, weekStart: currentWeekStartKey() };
}
