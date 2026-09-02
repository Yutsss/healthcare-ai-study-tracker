'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import { buildTree, type CurriculumRaw, type ModuleStatus, type ProgressRow } from '@/lib/curriculum';

export const CURRICULUM_KEY = ['curriculum'];

async function fetchCurriculum(): Promise<CurriculumRaw> {
  const supabase = createClient();
  const [r, u, m, p] = await Promise.all([
    supabase.from('roadmap_items').select('*').order('sort_order'),
    supabase.from('course_units').select('*').order('sort_order'),
    supabase.from('modules').select('*').order('sort_order'),
    supabase.from('module_progress').select('*'),
  ]);
  for (const res of [r, u, m, p]) if (res.error) throw new Error(res.error.message);
  return { roadmap: r.data as any, units: u.data as any, modules: m.data as any, progress: p.data as any };
}

export function useCurriculumRaw() {
  return useQuery({ queryKey: CURRICULUM_KEY, queryFn: fetchCurriculum, staleTime: 30_000 });
}

export function useCurriculumTree() {
  const q = useCurriculumRaw();
  const tree = useMemo(() => (q.data ? buildTree(q.data) : null), [q.data]);
  return { ...q, tree };
}

export function useSetModuleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ moduleId, status }: { moduleId: string; status: ModuleStatus }) => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Not signed in');

      const raw = qc.getQueryData<CurriculumRaw>(CURRICULUM_KEY);
      const existing = raw?.progress?.find((p) => p.module_id === moduleId);
      const now = new Date().toISOString();
      const row = {
        owner_id: userId,
        module_id: moduleId,
        status,
        started_at: status === 'not_started' ? null : existing?.started_at ?? now,
        completed_at: status === 'done' ? now : null,
      };
      const { data, error } = await supabase
        .from('module_progress')
        .upsert(row, { onConflict: 'owner_id,module_id' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ProgressRow;
    },
    onMutate: async ({ moduleId, status }) => {
      await qc.cancelQueries({ queryKey: CURRICULUM_KEY });
      const previous = qc.getQueryData<CurriculumRaw>(CURRICULUM_KEY);
      if (previous) {
        const nowIso = new Date().toISOString();
        const progress = [...previous.progress];
        const idx = progress.findIndex((p) => p.module_id === moduleId);
        const base: ProgressRow = idx >= 0 ? progress[idx] : { id: `tmp-${moduleId}`, module_id: moduleId, status: 'not_started', started_at: null, completed_at: null, notes: null };
        const next: ProgressRow = { ...base, status, started_at: status === 'not_started' ? null : base.started_at ?? nowIso, completed_at: status === 'done' ? nowIso : null };
        if (idx >= 0) progress[idx] = next; else progress.push(next);
        qc.setQueryData<CurriculumRaw>(CURRICULUM_KEY, { ...previous, progress });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(CURRICULUM_KEY, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CURRICULUM_KEY });
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
