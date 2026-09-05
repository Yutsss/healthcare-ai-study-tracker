'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import { computeStreak, levelFromXp } from '@/lib/gamification';
import type { LabActivityEvent, LabXpEvent } from '@/lib/lab/types';

export type XpEvent = LabXpEvent;
export type ActivityEvent = LabActivityEvent;

export function useXp() {
  const q = useQuery({
    queryKey: ['xp'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('xp_events')
        .select('id,amount,source_type,source_id,reason,created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data || []) as XpEvent[];
    },
  });
  const total = useMemo(() => (q.data || []).reduce((s, e) => s + (e.amount || 0), 0), [q.data]);
  const level = useMemo(() => levelFromXp(total), [total]);
  return { ...q, total, level, events: q.data || [] };
}

export function useActivity(limit = 12) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('activity_events')
        .select('id,event_type,entity_type,entity_id,payload,created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []) as ActivityEvent[];
    },
  });
}

/** Streak is derived from any activity (module progress, study logs, reports). */
export function useStreak() {
  const q = useQuery({
    queryKey: ['activity', 'streak-dates'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('activity_events')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(3000);
      if (error) throw new Error(error.message);
      return (data || []).map((d: { created_at: string }) => d.created_at);
    },
  });
  const streak = useMemo(() => computeStreak(q.data || []), [q.data]);
  return { ...q, streak };
}
