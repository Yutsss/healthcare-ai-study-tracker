'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import type { CurriculumTree, PhaseNode } from '@/lib/curriculum';

export type MilestoneRow = { id: string; key: string | null; title: string; description: string | null; sort_order: number; achieved_at: string | null };
type LinkRow = { milestone_id: string; roadmap_item_id: string };

export type MilestoneView = MilestoneRow & {
  phases: PhaseNode[];
  phasesDone: number;
  percent: number;
  complete: boolean;
  index: number;
};

export const MILESTONES_KEY = ['milestones'];

export function useMilestones(tree: CurriculumTree | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: MILESTONES_KEY,
    queryFn: async () => {
      const supabase = createClient();
      const [m, l] = await Promise.all([
        supabase.from('milestones').select('id,key,title,description,sort_order,achieved_at').order('sort_order'),
        supabase.from('milestone_roadmap_items').select('milestone_id,roadmap_item_id'),
      ]);
      if (m.error) throw new Error(m.error.message);
      if (l.error) throw new Error(l.error.message);
      return { milestones: (m.data || []) as MilestoneRow[], links: (l.data || []) as LinkRow[] };
    },
  });

  const items: MilestoneView[] = useMemo(() => {
    if (!q.data) return [];
    const phaseById = new Map((tree?.phases || []).map((p) => [p.id, p] as const));
    return q.data.milestones.map((m, i) => {
      const phases = q.data!.links.filter((l) => l.milestone_id === m.id).map((l) => phaseById.get(l.roadmap_item_id)).filter(Boolean) as PhaseNode[];
      const phasesDone = phases.filter((p) => p.status === 'completed').length;
      const percent = phases.length ? Math.round(phases.reduce((s, p) => s + p.percent, 0) / phases.length) : 0;
      return { ...m, index: i + 1, phases, phasesDone, percent, complete: phases.length > 0 && phasesDone === phases.length };
    });
  }, [q.data, tree]);

  // Persist achieved_at the first time a milestone is seen complete
  const marked = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toMark = items.filter((m) => m.complete && !m.achieved_at && !marked.current.has(m.id));
    if (!toMark.length) return;
    const supabase = createClient();
    (async () => {
      for (const m of toMark) {
        marked.current.add(m.id);
        await supabase.from('milestones').update({ achieved_at: new Date().toISOString() }).eq('id', m.id);
      }
      qc.invalidateQueries({ queryKey: MILESTONES_KEY });
    })();
  }, [items, qc]);

  return { ...q, items };
}
