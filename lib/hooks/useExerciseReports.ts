'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';

export type ExerciseReport = {
  id: string;
  module_id: string;
  activity_title: string | null;
  confidence: number | null;
  difficulty: number | null;
  time_spent_minutes: number | null;
  what_learned: string | null;
  struggles: string | null;
  created_at: string;
};

export type NewExerciseReport = {
  moduleId: string;
  activityTitle: string;
  confidence: number;
  difficulty: number;
  timeSpentMinutes: number | null;
  whatLearned: string;
  struggles: string;
};

export const REPORTS_KEY = ['exercise-reports'];
export const EXERCISE_REPORT_XP = 15;

export function useExerciseReports() {
  const q = useQuery({
    queryKey: REPORTS_KEY,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('exercise_reports')
        .select('id,module_id,activity_title,confidence,difficulty,time_spent_minutes,what_learned,struggles,created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data || []) as ExerciseReport[];
    },
  });

  const byModule = useMemo(() => {
    const map = new Map<string, ExerciseReport[]>();
    for (const r of q.data || []) {
      const arr = map.get(r.module_id) || [];
      arr.push(r);
      map.set(r.module_id, arr);
    }
    return map;
  }, [q.data]);

  return { ...q, reports: q.data || [], byModule };
}

export function useCreateExerciseReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewExerciseReport) => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('exercise_reports')
        .insert({
          owner_id: userId,
          module_id: input.moduleId,
          activity_title: input.activityTitle.trim() || null,
          confidence: input.confidence,
          difficulty: input.difficulty,
          time_spent_minutes: input.timeSpentMinutes,
          what_learned: input.whatLearned.trim() || null,
          struggles: input.struggles.trim() || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ExerciseReport;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REPORTS_KEY });
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
