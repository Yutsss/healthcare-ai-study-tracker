'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DemoProject, ProjectStatus } from '@/lib/demo/state';
import { useDemo } from './demo-provider';

const projectStatuses: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'idea', label: 'Idea' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

type ProjectForm = { title: string; description: string; projectType: string; tags: string; githubUrl: string; demoUrl: string };
const emptyForm: ProjectForm = { title: '', description: '', projectType: '', tags: '', githubUrl: '', demoUrl: '' };

export function DemoProjects() {
  const { state, saveProject, setProjectStatus, deleteProject } = useDemo();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof ProjectForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Project title is required.');
      return;
    }
    const existing = editingId ? state.projects.find((project) => project.id === editingId) : undefined;
    saveProject({
      id: editingId ?? crypto.randomUUID(),
      title: form.title,
      description: form.description,
      projectType: form.projectType,
      status: existing?.status ?? 'idea',
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      githubUrl: form.githubUrl,
      demoUrl: form.demoUrl,
      coverImageUrl: existing?.coverImageUrl ?? null,
      createdAt: existing?.createdAt ?? null,
      updatedAt: existing?.updatedAt ?? null,
      startedAt: existing?.startedAt ?? null,
      completedAt: existing?.completedAt ?? null,
    });
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function edit(project: DemoProject) {
    setEditingId(project.id);
    setForm({
      title: project.title,
      description: project.description ?? '',
      projectType: project.projectType ?? '',
      tags: project.tags.join(', '),
      githubUrl: project.githubUrl ?? '',
      demoUrl: project.demoUrl ?? '',
    });
    setError(null);
  }

  return (
    <section aria-labelledby="demo-projects-title" className="space-y-6">
      <div><h2 id="demo-projects-title" className="text-2xl font-bold tracking-tight">Demo projects</h2><p className="mt-2 text-sm text-muted-foreground">Create and manage portfolio ideas locally without publishing anything.</p></div>
      <Card>
        <CardHeader><CardTitle>{editingId ? 'Edit project' : 'Create a project'}</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="demo-project-title">Project title</Label><Input id="demo-project-title" maxLength={200} value={form.title} onChange={(event) => update('title', event.target.value)} required /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="demo-project-description">Project description</Label><Textarea id="demo-project-description" maxLength={4000} value={form.description} onChange={(event) => update('description', event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="demo-project-type">Project type</Label><Input id="demo-project-type" maxLength={100} value={form.projectType} onChange={(event) => update('projectType', event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="demo-project-tags">Tags (comma separated)</Label><Input id="demo-project-tags" value={form.tags} onChange={(event) => update('tags', event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="demo-project-github">GitHub URL</Label><Input id="demo-project-github" type="url" maxLength={2000} value={form.githubUrl} onChange={(event) => update('githubUrl', event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="demo-project-demo">Demo URL</Label><Input id="demo-project-demo" type="url" maxLength={2000} value={form.demoUrl} onChange={(event) => update('demoUrl', event.target.value)} /></div>
            {error && <p role="alert" className="text-sm font-medium text-destructive md:col-span-2">{error}</p>}
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit">{editingId ? 'Save project' : 'Create project'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel edit</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {state.projects.map((project) => (
          <Card key={project.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3"><CardTitle><h3>{project.title}</h3></CardTitle><Badge variant="secondary">{project.status.replaceAll('_', ' ')}</Badge></div>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
              {project.tags.length > 0 && <div className="flex flex-wrap gap-2">{project.tags.map((tag, index) => <Badge key={`${project.id}-${tag}-${index}`} variant="outline">{tag}</Badge>)}</div>}
              <label className="block text-sm font-medium">
                <span className="sr-only">Status for {project.title}</span>
                <select aria-label={`Status for ${project.title}`} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={project.status} onChange={(event) => setProjectStatus(project.id, event.target.value as ProjectStatus)}>
                  {projectStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" aria-label={`Edit ${project.title}`} onClick={() => edit(project)}>Edit</Button>
                {project.status !== 'archived' && <Button type="button" variant="outline" size="sm" aria-label={`Archive ${project.title}`} onClick={() => setProjectStatus(project.id, 'archived')}>Archive</Button>}
                <Button type="button" variant="destructive" size="sm" aria-label={`Delete ${project.title}`} onClick={() => deleteProject(project.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
