'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import { safeExternalUrl } from '@/lib/security/url';
import { newSessionId } from '@/lib/focus';
import { CURRICULUM_KEY } from './useCurriculum';
import type { RoadmapRow, UnitRow, ModuleRow } from '@/lib/curriculum';

export type EntityType = 'roadmap_item' | 'course_unit' | 'module';
const TABLE: Record<EntityType, string> = { roadmap_item: 'roadmap_items', course_unit: 'course_units', module: 'modules' };

export type ChangeLogRow = {
  id: string; entity_type: EntityType; entity_id: string | null; action: string;
  before_data: Record<string, any> | null; after_data: Record<string, any> | null; created_at: string;
};
export const CHANGE_LOG_KEY = ['curriculum-change-log'];

async function userId() {
  const { data } = await createClient().auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

async function logChange(entity_type: EntityType, entity_id: string | null, action: string, before: unknown, after: unknown) {
  const owner_id = await userId();
  const { error } = await createClient().from('curriculum_change_log').insert({ owner_id, entity_type, entity_id, action, before_data: before ?? null, after_data: after ?? null });
  if (error) throw new Error(error.message);
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CURRICULUM_KEY });
  qc.invalidateQueries({ queryKey: CHANGE_LOG_KEY });
}

export function useChangeLog(limit = 60) {
  return useQuery({
    queryKey: [...CHANGE_LOG_KEY, limit],
    queryFn: async () => {
      const { data, error } = await createClient().from('curriculum_change_log').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      return (data || []) as ChangeLogRow[];
    },
  });
}

export type PhaseInput = { title: string; phase_label?: string; description?: string; provider?: string; category?: string; priority?: string; access?: string; target_competency?: string; source_url?: string };
export type UnitInput = { title: string; description?: string; source_url?: string };
export type ModuleInput = { title: string; description?: string; source_type?: string; source_url?: string; xp_value?: number; estimated_minutes?: number };

const str = (v: unknown, max: number) => { const s = typeof v === 'string' ? v.trim() : ''; return s ? s.slice(0, max) : null; };

function phaseRow(i: PhaseInput) {
  const title = str(i.title, 200); if (!title) throw new Error('Title is required');
  return { title, phase_label: str(i.phase_label, 120), description: str(i.description, 4000), provider: str(i.provider, 120), category: str(i.category, 80), priority: str(i.priority, 40), access: str(i.access, 40), target_competency: str(i.target_competency, 2000), source_url: safeExternalUrl(i.source_url) };
}
function unitRow(i: UnitInput) {
  const title = str(i.title, 200); if (!title) throw new Error('Title is required');
  const u = safeExternalUrl(i.source_url);
  return { title, description: str(i.description, 4000), source_urls: u ? [u] : [] };
}
function moduleRow(i: ModuleInput) {
  const title = str(i.title, 200); if (!title) throw new Error('Title is required');
  const xp = Math.round(Number(i.xp_value)); const est = Math.round(Number(i.estimated_minutes));
  return { title, description: str(i.description, 4000), source_type: str(i.source_type, 60), source_url: safeExternalUrl(i.source_url), xp_value: Number.isFinite(xp) ? Math.min(500, Math.max(1, xp)) : 20, estimated_minutes: Number.isFinite(est) && est > 0 ? Math.min(6000, est) : null };
}

