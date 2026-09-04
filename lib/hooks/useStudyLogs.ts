'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import { weekDayKeys } from '@/lib/week';
import { clampSettings, type PomodoroSettings } from '@/lib/focus';
import type { LabStudyLog } from '@/lib/lab/types';
export { studyLogXp } from '@/lib/gamification';

export type StudyLog = LabStudyLog;

export type OwnerSettings = {
  owner_id: string; display_name: string | null; weekly_goal_minutes: number; timezone: string;
  focus_minutes?: number; short_break_minutes?: number; long_break_minutes?: number; long_break_every?: number;
};

export const STUDY_LOGS_KEY = ['study-logs'];
export const SETTINGS_KEY = ['owner-settings'];
export const DEFAULT_WEEKLY_GOAL = 300;

async function getUserId() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export function useStudyLogs() {
  const q = useQuery({
    queryKey: STUDY_LOGS_KEY,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('study_logs')
        .select('id,logged_on,minutes,topic,notes,module_id,project_id,created_at,source,session_id,focus_intervals')
        .order('logged_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3000);
      if (error) throw new Error(error.message);
      return (data || []) as StudyLog[];
    },
  });

  const logs = q.data || [];
  const totals = useMemo(() => {
    const keys = new Set(weekDayKeys());
    let week = 0, total = 0;
    for (const l of logs) { total += l.minutes; if (keys.has(l.logged_on)) week += l.minutes; }
    return { weekMinutes: week, totalMinutes: total, sessions: logs.length };
  }, [logs]);

  return { ...q, logs, ...totals };
}

export function useOwnerSettings() {
  const q = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from('owner_settings').select('*').maybeSingle();
      if (error) throw new Error(error.message);
      return (data || null) as OwnerSettings | null;
    },
  });
  const pomodoro: PomodoroSettings = clampSettings({
    focusMinutes: q.data?.focus_minutes,
    shortBreakMinutes: q.data?.short_break_minutes,
    longBreakMinutes: q.data?.long_break_minutes,
    longBreakEvery: q.data?.long_break_every,
  });
  return { ...q, settings: q.data, weeklyGoal: q.data?.weekly_goal_minutes ?? DEFAULT_WEEKLY_GOAL, pomodoro };
}

export function useUpdatePomodoroSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PomodoroSettings) => {
      const s = clampSettings(input);
      const supabase = createClient();
      const owner_id = await getUserId();
      const { error } = await supabase.from('owner_settings').upsert({
        owner_id,
        focus_minutes: s.focusMinutes,
        short_break_minutes: s.shortBreakMinutes,
        long_break_minutes: s.longBreakMinutes,
        long_break_every: s.longBreakEvery,
      }, { onConflict: 'owner_id' });
      if (error) throw new Error(error.message);
      return s;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useUpdateWeeklyGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (minutes: number) => {
      if (!Number.isFinite(minutes) || minutes < 10 || minutes > 10080) throw new Error('Goal must be between 10 and 10080 minutes');
      const supabase = createClient();
      const owner_id = await getUserId();
      const { error } = await supabase.from('owner_settings').upsert({ owner_id, weekly_goal_minutes: Math.round(minutes) }, { onConflict: 'owner_id' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export type NewStudyLog = { minutes: number; topic: string; notes?: string; loggedOn: string; moduleId?: string | null };

export function useAddStudyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewStudyLog) => {
      const minutes = Math.round(input.minutes);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) throw new Error('Minutes must be between 1 and 1440');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.loggedOn)) throw new Error('Invalid date');
      const supabase = createClient();
      const owner_id = await getUserId();
      const { data, error } = await supabase
        .from('study_logs')
        .insert({
          owner_id,
          minutes,
          logged_on: input.loggedOn,
          topic: input.topic.trim() || null,
          notes: input.notes?.trim() || null,
          module_id: input.moduleId || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as StudyLog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STUDY_LOGS_KEY });
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useDeleteStudyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('study_logs').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STUDY_LOGS_KEY });
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
