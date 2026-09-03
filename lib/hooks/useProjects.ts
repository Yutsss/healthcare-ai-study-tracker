'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import { safeExternalUrl } from '@/lib/security/url';

export type ProjectStatus = 'idea' | 'planned' | 'in_progress' | 'completed' | 'archived';
export type Project = {
  id: string; key: string | null; title: string; description: string | null; project_type: string | null;
  status: ProjectStatus; tags: string[]; github_url: string | null; demo_url: string | null; cover_image_url: string | null;
  started_at: string | null; completed_at: string | null; sort_order: number; created_at: string; updated_at: string;
};

export type ProjectInput = {
  title: string; description?: string; project_type?: string; status: ProjectStatus; tags: string[];
  github_url?: string; demo_url?: string; cover_image_url?: string;
};

export const PROJECTS_KEY = ['projects'];

async function userId() {
  const { data } = await createClient().auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

function clean(input: ProjectInput) {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error('Title is required');
  const today = new Date().toISOString().slice(0, 10);
  return {
    title,
    description: input.description?.trim().slice(0, 4000) || null,
    project_type: input.project_type?.trim().slice(0, 100) || null,
    status: input.status,
    tags: Array.from(new Set(input.tags.map((t) => t.trim().slice(0, 40)).filter(Boolean))).slice(0, 20),
    github_url: safeExternalUrl(input.github_url),
    demo_url: safeExternalUrl(input.demo_url),
    cover_image_url: safeExternalUrl(input.cover_image_url),
    _today: today,
  };
}

export function useProjects() {
  const q = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      const { data, error } = await createClient().from('projects').select('*').order('sort_order').order('created_at');
      if (error) throw new Error(error.message);
      return (data || []) as Project[];
    },
  });
  return { ...q, projects: q.data || [] };
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const c = clean(input);
      const owner_id = await userId();
      const { _today, ...row } = c;
      const { data, error } = await createClient().from('projects').insert({
        owner_id, ...row, manually_edited: true,
        started_at: row.status === 'in_progress' || row.status === 'completed' ? _today : null,
        completed_at: row.status === 'completed' ? _today : null,
      }).select().single();
      if (error) throw new Error(error.message);
      return data as Project;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROJECTS_KEY }); qc.invalidateQueries({ queryKey: ['activity'] }); },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, existing }: { id: string; input: ProjectInput; existing: Project }) => {
      const c = clean(input);
      const { _today, ...row } = c;
      const patch: Record<string, unknown> = { ...row, manually_edited: true };
      if ((row.status === 'in_progress' || row.status === 'completed') && !existing.started_at) patch.started_at = _today;
      if (row.status === 'completed' && !existing.completed_at) patch.completed_at = _today;
      if (row.status !== 'completed') patch.completed_at = null;
      const { data, error } = await createClient().from('projects').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as Project;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROJECTS_KEY }); qc.invalidateQueries({ queryKey: ['xp'] }); qc.invalidateQueries({ queryKey: ['activity'] }); },
  });
}

export function useMoveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ project, status }: { project: Project; status: ProjectStatus }) => {
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, unknown> = { status };
      if ((status === 'in_progress' || status === 'completed') && !project.started_at) patch.started_at = today;
      patch.completed_at = status === 'completed' ? (project.completed_at || today) : null;
      const { error } = await createClient().from('projects').update(patch).eq('id', project.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROJECTS_KEY }); qc.invalidateQueries({ queryKey: ['xp'] }); qc.invalidateQueries({ queryKey: ['activity'] }); },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('projects').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