export function useCurriculumAdmin() {
  const qc = useQueryClient();
  const sb = () => createClient();

  const createPhase = useMutation({
    mutationFn: async ({ input, siblings }: { input: PhaseInput; siblings: RoadmapRow[] }) => {
      const owner_id = await userId();
      const sort_order = (siblings.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)) + 1;
      const row = { owner_id, key: `custom-${newSessionId().slice(0, 8)}`, ...phaseRow(input), sort_order, manually_edited: true };
      const { data, error } = await sb().from('roadmap_items').insert(row).select().single();
      if (error) throw new Error(error.message);
      await logChange('roadmap_item', data.id, 'create', null, { title: data.title });
      return data;
    },
    onSuccess: () => invalidate(qc),
  });

  const createUnit = useMutation({
    mutationFn: async ({ phaseId, input, siblings }: { phaseId: string; input: UnitInput; siblings: UnitRow[] }) => {
      const owner_id = await userId();
      const sort_order = (siblings.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)) + 1;
      const row = { owner_id, roadmap_item_id: phaseId, key: `custom-${newSessionId().slice(0, 8)}`, ...unitRow(input), sort_order, manually_edited: true };
      const { data, error } = await sb().from('course_units').insert(row).select().single();
      if (error) throw new Error(error.message);
      await logChange('course_unit', data.id, 'create', null, { title: data.title });
      return data;
    },
    onSuccess: () => invalidate(qc),
  });

  const createModule = useMutation({
    mutationFn: async ({ unitId, input, siblings }: { unitId: string; input: ModuleInput; siblings: ModuleRow[] }) => {
      const owner_id = await userId();
      const sort_order = (siblings.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)) + 1;
      const row = { owner_id, course_unit_id: unitId, key: `custom-${newSessionId().slice(0, 8)}`, ...moduleRow(input), sort_order, manually_edited: true };
      const { data, error } = await sb().from('modules').insert(row).select().single();
      if (error) throw new Error(error.message);
      await logChange('module', data.id, 'create', null, { title: data.title });
      return data;
    },
    onSuccess: () => invalidate(qc),
  });

  const update = useMutation({
    mutationFn: async ({ type, id, input, before }: { type: EntityType; id: string; input: PhaseInput | UnitInput | ModuleInput; before: Record<string, any> }) => {
      const patch = type === 'roadmap_item' ? phaseRow(input as PhaseInput) : type === 'course_unit' ? unitRow(input as UnitInput) : moduleRow(input as ModuleInput);
      const { data, error } = await sb().from(TABLE[type]).update({ ...patch, manually_edited: true }).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      const diffBefore: Record<string, unknown> = {}, diffAfter: Record<string, unknown> = {};
      for (const k of Object.keys(patch)) if (JSON.stringify((before as any)[k] ?? null) !== JSON.stringify((patch as any)[k] ?? null)) { diffBefore[k] = (before as any)[k] ?? null; diffAfter[k] = (patch as any)[k]; }
      await logChange(type, id, 'update', { title: before.title, ...diffBefore }, { title: data.title, ...diffAfter });
      return data;
    },
    onSuccess: () => invalidate(qc),
  });

  const setArchived = useMutation({
    mutationFn: async ({ type, id, archived, title }: { type: EntityType; id: string; archived: boolean; title: string }) => {
      const { error } = await sb().from(TABLE[type]).update({ archived_at: archived ? new Date().toISOString() : null, manually_edited: true }).eq('id', id);
      if (error) throw new Error(error.message);
      await logChange(type, id, archived ? 'archive' : 'restore', { title }, { title });
    },
    onSuccess: () => invalidate(qc),
  });

  const move = useMutation({
    mutationFn: async ({ type, item, neighbour }: { type: EntityType; item: { id: string; sort_order: number; title: string }; neighbour: { id: string; sort_order: number; title: string } }) => {
      const t = TABLE[type];
      const a = Number(item.sort_order), b = Number(neighbour.sort_order);
      // Swap orders (if equal, nudge to keep a strict order)
      const newA = a === b ? b - 0.5 : b, newB = a === b ? b : a;
      const r1 = await sb().from(t).update({ sort_order: newA, manually_edited: true }).eq('id', item.id);
      if (r1.error) throw new Error(r1.error.message);
      const r2 = await sb().from(t).update({ sort_order: newB, manually_edited: true }).eq('id', neighbour.id);
      if (r2.error) throw new Error(r2.error.message);
      await logChange(type, item.id, 'reorder', { title: item.title, sort_order: a }, { title: item.title, sort_order: newA, swapped_with: neighbour.title });
    },
    onSuccess: () => invalidate(qc),
  });

  return { createPhase, createUnit, createModule, update, setArchived, move };
}
